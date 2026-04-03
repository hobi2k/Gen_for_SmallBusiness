import "server-only";

import {
  ProductAnalysis,
  ProductAnalysisSource,
  ProductInputOverrides,
  ProductCategory,
  ProductColorCue,
  ProductMaterialCue,
  ProductSurfaceTone
} from "@/lib/types";
import { withLangfuseObservation } from "@/lib/langfuse";
import { createUploadToken } from "@/lib/utils";

const ANALYZER_MODEL = "gpt-5-nano";
const ANALYZER_TIMEOUT_MS = 3200;
const MAX_IMAGE_BYTES_FOR_ANALYZER = 6 * 1024 * 1024;

const CATEGORY_VALUES: ProductCategory[] = [
  "plate",
  "bowl",
  "cup",
  "glassware",
  "tray",
  "cutlery",
  "tableware",
  "none"
];

const COLOR_VALUES: ProductColorCue[] = [
  "white",
  "ivory",
  "cream",
  "beige",
  "brown",
  "gray",
  "black",
  "clear",
  "blue",
  "green",
  "pink",
  "earthy",
  "low-saturation",
  "neutral",
  "unknown"
];

const MATERIAL_VALUES: ProductMaterialCue[] = [
  "ceramic",
  "glass",
  "wood",
  "metal",
  "stone",
  "linen",
  "mixed",
  "none"
];

const SURFACE_TONE_VALUES: ProductSurfaceTone[] = ["warm", "cool", "neutral", "none"];

interface HeuristicSnapshot {
  category: ProductCategory;
  categoryLabel: string;
  colorHints: ProductColorCue[];
  materialHints: ProductMaterialCue[];
  surfaceTone: ProductSurfaceTone;
}

interface VisionAnalysisResult {
  category?: ProductCategory;
  colorHints?: ProductColorCue[];
  materialHints?: ProductMaterialCue[];
  surfaceTone?: ProductSurfaceTone;
  materialNotes?: string;
  visualSummary?: string;
}

function hasHeuristicSignals(snapshot: HeuristicSnapshot): boolean {
  return (
    snapshot.category !== "none" ||
    !snapshot.colorHints.includes("unknown") ||
    !snapshot.materialHints.includes("none") ||
    snapshot.surfaceTone !== "none"
  );
}

function hasVisionSignals(result: VisionAnalysisResult | null): boolean {
  if (!result) {
    return false;
  }

  return Boolean(
    result.category ||
      result.colorHints?.length ||
      result.materialHints?.length ||
      result.surfaceTone ||
      normalizeOptionalText(result.materialNotes) ||
      normalizeOptionalText(result.visualSummary)
  );
}

function resolveAnalysisSource(
  heuristic: HeuristicSnapshot,
  visionAnalysis: VisionAnalysisResult | null
): ProductAnalysisSource {
  if (!hasVisionSignals(visionAnalysis)) {
    return "heuristic";
  }

  return hasHeuristicSignals(heuristic) ? "hybrid" : "vision";
}

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

  return found ?? { category: "none", categoryLabel: "None" };
}

function inferColorHints(fileName: string): ProductColorCue[] {
  const normalized = fileName.toLowerCase();
  const matches = COLOR_PATTERNS.filter(({ patterns }) =>
    patterns.some((pattern) => normalized.includes(pattern))
  ).map(({ cue }) => cue);

  return matches.length ? Array.from(new Set(matches)) : ["unknown"];
}

function inferMaterialHints(fileName: string): ProductMaterialCue[] {
  const normalized = fileName.toLowerCase();
  const matches = MATERIAL_PATTERNS.filter(({ patterns }) =>
    patterns.some((pattern) => normalized.includes(pattern))
  ).map(({ cue }) => cue);

  return matches.length ? Array.from(new Set(matches)) : ["none"];
}

function inferSurfaceTone(colorHints: ProductColorCue[]): ProductSurfaceTone {
  const meaningfulColorHints = colorHints.filter((cue) => cue !== "unknown");

  if (!meaningfulColorHints.length) {
    return "none";
  }

  if (meaningfulColorHints.some((cue) => ["brown", "beige", "cream", "ivory", "pink", "earthy"].includes(cue))) {
    return "warm";
  }

  if (meaningfulColorHints.some((cue) => ["gray", "blue", "clear", "white"].includes(cue))) {
    return "cool";
  }

  if (meaningfulColorHints.some((cue) => ["neutral", "low-saturation", "black", "green"].includes(cue))) {
    return "neutral";
  }

  return "none";
}

function describeMaterial(materialHints: ProductMaterialCue[]): string {
  if (materialHints.includes("none")) {
    return "None";
  }

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

  if (materialHints.includes("linen")) {
    return "린넨, 부드러운 패브릭 감성";
  }

  if (materialHints.includes("mixed")) {
    return "혼합 소재, 복합적인 질감";
  }

  return "None";
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

  const meaningfulColorHints = colorHints.filter((cue) => cue !== "unknown");

  if (!meaningfulColorHints.length) {
    return "None";
  }

  return meaningfulColorHints.map((cue) => toneMap[cue]).join(", ");
}

