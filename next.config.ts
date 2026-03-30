import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "@langfuse/otel",
    "@langfuse/tracing",
    "@opentelemetry/exporter-trace-otlp-http",
    "@opentelemetry/sdk-node"
  ]
};

export default nextConfig;
