# Design: data bars, color scales and icon sets

Spike for plan 017. Written against `4e21a1f` (main). Design only: nothing here is implemented.

## Context

`plans/excel-feature-roadmap.md` lists data bars, color scales and icon sets as still open (lines
460-462). Today typed-xlsx writes one kind of conditional format: formula rules from a column's
`conditionalStyle`, written as `cfRule type="expression"` with a differential style
(`packages/core/src/ooxml/worksheet-parts.ts:114-144`). Heat maps (region × month) and in-cell bars
(revenue per row) are common reasons to send Excel instead of CSV, and they only make sense on
numbers, which the schema types already know.

All paths below are relative to `packages/core/` unless they start with `plans/`. Scratch files are
in `/private/tmp/claude-501/spikes-F/` (not committed).

## How conditional formatting flows today

1. **Column option.** `conditionalStyle?: ConditionalStyleInput<TReference, TGroupId | TDynamicId>`
   on `ColumnDefinition` (`src/schema/builder.ts:389`); set to `never` for kinds that cannot take it
   (`:515`); normalized to `ConditionalStyleRule[]` when the column is declared (`:1505-1511`).
2. **Blocks per table.** `buildWorksheetConditionalFormatting` turns each column's rules into one
   block `{ ref, rules: [{ formula, priority, style }] }` covering that column's body rows
   (`src/styles/conditional-runtime.ts:8-56`). Body rows only: `rowStart`..`rowEnd` are the data rows,
   so summary and totals rows are outside the range. Summary rows have their own conditional styles
   (`src/workbook/internal/summaries.ts:99`).
3. **Positioning.** When tables are laid out, each block's `ref` is shifted and the formula's relative
   refs are resolved: buffered `src/ooxml/worksheet.ts:599-620`, stream
   `src/workbook/stream.ts:240-260`. In stream mode, the range is built from `committedPhysicalRows`
   at finalization (`src/workbook/stream.ts:649-655`), so it is known only at `finish()`.
4. **Styles.** Stream mode registers every rule's differential style before rows are written, because
   `styles.xml` goes first (`src/workbook/stream.ts:262-280`).
5. **Writing.** `writeWorksheetConditionalFormatting` writes `<conditionalFormatting sqref>` with one
   `cfRule type="expression" dxfId priority` per rule, numbering priorities across the sheet
   (`src/ooxml/worksheet-parts.ts:114-144`). Called from the buffered worksheet
   (`src/ooxml/worksheet.ts:178`) and the stream worksheet (`src/workbook/stream.ts:1575`).
6. **Worksheet extensions.** The only `extLst` today is the sparkline one, written whole by
   `writeWorksheetSparklines` (`src/sparkline/runtime.ts:85-145`) as the last child of the worksheet
   (`src/ooxml/worksheet.ts:185`, `src/workbook/stream.ts:1575`).

**Can it carry non-expression rules without a rewrite?** Yes. Only three places assume
`type="expression"`: the writer (step 5), the relative-ref resolution (step 3, which reads
`rule.formula`), and differential style registration (step 4). Turning `rules` into a tagged union
(`kind: "expression" | "dataBar" | "colorScale"`) and switching on it in those three places is
enough. Block building, ranges, positioning, priorities and both builders stay as they are. The
plan's STOP condition does not apply. The one new piece is a shared worksheet `extLst` writer, since
data bars and sparklines must sit in the same `extLst`.

## 1. OOXML

Elements are from ECMA-376 Part 1, section 18.3.1 (Worksheets): `conditionalFormatting`, `cfRule`,
`cfvo`, `color`, `dataBar`, `colorScale`, `iconSet`. The section numbers below (§18.3.1.10 `cfRule`,
.11 `cfvo`, .16 `colorScale`, .28 `dataBar`, .49 `iconSet`) are from memory and should be checked
against the spec. The XML below is not from memory: it was produced by XlsxWriter 3.3.1
(`/private/tmp/claude-501/spikes-F/xml-ref/make_ref.py`, run with `uv run --with xlsxwriter`), a
widely used writer whose output Excel opens, and trimmed.

**Color scale (2 or 3 colors).** No extension needed.

```xml
<conditionalFormatting sqref="C2:C6">
  <cfRule type="colorScale" priority="3">
    <colorScale>
      <cfvo type="min" val="0"/>
      <cfvo type="percentile" val="50"/>
      <cfvo type="max" val="0"/>
      <color rgb="FFF8696B"/>
      <color rgb="FFFFEB84"/>
      <color rgb="FF63BE7B"/>
    </colorScale>
  </cfRule>
</conditionalFormatting>
```

