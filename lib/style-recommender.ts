import { STYLE_LIST, STYLE_PRESETS } from "@/lib/style-presets";
import { ProductAnalysis, ProductCategory, StyleId, StyleRecommendation } from "@/lib/types";
import { cosineSimilarity, normalizeScore } from "@/lib/utils";

const HEURISTIC_SCORES: Record<StyleId, Record<ProductCategory, number>> = {
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

let cachedStyleEmbeddings: number[][] | null = null;

function buildStyleDescriptor(styleId: StyleId): string {
  const preset = STYLE_PRESETS[styleId];
  return [
    preset.name,
    preset.summary,
    preset.lightingDescription,
    preset.sceneSetup,
    preset.colorTone,
    preset.fitSignals.join(", ")
  ].join(" | ");
}

function buildProductDescriptor(product: ProductAnalysis): string {
  return [
    product.categoryLabel,
    product.visualSummary,
    product.materialNotes,
    product.detectedTags.join(", ")
  ].join(" | ");
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

function buildReason(
  recommendation: typeof STYLE_LIST[number],
  product: ProductAnalysis,
  score: number
): string {
  const scoreBand =
    score > 0.86 ? "가장 안정적으로 어울리는 조합입니다." : "시각적 일관성이 좋은 조합입니다.";

  return `${product.categoryLabel}의 인상과 ${recommendation.name}의 ${recommendation.colorTone} 톤이 잘 맞습니다. ${scoreBand}`;
}

export async function recommendStyles(product: ProductAnalysis): Promise<StyleRecommendation[]> {
  const styleEmbeddings = await getStyleEmbeddings();
  const productEmbeddings = await embedTexts([buildProductDescriptor(product)]);
  const productEmbedding = productEmbeddings?.[0];

  return STYLE_LIST.map((style, index) => {
    const heuristicScore = HEURISTIC_SCORES[style.id][product.category];
    const semanticScore =
      productEmbedding && styleEmbeddings?.[index]
        ? (cosineSimilarity(productEmbedding, styleEmbeddings[index]) + 1) / 2
        : heuristicScore;

    const blendedScore = normalizeScore(heuristicScore * 0.6 + semanticScore * 0.4);

    return {
      styleId: style.id,
      name: style.name,
      score: blendedScore,
      reason: buildReason(style, product, blendedScore),
      lightingDescription: style.lightingDescription,
      sceneSetup: style.sceneSetup,
      colorTone: style.colorTone,
      promptTemplate: style.promptTemplate
    };
  })
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
}
