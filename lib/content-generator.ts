import { GeneratedCopy, ProductAnalysis, ProductColorCue, PromptBundle, StyleId, StylePreset } from "@/lib/types";
import { withLangfuseObservation } from "@/lib/langfuse";

const REQUIRED_KEYS = [
  "oneLineIntro",
  "detailedDescription",
  "shortStoreCopy",
  "keywords",
  "hashtags"
] as const;

const MODEL_TIMEOUT_MS: Record<"gpt-5-mini" | "gpt-5-nano", number> = {
  "gpt-5-mini": 3400,
  "gpt-5-nano": 1800
};

const BANNED_KEYWORD_BASES = new Set([
  "접시",
  "볼",
  "컵",
  "유리잔",
  "트레이",
  "커트러리",
  "리빙소품",
  "스마트스토어",
  "네이버",
  "스토어",
  "모던미니멀",
  "내추럴우드",
  "북유럽라이트톤",
  "프렌치빈티지",
  "코지홈카페",
  "일본식담백한식탁"
]);

const COLOR_LABELS: Record<ProductColorCue, string> = {
  white: "화이트",
  ivory: "아이보리",
  cream: "크림",
  beige: "베이지",
  brown: "브라운",
  gray: "그레이",
  black: "블랙",
  clear: "투명",
  blue: "블루",
  green: "그린",
  pink: "핑크",
  earthy: "어스톤",
  "low-saturation": "저채도",
  neutral: "뉴트럴",
  unknown: ""
};

const STYLE_TONE_COPY: Record<
  StyleId,
  {
    introPattern: string[];
    detailMood: string;
    storeMood: string;
    featureKeywords: string[];
  }
> = {
  "modern-minimal": {
    introPattern: ["여백 위에서 더 또렷한", "정돈된 식탁에 자연스럽게 놓이는"],
    detailMood: "불필요한 장식을 덜고 제품의 실루엣과 표면 인상을 또렷하게 전달합니다.",
    storeMood: "간결한 상품 정보가 먼저 읽히는 스마트스토어용 문구",
    featureKeywords: ["미니멀테이블웨어", "정돈된식탁", "화이트무드"]
  },
  "natural-wood": {
    introPattern: ["원목 식탁에 편안하게 스며드는", "따뜻한 일상 장면에 잘 어우러지는"],
    detailMood: "따뜻한 우드 질감과 자연광을 떠올리게 하는 생활감 중심 표현으로 정리합니다.",
    storeMood: "원목 식탁 무드와 잘 맞는 생활형 상품 문구",
    featureKeywords: ["우드테이블무드", "내추럴식탁", "데일리테이블웨어"]
  },
  "nordic-light": {
    introPattern: ["밝은 식탁 위에서 더 맑게 보이는", "가벼운 공기감이 살아나는"],
    detailMood: "깨끗한 라이트톤과 기능적인 인상을 강조해 가볍고 산뜻하게 전달합니다.",
    storeMood: "맑고 깨끗한 인상을 우선하는 스마트스토어용 문구",
    featureKeywords: ["라이트톤식탁", "밝은다이닝", "클린테이블웨어"]
  },
  "french-vintage": {
    introPattern: ["은은한 우아함이 남는", "클래식한 식탁 무드를 살려주는"],
    detailMood: "부드러운 패브릭과 앤티크 무드를 연상시키되 과장 없이 우아하게 정리합니다.",
    storeMood: "우아한 분위기를 짧게 전달하는 스마트스토어용 문구",
    featureKeywords: ["빈티지테이블웨어", "클래식식탁무드", "우아한디테일"]
  },
  "cozy-home-cafe": {
    introPattern: ["홈카페 장면을 포근하게 채우는", "따뜻한 휴식 무드가 떠오르는"],
    detailMood: "커피와 디저트가 어울리는 편안한 일상 장면을 중심으로 정리합니다.",
    storeMood: "홈카페 전환율을 높이기 좋은 감성형 문구",
    featureKeywords: ["홈카페무드", "포근한식탁", "디저트플레이팅"]
  },
  "japanese-simple-table": {
    introPattern: ["담백한 식탁에 차분하게 놓이는", "절제된 상차림과 잘 어울리는"],
    detailMood: "낮은 채도와 정갈한 배치를 떠올리게 하는 차분한 어조로 정리합니다.",
    storeMood: "정갈한 인상을 짧게 전달하는 스마트스토어용 문구",
    featureKeywords: ["담백한식탁", "정갈한상차림", "절제된무드"]
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

function normalizeSmartToken(value: string): string {
  return normalizePlainText(value).replaceAll("#", "").replace(/[^가-힣a-zA-Z0-9]/g, "");
}

function clipText(value: string, maxLength: number): string {
  const normalized = normalizePlainText(value);
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function sentenceCount(text: string): number {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean).length;
}

function containsDisallowedSearchPattern(value: string): boolean {
  return /[✨⭐💡🔥🎁✅]/u.test(value) || /(무료배송|당일출고|특가|세일|할인|1\+1)/.test(value);
}

function isAllowedKeyword(keyword: string): boolean {
  const normalized = normalizeSmartToken(keyword);

  if (!normalized || normalized.length < 4 || normalized.length > 14) {
    return false;
  }

  return !BANNED_KEYWORD_BASES.has(normalized);
}

function normalizeKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Set<string>();
  const result: string[] = [];

  for (const item of value) {
    const normalized = normalizePlainText(String(item)).replaceAll("#", "");

    if (!isAllowedKeyword(normalized)) {
      continue;
    }

    const dedupeKey = normalizeSmartToken(normalized);

    if (!dedupeKey || unique.has(dedupeKey)) {
      continue;
    }

    unique.add(dedupeKey);
    result.push(normalized);

    if (result.length === 5) {
      break;
    }
  }

  return result;
}

function normalizeHashtags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = new Set<string>();
  const result: string[] = [];

  for (const item of value) {
    const normalized = normalizeSmartToken(String(item));

    if (!isAllowedKeyword(normalized)) {
      continue;
    }

    if (unique.has(normalized)) {
      continue;
    }

    unique.add(normalized);
    result.push(`#${normalized}`);

    if (result.length === 5) {
      break;
    }
  }

  return result;
}

