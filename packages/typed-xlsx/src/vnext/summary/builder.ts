import type { SummaryDefinition } from "./runtime";

export interface SummaryBuilder<T> {
  cell<TAcc>(definition: SummaryDefinition<T, TAcc>): SummaryDefinition<T, TAcc>;
  label(
    label: string,
    options?: Pick<SummaryDefinition<T>, "format" | "style">,
  ): SummaryDefinition<T, undefined>;
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
    label(label, options) {
      return {
        init: () => undefined,
        step: (accumulator) => accumulator,
        finalize: () => label,
        ...options,
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