A 2-color scale has two `cfvo` and two `color`. `cfvo type` is one of `min`, `max`, `num`,
`percent`, `percentile`, `formula`.

**Data bar, Excel 2007 form.** Works everywhere but looks dated: gradient fill, bars from 10% to 90%
of the cell, no special handling of negatives.

```xml
<cfRule type="dataBar" priority="2">
  <dataBar><cfvo type="min" val="0"/><cfvo type="max" val="0"/><color rgb="FF638EC6"/></dataBar>
</cfRule>
```

**Data bar, Excel 2010+ form** (solid fill, negative bars in another color, an axis). The 2007 rule
stays, gets an `x14:id`, and a matching `x14:cfRule` goes in the worksheet's `extLst`:

```xml
<conditionalFormatting sqref="A2:A6">
  <cfRule type="dataBar" priority="1">
    <dataBar><cfvo type="min"/><cfvo type="max"/><color rgb="FF638EC6"/></dataBar>
    <extLst>
      <ext xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main"
           uri="{B025F937-C7B1-47D3-B67F-A62EFF666E3E}">
        <x14:id>{DA7ABA51-AAAA-BBBB-0001-000000000001}</x14:id>
      </ext>
    </extLst>
  </cfRule>
</conditionalFormatting>
<!-- … pageMargins, drawing, tableParts … -->
<extLst>
  <ext xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main"
       uri="{78C0D931-6437-407d-A8EE-F0AAD7539E65}">
    <x14:conditionalFormattings>
      <x14:conditionalFormatting xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main">
        <x14:cfRule type="dataBar" id="{DA7ABA51-AAAA-BBBB-0001-000000000001}">
          <x14:dataBar minLength="0" maxLength="100" border="1" gradient="0"
                       negativeBarBorderColorSameAsPositive="0">
            <x14:cfvo type="autoMin"/><x14:cfvo type="autoMax"/>
            <x14:borderColor rgb="FF638EC6"/>
            <x14:negativeFillColor rgb="FFFF0000"/>
            <x14:negativeBorderColor rgb="FFFF0000"/>
            <x14:axisColor rgb="FF000000"/>
          </x14:dataBar>
        </x14:cfRule>
        <xm:sqref>A2:A6</xm:sqref>
      </x14:conditionalFormatting>
    </x14:conditionalFormattings>
  </ext>
</extLst>
```

The `x14` and `xm` namespaces are declared on the `ext` elements, so the worksheet root needs no new
namespace. The id is any GUID; XlsxWriter uses a fixed pattern, so typed-xlsx can number them
(`{00000000-0000-4000-8000-000000000001}`, …) and keep output deterministic.

**Icon set.** No extension needed for the 2007 sets (`3Arrows`, `3TrafficLights1`, `4Rating`,
`5Quarters`, …); the 2010 sets (`3Stars`, `3Triangles`, `5Boxes`) need an `x14` rule.

```xml
<cfRule type="iconSet" priority="4">
  <iconSet iconSet="3Arrows">
    <cfvo type="percent" val="0"/><cfvo type="percent" val="33"/><cfvo type="percent" val="67"/>
  </iconSet>
</cfRule>
```

**Order inside `extLst`.** With a data bar and a sparkline on one sheet, XlsxWriter writes the
conditional-formatting ext (`{78C0D931…}`) before the sparkline ext (`{05C60535…}`, the URI
typed-xlsx already uses at `src/sparkline/runtime.ts:11`) (`/private/tmp/claude-501/spikes-F/xml-ref/both.py`).
typed-xlsx must keep that order.

**Hand-built check.** `/private/tmp/claude-501/spikes-F/xml-ref/inject.ts` builds a typed-xlsx file and
injects a 2010 data bar, a 2-color and a 3-color scale into its sheet XML:
`/private/tmp/claude-501/spikes-F/xml-ref/typed-xlsx-scales.xlsx`. The XML parses (well-formed). It
was **not opened** in Excel or LibreOffice for this spike (LibreOffice is not installed; Excel was
not scripted). Opening that file is the first step of implementation.

## 2. API

### Options on the column

Two new column options next to `conditionalStyle`, on value and formula columns:

```ts nocheck
import { createExcelSchema } from "typed-xlsx";

type RegionSales = { region: string; revenue: number; margin: number; growth: number | null };

const sales = createExcelSchema<RegionSales>()
  .column("region", { header: "Region", accessor: "region" })
  .column("revenue", {
    header: "Revenue",
    accessor: "revenue",
    format: "#,##0",
    dataBar: {}, // theme color, automatic min/max, negatives in red with an axis
  })
  .column("margin", {
    header: "Margin",
    accessor: "margin",
    format: "0%",
    colorScale: { colors: [{ rgb: "FCFCFF" }, { rgb: "63BE7B" }], min: 0, max: 0.5 },
  })
  .column("growth", {
    header: "Growth",
    accessor: "growth",
    format: "0%",
    colorScale: { colors: "red-yellow-green", mid: 0 }, // 3 colors, midpoint fixed at 0
  })
  .build();
```

