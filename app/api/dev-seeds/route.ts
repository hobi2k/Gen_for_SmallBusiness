import { NextResponse } from "next/server";

import { DEV_SEEDS } from "@/lib/dev-seeds";
import { getProductReferenceAsset } from "@/lib/reference-library";
import { recommendStyles } from "@/lib/style-recommender";

export const runtime = "nodejs";

export async function GET() {
  const seeds = await Promise.all(
    DEV_SEEDS.map(async (seed) => {
      const [recommendationResult, referenceAsset] = await Promise.all([
        recommendStyles(seed.analysis),
        getProductReferenceAsset(seed.analysis.category, seed.id)
      ]);
      const previewUrl = referenceAsset?.url ?? seed.previewUrl;
      const analysis = {
        ...seed.analysis,
        sourceImageSource: referenceAsset ? ("references" as const) : seed.analysis.sourceImageSource,
        sourceImageRelativePath: referenceAsset?.relativePath ?? seed.analysis.sourceImageRelativePath,
        sourceImageUrl: referenceAsset?.url ?? seed.analysis.sourceImageUrl,
        supplementalImages: seed.analysis.supplementalImages ?? []
      };

      return {
        ...seed,
        previewUrl: previewUrl ?? seed.previewUrl,
        analysis,
        recommendations: recommendationResult.recommendations,
        allStyles: recommendationResult.allStyles,
        fallbackUsed: recommendationResult.fallbackUsed
      };
    })
  );

  return NextResponse.json({
    seeds
  });
}
