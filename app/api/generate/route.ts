import { NextResponse } from "next/server";

import { generateSalesCopy } from "@/lib/content-generator";
import { createGeneratedImages } from "@/lib/image-output";
import { withLangfuseObservation } from "@/lib/langfuse";
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

  return withLangfuseObservation(
    "api.generate_package",
    {
      input: {
        uploadToken: analysis.uploadToken,
        styleId,
        regenerateCount,
        category: analysis.category
      },
      metadata: {
        endpoint: "/api/generate"
      },
      captureOutput: (response) => ({
        status: response.status
      }),
      captureErrorMetadata: () => ({
        endpoint: "/api/generate",
        uploadToken: analysis.uploadToken
      })
    },
    async () => {
      const style = STYLE_PRESETS[styleId];
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
            fallbackUsed: Boolean(body.recommendationFallbackUsed)
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
          recommendationFallbackUsed: Boolean(body.recommendationFallbackUsed),
          contentFallbackUsed,
          fallbackUsed: Boolean(body.recommendationFallbackUsed) || contentFallbackUsed,
          generatedAt: new Date().toISOString()
        }
      };

      await logEvent(
        "package_generated",
        buildStructuredLogPayload({
          uploadIdentifier: analysis.uploadToken,
          recommendedStyles: summarizeRecommendedStyles(body.recommendedStyles ?? []),
          finalSelectedStyle: {
            styleId: selectedStyle.styleId,
            styleName: selectedStyle.name
          },
          generationResult: summarizeGeneratedPackage(result),
          isRegenerated: regenerateCount > 0,
          fallbackUsed: result.generationMeta.fallbackUsed,
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
