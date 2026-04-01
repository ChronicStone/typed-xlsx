import { createExcelSchema } from "@chronicstone/typed-xlsx";
import type { QuoteReview } from "./data";

export const dealDeskQuoteSchema = createExcelSchema<QuoteReview>()
  .column("quoteId", {
    header: "Quote",
    accessor: "quoteId",
    width: 14,
    summary: (summary) => [summary.label("TOTAL")],
  })
  .column("accountName", {
    header: "Account",
    accessor: "account.name",
    minWidth: 20,
  })
  .column("owner", {
    header: "Owner",
    accessor: "owner.name",
    minWidth: 16,
  })
  .column("vertical", {
    header: "Vertical",
    accessor: "account.vertical",
    minWidth: 14,
  })
  .column("stage", {
    header: "Stage",
    accessor: "stage",
    width: 12,
  })
  .column("sku", {
    header: "SKU",
    accessor: (row) => row.lineItems.map((line) => line.sku),
    width: 12,
  })
  .column("description", {
    header: "Description",
    accessor: (row) => row.lineItems.map((line) => line.description),
    minWidth: 22,
    style: { alignment: { wrapText: true, vertical: "top" } },
  })
  .column("quantity", {
    header: "Qty",
    accessor: (row) => row.lineItems.map((line) => line.quantity),
    width: 8,
    style: { alignment: { horizontal: "right" } },
  })
  .column("unitPrice", {
    header: "Unit Price",
    accessor: (row) => row.lineItems.map((line) => line.unitPrice),
    minWidth: 12,
    style: { numFmt: '"$"#,##0.00', alignment: { horizontal: "right" } },
  })
  .column("unitCost", {
    header: "Unit Cost",
    accessor: (row) => row.lineItems.map((line) => line.unitCost),
    minWidth: 12,
    style: { numFmt: '"$"#,##0.00', alignment: { horizontal: "right" } },
  })
  .column("lineRevenue", {
    header: "Line Revenue",
    formula: ({ row, fx }) => fx.round(row.ref("quantity").mul(row.ref("unitPrice")), 2),
    minWidth: 14,
    style: { numFmt: '"$"#,##0.00', alignment: { horizontal: "right" } },
    summary: (summary) => [summary.formula("sum")],
  })
  .column("lineCost", {
    header: "Line Cost",
    formula: ({ row, fx }) => fx.round(row.ref("quantity").mul(row.ref("unitCost")), 2),
    minWidth: 12,
    style: { numFmt: '"$"#,##0.00', alignment: { horizontal: "right" } },
    summary: (summary) => [summary.formula("sum")],
  })
  .column("discountRate", {
    header: "Discount",
    accessor: "discountRate",
    width: 10,
    style: { numFmt: "0%", alignment: { horizontal: "right" } },
  })
  .column("netRevenue", {
    header: "Net Revenue",
    formula: ({ row, fx }) =>
      fx.round(row.ref("lineRevenue").mul(row.literal(1).sub(row.ref("discountRate"))), 2),
    minWidth: 14,
    style: { numFmt: '"$"#,##0.00', alignment: { horizontal: "right" } },
    summary: (summary) => [summary.formula("sum")],
  })
  .column("marginPct", {
    header: "Margin %",
    formula: ({ row, fx }) =>
      fx.if(
        row.ref("netRevenue").gt(0),
        row.ref("netRevenue").sub(row.ref("lineCost")).div(row.ref("netRevenue")),
        0,
      ),
    width: 10,
    style: { numFmt: "0.0%", alignment: { horizontal: "right" } },
    conditionalStyle: (conditional) =>
      conditional
        .when(({ row }) => row.ref("discountRate").gte(0.18), {
          fill: { color: { rgb: "FEE2E2" } },
          font: { color: { rgb: "991B1B" }, bold: true },
        })
        .when(({ row }) => row.ref("discountRate").lt(0.08), {
          fill: { color: { rgb: "DCFCE7" } },
          font: { color: { rgb: "166534" }, bold: true },
        }),
  })
  .column("approvalFlag", {
    header: "Approval",
    accessor: (row) =>
      row.discountRate >= 0.18 || row.stage === "Negotiation" ? "REVIEW" : "CLEAR",
    minWidth: 12,
    conditionalStyle: (conditional) =>
      conditional
        .when(
          ({ row }) => row.ref("discountRate").gte(0.18).or(row.ref("stage").eq("Negotiation")),
          {
            fill: { color: { rgb: "FFEDD5" } },
            font: { color: { rgb: "9A3412" }, bold: true },
          },
        )
        .when(
          ({ row }) =>
            row.ref("discountRate").lt(0.18).and(row.ref("stage").eq("Negotiation").not()),
          {
            fill: { color: { rgb: "DCFCE7" } },
            font: { color: { rgb: "166534" }, bold: true },
          },
        ),
  })
  .column("notes", {
    header: "Notes",
    accessor: "notes",
    minWidth: 28,
    style: { alignment: { wrapText: true, vertical: "top" } },
  })
  .build();
