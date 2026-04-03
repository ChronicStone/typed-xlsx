export interface FormulaLiteralExpr {
  kind: "literal";
  value: string | number | boolean;
}

export interface FormulaRefExpr<TColumnId extends string = string> {
  kind: "ref";
  columnId: TColumnId;
}

export interface FormulaSeriesExpr<TColumnId extends string = string> {
  kind: "series";
  columnId: TColumnId;
}

export interface FormulaCollectionAggregateExpr<TColumnId extends string = string> {
  kind: "collection-aggregate";
  aggregate: "AVERAGE" | "COUNT" | "MAX" | "MIN" | "SUM";
  target: FormulaSeriesExpr<TColumnId>;
}

export interface FormulaScopeAggregateExpr<TScopeId extends string = string> {
  kind: "scope-aggregate";
  aggregate: "AVERAGE" | "COUNT" | "MAX" | "MIN" | "SUM";
  scopeId: TScopeId;
}

export interface FormulaBinaryExpr<
  TColumnId extends string = string,
  TScopeId extends string = string,
> {
  kind: "binary";
  op: "+" | "-" | "*" | "/" | "=" | "<>" | ">" | ">=" | "<" | "<=";
  left: FormulaExpr<TColumnId, TScopeId>;
  right: FormulaExpr<TColumnId, TScopeId>;
}

export interface FormulaFunctionExpr<
  TColumnId extends string = string,
  TScopeId extends string = string,
> {
  kind: "function";
  name: "ABS" | "AND" | "AVERAGE" | "COUNT" | "IF" | "MAX" | "MIN" | "NOT" | "OR" | "ROUND" | "SUM";
  args: FormulaExpr<TColumnId, TScopeId>[];
}

export type FormulaExpr<TColumnId extends string = string, TScopeId extends string = string> =
  | FormulaLiteralExpr
  | FormulaRefExpr<TColumnId>
  | FormulaSeriesExpr<TColumnId>
  | FormulaCollectionAggregateExpr<TColumnId>
  | FormulaScopeAggregateExpr<TScopeId>
  | FormulaBinaryExpr<TColumnId, TScopeId>
  | FormulaFunctionExpr<TColumnId, TScopeId>;

export interface FormulaSeriesContext<
  TColumnId extends string = string,
  TScopeId extends string = string,
> {
  sum(): FormulaOperand<TColumnId, TScopeId>;
  average(): FormulaOperand<TColumnId, TScopeId>;
  min(): FormulaOperand<TColumnId, TScopeId>;
  max(): FormulaOperand<TColumnId, TScopeId>;
  count(): FormulaOperand<TColumnId, TScopeId>;
}

export interface FormulaOperand<
  TColumnId extends string = string,
  TScopeId extends string = string,
> {
  add(right: FormulaValue<TColumnId, TScopeId>): FormulaOperand<TColumnId, TScopeId>;
  sub(right: FormulaValue<TColumnId, TScopeId>): FormulaOperand<TColumnId, TScopeId>;
  mul(right: FormulaValue<TColumnId, TScopeId>): FormulaOperand<TColumnId, TScopeId>;
  div(right: FormulaValue<TColumnId, TScopeId>): FormulaOperand<TColumnId, TScopeId>;
  abs(): FormulaOperand<TColumnId, TScopeId>;
  round(decimals?: number): FormulaOperand<TColumnId, TScopeId>;
  eq(right: FormulaValue<TColumnId, TScopeId>): FormulaCondition<TColumnId, TScopeId>;
  neq(right: FormulaValue<TColumnId, TScopeId>): FormulaCondition<TColumnId, TScopeId>;
  gt(right: FormulaValue<TColumnId, TScopeId>): FormulaCondition<TColumnId, TScopeId>;
  gte(right: FormulaValue<TColumnId, TScopeId>): FormulaCondition<TColumnId, TScopeId>;
  lt(right: FormulaValue<TColumnId, TScopeId>): FormulaCondition<TColumnId, TScopeId>;
  lte(right: FormulaValue<TColumnId, TScopeId>): FormulaCondition<TColumnId, TScopeId>;
  toExpr(): FormulaExpr<TColumnId, TScopeId>;
}

export interface FormulaCondition<
  TColumnId extends string = string,
  TScopeId extends string = string,
> {
  and(right: FormulaConditionValue<TColumnId, TScopeId>): FormulaCondition<TColumnId, TScopeId>;
  or(right: FormulaConditionValue<TColumnId, TScopeId>): FormulaCondition<TColumnId, TScopeId>;
  not(): FormulaCondition<TColumnId, TScopeId>;
  toExpr(): FormulaExpr<TColumnId, TScopeId>;
}

export interface FormulaScopeRef<TScopeId extends string = string> {
  kind: "scope-ref";
  scopeId: TScopeId;
}

export interface FormulaRefs<
  TColumnId extends string = string,
  TGroupId extends string = never,
  TDynamicId extends string = never,
> {
  column(columnId: TColumnId): FormulaOperand<TColumnId, TGroupId | TDynamicId>;
  group(groupId: TGroupId): FormulaScopeRef<TGroupId>;
  dynamic(dynamicId: TDynamicId): FormulaScopeRef<TDynamicId>;
}

