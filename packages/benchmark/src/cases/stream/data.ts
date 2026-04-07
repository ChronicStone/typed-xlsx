import { createExcelSchema, type CellStyle } from "typed-xlsx";

export interface StreamBenchmarkRow {
  orderId: string;
  customerId: string;
  region: "NA" | "EMEA" | "APAC" | "LATAM";
  status: "draft" | "paid" | "overdue" | "closed";
  createdAt: Date;
  subtotal: number;
  tax: number;
  total: number;
  notes: string;
  lineLabels: string[];
  lineAmounts: number[];
}

const REGIONS = ["NA", "EMEA", "APAC", "LATAM"] as const;
const STATUSES = ["draft", "paid", "overdue", "closed"] as const;

function headerStyle(): CellStyle {
  return {
    font: { bold: true },
    fill: { color: { rgb: "DCE6F1" } },
  };
}

export function createStreamBenchmarkSchema() {
  return createExcelSchema<StreamBenchmarkRow>()
    .column("orderId", {
      header: "Order ID",
      accessor: "orderId",
      width: 14,
      headerStyle: headerStyle(),
    })
    .column("customerId", {
      header: "Customer",
      accessor: "customerId",
      width: 12,
      headerStyle: headerStyle(),
    })
    .column("region", {
      header: "Region",
      accessor: "region",
      width: 8,
      headerStyle: headerStyle(),
    })
    .column("status", {
      header: "Status",
      accessor: "status",
      width: 8,
      headerStyle: headerStyle(),
    })
    .column("createdAt", {
      header: "Created",
      accessor: "createdAt",
      width: 24,
      headerStyle: headerStyle(),
    })
    .column("lineItem", {
      header: "Line Item",
      accessor: (row) => row.lineLabels,
      minWidth: 18,
      headerStyle: headerStyle(),
    })
    .column("lineAmount", {
      header: "Line Amount",
      accessor: (row) => row.lineAmounts,
      minWidth: 12,
      style: {
        numFmt: "$#,##0.00",
        alignment: { horizontal: "right" },
      },
      headerStyle: headerStyle(),
      summary: (summary) => [
        summary.cell({
          init: () => 0,
          step: (acc: number, row) => acc + row.total,
          finalize: (acc: number) => acc,
        }),
      ],
    })
    .column("subtotal", {
      header: "Subtotal",
      accessor: "subtotal",
      width: 12,
      style: {
        numFmt: "$#,##0.00",
        alignment: { horizontal: "right" },
      },
      headerStyle: headerStyle(),
    })
    .column("tax", {
      header: "Tax",
      accessor: "tax",
      width: 10,
      style: {
        numFmt: "$#,##0.00",
        alignment: { horizontal: "right" },
      },
      headerStyle: headerStyle(),
    })
    .column("total", {
      header: "Total",
      accessor: "total",
      width: 12,
      style: (row) => ({
        numFmt: "$#,##0.00",
        alignment: { horizontal: "right" },
        font: {
          color: {
            rgb: row.status === "overdue" ? "B42318" : "0A6B0D",
          },
        },
      }),
      headerStyle: headerStyle(),
      summary: (summary) => [
        summary.cell({
          init: () => 0,
          step: (acc: number, row) => acc + row.total,
          finalize: (acc: number) => acc,
        }),
      ],
    })
    .column("notes", {
      header: "Notes",
      accessor: "notes",
      minWidth: 26,
      maxWidth: 34,
      style: {
        alignment: { wrapText: true },
      },
      headerStyle: headerStyle(),
    })
    .build();
}

export function createStreamBenchmarkBatch(
  startRow: number,
  batchSize: number,
): StreamBenchmarkRow[] {
  return Array.from({ length: batchSize }, (_batchEntry, offset) => {
    const rowIndex = startRow + offset;
    const region = REGIONS[rowIndex % REGIONS.length]!;
    const status = STATUSES[rowIndex % STATUSES.length]!;
    const lineCount = rowIndex % 20 === 0 ? 3 : rowIndex % 7 === 0 ? 2 : 1;
    const subtotal = 150 + (rowIndex % 500) * 13.17;
    const tax = Number.parseFloat((subtotal * 0.2).toFixed(2));
    const total = Number.parseFloat((subtotal + tax).toFixed(2));

    return {
      orderId: `ORD-${rowIndex.toString().padStart(8, "0")}`,
      customerId: `CUST-${(rowIndex % 20_000).toString().padStart(6, "0")}`,
      region,
      status,
      createdAt: new Date(
        Date.UTC(2025, rowIndex % 12, (rowIndex % 28) + 1, rowIndex % 24, rowIndex % 60),
      ),
      subtotal,
      tax,
      total,
      notes:
        rowIndex % 37 === 0
          ? `Priority follow-up required\nEscalate with ${region} finance desk`
          : rowIndex % 11 === 0
            ? "Recurring enterprise renewal"
            : "Standard recurring order",
      lineLabels: Array.from(
        { length: lineCount },
        (_lineEntry, lineIndex) => `Service ${(rowIndex + lineIndex) % 12}`,
      ),
      lineAmounts: Array.from({ length: lineCount }, (_amountEntry, lineIndex) =>
        Number.parseFloat((subtotal / lineCount + lineIndex * 3.25).toFixed(2)),
      ),
    } satisfies StreamBenchmarkRow;
  });
}
