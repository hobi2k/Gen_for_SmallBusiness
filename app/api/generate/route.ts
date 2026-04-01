import { NextResponse } from "next/server";

import { generateSalesCopy } from "@/lib/content-generator";
import { createGeneratedImages } from "@/lib/image-output";
import {
  resolveLangfuseSessionId,
  syncActiveApiRouteContext,
  withApiRouteObservation,
  withLangfuseObservation
} from "@/lib/langfuse";
import {
  buildStructuredLogPayload,
  logEvent,
  summarizeGeneratedPackage,
  summarizeRecommendedStyles
} from "@/lib/logging";
import { buildPromptBundle } from "@/lib/prompt-builder";
import { STYLE_PRESETS } from "@/lib/style-presets";
import { ProductAnalysis, StyleId, StyleRecommendation } from "@/lib/types";

export const runtime = "nodejs";

const ROUTE = {
  name: "api.generate_package",
  path: "/api/generate",
  method: "POST"
} as const;

export async function POST(request: Request) {
  const body = (await request.json()) as {
    uploadToken?: string;
    styleId?: StyleId;
    regenerateCount?: number;
    analysis?: ProductAnalysis;
    recommendedStyles?: StyleRecommendation[];
    recommendationFallbackUsed?: boolean;
  };

  if (!body.styleId || !STYLE_PRESETS[body.styleId] || !body.analysis) {
    return NextResponse.json({ error: "생성에 필요한 정보가 부족합니다." }, { status: 400 });
  }

  const styleId = body.styleId;
  const analysis = body.analysis;
  const regenerateCount = body.regenerateCount ?? 0;
  const style = STYLE_PRESETS[styleId];
  const sessionId = resolveLangfuseSessionId(analysis.uploadToken);
  const recommendationFallbackUsed = Boolean(body.recommendationFallbackUsed);
  const baseRouteContext = {
    uploadToken: analysis.uploadToken,
    category: analysis.category,
    categoryLabel: analysis.categoryLabel,
    selectedStyleId: styleId,
    selectedStyleName: style.name,
    recommendationFallbackUsed,
    regenerateCount
  };

  return withApiRouteObservation(
    ROUTE,
    {
      input: {
        uploadToken: analysis.uploadToken,
        styleId,
        regenerateCount,
        category: analysis.category
      },
      context: baseRouteContext
    },
    async () => {
      const promptBundle = buildPromptBundle(style, analysis, regenerateCount);
      const { copy, modelUsed, fallbackUsed: contentFallbackUsed } = await generateSalesCopy({
        product: analysis,
        style,
        promptBundle
      });
      const { representativeImages, lifestyleImages, seedBase } = await withLangfuseObservation(
        "image.package_adapter",
        {
          type: "tool",
          input: {
            styleId,
            regenerateCount
          },
          metadata: {
            engine: "sdxl-controlnet-ipadapter-placeholder"
          },
          captureOutput: (output) => ({
            representativeCount: output.representativeImages.length,
            lifestyleCount: output.lifestyleImages.length,
            seedBase: output.seedBase
          })
        },
        async () =>
          createGeneratedImages({
            styleId,
            product: analysis,
            regenerateCount
          })
      );

      const selectedStyle =
        body.recommendedStyles?.find((item) => item.styleId === style.id) ??
        ({
          styleId: style.id,
          name: style.name,
          summary: style.summary,
          score: 1,
          reason: `${analysis.categoryLabel}에 맞춰 ${style.summary}을 중심으로 생성했습니다.`,
          reasonHighlights: [`${analysis.categoryLabel} 카테고리 적합`, style.copyTone],
          lightingDescription: style.lightingDescription,
          sceneSetup: style.sceneSetup,
          colorTone: style.colorTone,
          promptTemplate: style.promptTemplate,
          promptKeywords: style.promptKeywords,
          thumbnailUrl: "",
          scoreBreakdown: {
            embeddingScore: 1,
            baseHeuristic: 1,
            rerankedScore: 1,
            rerankAdjustments: [],
            fallbackUsed: recommendationFallbackUsed
          }
        } satisfies StyleRecommendation);

      const result = {
        ...copy,
        representativeImages,
        lifestyleImages,
        selectedStyle,
        promptBundle,
        generationMeta: {
          uploadToken: analysis.uploadToken,
          seedBase,
          regenerateCount,
          llmModel: modelUsed,
          imageEngine: "sdxl-controlnet-ipadapter",
          targetLatencyMs: 8000,
          recommendationFallbackUsed,
          contentFallbackUsed,
          fallbackUsed: recommendationFallbackUsed || contentFallbackUsed,
          generatedAt: new Date().toISOString()
        }
      };

      syncActiveApiRouteContext(ROUTE, {
        ...baseRouteContext,
        contentFallbackUsed,
        fallbackUsed: result.generationMeta.fallbackUsed
      });

      await logEvent(
        "package_generated",
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
          recommendedStyles: summarizeRecommendedStyles(body.recommendedStyles ?? []),
          selectedStyle: {
            styleId: selectedStyle.styleId,
            styleName: selectedStyle.name
          },
          generationResult: summarizeGeneratedPackage(result),
          regeneration: {
            count: regenerateCount,
            isRegenerated: regenerateCount > 0
          },
          fallback: {
            recommendationUsed: recommendationFallbackUsed,
            contentUsed: contentFallbackUsed,
            overallUsed: result.generationMeta.fallbackUsed
          },
          generatedAt: result.generationMeta.generatedAt,
          extra: {
            productSnapshot: analysis,
            regenerateCount,
            llmModel: modelUsed
          }
        })
      );

      return NextResponse.json(result);
    }
  );
}
