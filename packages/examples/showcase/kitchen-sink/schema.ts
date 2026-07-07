import { createExcelSchema, type CellStyle } from "typed-xlsx";
import type {
  AccountRow,
  BadgeCheckboxRow,
  FeatureMapRow,
  FormulaRow,
  LinkRow,
  NativeTableRow,
  OrderRow,
  ProductMediaRow,
  ProtectedInputRow,
  SparklineRow,
  SummaryRow,
  TerritoryRow,
  ValidationRow,
} from "./data";

const headerStyle: CellStyle = {
  fill: { color: { rgb: "0F172A" } },
  font: { color: { rgb: "FFFFFF" }, bold: true },
  alignment: { vertical: "center" },
};

const currencyStyle: CellStyle = {
  numFmt: '"$"#,##0',
  alignment: { horizontal: "right" },
};

const percentStyle: CellStyle = {
  numFmt: "0.0%",
  alignment: { horizontal: "right" },
};

const wrapStyle: CellStyle = {
  alignment: { wrapText: true, vertical: "top" },
};

const trackVariants = {
  Schema: {
    style: {
      fill: { color: { rgb: "DBEAFE" } },
      font: { color: { rgb: "1D4ED8" }, bold: true },
    },
  },
  Formula: {
    style: {
      fill: { color: { rgb: "DCFCE7" } },
      font: { color: { rgb: "166534" }, bold: true },
    },
  },
  Renderer: {
    style: {
      fill: { color: { rgb: "E0F2FE" } },
      font: { color: { rgb: "0369A1" }, bold: true },
    },
  },
  Workflow: {
    style: {
      fill: { color: { rgb: "FCE7F3" } },
      font: { color: { rgb: "BE185D" }, bold: true },
    },
  },
  Workbook: {
    style: {
      fill: { color: { rgb: "FEF3C7" } },
      font: { color: { rgb: "92400E" }, bold: true },
    },
  },
  Layout: {
    style: {
      fill: { color: { rgb: "F3E8FF" } },
      font: { color: { rgb: "7E22CE" }, bold: true },
    },
  },
} as const;

const tierVariants = {
  Enterprise: {
    style: {
      fill: { color: { rgb: "DBEAFE" } },
      font: { color: { rgb: "1D4ED8" }, bold: true },
    },
  },
  Growth: {
    style: {
      fill: { color: { rgb: "DCFCE7" } },
      font: { color: { rgb: "166534" }, bold: true },
    },
  },
  Starter: {
    style: {
      fill: { color: { rgb: "FEF3C7" } },
      font: { color: { rgb: "92400E" }, bold: true },
    },
  },
} as const;

export const featureMapSchema = createExcelSchema<FeatureMapRow>()
  .column("track", {
    type: "badge",
    header: "Track",
    accessor: "track",
    width: 12,
    variants: trackVariants,
    headerStyle,
  })
  .column("feature", {
    header: "Feature",
    accessor: "feature",
    minWidth: 22,
    headerStyle,
  })
  .column("sheet", {
    type: "hyperlink",
    header: "Workbook Tab",
    accessor: "sheet",
    target: (row: FeatureMapRow) => row.target,
    tooltip: "Jump to sheet",
    minWidth: 24,
    headerStyle,
  })
  .column("demonstrates", {
    header: "What To Inspect",
    accessor: "demonstrates",
    minWidth: 42,
    style: wrapStyle,
    headerStyle,
  })
  .column("apiSurface", {
    header: "API Surface",
    accessor: "apiSurface",
    minWidth: 42,
    style: wrapStyle,
    headerStyle,
  })
  .column("buffered", {
    type: "checkbox",
    header: "Buffered",
    accessor: "buffered",
    width: 10,
    headerStyle,
  })
  .column("streaming", {
    type: "checkbox",
    header: "Streaming",
    accessor: "streaming",
    width: 10,
    headerStyle,
  })
  .build();

