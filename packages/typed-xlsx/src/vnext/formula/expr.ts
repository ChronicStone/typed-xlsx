export interface FormulaLiteralExpr {
  kind: "literal";
  value: string | number | boolean;
}

export interface FormulaRefExpr<TColumnId extends string = string> {
  kind: "ref";
  columnId: TColumnId;
}

export interface FormulaBinaryExpr<TColumnId extends string = string> {
  kind: "binary";
  op: "+" | "-" | "*" | "/" | "=" | "<>" | ">" | ">=" | "<" | "<=";
  left: FormulaExpr<TColumnId>;
  right: FormulaExpr<TColumnId>;
}

export interface FormulaFunctionExpr<TColumnId extends string = string> {
  kind: "function";
  name: "ABS" | "AND" | "AVERAGE" | "COUNT" | "IF" | "MAX" | "MIN" | "NOT" | "OR" | "ROUND" | "SUM";
  args: FormulaExpr<TColumnId>[];
}

export type FormulaExpr<TColumnId extends string = string> =
  | FormulaLiteralExpr
  | FormulaRefExpr<TColumnId>
  | FormulaBinaryExpr<TColumnId>
  | FormulaFunctionExpr<TColumnId>;

export interface FormulaOperand<TColumnId extends string = string> {
  add(right: FormulaValue<TColumnId>): FormulaOperand<TColumnId>;
  sub(right: FormulaValue<TColumnId>): FormulaOperand<TColumnId>;
  mul(right: FormulaValue<TColumnId>): FormulaOperand<TColumnId>;
  div(right: FormulaValue<TColumnId>): FormulaOperand<TColumnId>;
  abs(): FormulaOperand<TColumnId>;
  round(decimals?: number): FormulaOperand<TColumnId>;
  eq(right: FormulaValue<TColumnId>): FormulaCondition<TColumnId>;
  neq(right: FormulaValue<TColumnId>): FormulaCondition<TColumnId>;
  gt(right: FormulaValue<TColumnId>): FormulaCondition<TColumnId>;
  gte(right: FormulaValue<TColumnId>): FormulaCondition<TColumnId>;
  lt(right: FormulaValue<TColumnId>): FormulaCondition<TColumnId>;
  lte(right: FormulaValue<TColumnId>): FormulaCondition<TColumnId>;
  toExpr(): FormulaExpr<TColumnId>;
}

export interface FormulaCondition<TColumnId extends string = string> {
  and(right: FormulaConditionValue<TColumnId>): FormulaCondition<TColumnId>;
  or(right: FormulaConditionValue<TColumnId>): FormulaCondition<TColumnId>;
  not(): FormulaCondition<TColumnId>;
  toExpr(): FormulaExpr<TColumnId>;
}

export interface FormulaFunctions<TColumnId extends string = string> {
  abs(value: FormulaValue<TColumnId>): FormulaOperand<TColumnId>;
  round(value: FormulaValue<TColumnId>, decimals?: number): FormulaOperand<TColumnId>;
  min(...values: FormulaValue<TColumnId>[]): FormulaOperand<TColumnId>;
  max(...values: FormulaValue<TColumnId>[]): FormulaOperand<TColumnId>;
  if(
    condition: FormulaConditionValue<TColumnId>,
    whenTrue: FormulaValue<TColumnId>,
    whenFalse: FormulaValue<TColumnId>,
  ): FormulaOperand<TColumnId>;
  and(...conditions: FormulaConditionValue<TColumnId>[]): FormulaCondition<TColumnId>;
  or(...conditions: FormulaConditionValue<TColumnId>[]): FormulaCondition<TColumnId>;
  not(condition: FormulaConditionValue<TColumnId>): FormulaCondition<TColumnId>;
}

export interface FormulaRowContext<TColumnId extends string> {
  ref(columnId: TColumnId): FormulaOperand<TColumnId>;
  literal(value: string | number | boolean): FormulaOperand<TColumnId>;
  if(
    condition: FormulaConditionValue<TColumnId>,
    whenTrue: FormulaValue<TColumnId>,
    whenFalse: FormulaValue<TColumnId>,
  ): FormulaOperand<TColumnId>;
}

export type FormulaValue<TColumnId extends string = string> =
  | string
  | number
  | boolean
  | FormulaExpr<TColumnId>
  | FormulaOperand<TColumnId>;

export type FormulaConditionValue<TColumnId extends string = string> =
  | FormulaExpr<TColumnId>
  | FormulaCondition<TColumnId>;

