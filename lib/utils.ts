import { AspectRatio } from "@/lib/types";

export function createUploadToken(parts: Array<string | number>): string {
  const raw = parts.join(":");
  return `upl_${hashString(raw).toString(16)}`;
}

export function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

export function cosineSimilarity(left: number[], right: number[]): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }

  if (!leftNorm || !rightNorm) {
    return 0;
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

export function normalizeScore(value: number): number {
  return Number(Math.max(0, Math.min(1, value)).toFixed(3));
}

export function seededAspectRatios(seed: number): AspectRatio[] {
  const patterns: AspectRatio[][] = [
    ["1:1", "4:5", "9:16"],
    ["4:5", "1:1", "9:16"],
    ["1:1", "9:16", "4:5"]
  ];

  return patterns[seed % patterns.length];
}
