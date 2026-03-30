import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { getActiveSpanId, getActiveTraceId } from "@langfuse/tracing";

import { GeneratedPackage, StyleRecommendation } from "@/lib/types";

const LOG_DIRECTORY = path.join(process.cwd(), "storage", "logs");
const LOG_FILE = path.join(LOG_DIRECTORY, "generation-events.jsonl");

export interface StructuredLogPayload {
  uploadIdentifier: string;
  recommendedStyles: Array<{
    styleId: string;
    styleName: string;
    score: number;
    reason: string;
  }>;
  finalSelectedStyle: {
    styleId: string;
    styleName: string;
  } | null;
  generationResult: Record<string, unknown> | null;
  isRegenerated: boolean;
  fallbackUsed: boolean;
  generatedAt: string;
  extra?: Record<string, unknown>;
}

export function summarizeRecommendedStyles(recommendations: StyleRecommendation[]) {
  return recommendations.map((item) => ({
    styleId: item.styleId,
    styleName: item.name,
    score: item.score,
    reason: item.reason
  }));
}

export function summarizeGeneratedPackage(result: GeneratedPackage) {
  return {
    representativeImages: result.representativeImages.map(({ id, kind, aspectRatio, seed }) => ({
      id,
      kind,
      aspectRatio,
      seed
    })),
    lifestyleImages: result.lifestyleImages.map(({ id, kind, aspectRatio, seed }) => ({
      id,
      kind,
      aspectRatio,
      seed
    })),
    oneLineIntro: result.oneLineIntro,
    detailedDescription: result.detailedDescription,
    shortStoreCopy: result.shortStoreCopy,
    keywords: result.keywords,
    hashtags: result.hashtags
  };
}

export function buildStructuredLogPayload(payload: StructuredLogPayload): StructuredLogPayload {
  return payload;
}

export async function logEvent(eventType: string, payload: unknown): Promise<void> {
  await mkdir(LOG_DIRECTORY, { recursive: true });

  const traceId = getActiveTraceId();
  const spanId = getActiveSpanId();

  await appendFile(
    LOG_FILE,
    `${JSON.stringify({
      eventType,
      recordedAt: new Date().toISOString(),
      traceId: traceId || null,
      spanId: spanId || null,
      payload
    })}\n`,
    "utf8"
  );
}
