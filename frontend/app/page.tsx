import {ChatPanel} from '@/components/chat-panel';
import {ModeCard} from '@/components/mode-card';

export default function HomePage() {
  return (
    <main className="px-6 py-10 md:px-10 xl:px-16">
      {/* 첫 화면은 제품 소개와 전용 생성 화면 진입점을 같이 보여준다. */}
      <section className="mx-auto max-w-7xl rounded-[40px] bg-[radial-gradient(circle_at_top_left,_rgba(255,179,107,0.18),_transparent_22%),linear-gradient(135deg,_#111827_0%,_#182638_56%,_#2a1d15_100%)] p-8 text-white shadow-[0_40px_140px_rgba(8,15,26,0.32)] md:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <h1 className="max-w-4xl text-[2.9rem] font-semibold leading-[0.95] tracking-[-0.08em] text-white md:text-[4.6rem]">
              배너, 광고 영상, 배경 음악을 채팅에서 바로 만듭니다
            </h1>
            <p className="mt-5 max-w-2xl text-[1.02rem] leading-8 text-white/72">
              더 자세히 다듬고 싶을 때만 전용 화면으로 들어갑니다.
            </p>
          </div>

          {/* 채팅이 아닌 전용 생성 화면으로 바로 들어가고 싶을 때 쓰는 링크 카드다. */}
          <div className="grid gap-3">
            <ModeCard href="/image" title="이미지 생성" description="배너, 상세 이미지, 로고 초안" />
            <ModeCard href="/video" title="영상 생성" description="짧은 광고 영상과 선택형 음악" />
            <ModeCard href="/music" title="음악 생성" description="배경 음악만 따로 빠르게 생성" />
          </div>
        </div>
      </section>

      <section className="mx-auto mt-8 max-w-7xl">
        <div className="rounded-[40px] bg-white/88 p-3 shadow-[0_24px_80px_rgba(15,23,32,0.08)] backdrop-blur">
          {/* 실제 대화, 업로드, 결과 미리보기는 이 컴포넌트 안에서 처리한다. */}
          <ChatPanel />
        </div>
      </section>
    </main>
  );
}
