import {GenerationForm} from '@/components/generation-form';

export default function ImagePage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10 md:px-10 xl:px-16">
      {/* 이미지 전용 생성 페이지의 소개 영역이다. 실제 입력은 아래 GenerationForm이 맡는다. */}
      <section className="rounded-[36px] bg-gradient-to-br from-[#fff3e5] via-[#fffaf5] to-[#ffe0bd] p-8 shadow-[0_32px_120px_rgba(219,106,42,0.14)]">
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[#111827]">배너부터 상세 이미지까지 한 흐름으로</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-black/62">
          문구와 이미지를 넣으면 바로 쓸 수 있는 배너, 상세 이미지, 로고 초안을 한 번에 정리합니다.
        </p>
      </section>

      <div className="mt-8">
        {/* mode 값 하나로 공통 폼 컴포넌트를 이미지 전용 화면처럼 동작시킨다. */}
        <GenerationForm mode="image" />
      </div>
    </main>
  );
}
