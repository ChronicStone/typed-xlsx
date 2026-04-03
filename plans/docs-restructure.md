# Docs Restructure Plan

> Deep audit of the documentation: structure, redundancy, drift, naming, and proposed reorganization.

---

## Part 1 — Current State Diagnosis

### 1.1 Current Nav Tree

```
Getting Started         (4 pages)
  Introduction            12 chars
  Installation            12 chars
  Quick Start             11 chars
  Comparison              10 chars

Core Concepts           (3 pages)
  Schema Modes            12 chars
  Buffered vs Streaming   21 chars  ← outlier
  Schema Context          14 chars

Schema Builder          (10 pages) ← bloated, 2 files share prefix "4."
  Defining Columns        16 chars
  Summaries                9 chars
  Groups                   6 chars  ← outlier
  Dynamic Columns         15 chars  ← file prefix collision with Selection
  Column Selection        16 chars  ← file prefix collision with Dynamic Columns
  Styling Overview        16 chars
  Base Styles             11 chars
  Dynamic Styles          14 chars
  Conditional Styles      18 chars
  Data Validation         15 chars
  Hyperlinks              10 chars

Formulas                (5 pages)
  Formula Columns         15 chars
  Row Model                9 chars
  Formula Reference       17 chars
  Summary Formulas        16 chars
  Scope and Modes         15 chars

Excel Table Mode        (4 pages)
  Overview                 8 chars  ← ambiguous
  Table Styles            12 chars
  Totals Row              10 chars
  AutoFilter              10 chars  ← too thin (86 lines, 1 boolean flag)

Workbook Builder        (3 pages)
  Buffered Workbook       17 chars
  Sheets                   6 chars  ← outlier
  Output                   6 chars  ← too thin (86 lines, 3 method sigs)

Streaming               (5 pages)
  Overview                 8 chars  ← ambiguous
  Commit API              10 chars
  Output Targets          14 chars
  Memory Tuning           13 chars
  Examples                 8 chars

Performance             (3 pages)
  Overview                 8 chars  ← ambiguous
  Benchmarks              10 chars  ← too thin (79 lines, 1 table)
  Patterns                 8 chars

Reference               (2 pages)
  API Reference           13 chars
  Types                    5 chars  ← outlier

Migration               (2 pages)
  v0 → v1                  7 chars
  v1 → v2                  7 chars
```

**Total: 10 sections, 41 pages**

### 1.2 Structural Problems

| #   | Problem                                                                                                                                                                                      | Severity |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | **Duplicate file prefix** — `3.schema-builder/4.dynamic-columns.md` and `3.schema-builder/4.selection.md` both use prefix `4.`, causing nondeterministic nav order                           | Critical |
| 2   | **Schema Builder has 10 sub-pages** — too many items in one section, mixing column features (columns, groups, dynamic, selection) with orthogonal concerns (styling, validation, hyperlinks) | High     |
| 3   | **3 pages titled "Overview"** — sections 5, 7, 8 all have `1.overview.md`. Ambiguous in search and breadcrumbs                                                                               | Medium   |
| 4   | **Label size variance** — ranges from 5 chars ("Types") to 21 chars ("Buffered vs Streaming"). Siblings like "Groups" (6) vs "Conditional Styles" (18) look lopsided in the sidebar          | Medium   |
| 5   | **"Groups" vs "Column Groups"** — filename says `column-groups` but title says "Groups". Inconsistent with sibling naming                                                                    | Low      |

### 1.3 Redundancy Map

