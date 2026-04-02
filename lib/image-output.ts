import "server-only";

import { getThemeReferenceAssets, inferReferenceMimeType, readReferenceAsset } from "@/lib/reference-library";
import { STYLE_PRESETS } from "@/lib/style-presets";
import { inferStorageMimeType, readStorageAsset } from "@/lib/storage-assets";
import { requestImageWorkerGeneration } from "@/lib/image-worker";
import {
  GeneratedImage,
  ProductAnalysis,
  ProductCategory,
  ProductColorCue,
  ProductMaterialCue,
  PromptBundle,
  StyleId
} from "@/lib/types";
import { hashString, seededAspectRatios } from "@/lib/utils";

function canvasSize(aspectRatio: GeneratedImage["aspectRatio"]): { width: number; height: number } {
  switch (aspectRatio) {
    case "1:1":
      return { width: 1080, height: 1080 };
    case "4:5":
      return { width: 1080, height: 1350 };
    case "9:16":
      return { width: 1080, height: 1920 };
    default:
      return { width: 1080, height: 1080 };
  }
}

function previewPalette(colorCue: ProductColorCue): [string, string, string] {
  const map: Record<ProductColorCue, [string, string, string]> = {
    white: ["#f8f6f2", "#ece7e0", "#d9d3cb"],
    ivory: ["#f7f1e6", "#eee2d2", "#d6c2a8"],
    cream: ["#f9eedc", "#f1ddc1", "#d9b68f"],
    beige: ["#f1e2cf", "#d8b892", "#9d7d5b"],
    brown: ["#d9c0a4", "#a77f57", "#5e422f"],
    gray: ["#f0f0ef", "#cbcace", "#75747d"],
    black: ["#e7e2dc", "#8f877d", "#36312d"],
    clear: ["#f8fbff", "#d8e6ee", "#abc2cd"],
    blue: ["#ecf2f6", "#bad0df", "#6e91aa"],
    green: ["#eef2eb", "#c4d1bf", "#718068"],
    pink: ["#f5ecea", "#dfc1c0", "#b18581"],
    earthy: ["#f3e1c6", "#c89e72", "#776046"],
    "low-saturation": ["#f0ece5", "#c9c2b7", "#8a847b"],
    neutral: ["#f4eee6", "#d9cec1", "#90806f"],
    unknown: ["#f4eee6", "#d9cec1", "#90806f"]
  };

  return map[colorCue];
}

function productShape(category: ProductCategory, kind: GeneratedImage["kind"] | "thumbnail"): string {
  const baseOpacity = kind === "representative" ? 0.92 : kind === "lifestyle" ? 0.84 : 0.9;

  switch (category) {
    case "plate":
      return `<circle cx="540" cy="720" r="250" fill="rgba(255,255,255,${baseOpacity})"/><circle cx="540" cy="720" r="176" fill="rgba(243,239,231,0.86)"/>`;
    case "bowl":
      return `<ellipse cx="540" cy="760" rx="240" ry="145" fill="rgba(255,255,255,${baseOpacity})"/><path d="M300 760 Q540 980 780 760" fill="rgba(238,230,217,0.82)"/>`;
    case "cup":
      return `<rect x="380" y="500" width="260" height="300" rx="42" fill="rgba(255,255,255,${baseOpacity})"/><path d="M640 570 Q760 580 730 700 Q700 790 640 760" fill="none" stroke="rgba(255,255,255,0.86)" stroke-width="34"/>`;
    case "glassware":
      return `<path d="M450 440 L630 440 L600 800 Q595 860 540 900 Q485 860 480 800 Z" fill="rgba(255,255,255,0.58)" stroke="rgba(255,255,255,0.92)" stroke-width="12"/>`;
    case "tray":
      return `<rect x="250" y="510" width="580" height="340" rx="54" fill="rgba(255,255,255,${baseOpacity})"/><rect x="320" y="575" width="440" height="210" rx="28" fill="rgba(245,240,231,0.78)"/>`;
    case "cutlery":
      return `<rect x="430" y="370" width="38" height="560" rx="18" fill="rgba(255,255,255,${baseOpacity})"/><rect x="530" y="370" width="38" height="560" rx="18" fill="rgba(255,255,255,${baseOpacity})"/><rect x="630" y="370" width="38" height="560" rx="18" fill="rgba(255,255,255,${baseOpacity})"/>`;
    default:
      return `<rect x="320" y="470" width="440" height="360" rx="48" fill="rgba(255,255,255,${baseOpacity})"/>`;
  }
}

