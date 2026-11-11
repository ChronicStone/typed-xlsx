# Design: cached values for formula cells

Spike for plan 015. Written against `4e21a1f` (main). Design only: nothing here is implemented.

## Context

A formula cell in OOXML can carry the last computed result next to the formula
(`<c><f>A2*B2</f><v>12</v></c>`). Excel ignores it here, because typed-xlsx asks for a full
recalculation on open (`calcPr` with `fullCalcOnLoad: 1, forceFullCalc: 1`,
`packages/core/src/ooxml/workbook.ts:68-74`; stream path `src/workbook/stream.ts:1790-1792`).
Anything that reads the file without recalculating shows only that stored value: file previews
(Quick Look, mail and drive previews) and value readers (pandas, openpyxl with `data_only=True`).
When the value is missing they show an empty cell.

All paths below are relative to `packages/core/` unless they start with `apps/`, `packages/` or `plans/`.

### What the plan assumed, and what the code does

The plan says typed-xlsx writes formula cells without a value. That is true for **report mode
only**. Measured with a scratch script (`/private/tmp/claude-501/spikes-F/table-cache.ts`, one row
`{ x: -2.5, label: "12" }`, three formula columns), row 2 of the sheet:

```xml
<!-- excel-table mode -->
<c r="C2" s="2"><f>ROUND(t[[#This Row],[X]],0)</f><v>-2</v></c>
<c r="D2" s="2" t="b"><f>(t[[#This Row],[Label]]=12)</f><v>1</v></c>
<c r="E2" s="2"><f>(t[[#This Row],[X]]/0)</f></c>

<!-- report mode -->
<c r="C2" s="2"><f>ROUND(A2,0)</f></c>
<c r="D2" s="2"><f>(B2=12)</f></c>
<c r="E2" s="2"><f>(A2/0)</f></c>
```

So the library already has an evaluator and already writes cached values:

- `src/formula/evaluate.ts` (264 lines, added in `623189e fix(core): preserve native table formulas`)
  evaluates the typed DSL tree (`FormulaExpr`), not Excel text.
- The buffered planner calls it for excel-table formula columns only
  (`schema.kind === "excel-table" ? evaluateFormulaExpr(...) : undefined`,
  `src/planner/rows.ts:1110-1121` and `:1139-1150`). The stream row builder does the same
  (`formulaMode === "excel-table"`, `src/stream/rows.ts:521-532` and `:550-561`).
- Excel-table totals rows get a value from running stats (`src/workbook/internal/totals-row.ts`,
  used at `src/ooxml/worksheet.ts:490-505` and `src/workbook/stream.ts:1530-1550`).
- Report summary formulas (`s.formula(...)`) never get a value: `createSummaryFormulaCell` returns
  `formulaCell(serializeSummaryFormulaExpr(formula, context))` with no second argument
  (`src/workbook/internal/summaries.ts:252`).
- The writer already handles every value type: `serializeFormulaCell` writes strings as `t="str"`,
  booleans as `t="b"`, dates as serials and numbers as is (`src/ooxml/cells.ts:129-161`). It has no
  error type (`t="e"`).
- Pivots read the cached value when tallying a table; a report formula without one becomes an
  unknown pivot value (`src/workbook/internal/pivots.ts:56-61`).

The excel-table output above also shows the evaluator is **wrong today** in two of three cells:
Excel computes `ROUND(-2.5,0)` as `-3` and `"12"=12` as `FALSE`. Excel users never see this
(full recalculation on open), but previews and pandas do.

The docs section the plan cites ("Who sees the formula result" in
`apps/docs/content/05.formulas/1.formula-columns.md`) is not on main at `4e21a1f`; the only related
sentence is about streamed charts (`apps/docs/content/07.charts/1.overview.md:197`).

So this spike is about three things: fix the evaluator so the values it already writes are right,
extend it to report mode behind an option, and give summary formulas a value.

## 1. The DSL nodes, how each evaluates, and where it can differ from Excel

The DSL has seven expression kinds (`src/formula/expr.ts:2-55`). There is no raw-formula escape
hatch: `FormulaValue` accepts `string | number | boolean` only as literals (`src/formula/expr.ts:218-223`,
`toExpr` at `:508-520`), and nothing in `src/formula` or `src/summary` takes formula text. The
plan's STOP condition does not apply. The DSL has no string concatenation, no date functions and no
lookups, so those need no design.

