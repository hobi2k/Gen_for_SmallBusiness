import "server-only";

import {
  observe,
  updateActiveObservation,
  type LangfuseGenerationAttributes,
  type LangfuseSpanAttributes
} from "@langfuse/tracing";

type SupportedObservationType = "span" | "generation" | "embedding" | "tool";

interface ObservationOptions<Result> {
  type?: SupportedObservationType;
  input?: unknown;
  metadata?: Record<string, unknown>;
  model?: string;
  modelParameters?: Record<string, number | string>;
  captureOutput?: (result: Result) => unknown;
  captureErrorMetadata?: (error: unknown) => Record<string, unknown>;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isLangfuseTracingEnabled() {
  const enabledFlag = process.env.LANGFUSE_TRACING_ENABLED;

  if (enabledFlag === "false" || enabledFlag === "0") {
    return false;
  }

  return Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
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

    if (typeof output !== "undefined") {
      updateObservation(type, { output });
    }

    return result;
  } catch (error) {
    updateObservation(type, {
      level: "ERROR",
      statusMessage: getErrorMessage(error),
      metadata: {
        ...(options.captureErrorMetadata?.(error) ?? {})
      }
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
  const instrumentedRun = observe(
    async () => {
      const startAttributes = buildStartAttributes(type, options);

      if (startAttributes) {
        updateObservation(type, startAttributes);
      }

      return executeWithObservation(type, options, run);
    },
    {
      name,
      asType: type,
      captureInput: false,
      captureOutput: false
    }
  );

  return instrumentedRun();
}
