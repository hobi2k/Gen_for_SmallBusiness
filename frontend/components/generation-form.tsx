'use client';

import {ChangeEvent, FormEvent, useMemo, useState} from 'react';

import {AssetResultPanel} from '@/components/asset-result-panel';

type GenerationMode = 'image' | 'video' | 'music';

type GenerationFormProps = {
  mode: GenerationMode;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000';

const toneOptions = ['깔끔한 판매형', '따뜻한 공감형', '밝은 행사형', '고급스러운 브랜드형'];
const languageOptions = [
  {value: 'ko', label: '한국어'},
  {value: 'en', label: '영어'},
  {value: 'ja', label: '일본어'},
  {value: 'zh', label: '중국어'},
];

const contentMap: Record<
  GenerationMode,
  {
    endpoint: string;
    title: string;
    description: string;
    submitLabel: string;
  }
> = {
  image: {
    endpoint: '/generate/image',
    title: '배너와 상세 이미지를 한 번에',
    description: '배너, 상세 이미지, 로고 초안까지 한 흐름으로 정리합니다.',
    submitLabel: '이미지 세트 만들기',
  },
  video: {
    endpoint: '/generate/video',
    title: '짧은 광고 영상까지 바로',
    description: '대표 비주얼, 짧은 영상, 배경 음악, 합성본까지 함께 만듭니다.',
    submitLabel: '영상 세트 만들기',
  },
  music: {
    endpoint: '/generate/music',
    title: '영상 길이에 맞춘 음악만 따로',
    description: '광고 분위기에 맞는 배경 음악만 빠르게 뽑아낼 수 있습니다.',
    submitLabel: '음악 만들기',
  },
};

export function GenerationForm({mode}: GenerationFormProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [includeMusic, setIncludeMusic] = useState(mode !== 'video');
  const [musicVocalMode, setMusicVocalMode] = useState<'instrumental' | 'vocal'>('instrumental');
  const [result, setResult] = useState<{
    message?: string;
    project_root?: string;
    asset_paths?: Record<string, string | string[] | Record<string, string | string[]>>;
  } | null>(null);

  const content = useMemo(() => contentMap[mode], [mode]);
  const supportsMusicControls = mode === 'video' || mode === 'music';
  const needsUpload = mode === 'image' || mode === 'video';

  function handleMusicToggle(event: ChangeEvent<HTMLInputElement>) {
    setIncludeMusic(event.target.checked);
  }

  function handleVocalModeChange(event: ChangeEvent<HTMLSelectElement>) {
    setMusicVocalMode(event.target.value as 'instrumental' | 'vocal');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus('생성 요청을 보내고 있습니다.');

    const formData = new FormData(event.currentTarget);
    const uploadFiles = formData.getAll('images').filter((value) => value instanceof File) as File[];
    const requestForm = new FormData();
    requestForm.set('category', String(formData.get('category') ?? ''));
    requestForm.set('product_name', String(formData.get('product_name') ?? ''));
    requestForm.set('summary', String(formData.get('summary') ?? ''));
    requestForm.set('description', String(formData.get('description') ?? ''));
    requestForm.set('keywords', String(formData.get('keywords') ?? ''));
    requestForm.set('selling_points', String(formData.get('selling_points') ?? ''));
    requestForm.set('tone', String(formData.get('tone') ?? toneOptions[0]));
    requestForm.set('video_duration_seconds', String(formData.get('video_duration_seconds') ?? 6));
    requestForm.set('include_music', String(mode === 'video' ? includeMusic : true));
    requestForm.set('music_language', String(formData.get('music_language') ?? 'ko'));
    requestForm.set(
      'music_lyrics',
      includeMusic && musicVocalMode === 'vocal' ? String(formData.get('music_lyrics') ?? '') : '',
    );
    requestForm.set(
      'music_vocal_mode',
      includeMusic ? String(formData.get('music_vocal_mode') ?? 'instrumental') : 'instrumental',
    );
    for (const file of uploadFiles) {
      if (file.size > 0) {
        requestForm.append('images', file);
      }
    }

    try {
      const response = await fetch(`${apiBaseUrl}${content.endpoint}`, {
        method: 'POST',
        body: requestForm,
      });
      const data = (await response.json()) as {
        detail?: string;
        message?: string;
        project_root?: string;
        asset_paths?: Record<string, string | string[] | Record<string, string | string[]>>;
      };

      if (!response.ok) {
        throw new Error(data.detail ?? '생성 요청 처리에 실패했습니다.');
      }

      setResult(data);
      setStatus(data.message ?? '생성이 완료됐습니다.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,32,0.08)]">
        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#101828]">{content.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-black/58">{content.description}</p>

        <form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-black/76">
              업종
              <input className="rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 font-normal" name="category" placeholder="예: 식품, 카페, 생활용품" required />
            </label>
            <label className="grid gap-2 text-sm font-medium text-black/76">
              상품명
              <input className="rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 font-normal" name="product_name" placeholder="예: 수제 딸기잼" required />
            </label>
          </div>

          <label className="grid gap-2 text-sm font-medium text-black/76">
            한 줄 소개
            <textarea className="h-24 rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 font-normal" name="summary" placeholder="한 줄로 매력이 보이게 적어 주세요." required />
          </label>

          <label className="grid gap-2 text-sm font-medium text-black/76">
            자세한 설명
            <textarea className="h-32 rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 font-normal" name="description" placeholder="광고 문구와 비주얼에 반영하고 싶은 설명을 적어 주세요." required />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-black/76">
              핵심 키워드
              <input className="rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 font-normal" name="keywords" placeholder="예: 수제, 선물, 프리미엄" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-black/76">
              판매 포인트
              <input className="rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 font-normal" name="selling_points" placeholder="예: 과육이 살아 있음, 당도 조절" />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-black/76">
              톤
              <select className="rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 font-normal" name="tone">
                {toneOptions.map((tone) => (
                  <option key={tone}>{tone}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-black/76">
              영상 길이
              <input
                className="rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 font-normal"
                defaultValue={6}
                max={10}
                min={3}
                name="video_duration_seconds"
                type="number"
              />
            </label>
          </div>

          {mode === 'video' ? (
            <label className="flex items-center gap-3 rounded-[24px] bg-[#f7f5ef] px-4 py-4 text-sm font-medium text-black/76">
              <input checked={includeMusic} className="h-4 w-4" name="include_music_toggle" onChange={handleMusicToggle} type="checkbox" />
              배경 음악까지 함께 만들기
            </label>
          ) : null}

          {supportsMusicControls && (mode === 'music' || includeMusic) ? (
            <div className="grid gap-4 rounded-[28px] bg-[#f7f5ef] p-5">
              <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#101828]">음악 설정</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-black/76">
                  보컬 방식
                  <select
                    className="rounded-2xl border border-black/10 bg-white px-4 py-3 font-normal"
                    name="music_vocal_mode"
                    onChange={handleVocalModeChange}
                    value={musicVocalMode}
                  >
                    <option value="instrumental">연주만</option>
                    <option value="vocal">가사 포함</option>
                  </select>
                </label>
                {musicVocalMode === 'vocal' ? (
                  <label className="grid gap-2 text-sm font-medium text-black/76">
                    가사 언어
                    <select className="rounded-2xl border border-black/10 bg-white px-4 py-3 font-normal" name="music_language">
                      {languageOptions.map((language) => (
                        <option key={language.value} value={language.value}>
                          {language.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>

              {musicVocalMode === 'vocal' ? (
                <label className="grid gap-2 text-sm font-medium text-black/76">
                  가사
                  <textarea
                    className="h-32 rounded-2xl border border-black/10 bg-white px-4 py-3 font-normal"
                    name="music_lyrics"
                    placeholder={'가사를 직접 넣을 수 있습니다.\n비워두면 상품 정보 기준으로 기본 가사를 만듭니다.'}
                  />
                </label>
              ) : null}
            </div>
          ) : (
            <>
              <input name="music_language" type="hidden" value="ko" readOnly />
              <input name="music_vocal_mode" type="hidden" value={includeMusic ? musicVocalMode : 'instrumental'} readOnly />
              <input name="music_lyrics" type="hidden" value="" readOnly />
            </>
          )}

          {needsUpload ? (
            <label className="grid gap-2 text-sm font-medium text-black/76">
              이미지 업로드
              <input
                className="rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-4 font-normal file:mr-3 file:rounded-full file:border-0 file:bg-[#121826] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                multiple
                name="images"
                type="file"
              />
            </label>
          ) : null}

          <button
            className="rounded-2xl bg-[#111827] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1f2937] disabled:opacity-50"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? '만드는 중입니다...' : content.submitLabel}
          </button>
        </form>
      </section>

      <AssetResultPanel
        description="생성 경로와 결과 자산이 여기에서 바로 정리됩니다."
        result={result}
        status={status}
        title="실행 결과"
      />
    </div>
  );
}
