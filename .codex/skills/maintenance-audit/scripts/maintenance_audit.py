#!/usr/bin/env python3
"""
Generate a maintainability audit report for a repository.
"""

from __future__ import annotations

import argparse
import json
import posixpath
import re
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from duplicate_detection import SUPPORTED_EXTENSIONS, iter_source_files, scan_duplicates

IGNORED_ENTRY_NAMES = {
    "__init__",
    "index",
    "layout",
    "main",
    "page",
    "route",
    "server",
}

SYMBOL_PATTERNS = (
    re.compile(r"^\s*(?:export\s+)?(?:async\s+)?function\s+(?P<name>[A-Za-z_$][\w$]*)\s*\(", re.M),
    re.compile(r"^\s*(?:export\s+)?(?:const|let|var)\s+(?P<name>[A-Za-z_$][\w$]*)\s*=", re.M),
    re.compile(r"^\s*(?:export\s+)?class\s+(?P<name>[A-Za-z_$][\w$]*)\b", re.M),
    re.compile(r"^\s*(?:async\s+def|def|class)\s+(?P<name>[A-Za-z_]\w*)\b", re.M),
)

JS_IMPORT_PATTERNS = (
    re.compile(r"(?m)^\s*import\s+[^'\"]*?\sfrom\s+['\"](?P<spec>[^'\"]+)['\"]"),
    re.compile(r"(?m)^\s*import\s+['\"](?P<spec>[^'\"]+)['\"]"),
    re.compile(r"(?m)^\s*export\s+[^'\"]*?\sfrom\s+['\"](?P<spec>[^'\"]+)['\"]"),
    re.compile(r"require\(\s*['\"](?P<spec>[^'\"]+)['\"]\s*\)"),
)

PY_IMPORT_PATTERNS = (
    re.compile(r"(?m)^\s*from\s+(?P<spec>[.\w]+)\s+import\s+"),
    re.compile(r"(?m)^\s*import\s+(?P<spec>[\w.]+)"),
)

RESPONSIBILITY_STOPWORDS = {
    "api",
    "app",
    "common",
    "component",
    "components",
    "core",
    "helper",
    "helpers",
    "index",
    "lib",
    "page",
    "route",
    "shared",
    "src",
    "test",
    "tests",
    "types",
    "util",
    "utils",
}

UTILITY_HINT_TOKENS = {
    "build",
    "calculate",
    "create",
    "format",
    "get",
    "map",
    "normalize",
    "parse",
    "resolve",
    "serialize",
    "to",
    "transform",
    "validate",
}


@dataclass
class FileAnalysis:
    path: str
    suffix: str
    line_count: int
    imports: list[str]
    declared_symbols: list[str]
    incoming_imports: int = 0


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="utf-8", errors="ignore")


def parse_imports(text: str, suffix: str) -> list[str]:
    patterns = PY_IMPORT_PATTERNS if suffix == ".py" else JS_IMPORT_PATTERNS
    imports: list[str] = []
    for pattern in patterns:
        imports.extend(match.group("spec") for match in pattern.finditer(text))
    return imports


def parse_symbols(text: str) -> list[str]:
    seen: list[str] = []
    for pattern in SYMBOL_PATTERNS:
        for match in pattern.finditer(text):
            name = match.group("name")
            if name not in seen:
                seen.append(name)
    return seen


def analyze_files(root: Path, files: Iterable[Path]) -> tuple[list[FileAnalysis], dict[str, str]]:
    analyses: list[FileAnalysis] = []
    texts: dict[str, str] = {}
    for file_path in files:
        relative = file_path.relative_to(root).as_posix()
        text = read_text(file_path)
        texts[relative] = text
        imports = parse_imports(text, file_path.suffix.lower())
        symbols = parse_symbols(text)
        analyses.append(
            FileAnalysis(
                path=relative,
                suffix=file_path.suffix.lower(),
                line_count=len(text.splitlines()),
                imports=imports,
                declared_symbols=symbols,
            )
        )
    return analyses, texts


