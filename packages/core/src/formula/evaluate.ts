import type { PrimitiveCellValue } from "../schema/builder";
import type { FormulaExpr, FormulaFunctionExpr, FormulaScopeAggregateExpr } from "./expr";

export interface FormulaEvaluationContext {
  getColumnValue(columnId: string): PrimitiveCellValue;
  getColumnSeries(columnId: string): PrimitiveCellValue[];
  getScopeValues(scopeId: string): PrimitiveCellValue[];
}

/**
 * Marks a result Excel would compute differently or as an error (`#DIV/0!`,
 * `#VALUE!`), or one this evaluator cannot compute with certainty. It
 * propagates through every operation, and the public entry point turns it into
 * "no cached value" so Excel computes the cell when the file is opened.
 */
const UNKNOWN = Symbol("unknown");
type Unknown = typeof UNKNOWN;
type Evaluated = PrimitiveCellValue | Unknown;

type AggregateName = FormulaScopeAggregateExpr<string>["aggregate"];

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const DECIMAL_TEXT = /^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?\s*$/;

/**
 * Computes the value Excel would show for a formula, or `undefined` when it is
 * not known to match Excel (errors, unsupported coercions).
 */
export function evaluateFormulaExpr(
  expr: FormulaExpr<string, string>,
  context: FormulaEvaluationContext,
): PrimitiveCellValue {
  const result = evaluate(expr, context);
  return result === UNKNOWN ? undefined : result;
}

function evaluate(expr: FormulaExpr<string, string>, context: FormulaEvaluationContext): Evaluated {
  if (expr.kind === "literal") {
    return expr.value;
  }

  if (expr.kind === "ref") {
    return context.getColumnValue(expr.columnId);
  }

  if (expr.kind === "series") {
    return UNKNOWN;
  }

  if (expr.kind === "collection-aggregate") {
    return aggregateRange(expr.aggregate, context.getColumnSeries(expr.target.columnId));
  }

  if (expr.kind === "scope-aggregate") {
    return aggregateRange(expr.aggregate, context.getScopeValues(expr.scopeId));
  }

  if (expr.kind === "function") {
    return evaluateFunction(expr, context);
  }

  return evaluateBinary(expr.op, evaluate(expr.left, context), evaluate(expr.right, context));
}

function evaluateFunction(
  expr: FormulaFunctionExpr<string, string>,
  context: FormulaEvaluationContext,
): Evaluated {
  if (expr.name === "IF") {
    const [condition, whenTrue, whenFalse] = expr.args;
    if (!condition || !whenTrue || !whenFalse) {
      return UNKNOWN;
    }

    const test = toCondition(evaluate(condition, context));
    if (test === UNKNOWN) {
      return UNKNOWN;
    }

    return evaluate(test ? whenTrue : whenFalse, context);
  }

  if (expr.name === "ROUND") {
    const [valueExpr, decimalsExpr] = expr.args;
    if (!valueExpr) {
      return UNKNOWN;
    }

    const value = toNumber(evaluate(valueExpr, context));
    const decimals = decimalsExpr ? toNumber(evaluate(decimalsExpr, context)) : 0;
    if (value === UNKNOWN || decimals === UNKNOWN) {
      return UNKNOWN;
    }

    return roundHalfAwayFromZero(value, decimals);
  }

  if (expr.name === "ABS") {
    const [valueExpr] = expr.args;
    const value = valueExpr ? toNumber(evaluate(valueExpr, context)) : UNKNOWN;
    return value === UNKNOWN ? UNKNOWN : Math.abs(value);
  }

  if (expr.name === "AND" || expr.name === "OR") {
    if (expr.args.length === 0) {
      return UNKNOWN;
    }

    const conditions = expr.args.map((arg) => toCondition(evaluate(arg, context)));
    if (conditions.includes(UNKNOWN)) {
      return UNKNOWN;
    }

    return expr.name === "AND" ? conditions.every(Boolean) : conditions.some(Boolean);
  }

  if (expr.name === "NOT") {
    const [valueExpr] = expr.args;
    const condition = valueExpr ? toCondition(evaluate(valueExpr, context)) : UNKNOWN;
    return condition === UNKNOWN ? UNKNOWN : !condition;
  }

  return aggregateArguments(expr.name, expr.args, context);
}