Two internal shapes are built on top of the DSL:

- `fx.safeDiv(a, b, fallback)` is `IF(b<>0, a/b, fallback)` (`src/formula/expr.ts:381-405`).
- Summary formulas add `summary-row-aggregate` and encode a column range as a **string literal**
  such as `"A2:A3"` inside a `function` node (`columnRangeFunction`,
  `src/workbook/internal/summaries.ts:254-275`). The serializer writes any string literal matching
  `^[A-Z]+\d+:[A-Z]+\d+$` unquoted (`src/workbook/internal/summaries.ts:301-304`).

Parity was checked with `/private/tmp/claude-501/spikes-F/eval-parity.ts`, which calls
`evaluateFormulaExpr` from `src` directly. The "Excel" column is Excel's documented behaviour; it
was **not** measured in Excel for this spike (Excel is installed on this machine but was not
scripted; LibreOffice is not installed).

| Node / DSL call                                                 | Evaluation today (`evaluate.ts`)                                                                                                              | Excel                                                                                                                               | Measured JS result                                                                                               | Parity risk                                                                                                                                                                      |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `literal`                                                       | value as is (`:16-18`)                                                                                                                        | same                                                                                                                                | —                                                                                                                | none                                                                                                                                                                             |
| `ref` (`refs.column`)                                           | the planned cell value; a formula cell gives its cached value, or `null` when it has none (`getCellPrimitiveValue`, `src/cell-data.ts:40-42`) | the computed value                                                                                                                  | —                                                                                                                | **medium**: a ref to a formula cell without a value (an `IMAGE` cell, or a chain that could not be evaluated) reads as blank → `0`, so a wrong number is written instead of none |
| `+ - *` (`.add/.sub/.mul`)                                      | `toNumber` both sides, `undefined` if either is not numeric (`:151-167`)                                                                      | numeric text coerces (`"12"*2`=24); other text → `#VALUE!`                                                                          | `"12"*2`=24; `"abc"*2` → no value                                                                                | low: no value instead of `#VALUE!`                                                                                                                                               |
| `/` (`.div`)                                                    | `undefined` when the divisor is 0 (`:169-171`)                                                                                                | `#DIV/0!`                                                                                                                           | `10/0` → no value                                                                                                | low (no value written); needs an error type to match                                                                                                                             |
| `= <> > >= < <=`                                                | numbers if both coerce, else case-insensitive `localeCompare` (`:208-219`)                                                                    | no coercion between types; order is number < text < boolean; blank equals `0` and `""`                                              | `"12"=12` → `true` (Excel `FALSE`); `TRUE>"z"` → `false` (Excel `TRUE`)                                          | **high**: silently wrong booleans, which then feed `fx.if`                                                                                                                       |
| `fx.if` / `row.if`                                              | `toBoolean` on the condition (`:56-64`)                                                                                                       | text condition → `#VALUE!` (except `"TRUE"`/`"FALSE"`)                                                                              | `IF("false",1,2)` → 2                                                                                            | low                                                                                                                                                                              |
| `fx.and/or/not`, `.and/.or/.not`                                | `every` / `some` / `!` of `toBoolean` (`:89-108`)                                                                                             | same, with text args ignored inside ranges                                                                                          | —                                                                                                                | low                                                                                                                                                                              |
| `fx.round` / `.round(n)`                                        | `Math.round(value * 10**n) / 10**n` (`:66-81`)                                                                                                | half away from zero, on the decimal value                                                                                           | `ROUND(-2.5,0)` → -2 (Excel -3); `ROUND(1.005,2)` → 1 (Excel 1.01)                                               | **high**: money columns are the main use of `round`                                                                                                                              |
| `fx.abs` / `.abs()`                                             | `Math.abs`                                                                                                                                    | same                                                                                                                                | —                                                                                                                | none                                                                                                                                                                             |
| `fx.safeDiv`                                                    | via `IF` and `/` above                                                                                                                        | same                                                                                                                                | —                                                                                                                | inherits `<>` and `/`                                                                                                                                                            |
| `fx.sum/average/min/max/count(a, b, …)` (values)                | `evaluateAggregate` over `toNumber` of each arg (`:176-206`)                                                                                  | direct args: numeric text and booleans count                                                                                        | —                                                                                                                | low                                                                                                                                                                              |
| `collection-aggregate` (`row.series(id).sum()`, sub-row ranges) | same `evaluateAggregate` over the column's values in this logical row                                                                         | **ranges** ignore text, booleans and blanks: `COUNT` counts numbers only, `AVERAGE` skips blanks, `AVERAGE` of nothing is `#DIV/0!` | `COUNT([1,blank,3])` → 3 (Excel 2); `AVERAGE([1,blank,3])` → 1.33 (Excel 2); `SUM([1,"12",TRUE])` → 14 (Excel 1) | **high**                                                                                                                                                                         |
| `scope-aggregate` (`fx.sum(refs.group("q"))`, dynamic blocks)   | same, over the scope's columns in this row (`getScopeValues`, `src/planner/rows.ts:724-728`)                                                  | written as a range or a list of refs, so range rules apply                                                                          | as above                                                                                                         | **high**                                                                                                                                                                         |
| Dates                                                           | `Date` → serial with the 1899-12-30 epoch (`:254-256`)                                                                                        | same epoch as the writer (`src/ooxml/cells.ts:22`)                                                                                  | —                                                                                                                | none                                                                                                                                                                             |
| Floating point                                                  | IEEE doubles, written with `String(n)`                                                                                                        | IEEE doubles; shows 15 significant digits                                                                                           | `0.1+0.2` → `0.30000000000000004`                                                                                | none for the stored value; Excel writes the same 17-digit value                                                                                                                  |

