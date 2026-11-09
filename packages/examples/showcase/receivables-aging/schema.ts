import { createExcelSchema } from "typed-xlsx";
import type { Bucket, Invoice } from "./data";

const money = { numFmt: "#,##0.00" };
const date = { numFmt: "dd mmm yyyy" };

const bucketVariants = {
  Current: { style: { fill: { color: { rgb: "DCFCE7" } }, font: { color: { rgb: "166534" } } } },
  "1-30": { style: { fill: { color: { rgb: "FEF9C3" } }, font: { color: { rgb: "854D0E" } } } },
  "31-60": { style: { fill: { color: { rgb: "FED7AA" } }, font: { color: { rgb: "9A3412" } } } },
  "61-90": { style: { fill: { color: { rgb: "FECACA" } }, font: { color: { rgb: "991B1B" } } } },
  "90+": {
    style: { fill: { color: { rgb: "991B1B" } }, font: { color: { rgb: "FFFFFF" }, bold: true } },
  },
} satisfies Record<Bucket, unknown>;

export const invoiceSchema = createExcelSchema<Invoice>()
  .column("invoice", {
    type: "hyperlink",
    header: "Invoice",
    accessor: "invoice",
    target: (row: Invoice) => `https://billing.example.com/invoices/${row.invoice}`,
    tooltip: "Open the invoice",
    width: 15,
  })
  .column("customer", { header: "Customer", accessor: "customer", minWidth: 26 })
  .column("collector", { header: "Collector", accessor: "collector", width: 13 })
  .column("issuedOn", { header: "Issued", accessor: "issuedOn", width: 13, style: date })
  .column("dueOn", { header: "Due", accessor: "dueOn", width: 13, style: date })
  .column("amount", {
    header: "Amount",
    accessor: "amount",
    width: 12,
    style: money,
    summary: (s) => [s.formula("sum")],
  })
  .column("paid", {
    header: "Paid",
    accessor: "paid",
    width: 11,
    style: money,
    summary: (s) => [s.formula("sum")],
  })
  .column("open", {
    header: "Open",
    formula: ({ refs }) => refs.column("amount").sub(refs.column("paid")),
    width: 12,
    style: { ...money, font: { bold: true } },
    summary: (s) => [s.formula("sum")],
  })
  .column("daysOverdue", {
    header: "Days late",
    accessor: "daysOverdue",
    width: 10,
    conditionalStyle: (c) =>
      c.when(({ refs }) => refs.column("daysOverdue").gt(90), {
        font: { color: { rgb: "B42318" }, bold: true },
      }),
  })
  .column("bucket", {
    type: "badge",
    header: "Bucket",
    accessor: "bucket",
    width: 10,
    variants: bucketVariants,
  })
  .column("lastNote", {
    header: "Last note",
    accessor: "lastNote",
    minWidth: 30,
    style: { font: { italic: true, color: { rgb: "475569" } } },
  })
  .build();