function wrapExpr<TColumnId extends string>(
  expr: FormulaExpr<TColumnId>,
): FormulaOperand<TColumnId> {
  return {
    add(right) {
      return wrapExpr(binary(expr, "+", toExpr(right)));
    },
    sub(right) {
      return wrapExpr(binary(expr, "-", toExpr(right)));
    },
    mul(right) {
      return wrapExpr(binary(expr, "*", toExpr(right)));
    },
    div(right) {
      return wrapExpr(binary(expr, "/", toExpr(right)));
    },
    abs() {
      return wrapExpr(func("ABS", [expr]));
    },
    round(decimals = 0) {
      return wrapExpr(func("ROUND", [expr, literal(decimals)]));
    },
    eq(right) {
      return wrapCondition(binary(expr, "=", toExpr(right)));
    },
    neq(right) {
      return wrapCondition(binary(expr, "<>", toExpr(right)));
    },
    gt(right) {
      return wrapCondition(binary(expr, ">", toExpr(right)));
    },
    gte(right) {
      return wrapCondition(binary(expr, ">=", toExpr(right)));
    },
    lt(right) {
      return wrapCondition(binary(expr, "<", toExpr(right)));
    },
    lte(right) {
      return wrapCondition(binary(expr, "<=", toExpr(right)));
    },
    toExpr() {
      return expr;
    },
  };
}

function wrapCondition<TColumnId extends string>(
  expr: FormulaExpr<TColumnId>,
): FormulaCondition<TColumnId> {
  return {
    and(right) {
      return wrapCondition(func("AND", [expr, toConditionExpr(right)]));
    },
    or(right) {
      return wrapCondition(func("OR", [expr, toConditionExpr(right)]));
    },
    not() {
      return wrapCondition(func("NOT", [expr]));
    },
    toExpr() {
      return expr;
    },
  };
}

function createFormulaFunctions<TColumnId extends string>(): FormulaFunctions<TColumnId> {
  return {
    abs(value) {
      return wrapExpr(func("ABS", [toExpr(value)]));
    },
    round(value, decimals = 0) {
      return wrapExpr(func("ROUND", [toExpr(value), literal(decimals)]));
    },
    min(...values) {
      return wrapExpr(func("MIN", values.map(toExpr)));
    },
    max(...values) {
      return wrapExpr(func("MAX", values.map(toExpr)));
    },
    if(condition, whenTrue, whenFalse) {
      return wrapExpr(
        func("IF", [toConditionExpr(condition), toExpr(whenTrue), toExpr(whenFalse)]),
      );
    },
    and(...conditions) {
      return wrapCondition(func("AND", conditions.map(toConditionExpr)));
    },
    or(...conditions) {
      return wrapCondition(func("OR", conditions.map(toConditionExpr)));
    },
    not(condition) {
      return wrapCondition(func("NOT", [toConditionExpr(condition)]));
    },
  };
}

export function createFormulaRowContext<TColumnId extends string>(): FormulaRowContext<TColumnId> {
  const fx = createFormulaFunctions<TColumnId>();

  return {
    ref(columnId) {
      return wrapExpr({ kind: "ref", columnId });
    },
    literal(value) {
      return wrapExpr(literal(value));
    },
    if(condition, whenTrue, whenFalse) {
      return fx.if(condition, whenTrue, whenFalse);
    },
  };
}

export function createFormulaFunctionsContext<
  TColumnId extends string,
>(): FormulaFunctions<TColumnId> {
  return createFormulaFunctions<TColumnId>();
}

export function toExpr<TColumnId extends string>(
  value: FormulaValue<TColumnId>,
): FormulaExpr<TColumnId> {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return literal(value);
  }

  if (typeof value === "object" && value !== null && "toExpr" in value) {
    return value.toExpr();
  }

  return value;
}

export function binary<TColumnId extends string>(
  left: FormulaExpr<TColumnId>,
  op: FormulaBinaryExpr<TColumnId>["op"],
  right: FormulaExpr<TColumnId>,
): FormulaExpr<TColumnId> {
  return {
    kind: "binary",
    op,
    left,
    right,
  };
}

export function func<TColumnId extends string>(
  name: FormulaFunctionExpr<TColumnId>["name"],
  args: FormulaExpr<TColumnId>[],
): FormulaExpr<TColumnId> {
  return {
    kind: "function",
    name,
    args,
  };
}

function literal(value: string | number | boolean): FormulaLiteralExpr {
  return {
    kind: "literal",
    value,
  };
}

function toConditionExpr<TColumnId extends string>(
  value: FormulaConditionValue<TColumnId>,
): FormulaExpr<TColumnId> {
  if (typeof value === "object" && value !== null && "toExpr" in value) {
    return value.toExpr();
  }

  return value;
}
