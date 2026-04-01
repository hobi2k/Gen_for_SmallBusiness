'use client';

import {FormEvent, useState} from 'react';

import {AssetPreviewGallery} from '@/components/asset-preview-gallery';
import {AssetValue, flattenPreviewAssets} from '@/lib/assets';

type ChatAssetPaths = Record<string, AssetValue>;

type ChatResponse = {
  intent: string;
  assistant_message: string;
  project_root: string;
  asset_paths: ChatAssetPaths;
};

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  result?: ChatResponse | null;
};

const examplePrompts = [
  '수제 딸기잼 배너 이미지 만들어줘',
  '생활용품 홍보용 6초 광고 영상 만들어줘',
  '카페 홍보에 어울리는 밝은 배경 음악 만들어줘',
];

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
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
      const response = await fetch('/api/chat/generate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as ChatResponse | {detail?: string};

      if (!response.ok) {
        throw new Error('detail' in data ? data.detail ?? '채팅 생성에 실패했습니다.' : '채팅 생성에 실패했습니다.');
      }

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: (data as ChatResponse).assistant_message,
          result: data as ChatResponse,
        },
      ]);
      form.reset();
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
    <div className="rounded-[36px] border border-black/10 bg-white shadow-[0_24px_80px_rgba(15,23,32,0.08)]">
      <div className="border-b border-black/8 px-6 py-5 md:px-8">
        <div className="flex flex-wrap gap-3">
          {examplePrompts.map((prompt) => (
            <button
              key={prompt}
              className="rounded-full bg-[#f4eee6] px-4 py-2 text-sm text-black/70 transition hover:bg-[#eadfce]"
              onClick={() => {
                const textarea = document.querySelector<HTMLTextAreaElement>('textarea[name="message"]');
                if (textarea) {
                  textarea.value = prompt;
                  textarea.focus();
                }
              }}
              type="button"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-6 md:px-8">
        <div className="mx-auto flex min-h-[640px] max-w-5xl flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto pb-8">
            {!messages.length ? (
              <div className="flex min-h-[360px] items-center justify-center">
                <div className="rounded-[28px] border border-black/8 bg-[#f8f5ef] px-8 py-6 text-center text-lg font-medium tracking-[-0.03em] text-black/72">
                  바로 만들고 싶은 결과를 적어 주세요.
                </div>
              </div>
            ) : null}

            {messages.map((message, index) => {
              const isUser = message.role === 'user';
              const previewAssets = flattenPreviewAssets(message.result?.asset_paths);

              return (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[88%] ${isUser ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`rounded-[28px] px-5 py-4 text-[15px] leading-8 ${
                        isUser
                          ? 'bg-[#111827] text-white shadow-[0_16px_40px_rgba(17,24,39,0.22)]'
                          : 'border border-black/8 bg-[#f8f5ef] text-black/82'
                      }`}
                    >
                      {message.content}
                    </div>

                    {message.result ? (
                      <div className="mt-4 space-y-4">
                        {previewAssets.length ? (
                          <AssetPreviewGallery assets={previewAssets} />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <form className="border-t border-black/8 pt-5" onSubmit={handleSubmit}>
            <div className="rounded-[30px] border border-black/10 bg-[#fbfaf7] p-4 shadow-[0_18px_40px_rgba(15,23,32,0.06)]">
              <textarea
                className="h-32 w-full resize-none border-0 bg-transparent px-2 py-2 text-base leading-8"
                name="message"
                placeholder="수제 잼 배너 만들어줘 / 6초 광고 영상 만들어줘 / 카페 배경 음악 만들어줘"
                required
              />
              <div className="mt-3 flex items-center justify-end gap-4 border-t border-black/8 pt-4">
                <button
                  className="rounded-full bg-[#111827] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? '만드는 중...' : '보내기'}
                </button>
              </div>
            </div>
            <input className="hidden" defaultValue={6} max={10} min={3} name="video_duration_seconds" type="number" />
            <input className="hidden" name="tone" value="깔끔한 판매형" readOnly />
          </form>
        </div>
      </div>
    </div>
  );
}
