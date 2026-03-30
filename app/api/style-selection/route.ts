import { NextResponse } from "next/server";

import { buildStructuredLogPayload, logEvent, summarizeRecommendedStyles } from "@/lib/logging";
import { STYLE_PRESETS } from "@/lib/style-presets";
import { ProductAnalysis, StyleId, StyleRecommendation } from "@/lib/types";

export const runtime = "nodejs";

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

  await logEvent(
    "style_selected",
    buildStructuredLogPayload({
      uploadIdentifier: body.analysis?.uploadToken ?? body.uploadToken ?? "unknown-upload",
      recommendedStyles: summarizeRecommendedStyles(body.recommendedStyles ?? []),
      finalSelectedStyle: {
        styleId: body.styleId,
        styleName: STYLE_PRESETS[body.styleId].name
      },
      generationResult: null,
      isRegenerated: false,
      fallbackUsed: Boolean(body.fallbackUsed),
      generatedAt: new Date().toISOString(),
      extra: {
        productSnapshot: body.analysis ?? null
      }
    })
  );

  return NextResponse.json({ ok: true });
}
