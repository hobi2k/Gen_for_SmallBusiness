'use client';

import {ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState} from 'react';

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
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: string[];
  result?: ChatResponse | null;
  isLoading?: boolean;
  progress?: number;
};

const examplePrompts = [
  '수제 딸기잼 배너 이미지 만들어줘',
  '생활용품 홍보용 6초 광고 영상 만들어줘',
  '카페 홍보에 어울리는 밝은 배경 음악 만들어줘',
];

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draft, setDraft] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadingMessageId = useRef<string | null>(null);

  useEffect(() => {
    if (!isSubmitting) {
      setProgress(0);
      return;
    }

    setProgress(6);
    const timer = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 92) {
          return current;
        }
        const step = current < 36 ? 8 : current < 70 ? 5 : 3;
        return Math.min(92, current + step);
      });
    }, 700);

    return () => {
      window.clearInterval(timer);
    };
  }, [isSubmitting]);

  useEffect(() => {
    const currentId = loadingMessageId.current;
    if (!currentId) {
      return;
    }

    setMessages((current) =>
      current.map((message) =>
        message.id === currentId
          ? {
              ...message,
              progress,
              content: `만드는 중... ${progress}%`,
            }
          : message,
      ),
    );
  }, [progress]);

  const attachmentNames = useMemo(
    () => attachedFiles.map((file) => file.name),
    [attachedFiles],
  );

  function handleExampleClick(prompt: string) {
    setDraft(prompt);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setAttachedFiles(files);
  }

  function removeAttachedFile(fileName: string) {
    const nextFiles = attachedFiles.filter((file) => file.name !== fileName);
    setAttachedFiles(nextFiles);
    if (fileInputRef.current) {
      const dataTransfer = new DataTransfer();
      nextFiles.forEach((file) => dataTransfer.items.add(file));
      fileInputRef.current.files = dataTransfer.files;
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();

    if (!message || isSubmitting) {
      return;
    }

    const userMessageId = `user-${Date.now()}`;
    const loadingId = `loading-${Date.now() + 1}`;
    const snapshotAttachments = [...attachedFiles];

    setIsSubmitting(true);
    setMessages((current) => [
      ...current,
      {
        id: userMessageId,
        role: 'user',
        content: message,
        attachments: snapshotAttachments.map((file) => file.name),
      },
      {
        id: loadingId,
        role: 'assistant',
        content: '만드는 중... 0%',
        isLoading: true,
        progress: 0,
      },
    ]);
    loadingMessageId.current = loadingId;

    setDraft('');
    setAttachedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    const formData = new FormData();
    formData.set('message', message);
    formData.set('tone', '깔끔한 판매형');
    formData.set('video_duration_seconds', '6');
    formData.set('include_music', 'true');
    formData.set('music_language', 'ko');
    formData.set('music_lyrics', '');
    formData.set('music_vocal_mode', 'instrumental');
    snapshotAttachments.forEach((file) => {
      formData.append('images', file);
    });

    try {
      const response = await fetch('/api/chat/generate', {
        method: 'POST',
        body: formData,
      });
      const data = (await response.json()) as ChatResponse | {detail?: string};

      if (!response.ok) {
        throw new Error(
          'detail' in data ? data.detail ?? '채팅 생성에 실패했습니다.' : '채팅 생성에 실패했습니다.',
        );
      }

      setMessages((current) =>
        current.map((messageItem) =>
          messageItem.id === loadingId
            ? {
                id: loadingId,
                role: 'assistant',
                content: (data as ChatResponse).assistant_message,
                result: data as ChatResponse,
              }
            : messageItem,
        ),
      );
      setProgress(100);
    } catch (error) {
      setMessages((current) =>
        current.map((messageItem) =>
          messageItem.id === loadingId
            ? {
                id: loadingId,
                role: 'assistant',
                content: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
              }
            : messageItem,
        ),
      );
    } finally {
      loadingMessageId.current = null;
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
              onClick={() => handleExampleClick(prompt)}
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

            {messages.map((message) => {
              const isUser = message.role === 'user';
              const previewAssets = flattenPreviewAssets(message.result?.asset_paths);

              return (
                <div
                  key={message.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[88%] ${isUser ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`rounded-[28px] px-5 py-4 text-[15px] leading-8 ${
                        isUser
                          ? 'bg-[#111827] text-white shadow-[0_16px_40px_rgba(17,24,39,0.22)]'
                          : message.isLoading
                          ? 'border border-[#d8c8b5] bg-[#fbf7ef] text-black/76'
                          : 'border border-black/8 bg-[#f8f5ef] text-black/82'
                      }`}
                    >
                      {message.content}
                    </div>

                    {message.attachments?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.attachments.map((attachment) => (
                          <span
                            key={attachment}
                            className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-black/62"
                          >
                            {attachment}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {message.result && previewAssets.length ? (
                      <div className="mt-4 space-y-4">
                        <AssetPreviewGallery assets={previewAssets} />
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <form className="border-t border-black/8 pt-5" onSubmit={handleSubmit}>
            <div className="rounded-[30px] border border-black/10 bg-[#fbfaf7] p-4 shadow-[0_18px_40px_rgba(15,23,32,0.06)]">
              {attachmentNames.length ? (
                <div className="mb-3 flex flex-wrap gap-2 px-2">
                  {attachmentNames.map((name) => (
                    <button
                      key={name}
                      className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-black/70"
                      onClick={() => removeAttachedFile(name)}
                      type="button"
                    >
                      {name} ×
                    </button>
                  ))}
                </div>
              ) : null}

              <textarea
                className="h-32 w-full resize-none border-0 bg-transparent px-2 py-2 text-base leading-8"
                name="message"
                onChange={(event) => setDraft(event.target.value)}
                placeholder="수제 잼 배너 만들어줘 / 6초 광고 영상 만들어줘 / 카페 배경 음악 만들어줘"
                required
                value={draft}
              />
              <div className="mt-3 flex items-center justify-between gap-4 border-t border-black/8 pt-4">
                <div className="flex items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/72 hover:bg-black/[0.03]">
                    이미지 첨부
                    <input
                      accept="image/*"
                      className="hidden"
                      multiple
                      onChange={handleFileChange}
                      ref={fileInputRef}
                      type="file"
                    />
                  </label>
                  {isSubmitting ? (
                    <span className="text-sm font-medium text-black/48">
                      생성 중 {progress}%
                    </span>
                  ) : null}
                </div>
                <button
                  className="rounded-full bg-[#111827] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? '만드는 중...' : '보내기'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
