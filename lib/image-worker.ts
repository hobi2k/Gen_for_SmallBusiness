import "server-only";

import { getThemeReferenceAssets } from "@/lib/reference-library";
import { buildStorageAssetUrl } from "@/lib/storage-assets";
import { GeneratedImage, ProductAnalysis, PromptBundle, StyleId } from "@/lib/types";

interface WorkerPromptVariant {
  aspect_ratio: GeneratedImage["aspectRatio"];
  prompt: string;
}

interface ImageWorkerRequest {
  upload_token: string;
  style_id: StyleId;
  regenerate_count: number;
  product: {
    category: ProductAnalysis["category"];
    category_label: string;
    visual_summary: string;
    source_image_source: Exclude<ProductAnalysis["sourceImageSource"], null>;
    source_image_relative_path: string;
  };
  prompts: {
    representative: WorkerPromptVariant[];
    lifestyle: WorkerPromptVariant[];
    negative_prompt: string;
  };
  style_references: Array<{
    relative_path: string;
  }>;
}

interface WorkerImageResult {
  relative_path: string;
  aspect_ratio: GeneratedImage["aspectRatio"];
  seed: number;
}

interface ImageWorkerResponse {
  engine: string;
  representative_images: WorkerImageResult[];
  lifestyle_images: WorkerImageResult[];
}

function workerBaseUrl() {
  return process.env.IMAGE_WORKER_URL?.trim() ?? "";
}

function defaultWorkerTimeoutMs() {
  return process.env.IMAGE_WORKER_PROFILE === "lite-mps" ? 480000 : 45000;
}

export function isImageWorkerConfigured() {
  return process.env.IMAGE_WORKER_ENABLED === "true" && Boolean(workerBaseUrl());
}

function mapWorkerImages(
  images: WorkerImageResult[],
  kind: GeneratedImage["kind"]
): GeneratedImage[] {
  return images.map((image) => ({
    id: `${kind}_${image.seed}`,
    kind,
    aspectRatio: image.aspect_ratio,
    seed: image.seed,
    storagePath: image.relative_path,
    url: buildStorageAssetUrl(image.relative_path)
  }));
}

function isValidWorkerResponse(payload: unknown): payload is ImageWorkerResponse {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<ImageWorkerResponse>;
  return (
    typeof candidate.engine === "string" &&
    Array.isArray(candidate.representative_images) &&
    Array.isArray(candidate.lifestyle_images)
  );
}

export async function requestImageWorkerGeneration({
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
  imageEngine: string;
  representativeImages: GeneratedImage[];
  lifestyleImages: GeneratedImage[];
} | null> {
  if (!isImageWorkerConfigured()) {
    return null;
  }

  if (!product.sourceImageRelativePath || !product.sourceImageSource) {
    return null;
  }

  const styleReferenceAssets = await getThemeReferenceAssets(styleId, 3);

  if (!styleReferenceAssets.length) {
    return null;
  }

  const requestPayload: ImageWorkerRequest = {
    upload_token: product.uploadToken,
    style_id: styleId,
    regenerate_count: regenerateCount,
    product: {
      category: product.category,
      category_label: product.categoryLabel,
      visual_summary: product.visualSummary,
      source_image_source: product.sourceImageSource,
      source_image_relative_path: product.sourceImageRelativePath
    },
    prompts: {
      representative: promptBundle.representative.map((item) => ({
        aspect_ratio: item.aspectRatio,
        prompt: item.prompt
      })),
      lifestyle: promptBundle.lifestyle.map((item) => ({
        aspect_ratio: item.aspectRatio,
        prompt: item.prompt
      })),
      negative_prompt: promptBundle.negativePrompt
    },
    style_references: styleReferenceAssets.map((asset) => ({
      relative_path: asset.relativePath
    }))
  };

  const controller = new AbortController();
  const timeoutMs = Number(process.env.IMAGE_WORKER_TIMEOUT_MS ?? defaultWorkerTimeoutMs());
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const token = process.env.IMAGE_WORKER_TOKEN?.trim();

  try {
    const response = await fetch(`${workerBaseUrl().replace(/\/+$/, "")}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error("[image-worker] non-ok response", {
        status: response.status,
        statusText: response.statusText,
        body: errorBody.slice(0, 500)
      });
      return null;
    }

    const payload = (await response.json()) as unknown;

    if (!isValidWorkerResponse(payload)) {
      return null;
    }

    return {
      imageEngine: payload.engine,
      representativeImages: mapWorkerImages(payload.representative_images, "representative"),
      lifestyleImages: mapWorkerImages(payload.lifestyle_images, "lifestyle")
    };
  } catch (error) {
    console.error("[image-worker] request failed", error);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
