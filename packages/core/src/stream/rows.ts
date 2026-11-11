import {
  resolveColumnCellStyle,
  resolveColumnCellValues,
  resolveColumnImage,
  resolveColumnImageUrl,
  type PlannedImageUrl,
  type PlannedImage,
  type ResolvedColumn,
} from "../planner/rows";
import type { PrimitiveCellValue, SchemaContext } from "../schema/builder";
import type { SharedStringsCollector } from "../ooxml/shared-strings";
import { serializeCell, serializeInlineStringCell } from "../ooxml/cells";
import { xmlElement } from "../ooxml/xml";
import { resolveAccessor } from "../core/accessor";
import { estimateRowHeight, measurePrimitiveValue, resolveColumnWidth } from "../planner/metrics";
import type { CellStyle } from "../styles/types";
import { getCellPrimitiveValue, type CellData } from "../cell-data";
import {
  imageHeightToPoints,
  imageUrlHeightToPoints,
  imageUrlWidthToColumnWidth,
  imageWidthToColumnWidth,
} from "../image/runtime";
import type { FormulaExpr } from "../formula/expr";
import { evaluateFormulaExpr } from "../formula/evaluate";
import type { PlannedHyperlink } from "../planner/rows";
import {
  createFormulaEvaluationContext,
  createReferenceRowsByColumnId,
  createRowSeriesBoundsByColumnId,
  formulaUsesExpandedRefs,
  formulaUsesSeriesAggregate,
  invokeRowTransform,
  resolveCellHyperlink,
  resolveFormulaCell,
  buildFormulaExpr,
  type RowSeriesMode,
} from "../planner/cells";

interface ExpandedRow<T extends object> {
  row: T;
  sourceRowIndex: number;
  valuesByColumn: CellData[][];
  hyperlinksByColumn: Array<Array<PlannedHyperlink | undefined>>;
  imagesByColumn?: Array<Array<PlannedImage | undefined>>;
  imageUrlsByColumn?: Array<Array<PlannedImageUrl | undefined>>;
  height: number;
  physicalRowHeights: number[];
  stylesByRow: Array<Array<CellStyle | undefined>>;
}

const formulaExprCache = new WeakMap<
  object,
  { ctx: SchemaContext | undefined; byColumnId: Map<string, FormulaExpr<string, string>> }
>();

// One stream table keeps one `columns` array and one context for all its rows. The formula callback
// only sees DSL helpers and that context, so its expression is built once per table, not per row.
function getTableFormulaExpr<T extends object>(
  columns: ResolvedColumn<T>[],
  column: ResolvedColumn<T>,
  formula: NonNullable<ResolvedColumn<T>["formula"]>,
  ctx: SchemaContext | undefined,
): FormulaExpr<string, string> {
  let entry = formulaExprCache.get(columns);
  if (!entry || entry.ctx !== ctx) {
    entry = { ctx, byColumnId: new Map() };
    formulaExprCache.set(columns, entry);
  }

  let expr = entry.byColumnId.get(column.id);
  if (!expr) {
    expr = buildFormulaExpr(formula, ctx);
    entry.byColumnId.set(column.id, expr);
  }

  return expr;
}

