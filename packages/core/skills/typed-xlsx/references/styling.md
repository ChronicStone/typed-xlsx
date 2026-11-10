# Styling

## Contents

- [Which tool](#which-tool)
- [CellStyle](#cellstyle)
- [Number formats](#number-formats)
- [Themes](#themes)
- [Per-row styles](#per-row-styles)
- [Conditional styles](#conditional-styles)
- [Table defaults](#table-defaults)

## Which tool

| Need                                                             | Use                                                          |
| ---------------------------------------------------------------- | ------------------------------------------------------------ |
| The same look for every table of a report, or a brand            | a theme on the schema (`.theme(...)`) or the table (`theme`) |
| A number or date format                                          | `format` (or `style.numFmt`)                                 |
| A fixed look for a column                                        | `style: CellStyle`, `headerStyle`                            |
| A look decided by the row's data at export time                  | `style: ({ row, ctx }) => CellStyle`                         |
| A look that follows edits in Excel, or styles a formula's result | `conditionalStyle`                                           |
| Input cells vs locked cells, row height, one table's header      | table `defaults`                                             |

Layers stack from theme to cell; a higher layer overrides only the properties it sets.

## CellStyle

Every field is optional. Colors are `{ rgb: "RRGGBB" }` (no `#`).

```ts
import type { CellStyle } from "typed-xlsx";

export const highlight: CellStyle = {
  font: { bold: true, color: { rgb: "991B1B" }, size: 11, name: "Calibri", italic: false },
  fill: { color: { rgb: "FEE2E2" } },
  border: { bottom: { style: "thin", color: { rgb: "CBD5E1" } } },
  alignment: { horizontal: "right", vertical: "center", wrapText: false, indent: 0 },
  numFmt: "#,##0.00",
  protection: { locked: true, hidden: false },
};
```

Border styles: `thin`, `medium`, `thick`, `dashed`, `dotted`, `double`, `hair`, `dashDot`, `dashDotDot`. Alignment also takes `shrinkToFit`, `textRotation`, `readingOrder`.

## Number formats

| Format                                   | Shows                                                    |
| ---------------------------------------- | -------------------------------------------------------- |
| `#,##0` / `#,##0.00`                     | 1,234 / 1,234.56                                         |
| `"$"#,##0.00`                            | $1,234.56                                                |
| `#,##0.00 "€"`                           | 1,234.56 €                                               |
| `#,##0;[Red]-#,##0`                      | negatives in red                                         |
| `0%` / `0.0%`                            | 25% / 25.0% (value 0.25)                                 |
| `yyyy-mm-dd`, `dd/mm/yyyy`, `d mmm yyyy` | dates                                                    |
| `yyyy-mm-dd hh:mm`                       | date and time                                            |
| `[h]:mm`                                 | durations over 24 hours (value in days: seconds / 86400) |
| `@`                                      | force text (ids with leading zeros)                      |

Quote literal text inside formats: `'"$"#,##0'`, `'#,##0 "pts"'`.

## Themes

`spreadsheetThemes` has `classic` (default), `slate`, `forest`, `rose`, `ocean`. `defineSpreadsheetTheme({ tokens, slots })` makes your own; `.extend({ slots })` derives one. Slots: `title`, `groupHeader`, `groupHeaderFiller`, `header`, `summary`, `cellBase`, `cellLocked`, `cellUnlocked`, `cellHidden`, `hyperlink`, and pivot slots.

```ts
import { createExcelSchema, defineSpreadsheetTheme, spreadsheetThemes } from "typed-xlsx";

export const brand = defineSpreadsheetTheme({
  tokens: {
    colors: {
      titleFill: "0E3B26",
      headerFill: "17603D",
      headerText: "FFFFFF",
      summaryFill: "E7F4EC",
    },
  },
  slots: { summary: { font: { bold: true } } },
});

export const watchlist = spreadsheetThemes.slate.extend({
  slots: {
    title: { fill: { color: { rgb: "450A0A" } }, font: { color: { rgb: "FFFFFF" }, bold: true } },
  },
});

export const accounts = createExcelSchema<{ name: string; arr: number }>()
  .theme(brand)
  .column("name", { accessor: "name" })
  .column("arr", { accessor: "arr", format: '"$"#,##0' })
  .build();
```

A theme on the table (`table(id, { theme })`) overrides the schema's for that table: one schema, several looks. Reuse a slot in a column with `theme.slot("header", overrides)`.

## Per-row styles

`style` as a function receives `{ row, rowIndex, subRowIndex, ctx }`. It runs at export time.

```ts
import { createExcelSchema, type CellStyle } from "typed-xlsx";

type Account = { name: string; margin: number; depth: number };

const band = (margin: number): CellStyle =>
  margin < 0.1
    ? { fill: { color: { rgb: "FEE2E2" } }, font: { color: { rgb: "991B1B" } } }
    : margin < 0.3
      ? { fill: { color: { rgb: "FEF3C7" } }, font: { color: { rgb: "92400E" } } }
      : { fill: { color: { rgb: "DCFCE7" } }, font: { color: { rgb: "166534" } } };

export const margins = createExcelSchema<Account>()
  .column("name", {
    accessor: "name",
    style: ({ row }) => ({ alignment: { indent: row.depth }, font: { bold: row.depth === 0 } }),
  })
  .column("margin", {
    accessor: "margin",
    style: ({ row }) => ({ ...band(row.margin), numFmt: "0.0%" }),
  })
  .build();
```

Keep the number format in `format` next to a style function; both apply. Define style objects once outside the callback; identical styles are stored once in the file.

## Conditional styles

Native conditional formats, evaluated by Excel. Use them on formula columns and on cells readers edit. Conditions use the formula DSL; the column's `style` stays the base.

```ts
import { createExcelSchema } from "typed-xlsx";

type Deal = { amount: number; quota: number };

export const attainment = createExcelSchema<Deal>()
  .column("amount", { accessor: "amount" })
  .column("quota", { accessor: "quota" })
  .column("attainment", {
    formula: ({ refs, fx }) => fx.safeDiv(refs.column("amount"), refs.column("quota")),
    format: "0.0%",
    conditionalStyle: (c) =>
      c
        .when(({ refs }) => refs.column("attainment").lt(0.5), {
          fill: { color: { rgb: "FEE2E2" } },
        })
        .when(({ refs }) => refs.column("attainment").gte(1), {
          fill: { color: { rgb: "DCFCE7" } },
        }),
  })
  .build();
```

Rules apply in order and overlay the base style. They can't change protection (locked or hidden).

## Table defaults

`defaults` on a table restyles that table without touching columns: `header`, `summary`, body cells by protection state (`cells.locked`, `cells.unlocked`, `cells.hidden`), and a minimum `rowHeight`. Presets: `header.accent`, `header.inverse`, `summary.subtle`, `cell.input`, `cell.locked`, `cell.hidden`, or `{ style }`.

```ts
import { createExcelSchema, createWorkbook } from "typed-xlsx";

type Target = { account: string; current: number; target: number };

const targets = createExcelSchema<Target>()
  .column("account", { accessor: "account" })
  .column("current", { accessor: "current" })
  .column("target", { accessor: "target", style: { protection: { locked: false } } })
  .build();

createWorkbook()
  .sheet("Targets", { protection: true })
  .table("targets", {
    schema: targets,
    rows: [],
    defaults: {
      rowHeight: 22,
      header: { preset: "header.accent" },
      cells: { unlocked: { preset: "cell.input" } },
    },
  });
```
