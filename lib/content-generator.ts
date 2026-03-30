import { ProductAnalysis, GeneratedCopy, PromptBundle, StylePreset } from "@/lib/types";

function extractResponseText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        type?: string;
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

function parseGeneratedCopy(rawText: string): GeneratedCopy | null {
  try {
    const parsed = JSON.parse(rawText) as Partial<GeneratedCopy>;

    if (
      typeof parsed.oneLineIntro !== "string" ||
      typeof parsed.detailedDescription !== "string" ||
      typeof parsed.shortStoreCopy !== "string" ||
      !Array.isArray(parsed.keywords) ||
      !Array.isArray(parsed.hashtags)
    ) {
      return null;
    }

    return {
      oneLineIntro: parsed.oneLineIntro.trim(),
      detailedDescription: parsed.detailedDescription.trim(),
      shortStoreCopy: parsed.shortStoreCopy.trim(),
      keywords: parsed.keywords.slice(0, 5).map(String),
      hashtags: parsed.hashtags.slice(0, 5).map(String)
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

function fallbackCopy(style: StylePreset, product: ProductAnalysis): GeneratedCopy {
  const keywords = [
    product.categoryLabel,
    style.name,
    "리빙소품",
    "감성식탁",
    "온라인판매콘텐츠"
  ];
  const hashtags = keywords.map((keyword) => `#${keyword.replaceAll(" ", "")}`);

  return {
    oneLineIntro: `${style.name} 무드로 공간의 인상을 정리해주는 ${product.categoryLabel}.`,
    detailedDescription: `${product.visualSummary}을 중심으로 온라인 상세페이지에 바로 활용할 수 있도록 정돈한 콘텐츠 패키지입니다. ${style.name} 특유의 ${style.colorTone} 톤을 반영해 상품의 분위기를 선명하게 전달하고, 오프라인 매장의 감성을 온라인에서도 자연스럽게 이어지게 설계했습니다.`,
    shortStoreCopy: `${style.name} 감성으로 더 또렷하게 보이는 ${product.categoryLabel}`,
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
}): Promise<{ copy: GeneratedCopy; modelUsed: string }> {
  const models = ["gpt-5-mini", "gpt-5-nano"];

  for (const model of models) {
    const copy = await requestCopy(promptBundle.copyPrompt, model);

    if (copy) {
      return { copy, modelUsed: model };
    }
  }

  return {
    copy: fallbackCopy(style, product),
    modelUsed: "template-fallback"
  };
}
