import type { ChartMark, ChartMarkType, ChartTable } from "./types";
import type { PivotChartSource, PivotSpec } from "../pivot/types";

function createMark(
  type: ChartMarkType,
  source: ChartMark["source"],
  options: Record<string, unknown> | undefined,
): ChartMark {
  return { kind: "chart-mark", type, source, options: { ...options } };
}

/** Mark and pivot factories for one table. Checks against the rendered columns happen when the workbook is written. */
export function createChartTable(sheet: string, table: string): ChartTable<any, any> {
  const factory = (type: ChartMarkType) => (options: Record<string, unknown>) =>
    createMark(type, { sheet, table }, options);

  return {
    bar: factory("bar"),
    line: factory("line"),
    area: factory("area"),
    scatter: factory("scatter"),
    pie: factory("pie"),
    doughnut: factory("doughnut"),
    pivot: (options: Record<string, unknown>): PivotSpec => ({
      kind: "pivot-spec",
      source: { sheet, table },
      options: { ...options },
    }),
  } as unknown as ChartTable<any, any>;
}

/** Marks of a placed pivot. They plot the whole pivot, so they take only styling options. */
export function createPivotChartSource(sheet: string, pivot: string): PivotChartSource {
  const factory = (type: ChartMarkType) => (options?: Record<string, unknown>) =>
    createMark(type, { sheet, table: pivot, pivot: true }, options);

  return {
    bar: factory("bar"),
    line: factory("line"),
    area: factory("area"),
    pie: factory("pie"),
    doughnut: factory("doughnut"),
  } as unknown as PivotChartSource;
}

export function isChartMark(value: unknown): value is ChartMark {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: unknown }).kind === "chart-mark"
  );
}
