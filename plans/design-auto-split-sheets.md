# Design: automatic sheet splitting for streamed tables

Spike for plan 014. Written against `4e21a1f` (main). Design only: nothing here is implemented.

## Context

One worksheet holds 1,048,576 rows (`EXCEL_MAX_ROWS`, `packages/core/src/workbook/internal/limits.ts:2`).
Since plan 008, a streamed table that crosses that limit throws while rows are committed:
`StreamTableBuilder.commit` calls `assertRowCount(sheetName, headerRows + committedPhysicalRows + expanded.height)`
for every row (`src/workbook/stream.ts:471-474`), and the message tells the user to split by hand
(`src/workbook/internal/limits.ts:13-19`).

Today the split is a loop the user writes. The agent skill teaches it in
`packages/core/skills/typed-xlsx/references/streaming.md`, section "Splitting across sheets": the
caller opens `Events`, `Events 2`, … with a new table id per part, tracks `rowsInSheet`, and slices
each page so a part never passes the cap. `apps/docs/content/10.performance/2.large-exports.md`
("Plan for sub-row expansion", around line 75) says the same in prose. The loop is about 25 lines,
gets sub-rows wrong (it counts logical rows, not worksheet rows), and loses the typed handle unless
the caller wraps `openPart` in a function.

The feature does not exist yet: no `maxRows`, `maxRowsPerSheet` or `split` appears in `src`.

All paths below are relative to `packages/core/` unless they start with `apps/` or `plans/`.

## How the stream builder works today (what the design relies on)

- **Sheets are assembled only at the end.** `StreamWorkbookBuilder.sheet()` pushes a
  `StreamSheetBuilder` onto `this.sheets` (`src/workbook/stream.ts:907-933`). Nothing is written to the
  output until `finish()` → `writeWorkbook()` (`src/workbook/stream.ts:935-1170`), which finalizes every
  sheet, computes the final worksheet names, lays out tables and writes parts in `this.sheets` order.
  So a new sheet can be added at any time before the output call, including in the middle of a
  table's commits. Sheet order is the array order, so a part can be inserted right after the
  previous one.
- **One spool per table.** `StreamSheetBuilder.table()` asks the spool factory for a new spool
  (`src/workbook/stream.ts:768`). The file factory numbers files inside a private per-workbook
  directory (`src/api.ts:469-504`, `table-${n}.spool`, opened with `"wx"` at `src/api.ts:440`), so
  each part gets its own spool with no naming risk.
- **A table builder owns all per-table state.** Row numbering, summary accumulators, width stats,
  merges, hyperlinks, images, totals-row stats and the excel-table definition all live in
  `StreamTableBuilder.state` (`src/workbook/stream.ts:389-421`). Conditional formats and data
  validations are computed from `committedPhysicalRows` at finalization
  (`src/workbook/stream.ts:649-662`). A part that is its own `StreamTableBuilder` therefore gets
  correct ranges, row numbers in formulas, merges and hyperlinks with no new code.
- **Sheet names are fixed up at the end.** `buildWorksheetNames` (`src/ooxml/sheet-names.ts:21-54`)
  replaces invalid characters, truncates to 31 characters, and renames case-insensitive duplicates to
  `Name (2)`, `Name (3)`, … It runs once, in `writeWorkbook` (`src/workbook/stream.ts:979-980`).
  A name passed to `sheet()` can therefore end up different in the file.
- **Excel table names are claimed eagerly.** `StreamSheetBuilder.table()` claims
  `resolveExcelTableName(params.name, id)` in a workbook-wide registry
  (`src/workbook/stream.ts:764-766`; registry at `src/workbook/internal/limits.ts:114-129`; name rules
  at `src/workbook/internal/excel-table.ts:151-177`). A duplicate throws immediately.
- **Charts and pivots find tables by `(sheet name, table id)`.** The handle returned by `table()` is a
  chart source made by `createChartTable(sheetName, tableId)` (`src/api.ts:626-640`,
  `src/chart/table.ts:13`). At finish, `resolveStreamWorkbookObjects` indexes each table by
  `sheet.name` and `table.tableId` (`src/workbook/internal/charts.ts:276-353`), and
  `PivotSources.locate` requires exactly one match (`src/workbook/internal/charts.ts:93-120`).
