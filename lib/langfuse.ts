import "server-only";

import { trace } from "@opentelemetry/api";
import {
  observe,
  propagateAttributes,
  updateActiveObservation,
  type LangfuseGenerationAttributes,
  type LangfuseSpanAttributes
} from "@langfuse/tracing";

export const LANGFUSE_SERVICE_NAME = "lifestyle-shop-ai-mvp";

const TRACE_SESSION_ID_ATTRIBUTE = "session.id";
const TRACE_USER_ID_ATTRIBUTE = "user.id";
const TRACE_NAME_ATTRIBUTE = "langfuse.trace.name";
const TRACE_TAGS_ATTRIBUTE = "langfuse.trace.tags";
const TRACE_METADATA_PREFIX = "langfuse.trace.metadata.";
const MAX_TRACE_ATTRIBUTE_LENGTH = 200;

type SupportedObservationType = "span" | "generation" | "embedding" | "tool";
type TraceMetadataValue = string | number | boolean | null | undefined;

export interface ApiRouteDescriptor {
  name: string;
  path: string;
  method: string;
}

export interface ApiCommerceTraceContext {
  uploadToken?: string | null;
  category?: string | null;
  categoryLabel?: string | null;
  selectedStyleId?: string | null;
  selectedStyleName?: string | null;
  imageEngine?: string | null;
  recommendationFallbackUsed?: boolean | null;
  contentFallbackUsed?: boolean | null;
  imageFallbackUsed?: boolean | null;
  fallbackUsed?: boolean | null;
  regenerateCount?: number | null;
}

interface TraceAttributeOptions {
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, TraceMetadataValue>;
  tags?: string[];
  traceName?: string;
}

interface ObservationOptions<Result> {
  type?: SupportedObservationType;
  input?: unknown;
  metadata?: Record<string, unknown>;
  traceAttributes?: TraceAttributeOptions;
  model?: string;
  modelParameters?: Record<string, number | string>;
  captureOutput?: (result: Result) => unknown;
  captureSuccessMetadata?: (result: Result) => Record<string, unknown>;
  captureSuccessTraceMetadata?: (result: Result) => Record<string, TraceMetadataValue>;
  captureErrorMetadata?: (error: unknown) => Record<string, unknown>;
}