Summary-only shapes:

| Shape                                                          | Excel text                                                                        | Value available from                                                                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `s.formula("sum")`, `column.cells().sum()` etc.                | `SUM(A2:A101)` (`summaries.ts:254-275`)                                           | the column's body values: count, numeric count, sum, min, max. Stats like those of `totals-row.ts:28-42` are enough |
| `fx.round(column.cells().sum(), 2)` and other `fx` around them | `ROUND(SUM(A2:A101),2)`                                                           | the stats above, then the outer expression                                                                          |
| `column.rows().sum((row) => …)` (`summary-row-aggregate`)      | `SUM(SUM(A2:A3),SUM(A4:A4),…)`, one term per logical row (`summaries.ts:281-299`) | the inner expression evaluated per logical row, then aggregated                                                     |

### What needs to change in the evaluator

1. **Error values.** Add an internal `FormulaError` value (`#DIV/0!`, `#VALUE!`, `#NUM!`) that
   propagates through operators like Excel's, and write it as `<c t="e"><v>#DIV/0!</v></c>`.
   `FormulaCell.value` (`src/cell-data.ts:7-12`) widens to `PrimitiveCellValue | FormulaError`
   internally; no public type changes.
2. **Unknown values.** A ref to a formula cell that has no value yields `UNKNOWN`, which makes the
   whole result `UNKNOWN`, and the cell is written without `<v>`. Today it reads as `null` → `0`.
3. **Range vs scalar aggregates.** `collection-aggregate`, `scope-aggregate` and summary column
   ranges follow range rules (numbers and dates only; blanks skipped). Direct `fx.sum(a, b)` args
   keep scalar rules. The rules in `totals-row.ts:28-42` and `:78-92` are already the range rules.
4. **Comparisons.** Compare by type rank (number < text < boolean, blank adapts to the other side),
   case-insensitive for text, no number/text coercion.
5. **ROUND.** Round half away from zero on the shortest decimal form of the number
   (`Number(x.toPrecision(15))` before scaling is enough for the cases above and matches Excel's
   15-digit view). `packages/examples/scripts/preview-model.ts:897-913` uses `+1e-9`, which is close
   but wrong for large values.
6. **Text conditions.** `"TRUE"`/`"FALSE"` (any case) are booleans; other text → `#VALUE!`.

Every change above also changes what excel-table mode writes today. That is a fix, not a
behaviour change Excel users can see.

## 2. API: one workbook option, default unchanged

