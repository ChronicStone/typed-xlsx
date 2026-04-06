import { createExcelSchema } from "xlsmith";
import type { RenewalOpportunity } from "./data";

export const renewalOpsSchema = createExcelSchema<RenewalOpportunity>()
  .column("accountName", {
    header: "Account",
    accessor: "account.name",
    minWidth: 20,
    summary: (summary) => [summary.label("Current ARR total"), summary.label("Target ARR total")],
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
    summary: (summary) => [summary.formula("sum"), summary.empty()],
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
    summary: (summary) => [summary.empty(), summary.formula("sum")],
  })
  .column("uplift", {
    header: "Uplift %",
    formula: ({ refs, fx }) =>
      fx.safeDiv(refs.column("targetArr"), refs.column("currentArr")).sub(1),
    style: {
      numFmt: "0.0%",
      alignment: { horizontal: "right" },
      protection: { hidden: true },
    },
    conditionalStyle: (conditional) =>
      conditional
        .when(({ refs }) => refs.column("targetArr").lt(refs.column("currentArr")), {
          fill: { color: { rgb: "FEE2E2" } },
          font: { color: { rgb: "991B1B" }, bold: true },
        })
        .when(
          ({ refs, fx }) =>
            refs.column("targetArr").gte(fx.round(refs.column("currentArr").mul(1.08), 0)),
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
