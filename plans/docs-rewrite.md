# Docs Rewrite: Audit & Architecture Proposal

> **Status:** Draft for review — temporary file, delete after decisions are made.

---

## 1. Current Docs Audit

### What exists (23 pages across 7 sections)

| Section          | Pages                                                                                                   | Quality                            |
| ---------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Getting started  | introduction, installation                                                                              | Adequate                           |
| Schema builder   | create-schema, columns, selection, derived-values, summaries, build-schema, cell-styling, column-groups | Mixed — redundancy and gaps        |
| Workbook builder | overview, sheets, tables, output                                                                        | Thin; missing excel-table coverage |
| Streaming        | overview, commit-api, output-targets, memory-tuning, examples                                           | Mostly good                        |
| Performance      | overview, benchmarks, patterns                                                                          | Solid                              |
| Reference        | api-reference, types                                                                                    | Decent but incomplete              |
| Migration        | v0-to-v1                                                                                                | Has a dead internal link           |

### Confirmed gaps

| #   | Gap                                                                                                                                                                                                                                                                                                                              | Severity |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **Formula columns** — zero dedicated page. Mentioned in one paragraph in api-reference.                                                                                                                                                                                                                                          | Critical |
| 2   | **Formula summaries** (`summary.formula()`, shorthand strings `"sum"/"average"/"count"/"min"/"max"`) — not documented anywhere.                                                                                                                                                                                                  | Critical |
| 3   | **`summary.spacer()`** — not documented at all.                                                                                                                                                                                                                                                                                  | Critical |
| 4   | **Excel-table mode** — no dedicated page. Scattered in create-schema.md (2 paragraphs) and api-reference. No coverage of: style, autoFilter default behavior, totals row, structured formula refs, name validation rules.                                                                                                        | Critical |
| 5   | **Totals row** — feature exists (`totalsRow`, per-column `{ label }` / `{ function }`, 7 aggregate functions), not documented.                                                                                                                                                                                                   | Critical |
| 6   | **Structured references** in formula columns for excel-table mode (`[@Qty]`) vs A1 refs in report mode (`C2`) — not explained anywhere.                                                                                                                                                                                          | High     |
| 7   | **`autoFilter` incompatibility with sub-row expansion** — library silently disables it and emits `console.warn`. Not documented.                                                                                                                                                                                                 | High     |
| 8   | **Excel-table name validation** — names must start with letter/underscore, alphanumeric + underscore only. Error thrown at build time. Not documented.                                                                                                                                                                           | High     |
| 9   | **`autoFilter` default asymmetry** — excel-table defaults to `true`, report tables default to `false`. Not documented.                                                                                                                                                                                                           | Medium   |
| 10  | **`derived-values.md`** is almost entirely redundant with `columns.md` — accessor + transform sections duplicated.                                                                                                                                                                                                               | Medium   |
| 11  | **`build-schema.md`** is ~20 meaningful lines — entirely covered by `create-schema.md`.                                                                                                                                                                                                                                          | Medium   |
| 12  | **`workbook-builder/overview.md`** is 30 lines, explains almost nothing about the mental model.                                                                                                                                                                                                                                  | Medium   |
| 13  | **`workbook-builder/tables.md`** — covers report table options but not `BufferedExcelTableInput` / `StreamExcelTableInput` options.                                                                                                                                                                                              | Medium   |
| 14  | **`types.md` → `TableInput`** — describes `id` as a field but it is the first positional argument to `.table(id, input)`, not a field on the input object.                                                                                                                                                                       | Medium   |
| 15  | **Migration guide** — references `/stream-workbook/overview` (dead link).                                                                                                                                                                                                                                                        | Low      |
| 16  | **Landing page** — the core value of the library has shifted with formula columns, excel-table mode, grouped formulas, and streaming. The landing page (hero copy, code examples, feature grid, presented demo) must be fully reworked to reflect the current feature surface. Treat as a separate project tracked in section 9. | Medium   |

---

## 2. Structural Problems in Current Docs

**Problem 1: `derived-values.md` is dead weight.**
90% of it repeats what `columns.md` says about accessor and transform. The only net-new content is a tiny note about `defaultValue`. Should be deleted and absorbed.

**Problem 2: `build-schema.md` is a stub that adds navigation noise.**
`.build()` takes 3 lines to explain. It belongs at the end of the schema builder intro, not as its own page.

**Problem 3: The schema-builder section has no conceptual intro.**
Users arriving at `create-schema.md` immediately hit code without understanding the two modes, why they exist, or which to choose. The mode fork (report vs excel-table) is the most important decision a user makes, but it's buried mid-page.

