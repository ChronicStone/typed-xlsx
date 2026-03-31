import { createWorkbook } from "../../src";
import { createKitchenSinkOrders } from "./data";
import {
  kitchenSinkFormulaColumnSchema,
  kitchenSinkFormulaSummarySchema,
  kitchenSinkSchema,
} from "./schema";

export function buildKitchenSinkBufferedExample() {
  const workbook = createWorkbook();
  const orders = createKitchenSinkOrders();

  workbook
    .sheet("Kitchen Sink Grid", {
      tablesPerRow: 2,
      tableColumnGap: 2,
      tableRowGap: 2,
      freezePane: { rows: 1, columns: 4 },
    })
    .table({
      id: "all-orders",
      title: "Orders Overview",
      schema: kitchenSinkSchema,
      rows: orders,
    })
    .table({
      id: "enterprise-only",
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
    .table({
      id: "operations-view",
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
    .table({
      id: "rtl-orders",
      title: "RTL Snapshot",
      schema: kitchenSinkSchema,
      rows: orders.slice(0, 2),
    });

  workbook
    .sheet("Filtered Review", {
      freezePane: { rows: 1 },
    })
    .table({
      id: "filtered-orders",
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
    .table({
      id: "formula-summary-orders",
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
    .table({
      id: "formula-column-orders",
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

  return workbook.toUint8Array();
}