| Content                                           | Repeated In                                                                                                                 | Action                                                                                                                                                                 |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Report vs table mode comparison table**         | Core Concepts > Schema Modes, Excel Table Mode > Overview, Formulas > Scope and Modes                                       | Canonicalize in Schema Modes, cross-link elsewhere                                                                                                                     |
| **Buffered vs streaming decision**                | Core Concepts > Buffered vs Streaming, Streaming > Overview, Performance > Overview                                         | Canonicalize in one place, cross-link from the other two                                                                                                               |
| **A1 vs structured reference explanation + code** | Schema Modes, Scope and Modes, Excel Table Mode Overview                                                                    | Canonicalize in Scope and Modes, cross-link from schema modes & table mode                                                                                             |
| **Install snippet**                               | Installation, Quick Start                                                                                                   | Remove from Quick Start, link to Installation                                                                                                                          |
| **`select` API explanation**                      | Schema Builder > Selection, Workbook Builder > Buffered Workbook                                                            | Keep in Selection, add cross-link from Buffered Workbook                                                                                                               |
| **Output methods** (`toBuffer`, `toFile`, etc.)   | Workbook Builder > Output (dedicated page), Workbook Builder > Buffered Workbook, Streaming > Output Targets, API Reference | Kill the thin Output page, keep in Buffered Workbook + API Reference                                                                                                   |
| **Summary system**                                | Schema Builder > Summaries, Formulas > Summary Formulas, Excel Table Mode > Totals Row                                      | These are genuinely different (reducer vs formula vs native). But the line between Summaries and Summary Formulas is unclear — they should reference each other better |

### 1.4 Pages Too Thin for Their Own Page

| Page       | Lines | Content                    | Recommendation                   |
| ---------- | ----: | -------------------------- | -------------------------------- |
| AutoFilter |    86 | 1 boolean flag + 1 example | Merge into Table Mode overview   |
| Output     |    86 | 3 method signatures        | Merge into Buffered Workbook     |
| Benchmarks |    79 | 1 rough throughput table   | Merge into Performance main page |

### 1.5 Documentation Drift (Docs vs Implementation)

| #   | Issue                                                                                             | Severity |
| --- | ------------------------------------------------------------------------------------------------- | -------- |
| 1   | `CellValue` type declaration missing array variant (`PrimitiveCellValue[]`)                       | Critical |
| 2   | `TableInput` missing `theme`, `autoFilter`, `render` fields in docs                               | Critical |
| 3   | `StreamTableInput` missing `title`, `theme`, `name`, `style`, `autoFilter`, `totalsRow`, `render` | Critical |
| 4   | `WorkbookStreamOptions` missing `protection` field                                                | Critical |
| 5   | `TableStyleDefaults` missing `title`, `groupHeader`, `groupHeaderFiller`, `cells.hyperlink` slots | High     |
| 6   | `AlignmentStyle` missing `shrinkToFit`, `textRotation`, `indent`, `readingOrder`                  | High     |
| 7   | `SummaryDefinition` missing `formula`, `spacer`, `conditionalStyle` members                       | High     |
| 8   | `render: { groupHeaders }` option completely undocumented                                         | High     |
| 9   | Schema-level `.theme()` builder method undocumented                                               | High     |
| 10  | `enabled` field on `WorkbookProtectionOptions` and `SheetProtectionOptions` undocumented          | Medium   |
| 11  | `tempDirectory` stream option not mentioned in Memory Tuning                                      | Medium   |
| 12  | `BorderEdge` vs `BorderSideStyle` naming mismatch in types page                                   | Low      |
| 13  | ~16 exported types completely undocumented in Reference                                           | Medium   |

### 1.6 Undocumented Features

| Feature                                  | Where in Code              | Current Doc Status                |
| ---------------------------------------- | -------------------------- | --------------------------------- |
| `render: { groupHeaders: true }`         | `workbook/types.ts:58-60`  | Not documented anywhere           |
| Schema `.theme()` method                 | `schema/builder.ts`        | Not documented                    |
| `spreadsheetThemes.*.slot()`             | Theme API                  | Not documented                    |
| `cells.hyperlink` style default          | `workbook/types.ts:51`     | Not in TableStyleDefaults docs    |
| Full `ExcelTableStyle` preset list (60+) | `workbook/types.ts:62-117` | Mentioned in examples, not listed |
| `TableAutoFilterOptions` object form     | `workbook/types.ts:26-28`  | Only boolean form documented      |