**Problem 4: Formula columns have no home.**
There is nowhere to read about the formula DSL. A user who sees `formula: ({ row, fx }) => ...` in a kitchen sink example has no docs to look up.

**Problem 5: Summaries page only covers `cell()`.**
`summaries.md` shows `summary.cell()`, `summary.label()`, and `summary.empty()` but never `summary.formula()`, the shorthand strings, or `summary.spacer()`.

**Problem 6: Excel-table mode is treated as a footnote.**
It has native autoFilter, native styled tables, totals rows with 7 aggregate functions, and structured column references in formulas — a first-class feature surface documented as two paragraphs inside `create-schema.md`.

**Problem 7: The workbook-builder section conflates buffered and stream differences poorly.**
`tables.md` and `output.md` mix buffered and stream examples without clearly mapping which options are mode-specific.

---

## 3. Proposed New Docs Architecture

```
1. Getting Started
   1.1 Introduction               (keep, light update)
   1.2 Installation               (keep, light update)
   1.3 Quick start: buffered      (new)
   1.4 Quick start: streaming     (new)

2. Core Concepts                  (new section)
   2.1 Schema modes               (new — report vs excel-table, trade-offs, decision guide)
   2.2 Buffered vs streaming      (replaces workbook-builder/overview.md)
   2.3 Column fundamentals        (consolidates create-schema + columns + derived-values + build-schema)

3. Schema Builder
   3.1 Defining columns           (was: columns + derived-values + build-schema — merged)
   3.2 Formula columns            (new)
   3.3 Summaries                  (expand: add formula(), spacer(), shorthand strings)
   3.4 Column groups              (keep, minor update)
   3.5 Selection                  (keep, minor update)
   3.6 Cell styling               (keep, light update)

4. Excel Table Mode               (new section — promoted from footnote)
   4.1 Overview                   (new)
   4.2 Table styles               (new)
   4.3 Totals row                 (new)
   4.4 AutoFilter                 (new)

5. Workbook Builder
   5.1 Buffered workbook          (was: overview + tables.md, rebuilt)
   5.2 Sheets and layout          (keep, light update)
   5.3 Output                     (keep, light update)

6. Streaming
   6.1 Overview                   (keep, note excel-table parity)
   6.2 Commit API                 (keep)
   6.3 Output targets             (keep)
   6.4 Memory tuning              (keep)
   6.5 Examples                   (keep)

7. Performance
   7.1 Overview                   (keep)
   7.2 Benchmarks                 (keep)
   7.3 Patterns                   (keep)

8. Reference
   8.1 API reference              (expand — formula DSL, summary.formula, spacer, excel-table options)
   8.2 Types                      (fix TableInput discrepancy, add excel-table types)

9. Migration
   9.1 v0 to v1                   (fix dead link only)
```

**Net change:** +8 new pages, −2 deleted pages (`derived-values.md`, `build-schema.md`), 1 new section (`Excel Table Mode`), 1 new section (`Core Concepts`).

---

## 4. Canonical Mental Models

These are the conceptual anchors that should underpin the prose across all pages.

### Mental model 1: Schema is a pure description

A schema is a frozen, reusable description of columns. It has no data. It is built once and shared across as many tables, workbooks, and threads as needed. Schemas do not know about rows — they describe _how_ rows should be interpreted.

### Mental model 2: Two schema kinds, two physical output contracts

|                     | `report`                    | `excel-table`                                   |
| ------------------- | --------------------------- | ----------------------------------------------- |
| Summary rows        | Yes                         | No                                              |
| Column groups       | Yes                         | Yes (flat only)                                 |
| Sub-row expansion   | Yes                         | No (throws)                                     |
| Native table object | No                          | Yes                                             |
| Native AutoFilter   | Manual (`autoFilter: true`) | Automatic (default: on)                         |
| Totals row          | No                          | Yes                                             |
| Formula references  | A1-style (`C2`)             | Structured (`[@Qty]`)                           |
| Style               | Per-cell via `CellStyle`    | Native Excel table style + per-cell `CellStyle` |

### Mental model 3: Formulas are declared, not computed

Formula columns declare _how_ a formula string is assembled at output time. They are not computed during schema building or row planning — the library emits the formula string into the XLSX cell XML. Excel evaluates it on open. The formula DSL is a type-safe builder for that string.

