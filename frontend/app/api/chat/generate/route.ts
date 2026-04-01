import {proxyJsonPost} from '@/app/api/_lib/backend-proxy';

export async function POST(request: Request): Promise<Response> {
  return proxyJsonPost(request, '/chat/generate');
}