function buildVisualSummary(
  categoryLabel: string,
  materialNotes: string,
  colorHints: ProductColorCue[]
): string {
  const subject = categoryLabel === "None" ? "상품" : categoryLabel;
  const colorNotes = describeColors(colorHints);

  if (materialNotes === "None" && colorNotes === "None") {
    return "None";
  }

  if (materialNotes === "None") {
    return `${subject}의 단정한 형태와 ${colorNotes} 인상이 드러나는 상품`;
  }

  if (colorNotes === "None") {
    return `${subject}의 단정한 형태와 ${materialNotes}이 드러나는 상품`;
  }

  return `${subject}의 단정한 형태를 유지하면서 ${materialNotes}과 ${colorNotes} 인상이 함께 드러나는 상품`;
}

function categoryLabelFor(category: ProductCategory): string {
  return CATEGORY_PATTERNS.find((item) => item.category === category)?.categoryLabel ?? "None";
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeColorHints(colorHints: ProductColorCue[]): ProductColorCue[] {
  const meaningful = Array.from(new Set(colorHints.filter((cue) => cue !== "unknown")));
  return meaningful.length ? meaningful : ["unknown"];
}

function normalizeMaterialHints(materialHints: ProductMaterialCue[]): ProductMaterialCue[] {
  const meaningful = Array.from(new Set(materialHints.filter((cue) => cue !== "none")));
  return meaningful.length ? meaningful : ["none"];
}

function normalizeDimensionValue(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.round(value * 10) / 10;
}

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

function pickEnumValue<T extends string>(value: unknown, allowedValues: readonly T[]): T | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return allowedValues.includes(value as T) ? (value as T) : undefined;
}

function pickEnumArray<T extends string>(value: unknown, allowedValues: readonly T[]): T[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .filter((item): item is T => allowedValues.includes(item as T))
    )
  );

  return normalized.length ? normalized : undefined;
}

function normalizeVisionText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();

  if (!normalized) {
    return undefined;
  }

  return normalized.length > 180 ? normalized.slice(0, 180).trim() : normalized;
}

function buildHeuristicSnapshot(file: File): HeuristicSnapshot {
  const inferredCategory = inferCategory(file.name);
  const colorHints = normalizeColorHints(inferColorHints(file.name));
  const materialHints = normalizeMaterialHints(inferMaterialHints(file.name));

  return {
    category: inferredCategory.category,
    categoryLabel: inferredCategory.categoryLabel,
    colorHints,
    materialHints,
    surfaceTone: inferSurfaceTone(colorHints)
  };
}

function shouldUseVisionAnalyzer(
  file: File,
  heuristic: HeuristicSnapshot,
  overrides?: Partial<ProductInputOverrides>
): boolean {
  if (!process.env.OPENAI_API_KEY) {
    return false;
  }

  if (file.size > MAX_IMAGE_BYTES_FOR_ANALYZER) {
    return false;
  }

  const hasFullOverrides = Boolean(
    overrides?.category &&
      overrides?.colorHints?.length &&
      overrides?.materialHints?.length &&
      overrides?.surfaceTone &&
      normalizeOptionalText(overrides?.materialNotes) &&
      normalizeOptionalText(overrides?.visualSummary)
  );

  if (hasFullOverrides) {
    return false;
  }

  return (
    heuristic.category === "none" ||
    heuristic.colorHints.includes("unknown") ||
    heuristic.materialHints.includes("none") ||
    heuristic.surfaceTone === "none"
  );
}

function buildVisionAnalyzerPrompt(file: File, heuristic: HeuristicSnapshot): string {
  return [
    "당신은 리빙 소품 상품 사진 분석기다.",
    "이미지를 우선 보고 판단하고, 파일명/기존 힌트는 보조 참고만 한다.",
    "확실하지 않으면 None 또는 unknown을 사용한다.",
    "출력은 JSON 객체만 반환한다.",
    "허용 category: plate, bowl, cup, glassware, tray, cutlery, tableware, none",
    "허용 colorHints: white, ivory, cream, beige, brown, gray, black, clear, blue, green, pink, earthy, low-saturation, neutral, unknown",
    "허용 materialHints: ceramic, glass, wood, metal, stone, linen, mixed, none",
    "허용 surfaceTone: warm, cool, neutral, none",
    "materialNotes: 24자 이내 한국어 짧은 표현 또는 None",
    "visualSummary: 60자 이내 한국어 한 문장 또는 None",
    "JSON schema:",
    "{",
    '  "category": "string",',
    '  "colorHints": ["string"],',
    '  "materialHints": ["string"],',
    '  "surfaceTone": "string",',
    '  "materialNotes": "string",',
    '  "visualSummary": "string"',
    "}",
    `파일명 힌트: ${file.name}`,
    `규칙 기반 힌트 category: ${heuristic.category}`,
    `규칙 기반 힌트 colorHints: ${heuristic.colorHints.join(", ")}`,
    `규칙 기반 힌트 materialHints: ${heuristic.materialHints.join(", ")}`,
    `규칙 기반 힌트 surfaceTone: ${heuristic.surfaceTone}`
  ].join("\n");
}

