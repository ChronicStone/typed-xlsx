import type { FormulaCell } from "../cell-data";
import type { CellStyle } from "../styles/types";

export type SummaryCellValue = string | number | boolean | Date | null | undefined;
export type SummaryFormulaFunction = "sum" | "average" | "count" | "min" | "max";

export interface SummaryFormulaDefinition {
  kind: "formula";
  fn: SummaryFormulaFunction;
}

export interface SummaryFormulaContext {
  startRow: number;
  endRow: number;
  column: number;
}

export type SummaryResolvedValue = SummaryCellValue | FormulaCell;

export interface SummaryDefinition<T, TAcc = unknown> {
  label?: string;
  init: () => TAcc;
  step: (accumulator: TAcc, row: T, rowIndex: number) => TAcc;
  finalize: (accumulator: TAcc) => SummaryCellValue;
  formula?: SummaryFormulaDefinition;
  format?: string | ((value: SummaryResolvedValue) => string | undefined);
  style?: CellStyle | ((value: SummaryResolvedValue) => CellStyle | undefined);
}

export interface SummaryRuntime<TAcc = unknown> {
  accumulator: TAcc;
}

export function createSummaryRuntime<T, TAcc>(
  definition: SummaryDefinition<T, TAcc>,
): SummaryRuntime<TAcc> {
  return {
    accumulator: definition.init(),
  };
}

export function stepSummaryRuntime<T, TAcc>(
  definition: SummaryDefinition<T, TAcc>,
  runtime: SummaryRuntime<TAcc>,
  row: T,
  rowIndex: number,
) {
  runtime.accumulator = definition.step(runtime.accumulator, row, rowIndex);
}

export function finalizeSummaryRuntime<T, TAcc>(
  definition: SummaryDefinition<T, TAcc>,
  runtime: SummaryRuntime<TAcc>,
): SummaryCellValue {
  return definition.finalize(runtime.accumulator);
}