```ts nocheck
type ColorInput = { rgb: string }; // same shape as CellStyle colors

interface DataBarOptions {
  /** Bar color. Default: the theme's `dataBar` color (Excel's 638EC6). */
  color?: ColorInput;
  /** Color of bars for negative values. Default: theme `dataBarNegative` (FF0000). */
  negativeColor?: ColorInput;
  /** Fixed ends of the scale. Default: Excel's automatic min and max. */
  min?: number;
  max?: number;
  /** Hide the number and show only the bar. Default: false. */
  barOnly?: boolean;
}

type ColorScaleOptions =
  | {
      colors?: "red-yellow-green" | "green-yellow-red" | [ColorInput, ColorInput, ColorInput];
      min?: number;
      /** Value that gets the middle color. Default: the 50th percentile. */
      mid?: number;
      max?: number;
    }
  | {
      colors: "white-green" | "white-red" | [ColorInput, ColorInput];
      min?: number;
      max?: number;
    };
```

Why two options and not one `conditionalFormat: { dataBar, colorScale, iconSet }`:

- `conditionalStyle` is already a top-level option; `dataBar` and `colorScale` read as siblings.
- Each option is a single rule. Nesting adds a level for no choice.
- The numeric-type check (section 3) reports on the key at fault, which is clearer when the key is
  `dataBar` than when it is `conditionalFormat`.

Not in the first version: `cfvo` types `percent`, `percentile` and `formula` for `min`/`max`, and
icon sets (section 5). `min`/`max` as plain numbers become `cfvo type="num"`; when omitted, `min`/`max`
(color scale) or `autoMin`/`autoMax` (2010 data bar).

### How it composes with `conditionalStyle`

All rules of a column go in one `conditionalFormatting` block, in this order: `conditionalStyle`
rules first, then `colorScale`, then `dataBar`. Priorities are numbered in that order (the writer
already numbers across the sheet, `src/ooxml/worksheet-parts.ts:120-133`). So an explicit highlight
(`fill` from `conditionalStyle`) wins over the color scale's fill, which is what a reader expects. A
data bar draws on top of either fill, so it never conflicts.

### Ranges

| Situation                                                 | Range covered                                                           | Why                                                                                                           |
| --------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Report table                                              | the column's data rows; not header, title, group header or summary rows | Same block as `conditionalStyle` (`src/styles/conditional-runtime.ts:19-37`). Totals would flatten the scale. |
| Report table with sub-rows, value column expanded         | every sub-row                                                           | each sub-row holds a value                                                                                    |
| Report table with sub-rows, column merged across sub-rows | the whole data range; only the first row of each merge holds a value    | Excel ignores blank cells in color scales and data bars, so merges are fine                                   |
| Excel-table mode                                          | the table's data rows; not the header or totals row                     | same block; ranges are A1 refs, not structured refs, like `conditionalStyle` today                            |
| Stream mode                                               | data rows, known at `finish()` from `committedPhysicalRows`             | same as `conditionalStyle` (`src/workbook/stream.ts:649-655`)                                                 |
| Several tables on a sheet                                 | each table's own range, shifted with the table                          | existing positioning                                                                                          |
| Dynamic block (e.g. months)                               | **one rule per generated column**                                       | each generated column is a column. A heat map across all months needs a shared rule; see open question 1      |
| Summary rows                                              | not covered                                                             | they have their own `conditionalStyle`                                                                        |

## 3. Types: numeric columns only

The rule: `dataBar` and `colorScale` are allowed when the column's cell value, after `accessor`,
`transform` and `defaultValue`, is `number` (with `null`/`undefined` allowed). Dates are numbers in
Excel, but a color scale on dates is rare and `colorScale` on a `Date` column is more likely a
mistake; the first version rejects dates (open question 3).

The value type is already computed for each column: `ColumnValueOf<T, TDef, TAccessor, TTransformed,
TDefault, TResult>` (`src/schema/builder.ts:1340-1365`) feeds `WithColumnValue` (`:363-365`) in the
return type of `.column()` (`:2141-2184`), and `SchemaColumnValues` exposes it (`:1454-1457`). Charts
use the same idea to require numeric `y` columns (`ColumnsMatching`, `src/chart/types.ts:86-98`;
`CheckNumericColumn`, `:276-282`). Formula columns get `number` from arithmetic
(`FormulaColumnValue`, `src/schema/builder.ts:344-361`), so a formula column can take a data bar.

