const STEP_LABELS = [
  ["1", "이미지 업로드"],
  ["2", "스타일 3개 추천"],
  ["3", "스타일 선택"],
  ["4", "콘텐츠 생성"],
  ["5", "패키지 확인"],
  ["6", "재생성 또는 변경"]
] as const;

export function HeroSection() {
  return (
    <section className="hero">
      <span className="eyebrow">AI 감성 판매 콘텐츠 생성 서비스</span>
      <div>
        <h1>상품 사진 한 장으로 온라인 판매용 감성 콘텐츠를 빠르게 만듭니다.</h1>
        <p>
          접시, 볼, 컵, 유리잔, 트레이, 커트러리처럼 오프라인 매장에서 판매하던 리빙 소품을
          온라인 상세페이지용 이미지와 문구 패키지로 정리합니다. 사용자는 업로드, 스타일 선택,
          생성만 하면 됩니다.
        </p>
      </div>
      <div className="flow-strip">
        {STEP_LABELS.map(([step, label]) => (
          <div className="flow-card" key={step}>
            <strong>{step}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
