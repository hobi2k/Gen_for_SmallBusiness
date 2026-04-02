'use client';

import {ChangeEvent, FormEvent, useEffect, useMemo, useState} from 'react';

import {AssetResultPanel} from '@/components/asset-result-panel';

type GenerationMode = 'image' | 'video' | 'music';

type GenerationFormProps = {
  mode: GenerationMode;
};

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
    title: '쇼츠용 세로 광고 영상을 바로',
    description: '영상만 만들고, 음악을 켜면 배경 음악과 합성본까지 이어서 만듭니다.',
    submitLabel: '영상 만들기',
  },
  music: {
    endpoint: '/generate/music',
    title: '영상 길이에 맞춘 음악만 따로',
    description: '광고 분위기에 맞는 배경 음악만 빠르게 뽑아낼 수 있습니다.',
    submitLabel: '음악 만들기',
  },
};

export function GenerationForm({mode}: GenerationFormProps) {
  // 상태 메시지는 성공/실패 안내 문구를 결과 패널 위에 띄우는 데 쓴다.
  const [status, setStatus] = useState<string | null>(null);
  // 제출 중에는 버튼 비활성화와 문구 변경에 사용한다.
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 영상 생성에서만 의미가 있고, 음악 생성 단계를 포함할지 결정한다.
  const [includeMusic, setIncludeMusic] = useState(true);
  // 보컬 여부에 따라 가사 입력란과 언어 선택을 열거나 닫는다.
  const [musicVocalMode, setMusicVocalMode] = useState<'instrumental' | 'vocal'>('instrumental');
  // 전용 생성 화면도 단계 진행을 보이기 위해 체감용 진행률을 관리한다.
  const [progress, setProgress] = useState(0);
  // 생성 응답 전체를 저장해 두고 결과 패널에서 그대로 표시한다.
  const [result, setResult] = useState<{
    message?: string;
    project_root?: string;
    asset_paths?: Record<string, string | string[] | Record<string, string | string[]>>;
  } | null>(null);

  const content = useMemo(() => contentMap[mode], [mode]);
  const promptLabel = mode === 'video' ? '영상 프롬프트' : mode === 'image' ? '이미지 프롬프트' : '음악 프롬프트';
  const promptPlaceholder =
    mode === 'video'
      ? '예: 미래적인 로고가 회전하며 등장하고, 금속 질감과 강한 빛이 보이게'
      : mode === 'image'
        ? '예: 수제 딸기잼이 선물용으로 고급스럽게 보이는 광고 배너'
        : '예: 밝고 경쾌한 홍보 음악, 맑고 산뜻한 느낌';
  const durationLabel = mode === 'music' ? '음악 길이' : '영상 길이';
  const supportsMusicControls = mode === 'video' || mode === 'music';
  const needsUpload = mode === 'image' || mode === 'video';

  useEffect(() => {
    if (!isSubmitting) {
      setProgress(0);
      return;
    }

    setProgress(4);
    const timer = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 94) {
          return current;
        }
        const step = current < 30 ? 7 : current < 65 ? 5 : 3;
        return Math.min(94, current + step);
      });
    }, 900);

    return () => {
      window.clearInterval(timer);
    };
  }, [isSubmitting]);

  const runningStatus = useMemo(() => {
    if (!isSubmitting) {
      return null;
    }

    if (mode === 'image') {
      if (progress < 30) return '이미지 요청을 정리하고 있습니다.';
      if (progress < 70) return '배너와 상세 이미지를 생성하고 있습니다.';
      return '결과 이미지를 정리하고 있습니다.';
    }

    if (mode === 'music') {
      if (progress < 30) return '음악 요청을 정리하고 있습니다.';
      if (progress < 78) return '배경 음악을 생성하고 있습니다.';
      return '길이와 마무리를 다듬고 있습니다.';
    }

    if (progress < 25) return '영상 요청을 정리하고 있습니다.';
    if (progress < 58) return '광고 영상을 생성하고 있습니다.';
    if (includeMusic && progress < 82) return '배경 음악을 생성하고 있습니다.';
    if (includeMusic) return '영상과 음악을 합치고 있습니다.';
    return '영상 결과를 정리하고 있습니다.';
  }, [includeMusic, isSubmitting, mode, progress]);

  function handleMusicToggle(event: ChangeEvent<HTMLInputElement>) {
    setIncludeMusic(event.target.checked);
  }

  function handleVocalModeChange(event: ChangeEvent<HTMLSelectElement>) {
    setMusicVocalMode(event.target.value as 'instrumental' | 'vocal');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setResult(null);
    setStatus('생성 요청을 보내고 있습니다.');

    // 화면 폼 값은 먼저 FormData로 읽고, 실제 API 요청용 FormData를 다시 구성한다.
    const formData = new FormData(event.currentTarget);
    const uploadFiles = formData.getAll('images').filter((value) => value instanceof File) as File[];
    const requestForm = new FormData();
    const productName = String(formData.get('product_name') ?? '').trim();
    const prompt = String(formData.get('prompt') ?? '').trim();
    requestForm.set('product_name', productName);
    requestForm.set('prompt', prompt);
    requestForm.set('tone', String(formData.get('tone') ?? toneOptions[0]));
    requestForm.set('banner_width', String(formData.get('banner_width') ?? 1280));
    requestForm.set('banner_height', String(formData.get('banner_height') ?? 720));
    const videoWidth = String(formData.get('video_width') ?? 832);
    const videoHeight = String(formData.get('video_height') ?? 480);
    requestForm.set(
      'detail_width',
      mode === 'video' ? videoWidth : String(formData.get('detail_width') ?? 720),
    );
    requestForm.set(
      'detail_height',
      mode === 'video' ? videoHeight : String(formData.get('detail_height') ?? 1280),
    );
    requestForm.set('video_width', videoWidth);
    requestForm.set('video_height', videoHeight);
    requestForm.set('video_fps', String(formData.get('video_fps') ?? 24));
    requestForm.set('video_inference_steps', String(formData.get('video_inference_steps') ?? 12));
    requestForm.set('video_duration_seconds', String(formData.get('video_duration_seconds') ?? 15));
    // 영상 생성이 아닐 때는 include_music를 항상 true로 보내고, 영상에서만 체크박스 값이 반영된다.
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
      // 모드별 endpoint는 contentMap에서 가져오고, 실제 호출은 Next.js 프록시를 통해 이뤄진다.
      const response = await fetch(`/api${content.endpoint}`, {
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
      setProgress(100);
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
          <fieldset className="contents" disabled={isSubmitting}>
          {/* 기본은 꼭 필요한 입력만 받고, 나머지는 선택 입력으로 접어 둔다. */}
          <label className="grid gap-2 text-sm font-medium text-black/76">
            상품명
            <input
              className="rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 font-normal"
              name="product_name"
              placeholder="예: 수제 딸기잼, 게임 로고, 카페 신메뉴"
              required
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-black/76">
            {promptLabel}
            <textarea
              className="h-24 rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 font-normal"
              name="prompt"
              placeholder={promptPlaceholder}
              required
            />
          </label>

          <div className={`grid gap-4 ${mode === 'image' ? '' : 'md:grid-cols-2'}`}>
            <label className="grid gap-2 text-sm font-medium text-black/76">
              톤
              <select className="rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 font-normal" name="tone">
                {toneOptions.map((tone) => (
                  <option key={tone}>{tone}</option>
                ))}
              </select>
            </label>
            {mode !== 'image' ? (
              <label className="grid gap-2 text-sm font-medium text-black/76">
                {durationLabel}
                <input
                  className="rounded-2xl border border-black/10 bg-[#fcfbf8] px-4 py-3 font-normal"
                  defaultValue={15}
                  max={40}
                  min={1}
                  name="video_duration_seconds"
                  type="number"
                />
              </label>
            ) : null}
          </div>

          {mode === 'image' ? (
            <div className="grid gap-4 rounded-[28px] bg-[#f7f5ef] p-5">
              {/* 이미지 생성은 가로 배너와 세로 상세 이미지를 따로 만들기 때문에 둘 다 입력을 받는다. */}
              <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#101828]">이미지 크기</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-black/76">
                  배너 너비
                  <input
                    className="rounded-2xl border border-black/10 bg-white px-4 py-3 font-normal"
                    defaultValue={1280}
                    max={2048}
                    min={256}
                    name="banner_width"
                    type="number"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-black/76">
                  배너 높이
                  <input
                    className="rounded-2xl border border-black/10 bg-white px-4 py-3 font-normal"
                    defaultValue={720}
                    max={2048}
                    min={256}
                    name="banner_height"
                    type="number"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-black/76">
                  상세 너비
                  <input
                    className="rounded-2xl border border-black/10 bg-white px-4 py-3 font-normal"
                    defaultValue={720}
                    max={2048}
                    min={256}
                    name="detail_width"
                    type="number"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-black/76">
                  상세 높이
                  <input
                    className="rounded-2xl border border-black/10 bg-white px-4 py-3 font-normal"
                    defaultValue={1280}
                    max={2048}
                    min={256}
                    name="detail_height"
                    type="number"
                  />
                </label>
              </div>
            </div>
          ) : null}

          {mode === 'video' ? (
            <div className="grid gap-4 rounded-[28px] bg-[#f7f5ef] p-5">
              {/* 영상 화면에서는 최종 해상도만 받고, 세로 대표 이미지는 같은 값을 자동으로 따라간다. */}
              <h2 className="text-lg font-semibold tracking-[-0.03em] text-[#101828]">영상 해상도</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-black/76">
                  영상 너비
                  <input
                    className="rounded-2xl border border-black/10 bg-white px-4 py-3 font-normal"
                    defaultValue={832}
                    max={2048}
                    min={256}
                    name="video_width"
                    type="number"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-black/76">
                  영상 높이
                  <input
                    className="rounded-2xl border border-black/10 bg-white px-4 py-3 font-normal"
                    defaultValue={480}
                    max={2048}
                    min={256}
                    name="video_height"
                    type="number"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-black/76">
                  프레임
                  <input
                    className="rounded-2xl border border-black/10 bg-white px-4 py-3 font-normal"
                    defaultValue={24}
                    max={30}
                    min={12}
                    name="video_fps"
                    type="number"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-black/76">
                  생성 스텝
                  <input
                    className="rounded-2xl border border-black/10 bg-white px-4 py-3 font-normal"
                    defaultValue={12}
                    max={24}
                    min={8}
                    name="video_inference_steps"
                    type="number"
                  />
                </label>
              </div>
              <p className="text-sm leading-6 text-black/56">
                세로 대표 이미지는 입력한 영상 해상도를 그대로 따라갑니다.
              </p>
            </div>
          ) : null}

          {mode === 'music' ? (
            <>
              <input name="banner_width" type="hidden" value="1280" readOnly />
              <input name="banner_height" type="hidden" value="720" readOnly />
              <input name="detail_width" type="hidden" value="720" readOnly />
              <input name="detail_height" type="hidden" value="1280" readOnly />
              <input name="video_width" type="hidden" value="832" readOnly />
              <input name="video_height" type="hidden" value="480" readOnly />
              <input name="video_fps" type="hidden" value="24" readOnly />
              <input name="video_inference_steps" type="hidden" value="12" readOnly />
            </>
          ) : null}

          {mode === 'video' ? (
            <label className="flex items-center gap-3 rounded-[24px] bg-[#f7f5ef] px-4 py-4 text-sm font-medium text-black/76">
              <input checked={includeMusic} className="h-4 w-4" name="include_music_toggle" onChange={handleMusicToggle} type="checkbox" />
              배경 음악까지 함께 만들기
            </label>
          ) : null}

          {supportsMusicControls && (mode === 'music' || includeMusic) ? (
            <div className="grid gap-4 rounded-[28px] bg-[#f7f5ef] p-5">
              {/* 음악 전용 화면이거나, 영상에서 음악을 켠 경우에만 이 블록이 열린다. */}
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
                    {/* 언어 선택은 보컬이 있을 때만 의미가 있으므로 vocal일 때만 노출한다. */}
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
                <div className="grid gap-2">
                  <label className="grid gap-2 text-sm font-medium text-black/76">
                    가사
                    <textarea
                      className="h-36 rounded-2xl border border-black/10 bg-white px-4 py-3 font-normal"
                      name="music_lyrics"
                      placeholder={
                        '예:\n[Verse]\n햄스터 최강의 햄스터\n반짝반짝 빛나는 햄스터 스튜디오\n\n[Hook]\n햄 햄 햄 스튜디오\n짧고 또렷하게 반복'
                      }
                    />
                  </label>
                  <p className="text-xs leading-5 text-black/52">
                    직접 쓸 때는 한 줄을 짧게 쓰고, 어려운 단어보다 또렷하게 읽히는 쉬운 음절을 반복하는 편이 낫습니다. <code>[Verse]</code>, <code>[Hook]</code>처럼 구간을 나눠 적어 주세요.
                  </p>
                </div>
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
              {/* 이미지/영상 모드는 참고 이미지를 같이 보내서 img2img나 키 비주얼 선택에 활용한다. */}
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
            className="rounded-2xl bg-[#111827] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? '만드는 중입니다...' : content.submitLabel}
          </button>
          </fieldset>
        </form>
      </section>

      <AssetResultPanel
        progress={progress}
        result={result}
        status={runningStatus ?? status}
        title="실행 결과"
      />
    </div>
  );
}
