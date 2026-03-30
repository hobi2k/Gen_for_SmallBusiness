import { NextResponse } from "next/server";

import { DEV_SEEDS } from "@/lib/dev-seeds";
import { recommendStyles } from "@/lib/style-recommender";

export const runtime = "nodejs";

export async function GET() {
  const seeds = await Promise.all(
    DEV_SEEDS.map(async (seed) => {
      const recommendationResult = await recommendStyles(seed.analysis);

      return {
        ...seed,
        recommendations: recommendationResult.recommendations,
        fallbackUsed: recommendationResult.fallbackUsed
      };
    })
  );

  return NextResponse.json({
    seeds
  });
}
