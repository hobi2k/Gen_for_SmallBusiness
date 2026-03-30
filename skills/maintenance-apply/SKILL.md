---
name: maintenance-apply
description: Apply an approved maintainability refactoring plan by restructuring directories, consolidating duplicate logic, creating shared utilities, fixing import paths, and removing clearly dead code while preserving behavior. Use only after a `maintenance-audit` report exists and the approved change scope is explicit.
---

# Maintenance Apply

## Overview

Execute a previously approved refactoring plan with safety checks first. Refuse audit-free execution and downgrade high-risk changes to manual application when confidence is not high enough.

## Required Gate

Do not run this skill without a prior `maintenance-audit` artifact.

If the user asks for maintainability changes without an audit:

1. Stop.
2. Ask to run `maintenance-audit` first.
3. Do not infer a broad refactor plan from scratch.

## Workflow

1. Validate the audit report.
   Prefer the JSON file emitted by `maintenance_audit.py --json-out`.
2. Narrow the execution scope.
   Apply only the approved, low-risk subset first.
3. Simulate before editing.
   Use `scripts/file_move_simulation.py` and `scripts/import_path_mapping.py` before moving files or rewriting imports.
4. Apply changes incrementally.
   Merge duplicate logic, create shared utilities, move files, and remove code only when evidence is strong.
5. Preserve behavior.
   Run available tests or type checks after each structural batch whenever feasible.
6. Report the result using the exact output shape below.

## Required Output Shape

Always produce:

- `Change Summary`
- `Changed Files`
- `Before / After Structure Comparison`
- `Updated Import List`
- `Potential Breaking Change`

## Safety Rules

- Refuse audit-free execution.
- Treat `high` audit risk as manual unless the user narrows the scope and explicitly accepts the risk.
- Default to simulation and preview for file moves and import rewrites before touching code.
- Remove dead code only when search results and tests support the deletion.
- Keep changes aligned with the audit plan. If the plan changes materially, return to `maintenance-audit`.

## Bundled Scripts

Use the orchestrator when an audit JSON already exists:

```bash
python3 /absolute/path/to/skills/maintenance-apply/scripts/maintenance_apply.py \
  /path/to/repo \
  --audit-json /tmp/maintenance-audit.json \
  --move-map /tmp/move-map.json
```

Use preview mode first. Only switch to `--mode apply` after the preview is clean and the plan is approved.

Move map format:

```json
{
  "moves": [
    {
      "from": "lib/old-module.ts",
      "to": "lib/shared/new-module.ts",
      "reason": "flatten depth and consolidate shared utility",
      "risk": "low"
    }
  ]
}
```

## Execution Guidance

Use scripts for deterministic structure work and use Codex edits for semantic changes:

1. Use `file_move_simulation.py` to verify that proposed moves do not collide.
2. Use `import_path_mapping.py` to preview import rewrites caused by those moves.
3. Use `maintenance_apply.py` to validate the audit, summarize the batch, and optionally execute low-risk file moves plus import updates.
4. Perform duplicate-function merges, shared utility extraction, and dead code removal in small reviewed batches.
5. If any batch starts touching shared entrypoints or many files, stop and mark it `manual application required`.

## Resources

- `scripts/maintenance_apply.py`: Audit validation, plan summary, and guarded execution for low-risk move/import batches
- `scripts/import_path_mapping.py`: Preview or apply JS and TS relative import rewrites
- `scripts/file_move_simulation.py`: Validate move plans and compare before/after structure safely
