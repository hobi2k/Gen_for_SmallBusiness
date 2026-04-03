import { ProductAnalysis, PromptBundle, StylePreset } from "@/lib/types";

const BASE_NEGATIVE_TERMS = [
  "text",
  "logo",
  "watermark",
  "brand label",
  "distorted object",
  "duplicated product",
  "multiple products",
  "cutout border",
  "white box background",
  "extra handle",
  "broken edge",
  "floating cutlery",
  "deformed ceramic",
  "unreadable typography",
  "cartoon",
  "illustration"
] as const;

const KITCHEN_DOMAIN_NEGATIVE_TERMS = [
  "living room",
  "living room sofa",
  "sofa",
  "couch",
  "armchair",
  "lounge chair",
  "salon seating",
  "bedroom",
  "outdoor patio",
  "floor placement",
  "empty window view",
  "panoramic window lounge",
  "product floating in air",
  "bathroom sink",
  "office desk",
  "bedside table",
  "tv console",
  "coffee table living room",
  "missing dining table",
  "no visible tabletop",
  "cropped-out table surface",
  "table hidden behind foreground objects"
] as const;

function productPlacementDirective(product: ProductAnalysis): string {
  const descriptor = [
    product.category,
    product.categoryLabel,
    product.visualSummary,
    product.materialNotes,
    product.detectedTags.join(" ")
  ]
    .join(" ")
    .toLowerCase();

  if (/(tray|쟁반|트레이|plate|접시)/.test(descriptor)) {
    return "empty kitchen or dining tabletop seen clearly from a gentle top-front angle, broad flat placement zone reserved in the lower foreground, object intended to rest fully on the table surface, product plane aligned parallel to the table edge, no props or furniture inside that reserved zone";
  }

  if (/(bowl|볼)/.test(descriptor)) {
    return "empty kitchen or dining tabletop with a placemat or clear table surface visible, reserved placement zone centered on the table, object intended to sit stably on the tabletop, no props inside the reserved zone";
  }

  if (/(cup|glass|glassware|컵|유리잔)/.test(descriptor)) {
    return "empty kitchen or dining tabletop or coaster area visible in the lower foreground, reserved placement zone near the front-center of the table, object intended to stand upright on the table surface, no cups or decor items inside the reserved zone";
  }

  if (/(cutlery|fork|knife|spoon|커트러리|포크|나이프|수저)/.test(descriptor)) {
    return "empty kitchen or dining tabletop with a horizontal setting area reserved in the foreground, object intended to rest flat on the table surface near a place setting, no plates or bowls inside the reserved zone";
  }

  return "empty kitchen or dining tabletop clearly visible in the lower foreground, reserved placement zone on the table surface, no foreground props inside the reserved zone";
}

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

function promptProductDescriptor(product: ProductAnalysis): string {
  const parts = [
    product.visualSummary !== "None" ? product.visualSummary : "",
    product.materialNotes !== "None" ? product.materialNotes : "",
    product.colorHints.filter((hint) => hint !== "unknown").join(" ")
  ]
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.join(", ");
}

function promptDimensionHint(product: ProductAnalysis): string {
  const { widthCm, depthCm, heightCm } = product.dimensionsCm;
  const parts = [
    widthCm ? `${widthCm}cm wide` : "",
    depthCm ? `${depthCm}cm deep` : "",
    heightCm ? `${heightCm}cm tall` : ""
  ].filter(Boolean);

  if (!parts.length) {
    return "";
  }

  return `real-world product size approximately ${parts.join(", ")}, keep tabletop placement scale physically believable`;
}

function productCategoryTokens(product: ProductAnalysis): string[] {
  const descriptor = [
    product.category,
    product.categoryLabel,
    product.visualSummary,
    product.materialNotes,
    product.detectedTags.join(" ")
  ]
    .join(" ")
    .toLowerCase();

  if (/(cup|glass|glassware|mug|컵|유리잔|머그)/.test(descriptor)) {
    return ["cup", "mug", "glass", "glassware", "ceramic mug", "tea cup"];
  }

  if (/(tray|쟁반|트레이)/.test(descriptor)) {
    return ["tray", "serving tray", "rectangular tray", "wooden tray"];
  }

  if (/(plate|접시|platter)/.test(descriptor)) {
    return ["plate", "platter", "dish"];
  }

  if (/(bowl|볼)/.test(descriptor)) {
    return ["bowl", "small bowl", "serving bowl"];
  }

  if (/(cutlery|fork|knife|spoon|커트러리|포크|나이프|수저)/.test(descriptor)) {
    return ["fork", "knife", "spoon", "cutlery", "utensil set"];
  }

  return [];
}

function filteredAccentProps(style: StylePreset, product: ProductAnalysis): string[] {
  const blockedTokens = productCategoryTokens(product);
  const descriptor = [
    product.category,
    product.categoryLabel,
    product.visualSummary,
    product.materialNotes,
    product.detectedTags.join(" ")
  ]
    .join(" ")
    .toLowerCase();
  const isFlatOrUprightTableware = /(tray|쟁반|트레이|plate|접시|bowl|볼|cup|glass|glassware|컵|유리잔)/.test(
    descriptor
  );
  if (!blockedTokens.length) {
    return isFlatOrUprightTableware
      ? style.sceneProfile.accentProps.filter(
          (prop) => !/(tray|plate|bowl|cup|mug|glass|dish|serving|tea utensil|ceramic bowl|pastry plate)/i.test(prop)
        )
      : style.sceneProfile.accentProps;
  }

  return style.sceneProfile.accentProps.filter((prop) => {
    const normalized = prop.toLowerCase();
    if (isFlatOrUprightTableware && /(tray|plate|bowl|cup|mug|glass|dish|serving|tea utensil|ceramic bowl|pastry plate)/i.test(normalized)) {
      return false;
    }
    return !blockedTokens.some((token) => normalized.includes(token));
  });
}

