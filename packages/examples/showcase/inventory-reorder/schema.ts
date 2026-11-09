import { createExcelSchema } from "typed-xlsx";
import { SUPPLIERS, type StockItem } from "./data";

const input = { protection: { locked: false }, fill: { color: { rgb: "FFFBEB" } } } as const;

/**
 * Sales history and stock are baked in. Weeks of cover, the reorder flag and the order value are
 * formulas, so they update as soon as a buyer types a quantity in the yellow cells.
 */
export const stockSchema = createExcelSchema<StockItem, { weeks: string[] }>()
  .column("sku", { header: "SKU", accessor: "sku", width: 11 })
  .column("product", { header: "Product", accessor: "product", minWidth: 24 })
  .column("warehouse", { header: "Warehouse", accessor: "warehouse", width: 11 })
  .group("sales", { header: "Units sold per week" }, (g) =>
    g.dynamic("weeks", (builder, { ctx }) => {
      for (const week of ctx.weeks)
        builder.column(week, {
          header: week,
          accessor: (row) => row.salesByWeek[week] ?? 0,
          width: 6,
        });
    }),
  )
  .column("trend", {
    type: "sparkline",
    header: "Trend",
    source: { group: "sales" },
    sparklineType: "column",
    width: 12,
    style: { series: "#64748B", high: { color: "#0EA5E9" } },
  })
  .column("onHand", { header: "On hand", accessor: "onHand", width: 9, style: { numFmt: "#,##0" } })
  .column("inbound", {
    header: "Inbound",
    accessor: "inbound",
    width: 9,
    style: { numFmt: "#,##0" },
  })
  .column("weeklyAvg", {
    header: "Avg / week",
    formula: ({ refs, fx }) => fx.round(fx.sum(refs.group("sales")).div(8), 0),
    width: 10,
  })
  .column("cover", {
    header: "Weeks of cover",
    formula: ({ refs, fx }) =>
      fx.round(
        fx.safeDiv(refs.column("onHand").add(refs.column("inbound")), refs.column("weeklyAvg"), 0),
        1,
      ),
    width: 13,
    style: { numFmt: "0.0" },
    conditionalStyle: (c) =>
      c
        .when(({ refs }) => refs.column("cover").lt(2), {
          fill: { color: { rgb: "FEE2E2" } },
          font: { color: { rgb: "991B1B" }, bold: true },
        })
        .when(({ refs }) => refs.column("cover").lt(4), {
          fill: { color: { rgb: "FEF3C7" } },
          font: { color: { rgb: "92400E" } },
        }),
  })
  .column("leadTimeDays", {
    header: "Lead time",
    accessor: (row) => `${row.leadTimeDays} d`,
    width: 9,
  })
  .group("order", { header: "Purchase order (edit the yellow cells)" }, (g) =>
    g
      .column("supplier", {
        header: "Supplier",
        accessor: "supplier",
        minWidth: 18,
        style: input,
        validation: (v) => v.list(SUPPLIERS),
      })
      .column("reorderQty", {
        header: "Order qty",
        accessor: "reorderQty",
        width: 10,
        style: { ...input, numFmt: "#,##0" },
        validation: (v) => v.integer().between(0, 5000),
      })
      .column("unitCost", {
        header: "Unit cost",
        accessor: "unitCost",
        width: 10,
        style: { numFmt: '"€"#,##0.00' },
      })
      .column("orderValue", {
        header: "Order value",
        formula: ({ refs }) => refs.column("reorderQty").mul(refs.column("unitCost")),
        width: 12,
        style: { numFmt: '"€"#,##0', font: { bold: true } },
        summary: (s) => [s.formula("sum")],
      }),
  )
  .column("status", {
    header: "Status",
    formula: ({ refs, fx }) =>
      fx.if(
        refs.column("reorderQty").gt(0),
        "Ordered",
        fx.if(refs.column("cover").lt(4), "Reorder", "OK"),
      ),
    width: 10,
    conditionalStyle: (c) =>
      c
        .when(({ refs }) => refs.column("status").eq("Reorder"), {
          fill: { color: { rgb: "B91C1C" } },
          font: { color: { rgb: "FFFFFF" }, bold: true },
        })
        .when(({ refs }) => refs.column("status").eq("Ordered"), {
          fill: { color: { rgb: "DBEAFE" } },
          font: { color: { rgb: "1E40AF" }, bold: true },
        }),
  })
  .build();