def resolve_relative_import(importer: str, spec: str, file_set: set[str]) -> str | None:
    if not spec.startswith("."):
        return None
    importer_path = Path(importer)
    base_dir = importer_path.parent.as_posix()
    candidate = posixpath.normpath(posixpath.join(base_dir, spec))
    if candidate.startswith("../"):
        return None
    candidates = [candidate]
    for suffix in SUPPORTED_EXTENSIONS:
        candidates.append(f"{candidate}{suffix}")
        candidates.append(f"{candidate}/index{suffix}")
    for entry in candidates:
        if entry in file_set:
            return entry
    return None


def build_import_graph(analyses: list[FileAnalysis]) -> None:
    file_set = {analysis.path for analysis in analyses}
    incoming = Counter()
    for analysis in analyses:
        for spec in analysis.imports:
            resolved = resolve_relative_import(analysis.path, spec, file_set)
            if resolved:
                incoming[resolved] += 1
    for analysis in analyses:
        analysis.incoming_imports = incoming[analysis.path]


def directory_depth_issues(analyses: list[FileAnalysis]) -> list[dict[str, object]]:
    counts: Counter[str] = Counter()
    for analysis in analyses:
        directory = str(Path(analysis.path).parent)
        if directory == ".":
            continue
        depth = len(Path(directory).parts)
        if depth > 3:
            counts[directory] += 1
    issues = []
    for directory, file_count in counts.most_common():
        issues.append(
            {
                "path": directory,
                "depth": len(Path(directory).parts),
                "file_count": file_count,
                "risk": "medium" if file_count > 2 else "low",
            }
        )
    return issues


def responsibility_tokens(path: str) -> set[str]:
    stem_tokens = re.findall(r"[A-Za-z0-9]+", Path(path).stem.lower())
    return {token for token in stem_tokens if len(token) > 2 and token not in RESPONSIBILITY_STOPWORDS}


def symbol_overlap(left: list[str], right: list[str]) -> float:
    if not left or not right:
        return 0.0
    left_set = {symbol.lower() for symbol in left}
    right_set = {symbol.lower() for symbol in right}
    return len(left_set & right_set) / max(len(left_set | right_set), 1)


def responsibility_overlaps(analyses: list[FileAnalysis]) -> list[dict[str, object]]:
    overlaps = []
    for index, left in enumerate(analyses):
        left_tokens = responsibility_tokens(left.path)
        if not left_tokens:
            continue
        for right in analyses[index + 1 :]:
            right_tokens = responsibility_tokens(right.path)
            if not right_tokens:
                continue
            shared_tokens = left_tokens & right_tokens
            if not shared_tokens:
                continue
            import_overlap = len(set(left.imports) & set(right.imports))
            score = len(shared_tokens) + symbol_overlap(left.declared_symbols, right.declared_symbols) + min(import_overlap, 2) * 0.2
            if score < 1.2:
                continue
            overlaps.append(
                {
                    "files": [left.path, right.path],
                    "shared_tokens": sorted(shared_tokens),
                    "shared_import_count": import_overlap,
                    "symbol_overlap": round(symbol_overlap(left.declared_symbols, right.declared_symbols), 3),
                    "risk": "medium" if import_overlap or len(shared_tokens) > 1 else "low",
                }
            )
    overlaps.sort(key=lambda item: (-len(item["shared_tokens"]), -item["shared_import_count"], -item["symbol_overlap"]))
    return overlaps[:10]


def dead_code_candidates(analyses: list[FileAnalysis], texts: dict[str, str]) -> dict[str, list[dict[str, object]]]:
    combined_text = "\n".join(texts.values())
    symbol_candidates = []
    for analysis in analyses:
        for symbol in analysis.declared_symbols:
            if len(symbol) < 3:
                continue
            occurrences = len(re.findall(rf"\b{re.escape(symbol)}\b", combined_text))
            if occurrences == 1 and symbol.lower() not in IGNORED_ENTRY_NAMES:
                symbol_candidates.append(
                    {
                        "symbol": symbol,
                        "file": analysis.path,
                        "reason": "Declared symbol appears only once in scanned source files",
                        "confidence": "low",
                    }
                )

    file_candidates = []
    for analysis in analyses:
        stem = Path(analysis.path).stem.lower()
        if analysis.incoming_imports == 0 and stem not in IGNORED_ENTRY_NAMES and not analysis.path.startswith("app/"):
            file_candidates.append(
                {
                    "file": analysis.path,
                    "reason": "No incoming relative imports detected",
                    "confidence": "low",
                }
            )

    return {
        "symbols": symbol_candidates[:12],
        "files": file_candidates[:12],
    }


