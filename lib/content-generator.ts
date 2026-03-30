import { GeneratedCopy, ProductAnalysis, PromptBundle, StyleId, StylePreset } from "@/lib/types";
import { withLangfuseObservation } from "@/lib/langfuse";

const REQUIRED_KEYS = [
  "oneLineIntro",
  "detailedDescription",
  "shortStoreCopy",
  "keywords",
  "hashtags"
] as const;

const STYLE_TONE_COPY: Record<
  StyleId,
  {
    oneLineIntro: string;
    descriptionLead: string;
    storeCopy: string;
    keywords: string[];
  }
> = {
  "modern-minimal": {
    oneLineIntro: "여백을 정리하듯 놓이는 단정한 한 점.",
    descriptionLead:
      "군더더기 없이 정리된 화면에서 제품의 실루엣과 질감을 가장 선명하게 보여주는 방향으로 구성했습니다.",
    storeCopy: "정돈된 식탁 무드를 완성하는 미니멀 테이블웨어",
    keywords: ["미니멀식탁", "화이트무드", "정돈된공간"]
  },
  "natural-wood": {
    oneLineIntro: "원목 식탁에 편안하게 스며드는 따뜻한 한 점.",
    descriptionLead:
      "따뜻한 자연광과 우드 결감을 중심에 두어 손이 자주 가는 생활감 있는 인상을 만들었습니다.",
    storeCopy: "원목 식탁에 자연스럽게 어우러지는 데일리 테이블웨어",
    keywords: ["우드테이블", "내추럴무드", "따뜻한식탁"]
  },
  "nordic-light": {
    oneLineIntro: "밝은 빛 아래 더 맑게 읽히는 라이트톤 테이블웨어.",
    descriptionLead:
      "공기감 있는 밝은 톤과 기능적인 구성을 살려 깨끗하고 산뜻한 인상을 강조했습니다.",
    storeCopy: "밝고 깨끗한 라이트톤 식탁을 위한 감성 아이템",
    keywords: ["북유럽무드", "라이트톤", "맑은식탁"]
  },
  "french-vintage": {
    oneLineIntro: "우아한 식탁 무드를 은은하게 완성하는 클래식 포인트.",
    descriptionLead:
      "부드러운 패브릭과 앤티크한 분위기를 덧입혀 클래식하고 우아한 식탁 장면을 만들었습니다.",
    storeCopy: "은은한 빈티지 감성을 더하는 클래식 테이블 포인트",
    keywords: ["프렌치빈티지", "클래식무드", "우아한식탁"]
  },
  "cozy-home-cafe": {
    oneLineIntro: "홈카페 한켠을 포근하게 채우는 감성 포인트.",
    descriptionLead:
      "따뜻한 실내광과 커피 무드를 중심에 두어 일상 속 휴식 장면이 자연스럽게 떠오르도록 구성했습니다.",
    storeCopy: "홈카페 무드를 더해주는 포근한 데일리 아이템",
    keywords: ["홈카페무드", "따뜻한조명", "디저트감성"]
  },
  "japanese-simple-table": {
    oneLineIntro: "담백한 식탁 위에 차분하게 놓이는 정갈한 한 점.",
    descriptionLead:
      "낮은 채도와 절제된 배치를 유지해 제품의 선과 비율이 차분하게 읽히도록 구성했습니다.",
    storeCopy: "정갈한 식탁 무드에 어울리는 담백한 테이블웨어",
    keywords: ["담백한식탁", "절제된무드", "정갈한상차림"]
  }
};

function extractResponseText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        text?: string;
      }>;
    }>;
  };

  if (typeof candidate.output_text === "string" && candidate.output_text.trim()) {
    return candidate.output_text.trim();
  }

  for (const item of candidate.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string" && content.text.trim()) {
        return content.text.trim();
      }
    }
  }

  return null;
}

function extractJsonObject(rawText: string): string | null {
  const first = rawText.indexOf("{");
  const last = rawText.lastIndexOf("}");

  if (first === -1 || last === -1 || last <= first) {
    return null;
  }

  return rawText.slice(first, last + 1);
}

function normalizePlainText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => normalizePlainText(String(item)).replaceAll("#", ""))
        .filter(Boolean)
        .slice(0, 5)
    )
  );
}

function normalizeHashtags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => normalizePlainText(String(item)).replace(/\s+/g, ""))
        .filter(Boolean)
        .map((item) => (item.startsWith("#") ? item : `#${item}`))
        .slice(0, 5)
    )
  );
}

function sentenceCount(text: string): number {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean).length;
}

