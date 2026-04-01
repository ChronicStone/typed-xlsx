import { createExcelSchema } from "@chronicstone/typed-xlsx";
import type { FulfillmentRow } from "./data";

export const fulfillmentExportSchema = createExcelSchema<FulfillmentRow>()
  .column("shipmentId", { header: "Shipment", accessor: "shipmentId", minWidth: 16 })
  .column("warehouse", { header: "Warehouse", accessor: "warehouse", minWidth: 14 })
  .column("carrier", { header: "Carrier", accessor: "carrier", width: 12 })
  .column("region", { header: "Region", accessor: "region", width: 10 })
  .column("orderCount", {
    header: "Orders",
    accessor: "orderCount",
    width: 10,
    style: { alignment: { horizontal: "right" } },
    summary: (summary) => [summary.label("TOTAL"), summary.formula("sum")],
  })
  .column("shippedUnits", {
    header: "Shipped Units",
    accessor: "shippedUnits",
    width: 14,
    style: { alignment: { horizontal: "right" } },
    summary: (summary) => [summary.label("TOTAL"), summary.formula("sum")],
  })
  .column("backlogUnits", {
    header: "Backlog",
    accessor: "backlogUnits",
    width: 10,
    style: { alignment: { horizontal: "right" } },
    conditionalStyle: (conditional) =>
      conditional.when(({ row }) => row.ref("backlogUnits").gte(25), {
        fill: { color: { rgb: "FEF3C7" } },
        font: { color: { rgb: "92400E" }, bold: true },
      }),
  })
  .column("fillRate", {
    header: "Fill Rate",
    formula: ({ row, fx }) =>
      fx.if(
        row.ref("shippedUnits").add(row.ref("backlogUnits")).gt(0),
        row.ref("shippedUnits").div(row.ref("shippedUnits").add(row.ref("backlogUnits"))),
        0,
      ),
    width: 12,
    style: { numFmt: "0.0%", alignment: { horizontal: "right" } },
  })
  .column("shippedAt", {
    header: "Shipped At",
    accessor: "shippedAt",
    width: 14,
    style: { numFmt: "yyyy-mm-dd" },
  })
  .build();
