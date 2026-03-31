import {ChatPanel} from '@/components/chat-panel';
import {ModeCard} from '@/components/mode-card';

export default function HomePage() {
  return (
    <main className="px-6 py-10 md:px-10 xl:px-16">
      <section className="mx-auto max-w-7xl rounded-[40px] bg-[radial-gradient(circle_at_top_left,_rgba(255,179,107,0.22),_transparent_26%),linear-gradient(135deg,_#101826_0%,_#172334_58%,_#261a12_100%)] p-8 text-white shadow-[0_40px_140px_rgba(8,15,26,0.38)] md:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
          <div>
            <h1 className="max-w-5xl text-4xl font-semibold leading-[0.96] tracking-[-0.08em] text-white md:text-[5.2rem]">
              배너, 광고 영상, 음악을 바로 만드는 생성 툴
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-white/76">
              메인 채팅에 원하는 결과만 적으면 바로 만들고, 더 세밀하게 조정할 때만 전용 생성 화면으로 들어갑니다.
            </p>
          </div>

          <div className="grid gap-3">
            <ModeCard href="/image" title="이미지 생성" description="배너, 상세 이미지, 로고 초안" />
            <ModeCard href="/video" title="영상 생성" description="짧은 광고 영상과 선택형 음악" />
            <ModeCard href="/music" title="음악 생성" description="배경 음악만 따로 빠르게 생성" />
          </div>
        </div>
      </section>

      <section className="mx-auto mt-8 max-w-7xl">
        <div className="rounded-[40px] bg-white/82 p-3 shadow-[0_24px_80px_rgba(15,23,32,0.08)] backdrop-blur">
          <ChatPanel />
        </div>
      </section>
    </main>
  );
}
