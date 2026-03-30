'use client';

import {FormEvent, useState} from 'react';

const toneOptions = ['깔끔한 판매형', '따뜻한 공감형', '밝은 행사형', '고급스러운 브랜드형'];
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';

export function ProjectForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('생성 요청을 보내는 중입니다.');

    const formData = new FormData(event.currentTarget);
    const payload = {
      category: String(formData.get('category') ?? ''),
      product_name: String(formData.get('product_name') ?? ''),
      summary: String(formData.get('summary') ?? ''),
      description: String(formData.get('description') ?? ''),
      keywords: String(formData.get('keywords') ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      selling_points: String(formData.get('selling_points') ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      tone: String(formData.get('tone') ?? toneOptions[0]),
      video_duration_seconds: Number(formData.get('video_duration_seconds') ?? 6),
      image_paths: [],
    };

    try {
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
        <label className="text-sm font-medium text-black/80">업종</label>
        <input className="mt-2 w-full rounded-2xl border border-black/10 px-4 py-3" name="category" placeholder="예: 식품" required />
      </div>
      <div>
        <label className="text-sm font-medium text-black/80">상품명</label>
        <input className="mt-2 w-full rounded-2xl border border-black/10 px-4 py-3" name="product_name" placeholder="예: 수제 딸기잼" required />
      </div>
      <div>
        <label className="text-sm font-medium text-black/80">한 줄 소개</label>
        <textarea className="mt-2 h-20 w-full rounded-2xl border border-black/10 px-4 py-3" name="summary" placeholder="상품을 한 문장으로 소개해 주세요" required />
      </div>
      <div>
        <label className="text-sm font-medium text-black/80">상세 설명</label>
        <textarea className="mt-2 h-28 w-full rounded-2xl border border-black/10 px-4 py-3" name="description" placeholder="상세 페이지 상단에 담고 싶은 설명을 적어 주세요" required />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-black/80">핵심 키워드</label>
          <input className="mt-2 w-full rounded-2xl border border-black/10 px-4 py-3" name="keywords" placeholder="예: 수제, 딸기, 선물" />
        </div>
        <div>
          <label className="text-sm font-medium text-black/80">강조할 판매 포인트</label>
          <input className="mt-2 w-full rounded-2xl border border-black/10 px-4 py-3" name="selling_points" placeholder="예: 과육이 살아 있음, 당도 조절" />
        </div>
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
          defaultValue={6}
          max={10}
          min={3}
          name="video_duration_seconds"
          required
          type="number"
        />
        <p className="mt-2 text-xs text-black/45">3초부터 10초 사이로 고를 수 있습니다.</p>
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
