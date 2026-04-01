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
    })
    .table("emea", {
      title: "EMEA",
      rows: accounts.filter((account) => account.region === "EMEA"),
      schema: executiveBoardSchema,
      select: { include: ["accountName", "arr", "projectedArr", "nrr", "healthScore"] },
    })
    .table("apac", {
      title: "APAC",
      rows: accounts.filter((account) => account.region === "APAC"),
      schema: executiveBoardSchema,
      select: { include: ["accountName", "arr", "projectedArr", "nrr", "healthScore"] },
    });

  return workbook.toUint8Array();
}

export const buildArtifact = buildExecutiveBoardPackWorkbook;
