export interface FormulaLiteralExpr {
  kind: "literal";
  value: string | number | boolean;
}

export interface FormulaRefExpr<TColumnId extends string = string> {
  kind: "ref";
  columnId: TColumnId;
}

export interface FormulaGroupExpr<TGroupId extends string = string> {
  kind: "group";
  aggregate: "AVERAGE" | "COUNT" | "MAX" | "MIN" | "SUM";
  groupId: TGroupId;
}

export interface FormulaBinaryExpr<
  TColumnId extends string = string,
  TGroupId extends string = string,
> {
  kind: "binary";
  op: "+" | "-" | "*" | "/" | "=" | "<>" | ">" | ">=" | "<" | "<=";
  left: FormulaExpr<TColumnId, TGroupId>;
  right: FormulaExpr<TColumnId, TGroupId>;
}

export interface FormulaFunctionExpr<
  TColumnId extends string = string,
  TGroupId extends string = string,
> {
  kind: "function";
  name: "ABS" | "AND" | "AVERAGE" | "COUNT" | "IF" | "MAX" | "MIN" | "NOT" | "OR" | "ROUND" | "SUM";
  args: FormulaExpr<TColumnId, TGroupId>[];
}

export type FormulaExpr<TColumnId extends string = string, TGroupId extends string = string> =
  | FormulaLiteralExpr
  | FormulaRefExpr<TColumnId>
  | FormulaGroupExpr<TGroupId>
  | FormulaBinaryExpr<TColumnId, TGroupId>
  | FormulaFunctionExpr<TColumnId, TGroupId>;

export interface FormulaOperand<
  TColumnId extends string = string,
  TGroupId extends string = string,
> {
  add(right: FormulaValue<TColumnId, TGroupId>): FormulaOperand<TColumnId, TGroupId>;
  sub(right: FormulaValue<TColumnId, TGroupId>): FormulaOperand<TColumnId, TGroupId>;
  mul(right: FormulaValue<TColumnId, TGroupId>): FormulaOperand<TColumnId, TGroupId>;
  div(right: FormulaValue<TColumnId, TGroupId>): FormulaOperand<TColumnId, TGroupId>;
  abs(): FormulaOperand<TColumnId, TGroupId>;
  round(decimals?: number): FormulaOperand<TColumnId, TGroupId>;
  eq(right: FormulaValue<TColumnId, TGroupId>): FormulaCondition<TColumnId, TGroupId>;
  neq(right: FormulaValue<TColumnId, TGroupId>): FormulaCondition<TColumnId, TGroupId>;
  gt(right: FormulaValue<TColumnId, TGroupId>): FormulaCondition<TColumnId, TGroupId>;
  gte(right: FormulaValue<TColumnId, TGroupId>): FormulaCondition<TColumnId, TGroupId>;
  lt(right: FormulaValue<TColumnId, TGroupId>): FormulaCondition<TColumnId, TGroupId>;
  lte(right: FormulaValue<TColumnId, TGroupId>): FormulaCondition<TColumnId, TGroupId>;
  toExpr(): FormulaExpr<TColumnId, TGroupId>;
}

export interface FormulaCondition<
  TColumnId extends string = string,
  TGroupId extends string = string,
> {
  and(right: FormulaConditionValue<TColumnId, TGroupId>): FormulaCondition<TColumnId, TGroupId>;
  or(right: FormulaConditionValue<TColumnId, TGroupId>): FormulaCondition<TColumnId, TGroupId>;
  not(): FormulaCondition<TColumnId, TGroupId>;
  toExpr(): FormulaExpr<TColumnId, TGroupId>;
}

export interface FormulaFunctions<
  TColumnId extends string = string,
  TGroupId extends string = string,
> {
  abs(value: FormulaValue<TColumnId, TGroupId>): FormulaOperand<TColumnId, TGroupId>;
  round(
    value: FormulaValue<TColumnId, TGroupId>,
    decimals?: number,
  ): FormulaOperand<TColumnId, TGroupId>;
  min(...values: FormulaValue<TColumnId, TGroupId>[]): FormulaOperand<TColumnId, TGroupId>;
  max(...values: FormulaValue<TColumnId, TGroupId>[]): FormulaOperand<TColumnId, TGroupId>;
  if(
    condition: FormulaConditionValue<TColumnId, TGroupId>,
    whenTrue: FormulaValue<TColumnId, TGroupId>,
    whenFalse: FormulaValue<TColumnId, TGroupId>,
  ): FormulaOperand<TColumnId, TGroupId>;
  and(
    ...conditions: FormulaConditionValue<TColumnId, TGroupId>[]
  ): FormulaCondition<TColumnId, TGroupId>;
  or(
    ...conditions: FormulaConditionValue<TColumnId, TGroupId>[]
  ): FormulaCondition<TColumnId, TGroupId>;
  not(condition: FormulaConditionValue<TColumnId, TGroupId>): FormulaCondition<TColumnId, TGroupId>;
}

