import { NextResponse } from "next/server";

import { getReferenceManifest } from "@/lib/reference-library";

export const runtime = "nodejs";

export async function GET() {
  const manifest = await getReferenceManifest();

  return NextResponse.json({
    manifest
  });
}
