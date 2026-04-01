import { DevSeedPreview } from "@/lib/types";

interface SeedPanelProps {
  devSeeds: DevSeedPreview[];
  loadingSeeds: boolean;
  activeSeedId: string | null;
  onSeedLoad: (seed: DevSeedPreview) => void;
}

export function SeedPanel({
  devSeeds,
  loadingSeeds,
  activeSeedId,
  onSeedLoad
}: SeedPanelProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="step-badge">내부 QA/데모용 시드</div>
          <h2 className="panel-title">업로드 없이도 추천 흐름을 빠르게 점검할 수 있습니다.</h2>
          <p className="panel-copy">
            최종 사용자용 입력이 아니라 개발 검증과 데모를 위한 예시 입력입니다.
          </p>
        </div>
      </div>
      <div className="seed-grid">
        {loadingSeeds ? (
          <div className="mini-card">
            <strong>시드 로딩 중</strong>
            <span>추천 결과를 포함한 테스트 데이터를 불러오고 있습니다.</span>
          </div>
        ) : (
          devSeeds.map((seed) => (
            <div
              className={`seed-card ${activeSeedId === seed.id ? "is-active" : ""}`}
              key={seed.id}
            >
              <div className="seed-thumbnail">
                <img src={seed.previewUrl} alt={seed.title} />
              </div>
              <strong>{seed.title}</strong>
              <p>{seed.description}</p>
              <div className="badge-row">
                <span className="meta-badge">{seed.analysis.categoryLabel}</span>
                <span className="meta-badge">{seed.analysis.materialNotes}</span>
              </div>
              <button
                className="secondary-button"
                onClick={() => onSeedLoad(seed)}
                type="button"
              >
                시드 불러오기
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