Formula scope is lexical and predecessor-based in both modes: a formula column can only reference columns declared before it in the same schema (or, inside a group, previous columns within that group and outer columns preceding the group). The output formula string differs by mode — A1-style in report mode, structured references in excel-table mode — but the scoping rules are identical.

### Mental model 4: Summaries are stream-safe reducers

Every summary is an `(init, step, finalize)` reducer. `step()` is called once per row per `.commit()` batch — no rows are held. `finalize()` is called once at the end. This is what makes streaming possible. `summary.formula()` emits a range formula (e.g. `SUM(C2:C1001)`) resolved from column range metadata at output time, not from row data.

### Mental model 5: The workbook is a layout engine

The workbook builder is not just a zip wrapper. It places tables on sheets, computes column widths, resolves merge ranges, manages formula row indices, and assembles the OOXML parts. The schema contributes column definitions; the workbook contributes the physical grid position.

---

## 5. Terminology Decisions

| Term               | Decision                                                                                                               | Rationale                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **report table**   | Use for `mode: "report"`                                                                                               | Matches `SchemaKind` in code and existing API type names          |
| **excel table**    | Use for `mode: "excel-table"`                                                                                          | Maps to the Excel concept users already know                      |
| **formula column** | Use for columns with `formula:`                                                                                        | Distinguishes from derived/computed values; signals output intent |
| **summary row**    | Keep for post-data rows produced by `summary:`                                                                         | Already established                                               |
| **totals row**     | Keep for excel-table's built-in aggregate row                                                                          | Matches Excel's native terminology and the field name             |
| **accessor**       | Keep as-is                                                                                                             | Already established                                               |
| **transform**      | Keep as-is                                                                                                             | Already established                                               |
| **column group**   | Keep as-is                                                                                                             | Already established                                               |
| **schema**         | Always mean `SchemaDefinition` (the frozen output of `.build()`)                                                       | Avoid calling the builder itself a "schema"                       |
| **builder**        | Use for fluent objects: `SchemaBuilder`, `ExcelTableSchemaBuilder`, `BufferedWorkbookBuilder`, `StreamWorkbookBuilder` |                                                                   |
| **commit**         | Keep — specific term for the streaming batch operation                                                                 |                                                                   |
| **spool**          | Avoid in user-facing docs — internal implementation detail                                                             |                                                                   |

---

## 6. Dedicated New Pages: Content Spec

### 6a. `core-concepts/schema-modes.md`

- Why two modes exist
- The feature matrix table (section 4 above)
- Decision guide: "use excel-table when you want native Excel filtering/sorting, a built-in totals row, or the Excel table visual style; use report when you need summary rows or sub-row expansion"
- What the mode controls at compile time (formula ref style, constraint validation)
- Code showing both: `createExcelSchema<T>()` and `createExcelSchema<T>({ mode: "excel-table" })`

### 6b. `core-concepts/buffered-vs-streaming.md`

- When each builder is appropriate (threshold framing, not just a row count)
- The memory model difference (in-memory vs spool)
- API shape difference (sync `.table()` vs async `.table()`, no `rows:` in stream)
- What features are available in both (same schema kinds, same formula support, same column groups)

### 6c. `schema-builder/formula-columns.md`

- What formula columns are and why they exist
- `formula: ({ row, fx }) => ...` callback signature
- `row.ref("columnId")` — referencing another column
- `fx` — the formula functions object (`abs`, `round`, `min`, `max`, `if`, `and`, `or`, `not`)
- Arithmetic: `.add()`, `.sub()`, `.mul()`, `.div()`
- Comparison: `.eq()`, `.neq()`, `.gt()`, `.gte()`, `.lt()`, `.lte()`
- Boolean: `.and()`, `.or()`, `.not()`
- `literal(value)` — embedding a constant
- **Formula scope rules:**
  - scope is lexical and predecessor-based: a formula column can only reference columns declared before it
  - inside a `group(...)`, formulas can reference previous outer columns and previous local group columns
  - self-reference, forward references, and referencing child columns generated from a group from outside the group are not supported
- **`row.group(...)` API** (available in both report and excel-table modes):
  - `row.group("groupId").sum()` — sum over all columns in the group
  - `row.group("groupId").average()`
  - `row.group("groupId").min()`
  - `row.group("groupId").max()`
  - `row.group("groupId").count()`
- Output by mode: A1 (`C2`) vs structured reference (`[@Qty]`) — side-by-side example showing the exact XLSX formula string produced
- Constraint: most invalid refs are rejected by TypeScript at declaration time; unresolved or invalid references can still throw during output if typing is bypassed or runtime selection/context invalidates the reference target
- Full worked example: unit price × quantity = total (both modes)
- Grouped formula example: `group(...)` columns with a later `row.group("...")` aggregation formula (both modes)

