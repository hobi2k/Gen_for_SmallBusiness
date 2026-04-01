import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const STORAGE_ROOT = path.join(process.cwd(), "storage");
const UPLOADS_ROOT = path.join(STORAGE_ROOT, "uploads");
const GENERATED_ROOT = path.join(STORAGE_ROOT, "generated");

function normalizeRelativePath(relativePath: string) {
  return relativePath.split(path.sep).join("/");
}

function safeStoragePath(relativePath: string) {
  const normalizedRelativePath = normalizeRelativePath(relativePath).replace(/^\/+/, "");
  const absolutePath = path.resolve(STORAGE_ROOT, normalizedRelativePath);
  const normalizedRoot = `${STORAGE_ROOT}${path.sep}`;

  if (absolutePath !== STORAGE_ROOT && !absolutePath.startsWith(normalizedRoot)) {
    throw new Error("invalid_storage_path");
  }

  return {
    normalizedRelativePath,
    absolutePath
  };
}

function extensionFromFile(file: File) {
  const explicitExtension = path.extname(file.name).toLowerCase();

  if (explicitExtension) {
    return explicitExtension;
  }

  switch (file.type) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    default:
      return ".bin";
  }
}

export function buildStorageAssetUrl(relativePath: string) {
  return `/api/storage-asset?path=${encodeURIComponent(normalizeRelativePath(relativePath))}`;
}

export async function saveUploadedFile(file: File, uploadToken: string) {
  const extension = extensionFromFile(file);
  const relativePath = normalizeRelativePath(path.join("uploads", `${uploadToken}${extension}`));
  const { absolutePath } = safeStoragePath(relativePath);
  const buffer = Buffer.from(await file.arrayBuffer());

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  return {
    relativePath,
    absolutePath,
    url: buildStorageAssetUrl(relativePath)
  };
}

export function resolveStorageAbsolutePath(relativePath: string) {
  return safeStoragePath(relativePath).absolutePath;
}

export async function readStorageAsset(relativePath: string) {
  const { absolutePath } = safeStoragePath(relativePath);

  return {
    buffer: await readFile(absolutePath),
    fileName: path.basename(absolutePath),
    absolutePath
  };
}

export function inferStorageMimeType(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();

  switch (extension) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

export function getGeneratedRootPath() {
  return GENERATED_ROOT;
}

export function getStorageRootPath() {
  return STORAGE_ROOT;
}

