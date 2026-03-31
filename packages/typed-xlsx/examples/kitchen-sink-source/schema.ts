import { createExcelSchema, type CellStyle } from "../../src";
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
    style: (row, _rowIndex, subRowIndex) => {
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
    style: (row, _rowIndex, subRowIndex) => ({
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
        style: currencyStyle,
      }),
      summary.formula(({ column, fx }) => fx.round(column.cells().average(), 2), {
        style: currencyStyle,
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
        },
      }),
      summary.formula(({ column, fx }) => fx.max(column.cells().max(), 0), {
        style: {
          numFmt: "0.0%",
          alignment: { horizontal: "right" },
        },
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
    formula: ({ row, fx }) => fx.round(row.ref("qty").mul(row.ref("unitPrice")), 2),
    minWidth: 12,
    style: currencyStyle,
    headerStyle,
    summary: (summary) => [summary.formula(({ column, fx }) => fx.round(column.cells().sum(), 2))],
  })
  .column("lineTotal", {
    header: "Net",
    formula: ({ row, fx }) =>
      fx.round(row.ref("grossTotal").mul(row.literal(1).sub(row.ref("discountRate"))), 2),
    minWidth: 12,
    style: currencyStyle,
    headerStyle,
    summary: (summary) => [summary.formula(({ column, fx }) => fx.round(column.cells().sum(), 2))],
  })
  .column("seatUtilization", {
    header: "Utilization",
    formula: ({ row, fx }) =>
      fx.if(row.ref("qty").gt(0), fx.round(row.ref("activatedSeats").div(row.ref("qty")), 4), 0),
    width: 12,
    style: {
      numFmt: "0.0%",
      alignment: { horizontal: "right" },
    },
    headerStyle,
  })
  .column("segment", {
    header: "Segment",
    formula: ({ row, fx }) =>
      fx.if(
        row.ref("lineTotal").gte(5000).or(row.ref("seatUtilization").gte(0.85)),
        "HIGH",
        fx.if(row.ref("discountRate").gte(0.15), "WATCH", "STANDARD"),
      ),
    minWidth: 12,
    headerStyle,
  })
  .column("riskFlag", {
    header: "Risk",
    formula: ({ row, fx }) =>
      fx.if(row.ref("segment").eq("WATCH").or(row.ref("seatUtilization").lt(0.5)), "REVIEW", "OK"),
    minWidth: 10,
    headerStyle,
  })
  .build();
