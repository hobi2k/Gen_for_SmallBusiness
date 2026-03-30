import { createStyleThumbnailUrl } from "@/lib/image-output";
import { STYLE_LIST, STYLE_PRESETS } from "@/lib/style-presets";
import {
  ProductAnalysis,
  ProductCategory,
  ProductColorCue,
  ProductMaterialCue,
  ProductSurfaceTone,
  RecommendationResult,
  StyleId,
  StyleRecommendation
} from "@/lib/types";
import { cosineSimilarity, normalizeScore } from "@/lib/utils";

const BASE_CATEGORY_SCORES: Record<StyleId, Record<ProductCategory, number>> = {
  "modern-minimal": {
    plate: 0.92,
    bowl: 0.76,
    cup: 0.68,
    glassware: 0.87,
    tray: 0.9,
    cutlery: 0.93,
    tableware: 0.74
  },
  "natural-wood": {
    plate: 0.89,
    bowl: 0.91,
    cup: 0.72,
    glassware: 0.58,
    tray: 0.88,
    cutlery: 0.8,
    tableware: 0.78
  },
  "nordic-light": {
    plate: 0.88,
    bowl: 0.86,
    cup: 0.86,
    glassware: 0.92,
    tray: 0.73,
    cutlery: 0.71,
    tableware: 0.8
  },
  "french-vintage": {
    plate: 0.83,
    bowl: 0.82,
    cup: 0.84,
    glassware: 0.64,
    tray: 0.76,
    cutlery: 0.62,
    tableware: 0.74
  },
  "cozy-home-cafe": {
    plate: 0.79,
    bowl: 0.74,
    cup: 0.94,
    glassware: 0.9,
    tray: 0.82,
    cutlery: 0.61,
    tableware: 0.77
  },
  "japanese-simple-table": {
    plate: 0.88,
    bowl: 0.93,
    cup: 0.87,
    glassware: 0.67,
    tray: 0.66,
    cutlery: 0.81,
    tableware: 0.8
  }
};

const COLOR_RULES: Record<StyleId, Partial<Record<ProductColorCue, number>>> = {
  "modern-minimal": { white: 0.05, gray: 0.05, black: 0.04, clear: 0.03, brown: -0.02 },
  "natural-wood": { beige: 0.05, brown: 0.06, earthy: 0.05, cream: 0.03, gray: -0.01 },
  "nordic-light": { white: 0.05, gray: 0.05, clear: 0.04, blue: 0.03, brown: -0.01 },
  "french-vintage": { cream: 0.05, pink: 0.05, ivory: 0.04, beige: 0.02, black: -0.02 },
  "cozy-home-cafe": { cream: 0.04, brown: 0.05, beige: 0.04, earthy: 0.03, clear: 0.01 },
  "japanese-simple-table": {
    "low-saturation": 0.05,
    neutral: 0.04,
    gray: 0.03,
    beige: 0.02,
    pink: -0.02
  }
};

const MATERIAL_RULES: Record<StyleId, Partial<Record<ProductMaterialCue, number>>> = {
  "modern-minimal": { metal: 0.05, glass: 0.04, ceramic: 0.02 },
  "natural-wood": { wood: 0.06, ceramic: 0.03, linen: 0.02, metal: -0.01 },
  "nordic-light": { glass: 0.05, ceramic: 0.03, wood: 0.01 },
  "french-vintage": { ceramic: 0.04, linen: 0.02, glass: 0.01, metal: -0.01 },
  "cozy-home-cafe": { ceramic: 0.04, glass: 0.04, wood: 0.02 },
  "japanese-simple-table": { ceramic: 0.05, wood: 0.02, metal: 0.02, glass: -0.01 }
};

const SURFACE_TONE_RULES: Record<StyleId, Partial<Record<ProductSurfaceTone, number>>> = {
  "modern-minimal": { cool: 0.02, neutral: 0.02 },
  "natural-wood": { warm: 0.03 },
  "nordic-light": { cool: 0.03, neutral: 0.01 },
  "french-vintage": { warm: 0.03 },
  "cozy-home-cafe": { warm: 0.04 },
  "japanese-simple-table": { neutral: 0.03, cool: 0.01 }
};

let cachedStyleEmbeddings: number[][] | null = null;

function buildStyleDescriptor(styleId: StyleId): string {
  const preset = STYLE_PRESETS[styleId];
  return [
    preset.name,
    preset.summary,
    preset.lightingDescription,
    preset.sceneSetup,
    preset.colorTone,
    preset.copyTone,
    preset.promptKeywords.join(", "),
    preset.fitSignals.join(", ")
  ].join(" | ");
}

function buildProductDescriptor(product: ProductAnalysis): string {
  return [
    product.categoryLabel,
    product.visualSummary,
    product.materialNotes,
    product.colorHints.join(", "),
    product.materialHints.join(", "),
    product.surfaceTone,
    product.detectedTags.join(", ")
  ].join(" | ");
}

function translateColorCue(cue: ProductColorCue): string {
  const labels: Record<ProductColorCue, string> = {
    white: "화이트 톤",
    ivory: "아이보리 톤",
    cream: "크림 톤",
    beige: "베이지 톤",
    brown: "브라운 톤",
    gray: "그레이 톤",
    black: "블랙 포인트",
    clear: "투명감",
    blue: "블루 기운",
    green: "그린 기운",
    pink: "핑크 기운",
    earthy: "어스톤",
    "low-saturation": "낮은 채도",
    neutral: "중성 톤",
    unknown: "뉴트럴 톤"
  };

  return labels[cue];
}

