import {
  createFormulaRefs,
  createFormulaFunctionsContext,
  createFormulaRowContext,
  type FormulaConditionValue,
  type FormulaExpr,
  type FormulaFunctions,
  type FormulaRefs,
  type FormulaRowContext,
} from "../formula/expr";
import { binary, func } from "../formula/expr";
import {
  resolveValidationMessage,
  type ResolvedValidationMessage,
  type ValidationMessage,
} from "../text";

export type ValidationType = "list" | "whole" | "decimal" | "date" | "textLength" | "custom";
export type ValidationOperator =
  | "between"
  | "notBetween"
  | "equal"
  | "notEqual"
  | "greaterThan"
  | "lessThan"
  | "greaterThanOrEqual"
  | "lessThanOrEqual";

export interface ValidationRule<
  TColumnId extends string = string,
  TGroupId extends string = string,
> {
  type: ValidationType;
  operator?: ValidationOperator;
  formula1?: string | number | Date | FormulaExpr<TColumnId, TGroupId>;
  formula2?: string | number | Date | FormulaExpr<TColumnId, TGroupId>;
  source?: Array<string | number>;
  allowBlank?: boolean;
  showDropDown?: boolean;
  prompt?: ValidationMessage | string;
  error?: ValidationMessage | string;
}

export interface ResolvedValidationRule<
  TColumnId extends string = string,
  TGroupId extends string = string,
> extends Omit<ValidationRule<TColumnId, TGroupId>, "prompt" | "error"> {
  prompt?: ResolvedValidationMessage;
  error?: ResolvedValidationMessage;
}

export interface ValidationBuilder<
  TColumnId extends string = string,
  TGroupId extends string = string,
> {
  list(values: Array<string | number>): ValidationBuilder<TColumnId, TGroupId>;
  integer(): ValidationBuilder<TColumnId, TGroupId>;
  decimal(): ValidationBuilder<TColumnId, TGroupId>;
  date(): ValidationBuilder<TColumnId, TGroupId>;
  textLength(): ValidationBuilder<TColumnId, TGroupId>;
  custom(
    condition: (context: {
      row: FormulaRowContext<TColumnId, TGroupId>;
      refs: FormulaRefs<TColumnId, TGroupId, never>;
      fx: FormulaFunctions<TColumnId, TGroupId>;
    }) => FormulaConditionValue<TColumnId, TGroupId>,
  ): ValidationBuilder<TColumnId, TGroupId>;
  between(
    min: string | number | Date,
    max: string | number | Date,
  ): ValidationBuilder<TColumnId, TGroupId>;
  notBetween(
    min: string | number | Date,
    max: string | number | Date,
  ): ValidationBuilder<TColumnId, TGroupId>;
  eq(value: string | number | Date): ValidationBuilder<TColumnId, TGroupId>;
  neq(value: string | number | Date): ValidationBuilder<TColumnId, TGroupId>;
  gt(value: string | number | Date): ValidationBuilder<TColumnId, TGroupId>;
  gte(value: string | number | Date): ValidationBuilder<TColumnId, TGroupId>;
  lt(value: string | number | Date): ValidationBuilder<TColumnId, TGroupId>;
  lte(value: string | number | Date): ValidationBuilder<TColumnId, TGroupId>;
  allowBlank(value?: boolean): ValidationBuilder<TColumnId, TGroupId>;
  showDropDown(value?: boolean): ValidationBuilder<TColumnId, TGroupId>;
  prompt(message: string | ValidationMessage): ValidationBuilder<TColumnId, TGroupId>;
  error(message: string | ValidationMessage): ValidationBuilder<TColumnId, TGroupId>;
  done(): ValidationRule<TColumnId, TGroupId>;
}

export type ValidationInput<TColumnId extends string = string, TGroupId extends string = string> =
  | ValidationRule<TColumnId, TGroupId>
  | ((builder: ValidationBuilder<TColumnId, TGroupId>) => ValidationBuilder<TColumnId, TGroupId>);

class ValidationBuilderImpl<
  TColumnId extends string = string,
  TGroupId extends string = string,
> implements ValidationBuilder<TColumnId, TGroupId> {
  private rule: ValidationRule<TColumnId, TGroupId> = { type: "custom" };

  list(values: Array<string | number>) {
    this.rule.type = "list";
    this.rule.source = values;
    return this;
  }

  integer() {
    this.rule.type = "whole";
    return this;
  }

  decimal() {
    this.rule.type = "decimal";
    return this;
  }

  date() {
    this.rule.type = "date";
    return this;
  }

  textLength() {
    this.rule.type = "textLength";
    return this;
  }

  custom(
    condition: (context: {
      row: FormulaRowContext<TColumnId, TGroupId>;
      refs: FormulaRefs<TColumnId, TGroupId, never>;
      fx: FormulaFunctions<TColumnId, TGroupId>;
    }) => FormulaConditionValue<TColumnId, TGroupId>,
  ) {
    this.rule.type = "custom";
    const resolvedCondition = condition({
      row: createFormulaRowContext<TColumnId, TGroupId>(),
      refs: createFormulaRefs<TColumnId, TGroupId, never>(),
      fx: createFormulaFunctionsContext<TColumnId, TGroupId>(),
    });
    this.rule.formula1 = toConditionExpr(resolvedCondition);
    return this;
  }

  between(min: string | number | Date, max: string | number | Date) {
    this.rule.operator = "between";
    this.rule.formula1 = min;
    this.rule.formula2 = max;
    return this;
  }

  notBetween(min: string | number | Date, max: string | number | Date) {
    this.rule.operator = "notBetween";
    this.rule.formula1 = min;
    this.rule.formula2 = max;
    return this;
  }

  eq(value: string | number | Date) {
    this.rule.operator = "equal";
    this.rule.formula1 = value;
    return this;
  }

  neq(value: string | number | Date) {
    this.rule.operator = "notEqual";
    this.rule.formula1 = value;
    return this;
  }

  gt(value: string | number | Date) {
    this.rule.operator = "greaterThan";
    this.rule.formula1 = value;
    return this;
  }

  gte(value: string | number | Date) {
    this.rule.operator = "greaterThanOrEqual";
    this.rule.formula1 = value;
    return this;
  }

  lt(value: string | number | Date) {
    this.rule.operator = "lessThan";
    this.rule.formula1 = value;
    return this;
  }

  lte(value: string | number | Date) {
    this.rule.operator = "lessThanOrEqual";
    this.rule.formula1 = value;
    return this;
  }

  allowBlank(value = true) {
    this.rule.allowBlank = value;
    return this;
  }

  showDropDown(value = true) {
    this.rule.showDropDown = value;
    return this;
  }

  prompt(message: string | ValidationMessage) {
    this.rule.prompt = resolveValidationMessage(message);
    return this;
  }

  error(message: string | ValidationMessage) {
    this.rule.error = resolveValidationMessage(message);
    return this;
  }

  done() {
    return { ...this.rule };
  }
}

export function validation<TColumnId extends string = string, TGroupId extends string = string>() {
  return new ValidationBuilderImpl<TColumnId, TGroupId>();
}

export function normalizeValidationInput<
  TColumnId extends string = string,
  TGroupId extends string = string,
>(
  input?: ValidationInput<TColumnId, TGroupId>,
): ResolvedValidationRule<TColumnId, TGroupId> | undefined {
  if (!input) {
    return undefined;
  }

  const rule =
    typeof input === "function" ? input(validation<TColumnId, TGroupId>()).done() : input;

  return {
    ...rule,
    prompt: resolveValidationMessage(rule.prompt),
    error: resolveValidationMessage(rule.error),
  };
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
