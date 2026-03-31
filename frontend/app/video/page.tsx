import {GenerationForm} from '@/components/generation-form';

export default function VideoPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10 md:px-10 xl:px-16">
      <section className="rounded-[36px] bg-gradient-to-br from-[#111827] via-[#1d2736] to-[#402a1f] p-8 text-white shadow-[0_32px_120px_rgba(17,24,39,0.28)]">
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em]">짧고 선명한 광고 영상을 바로</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-white/72">
          이미지를 올리고 길이를 정하면 짧은 광고 영상을 만들고, 필요하면 음악까지 함께 붙일 수 있습니다.
        </p>
      </section>

      <div className="mt-8">
        <GenerationForm mode="video" />
      </div>
    </main>
  );
}
