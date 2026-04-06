import { createExcelSchema } from "xlsmith";
import type { QuoteReview } from "./data";

export const dealDeskQuoteSchema = createExcelSchema<QuoteReview>()
  .column("quoteId", {
    header: "Quote",
    accessor: "quoteId",
    width: 14,
    summary: (summary) => [
      summary.label("Line totals"),
      summary.label("Line averages"),
      summary.label("Quote averages"),
      summary.label("Quote totals"),
    ],
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
    formula: ({ refs, fx }) => fx.round(refs.column("quantity").mul(refs.column("unitPrice")), 2),
    minWidth: 14,
    style: { numFmt: '"$"#,##0.00', alignment: { horizontal: "right" } },
    summary: (summary) => [
      summary.formula("sum"),
      summary.empty(),
      summary.empty(),
      summary.empty(),
    ],
  })
  .column("lineCost", {
    header: "Line Cost",
    formula: ({ refs, fx }) => fx.round(refs.column("quantity").mul(refs.column("unitCost")), 2),
    minWidth: 12,
    style: { numFmt: '"$"#,##0.00', alignment: { horizontal: "right" } },
    summary: (summary) => [
      summary.formula("sum"),
      summary.empty(),
      summary.empty(),
      summary.empty(),
    ],
  })
  .column("discountRate", {
    header: "Discount",
    accessor: "discountRate",
    width: 10,
    style: { numFmt: "0%", alignment: { horizontal: "right" } },
    summary: (summary) => [
      summary.empty(),
      summary.formula("average"),
      summary.empty(),
      summary.empty(),
    ],
  })
  .column("netRevenue", {
    header: "Net Revenue",
    formula: ({ refs, fx }) =>
      fx.round(
        refs
          .column("quantity")
          .mul(refs.column("unitPrice"))
          .mul(fx.literal(1).sub(refs.column("discountRate"))),
        2,
      ),
    minWidth: 14,
    style: { numFmt: '"$"#,##0.00', alignment: { horizontal: "right" } },
    summary: (summary) => [
      summary.formula("sum"),
      summary.empty(),
      summary.empty(),
      summary.empty(),
    ],
  })
  .column("marginPct", {
    header: "Margin %",
    formula: ({ refs, fx }) => {
      const netRevenue = refs
        .column("quantity")
        .mul(refs.column("unitPrice"))
        .mul(fx.literal(1).sub(refs.column("discountRate")));

      return fx.safeDiv(
        netRevenue.sub(refs.column("quantity").mul(refs.column("unitCost"))),
        netRevenue,
        {
          fallback: 0,
          when: ({ denominator }) => denominator.gt(0),
        },
      );
    },
    width: 10,
    style: { numFmt: "0.0%", alignment: { horizontal: "right" } },
    conditionalStyle: (conditional) =>
      conditional
        .when(({ refs }) => refs.column("marginPct").lt(0.18), {
          fill: { color: { rgb: "FEE2E2" } },
          font: { color: { rgb: "991B1B" }, bold: true },
        })
        .when(({ refs }) => refs.column("discountRate").lt(0.08), {
          fill: { color: { rgb: "DCFCE7" } },
          font: { color: { rgb: "166534" }, bold: true },
        }),
  })
  .column("quoteAvgLineMargin", {
    header: "Quote Avg Margin",
    formula: ({ row, fx }) => fx.round(row.series("marginPct").average(), 4),
    minWidth: 16,
    style: { numFmt: "0.0%", alignment: { horizontal: "right" } },
    summary: (summary) => [
      summary.empty(),
      summary.empty(),
      summary.formula(({ column }) => column.rows().average((row) => row.cells().average())),
      summary.empty(),
    ],
  })
  .column("quoteNetRevenue", {
    header: "Quote Net",
    formula: ({ row, fx }) => fx.round(row.series("netRevenue").sum(), 2),
    minWidth: 14,
    style: { numFmt: '"$"#,##0.00', alignment: { horizontal: "right" } },
    summary: (summary) => [
      summary.empty(),
      summary.empty(),
      summary.empty(),
      summary.formula(({ column }) => column.rows().sum((row) => row.cells().average())),
    ],
  })
  .column("approvalFlag", {
    header: "Approval",
    formula: ({ row, refs, fx }) =>
      fx.if(
        refs
          .column("discountRate")
          .gte(0.18)
          .or(refs.column("stage").eq("Negotiation"))
          .or(row.series("marginPct").min().lt(0.18)),
        "REVIEW",
        "CLEAR",
      ),
    minWidth: 12,
    conditionalStyle: (conditional) =>
      conditional
        .when(({ refs }) => refs.column("approvalFlag").eq("REVIEW"), {
          fill: { color: { rgb: "FFEDD5" } },
          font: { color: { rgb: "9A3412" }, bold: true },
        })
        .when(({ refs }) => refs.column("approvalFlag").eq("CLEAR"), {
          fill: { color: { rgb: "DCFCE7" } },
          font: { color: { rgb: "166534" }, bold: true },
        }),
  })
  .column("notes", {
    header: "Notes",
    accessor: "notes",
    minWidth: 28,
    style: { alignment: { wrapText: true, vertical: "top" } },
  })
  .build();

export const dealDeskApprovalSchema = createExcelSchema<QuoteReview>()
  .column("quoteId", {
    header: "Quote",
    accessor: "quoteId",
    width: 14,
    summary: (summary) => [summary.label("Approval average"), summary.label("Approval total")],
  })
  .column("accountName", {
    header: "Account",
    accessor: "account.name",
    minWidth: 20,
  })
  .column("vertical", {
    header: "Vertical",
    accessor: "account.vertical",
    minWidth: 14,
  })
  .column("owner", {
    header: "Owner",
    accessor: "owner.name",
    minWidth: 16,
  })
  .column("stage", {
    header: "Stage",
    accessor: "stage",
    width: 12,
  })
  .column("discountRate", {
    header: "Discount",
    accessor: "discountRate",
    width: 10,
    style: { numFmt: "0%", alignment: { horizontal: "right" } },
    summary: (summary) => [summary.formula("average"), summary.empty()],
  })
  .column("netRevenue", {
    header: "Net Revenue",
    accessor: (row) =>
      row.lineItems.reduce(
        (total, line) => total + line.quantity * line.unitPrice * (1 - row.discountRate),
        0,
      ),
    minWidth: 14,
    style: { numFmt: '"$"#,##0.00', alignment: { horizontal: "right" } },
    summary: (summary) => [summary.empty(), summary.formula("sum")],
  })
  .column("approvalFlag", {
    header: "Approval",
    accessor: (row) =>
      row.discountRate >= 0.18 || row.stage === "Negotiation" ? "REVIEW" : "CLEAR",
    minWidth: 12,
    conditionalStyle: (conditional) =>
      conditional
        .when(
          ({ refs }) =>
            refs.column("discountRate").gte(0.18).or(refs.column("stage").eq("Negotiation")),
          {
            fill: { color: { rgb: "FFEDD5" } },
            font: { color: { rgb: "9A3412" }, bold: true },
          },
        )
        .when(
          ({ refs }) =>
            refs.column("discountRate").lt(0.18).and(refs.column("stage").eq("Negotiation").not()),
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
