import "server-only";

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { ProductCategory, ReferenceAsset, ReferenceManifest, StyleId } from "@/lib/types";
import { hashString } from "@/lib/utils";

const REFERENCES_ROOT = path.join(process.cwd(), "references");
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const THEME_DIRECTORY_BY_STYLE: Record<StyleId, string> = {
  "modern-minimal": "modern-minimal",
  "natural-wood": "natural-wood",
  "nordic-light": "nordic-light",
  "french-vintage": "french-vintage",
  "cozy-home-cafe": "cozy-home-cafe",
  "japanese-simple-table": "japanese-simple-table"
};

const PRODUCT_PREFIXES: Record<ProductCategory, string[]> = {
  plate: ["plate"],
  bowl: ["bowl"],
  cup: ["cup"],
  glassware: ["glassware", "cup"],
  tray: ["tray"],
  cutlery: ["cutlery"],
  tableware: ["plate", "bowl", "cup", "glassware", "tray", "cutlery"]
};

interface ScannedReferenceFile {
  fileName: string;
  relativePath: string;
}

function normalizeRelativePath(relativePath: string) {
  return relativePath.split(path.sep).join("/");
}

function buildReferenceAssetUrl(relativePath: string) {
  return `/api/reference-asset?path=${encodeURIComponent(normalizeRelativePath(relativePath))}`;
}

function createReferenceAsset(relativePath: string): ReferenceAsset {
  const normalizedPath = normalizeRelativePath(relativePath);

  return {
    id: `ref_${hashString(normalizedPath).toString(16)}`,
    fileName: path.basename(normalizedPath),
    relativePath: normalizedPath,
    url: buildReferenceAssetUrl(normalizedPath)
  };
}

async function scanImageFiles(
  rootPath: string,
  basePath = rootPath
): Promise<ScannedReferenceFile[]> {
  const entries = await readdir(rootPath, { withFileTypes: true });
  const collected: ScannedReferenceFile[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const entryPath = path.join(rootPath, entry.name);

    if (entry.isDirectory()) {
      collected.push(...(await scanImageFiles(entryPath, basePath)));
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();

    if (!IMAGE_EXTENSIONS.has(extension)) {
      continue;
    }

    collected.push({
      fileName: entry.name,
      relativePath: normalizeRelativePath(path.relative(basePath, entryPath))
    });
  }

  return collected.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function emptyProductSamples(): Record<ProductCategory, ReferenceAsset[]> {
  return {
    plate: [],
    bowl: [],
    cup: [],
    glassware: [],
    tray: [],
    cutlery: [],
    tableware: []
  };
}

function emptyThemeSamples(): Record<StyleId, ReferenceAsset[]> {
  return {
    "modern-minimal": [],
    "natural-wood": [],
    "nordic-light": [],
    "french-vintage": [],
    "cozy-home-cafe": [],
    "japanese-simple-table": []
  };
}

function fileStartsWithPrefix(fileName: string, prefixes: string[]) {
  const normalized = fileName.toLowerCase();
  return prefixes.some((prefix) => normalized.startsWith(prefix));
}

export async function getReferenceManifest(): Promise<ReferenceManifest> {
  const rootFiles = await scanImageFiles(REFERENCES_ROOT);
  const productSamples = emptyProductSamples();
  const themeSamples = emptyThemeSamples();

  for (const file of rootFiles) {
    const firstSegment = file.relativePath.split("/")[0];

    if (firstSegment !== "themes") {
      for (const category of ["plate", "bowl", "cup", "tray", "cutlery"] as const) {
        if (fileStartsWithPrefix(file.fileName, PRODUCT_PREFIXES[category])) {
          productSamples[category].push(createReferenceAsset(file.relativePath));
        }
      }

      continue;
    }

    for (const styleId of Object.keys(THEME_DIRECTORY_BY_STYLE) as StyleId[]) {
      const themeDirectory = THEME_DIRECTORY_BY_STYLE[styleId];
      const normalizedPath = file.relativePath.toLowerCase();
      const inThemeDirectory = normalizedPath.startsWith(`themes/${themeDirectory}/`);
      const isThemeRootFallback = normalizedPath.startsWith("themes/") &&
        file.fileName.toLowerCase().startsWith(themeDirectory);

      if (inThemeDirectory || isThemeRootFallback) {
        themeSamples[styleId].push(createReferenceAsset(file.relativePath));
      }
    }
  }

  productSamples.glassware =
    productSamples.glassware.length > 0
      ? productSamples.glassware
      : productSamples.cup.map((asset) => ({
          ...asset,
          id: `${asset.id}_glassware`
        }));

  productSamples.tableware = [
    ...productSamples.plate,
    ...productSamples.bowl,
    ...productSamples.cup,
    ...productSamples.tray,
    ...productSamples.cutlery
  ];

  return {
    productSamples,
    themeSamples
  };
}

export async function getThemeReferencePreviewUrls(styleId: StyleId, limit = 3) {
  const manifest = await getReferenceManifest();
  return manifest.themeSamples[styleId].slice(0, limit).map((asset) => asset.url);
}

export async function getThemeReferenceAssets(styleId: StyleId, limit = 3) {
  const manifest = await getReferenceManifest();
  return manifest.themeSamples[styleId].slice(0, limit);
}

export async function getThemeReferenceThumbnailUrl(styleId: StyleId, seedKey?: string) {
  const manifest = await getReferenceManifest();
  const assets = manifest.themeSamples[styleId];

  if (!assets.length) {
    return null;
  }

  const indexSeed = seedKey ? hashString(`${styleId}:${seedKey}`) : 0;
  return assets[indexSeed % assets.length]?.url ?? null;
}

export async function getProductReferencePreviewUrl(category: ProductCategory, seedKey?: string) {
  const asset = await getProductReferenceAsset(category, seedKey);
  return asset?.url ?? null;
}

export async function getProductReferenceAsset(category: ProductCategory, seedKey?: string) {
  const manifest = await getReferenceManifest();
  const assets = manifest.productSamples[category];

  if (!assets.length) {
    return null;
  }

  const indexSeed = seedKey ? hashString(`${category}:${seedKey}`) : 0;
  return assets[indexSeed % assets.length] ?? null;
}

export async function readReferenceAsset(relativePath: string) {
  const normalizedPath = normalizeRelativePath(relativePath).replace(/^\/+/, "");
  const absolutePath = path.resolve(REFERENCES_ROOT, normalizedPath);
  const normalizedRoot = `${REFERENCES_ROOT}${path.sep}`;

  if (absolutePath !== REFERENCES_ROOT && !absolutePath.startsWith(normalizedRoot)) {
    throw new Error("invalid_reference_path");
  }

  return {
    buffer: await readFile(absolutePath),
    fileName: path.basename(absolutePath),
    absolutePath
  };
}

export function inferReferenceMimeType(fileName: string) {
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
