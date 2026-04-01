import { createExcelSchema, type CellStyle } from "@chronicstone/typed-xlsx";
import type { ExecutiveAccount } from "./data";

const currencyStyle: CellStyle = {
  numFmt: '"$"#,##0',
  alignment: { horizontal: "right" },
};

export const executiveBoardSchema = createExcelSchema<ExecutiveAccount>()
  .column("accountName", {
    header: "Account",
    accessor: "accountName",
    minWidth: 22,
    summary: (summary) => [
      summary.label("Portfolio total"),
      summary.label("Portfolio average"),
      summary.label("Portfolio max"),
    ],
  })
  .column("region", {
    header: "Region",
    accessor: "region",
    width: 10,
  })
  .column("sector", {
    header: "Sector",
    accessor: "sector",
    minWidth: 14,
  })
  .column("csm", {
    header: "CSM",
    accessor: "csm",
    minWidth: 16,
  })
  .column("arr", {
    header: "Current ARR",
    accessor: "arr",
    minWidth: 14,
    style: currencyStyle,
    summary: (summary) => [summary.formula("sum"), summary.formula("average"), summary.empty()],
  })
  .column("expansionRatio", {
    header: "Expansion",
    accessor: "expansionRatio",
    width: 12,
    style: { numFmt: "0%", alignment: { horizontal: "right" } },
  })
  .column("expansionValue", {
    header: "Expansion Value",
    formula: ({ row, fx }) => fx.round(row.ref("arr").mul(row.ref("expansionRatio")), 0),
    minWidth: 16,
    style: currencyStyle,
    summary: (summary) => [summary.formula("sum"), summary.formula("average"), summary.empty()],
  })
  .column("projectedArr", {
    header: "Projected ARR",
    accessor: (row) => Math.round(row.arr * (1 + row.expansionRatio)),
    minWidth: 16,
    style: currencyStyle,
    summary: (summary) => [summary.formula("sum"), summary.formula("average"), summary.empty()],
  })
  .column("nrr", {
    header: "NRR",
    accessor: "nrr",
    width: 10,
    style: { numFmt: "0%", alignment: { horizontal: "right" } },
    conditionalStyle: (conditional) =>
      conditional
        .when(({ row }) => row.ref("nrr").lt(1), {
          fill: { color: { rgb: "FEE2E2" } },
          font: { color: { rgb: "991B1B" }, bold: true },
        })
        .when(({ row }) => row.ref("nrr").gte(1.1), {
          fill: { color: { rgb: "DCFCE7" } },
          font: { color: { rgb: "166534" }, bold: true },
        }),
    summary: (summary) => [summary.empty(), summary.formula("average"), summary.empty()],
  })
  .column("seatsPurchased", {
    header: "Seats",
    accessor: "seatsPurchased",
    width: 10,
    style: { alignment: { horizontal: "right" } },
  })
  .column("seatsActivated", {
    header: "Activated",
    accessor: "seatsActivated",
    width: 12,
    style: { alignment: { horizontal: "right" } },
  })
  .column("utilization", {
    header: "Seat Utilization",
    formula: ({ row, fx }) =>
      fx.if(
        row.ref("seatsPurchased").gt(0),
        row.ref("seatsActivated").div(row.ref("seatsPurchased")),
        0,
      ),
    width: 14,
    style: { numFmt: "0.0%", alignment: { horizontal: "right" } },
  })
  .column("healthScore", {
    header: "Health",
    accessor: "healthScore",
    width: 10,
    style: { alignment: { horizontal: "right" } },
    conditionalStyle: (conditional) =>
      conditional
        .when(({ row }) => row.ref("healthScore").lt(70), {
          fill: { color: { rgb: "FEF3C7" } },
          font: { color: { rgb: "92400E" }, bold: true },
        })
        .when(({ row }) => row.ref("healthScore").gte(85), {
          fill: { color: { rgb: "DCFCE7" } },
          font: { color: { rgb: "166534" }, bold: true },
        }),
    summary: (summary) => [summary.empty(), summary.formula("average"), summary.formula("max")],
  })
  .column("nextRenewalDate", {
    header: "Renewal",
    accessor: "nextRenewalDate",
    width: 14,
    style: { numFmt: "yyyy-mm-dd" },
  })
  .column("executiveSummary", {
    header: "Executive Note",
    accessor: "executiveSummary",
    minWidth: 34,
    style: { alignment: { wrapText: true, vertical: "top" } },
  })
  .build();
