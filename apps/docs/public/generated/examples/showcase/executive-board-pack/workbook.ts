import { createWorkbook } from "@chronicstone/typed-xlsx";
import { createExecutiveAccounts } from "./data";
import { executiveBoardSchema } from "./schema";

export function buildExecutiveBoardPackWorkbook() {
  const workbook = createWorkbook();
  const accounts = createExecutiveAccounts();
  const watchlist = accounts.filter((account) => account.healthScore < 80 || account.nrr < 1);

  workbook
    .sheet("Board Overview", {
      tablesPerRow: 2,
      tableColumnGap: 2,
      tableRowGap: 2,
      freezePane: { rows: 1, columns: 2 },
    })
    .table("portfolio", {
      title: "Portfolio Snapshot",
      rows: accounts,
      schema: executiveBoardSchema,
      defaults: {
        header: { preset: "header.inverse", style: { fill: { color: { rgb: "0B1220" } } } },
        summary: { preset: "summary.subtle", style: { fill: { color: { rgb: "E0E7FF" } } } },
        cells: {
          base: { style: { alignment: { vertical: "top" } } },
          locked: { style: { fill: { color: { rgb: "F8FAFC" } } } },
        },
      },
    })
    .table("watchlist", {
      title: "Executive Watchlist",
      rows: watchlist,
      schema: executiveBoardSchema,
      select: {
        include: [
          "accountName",
          "region",
          "csm",
          "arr",
          "projectedArr",
          "nrr",
          "healthScore",
          "nextRenewalDate",
          "executiveSummary",
        ],
      },
      defaults: {
        header: { preset: "header.inverse", style: { fill: { color: { rgb: "7F1D1D" } } } },
        summary: { preset: "summary.subtle", style: { fill: { color: { rgb: "FEE2E2" } } } },
        cells: {
          base: { style: { alignment: { vertical: "top" } } },
          locked: { style: { fill: { color: { rgb: "FFF7ED" } } } },
        },
      },
    });

  workbook
    .sheet("Regional Views", {
      tablesPerRow: 3,
      tableColumnGap: 2,
      tableRowGap: 2,
      freezePane: { rows: 1 },
    })
    .table("amer", {
      title: "AMER",
      rows: accounts.filter((account) => account.region === "AMER"),
      schema: executiveBoardSchema,
      select: { include: ["accountName", "arr", "projectedArr", "nrr", "healthScore"] },
      defaults: {
        header: { preset: "header.accent", style: { fill: { color: { rgb: "DBEAFE" } } } },
        cells: { locked: { style: { fill: { color: { rgb: "EFF6FF" } } } } },
      },
    })
    .table("emea", {
      title: "EMEA",
      rows: accounts.filter((account) => account.region === "EMEA"),
      schema: executiveBoardSchema,
      select: { include: ["accountName", "arr", "projectedArr", "nrr", "healthScore"] },
      defaults: {
        header: { preset: "header.accent", style: { fill: { color: { rgb: "DCFCE7" } } } },
        cells: { locked: { style: { fill: { color: { rgb: "F0FDF4" } } } } },
      },
    })
    .table("apac", {
      title: "APAC",
      rows: accounts.filter((account) => account.region === "APAC"),
      schema: executiveBoardSchema,
      select: { include: ["accountName", "arr", "projectedArr", "nrr", "healthScore"] },
      defaults: {
        header: { preset: "header.accent", style: { fill: { color: { rgb: "FCE7F3" } } } },
        cells: { locked: { style: { fill: { color: { rgb: "FDF2F8" } } } } },
      },
    });

  return workbook.toUint8Array();
}

export const buildArtifact = buildExecutiveBoardPackWorkbook;
