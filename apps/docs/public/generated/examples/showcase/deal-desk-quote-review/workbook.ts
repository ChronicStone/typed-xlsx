import { createWorkbook } from "@chronicstone/typed-xlsx";
import { createQuoteReviews } from "./data";
import { dealDeskQuoteSchema } from "./schema";

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
    });

  workbook
    .sheet("Approvals", {
      freezePane: { rows: 1 },
    })
    .table("approvals", {
      title: "Needs Review",
      rows: quotes.filter((quote) => quote.discountRate >= 0.14),
      schema: dealDeskQuoteSchema,
      select: {
        include: [
          "quoteId",
          "accountName",
          "vertical",
          "owner",
          "stage",
          "discountRate",
          "approvalFlag",
          "notes",
        ],
      },
    });

  return workbook.toUint8Array();
}

export const buildArtifact = buildDealDeskQuoteReviewWorkbook;
