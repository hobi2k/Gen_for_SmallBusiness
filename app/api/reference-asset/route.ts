import { NextResponse } from "next/server";

import { inferReferenceMimeType, readReferenceAsset } from "@/lib/reference-library";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const relativePath = url.searchParams.get("path");

  if (!relativePath) {
    return NextResponse.json({ error: "레퍼런스 경로가 필요합니다." }, { status: 400 });
  }

  try {
    const asset = await readReferenceAsset(relativePath);

    return new NextResponse(asset.buffer, {
      status: 200,
      headers: {
        "Content-Type": inferReferenceMimeType(asset.fileName),
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400"
      }
    });
  } catch (error) {
    const status = error instanceof Error && error.message === "invalid_reference_path" ? 400 : 404;

    return NextResponse.json({ error: "레퍼런스 파일을 찾을 수 없습니다." }, { status });
  }
}
