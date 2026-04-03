import { createExcelSchema, type CellStyle } from "../../../src";
import type { KitchenSinkOrder } from "./data";

const headerStyle: CellStyle = {
  font: { bold: true, color: { rgb: "1F2937" } },
  fill: { color: { rgb: "DCEBFF" } },
};

const currencyStyle: CellStyle = {
  numFmt: '"$"#,##0.00',
  alignment: { horizontal: "right" },
};

export const kitchenSinkSchema = createExcelSchema<KitchenSinkOrder>()
  .column("orderId", {
    header: "Order",
    accessor: "orderId",
    width: 12,
    headerStyle,
    summary: (summary) => [
      summary.cell({
        init: () => 0,
        step: (acc: number) => acc + 1,
        finalize: (acc: number) => acc,
      }),
    ],
  })
  .column("customerName", {
    header: "Customer",
    accessor: "customer.name",
    minWidth: 18,
    headerStyle,
  })
  .column("accountLabel", {
    header: "Account",
    accessor: (row) => `${row.customer.tier.toUpperCase()} / ${row.region}`,
    minWidth: 18,
    headerStyle,
  })
  .column("email", {
    header: "Email",
    accessor: "customer.email",
    minWidth: 20,
    headerStyle,
  })
  .column("sku", {
    header: "SKU",
    accessor: (row) => row.items.map((item) => item.sku),
    minWidth: 12,
    headerStyle,
  })
  .column("description", {
    header: "Description",
    accessor: (row) => row.items.map((item) => item.description),
    minWidth: 24,
    style: {
      alignment: {
        wrapText: true,
        vertical: "top",
      },
    },
    headerStyle,
  })
  .column("quantity", {
    header: "Qty",
    accessor: (row) => row.items.map((item) => item.quantity),
    width: 8,
    style: {
      alignment: { horizontal: "right" },
    },
    headerStyle,
    summary: (summary) => [
      summary.cell({
        init: () => 0,
        step: (acc: number, row) => acc + row.items.reduce((sum, item) => sum + item.quantity, 0),
        finalize: (acc: number) => acc,
      }),
    ],
  })
  .column("unitPrice", {
    header: "Unit Price",
    accessor: (row) => row.items.map((item) => item.unitPrice),
    minWidth: 12,
    style: currencyStyle,
    headerStyle,
  })
  .column("lineTotal", {
    header: "Line Total",
    accessor: (row) => row.items.map((item) => item.quantity * item.unitPrice),
    minWidth: 12,
    style: ({ row, subRowIndex }) => {
      const item = row.items[subRowIndex];
      return {
        ...currencyStyle,
        font: {
          color: {
            rgb: item?.fulfilled ? "166534" : "B42318",
          },
        },
      };
    },
    headerStyle,
    summary: (summary) => [
      summary.cell({
        init: () => 0,
        step: (acc: number, row) =>
          acc + row.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
        finalize: (acc: number) => acc,
        style: currencyStyle,
      }),
    ],
  })
  .column("fulfilled", {
    header: "Fulfilled",
    accessor: (row) => row.items.map((item) => (item.fulfilled ? "YES" : "PENDING")),
    minWidth: 12,
    style: ({ row, subRowIndex }) => ({
      alignment: { horizontal: "center" },
      font: {
        bold: true,
        color: {
          rgb: row.items[subRowIndex]?.fulfilled ? "166534" : "B42318",
        },
      },
    }),
    headerStyle,
  })
  .column("notes", {
    header: "Notes",
    accessor: "notes",
    minWidth: 24,
    style: {
      alignment: {
        wrapText: true,
        vertical: "top",
      },
      font: {
        size: 12,
      },
    },
    headerStyle,
  })
  .column("tagList", {
    header: "Tags",
    accessor: (row) => row.tags.join(", "),
    minWidth: 18,
    headerStyle,
  })
  .column("createdAt", {
    header: "Created",
    accessor: "createdAt",
    width: 22,
    style: {
      numFmt: "yyyy-mm-dd hh:mm",
    },
    headerStyle,
  })
  .build();

