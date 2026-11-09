import { createWorkbook, spreadsheetThemes } from "typed-xlsx";
import { createOrders, summarizeMonths } from "./data";
import { monthlySchema, ordersSchema } from "./schema";

export function buildRevenueReview() {
  const orders = createOrders();
  const theme = spreadsheetThemes.slate;

  return (
    createWorkbook()
      // Twelve months against plan, with a combo chart: bars, a dashed plan line, margin on a second axis.
      .sheet("Overview", { freezePane: { rows: 2 } })
      .table("months", {
        title: "Revenue vs plan, last 12 months",
        schema: monthlySchema,
        rows: summarizeMonths(orders),
        theme,
      })
      .chart("trend", ({ refs }) => ({
        title: "Revenue vs plan",
        at: "H3",
        size: { width: 520, height: 330 },
        marks: [
          refs.table("months").bar({ x: "month", y: "revenue", name: "Revenue", color: "#1E3A8A" }),
          refs.table("months").line({
            x: "month",
            y: "target",
            name: "Plan",
            color: "#94A3B8",
            dashed: true,
            markers: false,
          }),
          refs.table("months").line({
            x: "month",
            y: "marginRate",
            name: "Margin %",
            color: "#F59E0B",
            axis: "y2",
          }),
        ],
        axes: { y: { min: 0, format: "#,##0" }, y2: { format: "0%", min: 0.5, max: 0.8 } },
      }))
      // Every order, the single source both pivots read from.
      .sheet("Orders", { freezePane: { rows: 1, columns: 1 } })
      .table("orders", { schema: ordersSchema, rows: orders, theme })
      // Quarters down the side, regions across, and a pivot chart Excel keeps in sync.
      .sheet("By quarter")
      .pivot("quarters", ({ refs }) =>
        refs
          .sheet("Orders")
          .table("orders")
          .pivot({
            rows: [{ field: "orderedAt", by: ["year", "quarter"] }],
            columns: ["region"],
            values: { revenue: "sum" },
            filters: ["channel"],
            banded: true,
          }),
      )
      .chart("quartersChart", ({ refs }) => ({
        title: "Revenue by quarter and region",
        at: "H3",
        marks: [refs.pivot("quarters").bar({ stack: true })],
        colors: ["#1E3A8A", "#2563EB", "#60A5FA", "#BFDBFE"],
      }))
      // Channel share: amounts and percentages from one pivot, plus a doughnut.
      .sheet("Channels")
      .pivot("mix", ({ refs }) =>
        refs
          .sheet("Orders")
          .table("orders")
          .pivot({
            rows: ["region"],
            columns: ["channel"],
            values: { revenue: { aggregate: "sum", show: "percentOfRow" } },
          }),
      )
      .pivot("share", ({ refs }) =>
        refs
          .sheet("Orders")
          .table("orders")
          .pivot({ rows: ["channel"], values: { revenue: "sum" }, at: "A12" }),
      )
      .chart("shareChart", ({ refs }) => ({
        title: "Revenue by channel",
        at: "G3",
        marks: [refs.pivot("share").doughnut({ labels: { percent: true } })],
        colors: ["#1E3A8A", "#60A5FA", "#F59E0B"],
      }))
      .toUint8Array()
  );
}

export const buildArtifact = buildRevenueReview;
