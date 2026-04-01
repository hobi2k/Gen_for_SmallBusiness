import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { context as otelContext } from "@opentelemetry/api";
import { getPropagatedAttributesFromContext } from "@langfuse/core";
import { getActiveSpanId, getActiveTraceId } from "@langfuse/tracing";

import { GeneratedPackage, StyleRecommendation } from "@/lib/types";

const LOG_DIRECTORY = path.join(process.cwd(), "storage", "logs");
const LOG_FILE = path.join(LOG_DIRECTORY, "generation-events.jsonl");
const TRACE_METADATA_PREFIX = "langfuse.trace.metadata.";

interface LogRouteContext {
  name: string;
  path: string;
  method: string;
}

interface LogSessionContext {
  strategy: "uploadToken" | "unscoped-request";
  uploadToken: string | null;
}

interface LogCategoryContext {
  value: string | null;
  label: string | null;
}

interface LogSelectedStyleContext {
  styleId: string;
  styleName: string;
}

interface LogFallbackContext {
  recommendationUsed: boolean | null;
  contentUsed: boolean | null;
  overallUsed: boolean;
}

interface LogRegenerationContext {
  count: number;
  isRegenerated: boolean;
}

export interface StructuredLogPayload {
  route: LogRouteContext;
  session: LogSessionContext;
  category: LogCategoryContext;
  recommendedStyles: Array<{
    styleId: string;
    styleName: string;
    score: number;
    reason: string;
  }>;
  selectedStyle: LogSelectedStyleContext | null;
  generationResult: Record<string, unknown> | null;
  regeneration: LogRegenerationContext;
  fallback: LogFallbackContext;
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
    representativeImages: result.representativeImages.map(
      ({ id, kind, aspectRatio, seed, storagePath }) => ({
        id,
        kind,
        aspectRatio,
        seed,
        storagePath: storagePath ?? null
      })
    ),
    lifestyleImages: result.lifestyleImages.map(
      ({ id, kind, aspectRatio, seed, storagePath }) => ({
        id,
        kind,
        aspectRatio,
        seed,
        storagePath: storagePath ?? null
      })
    ),
    representativeImagePaths: result.representativeImages.map(({ storagePath }) => storagePath ?? null),
    lifestyleImagePaths: result.lifestyleImages.map(({ storagePath }) => storagePath ?? null),
    imageEngine: result.generationMeta.imageEngine,
    imageFallbackUsed: result.generationMeta.imageFallbackUsed,
    oneLineIntro: result.oneLineIntro,
    detailedDescription: result.detailedDescription,
    shortStoreCopy: result.shortStoreCopy,
    keywords: result.keywords,
    hashtags: result.hashtags,
    contentProfile: result.generationMeta.contentProfile
  };
}

export function buildStructuredLogPayload(payload: StructuredLogPayload): StructuredLogPayload {
  return payload;
}

function readStringAttribute(
  attributes: Record<string, string | string[]>,
  key: string
): string | null {
  const value = attributes[key];
  return typeof value === "string" ? value : null;
}

function readTraceMetadataValue(
  attributes: Record<string, string | string[]>,
  key: string
): string | null {
  return readStringAttribute(attributes, `${TRACE_METADATA_PREFIX}${key}`);
}

function buildTraceCorrelationContext() {
  const propagatedAttributes = getPropagatedAttributesFromContext(otelContext.active());

  return {
    traceId: getActiveTraceId() ?? null,
    spanId: getActiveSpanId() ?? null,
    sessionId: readStringAttribute(propagatedAttributes, "session.id"),
    traceName: readStringAttribute(propagatedAttributes, "langfuse.trace.name"),
    routeName: readTraceMetadataValue(propagatedAttributes, "route_name"),
    routePath: readTraceMetadataValue(propagatedAttributes, "route_path"),
    routeMethod: readTraceMetadataValue(propagatedAttributes, "route_method"),
    uploadToken: readTraceMetadataValue(propagatedAttributes, "upload_token")
  };
}

export async function logEvent(eventType: string, payload: unknown): Promise<void> {
  await mkdir(LOG_DIRECTORY, { recursive: true });

  await appendFile(
    LOG_FILE,
    `${JSON.stringify({
      eventType,
      recordedAt: new Date().toISOString(),
      correlation: buildTraceCorrelationContext(),
      payload
    })}\n`,
    "utf8"
  );
}
