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
  SummaryRowAggregateExpr,
  SummaryResolvedValue,
} from "../../summary/runtime";
import { toCellRef } from "../../ooxml/cells";
import { createFormulaFunctionsContext, func, toExpr, type FormulaExpr } from "../../formula/expr";
import { normalizeSummaryConditionalStyle } from "../../summary/runtime";

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
      conditionalFormatting: buildSummaryConditionalFormatting(
        binding.definition,
        binding.columnId,
        binding.summaryIndex,
      ),
      unstyled: binding.definition.spacer?.kind === "spacer",
    };
  });
}

function buildSummaryConditionalFormatting<T extends object>(
  definition: SummaryDefinition<T>,
  columnId: string,
  summaryIndex: number,
) {
  const rules = normalizeSummaryConditionalStyle(definition.conditionalStyle);
  if (!rules || rules.length === 0) {
    return undefined;
  }

  return [
    {
      ref: `${columnId}#summary-${summaryIndex}`,
      rules: rules.map((rule, index) => ({
        formula: serializeSummaryConditionalExpr(rule.condition),
        priority: index + 1,
        style: rule.style,
      })),
    },
  ];
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
  const resolved = resolve({
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
      rows() {
        const createRowAggregate = (
          aggregate: SummaryRowAggregateExpr["aggregate"],
          resolver: (row: {
            cells(): any;
          }) => import("../../formula/expr").FormulaValue<string, never>,
        ): SummaryRowAggregateExpr => ({
          kind: "summary-row-aggregate",
          aggregate,
          resolver: toExpr(
            resolver({
              cells() {
                return {
                  sum() {
                    return {
                      kind: "collection-aggregate",
                      aggregate: "SUM",
                      target: { kind: "series", columnId: "__summary_column__" },
                    };
                  },
                  average() {
                    return {
                      kind: "collection-aggregate",
                      aggregate: "AVERAGE",
                      target: { kind: "series", columnId: "__summary_column__" },
                    };
                  },
                  count() {
                    return {
                      kind: "collection-aggregate",
                      aggregate: "COUNT",
                      target: { kind: "series", columnId: "__summary_column__" },
                    };
                  },
                  min() {
                    return {
                      kind: "collection-aggregate",
                      aggregate: "MIN",
                      target: { kind: "series", columnId: "__summary_column__" },
                    };
                  },
                  max() {
                    return {
                      kind: "collection-aggregate",
                      aggregate: "MAX",
                      target: { kind: "series", columnId: "__summary_column__" },
                    };
                  },
                };
              },
            }),
          ),
        });

        return {
          sum(resolver) {
            return createRowAggregate("SUM", resolver);
          },
          average(resolver) {
            return createRowAggregate("AVERAGE", resolver);
          },
          count(resolver) {
            return createRowAggregate("COUNT", resolver as never);
          },
          min(resolver) {
            return createRowAggregate("MIN", resolver);
          },
          max(resolver) {
            return createRowAggregate("MAX", resolver);
          },
        };
      },
    },
    fx: createFormulaFunctionsContext<string, never>(),
  });

  const formula =
    typeof resolved === "object" &&
    resolved !== null &&
    "kind" in resolved &&
    resolved.kind === "summary-row-aggregate"
      ? resolved
      : toExpr<string, never>(resolved);

  return {
    kind: "formula",
    formula: serializeSummaryFormulaExpr(formula, context),
  };
}

function columnRangeFunction(
  name: "SUM" | "AVERAGE" | "COUNT" | "MIN" | "MAX",
  context: SummaryFormulaContext,
): FormulaExpr<string, never> {
  if (context.endRow < context.startRow) {
    return {
      kind: "literal",
      value: name === "SUM" || name === "COUNT" ? 0 : "",
    };
  }

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
  expr: FormulaExpr<string, never> | SummaryRowAggregateExpr,
  context: SummaryFormulaContext,
): string {
  if (expr.kind === "summary-row-aggregate") {
    if (!context.logicalRows || context.logicalRows.length === 0) {
      throw new Error("Logical row metadata is required for row-aware summary formulas.");
    }

    const parts = context.logicalRows.map((row) =>
      serializeSummaryRowFormulaExpr(expr.resolver, {
        ...context,
        startRow: row.startRow,
        endRow: row.endRow,
      }),
    );

    if (parts.length === 0) {
      return expr.aggregate === "SUM" || expr.aggregate === "COUNT" ? "0" : '""';
    }

    return `${expr.aggregate}(${parts.join(",")})`;
  }

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

  if (expr.kind === "series" || expr.kind === "collection-aggregate") {
    throw new Error(`Unsupported summary formula expression kind '${expr.kind}'.`);
  }

  if (expr.kind === "function") {
    return `${expr.name}(${expr.args.map((arg) => serializeSummaryFormulaExpr(arg, context)).join(",")})`;
  }

  if (expr.kind === "group") {
    throw new Error("Group formula aggregates are not supported in summary formulas.");
  }

  return `(${serializeSummaryFormulaExpr(expr.left, context)}${expr.op}${serializeSummaryFormulaExpr(expr.right, context)})`;
}

function serializeSummaryRowFormulaExpr(
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

  if (expr.kind === "series") {
    if (expr.columnId !== "__summary_column__") {
      throw new Error(`Unknown summary row series reference '${expr.columnId}'.`);
    }

    if (context.endRow < context.startRow) {
      return '""';
    }

    return `${toCellRef(context.startRow, context.column)}:${toCellRef(context.endRow, context.column)}`;
  }

  if (expr.kind === "collection-aggregate") {
    const range = serializeSummaryRowFormulaExpr(expr.target, context);
    return `${expr.aggregate}(${range})`;
  }

  if (expr.kind === "ref") {
    return toCellRef(context.startRow, context.column);
  }

  if (expr.kind === "function") {
    return `${expr.name}(${expr.args.map((arg) => serializeSummaryRowFormulaExpr(arg, context)).join(",")})`;
  }

  if (expr.kind === "group") {
    throw new Error("Group formula aggregates are not supported in summary formulas.");
  }

  if (expr.kind !== "binary") {
    throw new Error("Unsupported summary row formula expression kind.");
  }

  return `(${serializeSummaryRowFormulaExpr(expr.left, context)}${expr.op}${serializeSummaryRowFormulaExpr(expr.right, context)})`;
}

function serializeSummaryConditionalExpr(expr: FormulaExpr<string, never>): string {
  if (expr.kind === "literal") {
    if (typeof expr.value === "string") {
      return `"${expr.value.replaceAll('"', '""')}"`;
    }

    if (typeof expr.value === "boolean") {
      return expr.value ? "TRUE" : "FALSE";
    }

    return String(expr.value);
  }

  if (expr.kind === "ref") {
    if (expr.columnId !== "__summary_current__") {
      throw new Error(`Unknown summary conditional reference '${expr.columnId}'.`);
    }

    return "A1";
  }

  if (expr.kind === "series" || expr.kind === "collection-aggregate") {
    throw new Error(`Unsupported summary conditional expression kind '${expr.kind}'.`);
  }

  if (expr.kind === "function") {
    return `${expr.name}(${expr.args.map(serializeSummaryConditionalExpr).join(",")})`;
  }

  if (expr.kind === "group") {
    throw new Error("Group references are not supported in summary conditional styles.");
  }

  if (expr.kind !== "binary") {
    throw new Error("Unsupported summary conditional expression kind.");
  }

  return `(${serializeSummaryConditionalExpr(expr.left)}${expr.op}${serializeSummaryConditionalExpr(expr.right)})`;
}
