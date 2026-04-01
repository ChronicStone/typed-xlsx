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
    });

  return workbook.toUint8Array();
}

export const buildArtifact = buildRenewalOpsWorkbook;