```ts
import { createExcelSchema, createWorkbook } from "typed-xlsx";

type Line = { sku: string; qty: number; unitPrice: number; discount: number };

const lines = createExcelSchema<Line>()
  .column("sku", { header: "SKU", accessor: "sku" })
  .column("qty", { header: "Qty", accessor: "qty" })
  .column("unitPrice", { header: "Unit price", accessor: "unitPrice", format: '"$"#,##0.00' })
  .column("discount", { header: "Discount", accessor: "discount", format: "0%" })
  .column("net", {
    header: "Net",
    formula: ({ refs, fx }) =>
      fx.round(
        refs
          .column("qty")
          .mul(refs.column("unitPrice"))
          .mul(fx.literal(1).sub(refs.column("discount"))),
        2,
      ),
    format: '"$"#,##0.00',
    summary: (s) => [s.formula("sum")],
  })
  .build();

// Report formulas and their summary rows also carry the computed value,
// so previews and pandas show numbers instead of empty cells.
const workbook = createWorkbook({ formulaValues: "all" });
workbook.sheet("Lines").table("lines", { schema: lines, rows: [] });
const bytes = workbook.toUint8Array();
```

```ts nocheck
export interface WorkbookOptions {
  protection?: WorkbookProtectionInput;
  /**
   * Which formula cells also store a value computed at export time, for readers that do not
   * recalculate (file previews, pandas). Excel always recalculates on open.
   * - "auto" (default): excel-table formula columns and totals rows, as today.
   * - "all": also report formula columns and summary formulas.
   */
  formulaValues?: "auto" | "all";
}
// Same field on WorkbookStreamOptions.
```

Why per workbook, not per table or column:

- The reason to want values is who reads the **file** (a preview, a data pipeline). That is a
  property of the export, not of a column.
- `createWorkbook` already takes an options object (`src/api.ts:57-59`, `:780-782`), and so does
  `createWorkbookStream` (`src/api.ts:269-275`). No schema type changes.
- Per-column control adds a type parameter path for little gain. If a cell can't be computed
  correctly, the evaluator returns `UNKNOWN` and writes no value anyway.

Why "auto" stays the default: values in report mode add bytes (a `<v>` per formula cell) and expose
any evaluator mistake to non-Excel readers. After the parity work and a release of `"all"` as
opt-in, flipping the default is a one-line change (open question 1).

A value `"none"` (no cached values even in excel-table mode) is left out until someone asks: it would
be the only way to make a file _less_ readable.

## 3. Summary formulas, totals rows and streams

| Formula                                                 | Buffered                                                                                                        | Stream                                                                                                                       |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Formula column, excel-table                             | value per row (today; fixed semantics)                                                                          | value per row at commit (today; fixed semantics)                                                                             |
| Formula column, report                                  | value per row when `"all"` (drop the `kind === "excel-table"` condition at `src/planner/rows.ts:1111`, `:1140`) | same at `src/stream/rows.ts:522`, `:551`. Values are known per row at commit, since every column of the row is planned first |
| Totals row, excel-table                                 | value from all rows (today)                                                                                     | value from running stats (today)                                                                                             |
| `s.formula("sum")` and `column.cells().X()` inside `fx` | value from per-column running stats when `"all"`                                                                | same running stats, final at `getFinalization()` (`src/workbook/stream.ts:595`)                                              |
| `column.rows().X(resolver)`                             | not in the first version: no value                                                                              | not in the first version: no value                                                                                           |

Running stats instead of re-reading rows means the buffered and stream paths share one code path,
and streams need no extra memory: five numbers per column that has a summary formula. They are
updated where summary reducers are stepped today (`src/workbook/stream.ts:493-499`; buffered:
`stepSummaryRuntime` at `src/planner/rows.ts:1165-1167`).

To evaluate summary formulas, the column-range string literal must become a real node. Replace
`{ kind: "literal", value: "A2:A101" }` inside `func(name, …)` with an internal
`{ kind: "summary-column-aggregate", aggregate }` that the serializer turns into `SUM(A2:A101)` and
the evaluator turns into the running stat. This also removes a bug found during the spike: a user
string literal that looks like a range is written as a live reference. Measured
(`/private/tmp/claude-501/spikes-F/summary-literal.ts`):

```ts nocheck
summary: (s) => [s.formula(({ fx }) => fx.if(fx.literal(1).eq(1), "B1:B3", "no"))];
// written as <f>IF((1=1),B1:B3,"no")</f>, expected IF((1=1),"B1:B3","no")
```

## 4. Semantics risks and how the design handles them