- **Streamed pivots re-read their source on open.** Pivot rows are tallied as rows are committed
  (`src/workbook/stream.ts:477-486`), but the cache is written with `refreshOnLoad: 1`, `saveData: 0`
  and a single `worksheetSource` (a table name or one `ref` on one sheet)
  (`src/ooxml/pivot.ts:178-196`). Excel rebuilds the pivot from that one range when the file opens.

## Decisions

### 1. API: a workbook-level `splitTable()`

Three shapes were considered:

| Shape              | Example                                                                           | Problems                                                                                                                                                                                                                                                                                                                                      |
| ------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Sheet option    | `workbook.sheet("Orders", { maxRowsPerSheet })`                                   | A sheet can hold several tables (`tablesPerRow`, `src/workbook/stream.ts:913-924`). Which one overflows, and do the others repeat on each part? No good answer.                                                                                                                                                                               |
| B. Table option    | `sheet.table("orders", { schema, split: { maxRows } })`                           | The split table must be alone on its sheet, so other `table()` calls on that sheet must throw. `table()` must return a different handle (no chart marks) when `split` is set: a conditional return type on the inferred options (`const TInput`, `src/api.ts:361-372`). Works, but the rule "alone on the sheet" is enforced at runtime only. |
| C. Workbook method | `workbook.splitTable("orders", { sheetName: "Orders", schema, maxRowsPerSheet })` | One more method to learn. Sheet options move into a nested `sheet` field.                                                                                                                                                                                                                                                                     |

**Recommendation: C.** The split table creates and owns its sheets, so "alone on its sheet" holds by
construction. Its return type is a plain new interface; `table()` and `WorkbookTableStream` stay
exactly as they are. The method name tells the reader the result is not an ordinary table (no chart
marks, no pivot), which B would hide behind an option.

```ts
import { createExcelSchema, createWorkbookStream } from "typed-xlsx";

type Event = { at: Date; user: string; action: string };

const events = createExcelSchema<Event>()
  .column("at", { header: "Time", accessor: "at", format: "yyyy-mm-dd hh:mm" })
  .column("user", { header: "User", accessor: "user" })
  .column("action", { header: "Action", accessor: "action" })
  .build();

export async function exportEvents(pages: AsyncIterable<Event[]>, path: string) {
  const workbook = createWorkbookStream({ memoryProfile: "low-memory" });
  try {
    const table = await workbook.splitTable("events", {
      sheetName: "Events", // parts 2+ are "Events (2)", "Events (3)", …
      sheet: { freezePane: { rows: 1 } }, // applied to every part
      schema: events,
      maxRowsPerSheet: 500_000, // data rows per part; omit to fill each sheet to Excel's limit
    });
    for await (const page of pages) {
      await table.commit({ rows: page }); // pages can cross a part boundary
    }
    console.log(table.parts); // [{ sheetName: "Events", rows: 500000 }, { sheetName: "Events (2)", rows: 81234 }]
    await workbook.writeToFile(path);
  } catch (error) {
    await workbook.dispose();
    throw error;
  }
}
```

Proposed types, added to `src/api.ts` next to `WorkbookStream` (`src/api.ts:405-413`):

