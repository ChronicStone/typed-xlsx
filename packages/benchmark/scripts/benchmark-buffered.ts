import { parseArgs } from "node:util";
import { createExcelSchema, createWorkbook } from "typed-xlsx";

interface Row {
  id: number;
  customer: string;
  region: string;
  quantity: number;
  unitPrice: number;
}

const { values } = parseArgs({
  options: {
    rows: { type: "string", default: "50000" },
  },
});
const rowCount = Number(values.rows);
if (!Number.isSafeInteger(rowCount) || rowCount <= 0) {
  throw new Error("rows must be a positive safe integer");
}

// 7 columns: 5 from the row, 2 formula columns. The total column also carries a summary.
const schema = createExcelSchema<Row>()
  .column("id", { header: "ID", accessor: "id" })
  .column("customer", { header: "Customer", accessor: "customer" })
  .column("region", { header: "Region", accessor: "region" })
  .column("quantity", { header: "Quantity", accessor: "quantity" })
  .column("unitPrice", { header: "Unit price", accessor: "unitPrice", style: { numFmt: "0.00" } })
  .column("total", {
    header: "Total",
    formula: ({ refs }) => refs.column("quantity").mul(refs.column("unitPrice")),
    summary: (summary) => [summary.formula("sum")],
  })
  .column("discounted", {
    header: "Discounted",
    formula: ({ refs }) => refs.column("total").mul(0.9),
  })
  .build();

const rows: Row[] = Array.from({ length: rowCount }, (_, index) => ({
  id: index + 1,
  customer: `Customer ${index % 500}`,
  region: ["NA", "EMEA", "APAC", "LATAM"][index % 4]!,
  quantity: (index % 20) + 1,
  unitPrice: ((index * 7) % 1000) / 10,
}));

const startedAt = performance.now();
const bytes = createWorkbook().sheet("Orders").table("orders", { schema, rows }).toUint8Array();
const totalMs = performance.now() - startedAt;

console.log(
  JSON.stringify({
    runtime: process.version,
    rows: rowCount,
    columns: 7,
    totalMs: Math.round(totalMs),
    maxRssMb: Math.round(process.resourceUsage().maxRSS / 1024),
    outputBytes: bytes.byteLength,
  }),
);
