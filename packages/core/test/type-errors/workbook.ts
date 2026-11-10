import { createExcelSchema, createWorkbook, createWorkbookStream } from "typed-xlsx";

type Sale = {
  month: string;
  region: string;
  revenue: number;
  orders: number;
  closed: boolean;
  orderedAt: Date;
  shippedAt: Date | null;
};

const sales = createExcelSchema<Sale>()
  .column("month", { accessor: "month" })
  .column("region", { accessor: "region" })
  .column("revenue", { accessor: "revenue", summary: (summary) => [summary.formula("sum")] })
  .column("orders", { accessor: "orders" })
  .column("closed", { type: "checkbox", accessor: "closed" })
  .column("orderedAt", { accessor: "orderedAt" })
  .column("shippedAt", { accessor: "shippedAt" })
  .build();

const excelSales = createExcelSchema<Sale>({ mode: "excel-table" })
  .column("month", { accessor: "month" })
  .column("revenue", { accessor: "revenue" })
  .build();

const rows: Sale[] = [];
const book = () => createWorkbook().sheet("Sales").table("sales", { schema: sales, rows });

// ── Valid usage keeps compiling ──────────────────────────────────────────────

book()
  .chart("revenue", ({ refs }) => ({
    title: "Revenue",
    marks: [refs.table("sales").bar({ x: "month", y: ["revenue", "orders"] })],
  }))
  .sheet("Analysis")
  .pivot("byRegion", ({ refs }) =>
    refs
      .sheet("Sales")
      .table("sales")
      .pivot({
        rows: ["region", { field: "orderedAt", by: ["year", "month"] }],
        values: { revenue: "sum", month: "count", orders: { aggregate: "average", name: "Avg" } },
      }),
  );

createWorkbook()
  .sheet("Table")
  .table("t", { schema: excelSales, rows, totalsRow: true, style: "TableStyleMedium2" });

// ── Sheets and tables ────────────────────────────────────────────────────────

// @error freezPane: Did you mean to write 'freezePane'?
createWorkbook().sheet("Sales", { freezPane: { rows: 1 } });

// @error titel: 'titel' is not a table option. Options:
createWorkbook().sheet("Sales").table("sales", { schema: sales, rows, titel: "Sales" });

// @error totalsRow: 'totalsRow' is not a table option
createWorkbook().sheet("Sales").table("sales", { schema: sales, rows, totalsRow: true });

createWorkbook()
  .sheet("Sales")
  // @error {: missing the following properties from type 'Sale'
  .table("sales", { schema: sales, rows: [{ month: "Jan" }] });

createWorkbook()
  .sheet("Sales")
  // @error "revenu": Did you mean '"revenue"'?
  .table("sales", { schema: sales, rows, select: { include: ["revenu"] } });

// ── Charts ───────────────────────────────────────────────────────────────────

book().chart("c", ({ refs }) => ({
  // @error titel: 'titel' is not a chart option. Options:
  titel: "Revenue",
  marks: [refs.table("sales").bar({ x: "month", y: "revenue" })],
}));

book().chart("c", ({ refs }) => ({
  // @error y: 'region' is not a numeric column. Numeric columns: revenue, orders
  marks: [refs.table("sales").bar({ x: "month", y: "region" })],
}));

book().chart("c", ({ refs }) => ({
  // @error y: Did you mean '"revenue"'?
  marks: [refs.table("sales").bar({ x: "month", y: "revenu" })],
}));

book().chart("c", ({ refs }) => ({
  // @error "region": 'region' is not a numeric column
  marks: [refs.table("sales").line({ x: "month", y: ["revenue", "region"] })],
}));

book().chart("c", ({ refs }) => ({
  // @error gapp: 'gapp' is not an option of this mark. Options:
  marks: [refs.table("sales").bar({ x: "month", y: "revenue", gapp: 10 })],
}));

book().chart("c", ({ refs }) => ({
  // @error "tables": '"tables"' is not assignable to parameter of type '"sales"'
  marks: [refs.table("tables").bar({ x: "month", y: "revenue" })],
}));

// ── Pivots ───────────────────────────────────────────────────────────────────

book().pivot("p", ({ refs }) =>
  // @error month: 'month' is not numeric, so it can only be counted
  refs.table("sales").pivot({ rows: ["region"], values: { month: "sum" } }),
);

book().pivot("p", ({ refs }) =>
  // @error revenue: Did you mean '"sum"'?
  refs.table("sales").pivot({ rows: ["region"], values: { revenue: "summ" } }),
);

book().pivot("p", ({ refs }) =>
  // @error "regoin": Did you mean '"region"'?
  refs.table("sales").pivot({ rows: ["regoin"], values: { revenue: "sum" } }),
);

book().pivot("p", ({ refs }) =>
  refs.table("sales").pivot({
    // @error field: 'shippedAt' can be blank
    rows: [{ field: "shippedAt", by: "month" }],
    values: { revenue: "sum" },
  }),
);

book().pivot("p", ({ refs }) =>
  refs.table("sales").pivot({
    // @error field: 'region' is not a date column. Date columns: orderedAt
    rows: [{ field: "region", by: "year" }],
    values: { revenue: "sum" },
  }),
);

book().pivot("p", ({ refs }) =>
  refs.table("sales").pivot({
    rows: ["region"],
    values: { revenue: "sum" },
    // @error sorted: 'sorted' is not a pivot option. Options:
    sorted: "ascending",
  }),
);

// ── Streams ──────────────────────────────────────────────────────────────────

export async function stream() {
  const workbook = createWorkbookStream();
  const table = await workbook.sheet("Sales").table("sales", { schema: sales });
  // @error month: Type 'number' is not assignable to type 'string'
  await table.commit({ rows: [{ ...rows[0]!, month: 1 }] });

  workbook.sheet("Dashboard").chart("c", {
    // @error titel: 'titel' is not a chart option
    titel: "x",
    marks: [table.bar({ x: "month", y: "revenue" })],
  });
}

// ── Inputs that used to crash at write time ──────────────────────────────────

book().chart("c", ({ refs }) => ({
  // @error x: Type 'number' is not assignable to type
  marks: [refs.table("sales").bar({ x: 123, y: "revenue" })],
}));

book().pivot("p", ({ refs }) =>
  // @error rows: A pivot needs at least one row field
  refs.table("sales").pivot({ rows: [], values: { revenue: "sum" } }),
);

book().pivot("p", ({ refs }) =>
  // @error revenue: is not assignable to type
  refs.table("sales").pivot({ rows: ["region"], values: { revenue: {} } }),
);

book().pivot("p", ({ refs }) =>
  // @error rows: Pivot fields are a list
  refs.table("sales").pivot({ rows: "region", values: { revenue: "sum" } }),
);