```ts
export interface WorkbookSplitTableOptions {
  /** Name of the first part's sheet. */
  sheetName: string;
  /** Layout, view and protection options, applied to every part's sheet. */
  sheet?: WorkbookStreamSheetOptions;
  /**
   * Data rows (worksheet rows, so sub-rows count) per part. Defaults to as many as fit:
   * 1,048,576 minus header, summary and totals rows.
   */
  maxRowsPerSheet?: number;
  /** Name of part `n` (2 and up). Defaults to `${sheetName} (${n})`. */
  partSheetName?: (part: number) => string;
}

export interface WorkbookSplitTablePart {
  /** Sheet name as given; the file can differ when another sheet has the same name. */
  sheetName: string;
  /** Native table name, in excel-table mode. */
  tableName?: string;
  /** Data rows (worksheet rows) written to this part so far. */
  rows: number;
}

export interface WorkbookSplitTableStream<TRow extends object> {
  commit(batch: WorkbookCommitBatch<TRow>): Promise<void>;
  /** Parts opened so far, in sheet order. Always at least one. */
  readonly parts: readonly WorkbookSplitTablePart[];
}

export interface WorkbookStream {
  // existing members unchanged
  splitTable<
    TSchema extends AnySchemaDefinition,
    const TSelection extends TableSelection<SchemaSelectableIds<TSchema>> | undefined = undefined,
    const TInput = unknown,
  >(
    id: string,
    options: WorkbookStreamResolvedTableOptions<TSchema, TSelection> &
      WorkbookSplitTableOptions &
      TableOptionKeys<TInput, TSchema, SplitTableKeys, SplitExcelTableKeys> & { schema: TSchema },
  ): Promise<WorkbookSplitTableStream<SchemaRow<TSchema>>>;
}
```

`SplitTableKeys` is `StreamTableKeys | keyof WorkbookSplitTableOptions` (same idea as
`src/api.ts:122-125`), so a typo such as `maxRowPerSheet` gets the library's usual "not a table
option" message.

### 2. Part names, and how the caller learns them

- Part 1 uses `sheetName`. Part `n ≥ 2` uses `partSheetName(n)` or `` `${sheetName} (${n})` ``.
  The `(n)` suffix matches what `buildWorksheetNames` already produces for duplicates
  (`src/ooxml/sheet-names.ts:34-37`), so a reader sees the same pattern either way.
- Raw names go through `buildWorksheetNames` at finish like every other sheet, so a 31-character
  base is truncated before the suffix (`src/ooxml/sheet-names.ts:36`) and the result stays ≤ 31.
- Each part gets a **distinct raw name**. Passing the same raw name for every part and relying on
  `buildWorksheetNames` to dedupe would also work for the file, but `PivotSources.addSheet` and the
  chart index count raw names and reject duplicates as ambiguous
  (`src/workbook/internal/charts.ts:84-98`, `src/chart/resolve.ts:81`), which would break unrelated charts that read a sheet
  named `Events`.
- `table.parts` exposes the names. They are the raw names; the written name differs only if the caller
  also declares another sheet with the same name, which today already gets a ` (2)` suffix silently.
  To make `parts` exact, the first version normalizes the part name with the same rules
  (export `normalizeSheetName` + truncation from `sheet-names.ts`) and throws at rollover if a sheet
  with that normalized name (ignoring case) is already declared. A sheet declared _after_ the
  rollover with a colliding name still gets renamed at finish; see open question 2.
- The caller can use `parts` after the last commit to fill an index sheet with hyperlinks
  (`#'Events (2)'!A1`). Because sheets are only written at finish, that index sheet can be declared
  first (so it is the first tab) and filled after the split table is done.

### 3. Behaviour of each feature on a split table

