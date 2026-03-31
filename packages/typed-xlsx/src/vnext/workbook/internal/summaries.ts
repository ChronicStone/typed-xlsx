import type { FormulaCell } from "../../cell-data";
import { createSummaryBindings } from "../../planner/rows";
import { finalizeSummaryRuntime } from "../../summary/runtime";
import type { ResolvedColumn, SummaryBinding } from "../../planner/rows";
import type { PlannedSummaryCell } from "../types";
import type { CellStyle } from "../../styles/types";
import type {
  SummaryDefinition,
  SummaryFormulaContext,
  SummaryFormulaResolver,
  SummaryResolvedValue,
} from "../../summary/runtime";
import { toCellRef } from "../../ooxml/cells";
import { createFormulaFunctionsContext, func, toExpr, type FormulaExpr } from "../../formula/expr";

export function resolveSummaryStyle<T extends object>(
  definition: SummaryDefinition<T>,
  value: SummaryResolvedValue,
  column?: ResolvedColumn<T>,
): CellStyle | undefined {
  const baseStyle =
    typeof definition.style === "function" ? definition.style(value) : definition.style;
  const numberFormat =
    typeof definition.format === "function" ? definition.format(value) : definition.format;

  const inheritedColumnStyle =
    definition.formula && column?.style && typeof column.style !== "function"
      ? column.style
      : undefined;
  const inheritedColumnFormat =
    definition.formula && column?.format && typeof column.format === "string"
      ? column.format
      : undefined;

  const resolvedStyle = baseStyle ?? inheritedColumnStyle;
  const resolvedFormat = numberFormat ?? inheritedColumnFormat;

  if (!resolvedStyle && !resolvedFormat) {
    return undefined;
  }

  return {
    ...(resolvedStyle ?? {}),
    ...(resolvedFormat ? { numFmt: resolvedFormat } : {}),
  };
}

export function groupSummaryRows(summaries: PlannedSummaryCell[]) {
  const grouped = new Map<number, PlannedSummaryCell[]>();

  for (const summary of summaries) {
    const row = grouped.get(summary.summaryIndex);
    if (row) {
      row.push(summary);
    } else {
      grouped.set(summary.summaryIndex, [summary]);
    }
  }

  return [...grouped.entries()].sort(([left], [right]) => left - right).map(([, row]) => row);
}

export function computeSummaries<T extends object>(
  columns: ResolvedColumn<T>[],
  rows: T[],
): PlannedSummaryCell[] {
  const summaryBindings = createSummaryBindings(columns);

  for (const [rowIndex, row] of rows.entries()) {
    for (const binding of summaryBindings) {
      binding.runtime.accumulator = binding.definition.step(
        binding.runtime.accumulator,
        row,
        rowIndex,
      );
    }
  }

  return buildPlannedSummaries(summaryBindings, columns);
}

export function buildPlannedSummaries<T extends object>(
  summaryBindings: Array<SummaryBinding<T>>,
  columns: ResolvedColumn<T>[],
): PlannedSummaryCell[] {
  return summaryBindings.map((binding) => {
    const value = finalizeSummaryRuntime(binding.definition, binding.runtime);
    const column = columns.find((candidate) => candidate.id === binding.columnId);

    return {
      columnId: binding.columnId,
      summaryIndex: binding.summaryIndex,
      value,
      style: resolveSummaryStyle(binding.definition, value, column),
      unstyled: binding.definition.spacer?.kind === "spacer",
    };
  });
}

export function resolveSummaryValue<T>(params: {
  definition: SummaryDefinition<T>;
  value: SummaryResolvedValue;
  formulaContext?: SummaryFormulaContext;
}): SummaryResolvedValue {
  if (!params.definition.formula || !params.formulaContext) {
    return params.value;
  }

  return createSummaryFormulaCell(params.definition.formula.resolve, params.formulaContext);
}

function createSummaryFormulaCell(
  resolve: SummaryFormulaResolver,
  context: SummaryFormulaContext,
): FormulaCell {
  const formula = toExpr<string, never>(
    resolve({
      column: {
        cells() {
          return {
            sum() {
              return columnRangeFunction("SUM", context);
            },
            average() {
              return columnRangeFunction("AVERAGE", context);
            },
            count() {
              return columnRangeFunction("COUNT", context);
            },
            min() {
              return columnRangeFunction("MIN", context);
            },
            max() {
              return columnRangeFunction("MAX", context);
            },
          };
        },
      },
      fx: createFormulaFunctionsContext<string, never>(),
    }),
  );

  return {
    kind: "formula",
    formula: serializeSummaryFormulaExpr(formula, context),
  };
}

function columnRangeFunction(
  name: "SUM" | "AVERAGE" | "COUNT" | "MIN" | "MAX",
  context: SummaryFormulaContext,
): FormulaExpr<string, never> {
  const startRef = toCellRef(context.startRow, context.column);
  const endRef = toCellRef(context.endRow, context.column);

  return func(name, [
    {
      kind: "literal",
      value: `${startRef}:${endRef}`,
    },
  ]);
}

function serializeSummaryFormulaExpr(
  expr: FormulaExpr<string, never>,
  context: SummaryFormulaContext,
): string {
  if (expr.kind === "literal") {
    if (typeof expr.value === "string" && /^[A-Z]+\d+:[A-Z]+\d+$/.test(expr.value)) {
      return expr.value;
    }

    if (typeof expr.value === "string") {
      return `"${expr.value.replaceAll('"', '""')}"`;
    }

    if (typeof expr.value === "boolean") {
      return expr.value ? "TRUE" : "FALSE";
    }

    return String(expr.value);
  }

  if (expr.kind === "ref") {
    return toCellRef(context.startRow, context.column);
  }

  if (expr.kind === "function") {
    return `${expr.name}(${expr.args.map((arg) => serializeSummaryFormulaExpr(arg, context)).join(",")})`;
  }

  if (expr.kind === "group") {
    throw new Error("Group formula aggregates are not supported in summary formulas.");
  }

  return `(${serializeSummaryFormulaExpr(expr.left, context)}${expr.op}${serializeSummaryFormulaExpr(expr.right, context)})`;
}