function evaluateBinary(
  op: Extract<FormulaExpr<string, string>, { kind: "binary" }>["op"],
  left: Evaluated,
  right: Evaluated,
): Evaluated {
  if (left === UNKNOWN || right === UNKNOWN) {
    return UNKNOWN;
  }

  if (op === "=" || op === "<>" || op === ">" || op === ">=" || op === "<" || op === "<=") {
    const order = compareValues(left, right);
    if (order === UNKNOWN) {
      return UNKNOWN;
    }

    if (op === "=") return order === 0;
    if (op === "<>") return order !== 0;
    if (op === ">") return order > 0;
    if (op === ">=") return order >= 0;
    if (op === "<") return order < 0;
    return order <= 0;
  }

  const leftNumber = toNumber(left);
  const rightNumber = toNumber(right);
  if (leftNumber === UNKNOWN || rightNumber === UNKNOWN) {
    return UNKNOWN;
  }

  if (op === "/" && rightNumber === 0) {
    return UNKNOWN;
  }

  const result =
    op === "+"
      ? leftNumber + rightNumber
      : op === "-"
        ? leftNumber - rightNumber
        : op === "*"
          ? leftNumber * rightNumber
          : leftNumber / rightNumber;

  return Number.isFinite(result) ? result : UNKNOWN;
}

/**
 * Excel's ROUND: half away from zero, applied to the decimal value Excel shows
 * (15 significant digits), so ROUND(1.005, 2) is 1.01 and ROUND(-2.5, 0) is -3.
 */
function roundHalfAwayFromZero(value: number, decimals: number): Evaluated {
  const digits = Math.trunc(decimals);
  const magnitude = String(Number(Math.abs(value).toPrecision(15)));
  if (magnitude.includes("e")) {
    return UNKNOWN;
  }

  const shifted = Math.round(Number(`${magnitude}e${digits}`));
  const text = String(shifted);
  if (!Number.isFinite(shifted) || text.includes("e")) {
    return UNKNOWN;
  }

  const rounded = Number(`${text}e${-digits}`);
  if (!Number.isFinite(rounded)) {
    return UNKNOWN;
  }

  return value < 0 && rounded !== 0 ? -rounded : rounded;
}

/**
 * Aggregate over a cell range or column group. Excel ignores text, booleans and
 * blanks there; only numbers (and dates) count.
 */
function aggregateRange(aggregate: AggregateName, values: PrimitiveCellValue[]): Evaluated {
  const numbers: number[] = [];
  for (const value of values) {
    const number = rangeNumber(value);
    if (number !== undefined) {
      numbers.push(number);
    }
  }

  return reduceNumbers(aggregate, numbers);
}

/**
 * Aggregate over function arguments (`fx.sum(a, b)`). A column reference acts
 * like a range cell; any other argument is a typed-in value, so numeric text and
 * booleans are converted and other text is an error in Excel.
 */
function aggregateArguments(
  aggregate: AggregateName,
  args: FormulaExpr<string, string>[],
  context: FormulaEvaluationContext,
): Evaluated {
  const numbers: number[] = [];
  for (const arg of args) {
    const value = evaluate(arg, context);
    if (value === UNKNOWN) {
      return UNKNOWN;
    }

    if (value === null || value === undefined) {
      continue;
    }

    if (arg.kind === "ref") {
      const number = rangeNumber(value);
      if (number !== undefined) {
        numbers.push(number);
      }
      continue;
    }

    const number = toNumber(value);
    if (number === UNKNOWN) {
      if (aggregate === "COUNT" && typeof value === "string") {
        continue;
      }
      return UNKNOWN;
    }
    numbers.push(number);
  }

  return reduceNumbers(aggregate, numbers);
}