function buildArtboard({
  palette,
  category,
  aspectRatio,
  variant,
  seed
}: {
  palette: [string, string, string];
  category: ProductCategory;
  aspectRatio: GeneratedImage["aspectRatio"];
  variant: GeneratedImage["kind"] | "thumbnail";
  seed: number;
}): string {
  const { width, height } = canvasSize(aspectRatio);
  const [base, middle, accent] = palette;
  const orbOffset = 120 + (seed % 180);
  const sceneOpacity =
    variant === "representative" ? 0.22 : variant === "lifestyle" ? 0.34 : 0.28;
  const frameY = variant === "thumbnail" ? 360 : 300;
  const frameHeight = variant === "thumbnail" ? 820 : 960;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1080 1440" fill="none">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${base}" />
          <stop offset="60%" stop-color="${middle}" />
          <stop offset="100%" stop-color="${accent}" />
        </linearGradient>
      </defs>
      <rect width="1080" height="1440" fill="url(#bg)" />
      <circle cx="${orbOffset}" cy="230" r="220" fill="rgba(255,255,255,0.18)" />
      <circle cx="910" cy="1120" r="260" fill="rgba(255,255,255,0.12)" />
      <rect x="120" y="${frameY}" width="840" height="${frameHeight}" rx="64" fill="rgba(255,255,255,${sceneOpacity})" />
      ${productShape(category, variant)}
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function bufferToDataUrl(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

async function loadProductSourceDataUrl(product: ProductAnalysis) {
  if (!product.sourceImageSource || !product.sourceImageRelativePath) {
    return null;
  }

  if (product.sourceImageSource === "storage") {
    const asset = await readStorageAsset(product.sourceImageRelativePath);
    return bufferToDataUrl(asset.buffer, inferStorageMimeType(asset.fileName));
  }

  const asset = await readReferenceAsset(product.sourceImageRelativePath);
  return bufferToDataUrl(asset.buffer, inferReferenceMimeType(asset.fileName));
}

async function loadThemeReferenceDataUrl(styleId: StyleId) {
  const themeAssets = await getThemeReferenceAssets(styleId, 1);
  const asset = themeAssets[0];

  if (!asset) {
    return null;
  }

  const loaded = await readReferenceAsset(asset.relativePath);
  return bufferToDataUrl(loaded.buffer, inferReferenceMimeType(loaded.fileName));
}

function buildCompositeSvg({
  productDataUrl,
  themeDataUrl,
  aspectRatio,
  kind,
  palette,
  seed
}: {
  productDataUrl: string;
  themeDataUrl: string | null;
  aspectRatio: GeneratedImage["aspectRatio"];
  kind: GeneratedImage["kind"];
  palette: [string, string, string];
  seed: number;
}) {
  const { width, height } = canvasSize(aspectRatio);
  const [base, middle, accent] = palette;
  const productWidth = kind === "representative" ? width * 0.48 : width * 0.42;
  const productHeight = height * 0.52;
  const productX = (width - productWidth) / 2;
  const productY = kind === "representative" ? height * 0.22 : height * 0.28;
  const haloX = 130 + (seed % 180);
  const haloY = 180 + (seed % 120);
  const panelY = kind === "representative" ? height * 0.1 : height * 0.14;
  const panelHeight = kind === "representative" ? height * 0.78 : height * 0.72;
  const backgroundLayer = themeDataUrl
    ? `<image href="${themeDataUrl}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" filter="url(#bgBlur)"/>`
    : "";

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${base}" />
          <stop offset="60%" stop-color="${middle}" />
          <stop offset="100%" stop-color="${accent}" />
        </linearGradient>
        <filter id="bgBlur" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="${kind === "representative" ? 16 : 10}" />
        </filter>
        <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="26" stdDeviation="26" flood-color="rgba(78,52,33,0.22)" />
        </filter>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)" />
      ${backgroundLayer}
      <rect width="${width}" height="${height}" fill="rgba(255,248,240,${kind === "representative" ? 0.62 : 0.38})" />
      <circle cx="${haloX}" cy="${haloY}" r="${kind === "representative" ? 170 : 140}" fill="rgba(255,255,255,0.22)" />
      <circle cx="${width - 160}" cy="${height - 180}" r="${kind === "representative" ? 150 : 190}" fill="rgba(255,255,255,0.14)" />
      <rect x="${width * 0.09}" y="${panelY}" width="${width * 0.82}" height="${panelHeight}" rx="${width * 0.04}" fill="rgba(255,255,255,${kind === "representative" ? 0.3 : 0.2})" />
      <image href="${productDataUrl}" x="${productX}" y="${productY}" width="${productWidth}" height="${productHeight}" preserveAspectRatio="xMidYMid meet" filter="url(#shadow)" />
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

async function createReferenceCompositeImages({
  styleId,
  product,
  regenerateCount
}: {
  styleId: StyleId;
  product: ProductAnalysis;
  regenerateCount: number;
}) {
  const seedBase = hashString(`${product.uploadToken}:${styleId}:${regenerateCount}`);
  const ratios = seededAspectRatios(seedBase);
  const [productDataUrl, themeDataUrl] = await Promise.all([
    loadProductSourceDataUrl(product),
    loadThemeReferenceDataUrl(styleId)
  ]);

  if (!productDataUrl) {
    return null;
  }

  const palette = STYLE_PRESETS[styleId].palette;

  const representativeImages = ratios.slice(0, 2).map((aspectRatio, index) => {
    const seed = seedBase + index;

    return {
      id: `rep_${seed}`,
      kind: "representative" as const,
      aspectRatio,
      seed,
      url: buildCompositeSvg({
        productDataUrl,
        themeDataUrl,
        aspectRatio,
        kind: "representative",
        palette,
        seed
      })
    };
  });

  const lifestyleImages = ratios.slice(1, 3).map((aspectRatio, index) => {
    const seed = seedBase + index + 10;

    return {
      id: `life_${seed}`,
      kind: "lifestyle" as const,
      aspectRatio,
      seed,
      url: buildCompositeSvg({
        productDataUrl,
        themeDataUrl,
        aspectRatio,
        kind: "lifestyle",
        palette,
        seed
      })
    };
  });

  return {
    representativeImages,
    lifestyleImages,
    seedBase,
    imageEngine: "reference-composite-fallback",
    imageFallbackUsed: true
  };
}

function buildPlaceholderUrl({
  styleId,
  category,
  aspectRatio,
  kind,
  seed
}: {
  styleId: StyleId;
  category: ProductCategory;
  aspectRatio: GeneratedImage["aspectRatio"];
  kind: GeneratedImage["kind"];
  seed: number;
}): string {
  return buildArtboard({
    palette: STYLE_PRESETS[styleId].palette,
    category,
    aspectRatio,
    variant: kind,
    seed
  });
}

function createPlaceholderImages({
  styleId,
  product,
  regenerateCount
}: {
  styleId: StyleId;
  product: ProductAnalysis;
  regenerateCount: number;
}) {
  const seedBase = hashString(`${product.uploadToken}:${styleId}:${regenerateCount}`);
  const ratios = seededAspectRatios(seedBase);

  const representativeImages = ratios.slice(0, 2).map((aspectRatio, index) => {
    const seed = seedBase + index;
    return {
      id: `rep_${seed}`,
      kind: "representative" as const,
      aspectRatio,
      seed,
      url: buildPlaceholderUrl({
        styleId,
        category: product.category,
        aspectRatio,
        kind: "representative",
        seed
      })
    };
  });

  const lifestyleImages = ratios.slice(1, 3).map((aspectRatio, index) => {
    const seed = seedBase + index + 10;
    return {
      id: `life_${seed}`,
      kind: "lifestyle" as const,
      aspectRatio,
      seed,
      url: buildPlaceholderUrl({
        styleId,
        category: product.category,
        aspectRatio,
        kind: "lifestyle",
        seed
      })
    };
  });

  return {
    representativeImages,
    lifestyleImages,
    seedBase,
    imageEngine: "sdxl-controlnet-ipadapter-placeholder",
    imageFallbackUsed: true
  };
}

export function createStyleThumbnailUrl({
  styleId,
  category
}: {
  styleId: StyleId;
  category: ProductCategory;
}): string {
  return buildArtboard({
    palette: STYLE_PRESETS[styleId].palette,
    category,
    aspectRatio: "4:5",
    variant: "thumbnail",
    seed: hashString(`${styleId}:${category}:thumb`)
  });
}

export function createSeedPreviewUrl({
  category,
  colorCue,
  materialCue
}: {
  category: ProductCategory;
  colorCue: ProductColorCue;
  materialCue: ProductMaterialCue;
}): string {
  const palette = previewPalette(colorCue);
  const materialSeed = hashString(`${category}:${materialCue}:seed-preview`);

  return buildArtboard({
    palette,
    category,
    aspectRatio: "1:1",
    variant: "thumbnail",
    seed: materialSeed
  });
}

export async function createGeneratedImages({
  styleId,
  product,
  regenerateCount,
  promptBundle
}: {
  styleId: StyleId;
  product: ProductAnalysis;
  regenerateCount: number;
  promptBundle: PromptBundle;
}): Promise<{
  representativeImages: GeneratedImage[];
  lifestyleImages: GeneratedImage[];
  seedBase: number;
  imageEngine: string;
  imageFallbackUsed: boolean;
}> {
  const seedBase = hashString(`${product.uploadToken}:${styleId}:${regenerateCount}`);
  const workerResult = await requestImageWorkerGeneration({
    styleId,
    product,
    regenerateCount,
    promptBundle
  });

  if (workerResult) {
    return {
      representativeImages: workerResult.representativeImages,
      lifestyleImages: workerResult.lifestyleImages,
      seedBase,
      imageEngine: workerResult.imageEngine,
      imageFallbackUsed: false
    };
  }

  const compositeResult = await createReferenceCompositeImages({
    styleId,
    product,
    regenerateCount
  });

  if (compositeResult) {
    return compositeResult;
  }

  return createPlaceholderImages({
    styleId,
    product,
    regenerateCount
  });
}