| Feature                                                     | First version                                                                                                              | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header rows, title, group headers                           | Repeated on every part                                                                                                     | Each part is a full `StreamTableBuilder` with the same options; the chrome comes from `buildReportChrome` per table (`src/workbook/stream.ts:445-451`).                                                                                                                                                                                                                                                                                                                               |
| `summary` (report mode)                                     | Per part: each part's summary rows cover that part's rows only                                                             | A new builder starts new summary accumulators (`src/workbook/stream.ts:493-499`). A grand total needs either a cross-sheet formula or a reducer that spans parts; deferred (open question 1). Documented clearly, because a reader of the last part may take its total for the grand total.                                                                                                                                                                                           |
| `totalsRow` (excel-table)                                   | Per part, one totals row under each native table                                                                           | Same reason.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Excel-table mode                                            | One native table per part. Part 1 keeps the resolved name; part `n` is `${name}_${n}`, claimed in the registry at rollover | Names must be unique ignoring case (`src/workbook/internal/limits.ts:114-129`) and match `^[A-Za-z_][A-Za-z0-9_]*$` (`src/workbook/internal/excel-table.ts:211-213`); `_${n}` keeps both rules. A collision throws at rollover with the existing message.                                                                                                                                                                                                                             |
| Formula columns                                             | Work per part, row refs relative to the part                                                                               | Formula cells are built per row from the part's own row numbers (`expandCommittedRow`, `src/workbook/stream.ts:462-470`).                                                                                                                                                                                                                                                                                                                                                             |
| Conditional styles, validations, hyperlinks, images, merges | Per part                                                                                                                   | All computed from per-table state (`src/workbook/stream.ts:649-662`, `:513-575`).                                                                                                                                                                                                                                                                                                                                                                                                     |
| Freeze panes, sheet view, protection, `tablesPerRow` gaps   | Copied to every part's sheet from `options.sheet`                                                                          | They are sheet options (`src/workbook/stream.ts:907-933`).                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Column widths                                               | Shared across parts: every part gets the widest width seen in any part                                                     | Parts are one table to the reader; different widths per tab look like a bug. Widths are only used at finish (`src/workbook/stream.ts:623`), so the parts can share one `columnWidths` map (today created per table by `createPlannerStats(columns)`, `src/workbook/stream.ts:398`).                                                                                                                                                                                                   |
| `select`, `context`                                         | Same for every part                                                                                                        | Passed through unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Sub-rows (array accessors)                                  | A logical row is never cut across parts. A row taller than `maxRowsPerSheet` throws                                        | Splitting an order's lines across two sheets would break its merges.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Charts reading the table                                    | Refused at compile time: `WorkbookSplitTableStream` has no chart marks                                                     | A chart series is one range on one sheet (`resolveWorkbookCharts`, called at `src/workbook/internal/charts.ts:352`). Charting a million-row table is rarely useful; a pivot-backed chart is the usual answer, and that is refused too (next row).                                                                                                                                                                                                                                     |
| Pivots reading the table                                    | Refused at compile time: no `.pivot()` on the handle                                                                       | The cache source is a single table or range (`src/ooxml/pivot.ts:178-181`) and is refreshed on open (`refreshOnLoad: 1`, `src/ooxml/pivot.ts:188`), so Excel would rebuild the pivot from part 1 only and show wrong totals. Excel's alternative for several ranges, a "multiple consolidation ranges" cache (`cacheSource type="consolidation"`), loses the field names and gives generic Row/Column/Value fields, so it does not match `pivot({ rows: ["region"] })`. Not feasible. |
| Charts and pivots _placed on_ other sheets                  | Unaffected                                                                                                                 | The split table only adds sheets.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Buffered workbook (`createWorkbook`)                        | Not in the first version                                                                                                   | Buffered callers have all rows in memory and can slice them in one line. The same option could be added later; the buffered planner knows the row count up front.                                                                                                                                                                                                                                                                                                                     |

### 4. Where the cut happens in the stream internals

Rollover is decided per logical row, inside the commit loop, because the row's height is only
known after `expandCommittedRow` (`src/workbook/stream.ts:462-470`).

Proposed change to `StreamTableBuilder` (`src/workbook/stream.ts:295-686`):

- Add an optional `capacity` (data rows) to the builder options.
- `commit(batch)` becomes `commitUntilFull(batch, startIndex): Promise<number>`: it processes rows
  from `startIndex`, and when `committedPhysicalRows + expanded.height > capacity` it stops **before**
  touching any state for that row and returns the index of the row that did not fit. The existing
  `commit` calls it with no capacity and keeps throwing via `assertRowCount` as today.
- The expanded row is discarded and expanded again in the next part. This is required, not a waste:
  formula cells and hyperlinks inside it carry row numbers of the part they land in.
- The pending XML of the full part is flushed in the existing `finally` (`src/workbook/stream.ts:582-584`).

New class `StreamSplitTable` in `src/workbook/stream.ts`:

