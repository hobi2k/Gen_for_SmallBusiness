"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";

import { STYLE_LIST } from "@/lib/style-presets";
import {
  DevSeedPreview,
  GeneratedImage,
  GeneratedPackage,
  ProductAnalysis,
  StyleId,
  StyleRecommendation
} from "@/lib/types";

const STEP_LABELS = [
  ["1", "이미지 업로드"],
  ["2", "스타일 3개 추천"],
  ["3", "스타일 선택"],
  ["4", "콘텐츠 생성"],
  ["5", "패키지 확인"],
  ["6", "재생성 또는 변경"]
] as const;

function releasePreviewUrl(url: string | null) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

function CopyButton({
  copied,
  onClick
}: {
  copied: boolean;
  onClick: () => Promise<void> | void;
}) {
  return (
    <button
      className={`copy-button ${copied ? "is-copied" : ""}`}
      onClick={onClick}
      type="button"
    >
      {copied ? "복사됨" : "복사"}
    </button>
  );
}

function TextOutputCard({
  title,
  text,
  onCopy,
  copied
}: {
  title: string;
  text: string;
  onCopy: () => Promise<void> | void;
  copied: boolean;
}) {
  return (
    <div className="copy-card result-card">
      <div className="card-title-row">
        <strong>{title}</strong>
        <CopyButton copied={copied} onClick={onCopy} />
      </div>
      <p className="result-text">{text}</p>
    </div>
  );
}

