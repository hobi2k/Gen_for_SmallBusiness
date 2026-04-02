import {proxyFormPost} from '@/app/api/_lib/backend-proxy';

export async function POST(request: Request): Promise<Response> {
  // 음악 생성도 같은 프록시 유틸을 써서 백엔드로 전달한다.
  return proxyFormPost(request, '/generate/music');
}