```ts
class StreamSplitTable<T extends object> {
  private current: StreamTableBuilder<T, string, any>;
  private readonly parts: Array<{
    sheet: StreamSheetBuilder;
    table: StreamTableBuilder<T, string, any>;
  }> = [];

  async commit(batch: StreamTableCommit<T>) {
    let index = 0;
    while (index < batch.rows.length) {
      const stoppedAt = await this.current.commitUntilFull(batch, index);
      if (stoppedAt === batch.rows.length) return;
      if (stoppedAt === index && this.current.isEmpty()) {
        throw new Error(
          `Row ${index} of table '${this.id}' needs more rows than maxRowsPerSheet (${this.capacity}).`,
        );
      }
      await this.openNextPart(); // lazily: no empty trailing part when the total is a multiple of the cap
      index = stoppedAt;
    }
  }
}
```

`openNextPart()` calls a new `StreamWorkbookBuilder.insertSheetAfter(previous, name, options)`, which
builds a `StreamSheetBuilder` like `sheet()` does (`src/workbook/stream.ts:907-933`) and splices it
into `this.sheets` after `previous`. Then it calls the new sheet's `table()` with the same schema,
context, select and table options, `name` set to the part's excel-table name, and the shared width map.

At finish nothing changes: each part is a normal sheet with a normal table, so `writeWorkbook`
(`src/workbook/stream.ts:961-1170`) writes it like any other sheet. Each part's spool is closed by
`StreamSheetBuilder.finalize()` and deleted by `release()` as today (`src/workbook/stream.ts:828-851`,
`:1176-1191`).

The default capacity, when `maxRowsPerSheet` is omitted, is
`EXCEL_MAX_ROWS − headerRows − summaryRows − totalsRow`. Header height comes from `buildReportChrome`
(already computed lazily at `src/workbook/stream.ts:445-451`); summary height is
`groupSummaryRows(...)`, the same count `getTableHeight` uses (`src/workbook/internal/layout.ts:38-53`).
Both are known from the schema before the first commit. A `maxRowsPerSheet` larger than that throws
when `splitTable()` is called, naming both numbers.

### 5. Typed surface

- No existing type changes. `WorkbookStream` gains one method; `WorkbookSplitTableStream`,
  `WorkbookSplitTableOptions` and `WorkbookSplitTablePart` are new exports from `src/index.ts`.
- `WorkbookTableStream` (`src/api.ts:342-350`) is untouched. A split handle passed where a
  `WorkbookTableStream` is expected fails to compile, which is the point: it has no chart marks.
- Code that today wraps the manual loop keeps compiling.

So the plan's STOP condition ("breaking change to an existing public API") does not apply.

## Minimal first version

Ships:

- `workbook.splitTable(id, { sheetName, sheet?, schema, maxRowsPerSheet?, partSheetName?, ...table options })`
  on `createWorkbookStream()` only, for report and excel-table schemas.
- Parts named as above; `parts` on the handle; shared column widths; per-part summaries and totals rows.

Refuses, with a clear error or a compile error:

- charts and pivots over the split table (compile error: no marks on the handle);
- a logical row taller than the cap (runtime, at commit, names the row index and the cap);
- `maxRowsPerSheet` < 1 or larger than what fits (runtime, at `splitTable()`);
- a part sheet name that collides with a declared sheet, or a part table name that collides with a
  claimed table name (runtime, at rollover).

Not in the first version: grand totals across parts, a buffered `splitTable`, splitting by a key
(one sheet per region), and charts or pivots over all parts.

## Implementation sketch

