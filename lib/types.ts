export type ProductCategory =
  | "plate"
  | "bowl"
  | "cup"
  | "glassware"
  | "tray"
  | "cutlery"
  | "tableware";

export type StyleId =
  | "modern-minimal"
  | "natural-wood"
  | "nordic-light"
  | "french-vintage"
  | "cozy-home-cafe"
  | "japanese-simple-table";

export type AspectRatio = "1:1" | "4:5" | "9:16";

export interface ProductAnalysis {
  uploadToken: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  category: ProductCategory;
  categoryLabel: string;
  materialNotes: string;
  visualSummary: string;
  detectedTags: string[];
}

export interface StylePreset {
  id: StyleId;
  name: string;
  summary: string;
  lightingDescription: string;
  sceneSetup: string;
  colorTone: string;
  promptTemplate: string;
  palette: [string, string, string];
  fitSignals: ProductCategory[];
}

export interface StyleRecommendation {
  styleId: StyleId;
  name: string;
  score: number;
  reason: string;
  lightingDescription: string;
  sceneSetup: string;
  colorTone: string;
  promptTemplate: string;
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
}

export interface GeneratedImage {
  id: string;
  kind: "representative" | "lifestyle";
  aspectRatio: AspectRatio;
  url: string;
  seed: number;
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
    llmModel: string;
    imageEngine: string;
    targetLatencyMs: number;
  };
}
