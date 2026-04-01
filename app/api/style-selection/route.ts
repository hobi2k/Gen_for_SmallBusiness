import { NextResponse } from "next/server";

import { buildStructuredLogPayload, logEvent, summarizeRecommendedStyles } from "@/lib/logging";
import { resolveLangfuseSessionId, withApiRouteObservation } from "@/lib/langfuse";
import { STYLE_PRESETS } from "@/lib/style-presets";
import { ProductAnalysis, StyleId, StyleRecommendation } from "@/lib/types";

export const runtime = "nodejs";

const ROUTE = {
  name: "api.style_selection",
  path: "/api/style-selection",
  method: "POST"
} as const;

export async function POST(request: Request) {
  const body = (await request.json()) as {
    uploadToken?: string;
    styleId?: StyleId;
    analysis?: ProductAnalysis;
    recommendedStyles?: StyleRecommendation[];
    fallbackUsed?: boolean;
  };

  if (!body.styleId || !STYLE_PRESETS[body.styleId]) {
    return NextResponse.json({ error: "유효한 스타일이 아닙니다." }, { status: 400 });
  }

  const styleId = body.styleId;
  const uploadToken = body.analysis?.uploadToken ?? body.uploadToken ?? "unknown-upload";
  const sessionId = resolveLangfuseSessionId(uploadToken);
  const selectedStyle = {
    styleId,
    styleName: STYLE_PRESETS[styleId].name
  };
  const recommendationFallbackUsed = Boolean(body.fallbackUsed);

  return withApiRouteObservation(
    ROUTE,
    {
      input: {
        uploadToken,
        styleId
      },
      context: {
        uploadToken,
        category: body.analysis?.category,
        categoryLabel: body.analysis?.categoryLabel,
        selectedStyleId: selectedStyle.styleId,
        selectedStyleName: selectedStyle.styleName,
        recommendationFallbackUsed,
        fallbackUsed: recommendationFallbackUsed
      }
    },
    async () => {
      await logEvent(
        "style_selected",
        buildStructuredLogPayload({
          route: ROUTE,
          session: {
            strategy: sessionId ? "uploadToken" : "unscoped-request",
            uploadToken: sessionId ? uploadToken : null
          },
          category: {
            value: body.analysis?.category ?? null,
            label: body.analysis?.categoryLabel ?? null
          },
          recommendedStyles: summarizeRecommendedStyles(body.recommendedStyles ?? []),
          selectedStyle,
          generationResult: null,
          regeneration: {
            count: 0,
            isRegenerated: false
          },
          fallback: {
            recommendationUsed: recommendationFallbackUsed,
            contentUsed: null,
            overallUsed: recommendationFallbackUsed
          },
          generatedAt: new Date().toISOString(),
          extra: {
            productSnapshot: body.analysis ?? null
          }
        })
      );

      return NextResponse.json({ ok: true });
    }
  );
}
