import { NextResponse } from "next/server";

import { inferStorageMimeType, readStorageAsset } from "@/lib/storage-assets";

export const runtime = "nodejs";

function workerBaseUrl() {
  return process.env.IMAGE_WORKER_URL?.trim() ?? "";
}

function isImageWorkerProxyConfigured() {
  return process.env.IMAGE_WORKER_ENABLED === "true" && Boolean(workerBaseUrl());
}

async function fetchRemoteAsset(relativePath: string) {
  const token = process.env.IMAGE_WORKER_TOKEN?.trim();
  const response = await fetch(
    `${workerBaseUrl().replace(/\/+$/, "")}/asset?path=${encodeURIComponent(relativePath)}`,
    {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      cache: "no-store"
    }
  );

  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const relativePath = url.searchParams.get("path");

  if (!relativePath) {
    return NextResponse.json({ error: "스토리지 경로가 필요합니다." }, { status: 400 });
  }

  try {
    const asset = await readStorageAsset(relativePath);

    return new NextResponse(asset.buffer, {
      status: 200,
      headers: {
        "Content-Type": inferStorageMimeType(asset.fileName),
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_storage_path") {
      return NextResponse.json({ error: "스토리지 경로가 올바르지 않습니다." }, { status: 400 });
    }

    if (isImageWorkerProxyConfigured()) {
      try {
        const remoteResponse = await fetchRemoteAsset(relativePath);

        if (remoteResponse.ok) {
          const contentType =
            remoteResponse.headers.get("Content-Type") ?? inferStorageMimeType(relativePath);

          return new NextResponse(await remoteResponse.arrayBuffer(), {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "no-store"
            }
          });
        }
      } catch {
        return NextResponse.json(
          { error: "원격 생성 이미지를 가져오는 중 오류가 발생했습니다." },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({ error: "스토리지 파일을 찾을 수 없습니다." }, { status: 404 });
  }
}