| Risk                                                                             | Handling                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JS and Excel disagree on a rule we did not think of                              | Every result goes through the fixture tests below. Anything the evaluator is unsure about returns `UNKNOWN` (no `<v>`), never a guess.                                                                                     |
| Floating-point display (`0.30000000000000004`)                                   | Write the full double like Excel does; number formats on the column handle display.                                                                                                                                        |
| Division by zero, bad text                                                       | Written as error cells (`t="e"`), same as Excel would store.                                                                                                                                                               |
| Dates                                                                            | Same serial and epoch as the cell writer (`src/ooxml/cells.ts:10-23`); dates before 1900 already throw (plan 007).                                                                                                         |
| Text results                                                                     | Written as `t="str"` (`src/ooxml/cells.ts:143-147`).                                                                                                                                                                       |
| Values that depend on Excel state (volatile functions, other sheets)             | The DSL has none, so nothing to refuse. `IMAGE` cells are not DSL formulas (`src/planner/rows.ts:519`) and stay without a value; refs to them yield `UNKNOWN`.                                                             |
| A reader trusts a stale value after someone edits in a tool that does not recalc | Same as any Excel-saved file. Not our problem to solve; `fullCalcOnLoad` stays.                                                                                                                                            |
| Cost                                                                             | Measured (`/private/tmp/claude-501/spikes-F/eval-micro.ts`): 300,000 evaluations of three typical expressions take 15–25 ms in Bun, against about 1.8 s to build the 100k-row, 6-column file (`eval-cost.ts`). About 1–2%. |

## 5. `preview-model.ts`: retire or reuse?

`packages/examples/scripts/preview-model.ts` (1,536 lines) builds a render model of a generated
workbook for the docs playground (`build-previews.ts` writes `preview.json` per showcase). Its
header says it evaluates formulas "because typed-xlsx output has no cached values" (lines 1-5). What
it does:

- reads styles, number formats, column widths, merges, tables, charts, sparklines, validations and
  images (lines 115-410 and 1099-1536) — unrelated to formulas;
- parses **Excel formula text** (tokenizer at `:448`, parser at `:539`) and evaluates it with error
  values, ranges, `IF`, `IFERROR`, `AND/OR/NOT`, `ROUND/ROUNDUP/ROUNDDOWN`, `ABS`,
  `SUM/AVERAGE/MIN/MAX/COUNT/COUNTA`, `SUBTOTAL`, `CONCAT`, `IMAGE`, `INDIRECT`, `LEN/UPPER/LOWER`
  (`:874-985`), roughly lines 410-1088;
- reads `<v>` when a cell has one (`:1147-1153`).

It cannot be retired: most of it is rendering. Its formula engine (~680 lines) could shrink to a
fallback once showcases are built with `formulaValues: "all"`, since every DSL formula would then
carry `<v>`. It must keep `SUBTOTAL` with structured refs (totals rows), `IMAGE` and any text the
DSL does not produce. Its semantics (type-ranked `compare` at `:1046-1055`, range-vs-scalar
`aggregate` at `:993-1018`, errors as values) are closer to Excel than `evaluate.ts`, so it is a
good reference for the fixes in section 1 and a second opinion in tests. Its parser is not needed:
the library evaluates the DSL tree, never text.

`apps/docs/app/components/playground/xlsx.ts` (208 lines) is ref/range helpers for the playground UI,
not an evaluator; nothing to retire.

## 6. Smallest useful first version

Ships:

1. Evaluator parity fixes 1-6 from section 1, with error values and `UNKNOWN`. This fixes the values
   excel-table mode already writes.
2. `formulaValues: "auto" | "all"` on both builders. `"all"` adds values to report formula columns
   (buffered and stream) and to summary formulas built from column-range aggregates
   (`s.formula("sum")`, `column.cells().X()`, wrapped in any `fx`).
3. The internal `summary-column-aggregate` node, which also fixes the range-literal bug.

Not in the first version: `column.rows()` summary values, a `"none"` mode, per-table control.

## Implementation sketch