The check goes on the `definition` parameter of `.column()` as one more intersection, in the
library's error style (`ErrorMessage`, `src/core/type-errors.ts:7`):

```ts nocheck
type NumericVisualCheck<TDef, TValue> = TDef extends { dataBar: unknown } | { colorScale: unknown }
  ? [Present<TValue>] extends [never]
    ? unknown
    : [Present<TValue>] extends [number]
      ? unknown
      : {
          [
            K in keyof TDef & ("dataBar" | "colorScale")
          ]: ErrorMessage<`'${K}' needs a numeric column, and this column's cells hold ${Present<TValue> extends string ? "text" : "non-numbers"}. Use it on a number column, or convert the value in the accessor or transform`>;
        }
  : unknown;
```

What a user sees:

```ts nocheck
createExcelSchema<RegionSales>().column("region", {
  header: "Region",
  accessor: "region",
  dataBar: {},
});
//                                                           ~~~~~~~
// Type '{}' is not assignable to type 'DataBarOptions & "'dataBar' needs a numeric column, and this
// column's cells hold text. Use it on a number column, or convert the value in the accessor or transform"'.
```

**Prototype.** `/private/tmp/claude-501/spikes-F/types/model.ts` is a small model of `.column()`
(own `accessor`/`transform` generics, `const TDef`, the check above) compiled with TypeScript 6.0.3
`--strict`. Results: number and nullable-number columns pass; a text column and a `transform` that
turns a number into text both error on the `dataBar`/`colorScale` key with the message above;
`transform`'s `value` parameter is still inferred as `number` with the check in place (a probe that
assigns it to `string` errors with "Type 'number' is not assignable to type 'string'"). This is a
model, not the real builder: the real `.column()` signature (`src/schema/builder.ts:2141-2185` for reports, `:2374` for excel tables) has
more generics, and the repo also typechecks with `typescript-7`. The check must be confirmed there,
along with its cost on the type-performance tests.

Badge, checkbox, image, sparkline and hyperlink columns: set `dataBar?: never; colorScale?: never` the
same way `conditionalStyle?: never` is set today (`src/schema/builder.ts:515`), so the existing
"not an option of … columns" message lists the valid options.

## 4. Themes

The theme already carries colors for one feature, sparklines (`sparklineSeries`, `sparklineNegative`,
…, `src/styles/theme.ts:74-81`, default values at `:160-169`). Add four tokens with Excel's own
defaults, so a file looks like one made in Excel unless a theme says otherwise:

| Token                                              | Default                      | Used by                                      |
| -------------------------------------------------- | ---------------------------- | -------------------------------------------- |
| `dataBar`                                          | `638EC6`                     | bar color and border                         |
| `dataBarNegative`                                  | `FF0000`                     | negative fill and border                     |
| `dataBarAxis`                                      | `000000`                     | axis                                         |
| `colorScaleLow`, `colorScaleMid`, `colorScaleHigh` | `F8696B`, `FFEB84`, `63BE7B` | `colorScale: {}` with no `colors` (3 colors) |

Named presets (`"red-yellow-green"`, `"white-green"`, …) are fixed Excel colors, not theme colors,
so the name always means what it says.

## 5. Smallest first version

Ships:

- `colorScale` (2 and 3 colors, fixed `min`/`mid`/`max` numbers or automatic) and `dataBar` (2010
  form with the 2007 fallback inside, automatic or fixed ends, negative color, `barOnly`), on value
  and formula columns of report and excel-table schemas, in buffered and stream workbooks.
- The numeric type check.
- Theme tokens.

Left for later: icon sets (about 20 named sets, thresholds by percent/number/percentile, reverse
order, custom icons; worth a design of its own once the plumbing exists), percent/percentile/formula
bounds, a rule shared across a dynamic block or group (open question 1), and conditional formats on
summary rows.

## Implementation sketch

| File                                               | Change                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/styles/conditional-types.ts`                  | `DataBarOptions`, `ColorScaleOptions`, presets.                                                                                                                                                                                                                                                                                       |
| `src/styles/conditional-runtime.ts`                | `SerializedConditionalStyleRule` becomes a union: `{ kind: "expression", formula, priority, style }` / `{ kind: "colorScale", stops, priority }` / `{ kind: "dataBar", min, max, colors, barOnly, priority }`. `buildWorksheetConditionalFormatting` appends scale and bar rules after the expression rules; resolves theme defaults. |
| `src/ooxml/worksheet-parts.ts`                     | `writeWorksheetConditionalFormatting` switches on `kind`; for data bars assigns `x14:id`s from a per-workbook counter and returns the x14 rules to write at the end. New `writeWorksheetExtensions({ conditionalFormattings, sparklineGroups })` writes one `extLst`, CF ext first.                                                   |
| `src/sparkline/runtime.ts`                         | `writeWorksheetSparklines` returns the inner `ext` only; the `extLst` wrapper moves to `writeWorksheetExtensions`.                                                                                                                                                                                                                    |
| `src/ooxml/worksheet.ts`, `src/workbook/stream.ts` | Positioning resolves relative refs for expression rules only (`worksheet.ts:599-620`, `stream.ts:240-260`); stream style registration skips non-expression rules (`stream.ts:262-280`); both worksheet writers call `writeWorksheetExtensions` (`worksheet.ts:185`, `stream.ts:1575`).                                                |
| `src/schema/builder.ts`                            | The two options on `ColumnDefinition` (`:380-392`), `never` on other kinds, normalization (`:1505-1511`), `NumericVisualCheck` on `.column()` for report and excel-table builders.                                                                                                                                                    |
| `src/styles/theme.ts`                              | Four tokens and defaults.                                                                                                                                                                                                                                                                                                             |
| Skill and docs                                     | `skills/typed-xlsx/references/styling.md` (new section next to `conditionalStyle`), `columns.md` option table, SKILL.md technique table row ("A heat map or in-cell bar" → `colorScale` / `dataBar`), docs styling page, kitchen-sink: one `dataBar` and one `colorScale` column.                                                     |

