import { NextResponse } from "next/server";

import { buildStructuredLogPayload, logEvent, summarizeRecommendedStyles } from "@/lib/logging";
import {
  resolveLangfuseSessionId,
  syncActiveApiRouteContext,
  withApiRouteObservation
} from "@/lib/langfuse";
import { analyzeProductUpload } from "@/lib/product-analyzer";
import { recommendStyles } from "@/lib/style-recommender";
import { createUploadToken } from "@/lib/utils";

export const runtime = "nodejs";

const ROUTE = {
  name: "api.recommend_styles",
  path: "/api/recommend-styles",
  method: "POST"
} as const;

export async function POST(request: Request) {
  const formData = await request.formData();
  const uploaded = formData.get("file");

  if (!(uploaded instanceof File)) {
    return NextResponse.json({ error: "상품 이미지를 업로드해 주세요." }, { status: 400 });
  }

  const uploadToken = createUploadToken([
    uploaded.name,
    uploaded.size,
    uploaded.type,
    uploaded.lastModified
  ]);
  const sessionId = resolveLangfuseSessionId(uploadToken);

  return withApiRouteObservation(
    ROUTE,
    {
      input: {
        uploadToken,
        fileName: uploaded.name,
        mimeType: uploaded.type,
        fileSize: uploaded.size
      },
      context: {
        uploadToken
      }
    },
    async () => {
      const analysis = await analyzeProductUpload(uploaded);
      const recommendationResult = await recommendStyles(analysis);
      const generatedAt = new Date().toISOString();

      syncActiveApiRouteContext(ROUTE, {
        uploadToken: analysis.uploadToken,
        category: analysis.category,
        categoryLabel: analysis.categoryLabel,
        recommendationFallbackUsed: recommendationResult.fallbackUsed,
        fallbackUsed: recommendationResult.fallbackUsed
      });

      await logEvent(
        "styles_recommended",
        buildStructuredLogPayload({
          route: ROUTE,
          session: {
            strategy: sessionId ? "uploadToken" : "unscoped-request",
            uploadToken: sessionId ? analysis.uploadToken : null
          },
          category: {
            value: analysis.category,
            label: analysis.categoryLabel
          },
          recommendedStyles: summarizeRecommendedStyles(recommendationResult.recommendations),
          selectedStyle: null,
          generationResult: null,
          regeneration: {
            count: 0,
            isRegenerated: false
          },
          fallback: {
            recommendationUsed: recommendationResult.fallbackUsed,
            contentUsed: null,
            overallUsed: recommendationResult.fallbackUsed
          },
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
  );
}