function isValidOneLineIntro(value: string): boolean {
  const text = normalizePlainText(value);
  return text.length >= 16 && text.length <= 38 && !text.includes("\n") && !containsDisallowedSearchPattern(text);
}

function isValidDetailedDescription(value: string): boolean {
  const text = normalizePlainText(value);
  const count = sentenceCount(text);
  return (
    text.length >= 80 &&
    text.length <= 320 &&
    count >= 2 &&
    count <= 4 &&
    !containsDisallowedSearchPattern(text)
  );
}

function isValidShortStoreCopy(value: string): boolean {
  const text = normalizePlainText(value);
  return (
    text.length >= 18 &&
    text.length <= 42 &&
    !text.includes("\n") &&
    !text.includes("#") &&
    !containsDisallowedSearchPattern(text)
  );
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

function primaryColor(product: ProductAnalysis): string {
  return COLOR_LABELS[product.colorHints[0] ?? "unknown"];
}

function secondaryColor(product: ProductAnalysis): string {
  return COLOR_LABELS[product.colorHints[1] ?? product.colorHints[0] ?? "unknown"];
}

function categoryTerm(product: ProductAnalysis): string {
  return product.categoryLabel === "None" ? "상품" : product.categoryLabel;
}

function productHeadline(product: ProductAnalysis): string {
  const color = primaryColor(product);
  return clipText(`${color ? `${color} ` : ""}${categoryTerm(product)}`, 14);
}

function materialNoun(product: ProductAnalysis): string {
  const material = product.materialHints[0];

  switch (material) {
    case "ceramic":
      return "세라믹";
    case "glass":
      return "유리";
    case "wood":
      return "우드";
    case "metal":
      return "메탈";
    case "stone":
      return "스톤";
    case "linen":
      return "린넨";
    case "none":
      return categoryTerm(product);
    default:
      if (product.materialNotes === "None") {
        return categoryTerm(product);
      }

      return normalizePlainText(product.materialNotes.split(",")[0] ?? "테이블웨어");
  }
}

function shapeCue(product: ProductAnalysis): string {
  const summary = product.visualSummary;
  const cues = ["얇은 림", "원형", "곡선", "손잡이", "광택", "무광", "투명감", "결감", "슬림한 라인"];

  if (summary === "None") {
    return "형태";
  }

  return cues.find((cue) => summary.includes(cue)) ?? clipText(summary, 28);
}

function colorPhrase(product: ProductAnalysis): string | null {
  const color = primaryColor(product);
  return color ? `${color} 톤 인상과` : null;
}

function buildKeywordCandidates(product: ProductAnalysis, style: StylePreset) {
  const tonePack = STYLE_TONE_COPY[style.id];
  const color = primaryColor(product);
  const subColor = secondaryColor(product);
  const material = materialNoun(product);
  const shape = normalizeSmartToken(shapeCue(product));

  return [
    color ? `${color}${material}` : `${material}${categoryTerm(product)}`,
    shape,
    color ? `${color}${categoryTerm(product)}무드` : `${categoryTerm(product)}무드`,
    subColor ? `${subColor}${material}감성` : `${material}감성`,
    ...tonePack.featureKeywords,
    `${material}${categoryTerm(product)}추천`,
    `${categoryTerm(product)}${style.name.replaceAll(" ", "")}`
  ];
}

function buildSmartStoreKeywords(product: ProductAnalysis, style: StylePreset): string[] {
  const unique = new Set<string>();
  const result: string[] = [];

  for (const candidate of buildKeywordCandidates(product, style)) {
    const normalized = normalizePlainText(candidate);
    const dedupeKey = normalizeSmartToken(normalized);

    if (!isAllowedKeyword(normalized) || unique.has(dedupeKey)) {
      continue;
    }

    unique.add(dedupeKey);
    result.push(normalized);

    if (result.length === 5) {
      break;
    }
  }

  return result;
}

function buildHashtagsFromKeywords(keywords: string[]): string[] {
  return keywords.map((keyword) => `#${normalizeSmartToken(keyword)}`).slice(0, 5);
}

function buildOneLineIntro(style: StylePreset, product: ProductAnalysis): string {
  const tonePack = STYLE_TONE_COPY[style.id];
  const lead = tonePack.introPattern[0];
  return clipText(`${lead} ${productHeadline(product)}`, 38);
}

function buildDetailedDescription(style: StylePreset, product: ProductAnalysis): string {
  const tonePack = STYLE_TONE_COPY[style.id];
  const material = materialNoun(product);
  const shape = shapeCue(product);
  const colorLead = colorPhrase(product);

  return clipText(
    [
      `${categoryTerm(product)} 특유의 ${shape}과 ${material} 표면감이 온라인 화면에서도 분명하게 보이도록 정리한 문구입니다.`,
      colorLead
        ? `${colorLead} ${style.name} 무드를 함께 살려 ${tonePack.detailMood}`
        : `${style.name} 무드를 함께 살려 ${tonePack.detailMood}`,
      `${tonePack.storeMood}로 활용하기 좋고, 상품과 직접 연결되는 표현만 남겨 스마트스토어 등록 문구로 쓰기 쉽게 구성했습니다.`
    ].join(" "),
    300
  );
}

function buildShortStoreCopy(style: StylePreset, product: ProductAnalysis): string {
  const material = materialNoun(product);
  const shape = shapeCue(product);
  const color = primaryColor(product);
  return clipText(
    `${color ? `${color} ` : ""}${material} ${categoryTerm(product)}, ${shape}이 돋보이는 한 점`,
    40
  );
}

function fallbackCopy(style: StylePreset, product: ProductAnalysis): GeneratedCopy {
  const keywords = buildSmartStoreKeywords(product, style);
  const hashtags = buildHashtagsFromKeywords(keywords);

  return {
    oneLineIntro: buildOneLineIntro(style, product),
    detailedDescription: buildDetailedDescription(style, product),
    shortStoreCopy: buildShortStoreCopy(style, product),
    keywords,
    hashtags
  };
}

async function requestCopy(prompt: string, model: "gpt-5-mini" | "gpt-5-nano"): Promise<GeneratedCopy | null> {
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
        pipeline: "sales-copy",
        contentProfile: "smartstore",
        timeoutMs: MODEL_TIMEOUT_MS[model]
      },
      modelParameters: {
        responseFormat: "json",
        maxOutputTokens: 260
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
        pipeline: "sales-copy",
        contentProfile: "smartstore"
      })
    },
    async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS[model]);

      try {
        const response = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model,
            max_output_tokens: 260,
            input: [
              {
                role: "user",
                content: [{ type: "input_text", text: prompt }]
              }
            ]
          }),
          signal: controller.signal
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
      } finally {
        clearTimeout(timeoutId);
      }
    }
  );
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
  const models: Array<"gpt-5-mini" | "gpt-5-nano"> = ["gpt-5-mini", "gpt-5-nano"];

  for (const model of models) {
    const copy = await requestCopy(promptBundle.copyPrompt, model);

    if (copy) {
      return { copy, modelUsed: model, fallbackUsed: false };
    }
  }

  return {
    copy: fallbackCopy(style, product),
    modelUsed: "smartstore-template-fallback",
    fallbackUsed: true
  };
}