export interface FormulaFunctions<
  TColumnId extends string = string,
  TScopeId extends string = string,
> {
  literal(value: string | number | boolean): FormulaOperand<TColumnId, TScopeId>;
  abs(value: FormulaValue<TColumnId, TScopeId>): FormulaOperand<TColumnId, TScopeId>;
  round(
    value: FormulaValue<TColumnId, TScopeId>,
    decimals?: number,
  ): FormulaOperand<TColumnId, TScopeId>;
  sum(value: FormulaScopeRef<TScopeId>): FormulaOperand<TColumnId, TScopeId>;
  sum(...values: FormulaValue<TColumnId, TScopeId>[]): FormulaOperand<TColumnId, TScopeId>;
  average(value: FormulaScopeRef<TScopeId>): FormulaOperand<TColumnId, TScopeId>;
  average(...values: FormulaValue<TColumnId, TScopeId>[]): FormulaOperand<TColumnId, TScopeId>;
  count(value: FormulaScopeRef<TScopeId>): FormulaOperand<TColumnId, TScopeId>;
  count(...values: FormulaValue<TColumnId, TScopeId>[]): FormulaOperand<TColumnId, TScopeId>;
  min(value: FormulaScopeRef<TScopeId>): FormulaOperand<TColumnId, TScopeId>;
  min(...values: FormulaValue<TColumnId, TScopeId>[]): FormulaOperand<TColumnId, TScopeId>;
  max(value: FormulaScopeRef<TScopeId>): FormulaOperand<TColumnId, TScopeId>;
  max(...values: FormulaValue<TColumnId, TScopeId>[]): FormulaOperand<TColumnId, TScopeId>;
  if(
    condition: FormulaConditionValue<TColumnId, TScopeId>,
    whenTrue: FormulaValue<TColumnId, TScopeId>,
    whenFalse: FormulaValue<TColumnId, TScopeId>,
  ): FormulaOperand<TColumnId, TScopeId>;
  and(
    ...conditions: FormulaConditionValue<TColumnId, TScopeId>[]
  ): FormulaCondition<TColumnId, TScopeId>;
  or(
    ...conditions: FormulaConditionValue<TColumnId, TScopeId>[]
  ): FormulaCondition<TColumnId, TScopeId>;
  not(condition: FormulaConditionValue<TColumnId, TScopeId>): FormulaCondition<TColumnId, TScopeId>;
}

export interface FormulaRowContext<TColumnId extends string, TScopeId extends string = never> {
  ref(columnId: TColumnId): FormulaOperand<TColumnId, TScopeId>;
  group(scopeId: TScopeId): FormulaSeriesContext<TColumnId, TScopeId>;
  series(columnId: TColumnId): FormulaSeriesContext<TColumnId, TScopeId>;
  if(
    condition: FormulaConditionValue<TColumnId, TScopeId>,
    whenTrue: FormulaValue<TColumnId, TScopeId>,
    whenFalse: FormulaValue<TColumnId, TScopeId>,
  ): FormulaOperand<TColumnId, TScopeId>;
}

export type FormulaValue<TColumnId extends string = string, TScopeId extends string = string> =
  | string
  | number
  | boolean
  | FormulaExpr<TColumnId, TScopeId>
  | FormulaOperand<TColumnId, TScopeId>;

export type FormulaConditionValue<
  TColumnId extends string = string,
  TScopeId extends string = string,
> = FormulaExpr<TColumnId, TScopeId> | FormulaCondition<TColumnId, TScopeId>;

