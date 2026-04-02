import {GenerationForm} from '@/components/generation-form';

export default function MusicPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10 md:px-10 xl:px-16">
      {/* 음악 전용 생성 페이지의 소개 영역이다. */}
      <section className="rounded-[36px] bg-gradient-to-br from-[#ecfff3] via-[#f7fff9] to-[#d7ffe5] p-8 shadow-[0_32px_120px_rgba(57,142,90,0.14)]">
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[#111827]">영상 길이에 맞는 배경 음악만 따로</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-black/62">
          분위기와 길이만 정리하면 바로 얹을 수 있는 배경 음악을 만들고, 원하면 가사까지 붙일 수 있습니다.
        </p>
      </section>

      <div className="mt-8">
        {/* mode="music"일 때 업로드 없이 음악 관련 입력만 보인다. */}
        <GenerationForm mode="music" />
      </div>
    </main>
  );
}