def common_util_candidates(duplicate_groups: list[dict[str, object]]) -> list[dict[str, object]]:
    opportunities = []
    for group in duplicate_groups:
        names = [member["name"] for member in group["members"] if member["name"]]
        shared_names = [name for name in names if any(token in name.lower() for token in UTILITY_HINT_TOKENS)]
        files = [member["file_path"] for member in group["members"]]
        directories = sorted({str(Path(path).parent) for path in files})
        if len(directories) < 2:
            continue
        label = shared_names[0] if shared_names else group["shared_signature"][0] if group["shared_signature"] else "shared-helper"
        opportunities.append(
            {
                "candidate_name": label,
                "files": files,
                "reason": "Similar helper logic exists in multiple directories",
                "suggested_action": f"Promote shared logic into a common utility module such as `{label}`",
                "risk": "medium",
            }
        )
    return opportunities[:10]


def import_complexity(analyses: list[FileAnalysis]) -> list[dict[str, object]]:
    findings = []
    for analysis in analyses:
        for spec in analysis.imports:
            if analysis.suffix == ".py":
                traversal = len(spec) - len(spec.lstrip("."))
                complexity = traversal
            else:
                traversal = spec.count("../")
                complexity = traversal + max(spec.count("/") - 2, 0)
            if complexity < 2:
                continue
            findings.append(
                {
                    "file": analysis.path,
                    "import": spec,
                    "complexity": complexity,
                    "risk": "medium" if complexity >= 3 else "low",
                }
            )
    findings.sort(key=lambda item: (-item["complexity"], item["file"], item["import"]))
    return findings[:15]


def determine_shared_root(analyses: list[FileAnalysis]) -> str:
    top_dirs = {Path(analysis.path).parts[0] for analysis in analyses if Path(analysis.path).parts}
    if "lib" in top_dirs:
        return "lib/shared"
    if "src" in top_dirs:
        return "src/shared"
    return "shared"


def proposed_structure(analyses: list[FileAnalysis], depth_issues: list[dict[str, object]], util_candidates: list[dict[str, object]]) -> list[str]:
    shared_root = determine_shared_root(analyses)
    suggestions = [
        f"Create or strengthen `{shared_root}` for cross-feature helpers that appear in duplicate groups.",
        "Keep domain-specific logic close to feature entrypoints and avoid generic catch-all files at multiple layers.",
        "Target a maximum source depth of 3 for frequently edited code paths.",
    ]
    if depth_issues:
        suggestions.append("Flatten deep directories before merging logic so path rewrites stay predictable.")
    if util_candidates:
        suggestions.append("Group extracted utility functions by concern, not by migration batch.")
    return suggestions


def build_refactoring_opportunities(
    duplicate_groups: list[dict[str, object]],
    overlaps: list[dict[str, object]],
    depth_issues: list[dict[str, object]],
    util_candidates: list[dict[str, object]],
    import_findings: list[dict[str, object]],
) -> list[dict[str, object]]:
    opportunities = []
    for group in duplicate_groups[:8]:
        files = [member["file_path"] for member in group["members"]]
        opportunities.append(
            {
                "category": "duplicate-logic",
                "description": f"Merge or extract the logic shared by {', '.join(files)}",
                "files": files,
                "risk": "medium" if len(files) > 2 else "low",
            }
        )
    for overlap in overlaps[:5]:
        opportunities.append(
            {
                "category": "overlapping-responsibility",
                "description": f"Re-scope modules with shared responsibility tokens: {', '.join(overlap['shared_tokens'])}",
                "files": overlap["files"],
                "risk": overlap["risk"],
            }
        )
    for issue in depth_issues[:5]:
        opportunities.append(
            {
                "category": "directory-depth",
                "description": f"Flatten `{issue['path']}` from depth {issue['depth']}",
                "files": [issue["path"]],
                "risk": issue["risk"],
            }
        )
    for candidate in util_candidates[:5]:
        opportunities.append(
            {
                "category": "shared-utility",
                "description": candidate["suggested_action"],
                "files": candidate["files"],
                "risk": candidate["risk"],
            }
        )
    for finding in import_findings[:5]:
        opportunities.append(
            {
                "category": "import-complexity",
                "description": f"Simplify import `{finding['import']}` in `{finding['file']}`",
                "files": [finding["file"]],
                "risk": finding["risk"],
            }
        )
    return opportunities