function reduceNumbers(aggregate: AggregateName, numbers: number[]): Evaluated {
  if (aggregate === "COUNT") {
    return numbers.length;
  }

  if (aggregate === "AVERAGE" && numbers.length === 0) {
    return UNKNOWN;
  }

  let result = 0;
  if (aggregate === "SUM" || aggregate === "AVERAGE") {
    for (const number of numbers) {
      result += number;
    }
    result = aggregate === "AVERAGE" ? result / numbers.length : result;
  } else if (numbers.length > 0) {
    result = aggregate === "MIN" ? Math.min(...numbers) : Math.max(...numbers);
  }

  return Number.isFinite(result) ? result : UNKNOWN;
}

function rangeNumber(value: PrimitiveCellValue): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  return value instanceof Date ? dateSerial(value) : undefined;
}

function dateSerial(value: Date) {
  return (value.getTime() - EXCEL_EPOCH_UTC) / 86_400_000;
}

/**
 * Excel's comparison order: numbers < text < booleans. Types are never
 * converted into each other (so "12" = 12 is FALSE); a blank takes the type of
 * the other side (0, "" or FALSE). Text compares case-insensitively.
 */
function compareValues(left: PrimitiveCellValue, right: PrimitiveCellValue): number | Unknown {
  const leftBlank = left === null || left === undefined;
  const rightBlank = right === null || right === undefined;
  if (leftBlank && rightBlank) {
    return 0;
  }

  const leftType = comparisonType(left);
  const rightType = comparisonType(right);
  const type = leftBlank ? rightType : leftType;
  if (leftType !== rightType && !leftBlank && !rightBlank) {
    return leftType < rightType ? -1 : 1;
  }

  const a = leftBlank ? blankFor(type) : normalize(left);
  const b = rightBlank ? blankFor(type) : normalize(right);

  if (typeof a === "number" && typeof b === "number") {
    if (a === b) {
      return 0;
    }

    // Excel compares at 15 significant digits; near-equal doubles are not safe to call.
    return a.toPrecision(15) === b.toPrecision(15) ? UNKNOWN : a < b ? -1 : 1;
  }

  if (typeof a === "string" && typeof b === "string") {
    const aText = a.toLowerCase();
    const bText = b.toLowerCase();
    if (aText === bText) {
      return 0;
    }

    // Excel orders text by locale collation; only plain letters, digits and spaces are certain.
    return PLAIN_TEXT.test(aText) && PLAIN_TEXT.test(bText) ? (aText < bText ? -1 : 1) : UNKNOWN;
  }

  if (typeof a === "boolean" && typeof b === "boolean") {
    return a === b ? 0 : a ? 1 : -1;
  }

  return UNKNOWN;
}

const PLAIN_TEXT = /^[a-z0-9 ]*$/;

function comparisonType(value: PrimitiveCellValue) {
  if (typeof value === "string") return 1;
  if (typeof value === "boolean") return 2;
  return 0;
}

function blankFor(type: number) {
  return type === 1 ? "" : type === 2 ? false : 0;
}

function normalize(value: PrimitiveCellValue) {
  return value instanceof Date ? dateSerial(value) : value;
}

/** Condition of IF/AND/OR/NOT: booleans and numbers only; text is not converted. */
function toCondition(value: Evaluated): boolean | Unknown {
  if (value === UNKNOWN) {
    return UNKNOWN;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (value === null || value === undefined) {
    return false;
  }

  const number = toNumber(value);
  if (typeof value === "string" || number === UNKNOWN) {
    return UNKNOWN;
  }

  return number !== 0;
}

/** Arithmetic conversion: blank is 0, booleans 1/0, numeric text its number, other text an error. */
function toNumber(value: Evaluated): number | Unknown {
  if (value === UNKNOWN) {
    return UNKNOWN;
  }

  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : UNKNOWN;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (value instanceof Date) {
    return dateSerial(value);
  }

  if (!DECIMAL_TEXT.test(value)) {
    return UNKNOWN;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : UNKNOWN;
}
