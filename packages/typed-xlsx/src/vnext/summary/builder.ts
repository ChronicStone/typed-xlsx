import type {
  SummaryDefinition,
  SummaryFormulaBuilderContext,
  SummaryFormulaFunction,
} from "./runtime";
import type { FormulaValue } from "../formula/expr";

export interface SummaryBuilder<T> {
  cell<TAcc>(definition: SummaryDefinition<T, TAcc>): SummaryDefinition<T, TAcc>;
  formula(
    formula:
      | SummaryFormulaFunction
      | ((context: SummaryFormulaBuilderContext) => FormulaValue<string>),
    options?: Pick<SummaryDefinition<T>, "format" | "style">,
  ): SummaryDefinition<T, undefined>;
  label(
    label: string,
    options?: Pick<SummaryDefinition<T>, "format" | "style">,
  ): SummaryDefinition<T, undefined>;
  spacer(): SummaryDefinition<T, undefined>;
  empty(options?: Pick<SummaryDefinition<T>, "format" | "style">): SummaryDefinition<T, undefined>;
}

export type SummaryInput<T> =
  | SummaryDefinition<T, any>
  | SummaryDefinition<T, any>[]
  | ((summary: SummaryBuilder<T>) => SummaryDefinition<T, any>[]);

export function createSummaryBuilder<T>(): SummaryBuilder<T> {
  return {
    cell<TAcc>(definition: SummaryDefinition<T, TAcc>) {
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
        finalize: () => label,
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

export function normalizeSummaryInput<T>(
  summary?: SummaryInput<T>,
): SummaryDefinition<T, any>[] | undefined {
  if (!summary) {
    return undefined;
  }

  if (typeof summary === "function") {
    return summary(createSummaryBuilder<T>());
  }

  return Array.isArray(summary) ? summary : [summary];
}
