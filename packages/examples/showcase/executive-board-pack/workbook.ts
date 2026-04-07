import { createWorkbook, spreadsheetThemes } from "typed-xlsx";
import { createExecutiveAccounts } from "./data";
import { executiveBoardBaseTheme, executiveBoardSchema } from "./schema";

const boardTheme = executiveBoardBaseTheme.extend({
  slots: {
    title: { fill: { color: { rgb: "020617" } } },
  },
});

const watchlistTheme = executiveBoardBaseTheme.extend({
  slots: {
    title: { fill: { color: { rgb: "450A0A" } } },
    groupHeader: spreadsheetThemes.rose.slot("groupHeader"),
    groupHeaderFiller: spreadsheetThemes.rose.slot("groupHeaderFiller"),
    header: { fill: { color: { rgb: "7F1D1D" } }, font: { color: { rgb: "FFF7ED" } } },
    summary: { fill: { color: { rgb: "FEE2E2" } } },
    cellLocked: { fill: { color: { rgb: "FFF7ED" } } },
  },
});

const amerTheme = spreadsheetThemes.ocean.extend({
  slots: {
    title: { fill: { color: { rgb: "BFDBFE" } } },
    header: { fill: { color: { rgb: "DBEAFE" } } },
    cellLocked: { fill: { color: { rgb: "EFF6FF" } } },
  },
});

const emeaTheme = spreadsheetThemes.forest.extend({
  slots: {
    title: { fill: { color: { rgb: "BBF7D0" } } },
    header: { fill: { color: { rgb: "DCFCE7" } } },
    cellLocked: { fill: { color: { rgb: "F0FDF4" } } },
  },
});

const apacTheme = spreadsheetThemes.classic.extend({
  slots: {
    title: { fill: { color: { rgb: "FBCFE8" } } },
    groupHeader: { fill: { color: { rgb: "FCE7F3" } }, font: { color: { rgb: "9D174D" } } },
    groupHeaderFiller: { fill: { color: { rgb: "FDECF5" } }, font: { color: { rgb: "9D174D" } } },
    header: { fill: { color: { rgb: "FCE7F3" } }, font: { color: { rgb: "9D174D" } } },
    cellLocked: { fill: { color: { rgb: "FDF2F8" } } },
  },
});

export function buildExecutiveBoardPackWorkbook() {
  const workbook = createWorkbook();
  const accounts = createExecutiveAccounts();
  const watchlist = accounts.filter((account) => account.healthScore < 80 || account.nrr < 1);

  workbook
    .sheet("Board Overview", {
      tablesPerRow: 1,
      tableColumnGap: 2,
      tableRowGap: 2,
      freezePane: { rows: 3, columns: 2 },
    })
    .table("portfolio", {
      title: "Portfolio Snapshot",
      rows: accounts,
      schema: executiveBoardSchema,
      theme: boardTheme,
      render: { groupHeaders: true },
    })
    .table("watchlist", {
      title: "Executive Watchlist",
      rows: watchlist,
      schema: executiveBoardSchema,
      theme: watchlistTheme,
      render: { groupHeaders: true },
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
    });

  workbook
    .sheet("Regional Views", {
      tablesPerRow: 3,
      tableColumnGap: 2,
      tableRowGap: 2,
      freezePane: { rows: 3 },
    })
    .table("amer", {
      title: "AMER",
      rows: accounts.filter((account) => account.region === "AMER"),
      schema: executiveBoardSchema,
      theme: amerTheme,
      render: { groupHeaders: true },
      select: { include: ["accountName", "arr", "projectedArr", "nrr", "healthScore"] },
    })
    .table("emea", {
      title: "EMEA",
      rows: accounts.filter((account) => account.region === "EMEA"),
      schema: executiveBoardSchema,
      theme: emeaTheme,
      render: { groupHeaders: true },
      select: { include: ["accountName", "arr", "projectedArr", "nrr", "healthScore"] },
    })
    .table("apac", {
      title: "APAC",
      rows: accounts.filter((account) => account.region === "APAC"),
      schema: executiveBoardSchema,
      theme: apacTheme,
      render: { groupHeaders: true },
      select: { include: ["accountName", "arr", "projectedArr", "nrr", "healthScore"] },
    });

  return workbook.toUint8Array();
}

export const buildArtifact = buildExecutiveBoardPackWorkbook;