export const kitchenSinkFormulaSummarySchema = createExcelSchema<{
  amount: number;
  fulfilledRatio: number;
  itemCount: number;
  createdAt: Date;
  customerName: string;
}>()
  .column("customerName", {
    header: "Customer",
    accessor: "customerName",
    minWidth: 18,
    headerStyle,
    summary: (summary) => [summary.label("TOTAL"), summary.label("AVERAGE / LATEST")],
  })
  .column("amount", {
    header: "Amount",
    accessor: "amount",
    minWidth: 12,
    style: currencyStyle,
    headerStyle,
    summary: (summary) => [
      summary.formula(({ column, fx }) => fx.round(column.cells().sum(), 2), {
        style: {
          ...currencyStyle,
          font: { bold: true },
        },
        conditionalStyle: (conditional) =>
          conditional.when(({ cell }) => cell.current().gte(40000), {
            fill: { color: { rgb: "DCFCE7" } },
            font: { color: { rgb: "166534" }, bold: true },
          }),
      }),
      summary.formula(({ column, fx }) => fx.round(column.cells().average(), 2), {
        style: {
          ...currencyStyle,
          font: { bold: true },
        },
        conditionalStyle: (conditional) =>
          conditional
            .when(({ cell }) => cell.current().lt(5000), {
              fill: { color: { rgb: "FEE2E2" } },
              font: { color: { rgb: "991B1B" }, bold: true },
            })
            .when(({ cell }) => cell.current().gte(8000), {
              fill: { color: { rgb: "DCFCE7" } },
              font: { color: { rgb: "166534" }, bold: true },
            }),
      }),
    ],
  })
  .column("itemCount", {
    header: "Items",
    accessor: "itemCount",
    width: 9,
    style: {
      alignment: { horizontal: "right" },
    },
    headerStyle,
    summary: (summary) => [summary.formula("sum"), summary.formula("average")],
  })
  .column("fulfilledRatio", {
    header: "Fulfilled %",
    accessor: "fulfilledRatio",
    width: 12,
    style: {
      numFmt: "0.0%",
      alignment: { horizontal: "right" },
    },
    headerStyle,
    summary: (summary) => [
      summary.formula(({ column, fx }) => fx.round(column.cells().average(), 4), {
        style: {
          numFmt: "0.0%",
          alignment: { horizontal: "right" },
          font: { bold: true },
        },
        conditionalStyle: (conditional) =>
          conditional
            .when(({ cell }) => cell.current().lt(0.6), {
              fill: { color: { rgb: "FEE2E2" } },
              font: { color: { rgb: "991B1B" }, bold: true },
            })
            .when(({ cell }) => cell.current().gte(0.85), {
              fill: { color: { rgb: "DCFCE7" } },
              font: { color: { rgb: "166534" }, bold: true },
            }),
      }),
      summary.formula(({ column, fx }) => fx.max(column.cells().max(), 0), {
        style: {
          numFmt: "0.0%",
          alignment: { horizontal: "right" },
          font: { bold: true },
        },
        conditionalStyle: (conditional) =>
          conditional.when(({ cell }) => cell.current().gte(0.95), {
            fill: { color: { rgb: "DBEAFE" } },
            font: { color: { rgb: "1D4ED8" }, bold: true },
          }),
      }),
    ],
  })
  .column("createdAt", {
    header: "Created",
    accessor: "createdAt",
    width: 22,
    style: {
      numFmt: "yyyy-mm-dd hh:mm",
    },
    headerStyle,
    summary: (summary) => [
      summary.empty(),
      summary.formula(({ column, fx }) => fx.max(column.cells().max(), 0)),
    ],
  })
  .build();

