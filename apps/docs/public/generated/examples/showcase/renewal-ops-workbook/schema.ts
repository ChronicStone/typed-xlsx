import { createExcelSchema } from "@chronicstone/typed-xlsx";
import type { RenewalOpportunity } from "./data";

export const renewalOpsSchema = createExcelSchema<RenewalOpportunity>()
  .column("accountName", {
    header: "Account",
    accessor: "account.name",
    minWidth: 20,
  })
  .column("csm", {
    header: "CSM",
    accessor: "csm.name",
    minWidth: 14,
  })
  .column("segment", {
    header: "Segment",
    accessor: "segment",
    width: 14,
  })
  .column("renewalDate", {
    header: "Renewal Date",
    accessor: "renewalDate",
    width: 14,
    style: { numFmt: "yyyy-mm-dd" },
  })
  .column("currentArr", {
    header: "Current ARR",
    accessor: "currentArr",
    style: { numFmt: '"$"#,##0', alignment: { horizontal: "right" } },
    summary: (summary) => [summary.label("Portfolio total"), summary.formula("sum")],
  })
  .column("targetArr", {
    header: "Target ARR",
    accessor: "targetArr",
    style: {
      numFmt: '"$"#,##0',
      alignment: { horizontal: "right" },
      protection: { locked: false },
    },
    validation: (v) => v.integer().between(10000, 3000000),
    summary: (summary) => [summary.label("Renewal target"), summary.formula("sum")],
  })
  .column("uplift", {
    header: "Uplift %",
    accessor: (row) => (row.currentArr > 0 ? row.targetArr / row.currentArr - 1 : 0),
    style: {
      numFmt: "0.0%",
      alignment: { horizontal: "right" },
      protection: { hidden: true },
    },
    conditionalStyle: (conditional) =>
      conditional
        .when(({ row }) => row.ref("targetArr").lt(row.ref("currentArr")), {
          fill: { color: { rgb: "FEE2E2" } },
          font: { color: { rgb: "991B1B" }, bold: true },
        })
        .when(
          ({ row, fx }) => row.ref("targetArr").gte(fx.round(row.ref("currentArr").mul(1.08), 0)),
          {
            fill: { color: { rgb: "DCFCE7" } },
            font: { color: { rgb: "166534" }, bold: true },
          },
        ),
  })
  .column("confidence", {
    header: "Confidence",
    accessor: "confidence",
    width: 12,
    validation: (v) => v.list(["Commit", "Best Case", "Risk"]),
    style: { protection: { locked: false } },
  })
  .column("forecastCategory", {
    header: "Category",
    accessor: "forecastCategory",
    width: 12,
    validation: (v) => v.list(["Renew", "Expand", "At Risk"]),
    style: { protection: { locked: false } },
  })
  .column("openTickets", {
    header: "Open Tickets",
    accessor: "openTickets",
    style: { alignment: { horizontal: "right" } },
    validation: (v) => v.integer().between(0, 100),
  })
  .column("sponsorEmail", {
    header: "Sponsor",
    accessor: "account.sponsor.email",
    minWidth: 24,
    hyperlink: (row) => ({
      target: `mailto:${row.account.sponsor.email}`,
      tooltip: "Email sponsor",
    }),
  })
  .column("riskNotes", {
    header: "Notes",
    accessor: "riskNotes",
    minWidth: 32,
    style: { alignment: { wrapText: true, vertical: "top" }, protection: { locked: false } },
  })
  .build();
