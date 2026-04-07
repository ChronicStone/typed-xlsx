import { createExcelSchema } from "typed-xlsx";
import type { FulfillmentRow } from "./data";

export const fulfillmentExportSchema = createExcelSchema<FulfillmentRow>()
  .column("shipmentId", {
    header: "Shipment",
    accessor: "shipmentId",
    minWidth: 16,
    summary: (summary) => [summary.label("Shipment totals"), summary.label("Rate average")],
  })
  .column("warehouse", { header: "Warehouse", accessor: "warehouse", minWidth: 14 })
  .column("carrier", { header: "Carrier", accessor: "carrier", width: 12 })
  .column("region", { header: "Region", accessor: "region", width: 10 })
  .column("orderCount", {
    header: "Orders",
    accessor: "orderCount",
    width: 10,
    style: { alignment: { horizontal: "right" } },
    summary: (summary) => [summary.formula("sum"), summary.empty()],
  })
  .column("shippedUnits", {
    header: "Shipped Units",
    accessor: "shippedUnits",
    width: 14,
    style: { alignment: { horizontal: "right" } },
    summary: (summary) => [summary.formula("sum"), summary.empty()],
  })
  .column("backlogUnits", {
    header: "Backlog",
    accessor: "backlogUnits",
    width: 10,
    style: { alignment: { horizontal: "right" } },
    conditionalStyle: (conditional) =>
      conditional.when(({ refs }) => refs.column("backlogUnits").gte(25), {
        fill: { color: { rgb: "FEF3C7" } },
        font: { color: { rgb: "92400E" }, bold: true },
      }),
    summary: (summary) => [summary.formula("sum"), summary.empty()],
  })
  .column("fillRate", {
    header: "Fill Rate",
    formula: ({ refs, fx }) =>
      fx.safeDiv(
        refs.column("shippedUnits"),
        refs.column("shippedUnits").add(refs.column("backlogUnits")),
      ),
    width: 12,
    style: { numFmt: "0.0%", alignment: { horizontal: "right" } },
    summary: (summary) => [summary.empty(), summary.formula("average")],
  })
  .column("shippedAt", {
    header: "Shipped At",
    accessor: "shippedAt",
    width: 14,
    style: { numFmt: "yyyy-mm-dd" },
  })
  .build();
