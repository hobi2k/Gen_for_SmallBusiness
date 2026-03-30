#!/usr/bin/env python3
"""
Simulate file moves and report collisions before applying structural refactors.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

IGNORED_DIRS = {
    ".git",
    ".next",
    ".npm-cache",
    ".turbo",
    ".venv",
    "__pycache__",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "out",
    "target",
    "venv",
}


def load_move_map(path: Path) -> list[dict[str, str]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or "moves" not in data or not isinstance(data["moves"], list):
        raise ValueError("Move map must be a JSON object with a 'moves' array.")
    moves = []
    for item in data["moves"]:
        if not isinstance(item, dict):
            raise ValueError("Each move must be an object.")
        source = item.get("from")
        target = item.get("to")
        if not source or not target:
            raise ValueError("Each move must include 'from' and 'to'.")
        moves.append(
            {
                "from": str(Path(source).as_posix()),
                "to": str(Path(target).as_posix()),
                "reason": item.get("reason", ""),
                "risk": item.get("risk", "low"),
            }
        )
    return moves


def scan_tree(root: Path) -> list[str]:
    paths = []
    for path in root.rglob("*"):
        if any(part in IGNORED_DIRS for part in path.parts):
            continue
        if path.is_file():
            paths.append(path.relative_to(root).as_posix())
    return sorted(paths)


def simulate_moves(root: Path, moves: list[dict[str, str]]) -> dict[str, object]:
    files_before = scan_tree(root)
    existing_files = set(files_before)
    moved_sources = {move["from"] for move in moves}
    target_counter = Counter(move["to"] for move in moves)

    blockers = []
    warnings = []
    for move in moves:
        source = move["from"]
        target = move["to"]
        if source == target:
            warnings.append(f"{source} keeps the same path and does not need to move.")
        if source not in existing_files:
            blockers.append(f"Missing source file: {source}")
        if target_counter[target] > 1:
            blockers.append(f"Multiple moves target the same destination: {target}")
        if target in existing_files and target not in moved_sources:
            blockers.append(f"Destination already exists: {target}")
        if Path(target).is_absolute():
            blockers.append(f"Destination must be relative to the repository root: {target}")
        if ".." in Path(target).parts:
            blockers.append(f"Destination escapes the repository root: {target}")

    future_files = []
    move_lookup = {move["from"]: move["to"] for move in moves}
    for file_path in files_before:
        future_files.append(move_lookup.get(file_path, file_path))
    future_files.sort()

    before_dirs = Counter(str(Path(path).parent) for path in files_before if str(Path(path).parent) != ".")
    after_dirs = Counter(str(Path(path).parent) for path in future_files if str(Path(path).parent) != ".")

    risk = "low"
    if blockers:
        risk = "high"
    elif any(move.get("risk", "low") == "medium" for move in moves) or len(moves) > 5:
        risk = "medium"

    return {
        "root": str(root),
        "move_count": len(moves),
        "moves": moves,
        "blockers": sorted(set(blockers)),
        "warnings": sorted(set(warnings)),
        "before_files": files_before,
        "after_files": future_files,
        "before_dirs": dict(before_dirs),
        "after_dirs": dict(after_dirs),
        "risk_level": risk,
    }


def format_report(result: dict[str, object]) -> str:
    lines = []
    lines.append("## Summary")
    lines.append("")
    lines.append(f"- Reviewed {result['move_count']} proposed file moves.")
    lines.append(f"- Detected {len(result['blockers'])} blockers and {len(result['warnings'])} warnings.")
    lines.append("")

    lines.append("## Moves Reviewed")
    lines.append("")
    for move in result["moves"]:
        detail = f"{move['from']} -> {move['to']}"
        if move.get("reason"):
            detail += f" ({move['reason']})"
        lines.append(f"- {detail}")
    if not result["moves"]:
        lines.append("- No moves supplied.")
    lines.append("")

    lines.append("## Blockers")
    lines.append("")
    if result["blockers"]:
        for blocker in result["blockers"]:
            lines.append(f"- {blocker}")
    else:
        lines.append("- No blocking collisions detected.")
    lines.append("")

    lines.append("## Before / After Structure Comparison")
    lines.append("")
    top_before = sorted(result["before_dirs"].items(), key=lambda item: (-item[1], item[0]))[:10]
    top_after = sorted(result["after_dirs"].items(), key=lambda item: (-item[1], item[0]))[:10]
    lines.append("- Before:")
    for directory, count in top_before:
        lines.append(f"  - {directory}: {count} files")
    lines.append("- After:")
    for directory, count in top_after:
        lines.append(f"  - {directory}: {count} files")
    lines.append("")

    lines.append("## Risk Level")
    lines.append("")
    lines.append(f"- {result['risk_level']}")
    lines.append("")
    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Simulate repository file moves.")
    parser.add_argument("root", help="Repository root")
    parser.add_argument("--move-map", required=True, help="Path to move map JSON")
    parser.add_argument("--json-out", help="Optional path to save the raw simulation result")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()
    move_map = load_move_map(Path(args.move_map).resolve())
    result = simulate_moves(root, move_map)
    if args.json_out:
        Path(args.json_out).write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(format_report(result))
    return 0 if not result["blockers"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
