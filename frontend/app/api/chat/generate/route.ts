import {proxyFormPost} from '@/app/api/_lib/backend-proxy';

export async function POST(request: Request): Promise<Response> {
  // 채팅은 이미지 첨부가 있을 수 있으므로 form-data 그대로 백엔드에 전달한다.
  return proxyFormPost(request, '/chat/generate');
}