### 1.7 Missing Cross-Links

19 pages have zero inbound cross-links (only reachable via sidebar nav):
Buffered Workbook, Sheets, Output, Commit API, Output Targets, Streaming Examples, Performance (all 3), Types, Migration v1→v2, Base Styles, Conditional Styles, Data Validation, Hyperlinks, Table Styles, AutoFilter.

---

## Part 2 — Proposed New Structure

### Design Principles

1. **Uniform label lengths** — target 10-18 chars per page title, 12-16 chars per section title
2. **One canonical location per concept** — use cross-links (`[see X](/path)`) instead of re-explaining
3. **Max ~6 sub-pages per section** — if more, split the section
4. **Every page reachable by cross-link** from at least one other page
5. **No ambiguous titles** — no bare "Overview" or "Examples"
6. **Thin pages merged** — no page under ~100 lines of real content

### Proposed Nav Tree

```
1. Getting Started                    (section: 15 chars)
   ├── 1. Introduction                  12 chars  (keep)
   ├── 2. Installation                  12 chars  (keep)
   ├── 3. Quick Start                   11 chars  (keep, remove install snippet)
   └── 4. Comparison                    10 chars  (keep)

2. Core Concepts                      (section: 13 chars)
   ├── 1. Schema Modes                  12 chars  (keep, make canonical for report vs table comparison)
   ├── 2. Schema Context                14 chars  (move up — more foundational than execution model)
   └── 3. Execution Model               15 chars  (merge "Buffered vs Streaming" into this, rename)

3. Columns                            (section: 7 chars → rename from "Schema Builder")
   ├── 1. Defining Columns              16 chars  (keep)
   ├── 2. Column Groups                 13 chars  (rename from "Groups" for consistency)
   ├── 3. Dynamic Columns               15 chars  (keep)
   ├── 4. Column Selection              16 chars  (fix prefix collision, keep)
   └── 5. Summaries                     9 chars   (keep — rename to "Summary Rows" 12 chars)

4. Styling                            (section: 7 chars → extract from Schema Builder)
   ├── 1. Themes                         6 chars  (extract from Styling Overview — dedicated theme docs)
   ├── 2. Cell Styles                   11 chars  (merge Base Styles + Styling Overview basics)
   ├── 3. Dynamic Styles                14 chars  (keep)
   └── 4. Conditional Styles            18 chars  (keep — rename to "Conditional CF" 14 chars)

5. Formulas                           (section: 8 chars)
   ├── 1. Formula Columns               15 chars  (keep)
   ├── 2. Row Model                      9 chars  (keep)
   ├── 3. Summary Formulas              16 chars  (keep)
   ├── 4. Scope & References            18 chars  (merge "Scope and Modes" + "Formula Reference")
   └──                                            (was 5 pages → 4 pages, denser)

6. Excel Tables                       (section: 12 chars → rename from "Excel Table Mode")
   ├── 1. Table Mode                    10 chars  (rename from "Overview", absorb AutoFilter content)
   ├── 2. Table Styles                  12 chars  (keep, add full preset list)
   └── 3. Totals Row                    10 chars  (keep)

7. Workbook                           (section: 8 chars → rename from "Workbook Builder")
   ├── 1. Building Workbooks            18 chars  (merge Buffered Workbook + Output, rename)
   └── 2. Sheet Options                 13 chars  (rename from "Sheets")

8. Streaming                          (section: 9 chars)
   ├── 1. Getting Started               15 chars  (merge Overview + Commit API into one intro)
   ├── 2. Output Targets                14 chars  (keep)
   ├── 3. Memory Tuning                 13 chars  (keep, add tempDirectory)
   └── 4. Stream Examples               15 chars  (rename from bare "Examples")

9. Column Features                    (section: 15 chars → new section for miscellaneous column-level features)
   ├── 1. Data Validation               15 chars  (move from Schema Builder)
   ├── 2. Hyperlinks                    10 chars  (move from Schema Builder)
   └── 3. Cell Protection               15 chars  (new page — currently scattered across 3 pages)

10. Performance                       (section: 11 chars)
    ├── 1. Perf Overview                13 chars  (merge Overview + Benchmarks, rename)
    └── 2. Perf Patterns                13 chars  (rename from bare "Patterns")

11. Reference                         (section: 9 chars)
    ├── 1. API Reference                13 chars  (keep, fix all drift issues)
    └── 2. Type Reference               14 chars  (rename from "Types", fix all drift issues)

99. Migration                         (section: 9 chars)
    ├── 1. v0 to v1                      7 chars  (keep)
    └── 2. v1 to v2                      7 chars  (keep)
```

