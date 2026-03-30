import { createSummaryBindings } from "../../planner/rows";
import { finalizeSummaryRuntime } from "../../summary/runtime";
import type { ResolvedColumn } from "../../planner/rows";
import type { PlannedSummaryCell } from "../types";
import type { CellStyle } from "../../styles/types";
import type { SummaryCellValue, SummaryDefinition } from "../../summary/runtime";

export function resolveSummaryStyle<T>(
  definition: SummaryDefinition<T>,
  value: SummaryCellValue,
): CellStyle | undefined {
  const baseStyle =
    typeof definition.style === "function" ? definition.style(value) : definition.style;
  const numberFormat =
    typeof definition.format === "function" ? definition.format(value) : definition.format;

  if (!baseStyle && !numberFormat) {
    return undefined;
  }

  return {
    ...(baseStyle ?? {}),
    ...(numberFormat ? { numFmt: numberFormat } : {}),
  };
}

export function groupSummaryRows(summaries: PlannedSummaryCell[]) {
  const grouped = new Map<number, PlannedSummaryCell[]>();

  for (const summary of summaries) {
    const row = grouped.get(summary.summaryIndex);
    if (row) {
      row.push(summary);
    } else {
      grouped.set(summary.summaryIndex, [summary]);
    }
  }

  return [...grouped.entries()].sort(([left], [right]) => left - right).map(([, row]) => row);
}

export function computeSummaries<T extends object>(
  columns: ResolvedColumn<T>[],
  rows: T[],
): PlannedSummaryCell[] {
  const summaryBindings = createSummaryBindings(columns);

  for (const [rowIndex, row] of rows.entries()) {
    for (const binding of summaryBindings) {
      binding.runtime.accumulator = binding.definition.step(
        binding.runtime.accumulator,
        row,
        rowIndex,
      );
    }
  }

  return summaryBindings.map((binding) => {
    const value = finalizeSummaryRuntime(binding.definition, binding.runtime);
    return {
      columnId: binding.columnId,
      summaryIndex: binding.summaryIndex,
      value,
      style: resolveSummaryStyle(binding.definition, value),
    };
  });
}