export const typedAccessorsSchema = createExcelSchema<AccountRow>()
  .column("account", {
    header: "Account",
    accessor: "account",
    autoWidth: true,
    minWidth: 20,
    headerStyle,
  })
  .column("owner", {
    header: "Owner",
    accessor: "owner",
    minWidth: 16,
    headerStyle,
  })
  .column("ownerContact", {
    header: "Owner Contact",
    accessor: (row) => `${row.owner} <${row.ownerEmail}>`,
    minWidth: 28,
    headerStyle,
  })
  .column("tier", {
    type: "badge",
    header: "Tier",
    accessor: "tier",
    width: 14,
    variants: tierVariants,
    headerStyle,
  })
  .column("arr", {
    header: "ARR",
    accessor: "arr",
    minWidth: 12,
    style: currencyStyle,
    headerStyle,
  })
  .column("renewalDate", {
    header: "Renewal",
    accessor: "renewalDate",
    width: 14,
    style: { numFmt: "yyyy-mm-dd" },
    headerStyle,
  })
  .column("notes", {
    header: "Notes",
    accessor: "notes",
    defaultValue: "No note",
    minWidth: 34,
    style: wrapStyle,
    headerStyle,
  })
  .build();

export const subRowExpansionSchema = createExcelSchema<OrderRow>()
  .column("orderId", {
    header: "Order",
    accessor: "orderId",
    width: 12,
    headerStyle,
    summary: (summary) => [summary.label("TOTAL")],
  })
  .column("customer", {
    header: "Customer",
    accessor: "customer.name",
    minWidth: 22,
    headerStyle,
  })
  .column("tier", {
    type: "badge",
    header: "Tier",
    accessor: "customer.tier",
    width: 14,
    variants: tierVariants,
    headerStyle,
  })
  .column("sku", {
    header: "SKU",
    accessor: (row) => row.lines.map((line) => line.sku),
    width: 12,
    headerStyle,
  })
  .column("description", {
    header: "Description",
    accessor: (row) => row.lines.map((line) => line.description),
    minWidth: 24,
    style: wrapStyle,
    headerStyle,
  })
  .column("quantity", {
    header: "Qty",
    accessor: (row) => row.lines.map((line) => line.quantity),
    width: 8,
    style: { alignment: { horizontal: "right" } },
    headerStyle,
    summary: (summary) => [
      summary.cell({
        init: () => 0,
        step: (acc: number, row) => acc + row.lines.reduce((sum, line) => sum + line.quantity, 0),
        finalize: (acc: number) => acc,
      }),
    ],
  })
  .column("unitPrice", {
    header: "Unit Price",
    accessor: (row) => row.lines.map((line) => line.unitPrice),
    minWidth: 12,
    style: currencyStyle,
    headerStyle,
  })
  .column("lineTotal", {
    header: "Line Total",
    accessor: (row) => row.lines.map((line) => line.quantity * line.unitPrice),
    minWidth: 12,
    style: currencyStyle,
    headerStyle,
    summary: (summary) => [
      summary.cell({
        init: () => 0,
        step: (acc: number, row) =>
          acc + row.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
        finalize: (acc: number) => acc,
        style: currencyStyle,
      }),
    ],
  })
  .column("shipped", {
    type: "checkbox",
    header: "Shipped",
    accessor: (row) => row.lines.map((line) => line.shipped),
    width: 10,
    headerStyle,
  })
  .build();

