---
name: maintenance-audit
description: Analyze repository structure to detect duplicate logic, redundant directory depth, overlapping responsibilities, dead code candidates, reusable utility opportunities, and complex import paths. Use when Codex needs a maintainability audit, a safe refactoring plan, a pre-refactor repository review, or a structured report before changing code.
---

# Maintenance Audit

## Overview

Inspect a repository without changing code. Produce a structured maintainability report and, when requested, a machine-readable JSON artifact that `maintenance-apply` can consume later.

## Workflow

1. Confirm the target scope.
   Audit the whole repository unless the user clearly limits the scope.
2. Preserve safety.
   Do not modify code, rename files, or delete anything. Remain in analysis and proposal mode only.
3. Prefer the bundled scripts for repository-wide scans.
   Run `scripts/maintenance_audit.py` to generate the report and use `scripts/duplicate_detection.py` when you need a focused duplicate scan.
4. Read the output critically.
   Treat dead code, overlap, and duplicate findings as candidates, not proof. Call out uncertainty and mark risky recommendations explicitly.
5. Deliver the report in the required section order.
   Keep the output human-readable and preserve the exact headings listed below.

## Required Report Shape

Always produce these sections, in this order:

- `Summary`
- `Problems Found`
- `Duplicate Code Groups`
- `Directory Structure Issues`
- `Refactoring Opportunities`
- `Proposed New Structure`
- `Risk Level`
- `Suggested Next Actions`

## Analysis Expectations

Inspect at least these categories:

1. Duplicate functions or near-duplicate logic clusters
2. Directory depth issues where effective source depth is greater than 3
3. Modules with overlapping responsibilities
4. Dead code candidates and low-confidence unused code suspects
5. Shared utility extraction candidates
6. Import path complexity and fragile relative imports

## Script Usage

Use the main script when the repository is non-trivial:

```bash
python3 /absolute/path/to/skills/maintenance-audit/scripts/maintenance_audit.py \
  /path/to/repo \
  --json-out /tmp/maintenance-audit.json
```

Use the duplicate helper when you only want duplicate groups:

```bash
python3 /absolute/path/to/skills/maintenance-audit/scripts/duplicate_detection.py /path/to/repo
```

Prefer generating both Markdown output and JSON output when a later apply phase is likely. The JSON artifact is the safest input for `maintenance-apply`.

## Safety Rules

- Never edit source files in this skill.
- Never present dead code candidates as safe deletions without proof.
- Mark risky recommendations as `high` risk when they affect entrypoints, shared modules, or many import sites.
- Prefer conservative proposals over aggressive cleanup.
- If the scan quality is weak because of unsupported language patterns or generated code noise, say so directly.

## Handoff To `maintenance-apply`

When the user wants actual changes:

1. Save the audit JSON from `maintenance_audit.py --json-out`.
2. Keep the approved change scope explicit.
3. Pass the audit artifact into `maintenance-apply`.
4. Do not skip the audit stage.

## Resources

- `scripts/maintenance_audit.py`: Repository-wide audit and report generator
- `scripts/duplicate_detection.py`: Standalone duplicate and near-duplicate block clustering
