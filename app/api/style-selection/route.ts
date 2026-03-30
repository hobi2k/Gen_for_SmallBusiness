import { NextResponse } from "next/server";

import { STYLE_PRESETS } from "@/lib/style-presets";
import { logEvent } from "@/lib/logging";
import { ProductAnalysis, StyleId } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    uploadToken?: string;
    styleId?: StyleId;
    analysis?: ProductAnalysis;
  };

  if (!body.styleId || !STYLE_PRESETS[body.styleId]) {
    return NextResponse.json({ error: "유효한 스타일이 아닙니다." }, { status: 400 });
  }

  await logEvent("style_selected", {
    userInput: body.analysis ?? { uploadToken: body.uploadToken },
    selectedStyle: {
      styleId: body.styleId,
      styleName: STYLE_PRESETS[body.styleId].name
    },
    generatedOutputs: null,
    userSelection: {
      finalSelection: body.styleId
    }
  });

  return NextResponse.json({ ok: true });
}