export const formulaDslSchema = createExcelSchema<FormulaRow>()
  .column("product", {
    header: "Product",
    accessor: "product",
    minWidth: 22,
    headerStyle,
  })
  .column("quantity", {
    header: "Qty",
    accessor: "quantity",
    width: 8,
    style: { alignment: { horizontal: "right" } },
    headerStyle,
  })
  .column("unitPrice", {
    header: "Unit Price",
    accessor: "unitPrice",
    minWidth: 12,
    style: currencyStyle,
    headerStyle,
  })
  .column("discountRate", {
    header: "Discount",
    accessor: "discountRate",
    width: 10,
    style: { numFmt: "0%", alignment: { horizontal: "right" } },
    headerStyle,
  })
  .column("seatsPurchased", {
    header: "Seats",
    accessor: "seatsPurchased",
    width: 9,
    style: { alignment: { horizontal: "right" } },
    headerStyle,
  })
  .column("seatsActivated", {
    header: "Activated",
    accessor: "seatsActivated",
    width: 10,
    style: { alignment: { horizontal: "right" } },
    headerStyle,
  })
  .column("gross", {
    header: "Gross",
    formula: ({ refs, fx }) => fx.round(refs.column("quantity").mul(refs.column("unitPrice")), 2),
    minWidth: 12,
    style: currencyStyle,
    headerStyle,
  })
  .column("net", {
    header: "Net",
    formula: ({ refs, fx }) =>
      fx.round(refs.column("gross").mul(fx.literal(1).sub(refs.column("discountRate"))), 2),
    minWidth: 12,
    style: currencyStyle,
    conditionalStyle: (conditional) =>
      conditional
        .when(({ refs }) => refs.column("net").lt(1500), {
          fill: { color: { rgb: "FEE2E2" } },
          font: { color: { rgb: "991B1B" }, bold: true },
        })
        .when(({ refs }) => refs.column("net").gte(8000), {
          fill: { color: { rgb: "DCFCE7" } },
          font: { color: { rgb: "166534" }, bold: true },
        }),
    headerStyle,
  })
  .column("utilization", {
    header: "Utilization",
    formula: ({ refs, fx }) =>
      fx.round(fx.safeDiv(refs.column("seatsActivated"), refs.column("seatsPurchased")), 4),
    width: 12,
    style: percentStyle,
    headerStyle,
  })
  .column("review", {
    header: "Review",
    formula: ({ refs, fx }) =>
      fx.if(
        refs.column("discountRate").gte(0.15).or(refs.column("utilization").lt(0.5)),
        "Review",
        "OK",
      ),
    width: 10,
    conditionalStyle: (conditional) =>
      conditional
        .when(({ refs }) => refs.column("review").eq("Review"), {
          fill: { color: { rgb: "FFEDD5" } },
          font: { color: { rgb: "9A3412" }, bold: true },
        })
        .when(({ refs }) => refs.column("review").eq("OK"), {
          fill: { color: { rgb: "DCFCE7" } },
          font: { color: { rgb: "166534" }, bold: true },
        }),
    headerStyle,
  })
  .build();

export const summaryRowsSchema = createExcelSchema<SummaryRow>()
  .column("account", {
    header: "Account",
    accessor: "account",
    minWidth: 22,
    headerStyle,
    summary: (summary) => [summary.label("TOTAL"), summary.label("AVERAGE / DISTINCT")],
  })
  .column("region", {
    header: "Region",
    accessor: "region",
    width: 10,
    headerStyle,
    summary: (summary) => [
      summary.empty(),
      summary.cell({
        init: () => new Set<string>(),
        step: (acc: Set<string>, row) => acc.add(row.region),
        finalize: (acc: Set<string>) => `${acc.size} regions`,
      }),
    ],
  })
  .column("revenue", {
    header: "Revenue",
    accessor: "revenue",
    minWidth: 12,
    style: currencyStyle,
    headerStyle,
    summary: (summary) => [summary.formula("sum"), summary.formula("average")],
  })
  .column("cost", {
    header: "Cost",
    accessor: "cost",
    minWidth: 12,
    style: currencyStyle,
    headerStyle,
    summary: (summary) => [summary.formula("sum"), summary.formula("average")],
  })
  .column("margin", {
    header: "Margin",
    formula: ({ refs, fx }) =>
      fx.round(
        fx.safeDiv(refs.column("revenue").sub(refs.column("cost")), refs.column("revenue")),
        4,
      ),
    width: 12,
    style: percentStyle,
    headerStyle,
    summary: (summary) => [summary.formula("average"), summary.formula("max")],
  })
  .column("healthScore", {
    header: "Health",
    accessor: "healthScore",
    width: 10,
    style: { alignment: { horizontal: "right" } },
    headerStyle,
    summary: (summary) => [summary.formula("average"), summary.formula("min")],
  })
  .column("closedAt", {
    header: "Closed",
    accessor: "closedAt",
    width: 14,
    style: { numFmt: "yyyy-mm-dd" },
    headerStyle,
    summary: (summary) => [summary.empty(), summary.formula("max")],
  })
  .build();