async function fileToDataUrl(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const mimeType = file.type || "image/jpeg";
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

function parseVisionAnalysis(rawText: string): VisionAnalysisResult | null {
  const jsonText = extractJsonObject(rawText);

  if (!jsonText) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;

    return {
      category: pickEnumValue(parsed.category, CATEGORY_VALUES),
      colorHints: pickEnumArray(parsed.colorHints, COLOR_VALUES),
      materialHints: pickEnumArray(parsed.materialHints, MATERIAL_VALUES),
      surfaceTone: pickEnumValue(parsed.surfaceTone, SURFACE_TONE_VALUES),
      materialNotes: normalizeVisionText(parsed.materialNotes),
      visualSummary: normalizeVisionText(parsed.visualSummary)
    };
  } catch {
    return null;
  }
}

async function analyzeWithVision(
  file: File,
  heuristic: HeuristicSnapshot
): Promise<VisionAnalysisResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  return withLangfuseObservation(
    "openai.product_analyzer",
    {
      type: "generation",
      input: {
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
        heuristic
      },
      model: ANALYZER_MODEL,
      metadata: {
        pipeline: "product-analysis",
        strategy: "heuristic-plus-vision-fallback",
        timeoutMs: ANALYZER_TIMEOUT_MS
      },
      modelParameters: {
        maxOutputTokens: 220,
        responseFormat: "json"
      },
      captureOutput: (result) => result ?? { parsed: false },
      captureErrorMetadata: () => ({
        pipeline: "product-analysis",
        strategy: "heuristic-plus-vision-fallback"
      })
    },
    async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ANALYZER_TIMEOUT_MS);

      try {
        const response = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: ANALYZER_MODEL,
            max_output_tokens: 220,
            input: [
              {
                role: "user",
                content: [
                  {
                    type: "input_text",
                    text: buildVisionAnalyzerPrompt(file, heuristic)
                  },
                  {
                    type: "input_image",
                    image_url: await fileToDataUrl(file)
                  }
                ]
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

        return parseVisionAnalysis(rawText);
      } catch {
        return null;
      } finally {
        clearTimeout(timeoutId);
      }
    }
  );
}

export async function analyzeProductUpload(
  file: File,
  overrides?: Partial<ProductInputOverrides>
): Promise<ProductAnalysis> {
  const heuristic = buildHeuristicSnapshot(file);
  const visionAnalysis = shouldUseVisionAnalyzer(file, heuristic, overrides)
    ? await analyzeWithVision(file, heuristic)
    : null;
  const analysisSource = resolveAnalysisSource(heuristic, visionAnalysis);

  const category = overrides?.category ?? visionAnalysis?.category ?? heuristic.category;
  const categoryLabel = categoryLabelFor(category);
  const colorHints = normalizeColorHints(
    overrides?.colorHints?.length
      ? overrides.colorHints
      : visionAnalysis?.colorHints?.length
        ? visionAnalysis.colorHints
        : heuristic.colorHints
  );
  const materialHints = normalizeMaterialHints(
    overrides?.materialHints?.length
      ? overrides.materialHints
      : visionAnalysis?.materialHints?.length
        ? visionAnalysis.materialHints
        : heuristic.materialHints
  );
  const surfaceTone =
    overrides?.surfaceTone ?? visionAnalysis?.surfaceTone ?? inferSurfaceTone(colorHints);
  const materialNotes =
    normalizeOptionalText(overrides?.materialNotes) ??
    normalizeOptionalText(visionAnalysis?.materialNotes) ??
    describeMaterial(materialHints);
  const visualSummary =
    normalizeOptionalText(overrides?.visualSummary) ??
    normalizeOptionalText(visionAnalysis?.visualSummary) ??
    buildVisualSummary(categoryLabel, materialNotes, colorHints);
  const dimensionsCm = {
    widthCm: normalizeDimensionValue(overrides?.dimensionsCm?.widthCm),
    depthCm: normalizeDimensionValue(overrides?.dimensionsCm?.depthCm),
    heightCm: normalizeDimensionValue(overrides?.dimensionsCm?.heightCm)
  };

  return {
    uploadToken: createUploadToken([file.name, file.size, file.type, file.lastModified]),
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    fileSize: file.size,
    analysisSource,
    sourceImageSource: null,
    sourceImageRelativePath: null,
    sourceImageUrl: null,
    supplementalImages: [],
    category,
    categoryLabel,
    materialNotes,
    visualSummary,
    colorHints,
    materialHints,
    surfaceTone,
    dimensionsCm,
    detectedTags: [
      category,
      ...colorHints.filter((hint) => hint !== "unknown"),
      ...materialHints.filter((hint) => hint !== "none"),
      ...Object.entries(dimensionsCm)
        .filter(([, value]) => value !== null)
        .map(([key, value]) => `${key}:${value}`),
      ...(materialNotes === "None"
        ? []
        : materialNotes.split(", ").map((item) => item.toLowerCase())),
      ...(visualSummary === "None"
        ? []
        : visualSummary
            .toLowerCase()
            .split(/[,\s]+/)
            .filter((item) => item.length > 1))
    ]
  };
}
