import type { FormulaCell } from "../cell-data";
import type {
  FormulaConditionValue,
  FormulaExpr,
  FormulaFunctions,
  FormulaOperand,
  FormulaValue,
} from "../formula/expr";
import { createFormulaFunctionsContext, toExpr } from "../formula/expr";
import type { CellStyle } from "../styles/types";

export type SummaryCellValue = string | number | boolean | Date | null | undefined;
export type SummaryFormulaFunction = "sum" | "average" | "count" | "min" | "max";

export interface SummaryColumnRangeContext {
  cells(): SummaryColumnCellsContext;
  rows(): SummaryColumnRowsContext;
}

export interface SummaryColumnCellsContext {
  sum(): FormulaExpr<string, never>;
  average(): FormulaExpr<string, never>;
  count(): FormulaExpr<string, never>;
  min(): FormulaExpr<string, never>;
  max(): FormulaExpr<string, never>;
}

export interface SummaryRowCellsContext {
  sum(): FormulaExpr<string, never>;
  average(): FormulaExpr<string, never>;
  count(): FormulaExpr<string, never>;
  min(): FormulaExpr<string, never>;
  max(): FormulaExpr<string, never>;
}

export interface SummaryColumnRowsContext {
  sum(
    resolver: (row: { cells(): SummaryRowCellsContext }) => FormulaValue<string, never>,
  ): SummaryRowAggregateExpr;
  average(
    resolver: (row: { cells(): SummaryRowCellsContext }) => FormulaValue<string, never>,
  ): SummaryRowAggregateExpr;
  count(
    resolver: (row: { cells(): SummaryRowCellsContext }) => FormulaConditionValue<string, never>,
  ): SummaryRowAggregateExpr;
  min(
    resolver: (row: { cells(): SummaryRowCellsContext }) => FormulaValue<string, never>,
  ): SummaryRowAggregateExpr;
  max(
    resolver: (row: { cells(): SummaryRowCellsContext }) => FormulaValue<string, never>,
  ): SummaryRowAggregateExpr;
}

export interface SummaryFormulaBuilderContext {
  column: SummaryColumnRangeContext;
  fx: FormulaFunctions<string, never>;
}

export type SummaryFormulaResolver = (
  context: SummaryFormulaBuilderContext,
) => FormulaValue<string, never> | SummaryRowAggregateExpr;

export interface SummaryFormulaDefinition {
  kind: "formula";
  resolve: SummaryFormulaResolver;
}

export interface SummarySpacerDefinition {
  kind: "spacer";
}

export interface SummaryFormulaContext {
  startRow: number;
  endRow: number;
  column: number;
  logicalRows?: Array<{ startRow: number; endRow: number }>;
}

export interface SummaryRowAggregateExpr {
  kind: "summary-row-aggregate";
  aggregate: "AVERAGE" | "COUNT" | "MAX" | "MIN" | "SUM";
  resolver: FormulaExpr<string, never>;
}

export interface SummaryConditionalStyleCellContext {
  current(): FormulaOperand<string, never>;
}

export interface SummaryConditionalStyleContext {
  cell: SummaryConditionalStyleCellContext;
  fx: FormulaFunctions<string, never>;
}

export interface SummaryConditionalStyleRule {
  condition: FormulaExpr<string, never>;
  style: CellStyle;
}

export interface SummaryConditionalStyleBuilder {
  when(
    condition: (context: SummaryConditionalStyleContext) => FormulaConditionValue<string, never>,
    style: CellStyle,
  ): SummaryConditionalStyleBuilder;
  done(): SummaryConditionalStyleRule[];
}

export type SummaryConditionalStyleInput =
  | SummaryConditionalStyleRule[]
  | ((builder: SummaryConditionalStyleBuilder) => SummaryConditionalStyleBuilder);

export type SummaryResolvedValue = SummaryCellValue | FormulaCell;

export interface SummaryDefinition<T, TAcc = unknown> {
  label?: string;
  init: () => TAcc;
  step: (accumulator: TAcc, row: T, rowIndex: number) => TAcc;
  finalize: (accumulator: TAcc) => SummaryCellValue;
  formula?: SummaryFormulaDefinition;
  spacer?: SummarySpacerDefinition;
  format?: string | ((value: SummaryResolvedValue) => string | undefined);
  style?: CellStyle | ((value: SummaryResolvedValue) => CellStyle | undefined);
  conditionalStyle?: SummaryConditionalStyleInput;
}

export interface SummaryRuntime<TAcc = unknown> {
  accumulator: TAcc;
}

export function createSummaryRuntime<T, TAcc>(
  definition: SummaryDefinition<T, TAcc>,
): SummaryRuntime<TAcc> {
  return {
    accumulator: definition.init(),
  };
}

