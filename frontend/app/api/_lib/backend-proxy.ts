const backendBaseUrl = process.env.BACKEND_BASE_URL ?? 'http://127.0.0.1:8013';

export async function proxyJsonPost(request: Request, backendPath: string): Promise<Response> {
  const body = await request.text();
  const response = await fetch(`${backendBaseUrl}${backendPath}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body,
    cache: 'no-store',
  });

  return buildProxyResponse(response);
}

export async function proxyFormPost(request: Request, backendPath: string): Promise<Response> {
  const formData = await request.formData();
  const response = await fetch(`${backendBaseUrl}${backendPath}`, {
    method: 'POST',
    body: formData,
    cache: 'no-store',
  });

  return buildProxyResponse(response);
}

async function buildProxyResponse(response: Response): Promise<Response> {
  const contentType = response.headers.get('content-type') ?? 'application/json';
  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: {'Content-Type': contentType},
  });
}

