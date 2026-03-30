import { STYLE_PRESETS } from "@/lib/style-presets";
import { GeneratedImage, ProductAnalysis, StyleId } from "@/lib/types";
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

function productShape(category: ProductAnalysis["category"], kind: GeneratedImage["kind"]): string {
  const baseOpacity = kind === "representative" ? 0.92 : 0.84;

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

function buildPlaceholderUrl({
  styleId,
  category,
  aspectRatio,
  kind,
  seed
}: {
  styleId: StyleId;
  category: ProductAnalysis["category"];
  aspectRatio: GeneratedImage["aspectRatio"];
  kind: GeneratedImage["kind"];
  seed: number;
}): string {
  const { width, height } = canvasSize(aspectRatio);
  const [base, middle, accent] = STYLE_PRESETS[styleId].palette;
  const orbOffset = 120 + (seed % 160);
  const sceneOpacity = kind === "representative" ? 0.22 : 0.34;

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
      <rect x="120" y="300" width="840" height="960" rx="64" fill="rgba(255,255,255,${sceneOpacity})" />
      ${productShape(category, kind)}
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function createGeneratedImages({
  styleId,
  product,
  regenerateCount
}: {
  styleId: StyleId;
  product: ProductAnalysis;
  regenerateCount: number;
}): {
  representativeImages: GeneratedImage[];
  lifestyleImages: GeneratedImage[];
  seedBase: number;
} {
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
    seedBase
  };
}
