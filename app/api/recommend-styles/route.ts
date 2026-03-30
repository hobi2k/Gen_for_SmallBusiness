import { NextResponse } from "next/server";

import { logEvent } from "@/lib/logging";
import { analyzeProductUpload } from "@/lib/product-analyzer";
import { recommendStyles } from "@/lib/style-recommender";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const uploaded = formData.get("file");

  if (!(uploaded instanceof File)) {
    return NextResponse.json({ error: "상품 이미지를 업로드해 주세요." }, { status: 400 });
  }

  const analysis = await analyzeProductUpload(uploaded);
  const recommendations = await recommendStyles(analysis);

  await logEvent("styles_recommended", {
    userInput: analysis,
    selectedStyle: null,
    generatedOutputs: null,
    userSelection: {
      recommendedStyleIds: recommendations.map((item) => item.styleId)
    }
  });

  return NextResponse.json({
    analysis,
    recommendations
  });
}