function kitchenSceneDirective(style: StylePreset): string {
  return [
    style.sceneProfile.spaceType,
    style.sceneProfile.tableSurface,
    `required scene elements: ${style.sceneProfile.requiredElements.join(", ")}`,
    style.sceneProfile.backgroundElements,
    style.sceneProfile.composition
  ].join(", ");
}

function productNegativeTerms(product: ProductAnalysis): string[] {
  const categoryToken =
    product.category === "glassware"
      ? "glass"
      : product.category === "none" || product.category === "tableware"
        ? "tableware product"
        : product.category;

  const colorTerms = product.colorHints.filter((hint) => hint !== "unknown").slice(0, 2);
  const materialTerms = product.materialHints.filter((hint) => hint !== "none").slice(0, 2);
  const summary = product.visualSummary !== "None" ? product.visualSummary : "";
  const notes = product.materialNotes !== "None" ? product.materialNotes : "";

  const terms = [
    `second ${categoryToken}`,
    `extra ${categoryToken}`,
    `duplicate foreground ${categoryToken}`,
    `${categoryToken} in background`,
    `${categoryToken} on shelf`,
    `${categoryToken} on another table`,
    `overlapping ${categoryToken}`,
    `cropped ${categoryToken}`,
    `floating ${categoryToken}`,
    `diagonal ${categoryToken}`,
    ...colorTerms.map((color) => `${color} ${categoryToken}`),
    ...materialTerms.map((material) => `${material} ${categoryToken}`)
  ];

  if (summary) {
    terms.push(`foreground product summary ${summary}`);
  }

  if (notes) {
    terms.push(`foreground material note ${notes}`);
  }

  if (product.surfaceTone !== "none") {
    terms.push(`${product.surfaceTone} toned ${categoryToken}`);
  }

  return terms;
}

function buildNegativePrompt(style: StylePreset, product: ProductAnalysis): string {
  const terms = [
    ...BASE_NEGATIVE_TERMS,
    ...KITCHEN_DOMAIN_NEGATIVE_TERMS,
    ...style.sceneProfile.prohibitedElements,
    ...productNegativeTerms(product)
  ];

  return Array.from(new Set(terms.map((term) => term.trim()).filter(Boolean))).join(", ");
}

function buildRepresentativePrompt(style: StylePreset, product: ProductAnalysis): string {
  const accentProps = filteredAccentProps(style, product);
  const dimensionHint = promptDimensionHint(product);

  return [
    `premium ecommerce kitchen tabletop background for ${promptCategory(product)}`,
    promptProductDescriptor(product),
    dimensionHint,
    kitchenSceneDirective(style),
    `foreground surface detail: ${style.sceneProfile.tableSurface}`,
    `background styling cues: ${style.sceneProfile.backgroundElements}`,
    productPlacementDirective(product),
    style.promptKeywords.join(", "),
    `allowed accent props: ${accentProps.join(", ") || "none"}`,
    "single kitchen or dining space only",
    "kitchen cabinetry or dining details kept secondary",
    "clean empty placement area on the dining table",
    "reserved product placement zone on the tabletop must stay empty",
    "tabletop dominates the lower half of the frame",
    "camera height aligned to the tabletop, not the whole room",
    "only one clean empty placement zone on the visible table",
    "single setup only",
    "do not render the product itself",
    "no duplicate object",
    "no same-category object anywhere else in the frame",
    "no chairs, tableware, flowers, lamps, or decor inside the reserved product zone",
    "camera focused on the table surface, not the room",
    "centered composition",
    "clean commercial lighting",
    "background only for later product compositing",
    "photorealistic",
    "no text"
  ].join(", ");
}

function buildLifestylePrompt(style: StylePreset, product: ProductAnalysis): string {
  const accentProps = filteredAccentProps(style, product);
  const dimensionHint = promptDimensionHint(product);

  return [
    `lifestyle kitchen-dining background scene for ${promptCategory(product)}`,
    promptProductDescriptor(product),
    dimensionHint,
    kitchenSceneDirective(style),
    `foreground surface detail: ${style.sceneProfile.tableSurface}`,
    `background styling cues: ${style.sceneProfile.backgroundElements}`,
    productPlacementDirective(product),
    style.promptKeywords.join(", "),
    `allowed accent props: ${accentProps.join(", ") || "none"}`,
    "single kitchen or dining space only",
    "clean placement area reserved on the dining table",
    "reserved product placement zone on the tabletop must stay empty",
    "tabletop clearly visible in the lower foreground",
    "kitchen or dining table is the hero surface",
    "do not render the product itself",
    "no duplicate object",
    "no same-category object anywhere else in the frame",
    "no cups, plates, bowls, trays, flowers, or decor inside the reserved product zone",
    "natural dining-table perspective",
    "props secondary",
    "background only for later product compositing",
    "realistic table depth",
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
  _regenerateCount: number
): PromptBundle {
  return {
    representative: [{ aspectRatio: "1:1", prompt: buildRepresentativePrompt(style, product) }],
    lifestyle: [
      { aspectRatio: "4:5", prompt: buildLifestylePrompt(style, product) },
      { aspectRatio: "9:16", prompt: buildLifestylePrompt(style, product) }
    ],
    negativePrompt: buildNegativePrompt(style, product),
    copyPrompt: buildCopyPrompt(style, product),
    copySchema: COPY_SCHEMA
  };
}
