#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";

function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/+$/, "");
}

function formatBoolean(value) {
  return value ? "yes" : "no";
}

function formatStyleList(recommendations) {
  return recommendations
    .slice(0, 3)
    .map((item, index) => `${index + 1}. ${item.name} (${item.styleId}, ${item.score})`)
    .join("<br/>");
}

function validateImage(image, expectedKind, index) {
  const issues = [];

  if (!image || typeof image !== "object") {
    return [`${expectedKind}[${index}] 항목이 객체가 아닙니다.`];
  }

  if (typeof image.id !== "string" || !image.id) {
    issues.push(`${expectedKind}[${index}].id 누락`);
  }

  if (image.kind !== expectedKind) {
    issues.push(`${expectedKind}[${index}].kind 불일치 (${String(image.kind)})`);
  }

  if (!["1:1", "4:5", "9:16"].includes(image.aspectRatio)) {
    issues.push(`${expectedKind}[${index}].aspectRatio 불일치 (${String(image.aspectRatio)})`);
  }

  if (typeof image.url !== "string" || !image.url.startsWith("data:image/")) {
    issues.push(`${expectedKind}[${index}].url 형식 불일치`);
  }

  if (typeof image.seed !== "number") {
    issues.push(`${expectedKind}[${index}].seed 누락`);
  }

  return issues;
}

function validatePromptVariant(item, bucket, index) {
  const issues = [];

  if (!item || typeof item !== "object") {
    return [`promptBundle.${bucket}[${index}] 항목이 객체가 아닙니다.`];
  }

  if (!["1:1", "4:5", "9:16"].includes(item.aspectRatio)) {
    issues.push(`promptBundle.${bucket}[${index}].aspectRatio 불일치`);
  }

  if (typeof item.prompt !== "string" || item.prompt.length < 20) {
    issues.push(`promptBundle.${bucket}[${index}].prompt 길이 부족`);
  }

  return issues;
}

