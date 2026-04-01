import {proxyFormPost} from '@/app/api/_lib/backend-proxy';

export async function POST(request: Request): Promise<Response> {
  return proxyFormPost(request, '/generate/video');
}

