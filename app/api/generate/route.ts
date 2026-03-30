import { NextResponse } from "next/server";

import { generateSalesCopy } from "@/lib/content-generator";
import { createGeneratedImages } from "@/lib/image-output";
import { logEvent } from "@/lib/logging";
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
  };

  if (!body.styleId || !STYLE_PRESETS[body.styleId] || !body.analysis) {
    return NextResponse.json({ error: "생성에 필요한 정보가 부족합니다." }, { status: 400 });
  }

  const style = STYLE_PRESETS[body.styleId];
  const regenerateCount = body.regenerateCount ?? 0;
  const promptBundle = buildPromptBundle(style, body.analysis, regenerateCount);
  const { copy, modelUsed } = await generateSalesCopy({
    product: body.analysis,
    style,
    promptBundle
  });
  const { representativeImages, lifestyleImages, seedBase } = createGeneratedImages({
    styleId: body.styleId,
    product: body.analysis,
    regenerateCount
  });

  const selectedStyle: StyleRecommendation = {
    styleId: style.id,
    name: style.name,
    score: 1,
    reason: `${body.analysis.categoryLabel}에 맞춰 ${style.summary}을 중심으로 생성했습니다.`,
    lightingDescription: style.lightingDescription,
    sceneSetup: style.sceneSetup,
    colorTone: style.colorTone,
    promptTemplate: style.promptTemplate
  };

  const result = {
    ...copy,
    representativeImages,
    lifestyleImages,
    selectedStyle,
    promptBundle,
    generationMeta: {
      uploadToken: body.analysis.uploadToken,
      seedBase,
      regenerateCount,
      llmModel: modelUsed,
      imageEngine: "sdxl-controlnet-ipadapter",
      targetLatencyMs: 8000
    }
  };

  await logEvent("package_generated", {
    userInput: body.analysis,
    selectedStyle,
    generatedOutputs: {
      representativeImages: representativeImages.map(({ id, kind, aspectRatio, seed }) => ({
        id,
        kind,
        aspectRatio,
        seed
      })),
      lifestyleImages: lifestyleImages.map(({ id, kind, aspectRatio, seed }) => ({
        id,
        kind,
        aspectRatio,
        seed
      })),
      oneLineIntro: result.oneLineIntro,
      detailedDescription: result.detailedDescription,
      shortStoreCopy: result.shortStoreCopy,
      keywords: result.keywords,
      hashtags: result.hashtags
    },
    userSelection: {
      regenerateCount
    }
  });

  return NextResponse.json(result);
}
