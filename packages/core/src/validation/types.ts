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
  TTextContext = void,
> {
  type: ValidationType;
  operator?: ValidationOperator;
  formula1?: string | number | Date | FormulaExpr<TColumnId, TGroupId>;
  formula2?: string | number | Date | FormulaExpr<TColumnId, TGroupId>;
  source?: Array<string | number>;
  allowBlank?: boolean;
  showDropDown?: boolean;
  prompt?: ValidationMessage<TTextContext> | string;
  error?: ValidationMessage<TTextContext> | string;
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
  TTextContext = void,
> {
  list(values: Array<string | number>): ValidationBuilder<TColumnId, TGroupId, TTextContext>;
  integer(): ValidationBuilder<TColumnId, TGroupId, TTextContext>;
  decimal(): ValidationBuilder<TColumnId, TGroupId, TTextContext>;
  date(): ValidationBuilder<TColumnId, TGroupId, TTextContext>;
  textLength(): ValidationBuilder<TColumnId, TGroupId, TTextContext>;
  custom(
    condition: (context: {
      row: FormulaRowContext<TColumnId, TGroupId>;
      refs: FormulaRefs<TColumnId, TGroupId, never>;
      fx: FormulaFunctions<TColumnId, TGroupId>;
    }) => FormulaConditionValue<TColumnId, TGroupId>,
  ): ValidationBuilder<TColumnId, TGroupId, TTextContext>;
  between(
    min: string | number | Date,
    max: string | number | Date,
  ): ValidationBuilder<TColumnId, TGroupId, TTextContext>;
  notBetween(
    min: string | number | Date,
    max: string | number | Date,
  ): ValidationBuilder<TColumnId, TGroupId, TTextContext>;
  eq(value: string | number | Date): ValidationBuilder<TColumnId, TGroupId, TTextContext>;
  neq(value: string | number | Date): ValidationBuilder<TColumnId, TGroupId, TTextContext>;
  gt(value: string | number | Date): ValidationBuilder<TColumnId, TGroupId, TTextContext>;
  gte(value: string | number | Date): ValidationBuilder<TColumnId, TGroupId, TTextContext>;
  lt(value: string | number | Date): ValidationBuilder<TColumnId, TGroupId, TTextContext>;
  lte(value: string | number | Date): ValidationBuilder<TColumnId, TGroupId, TTextContext>;
  allowBlank(value?: boolean): ValidationBuilder<TColumnId, TGroupId, TTextContext>;
  showDropDown(value?: boolean): ValidationBuilder<TColumnId, TGroupId, TTextContext>;
  prompt(
    message: string | ValidationMessage<TTextContext>,
  ): ValidationBuilder<TColumnId, TGroupId, TTextContext>;
  error(
    message: string | ValidationMessage<TTextContext>,
  ): ValidationBuilder<TColumnId, TGroupId, TTextContext>;
  done(): ValidationRule<TColumnId, TGroupId, TTextContext>;
}

export type ValidationInput<
  TColumnId extends string = string,
  TGroupId extends string = string,
  TTextContext = void,
> =
  | ValidationRule<TColumnId, TGroupId, TTextContext>
  | ((
      builder: ValidationBuilder<TColumnId, TGroupId, TTextContext>,
    ) => ValidationBuilder<TColumnId, TGroupId, TTextContext>);

class ValidationBuilderImpl<
  TColumnId extends string = string,
  TGroupId extends string = string,
  TTextContext = void,
> implements ValidationBuilder<TColumnId, TGroupId, TTextContext> {
  private rule: ValidationRule<TColumnId, TGroupId, TTextContext> = { type: "custom" };

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

  prompt(message: string | ValidationMessage<TTextContext>) {
    this.rule.prompt = message;
    return this;
  }

  error(message: string | ValidationMessage<TTextContext>) {
    this.rule.error = message;
    return this;
  }

  done() {
    return { ...this.rule };
  }
}

export function validation<
  TColumnId extends string = string,
  TGroupId extends string = string,
  TTextContext = void,
>() {
  return new ValidationBuilderImpl<TColumnId, TGroupId, TTextContext>();
}

export function normalizeValidationInput<
  TColumnId extends string = string,
  TGroupId extends string = string,
  TTextContext = void,
>(
  input?: ValidationInput<TColumnId, TGroupId, TTextContext>,
): ValidationRule<TColumnId, TGroupId, TTextContext> | undefined {
  if (!input) {
    return undefined;
  }

  const rule =
    typeof input === "function"
      ? input(validation<TColumnId, TGroupId, TTextContext>()).done()
      : input;

  return { ...rule };
}

export function resolveValidationRule<
  TColumnId extends string = string,
  TGroupId extends string = string,
  TTextContext = void,
>(
  rule: ValidationRule<TColumnId, TGroupId, TTextContext>,
  context: TTextContext,
): ResolvedValidationRule<TColumnId, TGroupId> {
  return {
    ...rule,
    prompt: resolveValidationMessage(rule.prompt, context),
    error: resolveValidationMessage(rule.error, context),
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
