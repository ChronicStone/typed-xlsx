import type { PrimitiveCellValue } from "./schema/builder";

// Private brand: only cells built by `formulaCell` are written as formulas. A row value that merely
// looks like `{ kind: "formula", formula: "..." }` must never become a live formula.
const FORMULA_CELL = Symbol("typed-xlsx.formula-cell");

export interface FormulaCell {
  kind: "formula";
  formula: string;
  value?: PrimitiveCellValue;
  readonly [FORMULA_CELL]: true;
}

export type CellData = PrimitiveCellValue | FormulaCell;

// The brand sits on the prototype, so it is not an own property of each cell.
class BrandedFormulaCell implements FormulaCell {
  readonly kind = "formula";
  readonly formula: string;
  readonly value?: PrimitiveCellValue;

  get [FORMULA_CELL](): true {
    return true;
  }

  constructor(formula: string, value?: PrimitiveCellValue) {
    this.formula = formula;
    if (value !== undefined) this.value = value;
  }
}

export function formulaCell(formula: string, value?: PrimitiveCellValue): FormulaCell {
  return new BrandedFormulaCell(formula, value);
}

export function isFormulaCell(value: unknown): value is FormulaCell {
  return typeof value === "object" && value !== null && FORMULA_CELL in value;
}

export function getCellPrimitiveValue(value: CellData): PrimitiveCellValue {
  return isFormulaCell(value) ? (value.value ?? null) : value;
}
