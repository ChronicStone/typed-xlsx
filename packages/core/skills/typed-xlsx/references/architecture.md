# Structuring reports in an application

Patterns for apps with many exports, taken from production codebases.

## Contents

- [One module per report](#one-module-per-report)
- [A shared context type](#a-shared-context-type)
- [Column helpers](#column-helpers)
- [Typing functions that take any schema](#typing-functions-that-take-any-schema)
- [A report registry](#a-report-registry)
- [Testing reports](#testing-reports)

## One module per report

Keep each schema next to the feature it exports (`billing/reports/invoice.report.ts`), exported as a built constant. The row type is the export view of your data, often a dedicated query result, not the database model.

```ts nocheck
// billing/reports/invoice.report.ts
export const invoiceReportSchema = createExcelSchema<InvoiceReportRow, ReportContext>()
  .column(...)
  .build();
```

Building a schema is cheap and pure, so module-level constants are fine. Rows and context are passed per export.

## A shared context type

Most exports in an app need the same inputs: the locale, a translator, the user's role, the reporting period. Define them once and extend per report.

```ts
import { createExcelSchema } from "typed-xlsx";

type Locale = "en" | "fr";
type Role = "admin" | "manager" | "member";

export type ReportContext = {
  locale: Locale;
  t: (key: string) => string;
  role: Role;
  period?: { from: Date; to: Date };
};

export type InvoiceReportContext = ReportContext & { currencies: Array<"EUR" | "USD"> };

type InvoiceRow = {
  number: string;
  issuedAt: Date;
  totals: Record<"EUR" | "USD", number>;
  margin: number;
};

const isAdmin = (ctx: ReportContext) => ctx.role === "admin";

export const invoiceReport = createExcelSchema<InvoiceRow, InvoiceReportContext>()
  .column("number", {
    header: ({ ctx }) => ctx.t("invoice.number"),
    accessor: "number",
    summary: (s) => [s.label(({ ctx }) => ctx.t("common.total"))],
  })
  .column("issuedAt", {
    header: ({ ctx }) => ctx.t("invoice.issuedAt"),
    accessor: "issuedAt",
    format: "yyyy-mm-dd",
  })
  .dynamic("totals", (builder, { ctx }) => {
    for (const currency of ctx.currencies) {
      builder.column(`total-${currency}`, {
        header: ({ ctx: c }) => `${c.t("invoice.total")} (${currency})`,
        accessor: (row) => row.totals[currency],
        format: currency === "EUR" ? '#,##0.00 "€"' : '"$"#,##0.00',
        summary: (s) => [s.formula("sum")],
      });
    }
  })
  .column("margin", {
    header: ({ ctx }) => ctx.t("invoice.margin"),
    accessor: "margin",
    format: "0.0%",
    condition: ({ ctx }) => isAdmin(ctx),
  })
  .build();
```

- Role-based columns: `condition` with a shared predicate (`isAdmin(ctx)`), so the rule lives in one place.
- Translations: headers, labels, enum values and summary labels all go through `ctx.t`. One schema serves every language.
- A translator typed with your catalog's keys (`(key: TranslationKey) => string`) makes missing keys a type error.

## Column helpers

When many reports repeat the same column (a yes/no flag, a money amount, a localized label), write a function that returns the options. Keep it generic over the row so the accessor stays checked.

```ts
import { createExcelSchema } from "typed-xlsx";

type Ctx = { t: (key: string) => string };

const yesNo = <Row>(accessor: (row: Row) => boolean) => ({
  accessor,
  transform: ({ value, ctx }: { value: boolean; ctx: Ctx }) =>
    ctx.t(value ? "common.yes" : "common.no"),
  width: 10,
});

const money = (currency: "EUR" | "USD") => ({
  format: currency === "EUR" ? '#,##0.00 "€"' : '"$"#,##0.00',
});

type Account = { name: string; active: boolean; balance: number };

export const accounts = createExcelSchema<Account, Ctx>()
  .column("name", { header: ({ ctx }) => ctx.t("account.name"), accessor: "name" })
  .column("active", {
    header: ({ ctx }) => ctx.t("account.active"),
    ...yesNo<Account>((row) => row.active),
  })
  .column("balance", {
    header: ({ ctx }) => ctx.t("account.balance"),
    accessor: "balance",
    ...money("EUR"),
  })
  .build();
```

Prefer small option helpers spread into `.column()` over wrapping the builder: the column id and the type checks stay visible at the call site.

## Typing functions that take any schema

Use the exported types to write export helpers that accept any schema and keep `select` and `context` typed.

| Type                                                                 | Gives                           |
| -------------------------------------------------------------------- | ------------------------------- |
| `ReportSchemaDefinition<Row, ColumnId, GroupId, DynamicId, Context>` | a built report schema           |
| `ExcelTableSchemaDefinition<…>`                                      | a built excel-table schema      |
| `SchemaColumnId<S>`, `SchemaGroupId<S>`, `SchemaDynamicId<S>`        | the ids `select` accepts        |
| `SchemaContextOf<S>`                                                 | the context a schema needs      |
| `SchemaColumnValues<S>`                                              | each column's value type        |
| `TableSelection<Id>`                                                 | `{ include } \| { exclude }`    |
| `WorkbookStream`, `WorkbookTableStream<Row>`                         | stream builder and table handle |

```ts
import { createWorkbook, type ReportSchemaDefinition, type TableSelection } from "typed-xlsx";

type ReportContext = { locale: string; t: (key: string) => string };

export function exportToBytes<
  Row extends object,
  ColumnId extends string,
  GroupId extends string,
  DynamicId extends string,
>(options: {
  sheetName: string;
  schema: ReportSchemaDefinition<Row, ColumnId, GroupId, DynamicId, ReportContext>;
  rows: Row[];
  context: ReportContext;
  select?: TableSelection<ColumnId | GroupId | DynamicId>;
}) {
  const workbook = createWorkbook();
  workbook.sheet(options.sheetName, { freezePane: { rows: 1 } }).table("data", {
    schema: options.schema,
    rows: options.rows,
    context: options.context,
    ...(options.select ? { select: options.select } : {}),
  });
  return workbook.toUint8Array();
}
```

Keep the context type fixed in such helpers (your app's shared `ReportContext`, or an intersection your reports all satisfy). A helper generic over the context type itself can't pass `context` to `.table()`: whether a table needs `context` is computed from the schema's context type, and TypeScript can't compute it for an unknown type parameter.

## A report registry

When exports run as background jobs, register each report as data: a kind, how to load rows, how to build the context, the schema. The runner owns the workbook, paging, sheet splitting, progress and cleanup, so each report file only describes its columns and data.

```ts nocheck
export const invoiceExport = defineReport({
  kind: "invoices",
  sheetName: "invoice.sheetName",
  schema: invoiceReport,
  createContext: (base) => ({
    ...base,
    currencies: base.preferredCurrency ? [base.preferredCurrency] : ["EUR", "USD"],
  }),
  columns: (ctx) => (ctx.role === "member" ? { exclude: ["margin"] } : undefined),
  data: { scan: (request, consume) => invoiceQuery.scan(request, consume) },
});
```

Reports that need several sheets (a summary plus one sheet per item) register a function that yields sheet plans instead of one schema; see [streaming](streaming.md#several-sheets-from-one-source).

## Testing reports

- Type checks catch most mistakes; run them in CI.
- Build each report once with a few representative rows (including nulls, empty arrays, the longest labels) and assert it writes without throwing. Rules about excluded formula inputs, sub-rows in excel-tables and chart alignment are checked at write time.
- To assert content, unzip the bytes and read `xl/worksheets/sheet1.xml`, or load the file with a spreadsheet reader in tests.