function ImageResultCard({
  title,
  images
}: {
  title: string;
  images: GeneratedImage[];
}) {
  return (
    <div className="copy-card result-card image-result-card">
      <div className="card-title-row">
        <strong>{title}</strong>
      </div>
      <div className="image-grid">
        {images.map((image) => (
          <div className="image-card" key={image.id}>
            <div className="image-frame">
              <img src={image.url} alt={`${title} ${image.aspectRatio}`} />
            </div>
            <p className="image-caption">비율 {image.aspectRatio}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecommendationCard({
  recommendation,
  selected,
  onSelect
}: {
  recommendation: StyleRecommendation;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={`style-card recommendation-card ${selected ? "is-selected" : ""}`}
      onClick={onSelect}
      type="button"
    >
      <div className="recommendation-thumbnail">
        <img src={recommendation.thumbnailUrl} alt={`${recommendation.name} 예시 썸네일`} />
      </div>
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

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [recommendations, setRecommendations] = useState<StyleRecommendation[]>([]);
  const [allStyles, setAllStyles] = useState<StyleRecommendation[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState<StyleId | null>(null);
  const [generatedPackage, setGeneratedPackage] = useState<GeneratedPackage | null>(null);
  const [devSeeds, setDevSeeds] = useState<DevSeedPreview[]>([]);
  const [activeSeedId, setActiveSeedId] = useState<string | null>(null);
  const [recommending, setRecommending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loadingSeeds, setLoadingSeeds] = useState(false);
  const [recommendationFallbackUsed, setRecommendationFallbackUsed] = useState(false);
  const [regenerateCount, setRegenerateCount] = useState(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      releasePreviewUrl(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    async function loadSeeds() {
      setLoadingSeeds(true);
      try {
        const response = await fetch("/api/dev-seeds");
        const payload = (await response.json()) as { seeds?: DevSeedPreview[] };
        setDevSeeds(payload.seeds ?? []);
      } finally {
        setLoadingSeeds(false);
      }
    }

    void loadSeeds();
  }, []);

  const selectedStyle = useMemo(() => {
    if (!selectedStyleId) {
      return null;
    }

    return allStyles.find((style) => style.styleId === selectedStyleId) ?? null;
  }, [allStyles, selectedStyleId]);

  async function copyText(copyTarget: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(copyTarget);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === copyTarget ? null : current));
      }, 1400);
    } catch {
      setError("복사에 실패했습니다. 브라우저 권한을 확인해 주세요.");
    }
  }

  function applyRecommendationPayload({
    analysis: nextAnalysis,
    recommendations: nextRecommendations,
    allStyles: nextAllStyles,
    fallbackUsed,
    preview
  }: {
    analysis: ProductAnalysis;
    recommendations: StyleRecommendation[];
    allStyles: StyleRecommendation[];
    fallbackUsed: boolean;
    preview: string;
  }) {
    setAnalysis(nextAnalysis);
    setRecommendations(nextRecommendations);
    setAllStyles(nextAllStyles);
    setSelectedStyleId(nextRecommendations[0]?.styleId ?? null);
    setRecommendationFallbackUsed(fallbackUsed);
    setGeneratedPackage(null);
    setRegenerateCount(0);
    setPreviewUrl(preview);
  }

  async function requestRecommendations(nextFile: File, nextPreviewUrl: string) {
    setRecommending(true);
    setError(null);
    setGeneratedPackage(null);

    try {
      const formData = new FormData();
      formData.append("file", nextFile);

      const response = await fetch("/api/recommend-styles", {
        method: "POST",
        body: formData
      });

      const payload = (await response.json()) as {
        error?: string;
        analysis?: ProductAnalysis;
        recommendations?: StyleRecommendation[];
        allStyles?: StyleRecommendation[];
        fallbackUsed?: boolean;
      };

      if (
        !response.ok ||
        !payload.analysis ||
        !payload.recommendations ||
        !payload.allStyles ||
        typeof payload.fallbackUsed !== "boolean"
      ) {
        throw new Error(payload.error ?? "스타일 추천에 실패했습니다.");
      }

      applyRecommendationPayload({
        analysis: payload.analysis,
        recommendations: payload.recommendations,
        allStyles: payload.allStyles,
        fallbackUsed: payload.fallbackUsed,
        preview: nextPreviewUrl
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "스타일 추천 중 오류가 발생했습니다."
      );
    } finally {
      setRecommending(false);
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0];

    if (!nextFile) {
      return;
    }

    releasePreviewUrl(previewUrl);

    const nextPreviewUrl = URL.createObjectURL(nextFile);
    setFile(nextFile);
    setActiveSeedId(null);
    setPreviewUrl(nextPreviewUrl);
    setAnalysis(null);
    setRecommendations([]);
    setAllStyles([]);
    setSelectedStyleId(null);
    setGeneratedPackage(null);
    setRegenerateCount(0);

    await requestRecommendations(nextFile, nextPreviewUrl);
  }

  function handleSeedLoad(seed: DevSeedPreview) {
    releasePreviewUrl(previewUrl);
    setFile(null);
    setActiveSeedId(seed.id);
    applyRecommendationPayload({
      analysis: seed.analysis,
      recommendations: seed.recommendations,
      allStyles: seed.recommendations
        .concat(
          STYLE_LIST.filter(
            (style) => !seed.recommendations.some((item) => item.styleId === style.id)
          ).map((style) => ({
            styleId: style.id,
            name: style.name,
            summary: style.summary,
            score: 0,
            reason: "테스트 시드에서 top 3 외 스타일은 축약 표시입니다.",
            reasonHighlights: [style.summary],
            lightingDescription: style.lightingDescription,
            sceneSetup: style.sceneSetup,
            colorTone: style.colorTone,
            promptTemplate: style.promptTemplate,
            promptKeywords: style.promptKeywords,
            thumbnailUrl: seed.previewUrl,
            scoreBreakdown: {
              embeddingScore: 0,
              baseHeuristic: 0,
              rerankedScore: 0,
              rerankAdjustments: [],
              fallbackUsed: seed.fallbackUsed
            }
          }))
        )
        .sort((left, right) => right.score - left.score),
      fallbackUsed: seed.fallbackUsed,
      preview: seed.previewUrl
    });
    setError(null);
  }

  async function handleSelectStyle(styleId: StyleId) {
    setSelectedStyleId(styleId);

    if (!analysis) {
      return;
    }

    await fetch("/api/style-selection", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        uploadToken: analysis.uploadToken,
        styleId,
        analysis,
        recommendedStyles: recommendations,
        fallbackUsed: recommendationFallbackUsed
      })
    });
  }

  async function handleGenerate(nextRegenerateCount = 0) {
    if (!analysis || !selectedStyleId) {
      setError("이미지를 올리고 스타일을 선택한 뒤 생성해 주세요.");
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          uploadToken: analysis.uploadToken,
          styleId: selectedStyleId,
          regenerateCount: nextRegenerateCount,
          analysis,
          recommendedStyles: recommendations,
          recommendationFallbackUsed
        })
      });

      const payload = (await response.json()) as GeneratedPackage & { error?: string };

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "콘텐츠 생성에 실패했습니다.");
      }

      setGeneratedPackage(payload);
      setRegenerateCount(nextRegenerateCount);
      document.getElementById("result-section")?.scrollIntoView({ behavior: "smooth" });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "콘텐츠 생성 중 오류가 발생했습니다."
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <span className="eyebrow">AI 감성 판매 콘텐츠 생성 서비스</span>
        <div>
          <h1>상품 사진 한 장으로 온라인 판매용 감성 콘텐츠를 빠르게 만듭니다.</h1>
          <p>
            접시, 볼, 컵, 유리잔, 트레이, 커트러리처럼 오프라인 매장에서 판매하던 리빙
            소품을 온라인 상세페이지용 이미지와 문구 패키지로 정리합니다. 사용자는 업로드,
            스타일 선택, 생성만 하면 됩니다.
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

      <div className="workspace">
        <section className="panel">
          <div className="panel-header">
            <div>
              <div className="step-badge">빠른 검증용 시드</div>
              <h2 className="panel-title">업로드 없이도 추천 흐름을 검증할 수 있습니다.</h2>
              <p className="panel-copy">
                그릇, 접시, 컵, 유리잔, 트레이, 커트러리 예시 입력을 미리 준비했습니다.
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
                <div className={`seed-card ${activeSeedId === seed.id ? "is-active" : ""}`} key={seed.id}>
                  <div className="seed-thumbnail">
                    <img src={seed.previewUrl} alt={seed.title} />
                  </div>
                  <strong>{seed.title}</strong>
                  <p>{seed.description}</p>
                  <div className="badge-row">
                    <span className="meta-badge">{seed.analysis.categoryLabel}</span>
                    <span className="meta-badge">{seed.analysis.materialNotes}</span>
                  </div>
                  <button className="secondary-button" onClick={() => handleSeedLoad(seed)} type="button">
                    시드 불러오기
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <div className="step-badge">Step 1. 상품 이미지 업로드</div>
              <h2 className="panel-title">가장 먼저 상품 사진을 올려 주세요.</h2>
              <p className="panel-copy">
                업로드 직후 시스템이 상품 인상, 색감, 소재 단서를 읽고 가장 잘 맞는 스타일
                3개를 추천합니다.
              </p>
            </div>
          </div>

          <div className="upload-grid">
            <label className="upload-dropzone">
              <div>
                <strong>파일 선택</strong>
                <p className="help-text">JPG, PNG, WEBP 한 장이면 충분합니다.</p>
                <input type="file" accept="image/*" onChange={handleUpload} />
              </div>
            </label>

            <div className="preview-frame">
              {previewUrl ? (
                <img src={previewUrl} alt="상품 미리보기" />
              ) : (
                <div className="upload-dropzone">
                  <div>
                    <strong>미리보기 영역</strong>
                    <p className="help-text">업로드한 상품 사진 또는 테스트 시드가 표시됩니다.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {(file || activeSeedId) && previewUrl ? (
            <>
              <div className="divider" />
              <div className="token-row">
                <span className="meta-badge">
                  {file ? `파일명: ${file.name}` : `시드: ${activeSeedId}`}
                </span>
                <span className="meta-badge">
                  상태: {recommending ? "스타일 추천 중" : "추천 준비 완료"}
                </span>
              </div>
            </>
          ) : null}
        </section>

        {error ? <div className="error-box">{error}</div> : null}

        {analysis ? (
          <section className="panel" id="style-section">
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
                <span>{analysis.colorHints.join(" · ")}</span>
              </div>
              <div className="mini-card">
                <strong>소재 단서</strong>
                <span>{analysis.materialHints.join(" · ")}</span>
              </div>
              <div className="mini-card">
                <strong>전체 톤</strong>
                <span>{analysis.surfaceTone}</span>
              </div>
            </div>

            <div className="divider" />

            <div className="style-grid">
              {recommendations.map((recommendation) => (
                <RecommendationCard
                  key={recommendation.styleId}
                  onSelect={() => handleSelectStyle(recommendation.styleId)}
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
              {allStyles.length
                ? allStyles.map((style) => (
                    <button
                      key={style.styleId}
                      className={`style-chip ${selectedStyleId === style.styleId ? "is-active" : ""}`}
                      onClick={() => handleSelectStyle(style.styleId)}
                      type="button"
                    >
                      {style.name} {style.score ? style.score : ""}
                    </button>
                  ))
                : STYLE_LIST.map((style) => (
                    <button
                      key={style.id}
                      className={`style-chip ${selectedStyleId === style.id ? "is-active" : ""}`}
                      onClick={() => handleSelectStyle(style.id)}
                      type="button"
                    >
                      {style.name}
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
                onClick={() => handleGenerate(0)}
                type="button"
              >
                {generating ? "콘텐츠 생성 중..." : "콘텐츠 생성"}
              </button>
            </div>
          </section>
        ) : null}

        {generatedPackage ? (
          <section className="panel" id="result-section">
            <div className="panel-header">
              <div>
                <div className="step-badge">Step 5-6. 결과 확인과 재생성</div>
                <h2 className="panel-title">생성 결과를 카드 단위로 바로 복사하고 재활용할 수 있습니다.</h2>
                <p className="panel-copy">
                  각 텍스트 출력은 개별 복사 버튼을 제공하며, 같은 스타일로 재생성하거나 다른
                  스타일로 전환할 수 있습니다.
                </p>
              </div>
            </div>

            <div className="token-row">
              <span className="meta-badge">선택 스타일: {generatedPackage.selectedStyle.name}</span>
              <span className="meta-badge">LLM: {generatedPackage.generationMeta.llmModel}</span>
              <span className="meta-badge">
                fallback {generatedPackage.generationMeta.fallbackUsed ? "사용" : "미사용"}
              </span>
            </div>

            <div className="result-card-grid">
              <ImageResultCard images={generatedPackage.representativeImages} title="대표 감성 이미지" />
              <ImageResultCard images={generatedPackage.lifestyleImages} title="라이프스타일 이미지" />
              <TextOutputCard
                copied={copiedKey === "oneLineIntro"}
                onCopy={() => copyText("oneLineIntro", generatedPackage.oneLineIntro)}
                text={generatedPackage.oneLineIntro}
                title="상품 한 줄 소개"
              />
              <TextOutputCard
                copied={copiedKey === "detailedDescription"}
                onCopy={() => copyText("detailedDescription", generatedPackage.detailedDescription)}
                text={generatedPackage.detailedDescription}
                title="상세 설명"
              />
              <TextOutputCard
                copied={copiedKey === "shortStoreCopy"}
                onCopy={() => copyText("shortStoreCopy", generatedPackage.shortStoreCopy)}
                text={generatedPackage.shortStoreCopy}
                title="스마트스토어용 짧은 소개문구"
              />
              <div className="copy-card result-card">
                <div className="card-title-row">
                  <strong>키워드 / 해시태그</strong>
                </div>
                <div className="copy-row">
                  <div>
                    <strong className="sub-label">키워드</strong>
                    <p className="result-text">{generatedPackage.keywords.join(" · ")}</p>
                  </div>
                  <CopyButton
                    copied={copiedKey === "keywords"}
                    onClick={() => copyText("keywords", generatedPackage.keywords.join(", "))}
                  />
                </div>
                <div className="copy-row">
                  <div>
                    <strong className="sub-label">해시태그</strong>
                    <p className="result-text">{generatedPackage.hashtags.join(" ")}</p>
                  </div>
                  <CopyButton
                    copied={copiedKey === "hashtags"}
                    onClick={() => copyText("hashtags", generatedPackage.hashtags.join(" "))}
                  />
                </div>
              </div>
            </div>

            <div className="divider" />
            <div className="action-row">
              <button
                className="primary-button"
                disabled={generating}
                onClick={() => handleGenerate(regenerateCount + 1)}
                type="button"
              >
                {generating ? "재생성 중..." : "같은 스타일로 다시 생성"}
              </button>
              <button
                className="secondary-button"
                onClick={() =>
                  document.getElementById("style-section")?.scrollIntoView({ behavior: "smooth" })
                }
                type="button"
              >
                스타일 바꾸기
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
