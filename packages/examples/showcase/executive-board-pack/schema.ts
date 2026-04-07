import { createExcelSchema, spreadsheetThemes, type CellStyle } from "typed-xlsx";
import type { ExecutiveAccount } from "./data";

const currencyStyle: CellStyle = {
  numFmt: '"$"#,##0',
  alignment: { horizontal: "right" },
};

export const executiveBoardBaseTheme = spreadsheetThemes.slate.extend({
  slots: {
    title: { fill: { color: { rgb: "020617" } } },
    header: { fill: { color: { rgb: "0B1220" } }, font: { color: { rgb: "F8FAFC" } } },
    summary: { fill: { color: { rgb: "E0E7FF" } } },
    cellBase: { alignment: { vertical: "top" } },
    cellLocked: { fill: { color: { rgb: "F8FAFC" } } },
  },
});

export const executiveBoardSchema = createExcelSchema<ExecutiveAccount>()
  .theme(executiveBoardBaseTheme)
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
  .group("commercial", { header: "Commercial" }, (group) =>
    group
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
        accessor: (row) => Math.round(row.arr * row.expansionRatio),
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
            .when(({ refs }) => refs.column("nrr").lt(1), {
              fill: { color: { rgb: "FEE2E2" } },
              font: { color: { rgb: "991B1B" }, bold: true },
            })
            .when(({ refs }) => refs.column("nrr").gte(1.1), {
              fill: { color: { rgb: "DCFCE7" } },
              font: { color: { rgb: "166534" }, bold: true },
            }),
        summary: (summary) => [summary.empty(), summary.formula("average"), summary.empty()],
      }),
  )
  .group("adoption", { header: "Adoption" }, (group) =>
    group
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
        accessor: (row) => (row.seatsPurchased > 0 ? row.seatsActivated / row.seatsPurchased : 0),
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
            .when(({ refs }) => refs.column("healthScore").lt(70), {
              fill: { color: { rgb: "FEF3C7" } },
              font: { color: { rgb: "92400E" }, bold: true },
            })
            .when(({ refs }) => refs.column("healthScore").gte(85), {
              fill: { color: { rgb: "DCFCE7" } },
              font: { color: { rgb: "166534" }, bold: true },
            }),
        summary: (summary) => [summary.empty(), summary.formula("average"), summary.formula("max")],
      }),
  )
  .group("renewal", { header: "Renewal" }, (group) =>
    group
      .column("nextRenewalDate", {
        header: "Renewal Date",
        accessor: "nextRenewalDate",
        width: 14,
        style: { numFmt: "yyyy-mm-dd" },
      })
      .column("executiveSummary", {
        header: "Executive Note",
        accessor: "executiveSummary",
        minWidth: 34,
        style: { alignment: { wrapText: true, vertical: "top" } },
      }),
  )
  .build();