export interface FormulaGroupContext<TColumnId extends string, TGroupId extends string> {
  sum(): FormulaOperand<TColumnId, TGroupId>;
  average(): FormulaOperand<TColumnId, TGroupId>;
  min(): FormulaOperand<TColumnId, TGroupId>;
  max(): FormulaOperand<TColumnId, TGroupId>;
  count(): FormulaOperand<TColumnId, TGroupId>;
}

export interface FormulaRowContext<TColumnId extends string, TGroupId extends string = never> {
  ref(columnId: TColumnId): FormulaOperand<TColumnId, TGroupId>;
  group(groupId: TGroupId): FormulaGroupContext<TColumnId, TGroupId>;
  literal(value: string | number | boolean): FormulaOperand<TColumnId, TGroupId>;
  if(
    condition: FormulaConditionValue<TColumnId, TGroupId>,
    whenTrue: FormulaValue<TColumnId, TGroupId>,
    whenFalse: FormulaValue<TColumnId, TGroupId>,
  ): FormulaOperand<TColumnId, TGroupId>;
}

export type FormulaValue<TColumnId extends string = string, TGroupId extends string = string> =
  | string
  | number
  | boolean
  | FormulaExpr<TColumnId, TGroupId>
  | FormulaOperand<TColumnId, TGroupId>;

export type FormulaConditionValue<
  TColumnId extends string = string,
  TGroupId extends string = string,
> = FormulaExpr<TColumnId, TGroupId> | FormulaCondition<TColumnId, TGroupId>;

function wrapExpr<TColumnId extends string, TGroupId extends string>(
  expr: FormulaExpr<TColumnId, TGroupId>,
): FormulaOperand<TColumnId, TGroupId> {
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

function wrapCondition<TColumnId extends string, TGroupId extends string>(
  expr: FormulaExpr<TColumnId, TGroupId>,
): FormulaCondition<TColumnId, TGroupId> {
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

function wrapGroup<TColumnId extends string, TGroupId extends string>(
  groupId: TGroupId,
): FormulaGroupContext<TColumnId, TGroupId> {
  return {
    sum() {
      return wrapExpr({ aggregate: "SUM", groupId, kind: "group" });
    },
    average() {
      return wrapExpr({ aggregate: "AVERAGE", groupId, kind: "group" });
    },
    min() {
      return wrapExpr({ aggregate: "MIN", groupId, kind: "group" });
    },
    max() {
      return wrapExpr({ aggregate: "MAX", groupId, kind: "group" });
    },
    count() {
      return wrapExpr({ aggregate: "COUNT", groupId, kind: "group" });
    },
  };
}

function createFormulaFunctions<
  TColumnId extends string,
  TGroupId extends string,
>(): FormulaFunctions<TColumnId, TGroupId> {
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

export function createFormulaRowContext<
  TColumnId extends string,
  TGroupId extends string,
>(): FormulaRowContext<TColumnId, TGroupId> {
  const fx = createFormulaFunctions<TColumnId, TGroupId>();

  return {
    ref(columnId) {
      return wrapExpr({ kind: "ref", columnId });
    },
    group(groupId) {
      return wrapGroup(groupId);
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
  TGroupId extends string,
>(): FormulaFunctions<TColumnId, TGroupId> {
  return createFormulaFunctions<TColumnId, TGroupId>();
}

export function toExpr<TColumnId extends string, TGroupId extends string>(
  value: FormulaValue<TColumnId, TGroupId>,
): FormulaExpr<TColumnId, TGroupId> {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return literal(value);
  }

  if (typeof value === "object" && value !== null && "toExpr" in value) {
    return value.toExpr();
  }

  return value;
}

export function binary<TColumnId extends string, TGroupId extends string>(
  left: FormulaExpr<TColumnId, TGroupId>,
  op: FormulaBinaryExpr<TColumnId, TGroupId>["op"],
  right: FormulaExpr<TColumnId, TGroupId>,
): FormulaExpr<TColumnId, TGroupId> {
  return {
    kind: "binary",
    op,
    left,
    right,
  };
}

export function func<TColumnId extends string, TGroupId extends string>(
  name: FormulaFunctionExpr<TColumnId, TGroupId>["name"],
  args: FormulaExpr<TColumnId, TGroupId>[],
): FormulaExpr<TColumnId, TGroupId> {
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

function toConditionExpr<TColumnId extends string, TGroupId extends string>(
  value: FormulaConditionValue<TColumnId, TGroupId>,
): FormulaExpr<TColumnId, TGroupId> {
  if (typeof value === "object" && value !== null && "toExpr" in value) {
    return value.toExpr();
  }

  return value;
}