### 6d. `schema-builder/summaries.md` (expand existing)

Additions to the current page:

- `summary.spacer()` — distinct cell type vs `empty()`; explain the difference
- `summary.formula(fn)` — declares a range formula instead of JS reduction
  - `({ column, fx }) => column.cells().sum()` etc.
  - Available: `.sum()`, `.average()`, `.count()`, `.min()`, `.max()`
  - When to prefer over `cell()`: when you want Excel to recalculate on data change
- Shorthand strings: `"sum"`, `"average"`, `"count"`, `"min"`, `"max"`
- Multi-row summaries: returning an array of definitions
- Note: summaries are report-mode only

### 6e. `excel-table-mode/overview.md`

- What native excel tables are
- `createExcelSchema<T>({ mode: "excel-table" })`
- Constraints vs report mode:
  - no report summaries (totals rows are the native excel-table alternative)
  - no sub-row expansion / merged physical rows — throws at output time
  - flat column groups are supported; merged/sub-row expansion is not
- Schema building is otherwise the same (same `.column()`, same formula support, grouped formulas supported)
- Both buffered and stream builders support excel-table schemas
- `context` is required only when selected groups require it, regardless of report vs excel-table mode

### 6f. `excel-table-mode/table-styles.md`

- `ExcelTableStyle` union: `TableStyleLight*` / `TableStyleMedium*` / `TableStyleDark*`
- Default: `"TableStyleMedium2"`
- Set at table level: `workbook.sheet(...).table("id", { schema, style: "TableStyleLight1" })`

### 6g. `excel-table-mode/totals-row.md`

- `totalsRow: true` at the table level (enables the totals row)
- Per-column `totalsRow` in column definition:
  - `{ label: "Total" }` — static text
  - `{ function: "sum" | "average" | "count" | "countNums" | "min" | "max" | "stdDev" | "var" }` — aggregate
- Worked example: revenue table with SUM on amount, COUNT on id, label on name

### 6h. `excel-table-mode/autofilter.md`

- Report tables: `autoFilter: false` by default; opt in with `autoFilter: true` or `{ enabled: true }`
- Excel tables: `autoFilter: true` by default; opt out with `autoFilter: false`
- Option shape differs: report tables accept `boolean | TableAutoFilterOptions`; excel tables currently accept `boolean` only
- Incompatibility with sub-row expansion: the `console.warn` behavior and why (merged cells break flat filter)
- Excel tables inherently cannot have sub-rows (throws at output time) so this only applies to report tables

---

## 7. Page-by-Page Rewrite Plan

### Pages to delete

| File                                   | Action                                     |
| -------------------------------------- | ------------------------------------------ |
| `2.schema-builder/4.derived-values.md` | Delete — absorb into `defining-columns.md` |
| `2.schema-builder/6.build-schema.md`   | Delete — absorb into `defining-columns.md` |

### Pages to keep with minimal edits

| File                                  | Change                                                              |
| ------------------------------------- | ------------------------------------------------------------------- |
| `1.getting-started/1.introduction.md` | Light update: mention excel-table mode and formula columns          |
| `1.getting-started/2.installation.md` | No changes                                                          |
| `3.workbook-builder/2.sheets.md`      | No changes                                                          |
| `3.workbook-builder/4.output.md`      | No changes                                                          |
| `4.streaming/1.overview.md`           | One sentence: note excel-table schema support parity                |
| `4.streaming/2.commit-api.md`         | No changes                                                          |
| `4.streaming/3.output-targets.md`     | No changes                                                          |
| `4.streaming/4.memory-tuning.md`      | No changes                                                          |
| `4.streaming/5.examples.md`           | No changes                                                          |
| `5.performance/*`                     | No changes                                                          |
| `9.migration/1.v0-to-v1.md`           | Fix dead link (`/stream-workbook/overview` → `/streaming/overview`) |

### Pages to substantially rewrite

**`2.schema-builder/1.create-schema.md` → content moves to `core-concepts/schema-modes.md`**
The current page conflates "how to use the builder" with "what mode to choose." The mode explanation becomes a standalone concept page. The builder usage moves into `defining-columns.md`.

**`2.schema-builder/2.columns.md` + `4.derived-values.md` + `6.build-schema.md` → `schema-builder/defining-columns.md`**
Single page covering: column id and header, accessor (path string and callback), transform, defaultValue, formula (brief intro, link to formula-columns.md), width/autoWidth/minWidth/maxWidth, format, and `.build()`.

