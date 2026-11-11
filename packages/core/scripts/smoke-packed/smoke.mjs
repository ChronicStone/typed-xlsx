// Runs against the installed tarball with plain JavaScript (no build step).
import { createExcelSchema, createWorkbook, createWorkbookStream } from "typed-xlsx";

const schema = createExcelSchema()
  .column("id", { header: "Order", accessor: "id" })
  .column("qty", { header: "Qty", accessor: "qty" })
  .column("price", { header: "Price", accessor: "price" })
  .column("total", {
    header: "Total",
    formula: ({ refs }) => refs.column("qty").mul(refs.column("price")),
    summary: (s) => [s.formula("sum")],
  })
  .build();

const rows = Array.from({ length: 500 }, (_, index) => ({
  id: `A-${index}`,
  qty: index + 1,
  price: 9.5,
}));

function assertZip(label, bytes) {
  const signature = String.fromCharCode(bytes[0], bytes[1]);
  if (signature !== "PK") throw new Error(`${label}: output does not start with the ZIP signature`);
  if (bytes.length <= 1024) throw new Error(`${label}: output is only ${bytes.length} bytes`);
  console.log(`ok  ${label}: ${bytes.length} bytes`);
}

const buffered = createWorkbook();
buffered.sheet("S").table("orders", { rows, schema });
assertZip("createWorkbook().toUint8Array()", buffered.toUint8Array());

const streamed = createWorkbookStream();
const table = await streamed.sheet("S").table("orders", { schema });
await table.commit({ rows });
const reader = streamed.toReadableStream().getReader();
const chunks = [];
for (;;) {
  const { done, value } = await reader.read();
  if (done) break;
  chunks.push(value);
}
const collected = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
let offset = 0;
for (const chunk of chunks) {
  collected.set(chunk, offset);
  offset += chunk.length;
}
assertZip("createWorkbookStream().toReadableStream()", collected);