export const kitchenSinkValidationSchema = createExcelSchema<{
  amount: number;
  owner: string;
  startDate: Date;
  status: "draft" | "active" | "archived";
}>()
  .column("owner", {
    header: () => "Owner",
    accessor: "owner",
    minWidth: 18,
    headerStyle,
  })
  .column("status", {
    header: () => "Status",
    accessor: "status",
    width: 12,
    headerStyle,
    validation: (v) =>
      v
        .list(["draft", "active", "archived"])
        .prompt({
          title: () => "Allowed values",
          message: () => "Choose draft, active, or archived",
        })
        .error({
          title: () => "Invalid status",
          message: () => "Use one of the allowed workflow states",
        }),
  })
  .column("amount", {
    header: () => "Amount",
    accessor: "amount",
    minWidth: 12,
    style: currencyStyle,
    headerStyle,
    validation: (v) => v.integer().between(100, 100000).allowBlank(),
    summary: (summary) => [summary.label(() => "TOTAL"), summary.formula("sum")],
  })
  .column("startDate", {
    header: () => "Start Date",
    accessor: "startDate",
    width: 14,
    style: { numFmt: "yyyy-mm-dd" },
    headerStyle,
    validation: (v) => v.date().gte(new Date(Date.UTC(2025, 0, 1))),
  })
  .build();

export const kitchenSinkProtectedInputSchema = createExcelSchema<{
  approvedBudget: number;
  owner: string;
  requestedBudget: number;
}>()
  .column("owner", {
    header: () => "Owner",
    accessor: "owner",
    minWidth: 18,
    headerStyle,
    style: {
      protection: { locked: true },
    },
  })
  .column("requestedBudget", {
    header: () => "Requested Budget",
    accessor: "requestedBudget",
    minWidth: 16,
    style: {
      ...currencyStyle,
      protection: { locked: false },
    },
    headerStyle,
    validation: (v) =>
      v
        .integer()
        .between(1000, 50000)
        .error({
          title: () => "Invalid budget",
          message: () => "Use a whole number between 1,000 and 50,000",
        }),
  })
  .column("approvedBudget", {
    header: () => "Approved Budget",
    formula: ({ refs, fx }) => fx.round(refs.column("requestedBudget").mul(0.9), 0),
    minWidth: 16,
    style: {
      ...currencyStyle,
      protection: { hidden: true },
    },
    headerStyle,
  })
  .build();

export const kitchenSinkHyperlinkSchema = createExcelSchema<{
  customerId: string;
  customerName: string;
  email: string;
  hasPortal: boolean;
}>()
  .column("customerName", {
    header: () => "Customer",
    accessor: "customerName",
    minWidth: 20,
    headerStyle,
    hyperlink: (row) =>
      row.hasPortal
        ? {
            target: `https://example.com/customers/${row.customerId}`,
            tooltip: "Open customer record",
            style: {
              font: {
                color: { rgb: "7C3AED" },
                underline: false,
                bold: true,
              },
            },
          }
        : null,
  })
  .column("email", {
    header: () => "Email",
    accessor: "email",
    minWidth: 24,
    headerStyle,
    hyperlink: (row) => ({
      target: `mailto:${row.email}`,
      tooltip: "Send email",
    }),
  })
  .build();

