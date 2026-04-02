import {proxyFormPost} from '@/app/api/_lib/backend-proxy';

export async function POST(request: Request): Promise<Response> {
  // 이미지 전용 생성 요청을 FastAPI /generate/image로 그대로 프록시한다.
  return proxyFormPost(request, '/generate/image');
}
