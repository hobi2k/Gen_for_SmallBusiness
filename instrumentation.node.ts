import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeSDK } from "@opentelemetry/sdk-node";

const globalForLangfuse = globalThis as typeof globalThis & {
  __lifestyleShopLangfuseSdk?: NodeSDK;
  __lifestyleShopLangfuseHandlersRegistered?: boolean;
};

const REDACTED_VALUE = "[redacted]";
const SENSITIVE_KEY_FRAGMENT = ["authorization", "api_key", "apikey", "secret", "token", "password"];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLangfuseTracingConfigured() {
  const enabledFlag = process.env.LANGFUSE_TRACING_ENABLED;

  if (enabledFlag === "false" || enabledFlag === "0") {
    return false;
  }

  return Boolean(process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY);
}

function shouldRedactKey(key: string) {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEY_FRAGMENT.some((fragment) => normalized.includes(fragment));
}

function maskSensitiveData(data: unknown, depth = 0): unknown {
  if (depth > 4) {
    return data;
  }

  if (typeof data === "string") {
    if (data.startsWith("Bearer ")) {
      return `Bearer ${REDACTED_VALUE}`;
    }

    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item, depth + 1));
  }

  if (isPlainObject(data)) {
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        shouldRedactKey(key) ? REDACTED_VALUE : maskSensitiveData(value, depth + 1)
      ])
    );
  }

  return data;
}

function registerShutdownHandlers() {
  if (globalForLangfuse.__lifestyleShopLangfuseHandlersRegistered) {
    return;
  }

  const shutdown = () => globalForLangfuse.__lifestyleShopLangfuseSdk?.shutdown().catch(() => undefined);

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  globalForLangfuse.__lifestyleShopLangfuseHandlersRegistered = true;
}

function initializeLangfuse() {
  if (!isLangfuseTracingConfigured()) {
    return;
  }

  if (!globalForLangfuse.__lifestyleShopLangfuseSdk) {
    const sdk = new NodeSDK({
      serviceName: "lifestyle-shop-ai-mvp",
      spanProcessors: [
        new LangfuseSpanProcessor({
          publicKey: process.env.LANGFUSE_PUBLIC_KEY,
          secretKey: process.env.LANGFUSE_SECRET_KEY,
          baseUrl: process.env.LANGFUSE_BASE_URL,
          environment: process.env.LANGFUSE_TRACING_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
          release: process.env.LANGFUSE_RELEASE,
          exportMode: process.env.VERCEL ? "immediate" : "batched",
          mask: ({ data }) => maskSensitiveData(data)
        })
      ]
    });

    sdk.start();
    globalForLangfuse.__lifestyleShopLangfuseSdk = sdk;
  }

  registerShutdownHandlers();
}

initializeLangfuse();
