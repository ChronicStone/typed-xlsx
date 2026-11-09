import { createExcelSchema } from "typed-xlsx";
import type { Deal, Rep, Team } from "./data";

const money = { numFmt: '"$"#,##0' };

const teamVariants = {
  Enterprise: {
    style: { fill: { color: { rgb: "1E3A8A" } }, font: { color: { rgb: "FFFFFF" }, bold: true } },
  },
  "Mid-Market": {
    style: { fill: { color: { rgb: "DBEAFE" } }, font: { color: { rgb: "1E40AF" } } },
  },
  SMB: { style: { fill: { color: { rgb: "F1F5F9" } }, font: { color: { rgb: "334155" } } } },
} satisfies Record<Team, unknown>;

/**
 * The commission plan lives in formulas, so finance can audit it cell by cell:
 * 8% up to quota, 12% on everything above it, plus SPIFFs.
 */
export const repSchema = createExcelSchema<Rep>()
  .column("rep", {
    type: "hyperlink",
    header: "Rep",
    accessor: "rep",
    target: (row: Rep) => `mailto:${row.email}?subject=Q3%20commission%20statement`,
    tooltip: "Email the statement",
    minWidth: 20,
  })
  .column("team", {
    type: "badge",
    header: "Team",
    accessor: "team",
    width: 13,
    variants: teamVariants,
  })
  .column("deals", { header: "Deals", accessor: "deals", width: 8 })
  .column("quota", { header: "Quota", accessor: "quota", width: 12, style: money })
  .column("closedWon", {
    header: "Closed won",
    accessor: "closedWon",
    width: 13,
    style: money,
    summary: (s) => [s.formula("sum")],
  })
  .column("attainment", {
    header: "Attainment",
    formula: ({ refs, fx }) => fx.safeDiv(refs.column("closedWon"), refs.column("quota"), 0),
    width: 12,
    style: { numFmt: "0%" },
    conditionalStyle: (c) =>
      c
        .when(({ refs }) => refs.column("attainment").gte(1), {
          fill: { color: { rgb: "DCFCE7" } },
          font: { color: { rgb: "166534" }, bold: true },
        })
        .when(({ refs }) => refs.column("attainment").lt(0.7), {
          fill: { color: { rgb: "FEE2E2" } },
          font: { color: { rgb: "991B1B" }, bold: true },
        }),
  })
  .group("payout", { header: "Payout" }, (g) =>
    g
      .column("base", {
        header: "Base 8%",
        formula: ({ refs, fx }) =>
          fx.round(fx.min(refs.column("closedWon"), refs.column("quota")).mul(0.08), 0),
        width: 11,
        style: money,
      })
      .column("accelerator", {
        header: "Accel. 12%",
        formula: ({ refs, fx }) =>
          fx.round(fx.max(refs.column("closedWon").sub(refs.column("quota")), 0).mul(0.12), 0),
        width: 12,
        style: money,
      })
      .column("spiffs", { header: "SPIFFs", accessor: "spiffs", width: 10, style: money })
      .column("payout", {
        header: "Total",
        formula: ({ refs }) =>
          refs.column("base").add(refs.column("accelerator")).add(refs.column("spiffs")),
        width: 12,
        style: { ...money, font: { bold: true } },
        summary: (s) => [s.formula("sum")],
      }),
  )
  .build();

const typeVariants = {
  "New business": {
    style: { fill: { color: { rgb: "DCFCE7" } }, font: { color: { rgb: "166534" } } },
  },
  Expansion: { style: { fill: { color: { rgb: "E0E7FF" } }, font: { color: { rgb: "3730A3" } } } },
  Renewal: { style: { fill: { color: { rgb: "F1F5F9" } }, font: { color: { rgb: "334155" } } } },
} as const;

export const dealSchema = createExcelSchema<Deal>()
  .column("closedOn", {
    header: "Closed",
    accessor: "closedOn",
    width: 12,
    style: { numFmt: "dd mmm" },
  })
  .column("opportunity", {
    type: "hyperlink",
    header: "Opportunity",
    accessor: "opportunity",
    target: (row: Deal) => `https://crm.example.com/opportunities/${row.oppId}`,
    tooltip: "Open in CRM",
    minWidth: 34,
  })
  .column("rep", { header: "Rep", accessor: "rep", minWidth: 18 })
  .column("type", {
    type: "badge",
    header: "Type",
    accessor: "type",
    width: 14,
    variants: typeVariants,
  })
  .column("amount", {
    header: "Amount",
    accessor: "amount",
    width: 12,
    style: money,
    summary: (s) => [s.formula("sum")],
  })
  .build();
