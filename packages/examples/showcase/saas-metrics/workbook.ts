import { createWorkbook, spreadsheetThemes } from "typed-xlsx";
import { MONTHS, createAccounts, createBridge, createPlans } from "./data";
import { accountSchema, bridgeSchema, planSchema } from "./schema";

export function buildSaasMetrics() {
  const theme = spreadsheetThemes.ocean;
  return createWorkbook()
    .sheet("MRR bridge", { freezePane: { rows: 3, columns: 1 } })
    .table("bridge", {
      title: "MRR bridge, October 2025 to September 2026",
      schema: bridgeSchema,
      rows: createBridge(),
      theme,
    })
    .chart("movements", ({ refs }) => ({
      title: "Where MRR came from",
      at: "A18",
      marks: [
        refs.table("bridge").bar({
          x: "month",
          y: ["newMrr", "expansion", "contraction", "churn"],
          stack: true,
        }),
        refs.table("bridge").line({
          x: "month",
          y: "closing",
          name: "Closing MRR",
          color: "#0F172A",
          axis: "y2",
        }),
      ],
      colors: ["#0EA5E9", "#22C55E", "#F59E0B", "#EF4444"],
      axes: { y: { format: '"$"#,##0,"k"' }, y2: { format: '"$"#,##0.0,,"M"' } },
    }))
    .sheet("Plans", { freezePane: { rows: 2, columns: 1 } })
    .table("plans", {
      title: "MRR by plan",
      schema: planSchema,
      rows: createPlans(),
      context: { months: MONTHS },
      theme,
    })
    .chart("planMix", ({ refs }) => ({
      title: "MRR by plan",
      at: "A10",
      marks: [refs.table("plans").area({ x: { dynamic: "months" }, series: "plan", stack: true })],
      colors: ["#CBD5E1", "#60A5FA", "#6366F1", "#1E1B4B"],
      axes: { y: { format: '"$"#,##0,"k"' } },
    }))
    .sheet("Top accounts", { freezePane: { rows: 1, columns: 1 } })
    .table("accounts", { schema: accountSchema, rows: createAccounts(), theme })
    .toUint8Array();
}

export const buildArtifact = buildSaasMetrics;
