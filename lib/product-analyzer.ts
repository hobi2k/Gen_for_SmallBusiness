import { ProductAnalysis, ProductCategory } from "@/lib/types";
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

function inferCategory(fileName: string): { category: ProductCategory; categoryLabel: string } {
  const normalized = fileName.toLowerCase();
  const found = CATEGORY_PATTERNS.find(({ patterns }) =>
    patterns.some((pattern) => normalized.includes(pattern))
  );

  return found ?? { category: "tableware", categoryLabel: "테이블웨어" };
}

function inferMaterialNotes(fileName: string): string {
  const normalized = fileName.toLowerCase();

  if (normalized.includes("glass") || normalized.includes("유리")) {
    return "유리, 맑은 투명감";
  }

  if (normalized.includes("wood") || normalized.includes("우드")) {
    return "우드, 따뜻한 결감";
  }

  if (
    normalized.includes("steel") ||
    normalized.includes("stainless") ||
    normalized.includes("메탈")
  ) {
    return "스테인리스 또는 메탈, 단정한 광택";
  }

  return "세라믹 또는 도자기, 안정적인 표면감";
}

function buildVisualSummary(categoryLabel: string, materialNotes: string): string {
  return `${categoryLabel}의 단정한 형태를 유지하면서 ${materialNotes}이 자연스럽게 드러나는 상품`;
}

export async function analyzeProductUpload(file: File): Promise<ProductAnalysis> {
  const { category, categoryLabel } = inferCategory(file.name);
  const materialNotes = inferMaterialNotes(file.name);

  return {
    uploadToken: createUploadToken([file.name, file.size, file.type, file.lastModified]),
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    fileSize: file.size,
    category,
    categoryLabel,
    materialNotes,
    visualSummary: buildVisualSummary(categoryLabel, materialNotes),
    detectedTags: [category, ...materialNotes.split(", ").map((item) => item.toLowerCase())]
  };
}
