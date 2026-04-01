import {
  createFormulaFunctionsContext,
  createFormulaRowContext,
  binary,
  func,
  type FormulaConditionValue,
  type FormulaExpr,
  type FormulaFunctions,
  type FormulaRowContext,
} from "../formula/expr";
import type { CellStyle } from "../styles/types";

export interface ConditionalStyleRule<
  TColumnId extends string = string,
  TGroupId extends string = string,
> {
  condition: FormulaExpr<TColumnId, TGroupId>;
  style: CellStyle;
}

export interface ConditionalStyleBuilder<
  TColumnId extends string = string,
  TGroupId extends string = string,
> {
  when(
    condition: (context: {
      row: FormulaRowContext<TColumnId, TGroupId>;
      fx: FormulaFunctions<TColumnId, TGroupId>;
    }) => FormulaConditionValue<TColumnId, TGroupId>,
    style: CellStyle,
  ): ConditionalStyleBuilder<TColumnId, TGroupId>;
  done(): ConditionalStyleRule<TColumnId, TGroupId>[];
}

export type ConditionalStyleInput<
  TColumnId extends string = string,
  TGroupId extends string = string,
> =
  | ConditionalStyleRule<TColumnId, TGroupId>[]
  | ((
      builder: ConditionalStyleBuilder<TColumnId, TGroupId>,
    ) => ConditionalStyleBuilder<TColumnId, TGroupId>);

class ConditionalStyleBuilderImpl<
  TColumnId extends string = string,
  TGroupId extends string = string,
> implements ConditionalStyleBuilder<TColumnId, TGroupId> {
  private readonly rules: ConditionalStyleRule<TColumnId, TGroupId>[] = [];

  when(
    condition: (context: {
      row: FormulaRowContext<TColumnId, TGroupId>;
      fx: FormulaFunctions<TColumnId, TGroupId>;
    }) => FormulaConditionValue<TColumnId, TGroupId>,
    style: CellStyle,
  ) {
    const expr = condition({
      row: createFormulaRowContext<TColumnId, TGroupId>(),
      fx: createFormulaFunctionsContext<TColumnId, TGroupId>(),
    });

    this.rules.push({
      condition: toConditionExpr(expr),
      style,
    });

    return this;
  }

  done() {
    return [...this.rules];
  }
}

export function conditionalStyle<
  TColumnId extends string = string,
  TGroupId extends string = string,
>() {
  return new ConditionalStyleBuilderImpl<TColumnId, TGroupId>();
}

export function normalizeConditionalStyleInput<
  TColumnId extends string = string,
  TGroupId extends string = string,
>(input?: ConditionalStyleInput<TColumnId, TGroupId>) {
  if (!input) {
    return undefined;
  }

  if (Array.isArray(input)) {
    return input.length > 0 ? input : undefined;
  }

  const builder = input(conditionalStyle<TColumnId, TGroupId>());
  const rules = builder.done();
  return rules.length > 0 ? rules : undefined;
}

function toConditionExpr<TColumnId extends string, TGroupId extends string>(
  value: FormulaConditionValue<TColumnId, TGroupId>,
): FormulaExpr<TColumnId, TGroupId> {
  if (typeof value === "object" && value !== null && "toExpr" in value) {
    return value.toExpr();
  }

  if (value.kind === "binary") {
    return binary(value.left, value.op, value.right);
  }

  if (value.kind === "function") {
    return func(value.name, value.args);
  }

  return value;
}
