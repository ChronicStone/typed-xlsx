import type {
  SummaryDefinition,
  SummaryFormulaBuilderContext,
  SummaryFormulaFunction,
  SummaryRowAggregateExpr,
} from "./runtime";
import type { FormulaValue } from "../formula/expr";
import { resolveLazyText, type LazyText } from "../text";

export interface SummaryBuilder<T, TContext = unknown> {
  cell<TAcc>(
    definition: SummaryDefinition<T, TAcc, TContext>,
  ): SummaryDefinition<T, TAcc, TContext>;
  formula(
    formula:
      | SummaryFormulaFunction
      | ((
          context: SummaryFormulaBuilderContext,
        ) => FormulaValue<string, never> | SummaryRowAggregateExpr),
    options?: Pick<
      SummaryDefinition<T, unknown, TContext>,
      "format" | "style" | "conditionalStyle"
    >,
  ): SummaryDefinition<T, undefined, TContext>;
  label(
    label: LazyText<{ ctx: TContext }>,
    options?: Pick<
      SummaryDefinition<T, unknown, TContext>,
      "format" | "style" | "conditionalStyle"
    >,
  ): SummaryDefinition<T, undefined, TContext>;
  spacer(): SummaryDefinition<T, undefined, TContext>;
  empty(
    options?: Pick<
      SummaryDefinition<T, unknown, TContext>,
      "format" | "style" | "conditionalStyle"
    >,
  ): SummaryDefinition<T, undefined, TContext>;
}

export type SummaryInput<T, TContext = unknown> =
  | SummaryDefinition<T, any, TContext>
  | SummaryDefinition<T, any, TContext>[]
  | ((summary: SummaryBuilder<T, TContext>) => SummaryDefinition<T, any, TContext>[]);

export function createSummaryBuilder<T, TContext = unknown>(): SummaryBuilder<T, TContext> {
  return {
    cell<TAcc>(definition: SummaryDefinition<T, TAcc, TContext>) {
      return definition;
    },
    formula(formula, options) {
      return {
        init: () => undefined,
        step: (accumulator) => accumulator,
        finalize: () => null,
        formula: {
          kind: "formula",
          resolve:
            typeof formula === "function" ? formula : ({ column }) => column.cells()[formula](),
        },
        ...options,
      };
    },
    label(label, options) {
      return {
        init: () => undefined,
        step: (accumulator) => accumulator,
        finalize: (_accumulator, context) => resolveLazyText(label, context),
        ...options,
      };
    },
    spacer() {
      return {
        init: () => undefined,
        step: (accumulator) => accumulator,
        finalize: () => null,
        spacer: {
          kind: "spacer",
        },
      };
    },
    empty(options) {
      return {
        init: () => undefined,
        step: (accumulator) => accumulator,
        finalize: () => null,
        ...options,
      };
    },
  };
}

export function normalizeSummaryInput<T, TContext = unknown>(
  summary?: SummaryInput<T, TContext>,
): SummaryDefinition<T, any, TContext>[] | undefined {
  if (!summary) {
    return undefined;
  }

  if (typeof summary === "function") {
    return summary(createSummaryBuilder<T, TContext>());
  }

  return Array.isArray(summary) ? summary : [summary];
}
