import { createExcelSchema, createWorkbook } from "../../src";
import { createKitchenSinkOrders } from "./data";
import {
  kitchenSinkFormulaColumnSchema,
  kitchenSinkGroupedFormulaSchema,
  kitchenSinkFormulaSummarySchema,
  kitchenSinkSchema,
} from "./schema";

const kitchenSinkNativeExcelTableSchema = createExcelSchema<{
  orderId: string;
  customerName: string;
  accountLabel: string;
  email: string;
  itemCount: number;
  lineTotal: number;
  createdAt: Date;
}>({ mode: "excel-table" })
  .column("orderId", {
    header: "Order",
    accessor: "orderId",
    width: 12,
    totalsRow: { label: "TOTAL" },
  })
  .column("customerName", { header: "Customer", accessor: "customerName", minWidth: 18 })
  .column("accountLabel", { header: "Account", accessor: "accountLabel", minWidth: 18 })
  .column("email", { header: "Email", accessor: "email", minWidth: 20 })
  .column("itemCount", {
    header: "Items",
    accessor: "itemCount",
    width: 8,
    style: { alignment: { horizontal: "right" } },
  })
  .column("lineTotal", {
    header: "Line Total",
    accessor: "lineTotal",
    minWidth: 12,
    style: { numFmt: '"$"#,##0.00', alignment: { horizontal: "right" } },
    totalsRow: { function: "sum" },
  })
  .column("createdAt", {
    header: "Created",
    accessor: "createdAt",
    width: 22,
    style: { numFmt: "yyyy-mm-dd hh:mm" },
    totalsRow: { function: "max" },
  })
  .build();

export function buildKitchenSinkBufferedExample() {
  const workbook = createWorkbook();
  const orders = createKitchenSinkOrders();
  const nativeExcelTableRows = orders.slice(0, 5).map((order) => ({
    orderId: order.orderId,
    customerName: order.customer.name,
    accountLabel: `${order.customer.tier.toUpperCase()} / ${order.region}`,
    email: order.customer.email,
    itemCount: order.items.length,
    lineTotal: order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    createdAt: order.createdAt,
  }));

  workbook
    .sheet("Kitchen Sink Grid", {
      tablesPerRow: 2,
      tableColumnGap: 2,
      tableRowGap: 2,
      freezePane: { rows: 1, columns: 4 },
    })
    .table("all-orders", {
      title: "Orders Overview",
      schema: kitchenSinkSchema,
      rows: orders,
    })
    .table("enterprise-only", {
      title: "Enterprise Accounts",
      schema: kitchenSinkSchema,
      rows: orders.filter((order) => order.customer.tier === "enterprise"),
      select: {
        include: [
          "orderId",
          "customerName",
          "accountLabel",
          "sku",
          "description",
          "quantity",
          "lineTotal",
          "notes",
        ],
      },
    })
    .table("operations-view", {
      title: "Operations View",
      schema: kitchenSinkSchema,
      rows: orders,
      select: {
        exclude: ["email", "tagList"],
      },
    });

  workbook
    .sheet("RTL Review", {
      rightToLeft: true,
      freezePane: { rows: 1, columns: 2 },
    })
    .table("rtl-orders", {
      title: "RTL Snapshot",
      schema: kitchenSinkSchema,
      rows: orders.slice(0, 2),
    });

  workbook
    .sheet("Filtered Review", {
      freezePane: { rows: 1 },
    })
    .table("filtered-orders", {
      title: "Filtered Snapshot",
      autoFilter: true,
      schema: kitchenSinkSchema,
      rows: orders.slice(0, 5),
      select: {
        include: [
          "orderId",
          "customerName",
          "accountLabel",
          "email",
          "notes",
          "tagList",
          "createdAt",
        ],
      },
    });

  workbook
    .sheet("Formula Summaries", {
      freezePane: { rows: 1 },
    })
    .table("formula-summary-orders", {
      title: "Formula Summary Snapshot",
      rows: orders.slice(0, 5).map((order) => ({
        amount: order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
        createdAt: order.createdAt,
        customerName: order.customer.name,
        fulfilledRatio:
          order.items.filter((item) => item.fulfilled).length / Math.max(order.items.length, 1),
        itemCount: order.items.length,
      })),
      schema: kitchenSinkFormulaSummarySchema,
    });

  workbook
    .sheet("Formula Columns", {
      freezePane: { rows: 1 },
    })
    .table("formula-column-orders", {
      title: "Formula Column Snapshot",
      rows: orders.slice(0, 5).map((order) => ({
        activatedSeats: order.items.reduce(
          (sum, item) => sum + (item.fulfilled ? item.quantity : Math.max(0, item.quantity - 1)),
          0,
        ),
        customerName: order.customer.name,
        discountRate:
          order.customer.tier === "enterprise"
            ? 0.18
            : order.customer.tier === "growth"
              ? 0.1
              : 0.03,
        qty: order.items.reduce((sum, item) => sum + item.quantity, 0),
        unitPrice:
          order.items.reduce((sum, item) => sum + item.unitPrice, 0) /
          Math.max(order.items.length, 1),
        segment: order.customer.tier,
      })),
      schema: kitchenSinkFormulaColumnSchema,
    });

  workbook
    .sheet("Native Excel Table", {
      freezePane: { rows: 1 },
    })
    .table("native-orders", {
      autoFilter: true,
      name: "KitchenSinkOrders",
      rows: nativeExcelTableRows,
      schema: kitchenSinkNativeExcelTableSchema,
      style: "TableStyleMedium2",
      totalsRow: true,
    });

  workbook
    .sheet("Grouped Formula Scope", {
      freezePane: { rows: 1 },
    })
    .table("grouped-formula-orders", {
      autoFilter: true,
      context: { regions: ["AMER", "APAC", "EMEA"] },
      name: "KitchenSinkRegionalScope",
      rows: orders.slice(0, 5).map((order) => ({
        amount: order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
        customerName: order.customer.name,
        region: order.region,
      })),
      schema: kitchenSinkGroupedFormulaSchema,
      style: "TableStyleMedium9",
      totalsRow: true,
    });

  return workbook.toUint8Array();
}