export const dynamicColumnsSchema = createExcelSchema<TerritoryRow, { regions: string[] }>({
  mode: "excel-table",
})
  .column("territory", {
    header: "Territory",
    accessor: "territory",
    minWidth: 18,
    totalsRow: { label: "TOTAL" },
  })
  .column("manager", {
    header: "Manager",
    accessor: "manager",
    minWidth: 16,
  })
  .column("quarter", {
    header: "Quarter",
    accessor: "quarter",
    width: 10,
  })
  .dynamic("regions", (builder, { ctx }) => {
    for (const region of ctx.regions) {
      builder.column(region, {
        header: region,
        accessor: (row) => row.revenueByRegion[region] ?? 0,
        style: currencyStyle,
        totalsRow: { function: "sum" },
      });
    }
  })
  .column("regionalTotal", {
    header: "Regional Total",
    formula: ({ refs, fx }) => fx.sum(refs.dynamic("regions")),
    minWidth: 16,
    style: { ...currencyStyle, font: { bold: true } },
    totalsRow: { function: "sum" },
  })
  .column("regionalAverage", {
    header: "Regional Avg",
    formula: ({ refs, fx }) => fx.round(fx.average(refs.dynamic("regions")), 0),
    minWidth: 14,
    style: currencyStyle,
    totalsRow: { function: "average" },
  })
  .build();

export const badgeCheckboxSchema = createExcelSchema<BadgeCheckboxRow>()
  .column("account", {
    header: "Account",
    accessor: "account",
    minWidth: 22,
    headerStyle,
  })
  .column("status", {
    type: "badge",
    header: "Status",
    accessor: "status",
    width: 12,
    variants: {
      Live: {
        style: {
          fill: { color: { rgb: "DCFCE7" } },
          font: { color: { rgb: "166534" }, bold: true },
        },
      },
      "At risk": {
        style: {
          fill: { color: { rgb: "FEE2E2" } },
          font: { color: { rgb: "991B1B" }, bold: true },
        },
      },
      Launch: {
        label: () => "Launching",
        style: {
          fill: { color: { rgb: "DBEAFE" } },
          font: { color: { rgb: "1D4ED8" }, bold: true },
        },
      },
    },
    headerStyle,
  })
  .column("priority", {
    type: "badge",
    header: "Priority",
    accessor: "priority",
    width: 12,
    variants: {
      High: {
        style: {
          fill: { color: { rgb: "FFEDD5" } },
          font: { color: { rgb: "9A3412" }, bold: true },
        },
      },
      Medium: {
        style: {
          fill: { color: { rgb: "FEF3C7" } },
          font: { color: { rgb: "92400E" }, bold: true },
        },
      },
      Low: {
        style: {
          fill: { color: { rgb: "E2E8F0" } },
          font: { color: { rgb: "334155" }, bold: true },
        },
      },
    },
    headerStyle,
  })
  .column("launchReady", {
    type: "checkbox",
    header: "Launch",
    accessor: "launchReady",
    width: 10,
    style: ({ row }) =>
      row.canEditLaunch
        ? { protection: { locked: false } }
        : {
            fill: { color: { rgb: "E2E8F0" } },
            font: { color: { rgb: "64748B" } },
            protection: { locked: true },
          },
    headerStyle,
  })
  .column("billingOk", {
    type: "checkbox",
    header: "Billing",
    accessor: "billingOk",
    width: 10,
    style: {
      fill: { color: { rgb: "F8FAFC" } },
      font: { color: { rgb: "475569" } },
      protection: { locked: true },
    },
    headerStyle,
  })
  .column("launchDecision", {
    header: "Live Decision",
    formula: ({ refs, fx }) =>
      fx.if(
        fx.and(refs.column("launchReady").eq(true), refs.column("billingOk").eq(true)),
        "Ready",
        fx.if(refs.column("launchReady").eq(true), "Billing hold", "Waiting"),
      ),
    minWidth: 18,
    style: {
      alignment: { horizontal: "center" },
      font: { bold: true },
    },
    conditionalStyle: (conditional) =>
      conditional
        .when(
          ({ refs, fx }) =>
            fx.and(refs.column("launchReady").eq(true), refs.column("billingOk").eq(true)),
          {
            fill: { color: { rgb: "DCFCE7" } },
            font: { color: { rgb: "166534" }, bold: true },
          },
        )
        .when(
          ({ refs, fx }) =>
            fx.and(refs.column("launchReady").eq(true), refs.column("billingOk").neq(true)),
          {
            fill: { color: { rgb: "FEF3C7" } },
            font: { color: { rgb: "92400E" }, bold: true },
          },
        )
        .when(({ refs }) => refs.column("launchReady").neq(true), {
          fill: { color: { rgb: "F1F5F9" } },
          font: { color: { rgb: "475569" }, bold: true },
        }),
    headerStyle,
  })
  .build();

