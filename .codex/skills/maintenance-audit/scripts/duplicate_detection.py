#!/usr/bin/env python3
"""
Detect duplicate and near-duplicate code blocks across a repository.
"""

from __future__ import annotations

import argparse
import difflib
import json
import math
import re
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

SUPPORTED_EXTENSIONS = {
    ".py",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".mjs",
    ".cjs",
}

IGNORED_DIRS = {
    ".git",
    ".next",
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

TOKEN_STOPWORDS = {
    "async",
    "await",
    "class",
    "const",
    "def",
    "else",
    "export",
    "false",
    "for",
    "from",
    "function",
    "if",
    "import",
    "let",
    "new",
    "none",
    "null",
    "return",
    "self",
    "static",
    "this",
    "true",
    "try",
    "var",
    "while",
}

PY_BLOCK_PATTERN = re.compile(r"^(?P<indent>\s*)(?P<kind>async\s+def|def|class)\s+(?P<name>[A-Za-z_]\w*)")
JS_BLOCK_PATTERNS = (
    re.compile(r"^\s*(?:export\s+)?(?:async\s+)?function\s+(?P<name>[A-Za-z_$][\w$]*)\s*\("),
    re.compile(r"^\s*(?:export\s+)?class\s+(?P<name>[A-Za-z_$][\w$]*)\b"),
    re.compile(
        r"^\s*(?:export\s+)?(?:const|let|var)\s+(?P<name>[A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^=]*\)|[A-Za-z_$][\w$]*)\s*=>"
    ),
)


@dataclass
class CodeBlock:
    file_path: str
    name: str
    kind: str
    start_line: int
    end_line: int
    line_count: int
    token_count: int
    signature: tuple[str, ...]
    normalized_text: str

    def short_summary(self) -> dict[str, object]:
        return {
            "file_path": self.file_path,
            "name": self.name,
            "kind": self.kind,
            "start_line": self.start_line,
            "end_line": self.end_line,
            "line_count": self.line_count,
            "token_count": self.token_count,
        }


def iter_source_files(root: Path, extensions: set[str] | None = None) -> Iterable[Path]:
    extensions = extensions or SUPPORTED_EXTENSIONS
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if any(part in IGNORED_DIRS for part in path.parts):
            continue
        if path.suffix.lower() not in extensions:
            continue
        yield path


def strip_comments(text: str, suffix: str) -> str:
    if suffix == ".py":
        text = re.sub(r"(?m)#.*$", "", text)
        text = re.sub(r"'''[\s\S]*?'''", "", text)
        text = re.sub(r'"""[\s\S]*?"""', "", text)
        return text
    text = re.sub(r"/\*[\s\S]*?\*/", "", text)
    text = re.sub(r"(?m)//.*$", "", text)
    return text


def normalize_code(text: str, suffix: str) -> str:
    text = strip_comments(text, suffix)
    text = re.sub(r"'(?:\\.|[^'\\])*'", "'STR'", text)
    text = re.sub(r'"(?:\\.|[^"\\])*"', '"STR"', text)
    text = re.sub(r"\b\d+(?:\.\d+)?\b", "NUM", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip().lower()


def tokenize(text: str) -> list[str]:
    tokens = re.findall(r"[A-Za-z_][A-Za-z0-9_]*", text.lower())
    return [token for token in tokens if token not in TOKEN_STOPWORDS and len(token) > 2]


def build_signature(tokens: list[str], limit: int = 12) -> tuple[str, ...]:
    counts = Counter(tokens)
    ordered = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    return tuple(token for token, _count in ordered[:limit])


def extract_python_blocks(relative_path: str, text: str) -> list[CodeBlock]:
    lines = text.splitlines()
    blocks: list[CodeBlock] = []
    for index, line in enumerate(lines):
        match = PY_BLOCK_PATTERN.match(line)
        if not match:
            continue
        indent = len(match.group("indent").replace("\t", "    "))
        kind = match.group("kind").replace(" ", "_")
        name = match.group("name")
        end = len(lines)
        for cursor in range(index + 1, len(lines)):
            probe = lines[cursor]
            if not probe.strip():
                continue
            next_match = PY_BLOCK_PATTERN.match(probe)
            if next_match:
                next_indent = len(next_match.group("indent").replace("\t", "    "))
                if next_indent <= indent:
                    end = cursor
                    break
        block_text = "\n".join(lines[index:end]).strip()
        normalized = normalize_code(block_text, ".py")
        tokens = tokenize(normalized)
        if len(tokens) < 20 or end - index < 4:
            continue
        blocks.append(
            CodeBlock(
                file_path=relative_path,
                name=name,
                kind=kind,
                start_line=index + 1,
                end_line=end,
                line_count=end - index,
                token_count=len(tokens),
                signature=build_signature(tokens),
                normalized_text=normalized,
            )
        )
    return blocks


def capture_braced_block(lines: list[str], start: int) -> int:
    depth = 0
    saw_brace = False
    for index in range(start, len(lines)):
        for char in lines[index]:
            if char == "{":
                depth += 1
                saw_brace = True
            elif char == "}" and saw_brace:
                depth -= 1
        if saw_brace and depth <= 0:
            return index + 1
    return min(len(lines), start + 80)


def extract_js_blocks(relative_path: str, text: str, suffix: str) -> list[CodeBlock]:
    lines = text.splitlines()
    blocks: list[CodeBlock] = []
    for index, line in enumerate(lines):
        name = None
        kind = "function"
        for pattern in JS_BLOCK_PATTERNS:
            match = pattern.match(line)
            if match:
                name = match.group("name")
                if "class" in pattern.pattern:
                    kind = "class"
                elif "=>" in pattern.pattern:
                    kind = "arrow_function"
                break
        if not name:
            continue
        end = capture_braced_block(lines, index)
        block_text = "\n".join(lines[index:end]).strip()
        normalized = normalize_code(block_text, suffix)
        tokens = tokenize(normalized)
        if len(tokens) < 20 or end - index < 4:
            continue
        blocks.append(
            CodeBlock(
                file_path=relative_path,
                name=name,
                kind=kind,
                start_line=index + 1,
                end_line=end,
                line_count=end - index,
                token_count=len(tokens),
                signature=build_signature(tokens),
                normalized_text=normalized,
            )
        )
    return blocks


def extract_blocks(root: Path, files: Iterable[Path]) -> list[CodeBlock]:
    blocks: list[CodeBlock] = []
    for path in files:
        relative_path = path.relative_to(root).as_posix()
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            text = path.read_text(encoding="utf-8", errors="ignore")
        suffix = path.suffix.lower()
        if suffix == ".py":
            blocks.extend(extract_python_blocks(relative_path, text))
        else:
            blocks.extend(extract_js_blocks(relative_path, text, suffix))
    return blocks


def should_compare(left: CodeBlock, right: CodeBlock) -> bool:
    if left.file_path == right.file_path and left.name == right.name:
        return False
    if min(left.token_count, right.token_count) < 20:
        return False
    ratio = max(left.token_count, right.token_count) / min(left.token_count, right.token_count)
    if ratio > 1.8:
        return False
    shared_signature = set(left.signature) & set(right.signature)
    if len(shared_signature) < 3:
        return False
    return True


def similarity(left: CodeBlock, right: CodeBlock) -> float:
    return difflib.SequenceMatcher(None, left.normalized_text, right.normalized_text).ratio()


def cluster_duplicates(blocks: list[CodeBlock], threshold: float = 0.84) -> list[dict[str, object]]:
    if not blocks:
        return []

    parents = list(range(len(blocks)))

    def find(index: int) -> int:
        while parents[index] != index:
            parents[index] = parents[parents[index]]
            index = parents[index]
        return index

    def union(left: int, right: int) -> None:
        root_left = find(left)
        root_right = find(right)
        if root_left != root_right:
            parents[root_right] = root_left

    bucketed: dict[tuple[int, str], list[int]] = defaultdict(list)
    for index, block in enumerate(blocks):
        length_bucket = int(math.log2(max(block.token_count, 1)))
        signature_head = block.signature[0] if block.signature else "misc"
        bucketed[(length_bucket, signature_head)].append(index)

    compared_pairs: set[tuple[int, int]] = set()
    for (_bucket, _head), indices in bucketed.items():
        for left_position in range(len(indices)):
            for right_position in range(left_position + 1, len(indices)):
                left_index = indices[left_position]
                right_index = indices[right_position]
                pair = (left_index, right_index)
                if pair in compared_pairs:
                    continue
                compared_pairs.add(pair)
                left_block = blocks[left_index]
                right_block = blocks[right_index]
                if not should_compare(left_block, right_block):
                    continue
                if similarity(left_block, right_block) >= threshold:
                    union(left_index, right_index)

    groups: dict[int, list[int]] = defaultdict(list)
    for index in range(len(blocks)):
        groups[find(index)].append(index)

    results: list[dict[str, object]] = []
    for member_indices in groups.values():
        if len(member_indices) < 2:
            continue
        members = [blocks[index] for index in member_indices]
        pair_scores = []
        for left_position in range(len(members)):
            for right_position in range(left_position + 1, len(members)):
                pair_scores.append(similarity(members[left_position], members[right_position]))
        average_similarity = round(sum(pair_scores) / len(pair_scores), 3) if pair_scores else 1.0
        representative = min(members, key=lambda block: (block.file_path, block.start_line))
        results.append(
            {
                "group_id": f"dup-{len(results) + 1}",
                "average_similarity": average_similarity,
                "shared_signature": list(representative.signature[:6]),
                "members": [member.short_summary() for member in sorted(members, key=lambda block: (block.file_path, block.start_line))],
            }
        )

    results.sort(key=lambda item: (-len(item["members"]), -item["average_similarity"]))
    return results


def scan_duplicates(root: Path, extensions: set[str] | None = None) -> dict[str, object]:
    files = list(iter_source_files(root, extensions))
    blocks = extract_blocks(root, files)
    groups = cluster_duplicates(blocks)
    return {
        "root": str(root),
        "file_count": len(files),
        "block_count": len(blocks),
        "duplicate_groups": groups,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Detect duplicate code blocks in a repository.")
    parser.add_argument("root", help="Repository root to scan")
    parser.add_argument(
        "--extensions",
        nargs="*",
        default=None,
        help="Optional extension override, for example: .py .ts .tsx",
    )
    parser.add_argument(
        "--json-out",
        help="Optional path to save raw duplicate detection data as JSON",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()
    extensions = set(args.extensions) if args.extensions else None
    result = scan_duplicates(root, extensions)

    if args.json_out:
        Path(args.json_out).write_text(json.dumps(result, indent=2), encoding="utf-8")

    print("# Duplicate Detection")
    print()
    print(f"- Root: `{result['root']}`")
    print(f"- Files scanned: {result['file_count']}")
    print(f"- Blocks analyzed: {result['block_count']}")
    print(f"- Duplicate groups: {len(result['duplicate_groups'])}")
    print()
    if not result["duplicate_groups"]:
        print("No duplicate groups found above the configured threshold.")
        return 0

    for group in result["duplicate_groups"]:
        print(f"## {group['group_id']}")
        print(f"- Average similarity: {group['average_similarity']}")
        print(f"- Shared signature: {', '.join(group['shared_signature']) or 'n/a'}")
        for member in group["members"]:
            print(
                f"- {member['file_path']}:{member['start_line']}-{member['end_line']} "
                f"({member['kind']} {member['name']}, {member['line_count']} lines)"
            )
        print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
