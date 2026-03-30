import { ProductAnalysis, PromptBundle, StylePreset } from "@/lib/types";
import { hashString, seededAspectRatios } from "@/lib/utils";

const NEGATIVE_PROMPT =
  "text, logo, watermark, brand label, distorted object, duplicated product, extra handle, broken edge, floating cutlery, deformed ceramic, unreadable typography, cartoon, illustration";

const COPY_SCHEMA = JSON.stringify(
  {
    type: "object",
    additionalProperties: false,
    required: ["oneLineIntro", "detailedDescription", "shortStoreCopy", "keywords", "hashtags"],
    properties: {
      oneLineIntro: {
        type: "string",
        description: "한 문장. 감성 중심. 12~34자 권장."
      },
      detailedDescription: {
        type: "string",
        description: "2~4문장. 소재/인상/판매 맥락 설명. 스타일링 팁 금지."
      },
      shortStoreCopy: {
        type: "string",
        description: "스마트스토어 상단용. 짧고 직접적인 판매 문구."
      },
      keywords: {
        type: "array",
        minItems: 5,
        maxItems: 5,
        items: { type: "string" }
      },
      hashtags: {
        type: "array",
        minItems: 5,
        maxItems: 5,
        items: { type: "string" }
      }
    }
  },
  null,
  2
);

function fillTemplate(style: StylePreset, product: ProductAnalysis): string {
  return style.promptTemplate
    .replaceAll("{{product_category}}", product.categoryLabel)
    .replaceAll("{{lighting_description}}", style.lightingDescription)
    .replaceAll("{{scene_setup}}", style.sceneSetup)
    .replaceAll("{{color_tone}}", style.colorTone);
}

function buildRepresentativePrompt(style: StylePreset, product: ProductAnalysis): string {
  return `${fillTemplate(style, product)} 핵심 키워드: ${style.promptKeywords.join(", ")}. 제품이 프레임 중심에 오고 실제 비율과 윤곽을 유지한다. 대표 감성 이미지용, 상품이 가장 먼저 읽히는 구도, 상세페이지 메인 컷.`;
}

function buildLifestylePrompt(style: StylePreset, product: ProductAnalysis): string {
  return `${fillTemplate(style, product)} 핵심 키워드: ${style.promptKeywords.join(", ")}. 실제 사용 맥락이 느껴지되 주변 소품은 보조 역할만 한다. 라이프스타일 이미지용, 생활감 있는 테이블 장면, 상품 정체성이 흐려지지 않도록 유지한다.`;
}

function buildCopyPrompt(style: StylePreset, product: ProductAnalysis): string {
  return [
    "당신은 오프라인 리빙 소품 상인을 위한 커머스 카피라이터다.",
    "출력은 반드시 JSON만 반환한다.",
    "스타일링 팁은 절대 포함하지 않는다.",
    "각 출력 타입의 목적을 분리해 생성한다.",
    `스타일별 문체 지시: ${style.copyTone}`,
    `상품 카테고리: ${product.categoryLabel}`,
    `상품 인상: ${product.visualSummary}`,
    `색감 단서: ${product.colorHints.join(", ")}`,
    `재질 메모: ${product.materialNotes}`,
    `소재 단서: ${product.materialHints.join(", ")}`,
    `전체 톤: ${product.surfaceTone}`,
    `선택 스타일: ${style.name}`,
    `조명: ${style.lightingDescription}`,
    `장면: ${style.sceneSetup}`,
    `컬러톤: ${style.colorTone}`,
    `스타일 핵심 키워드: ${style.promptKeywords.join(", ")}`,
    "포맷 규칙:",
    "- oneLineIntro: 감성 중심 한 문장, 짧고 기억에 남게",
    "- detailedDescription: 2~4문장, 소재/인상/판매 장면을 설득력 있게",
    "- shortStoreCopy: 스마트스토어 상단용, 직접적이고 짧게",
    "- keywords: 정확히 5개, 명사 중심, 해시 기호 금지",
    "- hashtags: 정확히 5개, 모두 #로 시작, 공백 없는 짧은 태그",
    `엄격한 출력 스키마:\n${COPY_SCHEMA}`
  ].join("\n");
}

export function buildPromptBundle(
  style: StylePreset,
  product: ProductAnalysis,
  regenerateCount: number
): PromptBundle {
  const seed = hashString(`${product.uploadToken}:${style.id}:${regenerateCount}`);
  const [first, second, third] = seededAspectRatios(seed);

  return {
    representative: [
      { aspectRatio: first, prompt: buildRepresentativePrompt(style, product) },
      { aspectRatio: second, prompt: buildRepresentativePrompt(style, product) }
    ],
    lifestyle: [
      { aspectRatio: second, prompt: buildLifestylePrompt(style, product) },
      { aspectRatio: third, prompt: buildLifestylePrompt(style, product) }
    ],
    negativePrompt: NEGATIVE_PROMPT,
    copyPrompt: buildCopyPrompt(style, product),
    copySchema: COPY_SCHEMA
  };
}
