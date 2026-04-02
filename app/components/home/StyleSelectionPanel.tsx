import { STYLE_LIST } from "@/lib/style-presets";
import { ProductAnalysis, StyleId, StyleRecommendation } from "@/lib/types";

interface StyleSelectionPanelProps {
  analysis: ProductAnalysis;
  recommendations: StyleRecommendation[];
  allStyles: StyleRecommendation[];
  selectedStyleId: StyleId | null;
  selectedStyle: StyleRecommendation | null;
  recommendationFallbackUsed: boolean;
  generating: boolean;
  sectionId: string;
  onSelectStyle: (styleId: StyleId) => Promise<void>;
  onGenerate: () => Promise<void> | void;
}

function analysisSourceLabel(source: ProductAnalysis["analysisSource"]) {
  switch (source) {
    case "seed":
      return "시드";
    case "vision":
      return "LLM 비전";
    case "hybrid":
      return "하이브리드";
    default:
      return "규칙 기반";
  }
}

interface RecommendationCardProps {
  recommendation: StyleRecommendation;
  selected: boolean;
  onSelect: () => void;
}

function RecommendationCard({
  recommendation,
  selected,
  onSelect
}: RecommendationCardProps) {
  return (
    <button
      className={`style-card recommendation-card ${selected ? "is-selected" : ""}`}
      onClick={onSelect}
      type="button"
    >
      <div className="recommendation-thumbnail">
        <img src={recommendation.thumbnailUrl} alt={`${recommendation.name} 예시 썸네일`} />
      </div>
      {recommendation.referencePreviewUrls.length > 1 ? (
        <div className="reference-preview-row" aria-hidden="true">
          {recommendation.referencePreviewUrls.slice(0, 3).map((referenceUrl, index) => (
            <div className="reference-preview-chip" key={`${recommendation.styleId}-${index}`}>
              <img src={referenceUrl} alt="" />
            </div>
          ))}
        </div>
      ) : null}
      <div className="badge-row">
        <span className="style-chip is-active">추천 점수 {recommendation.score}</span>
      </div>
      <strong>{recommendation.name}</strong>
      <p className="style-summary">{recommendation.summary}</p>
      <p>{recommendation.reason}</p>
      <div className="highlight-list">
        {recommendation.reasonHighlights.map((highlight) => (
          <span className="meta-badge" key={highlight}>
            {highlight}
          </span>
        ))}
      </div>
      <span>조명: {recommendation.lightingDescription}</span>
      <span>장면: {recommendation.sceneSetup}</span>
      <span>컬러톤: {recommendation.colorTone}</span>
    </button>
  );
}

export function StyleSelectionPanel({
  analysis,
  recommendations,
  allStyles,
  selectedStyleId,
  selectedStyle,
  recommendationFallbackUsed,
  generating,
  sectionId,
  onSelectStyle,
  onGenerate
}: StyleSelectionPanelProps) {
  const colorHintsLabel =
    analysis.colorHints.filter((hint) => hint !== "unknown").join(" · ") || "None";
  const materialHintsLabel =
    analysis.materialHints.filter((hint) => hint !== "none").join(" · ") || "None";
  const surfaceToneLabel = analysis.surfaceTone === "none" ? "None" : analysis.surfaceTone;

  const styleOptions: Array<{
    id: StyleId;
    name: string;
    score?: number;
  }> = allStyles.length
    ? allStyles.map((style) => ({
        id: style.styleId,
        name: style.name,
        score: style.score
      }))
    : STYLE_LIST.map((style) => ({
        id: style.id,
        name: style.name
      }));

  return (
    <section className="panel" id={sectionId}>
      <div className="panel-header">
        <div>
          <div className="step-badge">Step 2-3. 추천 확인과 스타일 선택</div>
          <h2 className="panel-title">추천된 3개 스타일을 카드로 비교해 보세요.</h2>
          <p className="panel-copy">
            embedding 점수에 카테고리, 색감, 소재 단서를 더한 heuristic reranking 결과입니다.
          </p>
        </div>
      </div>

      <div className="analysis-grid analysis-grid--wide">
        <div className="mini-card">
          <strong>카테고리</strong>
          <span>{analysis.categoryLabel}</span>
        </div>
        <div className="mini-card">
          <strong>색감 단서</strong>
          <span>{colorHintsLabel}</span>
        </div>
        <div className="mini-card">
          <strong>소재 단서</strong>
          <span>{materialHintsLabel}</span>
        </div>
        <div className="mini-card">
          <strong>전체 톤</strong>
          <span>{surfaceToneLabel}</span>
        </div>
        <div className="mini-card">
          <strong>분석 소스</strong>
          <span>{analysisSourceLabel(analysis.analysisSource)}</span>
        </div>
      </div>

      <div className="divider" />

      <div className="style-grid">
        {recommendations.map((recommendation) => (
          <RecommendationCard
            key={recommendation.styleId}
            onSelect={() => {
              void onSelectStyle(recommendation.styleId);
            }}
            recommendation={recommendation}
            selected={selectedStyleId === recommendation.styleId}
          />
        ))}
      </div>

      <div className="divider" />

      <div className="panel-header">
        <div>
          <h3 className="panel-title">전체 6개 스타일</h3>
          <p className="panel-copy">
            top 3 외 스타일도 바로 선택할 수 있습니다. 점수는 재정렬 결과 기준입니다.
          </p>
        </div>
      </div>

      <div className="style-chip-row">
        {styleOptions.map((style) => (
          <button
            key={style.id}
            className={`style-chip ${selectedStyleId === style.id ? "is-active" : ""}`}
            onClick={() => {
              void onSelectStyle(style.id);
            }}
            type="button"
          >
            {style.name} {style.score ? style.score : ""}
          </button>
        ))}
      </div>

      {selectedStyle ? (
        <>
          <div className="divider" />
          <div className="copy-card">
            <div className="card-title-row">
              <strong>현재 선택</strong>
              <span className="meta-badge">
                fallback {recommendationFallbackUsed ? "사용" : "미사용"}
              </span>
            </div>
            <p className="style-summary">{selectedStyle.summary}</p>
            <div className="highlight-list">
              {selectedStyle.reasonHighlights.map((highlight) => (
                <span className="meta-badge" key={highlight}>
                  {highlight}
                </span>
              ))}
            </div>
            <span>조명: {selectedStyle.lightingDescription}</span>
            <span>장면: {selectedStyle.sceneSetup}</span>
            <span>컬러톤: {selectedStyle.colorTone}</span>
          </div>
        </>
      ) : null}

      <div className="divider" />
      <div className="action-row">
        <button
          className="primary-button"
          disabled={!selectedStyleId || generating}
          onClick={onGenerate}
          type="button"
        >
          {generating ? "콘텐츠 생성 중..." : "콘텐츠 생성"}
        </button>
      </div>
    </section>
  );
}
