import { createExcelSchema, createWorkbookStream } from "../../src";
import { createKitchenSinkOrders } from "./data";
import {
  kitchenSinkFormulaColumnSchema,
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

function repeatOrders(multiplier: number) {
  const orders = createKitchenSinkOrders();

  return Array.from({ length: multiplier }, (_, batchIndex) =>
    orders.map((order, rowIndex) => ({
      ...order,
      createdAt: new Date(order.createdAt.getTime() + batchIndex * 86_400_000),
      orderId: `${order.orderId}-${String(batchIndex * orders.length + rowIndex + 1).padStart(3, "0")}`,
    })),
  );
}

function toNativeExcelTableRows(orders: Array<ReturnType<typeof createKitchenSinkOrders>[number]>) {
  return orders.map((order) => ({
    orderId: order.orderId,
    customerName: order.customer.name,
    accountLabel: `${order.customer.tier.toUpperCase()} / ${order.region}`,
    email: order.customer.email,
    itemCount: order.items.length,
    lineTotal: order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    createdAt: order.createdAt,
  }));
}

export async function buildKitchenSinkStreamExample() {
  const workbook = createWorkbookStream({
    tempStorage: "memory",
  });
  const allOrderBatches = repeatOrders(8);
  const allOrders = allOrderBatches.flat();
  const enterpriseOrders = allOrders.filter((order) => order.customer.tier === "enterprise");

  const gridSheet = workbook.sheet("Kitchen Sink Grid", {
    tablesPerRow: 2,
    tableColumnGap: 2,
    tableRowGap: 2,
    freezePane: { rows: 1, columns: 4 },
  });

  const allOrdersTable = await gridSheet.table("all-orders", {
    schema: kitchenSinkSchema,
  });
  const enterpriseTable = await gridSheet.table("enterprise-only", {
    schema: kitchenSinkSchema,
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
  });
  const operationsTable = await gridSheet.table("operations-view", {
    schema: kitchenSinkSchema,
    select: {
      exclude: ["email", "tagList"],
    },
  });

  for (const rows of allOrderBatches) {
    await allOrdersTable.commit({ rows });
    await operationsTable.commit({ rows });
  }

  for (let index = 0; index < enterpriseOrders.length; index += 3) {
    await enterpriseTable.commit({ rows: enterpriseOrders.slice(index, index + 3) });
  }

  const rtlTable = await workbook
    .sheet("RTL Review", {
      rightToLeft: true,
      freezePane: { rows: 1, columns: 2 },
    })
    .table("rtl-orders", {
      schema: kitchenSinkSchema,
    });
  await rtlTable.commit({ rows: allOrders.slice(0, 6) });

  const filteredTable = await workbook
    .sheet("Filtered Review", {
      freezePane: { rows: 1 },
    })
    .table("filtered-orders", {
      autoFilter: true,
      schema: kitchenSinkSchema,
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
  await filteredTable.commit({ rows: allOrders.slice(0, 12) });

  const formulaSummaryTable = await workbook
    .sheet("Formula Summaries", {
      freezePane: { rows: 1 },
    })
    .table("formula-summary-orders", {
      schema: kitchenSinkFormulaSummarySchema,
    });
  for (const rows of allOrderBatches) {
    await formulaSummaryTable.commit({
      rows: rows.map((order) => ({
        amount: order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
        createdAt: order.createdAt,
        customerName: order.customer.name,
        fulfilledRatio:
          order.items.filter((item) => item.fulfilled).length / Math.max(order.items.length, 1),
        itemCount: order.items.length,
      })),
    });
  }

  const formulaColumnTable = await workbook
    .sheet("Formula Columns", {
      freezePane: { rows: 1 },
    })
    .table("formula-column-orders", {
      schema: kitchenSinkFormulaColumnSchema,
    });
  for (const rows of allOrderBatches) {
    await formulaColumnTable.commit({
      rows: rows.map((order) => ({
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
    });
  }

  const nativeTable = await workbook
    .sheet("Native Excel Table", {
      freezePane: { rows: 1 },
    })
    .table("native-orders", {
      autoFilter: true,
      name: "KitchenSinkOrders",
      schema: kitchenSinkNativeExcelTableSchema,
      style: "TableStyleMedium2",
      totalsRow: true,
    });
  for (const rows of allOrderBatches) {
    await nativeTable.commit({ rows: toNativeExcelTableRows(rows) });
  }

  const readable = workbook.toNodeReadable();
  const chunks: Buffer[] = [];

  for await (const chunk of readable) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}
