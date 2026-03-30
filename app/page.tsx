"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";

import { STYLE_LIST, STYLE_PRESETS } from "@/lib/style-presets";
import { GeneratedPackage, ProductAnalysis, StyleId, StyleRecommendation } from "@/lib/types";

const STEP_LABELS = [
  ["1", "이미지 업로드"],
  ["2", "스타일 3개 추천"],
  ["3", "스타일 선택"],
  ["4", "콘텐츠 생성"],
  ["5", "패키지 확인"],
  ["6", "재생성 또는 변경"]
] as const;

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [recommendations, setRecommendations] = useState<StyleRecommendation[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState<StyleId | null>(null);
  const [generatedPackage, setGeneratedPackage] = useState<GeneratedPackage | null>(null);
  const [recommending, setRecommending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [regenerateCount, setRegenerateCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const selectedStyle = useMemo(
    () => (selectedStyleId ? STYLE_PRESETS[selectedStyleId] : null),
    [selectedStyleId]
  );

  async function requestRecommendations(nextFile: File) {
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
      };

      if (!response.ok || !payload.analysis || !payload.recommendations) {
        throw new Error(payload.error ?? "스타일 추천에 실패했습니다.");
      }

      setAnalysis(payload.analysis);
      setRecommendations(payload.recommendations);
      setSelectedStyleId(payload.recommendations[0]?.styleId ?? null);
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

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
    setAnalysis(null);
    setRecommendations([]);
    setSelectedStyleId(null);
    setGeneratedPackage(null);
    setRegenerateCount(0);

    await requestRecommendations(nextFile);
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
        analysis
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
          analysis
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
            소품을 온라인 상세페이지용 이미지와 문구 패키지로 정리합니다. 사용자는
            업로드, 스타일 선택, 생성만 하면 됩니다.
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
              <div className="step-badge">Step 1. 상품 이미지 업로드</div>
              <h2 className="panel-title">가장 먼저 상품 사진을 올려 주세요.</h2>
              <p className="panel-copy">
                업로드 직후 시스템이 상품 인상과 카테고리를 읽고, 가장 잘 맞는 스타일 3개를
                추천합니다.
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
                <img src={previewUrl} alt="업로드한 상품 미리보기" />
              ) : (
                <div className="upload-dropzone">
                  <div>
                    <strong>미리보기 영역</strong>
                    <p className="help-text">업로드한 상품 사진이 여기에 표시됩니다.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {file ? (
            <>
              <div className="divider" />
              <div className="token-row">
                <span className="meta-badge">파일명: {file.name}</span>
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
                <h2 className="panel-title">추천된 3개 스타일 중 하나를 고르세요.</h2>
                <p className="panel-copy">
                  추천 결과는 상품 카테고리와 분위기 힌트를 기준으로 계산됩니다. 다른 스타일을
                  눌러 바로 바꿀 수도 있습니다.
                </p>
              </div>
            </div>

            <div className="analysis-grid">
              <div className="mini-card">
                <strong>카테고리</strong>
                <span>{analysis.categoryLabel}</span>
              </div>
              <div className="mini-card">
                <strong>재질 메모</strong>
                <span>{analysis.materialNotes}</span>
              </div>
              <div className="mini-card">
                <strong>상품 인상</strong>
                <span>{analysis.visualSummary}</span>
              </div>
            </div>

            <div className="divider" />

            <div className="panel-header">
              <div>
                <h3 className="panel-title">추천 스타일 3개</h3>
                <p className="panel-copy">
                  추천 카드에는 점수, 톤, 장면 요약이 함께 표시됩니다.
                </p>
              </div>
            </div>

            <div className="style-grid">
              {recommendations.map((recommendation) => (
                <button
                  key={recommendation.styleId}
                  className={`style-card ${
                    selectedStyleId === recommendation.styleId ? "is-selected" : ""
                  }`}
                  onClick={() => handleSelectStyle(recommendation.styleId)}
                  type="button"
                >
                  <div className="badge-row">
                    <span className="style-chip is-active">추천 점수 {recommendation.score}</span>
                  </div>
                  <strong>{recommendation.name}</strong>
                  <p>{recommendation.reason}</p>
                  <span>조명: {recommendation.lightingDescription}</span>
                  <span>장면: {recommendation.sceneSetup}</span>
                  <span>컬러톤: {recommendation.colorTone}</span>
                </button>
              ))}
            </div>

            <div className="divider" />

            <div className="panel-header">
              <div>
                <h3 className="panel-title">전체 6개 스타일</h3>
                <p className="panel-copy">
                  추천 밖의 스타일도 바로 선택할 수 있습니다. 모든 스타일은 고정 프리셋으로
                  운영됩니다.
                </p>
              </div>
            </div>

            <div className="style-chip-row">
              {STYLE_LIST.map((style) => (
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
                  <strong>현재 선택</strong>
                  <span>{selectedStyle.name}</span>
                  <p className="panel-copy">{selectedStyle.summary}</p>
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
                <h2 className="panel-title">온라인 판매용 콘텐츠 패키지가 준비되었습니다.</h2>
                <p className="panel-copy">
                  대표 감성 이미지, 라이프스타일 이미지, 소개 문구, 키워드와 해시태그를 한
                  화면에서 확인할 수 있습니다.
                </p>
              </div>
            </div>

            <div className="result-grid">
              <div className="copy-grid">
                <div className="copy-card">
                  <strong>대표 감성 이미지</strong>
                  <div className="image-grid">
                    {generatedPackage.representativeImages.map((image) => (
                      <div className="image-card" key={image.id}>
                        <div className="image-frame">
                          <img src={image.url} alt={`대표 감성 이미지 ${image.aspectRatio}`} />
                        </div>
                        <p className="image-caption">비율 {image.aspectRatio}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="copy-card">
                  <strong>라이프스타일 이미지</strong>
                  <div className="image-grid">
                    {generatedPackage.lifestyleImages.map((image) => (
                      <div className="image-card" key={image.id}>
                        <div className="image-frame">
                          <img src={image.url} alt={`라이프스타일 이미지 ${image.aspectRatio}`} />
                        </div>
                        <p className="image-caption">비율 {image.aspectRatio}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="copy-grid">
                <div className="copy-card">
                  <strong>상품 한 줄 소개</strong>
                  <span>{generatedPackage.oneLineIntro}</span>
                </div>
                <div className="copy-card">
                  <strong>상세 설명</strong>
                  <span>{generatedPackage.detailedDescription}</span>
                </div>
                <div className="copy-card">
                  <strong>스마트스토어용 짧은 소개문구</strong>
                  <span>{generatedPackage.shortStoreCopy}</span>
                </div>
                <div className="copy-card">
                  <strong>키워드</strong>
                  <span className="keyword-list">{generatedPackage.keywords.join(" · ")}</span>
                </div>
                <div className="copy-card">
                  <strong>해시태그</strong>
                  <span className="hash-list">{generatedPackage.hashtags.join(" ")}</span>
                </div>
                <div className="copy-card">
                  <strong>생성 메타</strong>
                  <span>선택 스타일: {generatedPackage.selectedStyle.name}</span>
                  <span>LLM: {generatedPackage.generationMeta.llmModel}</span>
                  <span>이미지 엔진: {generatedPackage.generationMeta.imageEngine}</span>
                  <span>재생성 횟수: {generatedPackage.generationMeta.regenerateCount}</span>
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
                onClick={() => document.getElementById("style-section")?.scrollIntoView({ behavior: "smooth" })}
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
