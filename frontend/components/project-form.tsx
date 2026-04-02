'use client';

import {FormEvent, useState} from 'react';

const toneOptions = ['깔끔한 판매형', '따뜻한 공감형', '밝은 행사형', '고급스러운 브랜드형'];
// 이 파일은 초기 프로젝트 생성 실험용 폼이다. 현재 메인 진입점은 chat-panel / generation-form 쪽이다.
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';

export function ProjectForm() {
  // 전송 상태와 단일 안내 문구만 관리하는 단순 폼이다.
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('생성 요청을 보내는 중입니다.');

    const formData = new FormData(event.currentTarget);
    // 이 폼은 JSON API를 치므로 File 자체는 보내지 않고 문자열 필드만 묶는다.
    const payload = {
      product_name: String(formData.get('product_name') ?? ''),
      prompt: String(formData.get('prompt') ?? ''),
      tone: String(formData.get('tone') ?? toneOptions[0]),
      video_duration_seconds: Number(formData.get('video_duration_seconds') ?? 15),
      image_paths: [],
    };

    try {
      // 이 파일은 구형 구조라 Next.js 프록시가 아니라 직접 백엔드를 호출한다.
      const response = await fetch(`${apiBaseUrl}/projects`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail ?? '생성 요청에 실패했습니다.');
      }

      setMessage(`프로젝트가 생성되었습니다. 현재 상태: ${data.status}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4 rounded-[32px] border border-black/10 bg-white p-8 shadow-lg" onSubmit={handleSubmit}>
      <div>
        <label className="text-sm font-medium text-black/80">상품명</label>
        <input className="mt-2 w-full rounded-2xl border border-black/10 px-4 py-3" name="product_name" placeholder="예: 수제 딸기잼" required />
      </div>
      <div>
        <label className="text-sm font-medium text-black/80">생성 프롬프트</label>
        <textarea className="mt-2 h-20 w-full rounded-2xl border border-black/10 px-4 py-3" name="prompt" placeholder="원하는 결과를 한 문장으로 적어 주세요" required />
      </div>
      <div>
        <label className="text-sm font-medium text-black/80">분위기</label>
        <select className="mt-2 w-full rounded-2xl border border-black/10 px-4 py-3" name="tone">
          {toneOptions.map((tone) => (
            <option key={tone}>{tone}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium text-black/80">영상 길이</label>
        <input
          className="mt-2 w-full rounded-2xl border border-black/10 px-4 py-3"
          defaultValue={15}
          max={40}
          min={1}
          name="video_duration_seconds"
          required
          type="number"
        />
        <p className="mt-2 text-xs text-black/45">1초부터 40초 사이로 고를 수 있습니다.</p>
      </div>
      <div>
        <label className="text-sm font-medium text-black/80">상품 사진</label>
        <input className="mt-2 block w-full text-sm" multiple type="file" />
        <p className="mt-2 text-xs text-black/45">현재 프런트는 업로드 UI만 제공하며, 실제 파일 전송은 다음 단계에서 연결합니다.</p>
      </div>
      <button className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white disabled:opacity-50" disabled={isSubmitting} type="submit">
        {isSubmitting ? '생성 요청 보내는 중...' : '결과물 만들기'}
      </button>
      {message ? <p className="text-sm text-black/65">{message}</p> : null}
    </form>
  );
}