def risk_level(
    duplicate_groups: list[dict[str, object]],
    depth_issues: list[dict[str, object]],
    overlaps: list[dict[str, object]],
    dead_code: dict[str, list[dict[str, object]]],
    import_findings: list[dict[str, object]],
) -> str:
    score = 0
    score += min(len(duplicate_groups), 6)
    score += min(len(depth_issues), 4)
    score += min(len(overlaps), 4)
    score += min(len(dead_code["files"]) + len(dead_code["symbols"]), 4)
    score += min(len(import_findings), 4)
    if score >= 12:
        return "high"
    if score >= 6:
        return "medium"
    return "low"


def summary_lines(
    analyses: list[FileAnalysis],
    duplicate_groups: list[dict[str, object]],
    depth_issues: list[dict[str, object]],
    overlaps: list[dict[str, object]],
    dead_code: dict[str, list[dict[str, object]]],
    util_candidates: list[dict[str, object]],
    import_findings: list[dict[str, object]],
) -> list[str]:
    return [
        f"Scanned {len(analyses)} source files across supported extensions.",
        f"Found {len(duplicate_groups)} duplicate or near-duplicate code groups.",
        f"Flagged {len(depth_issues)} deep directory paths, {len(overlaps)} overlapping module candidates, and {len(import_findings)} complex import paths.",
        f"Captured {len(dead_code['symbols']) + len(dead_code['files'])} dead code candidates and {len(util_candidates)} shared utility opportunities.",
    ]


def problems_found(
    duplicate_groups: list[dict[str, object]],
    depth_issues: list[dict[str, object]],
    overlaps: list[dict[str, object]],
    dead_code: dict[str, list[dict[str, object]]],
    util_candidates: list[dict[str, object]],
    import_findings: list[dict[str, object]],
) -> list[str]:
    lines = []
    if duplicate_groups:
        lines.append(f"Duplicate logic appears in {len(duplicate_groups)} clusters and should be reviewed before adding new features.")
    if depth_issues:
        lines.append(f"{len(depth_issues)} directories exceed the target depth threshold of 3.")
    if overlaps:
        lines.append(f"{len(overlaps)} module pairs show overlapping naming or import patterns.")
    if dead_code["symbols"] or dead_code["files"]:
        lines.append("Unused code signals exist, but they remain low-confidence candidates until validated with search and tests.")
    if util_candidates:
        lines.append(f"{len(util_candidates)} duplicate clusters look extractable into shared utility modules.")
    if import_findings:
        lines.append(f"{len(import_findings)} imports use fragile relative traversal or long paths.")
    return lines or ["No major maintainability issues were detected by the configured heuristics."]