export const kitchenSinkFormulaColumnSchema = createExcelSchema<{
  customerName: string;
  qty: number;
  unitPrice: number;
  segment: string;
  discountRate: number;
  activatedSeats: number;
}>()
  .column("customerName", {
    header: "Customer",
    accessor: "customerName",
    minWidth: 18,
    headerStyle,
  })
  .column("qty", {
    header: "Qty",
    accessor: "qty",
    width: 8,
    style: {
      alignment: { horizontal: "right" },
    },
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
    style: {
      numFmt: "0%",
      alignment: { horizontal: "right" },
    },
    headerStyle,
  })
  .column("activatedSeats", {
    header: "Activated",
    accessor: "activatedSeats",
    width: 10,
    style: {
      alignment: { horizontal: "right" },
    },
    headerStyle,
  })
  .column("grossTotal", {
    header: "Gross",
    formula: ({ refs, fx }) => fx.round(refs.column("qty").mul(refs.column("unitPrice")), 2),
    minWidth: 12,
    style: currencyStyle,
    headerStyle,
    summary: (summary) => [summary.formula(({ column, fx }) => fx.round(column.cells().sum(), 2))],
  })
  .column("seatUtilization", {
    header: "Utilization",
    formula: ({ refs, fx }) =>
      fx.if(
        refs.column("qty").gt(0),
        fx.round(refs.column("activatedSeats").div(refs.column("qty")), 4),
        0,
      ),
    width: 12,
    style: {
      numFmt: "0.0%",
      alignment: { horizontal: "right" },
    },
    headerStyle,
  })
  .column("lineTotal", {
    header: "Net",
    formula: ({ refs, fx }) =>
      fx.round(refs.column("grossTotal").mul(fx.literal(1).sub(refs.column("discountRate"))), 2),
    minWidth: 12,
    style: currencyStyle,
    conditionalStyle: (c) =>
      c
        .when(({ refs }) => refs.column("lineTotal").lt(1000), {
          fill: { color: { rgb: "FEE2E2" } },
          font: { color: { rgb: "991B1B" }, bold: true },
        })
        .when(
          ({ refs, fx }) =>
            fx.and(refs.column("lineTotal").gte(5000), refs.column("seatUtilization").gte(0.85)),
          {
            fill: { color: { rgb: "DCFCE7" } },
            font: { color: { rgb: "166534" }, bold: true },
          },
        ),
    headerStyle,
    summary: (summary) => [summary.formula(({ column, fx }) => fx.round(column.cells().sum(), 2))],
  })
  .column("segment", {
    header: "Segment",
    formula: ({ refs, fx }) =>
      fx.if(
        refs.column("lineTotal").gte(5000).or(refs.column("seatUtilization").gte(0.85)),
        "HIGH",
        fx.if(refs.column("discountRate").gte(0.15), "WATCH", "STANDARD"),
      ),
    minWidth: 12,
    headerStyle,
  })
  .column("riskFlag", {
    header: "Risk",
    formula: ({ refs, fx }) =>
      fx.if(
        refs.column("segment").eq("WATCH").or(refs.column("seatUtilization").lt(0.5)),
        "REVIEW",
        "OK",
      ),
    minWidth: 10,
    conditionalStyle: (c) =>
      c
        .when(({ refs }) => refs.column("riskFlag").eq("REVIEW"), {
          fill: { color: { rgb: "FFEDD5" } },
          font: { color: { rgb: "9A3412" }, bold: true },
          border: { left: { style: "thick", color: { rgb: "EA580C" } } },
        })
        .when(({ refs }) => refs.column("riskFlag").eq("OK"), {
          fill: { color: { rgb: "DCFCE7" } },
          font: { color: { rgb: "166534" }, bold: true },
        }),
    headerStyle,
  })
  .build();

export const kitchenSinkGroupedFormulaSchema = createExcelSchema<
  {
    amount: number;
    customerName: string;
    region: "AMER" | "APAC" | "EMEA";
  },
  { regions: Array<"AMER" | "APAC" | "EMEA"> }
>({ mode: "excel-table" })
  .column("customerName", {
    header: "Customer",
    accessor: "customerName",
    minWidth: 18,
    totalsRow: { label: "AVERAGE" },
  })
  .column("amount", {
    header: "Amount",
    accessor: "amount",
    minWidth: 12,
    style: currencyStyle,
    totalsRow: { function: "average" },
  })
  .column("region", {
    header: "Region",
    accessor: "region",
    minWidth: 10,
  })
  .dynamic("regions", (builder, { ctx }) => {
    for (const region of ctx.regions) {
      builder.column(`region:${region}`, {
        header: `${region} Amount`,
        formula: ({ refs, fx }) =>
          fx.if(refs.column("region").eq(region), refs.column("amount"), 0),
        minWidth: 14,
        style: currencyStyle,
      });
    }
  })
  .column("regionalTotal", {
    header: "Regional Total",
    formula: ({ refs, fx }) => fx.sum(refs.dynamic("regions")),
    minWidth: 14,
    style: currencyStyle,
    totalsRow: { function: "sum" },
  })
  .column("regionalAverage", {
    header: "Regional Avg",
    formula: ({ refs, fx }) => fx.round(fx.average(refs.dynamic("regions")), 2),
    minWidth: 14,
    style: currencyStyle,
    totalsRow: { function: "average" },
  })
  .build();