| File                                            | Change                                                                                                                                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/formula/evaluate.ts`                       | Error and `UNKNOWN` values; range vs scalar aggregate rules; ranked comparisons; ROUND; text conditions. New `evaluateSummaryExpr(expr, stats)` for summary trees.                               |
| `src/cell-data.ts`                              | `FormulaCell.value` accepts an internal `FormulaError`; `getCellPrimitiveValue` returns `UNKNOWN` for a formula cell without a value (only the evaluator sees it).                               |
| `src/ooxml/cells.ts`                            | `serializeFormulaCell` writes `t="e"` for errors.                                                                                                                                                |
| `src/planner/rows.ts`, `src/stream/rows.ts`     | Replace `schema.kind === "excel-table"` / `formulaMode === "excel-table"` with a `computeValues` flag resolved from the option and the schema kind.                                              |
| `src/workbook/internal/summaries.ts`            | `summary-column-aggregate` node; `createSummaryFormulaCell` takes the column stats and passes the evaluated value to `formulaCell`.                                                              |
| `src/workbook/stream.ts`, `src/planner/rows.ts` | Per-column summary stats next to the summary reducers.                                                                                                                                           |
| `src/workbook/buffered.ts`, `src/api.ts`        | Thread `formulaValues` from `WorkbookOptions` / `WorkbookStreamOptions`.                                                                                                                         |
| Skill and docs                                  | `skills/typed-xlsx/references/formulas.md` and `workbook.md`: the option and who it helps; `apps/docs/content/05.formulas/1.formula-columns.md`: same. Kitchen-sink: set `"all"` on one fixture. |

## Test plan

1. **Evaluator unit table** (`test/formula-evaluate.test.ts`): every row of the table in section 1
   with the Excel result as the expected value, including `ROUND(-2.5,0)=-3`,
   `ROUND(1.005,2)=1.01`, `ROUND(2.675,2)=2.68`, `"12"=12` false, `TRUE>"z"` true,
   `COUNT([1,blank,3])=2`, `AVERAGE([1,blank,3])=2`, `AVERAGE([])=#DIV/0!`, `10/0=#DIV/0!`,
   `"abc"*2=#VALUE!`.
2. **Excel oracle fixture**: one checked-in `.xlsx` saved by Excel (or LibreOffice) from a generated
   file with every case above, so the expected values come from a real recalculation. Test reads its
   `<v>` values and compares with the evaluator. Regenerate by hand when cases change; record how in
   the test file.
3. **Writer**: an error cached value is written as `<c … t="e"><f>…</f><v>#DIV/0!</v></c>`.
4. **Report mode, buffered and stream**: with `"all"`, formula columns and `s.formula("sum")` carry
   the expected `<v>`; with the default they do not (output byte-identical to today's for report).
5. **Sub-rows and scopes**: `row.series(id).sum()` over expanded rows and `fx.sum(refs.dynamic("months"))`
   produce the range-rule values.
6. **Chains**: a formula referencing another formula column gets the right value; one referencing an
   `IMAGE` column gets no `<v>`.
7. **Pivot**: a pivot over a report table whose value column is a formula tallies real numbers with
   `"all"` (today it gets the unknown marker, `src/workbook/internal/pivots.ts:59`).
8. **Range-literal bug**: the string `"B1:B3"` in a summary formula is written quoted.
9. **Preview cross-check** (optional, in `packages/examples`): build a showcase with `"all"` and assert
   `preview-model.ts`'s own evaluation of each formula equals the written `<v>`.

## Open questions for the maintainer

1. **Default.** Keep `"auto"` (values only in excel-table mode) or make `"all"` the default in the
   next minor once the oracle fixture passes? The cost is ~1–2% build time and some bytes; the gain
   is that every preview shows numbers.
2. **Fix excel-table values in a patch release?** The parity fixes change bytes written by default
   today (`ROUND(-2.5,0)` cached as `-3` instead of `-2`). I would ship them as a fix, since Excel
   users see no change and everyone else gets correct numbers.
3. **Oracle source.** Is a checked-in Excel-saved fixture acceptable, or do you want LibreOffice
   headless in CI (heavier, and its rules differ from Excel in places)?
4. **`column.rows()` summaries.** Worth a second step? They need per-logical-row evaluation of the
   resolver at commit time, then an aggregate; about half a day more.

## Effort

M overall, about 3–4 days: evaluator fixes and error/unknown values 1–1.5 days, option threading and
report mode half a day, summary stats and the new node 1 day, tests and the oracle fixture 1 day,
docs half a day. The evaluator fixes alone (item 1 of the first version) are S and worth shipping
first, because they correct output that is already written today.