function isValidOneLineIntro(value: string): boolean {
  const text = normalizePlainText(value);
  return text.length >= 12 && text.length <= 38 && !text.includes("\n");
}

function isValidDetailedDescription(value: string): boolean {
  const text = normalizePlainText(value);
  const count = sentenceCount(text);
  return text.length >= 55 && text.length <= 260 && count >= 2 && count <= 4;
}

function isValidShortStoreCopy(value: string): boolean {
  const text = normalizePlainText(value);
  return text.length >= 16 && text.length <= 48 && !text.includes("\n");
}

function parseGeneratedCopy(rawText: string): GeneratedCopy | null {
  const jsonText = extractJsonObject(rawText);
  if (!jsonText) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonText) as Partial<Record<(typeof REQUIRED_KEYS)[number], unknown>>;

    const oneLineIntro = normalizePlainText(String(parsed.oneLineIntro ?? ""));
    const detailedDescription = normalizePlainText(String(parsed.detailedDescription ?? ""));
    const shortStoreCopy = normalizePlainText(String(parsed.shortStoreCopy ?? ""));
    const keywords = normalizeKeywords(parsed.keywords);
    const hashtags = normalizeHashtags(parsed.hashtags);

    if (
      !isValidOneLineIntro(oneLineIntro) ||
      !isValidDetailedDescription(detailedDescription) ||
      !isValidShortStoreCopy(shortStoreCopy) ||
      keywords.length !== 5 ||
      hashtags.length !== 5
    ) {
      return null;
    }

    return {
      oneLineIntro,
      detailedDescription,
      shortStoreCopy,
      keywords,
      hashtags
    };
  } catch {
    return null;
  }
}

async function requestCopy(prompt: string, model: string): Promise<GeneratedCopy | null> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  return withLangfuseObservation(
    "openai.sales_copy",
    {
      type: "generation",
      input: {
        promptLength: prompt.length,
        responseKeys: REQUIRED_KEYS
      },
      model,
      metadata: {
        pipeline: "sales-copy"
      },
      modelParameters: {
        responseFormat: "json"
      },
      captureOutput: (copy) =>
        copy
          ? {
              oneLineIntro: copy.oneLineIntro,
              keywordCount: copy.keywords.length,
              hashtagCount: copy.hashtags.length
            }
          : {
              parsed: false
            },
      captureErrorMetadata: () => ({
        pipeline: "sales-copy"
      })
    },
    async () => {
      try {
        const response = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model,
            input: [
              {
                role: "user",
                content: [{ type: "input_text", text: prompt }]
              }
            ]
          })
        });

        if (!response.ok) {
          return null;
        }

        const payload = await response.json();
        const rawText = extractResponseText(payload);

        if (!rawText) {
          return null;
        }

        return parseGeneratedCopy(rawText);
      } catch {
        return null;
      }
    }
  );
}

function fallbackCopy(style: StylePreset, product: ProductAnalysis): GeneratedCopy {
  const tonePack = STYLE_TONE_COPY[style.id];
  const keywords = [
    product.categoryLabel,
    style.name,
    ...tonePack.keywords,
    "리빙소품"
  ].slice(0, 5);
  const hashtags = keywords.map((keyword) => `#${keyword.replaceAll(" ", "")}`);
  const detailedDescription = [
    tonePack.descriptionLead,
    `${product.visualSummary}을 중심으로 ${style.name} 특유의 ${style.colorTone} 톤을 반영해 온라인 화면에서도 분위기가 분명하게 읽히도록 설계했습니다.`,
    `오프라인 매장의 감성을 온라인 판매 문구와 이미지 패키지로 자연스럽게 옮기기 좋은 구성입니다.`
  ].join(" ");

  return {
    oneLineIntro: tonePack.oneLineIntro,
    detailedDescription,
    shortStoreCopy: tonePack.storeCopy,
    keywords,
    hashtags
  };
}

export async function generateSalesCopy({
  product,
  style,
  promptBundle
}: {
  product: ProductAnalysis;
  style: StylePreset;
  promptBundle: PromptBundle;
}): Promise<{ copy: GeneratedCopy; modelUsed: string; fallbackUsed: boolean }> {
  const models = ["gpt-5-mini", "gpt-5-nano"];

  for (const model of models) {
    const copy = await requestCopy(promptBundle.copyPrompt, model);

    if (copy) {
      return { copy, modelUsed: model, fallbackUsed: false };
    }
  }

  return {
    copy: fallbackCopy(style, product),
    modelUsed: "template-fallback",
    fallbackUsed: true
  };
}
