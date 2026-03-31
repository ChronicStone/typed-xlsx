# Docs Rewrite: Technical Amendments

This file records technical corrections and amendments to `plans/docs-rewrite.md` so the rewrite plan matches the current codebase.

## Critical corrections

### 1. Excel-table mode now supports flat `group(...)`

`plans/docs-rewrite.md` still states several times that excel-table mode has no column-group support.

That is no longer correct.

Current state:

- `ExcelTableSchemaBuilder.group(...)` exists
- `ExcelTableSchemaDefinition` carries group ids and group context
- buffered and stream table inputs both accept `context` for excel-table schemas
- flat context-driven column generation works in excel-table mode

Important constraint:

- this is still limited to flat physical columns
- excel-table mode still does not support merged/sub-row body expansion

Pages/sections in the rewrite plan that must be corrected:

- Section 4, Mental model 2: change `Column groups | Yes | No` to reflect flat group support in both modes
- Section 6e (`excel-table-mode/overview.md`): remove `no groups`
- Any decision-guide prose that frames report mode as required for all column groups

Recommended phrasing:

- report tables support column groups and sub-row expansion
- excel tables support flat column groups only

## 2. Formula docs need explicit `row.group(...)` coverage

The rewrite plan correctly identifies the lack of formula-column docs, but it is now incomplete relative to the implemented formula DSL.

Current state:

- `row.ref("columnId")` references a single previously declared column in scope
- inside `group(...)`, formulas can reference:
  - previous outer columns
  - previous local group columns
- later formulas can aggregate a previously declared group with:
  - `row.group("groupId").sum()`
  - `row.group("groupId").average()`
  - `row.group("groupId").min()`
  - `row.group("groupId").max()`
  - `row.group("groupId").count()`

This applies in both report and excel-table modes.

Plan updates required:

- Section 6c (`schema-builder/formula-columns.md`) must add:
  - lexical formula scope rules
  - `row.group(...)` API
  - supported group aggregations
  - unsupported cases: self-reference, future refs, direct typed refs to generated child ids from outside the group
- Section 4, Mental model 3 should mention that formula output differs by mode, but formula scope is lexical and predecessor-based in both modes

## 3. The feature matrix in Section 4 is outdated

Current matrix row:

- `Column groups | Yes | No`

This is wrong now.

Suggested replacement:

- `Column groups | Yes | Yes (flat only)`

The `sub-row expansion` row can remain:

- `Sub-row expansion | Yes | No (throws)`

That pair communicates the real distinction better than the current matrix.

## 4. `formula-columns.md` should not describe unknown refs only as runtime errors

The current plan says:

- `Constraint: unknown column ref throws at output time`

That is incomplete and somewhat misleading.

Current state:

- the public DSL is heavily type-constrained
- most invalid refs are rejected at type level
- runtime errors still exist for mismatches after resolution, but that is not the main user-facing contract

Recommended replacement:

- most invalid refs are rejected by TypeScript at declaration time
- unresolved/invalid references can still throw during output if typing is bypassed or runtime selection/context invalidates the reference target

## 5. Excel-table docs must separate worksheet formulas from table metadata formulas

This is important for technical accuracy in any deep-dive docs.

Current implementation distinguishes two formula representations in excel-table mode:

- worksheet cells use same-row structured refs like `[@[Amount]]`
- native table metadata (`calculatedColumnFormula`) uses a table-formula representation

This distinction should not necessarily dominate user-facing docs, but any technical/reference page that shows exact generated XML or formula strings should acknowledge it.

Recommended scope:

- user-facing overview docs: keep the simple story that excel-table mode uses structured references
- low-level reference docs: note that worksheet-cell formulas and native table calculated-column formulas are serialized differently internally

## 6. `excel-table-mode/overview.md` constraint list is outdated

The current plan says:

- `no groups, no summaries, no sub-row expansion — throws at output time`

Correct it to:

- no report summaries
- no sub-row expansion / merged physical rows
- flat column groups are supported

Also clarify:

- totals rows are the native excel-table alternative to report summaries

## 7. The rewrite plan should mention grouped formula examples in docs and kitchen sink

Per repo guidance, kitchen-sink examples should reflect current user-facing feature surface.

Because grouped formula scope is now a user-facing feature, the rewrite plan should explicitly account for:

- at least one docs example showing `group(...)` plus a later `row.group("...")` formula
- a kitchen-sink example demonstrating grouped formulas in excel-table mode once the native-table serialization path is fully validated

## 8. The `context` asymmetry item in Section 8 is outdated

The current plan says:

- `StreamReportTableInput has it, StreamExcelTableInput does not`

That is no longer correct.

Current state:

- stream excel-table inputs also carry schema group context

This item should be removed or rewritten as:

- document how `context` is required only when selected groups require it, regardless of report vs excel-table mode

## 9. `autoFilter` docs should stay precise about option shape differences

The rewrite plan currently mixes report and excel-table `autoFilter` behavior correctly at a high level, but the implementation detail matters:

- report tables accept `boolean | TableAutoFilterOptions`
- excel tables currently accept `boolean`

If the docs include API tables, keep that distinction explicit.

## 10. Totals-row docs should avoid overstating parity with report summaries

The plan is directionally correct, but the wording should be careful:

- report summaries are explicit summary rows defined in schema column summaries
- excel-table totals rows are native table aggregates configured per column and emitted as Excel table totals metadata/cells

The rewrite should avoid framing totals rows as just another summary API.

## Suggested additions to the plan

### Add to `schema-builder/formula-columns.md`

- formula scope rules table
- `row.group(...)` API reference
- grouped formula examples in both report and excel-table modes

### Add to `core-concepts/schema-modes.md`

- flat groups supported in both modes
- sub-row expansion only in report mode
- totals row vs summary row distinction

### Add to `excel-table-mode/overview.md`

- flat groups supported
- grouped formulas supported
- native table limitations are physical-layout limitations, not a blanket ban on group-driven columns

## Summary of required plan edits

1. Replace all claims that excel-table mode has no `group(...)`
2. Add `row.group(...)` and lexical formula scope to formula docs planning
3. Remove the outdated stream excel-table `context` asymmetry note
4. Update the schema-mode feature matrix to reflect flat group support in excel-table mode
5. Keep totals-row vs summary-row terminology sharply separated
