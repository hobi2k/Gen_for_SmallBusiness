import http from 'node:http';
import https from 'node:https';
import {Readable} from 'node:stream';

// 브라우저는 이 주소를 직접 보지 않고, Next.js 서버만 실제 백엔드 주소를 안다.
const backendBaseUrl = process.env.BACKEND_BASE_URL ?? 'http://127.0.0.1:8013';

function nodeRequest(
  backendPath: string,
  incomingHeaders: Record<string, string>,
  bodyStream: ReadableStream | null,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    // 상대 경로로 들어온 프론트 요청을 실제 FastAPI 주소로 바꾼다.
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
          // Next.js route handler는 여기서 받은 응답을 그대로 브라우저에 다시 넘긴다.
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
    // 이미지 업로드가 있는 요청은 multipart/form-data 헤더를 최대한 그대로 넘긴다.
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
    // JSON 요청은 문자열로 읽은 뒤 다시 stream으로 감싸서 백엔드로 보낸다.
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
