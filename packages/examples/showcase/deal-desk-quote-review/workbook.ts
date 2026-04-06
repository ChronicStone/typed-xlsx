import { createWorkbook } from "xlsmith";
import { createQuoteReviews } from "./data";
import { dealDeskApprovalSchema, dealDeskQuoteSchema } from "./schema";

export function buildDealDeskQuoteReviewWorkbook() {
  const workbook = createWorkbook();
  const quotes = createQuoteReviews();

  workbook
    .sheet("Quote Review", {
      freezePane: { rows: 1, columns: 5 },
    })
    .table("quotes", {
      title: "Deal Desk Review",
      rows: quotes,
      schema: dealDeskQuoteSchema,
      defaults: {
        header: { preset: "header.inverse", style: { fill: { color: { rgb: "1E293B" } } } },
        summary: { preset: "summary.subtle", style: { fill: { color: { rgb: "E2E8F0" } } } },
        cells: {
          base: { style: { alignment: { vertical: "top" } } },
          locked: { style: { fill: { color: { rgb: "F8FAFC" } } } },
        },
      },
    });

  workbook
    .sheet("Approvals", {
      freezePane: { rows: 1 },
    })
    .table("approvals", {
      title: "Needs Review",
      rows: quotes.filter((quote) => quote.discountRate >= 0.14),
      schema: dealDeskApprovalSchema,
      defaults: {
        header: { preset: "header.accent", style: { fill: { color: { rgb: "FEE2E2" } } } },
        summary: { preset: "summary.subtle", style: { fill: { color: { rgb: "FFEDD5" } } } },
        cells: {
          base: { style: { alignment: { vertical: "top" } } },
          locked: { style: { fill: { color: { rgb: "FFF7ED" } } } },
        },
      },
    });

  return workbook.toUint8Array();
}

export const buildArtifact = buildDealDeskQuoteReviewWorkbook;
