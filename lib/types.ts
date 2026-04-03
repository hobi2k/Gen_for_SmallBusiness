export type ProductCategory =
  | "plate"
  | "bowl"
  | "cup"
  | "glassware"
  | "tray"
  | "cutlery"
  | "tableware"
  | "none";

export type ProductColorCue =
  | "white"
  | "ivory"
  | "cream"
  | "beige"
  | "brown"
  | "gray"
  | "black"
  | "clear"
  | "blue"
  | "green"
  | "pink"
  | "earthy"
  | "low-saturation"
  | "neutral"
  | "unknown";

export type ProductMaterialCue =
  | "ceramic"
  | "glass"
  | "wood"
  | "metal"
  | "stone"
  | "linen"
  | "mixed"
  | "none";

export type ProductSurfaceTone = "warm" | "cool" | "neutral" | "none";
export type ProductImageSource = "storage" | "references" | null;
export type ProductAnalysisSource = "seed" | "heuristic" | "vision" | "hybrid";

export interface ProductSupplementalImage {
  sourceImageSource: Exclude<ProductImageSource, null>;
  sourceImageRelativePath: string;
  sourceImageUrl: string;
  fileName: string;
}

export type StyleId =
  | "modern-minimal"
  | "natural-wood"
  | "nordic-light"
  | "french-vintage"
  | "cozy-home-cafe"
  | "japanese-simple-table";

export type AspectRatio = "1:1" | "4:5" | "9:16";

export interface ProductDimensionsCm {
  widthCm: number | null;
  depthCm: number | null;
  heightCm: number | null;
}

export interface ProductAnalysis {
  uploadToken: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  analysisSource: ProductAnalysisSource;
  sourceImageSource: ProductImageSource;
  sourceImageRelativePath: string | null;
  sourceImageUrl: string | null;
  supplementalImages: ProductSupplementalImage[];
  category: ProductCategory;
  categoryLabel: string;
  materialNotes: string;
  visualSummary: string;
  colorHints: ProductColorCue[];
  materialHints: ProductMaterialCue[];
  surfaceTone: ProductSurfaceTone;
  dimensionsCm: ProductDimensionsCm;
  detectedTags: string[];
}

export interface ProductInputOverrides {
  category: ProductCategory | null;
  colorHints: ProductColorCue[];
  materialHints: ProductMaterialCue[];
  surfaceTone: ProductSurfaceTone | null;
  materialNotes: string | null;
  visualSummary: string | null;
  dimensionsCm: ProductDimensionsCm;
}

export const EMPTY_PRODUCT_INPUT_OVERRIDES: ProductInputOverrides = {
  category: null,
  colorHints: [],
  materialHints: [],
  surfaceTone: null,
  materialNotes: null,
  visualSummary: null,
  dimensionsCm: {
    widthCm: null,
    depthCm: null,
    heightCm: null
  }
};

export interface StyleSceneProfile {
  spaceType: string;
  tableSurface: string;
  requiredElements: string[];
  backgroundElements: string;
  accentProps: string[];
  composition: string;
  prohibitedElements: string[];
}

export interface StylePreset {
  id: StyleId;
  name: string;
  summary: string;
  lightingDescription: string;
  sceneSetup: string;
  colorTone: string;
  promptTemplate: string;
  promptKeywords: string[];
  copyTone: string;
  palette: [string, string, string];
  fitSignals: ProductCategory[];
  sceneProfile: StyleSceneProfile;
}

export interface StyleScoreBreakdown {
  embeddingScore: number;
  baseHeuristic: number;
  rerankedScore: number;
  rerankAdjustments: string[];
  fallbackUsed: boolean;
}

export interface StyleRecommendation {
  styleId: StyleId;
  name: string;
  summary: string;
  score: number;
  reason: string;
  reasonHighlights: string[];
  lightingDescription: string;
  sceneSetup: string;
  colorTone: string;
  promptTemplate: string;
  promptKeywords: string[];
  thumbnailUrl: string;
  referencePreviewUrls: string[];
  scoreBreakdown: StyleScoreBreakdown;
}

export interface RecommendationResult {
  recommendations: StyleRecommendation[];
  allStyles: StyleRecommendation[];
  fallbackUsed: boolean;
}

export interface PromptVariant {
  aspectRatio: AspectRatio;
  prompt: string;
}

export interface PromptBundle {
  representative: PromptVariant[];
  lifestyle: PromptVariant[];
  negativePrompt: string;
  copyPrompt: string;
  copySchema: string;
}

export interface GeneratedImage {
  id: string;
  kind: "representative" | "lifestyle";
  aspectRatio: AspectRatio;
  url: string;
  seed: number;
  storagePath?: string;
}

export interface GeneratedCopy {
  oneLineIntro: string;
  detailedDescription: string;
  shortStoreCopy: string;
  keywords: string[];
  hashtags: string[];
}

export interface GeneratedPackage extends GeneratedCopy {
  representativeImages: GeneratedImage[];
  lifestyleImages: GeneratedImage[];
  selectedStyle: StyleRecommendation;
  promptBundle: PromptBundle;
  generationMeta: {
    uploadToken: string;
    seedBase: number;
    regenerateCount: number;
    contentProfile: "smartstore";
    llmModel: string;
    imageEngine: string;
    imageFallbackUsed: boolean;
    targetLatencyMs: number;
    recommendationFallbackUsed: boolean;
    contentFallbackUsed: boolean;
    fallbackUsed: boolean;
    generatedAt: string;
  };
}

export interface DevSeed {
  id: string;
  title: string;
  description: string;
  previewUrl: string;
  analysis: ProductAnalysis;
}

export interface DevSeedPreview extends DevSeed {
  recommendations: StyleRecommendation[];
  allStyles: StyleRecommendation[];
  fallbackUsed: boolean;
}

export interface ReferenceAsset {
  id: string;
  fileName: string;
  relativePath: string;
  url: string;
}

export interface ReferenceManifest {
  productSamples: Record<ProductCategory, ReferenceAsset[]>;
  themeSamples: Record<StyleId, ReferenceAsset[]>;
}