**Total: 11 sections, 32 pages** (down from 10 sections, 41 pages)

### Label Length Analysis (proposed)

```
Section labels:     7-15 chars  (range: 8)    ← tighter than current 8-16
Page labels:        6-18 chars  (range: 12)   ← tighter than current 5-21

Sibling consistency per section:
  Getting Started:    10-12 chars  ✓ tight
  Core Concepts:      12-15 chars  ✓ tight
  Columns:            9-16 chars   ✓ acceptable
  Styling:            6-14 chars   acceptable (Themes is short but clear)
  Formulas:           9-18 chars   acceptable
  Excel Tables:       10-12 chars  ✓ tight
  Workbook:           13-18 chars  ✓ tight
  Streaming:          13-15 chars  ✓ tight
  Column Features:    10-15 chars  ✓ tight
  Performance:        13-13 chars  ✓ exact match
  Reference:          13-14 chars  ✓ tight
```

---

## Part 3 — Detailed Change Plan

### 3.1 Merges (kill thin pages)

| Action    | Source(s)                                                                      | Target                                                               | Details                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Merge** | `5.excel-table-mode/4.autofilter.md`                                           | `5.excel-table-mode/1.overview.md` (→ `Table Mode`)                  | Move the autoFilter section (it's just one boolean) into the main Table Mode page as a "## AutoFilter" section                                         |
| **Merge** | `6.workbook-builder/3.output.md`                                               | `6.workbook-builder/1.buffered-workbook.md` (→ `Building Workbooks`) | The 3 output methods are already mentioned in Buffered Workbook. Kill the standalone page, ensure the methods are complete in the merged page          |
| **Merge** | `8.performance/2.benchmarks.md`                                                | `8.performance/1.overview.md` (→ `Perf Overview`)                    | The benchmarks page has 1 table. Add it as a "## Benchmarks" section in the overview                                                                   |
| **Merge** | `7.streaming/1.overview.md` + `7.streaming/2.commit-api.md`                    | New `7.streaming/1.getting-started.md`                               | The streaming overview is thin (97 lines) and the commit API is its natural next section. Combine into a single "Getting Started with Streaming" page  |
| **Merge** | `3.schema-builder/5.styling-overview.md` + `3.schema-builder/6.base-styles.md` | New `4.styling/2.cell-styles.md`                                     | Styling Overview's general explanation + Base Styles' CellStyle reference = one coherent "Cell Styles" page. The 3-model overview moves to Themes page |
| **Merge** | `4.formulas/3.formula-reference.md` + `4.formulas/5.scope-and-modes.md`        | New `5.formulas/4.scope-and-references.md`                           | Both are reference-heavy and overlap on scope explanation. Combine into one definitive reference page                                                  |

### 3.2 Splits (extract into new sections)

| Action       | Source                                                          | Target Section                           | Details                                                                                                                                                    |
| ------------ | --------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Extract**  | Styling pages from Schema Builder (5-8)                         | New **Styling** section                  | Styling is orthogonal to column definition. It deserves its own section with: Themes, Cell Styles, Dynamic Styles, Conditional Styles                      |
| **Extract**  | Data Validation + Hyperlinks from Schema Builder (9-10)         | New **Column Features** section          | These are column-level features but distinct from core column definition. Group with new Cell Protection page                                              |
| **New page** | Protection docs (scattered in Buffered Workbook, Sheets, types) | `9.column-features/3.cell-protection.md` | Currently protection is split across 3 pages with no dedicated page. Consolidate workbook-level, sheet-level, and cell-level protection into one reference |

### 3.3 Renames

| Current                       | Proposed                                         | Reason                                                                        |
| ----------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------- |
| Section: `Schema Builder`     | `Columns`                                        | The section is about column definition, not the builder itself                |
| Section: `Excel Table Mode`   | `Excel Tables`                                   | Shorter, cleaner                                                              |
| Section: `Workbook Builder`   | `Workbook`                                       | Shorter, cleaner                                                              |
| Page: `Groups`                | `Column Groups`                                  | Match filename, match sibling naming pattern                                  |
| Page: `Summaries`             | `Summary Rows`                                   | More descriptive, distinguishes from formula summaries                        |
| Page: `Buffered vs Streaming` | `Execution Model`                                | After deduplication, this page explains HOW things run, not just a comparison |
| Page: `Overview` (x3)         | `Table Mode`, `Streaming Intro`, `Perf Overview` | Disambiguate                                                                  |
| Page: `Sheets`                | `Sheet Options`                                  | More descriptive                                                              |
| Page: `Output`                | _(merged)_                                       | —                                                                             |
| Page: `Types`                 | `Type Reference`                                 | More descriptive, matches sibling "API Reference"                             |
| Page: `Patterns`              | `Perf Patterns`                                  | Disambiguate from other "patterns"                                            |
| Page: `Examples`              | `Stream Examples`                                | Disambiguate                                                                  |
| Page: `Scope and Modes`       | _(merged into Scope & References)_               | —                                                                             |
| Page: `Formula Reference`     | _(merged into Scope & References)_               | —                                                                             |
| Page: `Styling Overview`      | _(merged into Cell Styles / Themes)_             | —                                                                             |
| Page: `Base Styles`           | _(merged into Cell Styles)_                      | —                                                                             |

### 3.4 Redundancy Elimination

| Redundant Content                       | Current Locations                                               | Canonical Location                         | Other Locations Action                                                                |
| --------------------------------------- | --------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------- |
| Report vs table mode feature table      | Schema Modes, Excel Table Overview, Scope and Modes             | **Schema Modes**                           | Replace with 1-line summary + `[see Schema Modes](/core-concepts/schema-modes)` link  |
| Buffered vs streaming decision guidance | Buffered vs Streaming, Streaming Overview, Performance Overview | **Execution Model** (renamed page)         | Replace with cross-link: `[see Execution Model](/core-concepts/execution-model)`      |
| A1 vs structured reference code example | Schema Modes, Scope and Modes, Excel Table Overview             | **Scope & References**                     | Replace with summary + cross-link in the other two                                    |
| Install snippet in Quick Start          | Installation, Quick Start                                       | **Installation**                           | Remove from Quick Start, add "After [installing](/getting-started/installation), ..." |
| `select` API explanation                | Column Selection, Buffered Workbook                             | **Column Selection**                       | In Buffered Workbook, keep just `select` option mention + link to Column Selection    |
| Output methods listing                  | Output (killed), Buffered Workbook, API Reference               | **Building Workbooks** + **API Reference** | Narrative in Building Workbooks, full signatures in API Reference                     |

### 3.5 Cross-Link Additions

Every page should have at least one inbound cross-link. Here are the missing links to add:

| Target Page                         | Add Link From                       |
| ----------------------------------- | ----------------------------------- |
| Building Workbooks                  | Quick Start, Execution Model        |
| Sheet Options                       | Building Workbooks                  |
| Commit API (now in Streaming Intro) | Quick Start                         |
| Output Targets                      | Building Workbooks, Streaming Intro |
| Stream Examples                     | Streaming Intro, Perf Patterns      |
| Perf Overview                       | Execution Model                     |
| Perf Patterns                       | Streaming Intro, Building Workbooks |
| Type Reference                      | API Reference                       |
| v1 → v2                             | Introduction (if latest)            |
| Cell Styles                         | Defining Columns                    |
| Dynamic Styles                      | Cell Styles                         |
| Conditional Styles                  | Dynamic Styles, Formula Columns     |
| Data Validation                     | Defining Columns                    |
| Hyperlinks                          | Defining Columns                    |
| Cell Protection                     | Sheet Options, Building Workbooks   |
| Table Styles                        | Table Mode                          |
| Column Groups                       | Defining Columns                    |
| Dynamic Columns                     | Column Groups                       |

---

## Part 4 — Documentation Drift Fixes

These fixes should be applied during the restructure, in the relevant pages:

### Critical (blocks correctness)

1. **Fix `CellValue` type** in Type Reference — add `PrimitiveCellValue[]` array variant
2. **Add missing `TableInput` fields** in API Reference — `theme`, `autoFilter`, `render`
3. **Add missing `StreamTableInput` fields** — `title`, `theme`, `name`, `style`, `autoFilter`, `totalsRow`, `render`
4. **Add `protection` to `WorkbookStreamOptions`** in API Reference + Type Reference

### High (missing real features)

5. **Add missing `TableStyleDefaults` slots** — `title`, `groupHeader`, `groupHeaderFiller`, `cells.hyperlink`
6. **Document `AlignmentStyle`** full properties — add `shrinkToFit`, `textRotation`, `indent`, `readingOrder`
7. **Document `SummaryDefinition`** full API — add `formula`, `spacer`, `conditionalStyle` members
8. **Document `render: { groupHeaders }`** option — add to Building Workbooks page
9. **Document schema-level `.theme()`** — add to Themes page
10. **Add `enabled` field** to protection types in Type Reference

### Medium

11. **Add `tempDirectory`** to Memory Tuning page
12. **Fix `BorderEdge`/`BorderSideStyle`** naming in Type Reference
13. **Document `ExcelTableStyle` preset list** — at minimum add a collapsible list in Table Styles page
14. **Document `TableAutoFilterOptions`** object form — add to Table Mode page

---

## Part 5 — File Rename Map

Current path → New path (all under `apps/docs/content/`):

```
# Section 1 — Getting Started (no changes)
1.getting-started/1.introduction.md          → (keep)
1.getting-started/2.installation.md          → (keep)
1.getting-started/3.quick-start.md           → (keep)
1.getting-started/4.comparison.md            → (keep)

# Section 2 — Core Concepts
2.core-concepts/1.schema-modes.md            → (keep)
2.core-concepts/3.schema-context.md          → 2.core-concepts/2.schema-context.md
2.core-concepts/2.buffered-vs-streaming.md   → 2.core-concepts/3.execution-model.md  (rename + content merge)

# Section 3 — Columns (rename from Schema Builder)
3.schema-builder/ → 3.columns/
3.schema-builder/1.defining-columns.md       → 3.columns/1.defining-columns.md
3.schema-builder/3.column-groups.md          → 3.columns/2.column-groups.md  (title: "Column Groups")
3.schema-builder/4.dynamic-columns.md        → 3.columns/3.dynamic-columns.md
3.schema-builder/4.selection.md              → 3.columns/4.column-selection.md
3.schema-builder/2.summaries.md              → 3.columns/5.summary-rows.md  (title: "Summary Rows")

# Section 4 — Styling (new section, extracted)
(new dir) 4.styling/
3.schema-builder/5.styling-overview.md (partial) → 4.styling/1.themes.md  (theme portion + new .theme() docs)
3.schema-builder/5.styling-overview.md (partial)
  + 3.schema-builder/6.base-styles.md        → 4.styling/2.cell-styles.md  (merged)
3.schema-builder/7.dynamic-styles.md         → 4.styling/3.dynamic-styles.md
3.schema-builder/8.conditional-styles.md     → 4.styling/4.conditional-styles.md

# Section 5 — Formulas (renumber from 4 to 5)
4.formulas/ → 5.formulas/
4.formulas/1.formula-columns.md              → 5.formulas/1.formula-columns.md
4.formulas/2.row-model.md                    → 5.formulas/2.row-model.md
4.formulas/4.summary-formulas.md             → 5.formulas/3.summary-formulas.md
4.formulas/3.formula-reference.md
  + 4.formulas/5.scope-and-modes.md          → 5.formulas/4.scope-and-references.md  (merged)

# Section 6 — Excel Tables (renumber from 5 to 6)
5.excel-table-mode/ → 6.excel-tables/
5.excel-table-mode/1.overview.md
  + 5.excel-table-mode/4.autofilter.md       → 6.excel-tables/1.table-mode.md  (merged)
5.excel-table-mode/2.table-styles.md         → 6.excel-tables/2.table-styles.md
5.excel-table-mode/3.totals-row.md           → 6.excel-tables/3.totals-row.md

# Section 7 — Workbook (renumber from 6 to 7)
6.workbook-builder/ → 7.workbook/
6.workbook-builder/1.buffered-workbook.md
  + 6.workbook-builder/3.output.md           → 7.workbook/1.building-workbooks.md  (merged)
6.workbook-builder/2.sheets.md               → 7.workbook/2.sheet-options.md

# Section 8 — Streaming (renumber from 7 to 8)
7.streaming/ → 8.streaming/
7.streaming/1.overview.md
  + 7.streaming/2.commit-api.md              → 8.streaming/1.streaming-intro.md  (merged)
7.streaming/3.output-targets.md              → 8.streaming/2.output-targets.md
7.streaming/4.memory-tuning.md               → 8.streaming/3.memory-tuning.md
7.streaming/5.examples.md                    → 8.streaming/4.stream-examples.md

# Section 9 — Column Features (new section)
(new dir) 9.column-features/
3.schema-builder/9.data-validation.md        → 9.column-features/1.data-validation.md
3.schema-builder/10.hyperlinks.md            → 9.column-features/2.hyperlinks.md
(new file)                                   → 9.column-features/3.cell-protection.md

# Section 10 — Performance (renumber from 8 to 10)
8.performance/ → 10.performance/
8.performance/1.overview.md
  + 8.performance/2.benchmarks.md            → 10.performance/1.perf-overview.md  (merged)
8.performance/3.patterns.md                  → 10.performance/2.perf-patterns.md

# Section 11 — Reference (renumber from 9 to 11)
9.reference/ → 11.reference/
9.reference/1.api-reference.md               → 11.reference/1.api-reference.md
9.reference/2.types.md                       → 11.reference/2.type-reference.md

# Section 99 — Migration (keep)
99.migration/1.v0-to-v1.md                   → (keep)
99.migration/2.v1-to-v2.md                   → (keep)
```

---

## Part 6 — Execution Order

This restructure should be done in phases to avoid breaking the docs site at any point:

### Phase 1: Fix Critical Bugs (no restructure)

1. Fix the `4.` prefix collision — renumber `4.selection.md` → `5.selection.md` and cascade
2. Fix all Critical drift issues in Reference pages (CellValue, TableInput, StreamTableInput, WorkbookStreamOptions)

### Phase 2: Merges (reduce page count)

3. Merge AutoFilter → Table Mode Overview
4. Merge Output → Buffered Workbook
5. Merge Benchmarks → Performance Overview
6. Merge Streaming Overview + Commit API → Streaming Intro
7. Merge Styling Overview + Base Styles → Cell Styles
8. Merge Formula Reference + Scope and Modes → Scope & References

### Phase 3: Restructure (move files)

9. Rename `3.schema-builder/` → `3.columns/` and renumber files
10. Create `4.styling/` section and move styling pages
11. Renumber Formulas → `5.formulas/`
12. Rename + renumber Excel Table Mode → `6.excel-tables/`
13. Rename + renumber Workbook Builder → `7.workbook/`
14. Renumber Streaming → `8.streaming/`
15. Create `9.column-features/` and move validation + hyperlinks
16. Renumber Performance → `10.performance/`
17. Renumber Reference → `11.reference/`

### Phase 4: New Content

18. Create Cell Protection page
19. Document `render: { groupHeaders }` in Building Workbooks
20. Document schema `.theme()` in Themes page
21. Document all remaining drift fixes (High + Medium from Part 4)

### Phase 5: Cross-Links & Polish

22. Add all missing cross-links (Part 3.5)
23. Replace all redundant inline explanations with cross-links (Part 3.4)
24. Rename all page titles per Part 3.3
25. Final review pass for label consistency

---

## Part 7 — Before / After Sidebar Comparison

### Before

```
Getting Started
  Introduction
  Installation
  Quick Start
  Comparison
Core Concepts
  Schema Modes
  Buffered vs Streaming          ← long
  Schema Context
Schema Builder                   ← 10 children
  Defining Columns
  Summaries
  Groups                         ← short
  Dynamic Columns
  Column Selection
  Styling Overview
  Base Styles
  Dynamic Styles
  Conditional Styles
  Data Validation
  Hyperlinks
Formulas
  Formula Columns
  Row Model
  Formula Reference
  Summary Formulas
  Scope and Modes
Excel Table Mode
  Overview                       ← ambiguous
  Table Styles
  Totals Row
  AutoFilter                     ← thin
Workbook Builder
  Buffered Workbook
  Sheets                         ← short
  Output                         ← thin
Streaming
  Overview                       ← ambiguous
  Commit API
  Output Targets
  Memory Tuning
  Examples                       ← ambiguous
Performance
  Overview                       ← ambiguous
  Benchmarks                     ← thin
  Patterns                       ← ambiguous
Reference
  API Reference
  Types                          ← short
Migration
  v0 → v1
  v1 → v2
```

### After

```
Getting Started
  Introduction
  Installation
  Quick Start
  Comparison
Core Concepts
  Schema Modes
  Schema Context
  Execution Model
Columns
  Defining Columns
  Column Groups
  Dynamic Columns
  Column Selection
  Summary Rows
Styling
  Themes
  Cell Styles
  Dynamic Styles
  Conditional Styles
Formulas
  Formula Columns
  Row Model
  Summary Formulas
  Scope & References
Excel Tables
  Table Mode
  Table Styles
  Totals Row
Workbook
  Building Workbooks
  Sheet Options
Streaming
  Streaming Intro
  Output Targets
  Memory Tuning
  Stream Examples
Column Features
  Data Validation
  Hyperlinks
  Cell Protection
Performance
  Perf Overview
  Perf Patterns
Reference
  API Reference
  Type Reference
Migration
  v0 → v1
  v1 → v2
```

Key improvements:

- **41 → 32 pages** (9 pages eliminated through merges)
- **No ambiguous titles** (no bare "Overview", "Examples", "Patterns")
- **Max 5 pages per section** (down from 10 in Schema Builder)
- **Tighter label lengths** within sibling groups
- **New dedicated sections** for Styling and Column Features — logical grouping
- **All 3 redundancy hotspots** resolved via canonical locations + cross-links
- **All drift issues** have a home in the execution plan