## Test plan

1. **XML, buffered** (`test/ooxml.test.ts` style): a column with `colorScale` writes the exact
   `cfRule type="colorScale"` above with the right `sqref`; with `mid` it writes `cfvo type="num"`;
   presets map to the right colors.
2. **XML, data bar**: the `cfRule` has the `x14:id` ext; the worksheet `extLst` has the matching
   `x14:cfRule` with the same id and `xm:sqref`; ids are unique across sheets and stable across runs
   (two builds give byte-identical sheets).
3. **extLst order**: a sheet with a sparkline column and a data bar has one `extLst` with the CF ext
   before the sparkline ext.
4. **Composition**: `conditionalStyle` + `colorScale` on one column gives one block with priorities
   expression < scale; stream mode registers only the expression rule's dxf.
5. **Ranges**: report table with title and summary rows (scale covers data rows only); sub-rows;
   excel-table with totals row; two tables side by side (each range shifted); stream with 3 commits
   (range ends at the last committed row); empty table (no block, as `conditionalStyle` does today,
   `src/styles/conditional-runtime.ts:26-28`).
6. **Types** (`test/type-safety.ts`, `test/type-errors/`): number, nullable number, formula column
   pass; string column, `transform` to string, `Date` column fail with the message on the key;
   `dataBar` on a badge column gives the "not an option" message.
7. **Theme**: a theme overriding `dataBar` changes the bar color; explicit `color` wins over the theme.
8. **Real apps** (manual, once): open the kitchen-sink output in Excel and LibreOffice; check bars,
   negative bars and both scales render.

## Open questions for the maintainer

1. **Heat map across a dynamic block.** A region × month heat map wants one color scale over all
   month columns, not one per month. Options: (a) `colorScale: { across: "block" }` on the column,
   sharing one rule with every column of the same dynamic block or group that also says so (the
   runtime knows each column's `dynamicPath`/`groupPath`; the ids can't be typed inside a dynamic
   builder, which does not know its parent's id); (b) an option on `.group()` (which has an options
   object); (c) later. One rule over several ranges is a space-separated `sqref`
   (`"B2:B20 C2:C20 …"`), which the positioning code (single `shiftWorksheetRange`) would need to
   handle. Should this be in the first version? It is the motivating use case in the plan; it adds
   about a day.
2. **Icon sets**: wanted at all, and if so which subset (3 arrows, traffic lights, ratings)?
3. **Dates**: allow `colorScale` on `Date` columns (age of an invoice as a heat map), or keep them out?
4. **2007-only data bars**: always write the 2010 extension (recommended; Excel 2007 is long gone and
   ignores it anyway), or offer a switch?

## Effort

M, about 3–4 days: rule union, writer and extension plumbing 1 day; column options, theme tokens,
normalization half a day; type check and type tests 1 day (most risk: inference and type-check cost
in the real builder); tests and the manual Excel/LibreOffice check half a day; docs, skill and
kitchen-sink half a day. Open question 1 adds about a day.
