import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import { STYLE_LIST } from "@/lib/style-presets";
import {
  DevSeedPreview,
  GeneratedPackage,
  ProductAnalysis,
  StyleId,
  StyleRecommendation
} from "@/lib/types";

interface RecommendStylesResponse {
  error?: string;
  analysis?: ProductAnalysis;
  recommendations?: StyleRecommendation[];
  allStyles?: StyleRecommendation[];
  fallbackUsed?: boolean;
}

interface UseHomePageFlowOptions {
  resultSectionId: string;
}

interface ApplyRecommendationPayload {
  analysis: ProductAnalysis;
  recommendations: StyleRecommendation[];
  allStyles: StyleRecommendation[];
  fallbackUsed: boolean;
  preview: string;
}

export interface HomePageFlowState {
  file: File | null;
  previewUrl: string | null;
  analysis: ProductAnalysis | null;
  recommendations: StyleRecommendation[];
  allStyles: StyleRecommendation[];
  selectedStyleId: StyleId | null;
  selectedStyle: StyleRecommendation | null;
  generatedPackage: GeneratedPackage | null;
  devSeeds: DevSeedPreview[];
  activeSeedId: string | null;
  recommending: boolean;
  generating: boolean;
  loadingSeeds: boolean;
  recommendationFallbackUsed: boolean;
  regenerateCount: number;
  copiedKey: string | null;
  error: string | null;
  handleUpload: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleSeedLoad: (seed: DevSeedPreview) => void;
  handleSelectStyle: (styleId: StyleId) => Promise<void>;
  handleGenerate: (nextRegenerateCount?: number) => Promise<void>;
  handleCopyText: (copyTarget: string, value: string) => Promise<void>;
}

function releasePreviewUrl(url: string | null) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

function buildSeedAllStyles(seed: DevSeedPreview): StyleRecommendation[] {
  if (seed.allStyles.length) {
    return seed.allStyles;
  }

  return seed.recommendations
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
        referencePreviewUrls: [],
        scoreBreakdown: {
          embeddingScore: 0,
          baseHeuristic: 0,
          rerankedScore: 0,
          rerankAdjustments: [],
          fallbackUsed: seed.fallbackUsed
        }
      }))
    )
    .sort((left, right) => right.score - left.score);
}

export function useHomePageFlow({
  resultSectionId
}: UseHomePageFlowOptions): HomePageFlowState {
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
  const copyTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      releasePreviewUrl(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

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

  function applyRecommendationPayload({
    analysis: nextAnalysis,
    recommendations: nextRecommendations,
    allStyles: nextAllStyles,
    fallbackUsed,
    preview
  }: ApplyRecommendationPayload) {
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

      const payload = (await response.json()) as RecommendStylesResponse;

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
      allStyles: buildSeedAllStyles(seed),
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
      document.getElementById(resultSectionId)?.scrollIntoView({ behavior: "smooth" });
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

  async function handleCopyText(copyTarget: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);

      if (copyTimeoutRef.current !== null) {
        window.clearTimeout(copyTimeoutRef.current);
      }

      setCopiedKey(copyTarget);
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopiedKey((current) => (current === copyTarget ? null : current));
        copyTimeoutRef.current = null;
      }, 1400);
    } catch {
      setError("복사에 실패했습니다. 브라우저 권한을 확인해 주세요.");
    }
  }

  return {
    file,
    previewUrl,
    analysis,
    recommendations,
    allStyles,
    selectedStyleId,
    selectedStyle,
    generatedPackage,
    devSeeds,
    activeSeedId,
    recommending,
    generating,
    loadingSeeds,
    recommendationFallbackUsed,
    regenerateCount,
    copiedKey,
    error,
    handleUpload,
    handleSeedLoad,
    handleSelectStyle,
    handleGenerate,
    handleCopyText
  };
}
