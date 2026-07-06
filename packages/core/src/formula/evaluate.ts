import type { PrimitiveCellValue } from "../schema/builder";
import type { FormulaExpr, FormulaFunctionExpr, FormulaScopeAggregateExpr } from "./expr";

export interface FormulaEvaluationContext {
  getColumnValue(columnId: string): PrimitiveCellValue;
  getColumnSeries(columnId: string): PrimitiveCellValue[];
  getScopeValues(scopeId: string): PrimitiveCellValue[];
}

type FormulaEvaluationValue = PrimitiveCellValue;

export function evaluateFormulaExpr(
  expr: FormulaExpr<string, string>,
  context: FormulaEvaluationContext,
): PrimitiveCellValue {
  if (expr.kind === "literal") {
    return expr.value;
  }

  if (expr.kind === "ref") {
    return context.getColumnValue(expr.columnId);
  }

  if (expr.kind === "series") {
    return undefined;
  }

  if (expr.kind === "collection-aggregate") {
    return evaluateAggregate(expr.aggregate, context.getColumnSeries(expr.target.columnId));
  }

  if (expr.kind === "scope-aggregate") {
    return evaluateScopeAggregate(expr, context);
  }

  if (expr.kind === "function") {
    return evaluateFunction(expr, context);
  }

  return evaluateBinary(expr.op, evaluateFormulaExpr(expr.left, context), () =>
    evaluateFormulaExpr(expr.right, context),
  );
}

function evaluateScopeAggregate(
  expr: FormulaScopeAggregateExpr<string>,
  context: FormulaEvaluationContext,
) {
  return evaluateAggregate(expr.aggregate, context.getScopeValues(expr.scopeId));
}

function evaluateFunction(
  expr: FormulaFunctionExpr<string, string>,
  context: FormulaEvaluationContext,
): PrimitiveCellValue {
  if (expr.name === "IF") {
    const [condition, whenTrue, whenFalse] = expr.args;
    if (!condition || !whenTrue || !whenFalse) {
      return undefined;
    }

    return toBoolean(evaluateFormulaExpr(condition, context))
      ? evaluateFormulaExpr(whenTrue, context)
      : evaluateFormulaExpr(whenFalse, context);
  }

  if (expr.name === "ROUND") {
    const [valueExpr, decimalsExpr] = expr.args;
    if (!valueExpr) {
      return undefined;
    }

    const value = toNumber(evaluateFormulaExpr(valueExpr, context));
    const decimals = decimalsExpr ? toNumber(evaluateFormulaExpr(decimalsExpr, context)) : 0;
    if (value === undefined || decimals === undefined) {
      return undefined;
    }

    const factor = 10 ** Math.trunc(decimals);
    return Math.round(value * factor) / factor;
  }

  if (expr.name === "ABS") {
    const [valueExpr] = expr.args;
    const value = valueExpr ? toNumber(evaluateFormulaExpr(valueExpr, context)) : undefined;
    return value === undefined ? undefined : Math.abs(value);
  }

  if (expr.name === "AND") {
    if (expr.args.length === 0) {
      return undefined;
    }

    return expr.args.every((arg) => toBoolean(evaluateFormulaExpr(arg, context)));
  }

  if (expr.name === "OR") {
    if (expr.args.length === 0) {
      return undefined;
    }

    return expr.args.some((arg) => toBoolean(evaluateFormulaExpr(arg, context)));
  }

  if (expr.name === "NOT") {
    const [valueExpr] = expr.args;
    return valueExpr ? !toBoolean(evaluateFormulaExpr(valueExpr, context)) : undefined;
  }

  return evaluateAggregate(
    expr.name,
    expr.args.map((arg) => evaluateFormulaExpr(arg, context)),
  );
}

function evaluateBinary(
  op: FormulaExpr<string, string> extends infer T
    ? T extends { kind: "binary"; op: infer TOp }
      ? TOp
      : never
    : never,
  left: FormulaEvaluationValue,
  resolveRight: () => FormulaEvaluationValue,
): PrimitiveCellValue {
  const right = resolveRight();

  if (op === "=") {
    return compareValues(left, right) === 0;
  }

  if (op === "<>") {
    return compareValues(left, right) !== 0;
  }

  if (op === ">") {
    return compareValues(left, right) > 0;
  }

  if (op === ">=") {
    return compareValues(left, right) >= 0;
  }

  if (op === "<") {
    return compareValues(left, right) < 0;
  }

  if (op === "<=") {
    return compareValues(left, right) <= 0;
  }

  const leftNumber = toNumber(left);
  const rightNumber = toNumber(right);
  if (leftNumber === undefined || rightNumber === undefined) {
    return undefined;
  }

  if (op === "+") {
    return leftNumber + rightNumber;
  }

  if (op === "-") {
    return leftNumber - rightNumber;
  }

  if (op === "*") {
    return leftNumber * rightNumber;
  }

  if (rightNumber === 0) {
    return undefined;
  }

  return leftNumber / rightNumber;
}

function evaluateAggregate(
  aggregate: FormulaScopeAggregateExpr<string>["aggregate"],
  values: PrimitiveCellValue[],
) {
  const numbers = values.flatMap((value) => {
    const number = toNumber(value);
    return number === undefined ? [] : [number];
  });

  if (aggregate === "COUNT") {
    return numbers.length;
  }

  if (aggregate === "SUM") {
    return numbers.reduce((sum, value) => sum + value, 0);
  }

  if (numbers.length === 0) {
    return undefined;
  }

  if (aggregate === "AVERAGE") {
    return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
  }

  if (aggregate === "MIN") {
    return Math.min(...numbers);
  }

  return Math.max(...numbers);
}

function compareValues(left: PrimitiveCellValue, right: PrimitiveCellValue) {
  const leftNumber = toNumber(left);
  const rightNumber = toNumber(right);

  if (leftNumber !== undefined && rightNumber !== undefined) {
    return leftNumber === rightNumber ? 0 : leftNumber > rightNumber ? 1 : -1;
  }

  const leftText = left === null || left === undefined ? "" : String(left).toLowerCase();
  const rightText = right === null || right === undefined ? "" : String(right).toLowerCase();
  return leftText.localeCompare(rightText);
}

function toBoolean(value: PrimitiveCellValue) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (value instanceof Date) {
    return true;
  }

  if (typeof value === "string") {
    return value.length > 0 && value.toLowerCase() !== "false";
  }

  return false;
}

function toNumber(value: PrimitiveCellValue) {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (value instanceof Date) {
    return (value.getTime() - Date.UTC(1899, 11, 30)) / 86_400_000;
  }

  if (value.trim() === "") {
    return 0;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
