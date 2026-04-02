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
        description: "한 문장. 감성 중심이되 상품과 무관한 표현 금지. 16~36자 권장."
      },
      detailedDescription: {
        type: "string",
        description:
          "2~4문장. 소재, 형태, 사용 장면, 상품 인상을 설득력 있게 설명. 스타일링 팁, 가격, 배송 문구 금지."
      },
      shortStoreCopy: {
        type: "string",
        description:
          "스마트스토어 상단, Page title 또는 Meta description에 가까운 짧은 소개문구. 한 줄, 18~40자 권장."
      },
      keywords: {
        type: "array",
        minItems: 5,
        maxItems: 5,
        items: {
          type: "string",
          description:
            "스마트스토어 태그 후보. 제품과 직접 관련된 명사형 구만 사용. 카테고리명 단독, 브랜드명, 판매처명 금지."
        }
      },
      hashtags: {
        type: "array",
        minItems: 5,
        maxItems: 5,
        items: {
          type: "string",
          description: "모두 #로 시작. 공백 없이 짧고 구체적인 해시태그."
        }
      }
    }
  },
  null,
  2
);

const SMARTSTORE_CONTENT_RULES = [
  "스마트스토어용 카피로 가정하고 작성한다.",
  "상품과 무관한 검색 유도 표현, 과장된 키워드 나열, 가격/할인/배송 문구, 이모지 사용을 금지한다.",
  "shortStoreCopy는 링크 공유시 Page title 또는 Meta description으로 보이더라도 어색하지 않게 짧고 직접적으로 작성한다.",
  "keywords는 스마트스토어 태그 후보로 사용할 수 있는 제품 연관 표현만 작성한다.",
  "keywords에는 카테고리명 단독, 브랜드명, 판매처명, 스타일명 단독을 넣지 않는다.",
  "출력은 반드시 JSON 객체만 반환한다."
] as const;

function fillTemplate(style: StylePreset, product: ProductAnalysis): string {
  const categoryLabel = product.categoryLabel === "None" ? "상품" : product.categoryLabel;

  return style.promptTemplate
    .replaceAll("{{product_category}}", categoryLabel)
    .replaceAll("{{lighting_description}}", style.lightingDescription)
    .replaceAll("{{scene_setup}}", style.sceneSetup)
    .replaceAll("{{color_tone}}", style.colorTone);
}

function formatColorHints(product: ProductAnalysis): string {
  return product.colorHints.filter((hint) => hint !== "unknown").join(", ") || "None";
}

function formatSurfaceTone(product: ProductAnalysis): string {
  return product.surfaceTone === "none" ? "None" : product.surfaceTone;
}

function promptCategory(product: ProductAnalysis): string {
  return product.category === "none" || product.category === "tableware"
    ? "tableware product"
    : product.category;
}

function buildRepresentativePrompt(style: StylePreset, product: ProductAnalysis): string {
  return [
    `${promptCategory(product)} hero product photo`,
    style.promptKeywords.join(", "),
    "preserve exact product identity",
    "correct scale and proportions",
    "centered composition",
    "clean commercial lighting",
    "premium ecommerce photo",
    "photorealistic",
    "no text"
  ].join(", ");
}

function buildLifestylePrompt(style: StylePreset, product: ProductAnalysis): string {
  return [
    `${promptCategory(product)} naturally placed in a lifestyle table scene`,
    style.promptKeywords.join(", "),
    "preserve exact product identity",
    "realistic scale and angle",
    "natural perspective",
    "props secondary",
    "premium lifestyle commerce photo",
    "photorealistic",
    "no text"
  ].join(", ");
}

function buildCopyPrompt(style: StylePreset, product: ProductAnalysis): string {
  const categoryLabel = product.categoryLabel === "None" ? "상품" : product.categoryLabel;

  return [
    "당신은 오프라인 리빙 소품 상인을 위한 커머스 카피라이터다.",
    "스타일링 팁은 절대 포함하지 않는다.",
    "각 출력 타입의 목적을 분리해 생성한다.",
    ...SMARTSTORE_CONTENT_RULES,
    `스타일별 문체 지시: ${style.copyTone}`,
    `상품 카테고리: ${categoryLabel}`,
    `상품 인상: ${product.visualSummary}`,
    `색감 단서: ${formatColorHints(product)}`,
    `재질 메모: ${product.materialNotes}`,
    `소재 단서: ${product.materialHints.filter((hint) => hint !== "none").join(", ") || "None"}`,
    `전체 톤: ${formatSurfaceTone(product)}`,
    `선택 스타일: ${style.name}`,
    `조명: ${style.lightingDescription}`,
    `장면: ${style.sceneSetup}`,
    `컬러톤: ${style.colorTone}`,
    `스타일 핵심 키워드: ${style.promptKeywords.join(", ")}`,
    "포맷 규칙:",
    "- oneLineIntro: 감성 중심 한 문장, 짧고 기억에 남되 제품과 직접 연결될 것",
    "- detailedDescription: 2~4문장, 소재/형태/사용 장면을 설득력 있게 설명할 것",
    "- shortStoreCopy: 스마트스토어 상단용, 검색설정 문구로도 쓸 수 있게 직접적이고 짧게",
    "- keywords: 정확히 5개, 스마트스토어 태그 후보용 명사구, 해시 기호 금지",
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
