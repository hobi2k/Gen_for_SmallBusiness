import http from 'node:http';
import https from 'node:https';
import {Readable} from 'node:stream';

const backendBaseUrl = process.env.BACKEND_BASE_URL ?? 'http://127.0.0.1:8013';

function nodeRequest(
  backendPath: string,
  incomingHeaders: Record<string, string>,
  bodyStream: ReadableStream | null,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${backendBaseUrl}${backendPath}`);
    const lib = url.protocol === 'https:' ? https : http;

    const req = lib.request(
      {
        hostname: url.hostname,
        port: parseInt(url.port || (url.protocol === 'https:' ? '443' : '80')),
        path: url.pathname + url.search,
        method: 'POST',
        headers: incomingHeaders,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          const contentType = res.headers['content-type'] ?? 'application/json';
          resolve(
            new Response(body, {
              status: res.statusCode ?? 500,
              headers: {'Content-Type': contentType},
            }),
          );
        });
        res.on('error', reject);
      },
    );

    req.on('error', reject);

    if (bodyStream) {
      Readable.fromWeb(bodyStream as Parameters<typeof Readable.fromWeb>[0]).pipe(req);
    } else {
      req.end();
    }
  });
}

export async function proxyFormPost(request: Request, backendPath: string): Promise<Response> {
  try {
    const headers: Record<string, string> = {};
    const contentType = request.headers.get('content-type');
    if (contentType) headers['content-type'] = contentType;
    const contentLength = request.headers.get('content-length');
    if (contentLength) headers['content-length'] = contentLength;

    return await nodeRequest(backendPath, headers, request.body);
  } catch {
    return new Response(JSON.stringify({detail: '백엔드 서버에 연결할 수 없습니다.'}), {
      status: 502,
      headers: {'Content-Type': 'application/json'},
    });
  }
}

export async function proxyJsonPost(request: Request, backendPath: string): Promise<Response> {
  try {
    const body = await request.text();
    const bodyStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    });

    return await nodeRequest(
      backendPath,
      {'Content-Type': 'application/json'},
      bodyStream,
    );
  } catch {
    return new Response(JSON.stringify({detail: '백엔드 서버에 연결할 수 없습니다.'}), {
      status: 502,
      headers: {'Content-Type': 'application/json'},
    });
  }
}