export const hyperlinkSchema = createExcelSchema<LinkRow>()
  .column("account", {
    type: "hyperlink",
    header: "Customer Record",
    accessor: "account",
    target: (row: LinkRow) => `https://example.com/customers/${row.customerId}`,
    tooltip: "Open customer record",
    minWidth: 22,
    headerStyle,
  })
  .column("email", {
    type: "hyperlink",
    header: "Email",
    accessor: "email",
    target: (row: LinkRow) => `mailto:${row.email}`,
    tooltip: "Send email",
    minWidth: 24,
    headerStyle,
  })
  .column("invoice", {
    type: "hyperlink",
    header: "Internal Jump",
    accessor: "invoiceId",
    target: "#'04 Summary Rows'!A1",
    tooltip: "Jump to summary sheet",
    minWidth: 18,
    headerStyle,
  })
  .build();

export const sparklineSchema = createExcelSchema<SparklineRow>()
  .column("segment", {
    header: "Segment",
    accessor: "segment",
    minWidth: 16,
    headerStyle,
  })
  .group("monthly", { header: "Monthly Revenue" }, (group) =>
    group
      .column("jan", { header: "Jan", accessor: "jan", width: 8, headerStyle })
      .column("feb", { header: "Feb", accessor: "feb", width: 8, headerStyle })
      .column("mar", { header: "Mar", accessor: "mar", width: 8, headerStyle })
      .column("apr", { header: "Apr", accessor: "apr", width: 8, headerStyle })
      .column("may", { header: "May", accessor: "may", width: 8, headerStyle })
      .column("jun", { header: "Jun", accessor: "jun", width: 8, headerStyle }),
  )
  .column("lineTrend", {
    type: "sparkline",
    header: "Line",
    source: { group: "monthly" },
    sparklineType: "line",
    width: 18,
    style: {
      line: { color: "#2563EB", weight: 1.05 },
      last: { color: "#10B981" },
      low: { color: "#EF4444" },
    },
    headerStyle,
  })
  .column("columnTrend", {
    type: "sparkline",
    header: "Column",
    source: { group: "monthly" },
    sparklineType: "column",
    width: 18,
    style: {
      series: "#0EA5E9",
      high: { color: "#22C55E" },
      low: { color: "#FB923C" },
    },
    headerStyle,
  })
  .group("movement", { header: "MoM Delta" }, (group) =>
    group
      .column("deltaJan", { header: "Jan", accessor: "deltaJan", width: 8, headerStyle })
      .column("deltaFeb", { header: "Feb", accessor: "deltaFeb", width: 8, headerStyle })
      .column("deltaMar", { header: "Mar", accessor: "deltaMar", width: 8, headerStyle })
      .column("deltaApr", { header: "Apr", accessor: "deltaApr", width: 8, headerStyle })
      .column("deltaMay", { header: "May", accessor: "deltaMay", width: 8, headerStyle })
      .column("deltaJun", { header: "Jun", accessor: "deltaJun", width: 8, headerStyle }),
  )
  .column("winLoss", {
    type: "sparkline",
    header: "Win/Loss",
    source: { group: "movement" },
    sparklineType: "winLoss",
    width: 18,
    style: {
      series: "#16A34A",
      negative: { color: "#EF4444" },
      axis: { visible: true, color: "#475569" },
    },
    headerStyle,
  })
  .build();