export function expandCommittedRow<T extends object>(
  columns: ResolvedColumn<T>[],
  row: T,
  sourceRowIndex: number,
  startingPhysicalRowIndex: number,
  formulaMode: "report" | "excel-table" = "report",
  excelTableName?: string,
  ctx?: SchemaContext,
) {
  let height = 1;
  const resolvedCellsByColumn = columns.map((column) => {
    const rawValue = column.formula
      ? undefined
      : column.accessor
        ? resolveAccessor(row, column.accessor, ctx)
        : undefined;
    const transformed = column.transform
      ? invokeRowTransform({
          row,
          rowIndex: sourceRowIndex,
          transform: column.transform,
          value: rawValue,
          ctx,
        })
      : ((rawValue ?? column.defaultValue ?? null) as PrimitiveCellValue | PrimitiveCellValue[]);
    const image = resolveColumnImage({
      column,
      row,
      rowIndex: sourceRowIndex,
      subRowIndex: 0,
      sourceValue: rawValue,
      ctx,
    });
    const imageUrl = resolveColumnImageUrl({
      column,
      row,
      rowIndex: sourceRowIndex,
      subRowIndex: 0,
      sourceValue: rawValue,
      ctx,
    });
    const values = resolveColumnCellValues({
      column,
      imageUrl,
      transformed,
    });
    height = Math.max(height, values.length);
    return { image, imageUrl, values };
  });
  const seriesModeByColumnId = new Map<string, RowSeriesMode>();
  const valuesByColumnId = new Map<string, CellData[]>();
  const valuesByColumn = columns.map((column, columnIndex) => {
    if (!column.formula) {
      const values = resolvedCellsByColumn[columnIndex]!.values;
      seriesModeByColumnId.set(
        column.id,
        values.length > 1 || column.sparkline ? "expanded" : "scalar",
      );
      valuesByColumnId.set(column.id, values);
      return values;
    }

    const expr = getTableFormulaExpr(columns, column, column.formula, ctx);
    const inferredSeriesMode: RowSeriesMode = formulaUsesSeriesAggregate(expr)
      ? "scalar"
      : height > 1 && formulaUsesExpandedRefs(expr, seriesModeByColumnId, columns)
        ? "expanded"
        : "scalar";
    const seriesMode: RowSeriesMode =
      column.expansion === "expand"
        ? "expanded"
        : column.expansion === "single"
          ? "scalar"
          : inferredSeriesMode;
    seriesModeByColumnId.set(column.id, seriesMode);
    const rowSeriesBoundsByColumnId = createRowSeriesBoundsByColumnId(
      seriesModeByColumnId,
      startingPhysicalRowIndex,
      height,
    );

    const values =
      seriesMode === "expanded"
        ? Array.from({ length: height }, (_, subRowIndex) =>
            resolveFormulaCell({
              column,
              columns,
              expr,
              formulaMode,
              tableName: excelTableName,
              ctx,
              rowIndex: startingPhysicalRowIndex + subRowIndex,
              referenceRowsByColumnId: createReferenceRowsByColumnId(
                seriesModeByColumnId,
                startingPhysicalRowIndex,
                subRowIndex,
              ),
              rowSeriesBoundsByColumnId,
              value:
                formulaMode === "excel-table"
                  ? evaluateFormulaExpr(
                      expr,
                      createFormulaEvaluationContext({
                        columns,
                        valuesByColumnId,
                        seriesModeByColumnId,
                        subRowIndex,
                      }),
                    )
                  : undefined,
            }),
          )
        : [
            resolveFormulaCell({
              column,
              columns,
              expr,
              formulaMode,
              tableName: excelTableName,
              ctx,
              rowIndex: startingPhysicalRowIndex,
              referenceRowsByColumnId: createReferenceRowsByColumnId(
                seriesModeByColumnId,
                startingPhysicalRowIndex,
                0,
              ),
              rowSeriesBoundsByColumnId,
              value:
                formulaMode === "excel-table"
                  ? evaluateFormulaExpr(
                      expr,
                      createFormulaEvaluationContext({
                        columns,
                        valuesByColumnId,
                        seriesModeByColumnId,
                        subRowIndex: 0,
                      }),
                    )
                  : undefined,
            }),
          ];
    valuesByColumnId.set(column.id, values);
    return values;
  });
  const hyperlinksByColumn = columns.map((column) =>
    Array.from({ length: height }, (_, subRowIndex) =>
      resolveCellHyperlink({ column, row, rowIndex: sourceRowIndex, subRowIndex, ctx }),
    ),
  );
  const imagesByColumn = columns.map((_column, columnIndex) =>
    Array.from({ length: height }, (_, subRowIndex) =>
      subRowIndex === 0 ? resolvedCellsByColumn[columnIndex]!.image : undefined,
    ),
  );
  const imageUrlsByColumn = columns.map((_column, columnIndex) =>
    Array.from({ length: height }, (_, subRowIndex) =>
      subRowIndex === 0 ? resolvedCellsByColumn[columnIndex]!.imageUrl : undefined,
    ),
  );
  const stylesByRow = Array.from({ length: height }, (_, subRowIndex) =>
    columns.map((column) =>
      resolveColumnCellStyle({ column, ctx, row, rowIndex: sourceRowIndex, subRowIndex }),
    ),
  );
  const physicalRowHeights = Array.from({ length: height }, (_, subRowIndex) => {
    const rowValues = valuesByColumn.map((values) =>
      getCellPrimitiveValue(values[subRowIndex] ?? null),
    );
    const imageHeight = Math.max(
      ...imagesByColumn.map((images) =>
        images[subRowIndex] ? imageHeightToPoints(images[subRowIndex]!) : 0,
      ),
      ...imageUrlsByColumn.map((images) =>
        images[subRowIndex] ? imageUrlHeightToPoints(images[subRowIndex]!) : 0,
      ),
      0,
    );
    return Math.max(estimateRowHeight(rowValues, stylesByRow[subRowIndex]!), imageHeight);
  });

  return {
    row,
    sourceRowIndex,
    valuesByColumn,
    hyperlinksByColumn,
    imagesByColumn,
    imageUrlsByColumn,
    height,
    physicalRowHeights,
    stylesByRow,
  } satisfies ExpandedRow<T>;
}

