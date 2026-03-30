import { NextResponse } from "next/server";

import { buildStructuredLogPayload, logEvent, summarizeRecommendedStyles } from "@/lib/logging";
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
  const recommendationResult = await recommendStyles(analysis);
  const generatedAt = new Date().toISOString();

  await logEvent(
    "styles_recommended",
    buildStructuredLogPayload({
      uploadIdentifier: analysis.uploadToken,
      recommendedStyles: summarizeRecommendedStyles(recommendationResult.recommendations),
      finalSelectedStyle: null,
      generationResult: null,
      isRegenerated: false,
      fallbackUsed: recommendationResult.fallbackUsed,
      generatedAt,
      extra: {
        productSnapshot: analysis,
        allStyleScores: recommendationResult.allStyles.map((item) => ({
          styleId: item.styleId,
          score: item.score,
          rerankAdjustments: item.scoreBreakdown.rerankAdjustments
        }))
      }
    })
  );

  return NextResponse.json({
    analysis,
    recommendations: recommendationResult.recommendations,
    allStyles: recommendationResult.allStyles,
    fallbackUsed: recommendationResult.fallbackUsed
  });
}