export const imageMediaSchema = createExcelSchema<ProductMediaRow>()
  .column("thumbnail", {
    type: "image",
    header: "Embedded",
    accessor: "thumbnail",
    alt: "productName",
    size: { width: 44, height: 44 },
    padding: 3,
    width: 10,
    headerStyle,
  })
  .column("remotePreview", {
    type: "image",
    source: "url",
    header: "URL Image",
    accessor: "thumbnailUrl",
    alt: "productName",
    size: { width: 44, height: 44 },
    width: 10,
    headerStyle,
  })
  .column("sku", {
    header: "SKU",
    accessor: "sku",
    width: 12,
    headerStyle,
  })
  .column("productName", {
    type: "hyperlink",
    header: "Product",
    accessor: "productName",
    target: (row: ProductMediaRow) => row.storefrontUrl,
    tooltip: "Open storefront page",
    minWidth: 24,
    headerStyle,
  })
  .column("category", {
    header: "Category",
    accessor: "category",
    width: 14,
    headerStyle,
  })
  .column("status", {
    type: "badge",
    header: "Status",
    accessor: "status",
    width: 12,
    variants: {
      Live: {
        style: {
          fill: { color: { rgb: "DCFCE7" } },
          font: { color: { rgb: "166534" }, bold: true },
        },
      },
      "Low stock": {
        style: {
          fill: { color: { rgb: "FEF3C7" } },
          font: { color: { rgb: "92400E" }, bold: true },
        },
      },
      Launch: {
        style: {
          fill: { color: { rgb: "DBEAFE" } },
          font: { color: { rgb: "1D4ED8" }, bold: true },
        },
      },
    },
    headerStyle,
  })
  .column("listedOnline", {
    type: "checkbox",
    header: "Listed",
    accessor: "listedOnline",
    width: 9,
    headerStyle,
  })
  .column("price", {
    header: "Price",
    accessor: "price",
    width: 10,
    style: currencyStyle,
    headerStyle,
  })
  .build();

export const validationSchema = createExcelSchema<ValidationRow>()
  .column("owner", {
    header: "Owner",
    accessor: "owner",
    minWidth: 18,
    headerStyle,
  })
  .column("status", {
    header: "Status",
    accessor: "status",
    width: 12,
    headerStyle,
    validation: (validation) =>
      validation
        .list(["draft", "active", "archived"])
        .prompt({ title: "Allowed values", message: "Choose draft, active, or archived." })
        .error({ title: "Invalid status", message: "Use one of the allowed workflow states." }),
  })
  .column("amount", {
    header: "Amount",
    accessor: "amount",
    minWidth: 12,
    style: currencyStyle,
    headerStyle,
    validation: (validation) =>
      validation
        .integer()
        .between(1000, 100000)
        .error({ title: "Invalid amount", message: "Use a whole number from 1,000 to 100,000." }),
    summary: (summary) => [summary.label("TOTAL"), summary.formula("sum")],
  })
  .column("startDate", {
    header: "Start Date",
    accessor: "startDate",
    width: 14,
    style: { numFmt: "yyyy-mm-dd" },
    headerStyle,
    validation: (validation) => validation.date().gte(new Date(Date.UTC(2026, 0, 1))),
  })
  .build();

export const protectedInputSchema = createExcelSchema<ProtectedInputRow>()
  .column("owner", {
    header: "Owner",
    accessor: "owner",
    minWidth: 18,
    style: { protection: { locked: true } },
    headerStyle,
  })
  .column("requestedBudget", {
    header: "Requested Budget",
    accessor: "requestedBudget",
    minWidth: 18,
    style: { ...currencyStyle, protection: { locked: false } },
    headerStyle,
    validation: (validation) => validation.integer().between(1000, 100000),
  })
  .column("approvedBudget", {
    header: "Approved Budget",
    formula: ({ refs, fx }) => fx.round(refs.column("requestedBudget").mul(0.9), 0),
    minWidth: 18,
    style: { ...currencyStyle, protection: { hidden: true } },
    headerStyle,
  })
  .build();

export const nativeExcelTableSchema = createExcelSchema<NativeTableRow>({ mode: "excel-table" })
  .column("product", {
    header: "Product",
    accessor: "product",
    minWidth: 22,
    totalsRow: { label: "TOTAL" },
  })
  .column("region", {
    header: "Region",
    accessor: "region",
    width: 10,
  })
  .column("units", {
    header: "Units",
    accessor: "units",
    width: 10,
    style: { alignment: { horizontal: "right" } },
    totalsRow: { function: "sum" },
  })
  .column("revenue", {
    header: "Revenue",
    accessor: "revenue",
    minWidth: 12,
    style: currencyStyle,
    totalsRow: { function: "sum" },
  })
  .column("cost", {
    header: "Cost",
    accessor: "cost",
    minWidth: 12,
    style: currencyStyle,
    totalsRow: { function: "sum" },
  })
  .column("margin", {
    header: "Margin",
    formula: ({ refs, fx }) =>
      fx.round(
        fx.safeDiv(refs.column("revenue").sub(refs.column("cost")), refs.column("revenue")),
        4,
      ),
    width: 12,
    style: percentStyle,
    totalsRow: { label: "-" },
  })
  .build();
