import { createWorkbook } from "../../src";
import { createKitchenSinkOrders } from "./data";
import { kitchenSinkSchema } from "./schema";

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

  return workbook.toUint8Array();
}
