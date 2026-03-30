#!/usr/bin/env python3
"""
Validate an audit artifact and summarize or execute a guarded refactor batch.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from file_move_simulation import load_move_map, simulate_moves
from import_path_mapping import apply_updates, build_import_updates

REQUIRED_AUDIT_KEYS = {
    "summary",
    "problems_found",
    "duplicate_code_groups",
    "directory_structure_issues",
    "refactoring_opportunities",
    "proposed_new_structure",
    "risk_level",
    "suggested_next_actions",
}


def load_audit(path: Path) -> dict[str, object]:
    audit = json.loads(path.read_text(encoding="utf-8"))
    missing = REQUIRED_AUDIT_KEYS - set(audit.keys())
    if missing:
        raise ValueError(f"Audit JSON is missing required keys: {', '.join(sorted(missing))}")
    return audit


def build_report(root: Path, audit: dict[str, object], move_map: list[dict[str, str]] | None) -> dict[str, object]:
    move_result = simulate_moves(root, move_map) if move_map else None
    import_updates = build_import_updates(root, move_map) if move_map else []
    changed_files = []
    if move_map:
        changed_files.extend(move["from"] for move in move_map)
        changed_files.extend(move["to"] for move in move_map)
    changed_files.extend(update["future_file"] for update in import_updates)
    changed_files = sorted(set(changed_files))

    breaking_changes = []
    if audit["risk_level"] == "high":
        breaking_changes.append("Audit risk is high. Automatic application should be treated as manual by default.")
    if move_result and move_result["blockers"]:
        breaking_changes.extend(move_result["blockers"])
    if import_updates:
        breaking_changes.append("Relative import rewrites are required. Review aliasing and barrel files before merging.")
    if not breaking_changes:
        breaking_changes.append("No immediate breaking change signals were detected in preview mode.")

    return {
        "change_summary": [
            f"Audit risk level: {audit['risk_level']}",
            f"Move batch size: {len(move_map) if move_map else 0}",
            f"Previewed import rewrites: {len(import_updates)}",
        ],
        "changed_files": changed_files,
        "before_after": move_result,
        "import_updates": import_updates,
        "potential_breaking_change": breaking_changes,
    }


def format_structure_comparison(move_result: dict[str, object] | None) -> list[str]:
    if not move_result:
        return ["- No file move plan supplied."]

    before_dirs = sorted(move_result["before_dirs"].items(), key=lambda item: (-item[1], item[0]))[:5]
    after_dirs = sorted(move_result["after_dirs"].items(), key=lambda item: (-item[1], item[0]))[:5]
    before_summary = ", ".join(f"{directory} ({count})" for directory, count in before_dirs) or "n/a"
    after_summary = ", ".join(f"{directory} ({count})" for directory, count in after_dirs) or "n/a"

    lines = [
        f"- Moves reviewed: {move_result['move_count']}",
        f"- Before: {before_summary}",
        f"- After: {after_summary}",
    ]
    for warning in move_result["warnings"]:
        lines.append(f"- Warning: {warning}")
    for blocker in move_result["blockers"]:
        lines.append(f"- Blocker: {blocker}")
    return lines


def format_apply_report(report: dict[str, object]) -> str:
    lines = []
    lines.append("## Change Summary")
    lines.append("")
    for item in report["change_summary"]:
        lines.append(f"- {item}")
    lines.append("")

    lines.append("## Changed Files")
    lines.append("")
    if report["changed_files"]:
        for item in report["changed_files"]:
            lines.append(f"- {item}")
    else:
        lines.append("- No changed files are planned.")
    lines.append("")

    lines.append("## Before / After Structure Comparison")
    lines.append("")
    lines.extend(format_structure_comparison(report["before_after"]))
    lines.append("")

    lines.append("## Updated Import List")
    lines.append("")
    if report["import_updates"]:
        for update in report["import_updates"]:
            lines.append(f"- {update['future_file']}:{update['line']} `{update['old']}` -> `{update['new']}`")
    else:
        lines.append("- No import updates are required for the supplied plan.")
    lines.append("")

    lines.append("## Potential Breaking Change")
    lines.append("")
    for item in report["potential_breaking_change"]:
        lines.append(f"- {item}")
    lines.append("")
    return "\n".join(lines)


def execute_plan(root: Path, audit: dict[str, object], move_map: list[dict[str, str]]) -> tuple[list[str], list[dict[str, object]]]:
    if audit["risk_level"] == "high":
        raise RuntimeError("manual application required: audit risk level is high")
    move_result = simulate_moves(root, move_map)
    if move_result["blockers"]:
        raise RuntimeError("manual application required: move simulation reported blockers")

    updates = build_import_updates(root, move_map)
    apply_updates(root, updates, move_map)

    changed_files = {update["future_file"] for update in updates}
    moved_files = []
    for move in move_map:
        source = root / move["from"]
        target = root / move["to"]
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            if source.exists() and source != target:
                source.unlink()
        elif source.exists():
            source.rename(target)
        moved_files.append(move["to"])
        changed_files.add(move["to"])
    return sorted(changed_files | set(moved_files)), updates


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate and optionally apply a guarded maintenance batch.")
    parser.add_argument("root", help="Repository root")
    parser.add_argument("--audit-json", required=True, help="Path to audit JSON from maintenance-audit")
    parser.add_argument("--move-map", help="Optional move map JSON")
    parser.add_argument("--mode", choices=("report", "apply"), default="report")
    parser.add_argument("--json-out", help="Optional path to save the combined preview report")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()
    audit = load_audit(Path(args.audit_json).resolve())
    move_map = load_move_map(Path(args.move_map).resolve()) if args.move_map else None

    if args.mode == "apply":
        if not move_map:
            raise SystemExit("manual application required: --move-map is required for apply mode")
        changed, applied_updates = execute_plan(root, audit, move_map)
        print("## Change Summary")
        print()
        print("- Applied guarded file moves and import rewrites.")
        print()
        print("## Changed Files")
        print()
        for file_path in changed:
            print(f"- {file_path}")
        print()
        print("## Before / After Structure Comparison")
        print()
        print("- Applied according to the supplied move map.")
        print()
        print("## Updated Import List")
        print()
        if applied_updates:
            for update in applied_updates:
                print(f"- {update['future_file']}:{update['line']} `{update['old']}` -> `{update['new']}`")
        else:
            print("- No import updates were required.")
        print("- Review semantic refactors manually for duplicate merges and dead code removal.")
        print()
        print("## Potential Breaking Change")
        print()
        print("- Structural changes were applied. Run tests or type checks immediately.")
        print()
        return 0

    report = build_report(root, audit, move_map)
    if args.json_out:
        Path(args.json_out).write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(format_apply_report(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