function translateMaterialCue(cue: ProductMaterialCue): string {
  const labels: Record<ProductMaterialCue, string> = {
    ceramic: "세라믹 질감",
    glass: "유리 질감",
    wood: "우드 결감",
    metal: "메탈 광택",
    stone: "스톤 표면감",
    linen: "린넨 감성",
    mixed: "혼합 소재"
  };

  return labels[cue];
}

function translateSurfaceTone(surfaceTone: ProductSurfaceTone): string {
  const labels: Record<ProductSurfaceTone, string> = {
    warm: "따뜻한 전체 톤",
    cool: "맑고 차분한 전체 톤",
    neutral: "절제된 중성 톤"
  };

  return labels[surfaceTone];
}

async function embedTexts(inputs: string[]): Promise<number[][] | null> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: inputs
      })
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };

    if (!payload.data?.length) {
      return null;
    }

    return payload.data.map((item) => item.embedding ?? []);
  } catch {
    return null;
  }
}

async function getStyleEmbeddings(): Promise<number[][] | null> {
  if (cachedStyleEmbeddings) {
    return cachedStyleEmbeddings;
  }

  const embeddings = await embedTexts(STYLE_LIST.map((style) => buildStyleDescriptor(style.id)));

  if (embeddings) {
    cachedStyleEmbeddings = embeddings;
  }

  return embeddings;
}

function collectAdjustments(styleId: StyleId, product: ProductAnalysis): Array<{ label: string; delta: number }> {
  const adjustments: Array<{ label: string; delta: number }> = [];

  if (STYLE_PRESETS[styleId].fitSignals.includes(product.category)) {
    adjustments.push({
      label: `${product.categoryLabel} 카테고리 적합`,
      delta: 0.03
    });
  }

  for (const colorCue of product.colorHints) {
    const delta = COLOR_RULES[styleId][colorCue];
    if (typeof delta === "number" && delta !== 0) {
      adjustments.push({
        label: `${translateColorCue(colorCue)}과 조화`,
        delta
      });
    }
  }

  for (const materialCue of product.materialHints) {
    const delta = MATERIAL_RULES[styleId][materialCue];
    if (typeof delta === "number" && delta !== 0) {
      adjustments.push({
        label: `${translateMaterialCue(materialCue)}과 적합`,
        delta
      });
    }
  }

  const toneDelta = SURFACE_TONE_RULES[styleId][product.surfaceTone];
  if (typeof toneDelta === "number" && toneDelta !== 0) {
    adjustments.push({
      label: `${translateSurfaceTone(product.surfaceTone)}과 일치`,
      delta: toneDelta
    });
  }

  return adjustments;
}

function buildReason(
  recommendation: typeof STYLE_LIST[number],
  product: ProductAnalysis,
  adjustmentLabels: string[]
): { reason: string; reasonHighlights: string[] } {
  const positiveLabels = adjustmentLabels.slice(0, 3);

  if (!positiveLabels.length) {
    return {
      reason: `${product.categoryLabel}의 인상과 ${recommendation.name}의 ${recommendation.colorTone} 톤이 안정적으로 맞습니다.`,
      reasonHighlights: [recommendation.summary]
    };
  }

  return {
    reason: `${recommendation.name}은 ${positiveLabels.join(", ")} 조건이 겹쳐 ${product.categoryLabel}에 특히 잘 맞습니다.`,
    reasonHighlights: positiveLabels
  };
}

export async function recommendStyles(product: ProductAnalysis): Promise<RecommendationResult> {
  const styleEmbeddings = await getStyleEmbeddings();
  const productEmbeddings = await embedTexts([buildProductDescriptor(product)]);
  const productEmbedding = productEmbeddings?.[0];
  const fallbackUsed = !(productEmbedding && styleEmbeddings?.length);

  const allStyles = STYLE_LIST.map((style, index) => {
    const baseHeuristic = BASE_CATEGORY_SCORES[style.id][product.category];
    const embeddingScore =
      productEmbedding && styleEmbeddings?.[index]
        ? normalizeScore((cosineSimilarity(productEmbedding, styleEmbeddings[index]) + 1) / 2)
        : baseHeuristic;
    const blendedBase = baseHeuristic * 0.56 + embeddingScore * 0.44;
    const adjustments = collectAdjustments(style.id, product);
    const rerankDelta = adjustments.reduce((total, item) => total + item.delta, 0);
    const rerankedScore = normalizeScore(blendedBase + rerankDelta);
    const rankedAdjustments = adjustments
      .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
      .map((item) => `${item.label} ${item.delta > 0 ? "+" : ""}${item.delta.toFixed(2)}`);
    const positiveHighlights = adjustments
      .filter((item) => item.delta > 0)
      .sort((left, right) => right.delta - left.delta)
      .map((item) => item.label);
    const { reason, reasonHighlights } = buildReason(style, product, positiveHighlights);

    return {
      styleId: style.id,
      name: style.name,
      summary: style.summary,
      score: rerankedScore,
      reason,
      reasonHighlights,
      lightingDescription: style.lightingDescription,
      sceneSetup: style.sceneSetup,
      colorTone: style.colorTone,
      promptTemplate: style.promptTemplate,
      promptKeywords: style.promptKeywords,
      thumbnailUrl: createStyleThumbnailUrl({ styleId: style.id, category: product.category }),
      scoreBreakdown: {
        embeddingScore,
        baseHeuristic,
        rerankedScore,
        rerankAdjustments: rankedAdjustments,
        fallbackUsed
      }
    } satisfies StyleRecommendation;
  }).sort((left, right) => right.score - left.score);

  return {
    recommendations: allStyles.slice(0, 3),
    allStyles,
    fallbackUsed
  };
}
