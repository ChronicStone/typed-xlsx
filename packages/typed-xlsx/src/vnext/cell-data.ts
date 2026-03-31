import type { PrimitiveCellValue } from "./schema/builder";

export interface FormulaCell {
  kind: "formula";
  formula: string;
  value?: PrimitiveCellValue;
}

export type CellData = PrimitiveCellValue | FormulaCell;

export function isFormulaCell(value: unknown): value is FormulaCell {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    "formula" in value &&
    (value as { kind?: unknown }).kind === "formula"
  );
}

export function getCellPrimitiveValue(value: CellData): PrimitiveCellValue {
  return isFormulaCell(value) ? (value.value ?? null) : value;
}