function validateGeneratedPackage(payload) {
  const issues = [];

  if (!payload || typeof payload !== "object") {
    return {
      valid: false,
      issues: ["응답 본문이 객체가 아닙니다."]
    };
  }

  if (typeof payload.oneLineIntro !== "string" || !payload.oneLineIntro.trim()) {
    issues.push("oneLineIntro 누락");
  }

  if (typeof payload.detailedDescription !== "string" || !payload.detailedDescription.trim()) {
    issues.push("detailedDescription 누락");
  }

  if (typeof payload.shortStoreCopy !== "string" || !payload.shortStoreCopy.trim()) {
    issues.push("shortStoreCopy 누락");
  }

  if (!Array.isArray(payload.keywords) || payload.keywords.length !== 5) {
    issues.push("keywords 길이 불일치");
  }

  if (!Array.isArray(payload.hashtags) || payload.hashtags.length !== 5) {
    issues.push("hashtags 길이 불일치");
  }

  if (!payload.selectedStyle || typeof payload.selectedStyle !== "object") {
    issues.push("selectedStyle 누락");
  } else {
    if (typeof payload.selectedStyle.styleId !== "string" || !payload.selectedStyle.styleId) {
      issues.push("selectedStyle.styleId 누락");
    }

    if (typeof payload.selectedStyle.name !== "string" || !payload.selectedStyle.name) {
      issues.push("selectedStyle.name 누락");
    }
  }

  if (!Array.isArray(payload.representativeImages) || payload.representativeImages.length < 1) {
    issues.push("representativeImages 누락");
  } else {
    payload.representativeImages.forEach((image, index) => {
      issues.push(...validateImage(image, "representative", index));
    });
  }

  if (!Array.isArray(payload.lifestyleImages) || payload.lifestyleImages.length < 1) {
    issues.push("lifestyleImages 누락");
  } else {
    payload.lifestyleImages.forEach((image, index) => {
      issues.push(...validateImage(image, "lifestyle", index));
    });
  }

  if (!payload.promptBundle || typeof payload.promptBundle !== "object") {
    issues.push("promptBundle 누락");
  } else {
    if (!Array.isArray(payload.promptBundle.representative) || !payload.promptBundle.representative.length) {
      issues.push("promptBundle.representative 누락");
    } else {
      payload.promptBundle.representative.forEach((item, index) => {
        issues.push(...validatePromptVariant(item, "representative", index));
      });
    }

    if (!Array.isArray(payload.promptBundle.lifestyle) || !payload.promptBundle.lifestyle.length) {
      issues.push("promptBundle.lifestyle 누락");
    } else {
      payload.promptBundle.lifestyle.forEach((item, index) => {
        issues.push(...validatePromptVariant(item, "lifestyle", index));
      });
    }

    if (
      typeof payload.promptBundle.negativePrompt !== "string" ||
      !payload.promptBundle.negativePrompt.trim()
    ) {
      issues.push("promptBundle.negativePrompt 누락");
    }

    if (typeof payload.promptBundle.copyPrompt !== "string" || !payload.promptBundle.copyPrompt.trim()) {
      issues.push("promptBundle.copyPrompt 누락");
    }

    if (typeof payload.promptBundle.copySchema !== "string" || !payload.promptBundle.copySchema.trim()) {
      issues.push("promptBundle.copySchema 누락");
    }
  }

  if (!payload.generationMeta || typeof payload.generationMeta !== "object") {
    issues.push("generationMeta 누락");
  } else {
    const meta = payload.generationMeta;

    if (typeof meta.uploadToken !== "string" || !meta.uploadToken) {
      issues.push("generationMeta.uploadToken 누락");
    }

    if (typeof meta.seedBase !== "number") {
      issues.push("generationMeta.seedBase 누락");
    }

    if (typeof meta.regenerateCount !== "number") {
      issues.push("generationMeta.regenerateCount 누락");
    }

    if (typeof meta.llmModel !== "string" || !meta.llmModel) {
      issues.push("generationMeta.llmModel 누락");
    }

    if (typeof meta.imageEngine !== "string" || !meta.imageEngine) {
      issues.push("generationMeta.imageEngine 누락");
    }

    if (typeof meta.recommendationFallbackUsed !== "boolean") {
      issues.push("generationMeta.recommendationFallbackUsed 누락");
    }

    if (typeof meta.contentFallbackUsed !== "boolean") {
      issues.push("generationMeta.contentFallbackUsed 누락");
    }

    if (typeof meta.fallbackUsed !== "boolean") {
      issues.push("generationMeta.fallbackUsed 누락");
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `HTTP ${response.status}`;
    const error = new Error(`${url} 요청 실패: ${message}`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

async function evaluateSeed(baseUrl, seed) {
  const topThree = seed.recommendations.slice(0, 3);
  const selectedStyle = topThree[0];

  if (!selectedStyle) {
    return {
      seedId: seed.id,
      title: seed.title,
      categoryLabel: seed.analysis?.categoryLabel ?? "-",
      recommendationFallbackUsed: Boolean(seed.fallbackUsed),
      generationFallbackUsed: null,
      contentFallbackUsed: null,
      schemaValid: false,
      topThreeSummary: "추천 결과 없음",
      selectedStyleName: "-",
      llmModel: "-",
      issues: ["추천 결과가 비어 있습니다."]
    };
  }

  const generated = await fetchJson(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      uploadToken: seed.analysis.uploadToken,
      styleId: selectedStyle.styleId,
      regenerateCount: 0,
      analysis: seed.analysis,
      recommendedStyles: seed.recommendations,
      recommendationFallbackUsed: seed.fallbackUsed
    })
  });

  const schema = validateGeneratedPackage(generated);
  const generationMeta = generated?.generationMeta ?? null;

  return {
    seedId: seed.id,
    title: seed.title,
    categoryLabel: seed.analysis?.categoryLabel ?? "-",
    recommendationFallbackUsed: Boolean(seed.fallbackUsed),
    generationFallbackUsed:
      generationMeta && typeof generationMeta.fallbackUsed === "boolean"
        ? generationMeta.fallbackUsed
        : null,
    contentFallbackUsed:
      generationMeta && typeof generationMeta.contentFallbackUsed === "boolean"
        ? generationMeta.contentFallbackUsed
        : null,
    schemaValid: schema.valid,
    topThreeSummary: formatStyleList(topThree),
    selectedStyleName: generated?.selectedStyle?.name ?? selectedStyle.name,
    llmModel: generationMeta?.llmModel ?? "-",
    issues: schema.issues
  };
}

function buildMarkdownReport({ baseUrl, seeds, rows, generatedAt }) {
  const schemaValidCount = rows.filter((row) => row.schemaValid).length;
  const recommendationFallbackCount = rows.filter((row) => row.recommendationFallbackUsed).length;
  const generationFallbackCount = rows.filter((row) => row.generationFallbackUsed).length;

  const lines = [
    "# Dev Seed Evaluation Report",
    "",
    `- generatedAt: ${generatedAt}`,
    `- baseUrl: ${baseUrl}`,
    `- seedCount: ${seeds.length}`,
    `- schemaValid: ${schemaValidCount}/${rows.length}`,
    `- recommendationFallbackUsed: ${recommendationFallbackCount}/${rows.length}`,
    `- generationFallbackUsed: ${generationFallbackCount}/${rows.length}`,
    "",
    "| Seed | Category | Top 3 Recommendations | Recommendation Fallback | Generation Fallback | Content Fallback | Selected Style | LLM | Schema |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map(
      (row) =>
        `| ${row.title} | ${row.categoryLabel} | ${row.topThreeSummary} | ${formatBoolean(
          row.recommendationFallbackUsed
        )} | ${row.generationFallbackUsed === null ? "-" : formatBoolean(row.generationFallbackUsed)} | ${
          row.contentFallbackUsed === null ? "-" : formatBoolean(row.contentFallbackUsed)
        } | ${row.selectedStyleName} | ${row.llmModel} | ${row.schemaValid ? "pass" : "fail"} |`
    ),
    "",
    "## Schema Issues",
    ""
  ];

  rows.forEach((row) => {
    lines.push(`### ${row.title}`);

    if (!row.issues.length) {
      lines.push("- 없음");
    } else {
      row.issues.forEach((issue) => {
        lines.push(`- ${issue}`);
      });
    }

    lines.push("");
  });

  return lines.join("\n");
}

