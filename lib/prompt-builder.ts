import { ProductAnalysis, PromptBundle, StylePreset } from "@/lib/types";
import { hashString, seededAspectRatios } from "@/lib/utils";

const NEGATIVE_PROMPT =
  "text, logo, watermark, brand label, distorted object, duplicated product, extra handle, broken edge, floating cutlery, deformed ceramic, unreadable typography, cartoon, illustration";

function fillTemplate(style: StylePreset, product: ProductAnalysis): string {
  return style.promptTemplate
    .replaceAll("{{product_category}}", product.categoryLabel)
    .replaceAll("{{lighting_description}}", style.lightingDescription)
    .replaceAll("{{scene_setup}}", style.sceneSetup)
    .replaceAll("{{color_tone}}", style.colorTone);
}

function buildRepresentativePrompt(style: StylePreset, product: ProductAnalysis): string {
  return `${fillTemplate(style, product)} 제품이 프레임의 중심에 오고 실제 비율과 윤곽을 유지한다. 대표 감성 이미지용, 상품이 가장 먼저 읽히는 구도, 표면 질감이 선명한 상세페이지 메인 컷.`;
}

function buildLifestylePrompt(style: StylePreset, product: ProductAnalysis): string {
  return `${fillTemplate(style, product)} 실제 사용 맥락이 느껴지되 주변 소품은 보조 역할만 한다. 라이프스타일 이미지용, 생활감 있는 테이블 장면, 상품 정체성이 흐려지지 않도록 유지한다.`;
}

function buildCopyPrompt(style: StylePreset, product: ProductAnalysis): string {
  return [
    "당신은 오프라인 리빙 소품 상인을 위한 커머스 카피라이터다.",
    "반드시 JSON만 반환한다.",
    "스타일링 팁은 절대 포함하지 않는다.",
    `상품 카테고리: ${product.categoryLabel}`,
    `상품 인상: ${product.visualSummary}`,
    `재질 메모: ${product.materialNotes}`,
    `선택 스타일: ${style.name}`,
    `조명: ${style.lightingDescription}`,
    `장면: ${style.sceneSetup}`,
    `컬러톤: ${style.colorTone}`,
    '출력 스키마: {"oneLineIntro":"","detailedDescription":"","shortStoreCopy":"","keywords":["","","","",""],"hashtags":["#","#","#","#","#"]}'
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
    copyPrompt: buildCopyPrompt(style, product)
  };
}