**`2.schema-builder/5.summaries.md` → full expansion**
See section 6d. Page doubles in length, gains `formula()`, `spacer()`, and shorthand coverage.

**`3.workbook-builder/1.overview.md` → content moves to `core-concepts/buffered-vs-streaming.md`**
The 30-line overview becomes the authoritative comparison page in core concepts. The workbook-builder section gets a minimal intro page that links to it.

**`3.workbook-builder/3.tables.md` → add excel-table coverage**
Add `BufferedExcelTableInput` options (style, autoFilter, totalsRow, name) and `StreamExcelTableInput` options. Clarify which options are mode-specific.

**`6.reference/1.api-reference.md` → expand**
Add: formula DSL reference table (all `fx.*` functions, all operand methods), `SummaryBuilder.formula()` and `.spacer()` signatures, `ExcelTableStyle` note, `ExcelTableTotalsRowFunction` union.

**`6.reference/2.types.md` → fix + expand**
Fix `TableInput.id` discrepancy (it's a positional arg, not a field). Add `ExcelTableStyle`, `ExcelTableTotalsRowFunction`, `StreamExcelTableInput` shape.

### New pages to write (priority order)

1. `schema-builder/formula-columns.md`
2. `excel-table-mode/overview.md`
3. `excel-table-mode/totals-row.md`
4. `core-concepts/schema-modes.md`
5. `excel-table-mode/table-styles.md`
6. `excel-table-mode/autofilter.md`
7. `core-concepts/buffered-vs-streaming.md`
8. `getting-started/quick-start-buffered.md`
9. `getting-started/quick-start-streaming.md`

---

## 8. Risks, Ambiguities, and Things to Validate Before Writing Prose

| #   | Item                                                                                                                                                                                                 | Action                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | `summary.spacer()` — need to confirm exact behavior vs `empty()` (does it render with summary row styling but no value?)                                                                             | Read `summary/builder.ts` in full                                         |
| 2   | `summary.formula()` with `column.cells()` — confirm exact shape returned and available methods                                                                                                       | Read `summary/runtime.ts` in full                                         |
| 3   | Excel-table + formula column in streaming mode — structured refs are based on `headerLabel` at table creation time. Confirm this is stable when `select` reorders columns.                           | Cross-check `stream.ts:150-162` against `planner/rows.ts:144-154`         |
| 4   | `autoWidth` vs `width` precedence — docs say both exist but don't clarify resolution order                                                                                                           | Read `createPlannerStats` / `updateColumnWidthStats` in `planner/rows.ts` |
| 5   | `ExcelTableStyle` — confirm the full set of valid strings (Light1–21, Medium1–28, Dark1–11)                                                                                                          | Read full `workbook/types.ts`                                             |
| 6   | Multi-table sheet with `tablesPerRow` + excel-table mode — does layout work?                                                                                                                         | Read `internal/layout.ts`                                                 |
| 7   | Dead link in `v0-to-v1.md` — correct replacement path is `/streaming/overview`                                                                                                                       | Trivial fix                                                               |
| 8   | `context` in streaming — both `StreamReportTableInput` and `StreamExcelTableInput` carry group context. Document how `context` is required only when selected groups require it, regardless of mode. | Prose in streaming section and workbook-builder tables page               |
| 9   | `title` field on buffered report tables — renders a row above the header, not shown in any example                                                                                                   | Confirmed in `buffered.ts:55-56`; add an example                          |

---

## 9. Landing Page Rework

The landing page is out of scope for the docs rewrite but must be tracked as a separate project.

**Why:** The core value of the library has shifted. Formula columns, excel-table mode with native styling and totals rows, grouped formulas, and streaming support are all first-class features. None of them are represented on the current landing page. The hero copy, the presented code example, the feature grid, and any demo output all need to be rebuilt from scratch around the current feature surface.

**Scope of the rework:**

- Hero copy — reframe the pitch around the full feature set, not just typed schemas
- Hero / lead code example — replace with something that showcases formula columns, excel-table mode, or a combination of both; the current example is too minimal to convey the library's power
- Feature grid — rewrite every card; add cards for excel-table mode, formula columns, totals rows, grouped formulas, and streaming
- Demo output / screenshot — regenerate from a kitchen-sink example that reflects the current feature surface
- CTA flow — ensure the quick-start links land on updated getting-started pages

**Dependencies:** should be done after the docs rewrite is complete so links and page paths are stable.