async function maybeWriteReport(outputPath, report) {
  if (!outputPath) {
    return;
  }

  const absolutePath = path.resolve(outputPath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, report, "utf8");
}

async function main() {
  const { values } = parseArgs({
    options: {
      "base-url": {
        type: "string",
        default: DEFAULT_BASE_URL
      },
      out: {
        type: "string"
      }
    }
  });

  const baseUrl = normalizeBaseUrl(values["base-url"]);

  let payload;

  try {
    payload = await fetchJson(`${baseUrl}/api/dev-seeds`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      [
        "dev seed 평가를 시작하지 못했습니다.",
        `- baseUrl: ${baseUrl}`,
        `- reason: ${message}`,
        "- hint: Next 앱을 실행한 뒤 다시 시도하세요. 예: npm run dev"
      ].join("\n")
    );
    process.exitCode = 1;
    return;
  }

  if (!payload || typeof payload !== "object" || !Array.isArray(payload.seeds)) {
    console.error("`/api/dev-seeds` 응답 형식이 예상과 다릅니다.");
    process.exitCode = 1;
    return;
  }

  const rows = [];

  for (const seed of payload.seeds) {
    rows.push(await evaluateSeed(baseUrl, seed));
  }

  const report = buildMarkdownReport({
    baseUrl,
    seeds: payload.seeds,
    rows,
    generatedAt: new Date().toISOString()
  });

  await maybeWriteReport(values.out, report);
  process.stdout.write(`${report}\n`);
}

void main();
