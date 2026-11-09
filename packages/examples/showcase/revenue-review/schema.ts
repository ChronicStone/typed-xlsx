import { createExcelSchema } from "typed-xlsx";
import type { MonthlyRow, Order } from "./data";

const money = { numFmt: "#,##0" };

export const ordersSchema = createExcelSchema<Order>()
  .column("id", { header: "Order", accessor: "id", width: 11 })
  .column("orderedAt", {
    header: "Ordered",
    accessor: "orderedAt",
    width: 12,
    style: { numFmt: "yyyy-mm-dd" },
  })
  .column("customer", { header: "Customer", accessor: "customer", minWidth: 24 })
  .column("region", { header: "Region", accessor: "region", width: 15 })
  .column("channel", { header: "Channel", accessor: "channel", width: 12 })
  .column("product", { header: "Product", accessor: "product", width: 13 })
  .column("seats", { header: "Seats", accessor: "seats", width: 8 })
  .column("revenue", {
    header: "Revenue",
    accessor: "revenue",
    width: 12,
    style: money,
    summary: (s) => [s.formula("sum")],
  })
  .column("cost", {
    header: "Cost",
    accessor: "cost",
    width: 11,
    style: money,
    summary: (s) => [s.formula("sum")],
  })
  .column("margin", {
    header: "Margin %",
    formula: ({ refs, fx }) =>
      fx.safeDiv(refs.column("revenue").sub(refs.column("cost")), refs.column("revenue"), 0),
    width: 10,
    style: { numFmt: "0.0%" },
    conditionalStyle: (c) =>
      c.when(({ refs }) => refs.column("margin").lt(0.62), {
        font: { color: { rgb: "B42318" }, bold: true },
      }),
  })
  .build();

export const monthlySchema = createExcelSchema<MonthlyRow>()
  .column("month", { header: "Month", accessor: "month", width: 10 })
  .column("revenue", { header: "Revenue", accessor: "revenue", width: 13, style: money })
  .column("target", { header: "Plan", accessor: "target", width: 13, style: money })
  .column("vsPlan", {
    header: "vs plan",
    formula: ({ refs, fx }) =>
      fx.safeDiv(refs.column("revenue").sub(refs.column("target")), refs.column("target"), 0),
    width: 10,
    style: { numFmt: "+0.0%;-0.0%;0.0%" },
    conditionalStyle: (c) =>
      c
        .when(({ refs }) => refs.column("vsPlan").gte(0), {
          fill: { color: { rgb: "DCFCE7" } },
          font: { color: { rgb: "166534" } },
        })
        .when(({ refs }) => refs.column("vsPlan").lt(0), {
          fill: { color: { rgb: "FEE2E2" } },
          font: { color: { rgb: "991B1B" } },
        }),
  })
  .column("cost", { header: "Cost", accessor: "cost", width: 13, style: money })
  .column("marginRate", {
    header: "Margin %",
    formula: ({ refs, fx }) =>
      fx.safeDiv(refs.column("revenue").sub(refs.column("cost")), refs.column("revenue"), 0),
    width: 10,
    style: { numFmt: "0.0%" },
  })
  .build();