export function appendExpandedRowXml<T extends object>(params: {
  columns: ResolvedColumn<T>[];
  expandedRow: ExpandedRow<T>;
  startingRowIndex: number;
  columnOffset?: number;
  sharedStrings: SharedStringsCollector;
  stringMode?: "inline" | "shared";
  styleIndexesByRow?: number[][];
  rowHeight?: number;
}) {
  const fragments: string[] = [];

  for (let subRowIndex = 0; subRowIndex < params.expandedRow.height; subRowIndex += 1) {
    const physicalRowIndex = params.startingRowIndex + subRowIndex;
    const cells = params.columns.map((column, columnIndex) =>
      serializeExpandedCell(
        physicalRowIndex,
        (params.columnOffset ?? 0) + columnIndex,
        params.expandedRow.valuesByColumn[columnIndex]?.[subRowIndex] ?? null,
        params.expandedRow.hyperlinksByColumn[columnIndex]?.[subRowIndex],
        params.sharedStrings,
        params.stringMode ?? "shared",
        params.styleIndexesByRow?.[subRowIndex]?.[columnIndex],
      ),
    );

    const rowHeight = Math.max(
      params.expandedRow.physicalRowHeights[subRowIndex] ?? 0,
      params.rowHeight ?? 0,
    );
    fragments.push(
      xmlElement(
        "row",
        {
          r: physicalRowIndex + 1,
          ht: rowHeight,
          customHeight: 1,
        },
        cells,
      ),
    );
  }

  return fragments.join("");
}

function serializeExpandedCell(
  row: number,
  column: number,
  value: CellData,
  hyperlink: PlannedHyperlink | undefined,
  sharedStrings: SharedStringsCollector,
  stringMode: "inline" | "shared",
  styleIndex?: number,
) {
  if (typeof value === "string" && stringMode === "inline") {
    return serializeInlineStringCell(row, column, value, styleIndex, hyperlink);
  }

  return serializeCell(row, column, value, sharedStrings, styleIndex, hyperlink);
}

export function updateColumnWidthStats<T extends object>(params: {
  columns: ResolvedColumn<T>[];
  expandedRow: ExpandedRow<T>;
  widths: Map<string, number>;
}) {
  params.columns.forEach((column, columnIndex) => {
    if (typeof column.width === "number") {
      params.widths.set(column.id, column.width);
      return;
    }
    const measured = Math.max(
      ...(params.expandedRow.valuesByColumn[columnIndex] ?? []).map((value) =>
        measurePrimitiveValue(getCellPrimitiveValue(value)),
      ),
      ...(params.expandedRow.imagesByColumn?.[columnIndex] ?? []).map((image) =>
        image ? imageWidthToColumnWidth(image) : 0,
      ),
      ...(params.expandedRow.imageUrlsByColumn?.[columnIndex] ?? []).map((image) =>
        image ? imageUrlWidthToColumnWidth(image) : 0,
      ),
      0,
    );
    const current = params.widths.get(column.id) ?? 0;
    params.widths.set(
      column.id,
      resolveColumnWidth({
        column,
        currentWidth: current,
        measuredWidth: measured,
      }),
    );
  });
}