export function stepSummaryRuntime<T, TAcc>(
  definition: SummaryDefinition<T, TAcc>,
  runtime: SummaryRuntime<TAcc>,
  row: T,
  rowIndex: number,
) {
  runtime.accumulator = definition.step(runtime.accumulator, row, rowIndex);
}

export function finalizeSummaryRuntime<T, TAcc>(
  definition: SummaryDefinition<T, TAcc>,
  runtime: SummaryRuntime<TAcc>,
): SummaryCellValue {
  return definition.finalize(runtime.accumulator);
}

export function createSummaryConditionalStyleBuilder(): SummaryConditionalStyleBuilder {
  const rules: SummaryConditionalStyleRule[] = [];

  return {
    when(condition, style) {
      const context: SummaryConditionalStyleContext = {
        cell: {
          current() {
            return createSummaryConditionalOperand();
          },
        },
        fx: createSummaryConditionalFunctions(),
      };

      const value = condition(context);
      rules.push({
        condition: toSummaryConditionalExpr(value),
        style,
      });

      return this;
    },
    done() {
      return [...rules];
    },
  };
}

export function normalizeSummaryConditionalStyle(
  input?: SummaryConditionalStyleInput,
): SummaryConditionalStyleRule[] | undefined {
  if (!input) {
    return undefined;
  }

  if (Array.isArray(input)) {
    return input.length > 0 ? input : undefined;
  }

  const rules = input(createSummaryConditionalStyleBuilder()).done();
  return rules.length > 0 ? rules : undefined;
}

function createSummaryConditionalOperand(): FormulaOperand<string, never> {
  return createFormulaOperandFromExpr({ kind: "ref", columnId: "__summary_current__" });
}

function createSummaryConditionalFunctions(): FormulaFunctions<string, never> {
  return createFormulaFunctionsContext<string, never>();
}

function toSummaryConditionalExpr(value: FormulaConditionValue<string, never>) {
  if (typeof value === "object" && value !== null && "toExpr" in value) {
    return value.toExpr();
  }

  return value;
}

function createFormulaOperandFromExpr(
  expr: FormulaExpr<string, never>,
): FormulaOperand<string, never> {
  return {
    add(right) {
      return createFormulaOperandFromExpr({
        kind: "binary",
        op: "+",
        left: expr,
        right: toExpr(right),
      });
    },
    sub(right) {
      return createFormulaOperandFromExpr({
        kind: "binary",
        op: "-",
        left: expr,
        right: toExpr(right),
      });
    },
    mul(right) {
      return createFormulaOperandFromExpr({
        kind: "binary",
        op: "*",
        left: expr,
        right: toExpr(right),
      });
    },
    div(right) {
      return createFormulaOperandFromExpr({
        kind: "binary",
        op: "/",
        left: expr,
        right: toExpr(right),
      });
    },
    abs() {
      return createFormulaOperandFromExpr({ kind: "function", name: "ABS", args: [expr] });
    },
    round(decimals = 0) {
      return createFormulaOperandFromExpr({
        kind: "function",
        name: "ROUND",
        args: [expr, { kind: "literal", value: decimals }],
      });
    },
    eq(right) {
      return createFormulaConditionFromExpr({
        kind: "binary",
        op: "=",
        left: expr,
        right: toExpr(right),
      });
    },
    neq(right) {
      return createFormulaConditionFromExpr({
        kind: "binary",
        op: "<>",
        left: expr,
        right: toExpr(right),
      });
    },
    gt(right) {
      return createFormulaConditionFromExpr({
        kind: "binary",
        op: ">",
        left: expr,
        right: toExpr(right),
      });
    },
    gte(right) {
      return createFormulaConditionFromExpr({
        kind: "binary",
        op: ">=",
        left: expr,
        right: toExpr(right),
      });
    },
    lt(right) {
      return createFormulaConditionFromExpr({
        kind: "binary",
        op: "<",
        left: expr,
        right: toExpr(right),
      });
    },
    lte(right) {
      return createFormulaConditionFromExpr({
        kind: "binary",
        op: "<=",
        left: expr,
        right: toExpr(right),
      });
    },
    toExpr() {
      return expr;
    },
  };
}

function createFormulaConditionFromExpr(expr: FormulaExpr<string, never>) {
  return {
    and(right: FormulaConditionValue<string, never>) {
      return createFormulaConditionFromExpr({
        kind: "function",
        name: "AND",
        args: [expr, toSummaryConditionalExpr(right)],
      });
    },
    or(right: FormulaConditionValue<string, never>) {
      return createFormulaConditionFromExpr({
        kind: "function",
        name: "OR",
        args: [expr, toSummaryConditionalExpr(right)],
      });
    },
    not() {
      return createFormulaConditionFromExpr({ kind: "function", name: "NOT", args: [expr] });
    },
    toExpr() {
      return expr;
    },
  };
}
