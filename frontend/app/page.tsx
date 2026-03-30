import {ProjectForm} from '@/components/project-form';
import {SectionCard} from '@/components/section-card';
import {archiveItems, generationSteps} from '@/lib/mock-data';

const featureCards = [
  {
    title: '문구부터 배너까지 한 번에',
    description: '상품 설명과 사진을 넣으면 광고 문구, 배너 이미지, 상세 페이지 대표 이미지를 한 번에 만듭니다.',
  },
  {
    title: '이미지가 없어도 시작 가능',
    description: '상품 사진이 없으면 텍스트만으로 먼저 초안을 만들고, 사진을 넣으면 결과물을 더 정확하게 다듬습니다.',
  },
  {
    title: '짧은 광고 영상까지 연결',
    description: '비주얼 중심 영상과 대본 중심 영상을 모두 준비할 수 있게 영상 생성 흐름을 분리합니다.',
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen px-6 py-10 md:px-10 xl:px-16">
      <section className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[40px] bg-[#1f130d] p-10 text-white shadow-2xl">
          <p className="text-sm uppercase tracking-[0.3em] text-white/60">장사한컷</p>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
            소상공인을 위한 광고 콘텐츠 제작 플랫폼
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/78">
            문구, 배너, 상세 페이지 대표 이미지, 로고 초안, 짧은 광고 영상까지 한 흐름으로 만드는 생성 서비스입니다.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {featureCards.map((card) => (
              <SectionCard key={card.title} title={card.title} description={card.description} />
            ))}
          </div>
        </div>
        <ProjectForm />
      </section>

      <section className="mx-auto mt-10 grid max-w-7xl gap-6 lg:grid-cols-2">
        <div className="rounded-[32px] border border-black/10 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold">생성 진행 화면</h2>
          <div className="mt-6 space-y-3">
            {generationSteps.map((step, index) => (
              <div key={step} className="flex items-center justify-between rounded-2xl bg-mist px-4 py-3">
                <span className="font-medium">{step}</span>
                <span className="text-sm text-black/50">{index < 3 ? '완료' : index === 3 ? '진행 중' : '대기'}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[32px] border border-black/10 bg-white p-8 shadow-sm">
          <h2 className="text-2xl font-semibold">최근 생성 프로젝트</h2>
          <div className="mt-6 space-y-3">
            {archiveItems.map((item) => (
              <div key={item.title} className="rounded-2xl border border-black/10 px-4 py-4">
                <p className="font-medium">{item.title}</p>
                <p className="mt-2 text-sm text-black/55">상태: {item.status}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
