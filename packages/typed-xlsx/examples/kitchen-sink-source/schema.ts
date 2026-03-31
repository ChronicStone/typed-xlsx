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
  createdAt: Date;
  customerName: string;
}>()
  .column("customerName", {
    header: "Customer",
    accessor: "customerName",
    minWidth: 18,
    headerStyle,
    summary: (summary) => [summary.label("TOTAL")],
  })
  .column("amount", {
    header: "Amount",
    accessor: "amount",
    minWidth: 12,
    style: currencyStyle,
    headerStyle,
    summary: (summary) => [
      summary.formula("sum", {
        style: currencyStyle,
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
    summary: (summary) => [summary.formula("max")],
  })
  .build();