def format_markdown(report: dict[str, object]) -> str:
    lines: list[str] = []
    lines.append("## Summary")
    lines.append("")
    for item in report["summary"]:
        lines.append(f"- {item}")
    lines.append("")

    lines.append("## Problems Found")
    lines.append("")
    for item in report["problems_found"]:
        lines.append(f"- {item}")
    lines.append("")

    lines.append("## Duplicate Code Groups")
    lines.append("")
    if report["duplicate_code_groups"]:
        for group in report["duplicate_code_groups"]:
            files = ", ".join(f"{member['file_path']}:{member['start_line']}-{member['end_line']}" for member in group["members"])
            lines.append(
                f"- {group['group_id']}: similarity {group['average_similarity']}, signature {', '.join(group['shared_signature']) or 'n/a'}, members {files}"
            )
    else:
        lines.append("- No duplicate groups found by the current thresholds.")
    lines.append("")

    lines.append("## Directory Structure Issues")
    lines.append("")
    if report["directory_structure_issues"]:
        for issue in report["directory_structure_issues"]:
            lines.append(f"- {issue['path']} (depth {issue['depth']}, files {issue['file_count']}, risk {issue['risk']})")
    else:
        lines.append("- No directory depth issues found above the threshold.")
    lines.append("")

    lines.append("## Refactoring Opportunities")
    lines.append("")
    if report["refactoring_opportunities"]:
        for item in report["refactoring_opportunities"]:
            lines.append(f"- [{item['risk']}] {item['category']}: {item['description']}")
    else:
        lines.append("- No concrete refactoring opportunities identified.")
    lines.append("")

    lines.append("## Proposed New Structure")
    lines.append("")
    for item in report["proposed_new_structure"]:
        lines.append(f"- {item}")
    lines.append("")

    lines.append("## Risk Level")
    lines.append("")
    lines.append(f"- {report['risk_level']}")
    lines.append("")

    lines.append("## Suggested Next Actions")
    lines.append("")
    for item in report["suggested_next_actions"]:
        lines.append(f"- {item}")
    lines.append("")
    return "\n".join(lines)


def build_report(root: Path) -> dict[str, object]:
    files = list(iter_source_files(root))
    analyses, texts = analyze_files(root, files)
    build_import_graph(analyses)

    duplicate_data = scan_duplicates(root)
    duplicate_groups = duplicate_data["duplicate_groups"]
    depth_issues = directory_depth_issues(analyses)
    overlaps = responsibility_overlaps(analyses)
    dead_code = dead_code_candidates(analyses, texts)
    util_candidates = common_util_candidates(duplicate_groups)
    import_findings = import_complexity(analyses)
    opportunities = build_refactoring_opportunities(
        duplicate_groups,
        overlaps,
        depth_issues,
        util_candidates,
        import_findings,
    )
    current_risk = risk_level(duplicate_groups, depth_issues, overlaps, dead_code, import_findings)

    report = {
        "root": str(root),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": summary_lines(
            analyses,
            duplicate_groups,
            depth_issues,
            overlaps,
            dead_code,
            util_candidates,
            import_findings,
        ),
        "problems_found": problems_found(
            duplicate_groups,
            depth_issues,
            overlaps,
            dead_code,
            util_candidates,
            import_findings,
        ),
        "duplicate_code_groups": duplicate_groups,
        "directory_structure_issues": depth_issues,
        "overlapping_modules": overlaps,
        "dead_code_candidates": dead_code,
        "common_utility_candidates": util_candidates,
        "import_complexity": import_findings,
        "refactoring_opportunities": opportunities,
        "proposed_new_structure": proposed_structure(analyses, depth_issues, util_candidates),
        "risk_level": current_risk,
        "suggested_next_actions": [
            "Validate the highest-similarity duplicate groups first and decide whether to merge or extract them.",
            "Confirm dead code candidates with project-wide search and tests before deleting anything.",
            "Simulate file moves and import rewrites before any structural refactor.",
            "Feed the saved audit JSON into maintenance-apply for approved low-risk changes only.",
        ],
    }
    report["markdown"] = format_markdown(report)
    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a maintainability audit report.")
    parser.add_argument("root", help="Repository root to inspect")
    parser.add_argument("--json-out", help="Optional path to save the machine-readable report as JSON")
    parser.add_argument("--md-out", help="Optional path to save the Markdown report")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()
    report = build_report(root)

    if args.json_out:
        json_path = Path(args.json_out)
        serializable = dict(report)
        serializable.pop("markdown", None)
        json_path.write_text(json.dumps(serializable, indent=2), encoding="utf-8")
    if args.md_out:
        Path(args.md_out).write_text(report["markdown"], encoding="utf-8")

    print(report["markdown"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
