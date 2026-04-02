import { createWorkbook } from "@chronicstone/typed-xlsx";
import { createRenewalOpportunities } from "./data";
import { renewalOpsSchema } from "./schema";

export function buildRenewalOpsWorkbook() {
  const workbook = createWorkbook({
    protection: {
      password: "renewal-ops",
      structure: true,
    },
  });

  workbook
    .sheet("Renewal Planner", {
      freezePane: { rows: 1, columns: 4 },
      protection: {
        password: "renewal-sheet",
        selectLockedCells: false,
        selectUnlockedCells: true,
      },
    })
    .table("renewals", {
      title: "Renewal Plan",
      rows: createRenewalOpportunities(),
      schema: renewalOpsSchema,
      defaults: {
        header: { preset: "header.accent", style: { fill: { color: { rgb: "E0F2FE" } } } },
        summary: { preset: "summary.subtle", style: { fill: { color: { rgb: "E0F2FE" } } } },
        cells: {
          base: { style: { alignment: { vertical: "top" } } },
          unlocked: { preset: "cell.input" },
          locked: { preset: "cell.locked", style: { fill: { color: { rgb: "F8FAFC" } } } },
          hidden: { preset: "cell.hidden", style: { fill: { color: { rgb: "E2E8F0" } } } },
        },
      },
    });

  return workbook.toUint8Array();
}

export const buildArtifact = buildRenewalOpsWorkbook;
