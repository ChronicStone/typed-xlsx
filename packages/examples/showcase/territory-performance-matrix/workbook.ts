import { createWorkbook } from "@chronicstone/typed-xlsx";
import { createTerritoryRows } from "./data";
import { territoryPerformanceSchema } from "./schema";

export function buildTerritoryPerformanceMatrixWorkbook() {
  const workbook = createWorkbook();

  workbook.sheet("Territory Matrix").table("territories", {
    rows: createTerritoryRows(),
    schema: territoryPerformanceSchema,
    context: { regions: ["AMER", "EMEA", "APAC"] },
    totalsRow: true,
    style: "TableStyleLight9",
  });

  return workbook.toUint8Array();
}

export const buildArtifact = buildTerritoryPerformanceMatrixWorkbook;
