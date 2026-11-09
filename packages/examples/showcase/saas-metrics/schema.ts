import { createExcelSchema } from "typed-xlsx";
import type { AccountRow, BridgeRow, Plan, PlanRow } from "./data";

const money = { numFmt: '"$"#,##0' };
const signed = { numFmt: '"$"#,##0;[Red]-"$"#,##0' };
const red = { font: { color: { rgb: "B42318" } } };

/** Closing MRR, net new and NRR are Excel formulas: edit a movement and the bridge follows. */
export const bridgeSchema = createExcelSchema<BridgeRow>()
  .column("month", { header: "Month", accessor: "month", width: 10 })
  .column("opening", { header: "Opening MRR", accessor: "opening", width: 14, style: money })
  .group("movements", { header: "Movements" }, (g) =>
    g
      .column("newMrr", { header: "New", accessor: "newMrr", width: 11, style: money })
      .column("expansion", { header: "Expansion", accessor: "expansion", width: 11, style: money })
      .column("contraction", {
        header: "Contraction",
        accessor: (row) => -row.contraction,
        width: 12,
        style: { ...signed, ...red },
      })
      .column("churn", {
        header: "Churn",
        accessor: (row) => -row.churn,
        width: 11,
        style: { ...signed, ...red },
      }),
  )
  .column("netNew", {
    header: "Net new",
    formula: ({ refs }) =>
      refs
        .column("newMrr")
        .add(refs.column("expansion"))
        .add(refs.column("contraction"))
        .add(refs.column("churn")),
    width: 12,
    style: signed,
    summary: (s) => [s.formula("sum")],
  })
  .column("closing", {
    header: "Closing MRR",
    formula: ({ refs }) => refs.column("opening").add(refs.column("netNew")),
    width: 14,
    style: { ...money, font: { bold: true } },
  })
  .column("growth", {
    header: "MoM growth",
    formula: ({ refs, fx }) => fx.safeDiv(refs.column("netNew"), refs.column("opening"), 0),
    width: 11,
    style: { numFmt: "+0.0%;-0.0%" },
    conditionalStyle: (c) =>
      c
        .when(({ refs }) => refs.column("growth").gte(0.05), {
          fill: { color: { rgb: "DCFCE7" } },
          font: { color: { rgb: "166534" }, bold: true },
        })
        .when(({ refs }) => refs.column("growth").lt(0.04), {
          fill: { color: { rgb: "FEF3C7" } },
          font: { color: { rgb: "92400E" } },
        }),
  })
  .column("nrr", {
    header: "NRR (annualized)",
    formula: ({ refs, fx }) =>
      fx.round(
        fx.safeDiv(
          refs
            .column("opening")
            .add(refs.column("expansion"))
            .add(refs.column("contraction"))
            .add(refs.column("churn")),
          refs.column("opening"),
          0,
        ),
        4,
      ),
    width: 15,
    style: { numFmt: "0.0%" },
  })
  .build();

const planVariants = {
  Starter: { style: { fill: { color: { rgb: "F1F5F9" } }, font: { color: { rgb: "334155" } } } },
  Growth: { style: { fill: { color: { rgb: "DBEAFE" } }, font: { color: { rgb: "1E40AF" } } } },
  Scale: { style: { fill: { color: { rgb: "E0E7FF" } }, font: { color: { rgb: "3730A3" } } } },
  Enterprise: {
    style: { fill: { color: { rgb: "1E1B4B" } }, font: { color: { rgb: "FFFFFF" }, bold: true } },
  },
} satisfies Record<Plan, unknown>;

export const planSchema = createExcelSchema<PlanRow, { months: string[] }>()
  .column("plan", {
    type: "badge",
    header: "Plan",
    accessor: "plan",
    width: 13,
    variants: planVariants,
  })
  .column("customers", {
    header: "Customers",
    accessor: "customers",
    width: 11,
    style: { numFmt: "#,##0" },
  })
  .dynamic("months", (builder, { ctx }) => {
    for (const month of ctx.months)
      builder.column(month, {
        header: month,
        accessor: (row) => row.mrrByMonth[month] ?? 0,
        width: 10,
        style: { numFmt: '"$"#,##0,"k"' },
        summary: (s) => [s.formula("sum")],
      });
  })
  .column("trend", {
    type: "sparkline",
    header: "12-month trend",
    source: { dynamic: "months" },
    sparklineType: "line",
    width: 16,
    style: { line: { color: "#4F46E5", weight: 1.25 }, last: { color: "#16A34A" } },
  })
  .build();

const healthVariants = {
  Healthy: {
    style: { fill: { color: { rgb: "DCFCE7" } }, font: { color: { rgb: "166534" }, bold: true } },
  },
  Watch: {
    style: { fill: { color: { rgb: "FEF3C7" } }, font: { color: { rgb: "92400E" }, bold: true } },
  },
  "At risk": {
    style: { fill: { color: { rgb: "FEE2E2" } }, font: { color: { rgb: "991B1B" }, bold: true } },
  },
} as const;

export const accountSchema = createExcelSchema<AccountRow>()
  .column("account", {
    type: "hyperlink",
    header: "Account",
    accessor: "account",
    target: (row: AccountRow) => `https://crm.example.com/accounts/${row.crmId}`,
    tooltip: "Open in CRM",
    minWidth: 26,
  })
  .column("plan", {
    type: "badge",
    header: "Plan",
    accessor: "plan",
    width: 13,
    variants: planVariants,
  })
  .column("owner", { header: "CSM", accessor: "owner", minWidth: 18 })
  .column("mrr", {
    header: "MRR",
    accessor: "mrr",
    width: 11,
    style: money,
    summary: (s) => [s.formula("sum")],
  })
  .column("seats", { header: "Seats", accessor: "seats", width: 8, style: { numFmt: "#,##0" } })
  .column("activeSeats", {
    header: "Active",
    accessor: "activeSeats",
    width: 8,
    style: { numFmt: "#,##0" },
  })
  .column("usage", {
    header: "Seat usage",
    formula: ({ refs, fx }) => fx.safeDiv(refs.column("activeSeats"), refs.column("seats"), 0),
    width: 11,
    style: { numFmt: "0%" },
    conditionalStyle: (c) =>
      c.when(({ refs }) => refs.column("usage").lt(0.5), {
        font: { color: { rgb: "B42318" }, bold: true },
      }),
  })
  .column("health", {
    type: "badge",
    header: "Health",
    accessor: "health",
    width: 11,
    variants: healthVariants,
  })
  .column("renewsOn", {
    header: "Renews",
    accessor: "renewsOn",
    width: 12,
    style: { numFmt: "d mmm yyyy" },
  })
  .column("qbrDone", { type: "checkbox", header: "QBR done", accessor: "qbrDone", width: 10 })
  .build();
