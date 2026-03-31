'use client';

import {FormEvent, useState} from 'react';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';

type ChatAssetPaths = Record<string, string | string[] | Record<string, string | string[]>>;

type ChatResponse = {
  intent: string;
  assistant_message: string;
  project_root: string;
  asset_paths: ChatAssetPaths;
};

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const examplePrompts = [
  '수제 딸기잼 배너 이미지 만들어줘',
  '생활용품 홍보용 6초 광고 영상 만들어줘',
  '카페 홍보에 어울리는 밝은 배경 음악 만들어줘',
];

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: '원하는 결과를 자연어로 적어 주세요. 이미지, 영상, 음악 중 맞는 생성 흐름으로 바로 보냅니다.',
    },
  ]);
  const [latestResult, setLatestResult] = useState<ChatResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const message = String(formData.get('message') ?? '').trim();

    if (!message) {
      return;
    }

    setIsSubmitting(true);
    setMessages((current) => [...current, {role: 'user', content: message}]);

    const payload = {
      message,
      category: null,
      product_name: null,
      summary: null,
      description: null,
      keywords: [],
      selling_points: [],
      tone: String(formData.get('tone') ?? '깔끔한 판매형'),
      video_duration_seconds: Number(formData.get('video_duration_seconds') ?? 6),
      image_paths: [],
    };

    try {
      const response = await fetch(`${apiBaseUrl}/chat/generate`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as ChatResponse | {detail?: string};

      if (!response.ok) {
        throw new Error('detail' in data ? data.detail ?? '채팅 생성에 실패했습니다.' : '채팅 생성에 실패했습니다.');
      }

      setLatestResult(data as ChatResponse);
      setMessages((current) => [
        ...current,
        {role: 'assistant', content: (data as ChatResponse).assistant_message},
      ]);
      event.currentTarget.reset();
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-[40px] border border-black/10 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,32,0.08)] md:p-10">
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <h2 className="text-4xl font-semibold tracking-[-0.05em] text-[#0f1720] md:text-5xl">
            원하는 결과를 바로 적고 만들기
          </h2>
          <div className="mt-6 flex flex-wrap gap-3">
            {examplePrompts.map((prompt) => (
              <div key={prompt} className="rounded-full bg-[#f3ede4] px-4 py-2 text-sm text-black/62">
                {prompt}
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-3">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                  message.role === 'user' ? 'bg-[#121826] text-white' : 'bg-[#f7f5ef] text-black/80'
                }`}
              >
                {message.content}
              </div>
            ))}
          </div>

          <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
            <textarea
              className="h-56 rounded-[28px] border border-black/10 bg-[#fcfbf8] px-5 py-5 text-base leading-8"
              name="message"
              placeholder="예: 봄 선물용 딸기잼을 따뜻한 분위기의 배너로 만들어줘"
              required
            />
            <input className="hidden" defaultValue={6} max={10} min={3} name="video_duration_seconds" type="number" />
            <input className="hidden" name="tone" value="깔끔한 판매형" readOnly />
            <button
              className="rounded-[24px] bg-[#121826] px-5 py-4 text-base font-semibold text-white disabled:opacity-50"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? '생성 중...' : '채팅으로 바로 만들기'}
            </button>
          </form>
        </div>

        <div className="rounded-[32px] bg-[#121826] p-6 text-white">
          <h3 className="text-2xl font-semibold tracking-[-0.04em]">방금 만든 결과</h3>
          {latestResult ? (
            <div className="mt-4 space-y-4 text-sm">
              <div className="rounded-2xl bg-white/8 px-4 py-4">
                <p className="font-medium text-white/72">{latestResult.intent}</p>
                <p className="mt-2 text-white">{latestResult.assistant_message}</p>
              </div>
              <div className="rounded-2xl border border-white/10 px-4 py-4">
                <p className="font-medium text-white/72">저장 위치</p>
                <p className="mt-2 break-all text-white/84">{latestResult.project_root}</p>
              </div>
              <div className="rounded-2xl border border-white/10 px-4 py-4">
                <p className="font-medium text-white/72">생성 자산</p>
                <pre className="mt-3 overflow-auto whitespace-pre-wrap break-all text-xs leading-6 text-white/72">
                  {JSON.stringify(latestResult.asset_paths, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-white/8 px-4 py-4 text-sm leading-7 text-white/74">
              요청을 보내면 생성 경로와 결과 자산이 바로 여기에 정리됩니다.
            </div>
          )}

          {!latestResult ? (
            <div className="mt-6 grid gap-3">
              {['배너 이미지', '짧은 광고 영상', '배경 음악'].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 px-4 py-4 text-sm text-white/68">
                  {item}
                </div>
              ))}
            </div>
          ) : null}

          {!latestResult ? (
            <p className="mt-6 text-sm leading-6 text-white/55">
              채팅에는 요청만 넣고, 세부 제어가 필요할 때만 전용 생성 화면으로 넘어갑니다.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
