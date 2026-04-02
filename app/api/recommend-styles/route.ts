import { NextResponse } from "next/server";

import { buildStructuredLogPayload, logEvent, summarizeRecommendedStyles } from "@/lib/logging";
import {
  resolveLangfuseSessionId,
  syncActiveApiRouteContext,
  withApiRouteObservation
} from "@/lib/langfuse";
import { analyzeProductUpload } from "@/lib/product-analyzer";
import { recommendStyles } from "@/lib/style-recommender";
import { saveUploadedFile } from "@/lib/storage-assets";
import { ProductInputOverrides } from "@/lib/types";
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
  const rawMetadata = formData.get("metadata");

  if (!(uploaded instanceof File)) {
    return NextResponse.json({ error: "상품 이미지를 업로드해 주세요." }, { status: 400 });
  }

  let metadata: Partial<ProductInputOverrides> | undefined;

  if (typeof rawMetadata === "string" && rawMetadata.trim()) {
    try {
      metadata = JSON.parse(rawMetadata) as Partial<ProductInputOverrides>;
    } catch {
      return NextResponse.json({ error: "선택 입력 정보를 해석하지 못했습니다." }, { status: 400 });
    }
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
      const storedImage = await saveUploadedFile(uploaded, uploadToken);
      const analysis = {
        ...(await analyzeProductUpload(uploaded, metadata)),
        uploadToken,
        sourceImageSource: "storage" as const,
        sourceImageRelativePath: storedImage.relativePath,
        sourceImageUrl: storedImage.url
      };
      const recommendationResult = await recommendStyles(analysis);
      const generatedAt = new Date().toISOString();

      syncActiveApiRouteContext(ROUTE, {
        uploadToken: analysis.uploadToken,
        category: analysis.category,
        categoryLabel: analysis.categoryLabel,
        recommendationFallbackUsed: recommendationResult.fallbackUsed,
        fallbackUsed: recommendationResult.fallbackUsed
      }, {
        metadata: {
          analysis: {
            source: analysis.analysisSource
          }
        },
        traceMetadata: {
          analysis_source: analysis.analysisSource
        }
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
            analysis: {
              source: analysis.analysisSource
            },
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
