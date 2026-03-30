import {
  ProductAnalysis,
  ProductCategory,
  ProductColorCue,
  ProductMaterialCue,
  ProductSurfaceTone
} from "@/lib/types";
import { createUploadToken } from "@/lib/utils";

const CATEGORY_PATTERNS: Array<{
  category: ProductCategory;
  categoryLabel: string;
  patterns: string[];
}> = [
  { category: "plate", categoryLabel: "접시", patterns: ["plate", "dish", "접시"] },
  { category: "bowl", categoryLabel: "볼", patterns: ["bowl", "볼", "사발"] },
  { category: "cup", categoryLabel: "컵", patterns: ["cup", "mug", "컵", "머그"] },
  {
    category: "glassware",
    categoryLabel: "유리잔",
    patterns: ["glass", "wine", "goblet", "유리", "잔"]
  },
  { category: "tray", categoryLabel: "트레이", patterns: ["tray", "쟁반", "트레이"] },
  {
    category: "cutlery",
    categoryLabel: "커트러리",
    patterns: ["fork", "knife", "spoon", "cutlery", "수저", "커트러리"]
  }
];

const COLOR_PATTERNS: Array<{ cue: ProductColorCue; patterns: string[] }> = [
  { cue: "white", patterns: ["white", "화이트"] },
  { cue: "ivory", patterns: ["ivory", "아이보리"] },
  { cue: "cream", patterns: ["cream", "크림"] },
  { cue: "beige", patterns: ["beige", "sand", "베이지"] },
  { cue: "brown", patterns: ["brown", "walnut", "oak", "브라운"] },
  { cue: "gray", patterns: ["gray", "grey", "silver", "그레이"] },
  { cue: "black", patterns: ["black", "charcoal", "블랙"] },
  { cue: "clear", patterns: ["clear", "transparent", "투명"] },
  { cue: "blue", patterns: ["blue", "navy", "블루"] },
  { cue: "green", patterns: ["green", "sage", "olive", "그린"] },
  { cue: "pink", patterns: ["pink", "rose", "blush", "핑크"] },
  { cue: "earthy", patterns: ["earth", "natural", "어스", "내추럴"] },
  { cue: "low-saturation", patterns: ["muted", "soft", "톤다운"] }
];

const MATERIAL_PATTERNS: Array<{ cue: ProductMaterialCue; patterns: string[] }> = [
  { cue: "glass", patterns: ["glass", "clear", "유리"] },
  { cue: "wood", patterns: ["wood", "oak", "walnut", "우드", "원목"] },
  { cue: "metal", patterns: ["steel", "stainless", "silver", "metal", "메탈"] },
  { cue: "stone", patterns: ["stone", "marble", "스톤"] },
  { cue: "linen", patterns: ["linen", "fabric", "패브릭", "린넨"] },
  { cue: "ceramic", patterns: ["ceramic", "porcelain", "도자기", "세라믹"] }
];

function inferCategory(fileName: string): { category: ProductCategory; categoryLabel: string } {
  const normalized = fileName.toLowerCase();
  const found = CATEGORY_PATTERNS.find(({ patterns }) =>
    patterns.some((pattern) => normalized.includes(pattern))
  );

  return found ?? { category: "tableware", categoryLabel: "테이블웨어" };
}

function inferColorHints(fileName: string): ProductColorCue[] {
  const normalized = fileName.toLowerCase();
  const matches = COLOR_PATTERNS.filter(({ patterns }) =>
    patterns.some((pattern) => normalized.includes(pattern))
  ).map(({ cue }) => cue);

  return matches.length ? Array.from(new Set(matches)) : ["neutral"];
}

function inferMaterialHints(fileName: string): ProductMaterialCue[] {
  const normalized = fileName.toLowerCase();
  const matches = MATERIAL_PATTERNS.filter(({ patterns }) =>
    patterns.some((pattern) => normalized.includes(pattern))
  ).map(({ cue }) => cue);

  return matches.length ? Array.from(new Set(matches)) : ["ceramic"];
}

function inferSurfaceTone(colorHints: ProductColorCue[]): ProductSurfaceTone {
  if (colorHints.some((cue) => ["brown", "beige", "cream", "ivory", "pink", "earthy"].includes(cue))) {
    return "warm";
  }

  if (colorHints.some((cue) => ["gray", "blue", "clear", "white"].includes(cue))) {
    return "cool";
  }

  return "neutral";
}

function describeMaterial(materialHints: ProductMaterialCue[]): string {
  if (materialHints.includes("glass")) {
    return "유리, 맑은 투명감";
  }

  if (materialHints.includes("wood")) {
    return "우드, 따뜻한 결감";
  }

  if (materialHints.includes("metal")) {
    return "메탈, 단정한 광택";
  }

  if (materialHints.includes("stone")) {
    return "스톤 계열, 묵직한 표면감";
  }

  return "세라믹 또는 도자기, 안정적인 표면감";
}

function describeColors(colorHints: ProductColorCue[]): string {
  const toneMap: Record<ProductColorCue, string> = {
    white: "화이트",
    ivory: "아이보리",
    cream: "크림",
    beige: "베이지",
    brown: "브라운",
    gray: "그레이",
    black: "블랙",
    clear: "투명감",
    blue: "블루",
    green: "그린",
    pink: "핑크",
    earthy: "어스톤",
    "low-saturation": "낮은 채도",
    neutral: "중성 톤",
    unknown: "뉴트럴 톤"
  };

  return colorHints.map((cue) => toneMap[cue]).join(", ");
}

function buildVisualSummary(
  categoryLabel: string,
  materialNotes: string,
  colorHints: ProductColorCue[]
): string {
  return `${categoryLabel}의 단정한 형태를 유지하면서 ${materialNotes}과 ${describeColors(colorHints)} 인상이 함께 드러나는 상품`;
}

export async function analyzeProductUpload(file: File): Promise<ProductAnalysis> {
  const { category, categoryLabel } = inferCategory(file.name);
  const colorHints = inferColorHints(file.name);
  const materialHints = inferMaterialHints(file.name);
  const surfaceTone = inferSurfaceTone(colorHints);
  const materialNotes = describeMaterial(materialHints);

  return {
    uploadToken: createUploadToken([file.name, file.size, file.type, file.lastModified]),
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    fileSize: file.size,
    category,
    categoryLabel,
    materialNotes,
    visualSummary: buildVisualSummary(categoryLabel, materialNotes, colorHints),
    colorHints,
    materialHints,
    surfaceTone,
    detectedTags: [
      category,
      ...colorHints,
      ...materialHints,
      ...materialNotes.split(", ").map((item) => item.toLowerCase())
    ]
  };
}
