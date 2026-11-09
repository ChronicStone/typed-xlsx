import { createWorkbook, spreadsheetThemes } from "typed-xlsx";
import { createCommissionData } from "./data";
import { dealSchema, repSchema } from "./schema";

export function buildCommissionStatements() {
  const { reps, deals } = createCommissionData();
  const theme = spreadsheetThemes.slate;
  return createWorkbook()
    .sheet("Statements", { freezePane: { rows: 3, columns: 1 } })
    .table("reps", { title: "Q3 2026 commission statements", schema: repSchema, rows: reps, theme })
    .chart("attainment", ({ refs }) => ({
      title: "Attainment by rep",
      at: "A20",
      marks: [
        refs.table("reps").bar({
          x: "rep",
          y: "attainment",
          horizontal: true,
          color: "#1E3A8A",
          labels: { format: "0%" },
        }),
      ],
      axes: { y: { format: "0%", min: 0 } },
    }))
    .sheet("Deals", { freezePane: { rows: 1 } })
    .table("deals", { schema: dealSchema, rows: deals, theme })
    .pivot("byType", ({ refs }) =>
      refs.table("deals").pivot({
        rows: ["rep"],
        columns: ["type"],
        values: { amount: { aggregate: "sum", format: '"$"#,##0' } },
        at: "H2",
      }),
    )
    .toUint8Array();
}

export const buildArtifact = buildCommissionStatements;