| File                                                                      | Change                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/workbook/stream.ts`                                                  | `StreamTableBuilder`: `capacity` option, `commitUntilFull`, optional shared width map, `isEmpty()`. New `StreamSplitTable`. `StreamWorkbookBuilder.insertSheetAfter()` and `splitTable()`.                                  |
| `src/ooxml/sheet-names.ts`                                                | Export a `normalizeSheetNameKey(name)` (normalize + truncate + lower-case) so rollover can check collisions with the rules used at finish.                                                                                  |
| `src/workbook/internal/limits.ts`                                         | `assertSplitCapacity(tableId, requested, available)`; row-too-tall error.                                                                                                                                                   |
| `src/api.ts`                                                              | New types (above); `PublicWorkbookStream.splitTable()` returning `{ commit, get parts() }`.                                                                                                                                 |
| `src/index.ts`                                                            | Export the three new types.                                                                                                                                                                                                 |
| `skills/typed-xlsx/references/streaming.md`                               | Replace the manual loop in "Splitting across sheets" with `splitTable`; keep one sentence on doing it by hand for buffered workbooks. SKILL.md "Rules that throw when writing": point the row-limit bullet at `splitTable`. |
| `apps/docs/content/10.performance/2.large-exports.md`, streaming API page | Same.                                                                                                                                                                                                                       |
| `test/fixtures/kitchen-sink/stream.ts`                                    | One split table with a small `maxRowsPerSheet` (AGENTS.md requires new features there).                                                                                                                                     |

## Test plan

In a new `test/stream-split.test.ts`, using `tempStorage: "memory"` and small caps so tests stay fast:

1. 25 rows, cap 10 → three sheets `Events`, `Events (2)`, `Events (3)` in that order with 10/10/5
   data rows; each has the header row; `parts` matches.
2. Exactly 20 rows, cap 10 → two parts, no empty third sheet.
3. One `commit` of 25 rows and 25 commits of one row give byte-identical files.
4. A sheet declared after `splitTable` (`workbook.sheet("Notes")`) comes after all parts; a sheet
   declared before comes before.
5. Sub-rows: rows of height 3 with cap 10 → parts hold 9, 9, … rows; merges stay inside a part; a row of
   height 11 throws the row-too-tall error.
6. Excel-table mode: parts have tables `Events`, `Events_2`; each has a totals row; a pre-existing
   table named `Events_2` makes the rollover throw.
7. Report summaries: `s.formula("sum")` and `s.cell(...)` in each part cover that part only.
8. Formula columns: `refs.column("qty").mul(...)` in part 2 row 2 references row 2 of part 2.
9. Conditional style and validation ranges stop at each part's last row.
10. Column widths are equal across parts and equal to the widest value overall.
11. Default capacity: with a 2-row header and 1 summary row, the cap is 1,048,573; `maxRowsPerSheet`
    of 1,048,574 throws at `splitTable()`. (Check the number only; do not write a million rows.)
12. Long base name (31 chars): part 2's written name is ≤ 31 chars and ends with ` (2)`.
13. Type tests in `test/type-safety.ts`: `table.line(...)`/`table.pivot(...)` on a split handle are
    errors; an unknown option names the valid ones; `context` is required when the schema has one.
14. Spool cleanup: after `writeToFile` and after a failed output, the per-workbook temp directory is
    gone (extend `test/stream-spool.test.ts`).

One manual check: open a 3-part file in Excel and LibreOffice.

## Open questions for the maintainer

1. **Grand total.** Per-part summaries only, or also a grand total? Options: (a) a summary row on the
   last part with a cross-sheet formula (`=SUM(Events!E2:E500001,'Events (2)'!E2:E81235)`), which stays
   live but is long and fragile when a reader deletes a sheet; (b) reducer summaries (`s.cell`) that
   run across all parts, written on the last part only, with formula summaries kept per part. My pick
   for later is (b), because it reuses the accumulator model; the first version ships per-part only.
2. **Exact names in `parts`.** Should a sheet declared _after_ a rollover with a colliding name throw
   (so `parts` is always exact), instead of getting the silent ` (2)` suffix it gets today? That makes
   `sheet()` stricter only for workbooks using `splitTable`.
3. **API shape.** C (`workbook.splitTable`) or B (`table(id, { split })`)? B keeps the familiar chain
   but needs a conditional return type and a runtime "alone on the sheet" rule.
4. **Default cap.** Fill to Excel's limit when `maxRowsPerSheet` is omitted, or require it? Excel
   is slow with sheets near 1M rows; a required option makes people choose.
5. **Splitting by key** (one sheet per region or month) is a different feature that people may expect
   from the name "split". Worth a separate spike?

## Effort

M: about 2–3 days. Builder changes and `StreamSplitTable` about 1 day, types and naming half a day,
tests 1 day, skill/docs/kitchen-sink half a day. The risky part is `commitUntilFull` leaving no
partial state for the rejected row; test 3 (byte-identical output for different batchings) covers it.