function wrapExpr<TColumnId extends string, TScopeId extends string>(
  expr: FormulaExpr<TColumnId, TScopeId>,
): FormulaOperand<TColumnId, TScopeId> {
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

function wrapCondition<TColumnId extends string, TScopeId extends string>(
  expr: FormulaExpr<TColumnId, TScopeId>,
): FormulaCondition<TColumnId, TScopeId> {
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

function wrapSeries<TColumnId extends string, TScopeId extends string>(
  columnId: TColumnId,
): FormulaSeriesContext<TColumnId, TScopeId> {
  const target: FormulaSeriesExpr<TColumnId> = { kind: "series", columnId };

  return {
    sum() {
      return wrapExpr({ kind: "collection-aggregate", aggregate: "SUM", target });
    },
    average() {
      return wrapExpr({ kind: "collection-aggregate", aggregate: "AVERAGE", target });
    },
    min() {
      return wrapExpr({ kind: "collection-aggregate", aggregate: "MIN", target });
    },
    max() {
      return wrapExpr({ kind: "collection-aggregate", aggregate: "MAX", target });
    },
    count() {
      return wrapExpr({ kind: "collection-aggregate", aggregate: "COUNT", target });
    },
  };
}

function wrapScope<TColumnId extends string, TScopeId extends string>(
  scopeId: TScopeId,
): FormulaSeriesContext<TColumnId, TScopeId> {
  return {
    sum() {
      return wrapExpr(createScopeAggregateExpr("SUM", scopeId));
    },
    average() {
      return wrapExpr(createScopeAggregateExpr("AVERAGE", scopeId));
    },
    min() {
      return wrapExpr(createScopeAggregateExpr("MIN", scopeId));
    },
    max() {
      return wrapExpr(createScopeAggregateExpr("MAX", scopeId));
    },
    count() {
      return wrapExpr(createScopeAggregateExpr("COUNT", scopeId));
    },
  };
}

function createScopeAggregateExpr<TScopeId extends string>(
  aggregate: FormulaScopeAggregateExpr<TScopeId>["aggregate"],
  scopeId: TScopeId,
): FormulaScopeAggregateExpr<TScopeId> {
  return {
    aggregate,
    kind: "scope-aggregate",
    scopeId,
  };
}

function isScopeRef<TScopeId extends string>(value: unknown): value is FormulaScopeRef<TScopeId> {
  return (
    typeof value === "object" && value !== null && "kind" in value && value.kind === "scope-ref"
  );
}

function createFormulaFunctions<
  TColumnId extends string,
  TScopeId extends string,
>(): FormulaFunctions<TColumnId, TScopeId> {
  const aggregateFromArgs = (
    aggregate: FormulaScopeAggregateExpr<TScopeId>["aggregate"],
    first: FormulaScopeRef<TScopeId> | FormulaValue<TColumnId, TScopeId>,
    rest: FormulaValue<TColumnId, TScopeId>[],
  ) => {
    if (isScopeRef(first) && rest.length === 0) {
      return wrapExpr<TColumnId, TScopeId>(createScopeAggregateExpr(aggregate, first.scopeId));
    }

    const values = [first as FormulaValue<TColumnId, TScopeId>, ...rest];
    return wrapExpr<TColumnId, TScopeId>(func(aggregate, values.map(toExpr)));
  };

  return {
    literal(value) {
      return wrapExpr(literal(value));
    },
    abs(value) {
      return wrapExpr(func("ABS", [toExpr(value)]));
    },
    round(value, decimals = 0) {
      return wrapExpr(func("ROUND", [toExpr(value), literal(decimals)]));
    },
    sum(first, ...rest) {
      return aggregateFromArgs("SUM", first, rest);
    },
    average(first, ...rest) {
      return aggregateFromArgs("AVERAGE", first, rest);
    },
    count(first, ...rest) {
      return aggregateFromArgs("COUNT", first, rest);
    },
    min(first, ...rest) {
      return aggregateFromArgs("MIN", first, rest);
    },
    max(first, ...rest) {
      return aggregateFromArgs("MAX", first, rest);
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
  TScopeId extends string,
>(): FormulaRowContext<TColumnId, TScopeId> {
  const fx = createFormulaFunctions<TColumnId, TScopeId>();

  return {
    ref(columnId) {
      return wrapExpr({ kind: "ref", columnId });
    },
    group(scopeId) {
      return wrapScope(scopeId);
    },
    series(columnId) {
      return wrapSeries(columnId);
    },
    if(condition, whenTrue, whenFalse) {
      return fx.if(condition, whenTrue, whenFalse);
    },
  };
}

export function createFormulaRefs<
  TColumnId extends string,
  TGroupId extends string,
  TDynamicId extends string,
>(): FormulaRefs<TColumnId, TGroupId, TDynamicId> {
  return {
    column(columnId) {
      return wrapExpr({ kind: "ref", columnId });
    },
    group(groupId) {
      return { kind: "scope-ref", scopeId: groupId };
    },
    dynamic(dynamicId) {
      return { kind: "scope-ref", scopeId: dynamicId };
    },
  };
}

export function createFormulaFunctionsContext<
  TColumnId extends string,
  TScopeId extends string,
>(): FormulaFunctions<TColumnId, TScopeId> {
  return createFormulaFunctions<TColumnId, TScopeId>();
}

export function toExpr<TColumnId extends string, TScopeId extends string>(
  value: FormulaValue<TColumnId, TScopeId>,
): FormulaExpr<TColumnId, TScopeId> {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return literal(value);
  }

  if (typeof value === "object" && value !== null && "toExpr" in value) {
    return value.toExpr();
  }

  return value;
}

export function binary<TColumnId extends string, TScopeId extends string>(
  left: FormulaExpr<TColumnId, TScopeId>,
  op: FormulaBinaryExpr<TColumnId, TScopeId>["op"],
  right: FormulaExpr<TColumnId, TScopeId>,
): FormulaExpr<TColumnId, TScopeId> {
  return {
    kind: "binary",
    op,
    left,
    right,
  };
}

export function func<TColumnId extends string, TScopeId extends string>(
  name: FormulaFunctionExpr<TColumnId, TScopeId>["name"],
  args: FormulaExpr<TColumnId, TScopeId>[],
): FormulaExpr<TColumnId, TScopeId> {
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

function toConditionExpr<TColumnId extends string, TScopeId extends string>(
  value: FormulaConditionValue<TColumnId, TScopeId>,
): FormulaExpr<TColumnId, TScopeId> {
  if (typeof value === "object" && value !== null && "toExpr" in value) {
    return value.toExpr();
  }

  return value;
}
