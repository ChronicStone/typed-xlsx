import { createWorkbook, spreadsheetThemes } from "typed-xlsx";
import { createInvoices } from "./data";
import { invoiceSchema } from "./schema";

export function buildReceivablesAging() {
  const theme = spreadsheetThemes.rose;
  return (
    createWorkbook()
      .sheet("Open invoices", { freezePane: { rows: 2, columns: 1 } })
      .table("invoices", {
        title: "Accounts receivable as of 31 October 2026",
        schema: invoiceSchema,
        rows: createInvoices(),
        theme,
      })
      // One row per customer, one column per bucket: the aging grid collectors work from.
      .sheet("Aging by customer")
      .pivot("aging", ({ refs }) =>
        refs
          .sheet("Open invoices")
          .table("invoices")
          .pivot({
            rows: ["customer"],
            columns: ["bucket"],
            values: { amount: { aggregate: "sum", name: "Amount", format: "#,##0" } },
            filters: ["collector"],
            sort: "source",
            banded: true,
          }),
      )
      .pivot("buckets", ({ refs }) =>
        refs
          .sheet("Open invoices")
          .table("invoices")
          .pivot({
            rows: ["bucket"],
            values: { amount: { aggregate: "sum", name: "Amount", format: "#,##0" } },
            sort: "source",
            at: "J3",
          }),
      )
      .chart("bucketChart", ({ refs }) => ({
        title: "Receivables by age",
        at: "J12",
        marks: [refs.pivot("buckets").doughnut({ labels: { percent: true }, hole: 55 })],
        colors: ["#22C55E", "#FACC15", "#FB923C", "#F87171", "#991B1B"],
      }))
      .toUint8Array()
  );
}

export const buildArtifact = buildReceivablesAging;
