#!/usr/bin/env python3
"""
Preview or apply relative import rewrites caused by file moves.
"""

from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path

from file_move_simulation import IGNORED_DIRS, load_move_map

SUPPORTED_EXTENSIONS = {
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".mjs",
    ".cjs",
}

IMPORT_PATTERNS = (
    re.compile(r"(?m)^\s*import\s+[^'\"]*?\sfrom\s+['\"](?P<spec>[^'\"]+)['\"]"),
    re.compile(r"(?m)^\s*import\s+['\"](?P<spec>[^'\"]+)['\"]"),
    re.compile(r"(?m)^\s*export\s+[^'\"]*?\sfrom\s+['\"](?P<spec>[^'\"]+)['\"]"),
    re.compile(r"require\(\s*['\"](?P<spec>[^'\"]+)['\"]\s*\)"),
)


def iter_source_files(root: Path) -> list[Path]:
    files = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if any(part in IGNORED_DIRS for part in path.parts):
            continue
        if path.suffix.lower() in SUPPORTED_EXTENSIONS:
            files.append(path)
    return sorted(files)


def parse_import_matches(text: str) -> list[tuple[int, int, str]]:
    matches = []
    for pattern in IMPORT_PATTERNS:
        for match in pattern.finditer(text):
            start, end = match.span("spec")
            matches.append((start, end, match.group("spec")))
    matches.sort(key=lambda item: item[0])
    return matches


def candidate_targets(base_path: Path, spec: str) -> list[Path]:
    candidate = (base_path / spec).resolve()
    targets = [candidate]
    for suffix in SUPPORTED_EXTENSIONS:
        targets.append(Path(f"{candidate.as_posix()}{suffix}"))
        targets.append(Path(candidate / f"index{suffix}"))
    return targets


def strip_extension(path: Path) -> str:
    suffix = path.suffix
    if suffix:
        return path.as_posix()[: -len(suffix)]
    return path.as_posix()


def normalize_relative_spec(spec: str) -> str:
    normalized = spec.replace("\\", "/")
    if not normalized.startswith("."):
        normalized = f"./{normalized}"
    return normalized


def relative_spec(from_path: Path, to_path: Path) -> str:
    relative_value = os.path.relpath(to_path, start=from_path.parent)
    relative_value = relative_value.replace("\\", "/")
    return normalize_relative_spec(strip_extension(Path(relative_value)))


def resolve_existing_target(root: Path, importer: Path, spec: str, existing_files: set[str]) -> str | None:
    for candidate in candidate_targets(importer.parent, spec):
        if not candidate.is_relative_to(root):
            continue
        relative_candidate = candidate.relative_to(root).as_posix()
        if relative_candidate in existing_files:
            return relative_candidate
    return None


def build_import_updates(root: Path, move_map: list[dict[str, str]]) -> list[dict[str, object]]:
    move_lookup = {move["from"]: move["to"] for move in move_map}
    source_files = iter_source_files(root)
    existing_files = {path.relative_to(root).as_posix() for path in source_files}
    updates = []

    for file_path in source_files:
        relative_importer = file_path.relative_to(root).as_posix()
        importer_future = root / move_lookup.get(relative_importer, relative_importer)
        text = file_path.read_text(encoding="utf-8")
        for start, end, spec in parse_import_matches(text):
            if not spec.startswith("."):
                continue
            resolved_target = resolve_existing_target(root, file_path, spec, existing_files)
            if not resolved_target:
                continue
            target_future = root / move_lookup.get(resolved_target, resolved_target)
            new_spec = relative_spec(importer_future, target_future)
            if new_spec == spec:
                continue
            line_number = text[:start].count("\n") + 1
            updates.append(
                {
                    "file": relative_importer,
                    "future_file": importer_future.relative_to(root).as_posix(),
                    "line": line_number,
                    "old": spec,
                    "new": new_spec,
                }
            )
    updates.sort(key=lambda item: (item["future_file"], item["line"], item["old"]))
    return updates


def apply_updates(root: Path, updates: list[dict[str, object]], move_map: list[dict[str, str]]) -> list[str]:
    move_lookup = {move["from"]: move["to"] for move in move_map}
    per_file: dict[str, list[dict[str, object]]] = {}
    for update in updates:
        per_file.setdefault(update["file"], []).append(update)

    written_files = []
    for source, file_updates in per_file.items():
        source_path = root / source
        text = source_path.read_text(encoding="utf-8")
        matches = parse_import_matches(text)
        replacements = []
        for update in file_updates:
            for start, end, spec in matches:
                line_number = text[:start].count("\n") + 1
                if spec == update["old"] and line_number == update["line"]:
                    replacements.append((start, end, update["new"]))
                    break
        replacements.sort(key=lambda item: item[0], reverse=True)
        for start, end, new_spec in replacements:
            text = f"{text[:start]}{new_spec}{text[end:]}"

        target_relative = move_lookup.get(source, source)
        target_path = root / target_relative
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_text(text, encoding="utf-8")
        written_files.append(target_relative)
    return sorted(set(written_files))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Preview or apply relative import path rewrites.")
    parser.add_argument("root", help="Repository root")
    parser.add_argument("--move-map", required=True, help="Path to move map JSON")
    parser.add_argument("--mode", choices=("preview", "apply"), default="preview")
    parser.add_argument("--json-out", help="Optional path to save raw import rewrite data")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()
    move_map = load_move_map(Path(args.move_map).resolve())
    updates = build_import_updates(root, move_map)
    if args.json_out:
        Path(args.json_out).write_text(json.dumps(updates, indent=2), encoding="utf-8")
    if args.mode == "apply":
        written_files = apply_updates(root, updates, move_map)
        print("# Updated Files")
        print()
        for file_path in written_files:
            print(f"- {file_path}")
        return 0

    print("# Import Path Mapping")
    print()
    if not updates:
        print("No JS/TS relative import rewrites are required for the supplied move map.")
        return 0
    for update in updates:
        print(f"- {update['future_file']}:{update['line']} `{update['old']}` -> `{update['new']}`")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