interface ApiRouteObservationOptions<Result>
  extends Omit<
    ObservationOptions<Result>,
    "metadata" | "traceAttributes" | "captureOutput" | "captureErrorMetadata"
  > {
  context?: ApiCommerceTraceContext;
  metadata?: Record<string, unknown>;
  traceMetadata?: Record<string, TraceMetadataValue>;
  captureOutput?: (result: Result) => unknown;
  captureErrorMetadata?: (error: unknown) => Record<string, unknown>;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function isLangfuseTracingEnabled() {
  const enabledFlag = process.env.LANGFUSE_TRACING_ENABLED;

  if (enabledFlag === "false" || enabledFlag === "0") {
    return false;
  }

  return Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
}

function normalizeTraceAttributeValue(value: string) {
  return value.length > MAX_TRACE_ATTRIBUTE_LENGTH
    ? value.slice(0, MAX_TRACE_ATTRIBUTE_LENGTH)
    : value;
}

function toTraceAttributeValue(value: TraceMetadataValue): string | undefined {
  if (value === null || typeof value === "undefined") {
    return undefined;
  }

  return normalizeTraceAttributeValue(String(value));
}

function compactMetadata(
  metadata?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!metadata) {
    return undefined;
  }

  const entries = Object.entries(metadata).filter(([, value]) => typeof value !== "undefined");

  if (!entries.length) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

function compactTraceMetadata(
  metadata?: Record<string, TraceMetadataValue>
): Record<string, string> | undefined {
  if (!metadata) {
    return undefined;
  }

  const normalizedEntries = Object.entries(metadata)
    .map(([key, value]) => [key, toTraceAttributeValue(value)] as const)
    .filter((entry): entry is readonly [string, string] => typeof entry[1] === "string");

  if (!normalizedEntries.length) {
    return undefined;
  }

  return Object.fromEntries(normalizedEntries);
}

export function resolveLangfuseSessionId(uploadToken?: string | null) {
  const normalizedToken = uploadToken?.trim();

  if (!normalizedToken || normalizedToken === "unknown-upload") {
    return undefined;
  }

  return normalizeTraceAttributeValue(normalizedToken);
}

function buildRouteSessionMetadata(sessionId?: string) {
  return {
    strategy: sessionId ? "uploadToken" : "unscoped-request",
    sessionId: sessionId ?? null
  };
}

export function buildApiRouteObservationMetadata(
  route: ApiRouteDescriptor,
  context: ApiCommerceTraceContext = {},
  extraMetadata?: Record<string, unknown>
) {
  const sessionId = resolveLangfuseSessionId(context.uploadToken);

  return compactMetadata({
    route: {
      name: route.name,
      path: route.path,
      method: route.method
    },
    session: buildRouteSessionMetadata(sessionId),
    commerce: {
      uploadToken: sessionId ? context.uploadToken ?? null : null,
      category: context.category ?? null,
      categoryLabel: context.categoryLabel ?? null,
      selectedStyleId: context.selectedStyleId ?? null,
      selectedStyleName: context.selectedStyleName ?? null,
      imageEngine: context.imageEngine ?? null,
      regenerateCount: context.regenerateCount ?? null
    },
    fallback: {
      recommendationUsed: context.recommendationFallbackUsed ?? null,
      contentUsed: context.contentFallbackUsed ?? null,
      imageFallbackUsed: context.imageFallbackUsed ?? null,
      overallUsed: context.fallbackUsed ?? null
    },
    ...extraMetadata
  });
}

export function buildApiRouteTraceMetadata(
  route: ApiRouteDescriptor,
  context: ApiCommerceTraceContext = {},
  extraMetadata?: Record<string, TraceMetadataValue>
) {
  const sessionId = resolveLangfuseSessionId(context.uploadToken);

  return compactTraceMetadata({
    route_name: route.name,
    route_path: route.path,
    route_method: route.method,
    session_strategy: sessionId ? "uploadToken" : "unscoped-request",
    upload_token: sessionId ? context.uploadToken ?? undefined : undefined,
    category: context.category ?? undefined,
    category_label: context.categoryLabel ?? undefined,
    selected_style_id: context.selectedStyleId ?? undefined,
    selected_style_name: context.selectedStyleName ?? undefined,
    image_engine: context.imageEngine ?? undefined,
    recommendation_fallback_used: context.recommendationFallbackUsed ?? undefined,
    content_fallback_used: context.contentFallbackUsed ?? undefined,
    image_fallback_used: context.imageFallbackUsed ?? undefined,
    fallback_used: context.fallbackUsed ?? undefined,
    regenerate_count: context.regenerateCount ?? undefined,
    ...extraMetadata
  });
}

function applyTraceAttributes(attributes?: TraceAttributeOptions) {
  if (!attributes) {
    return;
  }

  const span = trace.getActiveSpan();

  if (!span) {
    return;
  }

  const nextAttributes: Record<string, string | string[]> = {};

  if (attributes.sessionId) {
    nextAttributes[TRACE_SESSION_ID_ATTRIBUTE] = normalizeTraceAttributeValue(attributes.sessionId);
  }

  if (attributes.userId) {
    nextAttributes[TRACE_USER_ID_ATTRIBUTE] = normalizeTraceAttributeValue(attributes.userId);
  }

  if (attributes.traceName) {
    nextAttributes[TRACE_NAME_ATTRIBUTE] = normalizeTraceAttributeValue(attributes.traceName);
  }

  if (attributes.tags?.length) {
    nextAttributes[TRACE_TAGS_ATTRIBUTE] = attributes.tags
      .map(normalizeTraceAttributeValue)
      .slice(0, 20);
  }

  const metadata = compactTraceMetadata(attributes.metadata);

  if (metadata) {
    Object.entries(metadata).forEach(([key, value]) => {
      nextAttributes[`${TRACE_METADATA_PREFIX}${key}`] = value;
    });
  }

  if (Object.keys(nextAttributes).length) {
    span.setAttributes(nextAttributes);
  }
}

export function syncActiveApiRouteContext(
  route: ApiRouteDescriptor,
  context: ApiCommerceTraceContext = {},
  extra?: {
    metadata?: Record<string, unknown>;
    traceMetadata?: Record<string, TraceMetadataValue>;
  }
) {
  const metadata = buildApiRouteObservationMetadata(route, context, extra?.metadata);

  if (metadata) {
    updateObservation("span", { metadata });
  }

  applyTraceAttributes({
    sessionId: resolveLangfuseSessionId(context.uploadToken),
    traceName: route.name,
    metadata: buildApiRouteTraceMetadata(route, context, extra?.traceMetadata)
  });
}

function updateObservation(
  type: SupportedObservationType,
  attributes: LangfuseSpanAttributes | LangfuseGenerationAttributes
) {
  if (type === "generation") {
    updateActiveObservation(attributes as LangfuseGenerationAttributes, { asType: "generation" });
    return;
  }

  if (type === "embedding") {
    updateActiveObservation(attributes as LangfuseGenerationAttributes, { asType: "embedding" });
    return;
  }

  if (type === "tool") {
    updateActiveObservation(attributes as LangfuseSpanAttributes, { asType: "tool" });
    return;
  }

  updateActiveObservation(attributes as LangfuseSpanAttributes, { asType: "span" });
}

function buildStartAttributes<Result>(
  type: SupportedObservationType,
  options: ObservationOptions<Result>
): LangfuseSpanAttributes | LangfuseGenerationAttributes | null {
  const baseAttributes: LangfuseSpanAttributes = {};

  if (typeof options.input !== "undefined") {
    baseAttributes.input = options.input;
  }

  if (options.metadata) {
    baseAttributes.metadata = options.metadata;
  }

  if (type === "generation" || type === "embedding") {
    const generationAttributes: LangfuseGenerationAttributes = {
      ...baseAttributes
    };

    if (options.model) {
      generationAttributes.model = options.model;
    }

    if (options.modelParameters) {
      generationAttributes.modelParameters = options.modelParameters;
    }

    return Object.keys(generationAttributes).length ? generationAttributes : null;
  }

  return Object.keys(baseAttributes).length ? baseAttributes : null;
}

async function executeWithObservation<Result>(
  type: SupportedObservationType,
  options: ObservationOptions<Result>,
  run: () => Promise<Result>
) {
  try {
    const result = await run();
    const output = options.captureOutput?.(result);
    const metadata = compactMetadata(options.captureSuccessMetadata?.(result));
    const observationUpdate: LangfuseSpanAttributes | LangfuseGenerationAttributes = {};

    if (typeof output !== "undefined") {
      observationUpdate.output = output;
    }

    if (metadata) {
      observationUpdate.metadata = metadata;
    }

    if (Object.keys(observationUpdate).length) {
      updateObservation(type, observationUpdate);
    }

    const successTraceMetadata = compactTraceMetadata(options.captureSuccessTraceMetadata?.(result));

    if (successTraceMetadata) {
      applyTraceAttributes({
        metadata: successTraceMetadata
      });
    }

    return result;
  } catch (error) {
    const errorMetadata = compactMetadata({
      ...(options.metadata ?? {}),
      ...(options.captureErrorMetadata?.(error) ?? {})
    });

    updateObservation(type, {
      level: "ERROR",
      statusMessage: getErrorMessage(error),
      metadata: errorMetadata
    });

    throw error;
  }
}

export async function withLangfuseObservation<Result>(
  name: string,
  options: ObservationOptions<Result>,
  run: () => Promise<Result>
) {
  if (!isLangfuseTracingEnabled()) {
    return run();
  }

  const type = options.type ?? "span";
  const executeInstrumentedRun = () =>
    observe(
      async () => {
        const startAttributes = buildStartAttributes(type, options);

        if (startAttributes) {
          updateObservation(type, startAttributes);
        }

        if (options.traceAttributes) {
          applyTraceAttributes(options.traceAttributes);
        }

        return executeWithObservation(type, options, run);
      },
      {
        name,
        asType: type,
        captureInput: false,
        captureOutput: false
      }
    )();

  if (options.traceAttributes) {
    return propagateAttributes(
      {
        sessionId: options.traceAttributes.sessionId,
        userId: options.traceAttributes.userId,
        metadata: compactTraceMetadata(options.traceAttributes.metadata),
        tags: options.traceAttributes.tags,
        traceName: options.traceAttributes.traceName ?? name
      },
      executeInstrumentedRun
    );
  }

  return executeInstrumentedRun();
}

function extractResponseStatus(result: unknown) {
  if (
    typeof result === "object" &&
    result !== null &&
    "status" in result &&
    typeof result.status === "number"
  ) {
    return result.status;
  }

  return undefined;
}

export async function withApiRouteObservation<Result>(
  route: ApiRouteDescriptor,
  options: ApiRouteObservationOptions<Result>,
  run: () => Promise<Result>
) {
  return withLangfuseObservation(
    route.name,
    {
      ...options,
      metadata: buildApiRouteObservationMetadata(route, options.context, options.metadata),
      traceAttributes: {
        sessionId: resolveLangfuseSessionId(options.context?.uploadToken),
        traceName: route.name,
        metadata: buildApiRouteTraceMetadata(route, options.context, options.traceMetadata)
      },
      captureOutput: (result) => {
        const status = extractResponseStatus(result);

        return {
          ...(typeof status === "number" ? { status } : {}),
          ...(options.captureOutput?.(result) ?? {})
        };
      },
      captureErrorMetadata: (error) => ({
        route: {
          name: route.name,
          path: route.path,
          method: route.method
        },
        ...(options.captureErrorMetadata?.(error) ?? {})
      })
    },
    run
  );
}
