import { resolveAccessor } from "../core/accessor";
import type {
  ColumnDefinition,
  DynamicDefinition,
  GroupDefinition,
  PrimitiveCellValue,
  ResolvedExcelTableTotalsRowDefinition,
  SchemaContext,
  SchemaDefinition,
  SchemaNode,
} from "../schema/builder";
import { ExcelTableSchemaBuilder, SchemaBuilder } from "../schema/builder";
import type { SummaryDefinition, SummaryRuntime } from "../summary/runtime";
import type { ResolvedValidationRule } from "../validation/types";
import {
  createSummaryRuntime,
  finalizeSummaryRuntime,
  stepSummaryRuntime,
} from "../summary/runtime";
import { normalizeSummaryInput } from "../summary/builder";
import { estimateRowHeight, measurePrimitiveValue, resolveColumnWidth } from "./metrics";
import type { CellStyle } from "../styles/types";
import { getCellPrimitiveValue, type CellData } from "../cell-data";
import { getValueAtPath } from "../core/path";
import {
  imageHeightToPoints,
  imageUrlHeightToPoints,
  imageUrlWidthToColumnWidth,
  imageWidthToColumnWidth,
  resolveImageUrlValue,
  resolveImageValue,
  writeImageFormula,
} from "../image/runtime";
import type {
  ImageColumnOptions,
  ImageSourceValue,
  ImageUrlSourceValue,
  ResolvedImageUrlValue,
  ResolvedImageValue,
} from "../image/types";
import {
  createFormulaRefs,
  createFormulaFunctionsContext,
  createFormulaRowContext,
  toExpr,
  type FormulaExpr,
} from "../formula/expr";
import { evaluateFormulaExpr, type FormulaEvaluationContext } from "../formula/evaluate";
import {
  escapeStructuredReferenceHeader,
  serializeExcelTableCurrentRowRef,
} from "../formula/structured-reference";
import { toCellRef } from "../ooxml/cells";
import { resolveLazyText } from "../text";

export interface PlannedHyperlink {
  target: string;
  tooltip?: string;
  style?: CellStyle;
}

export interface PlannedImage extends ResolvedImageValue {}
export interface PlannedImageUrl extends ResolvedImageUrlValue {}

export interface ResolvedColumn<T extends object> extends Omit<
  ColumnDefinition<T, any, any, any, any, any, any>,
  "header" | "summary" | "totalsRow" | "validation"
> {
  headerLabel: string;
  groupId?: string;
  groupPath: Array<{ id: string; headerLabel: string }>;
  dynamicPath: string[];
  scopeIds: string[];
  summary?: SummaryDefinition<T, any>[];
  totalsRow?: ResolvedExcelTableTotalsRowDefinition;
  validation?: ResolvedValidationRule<string, string>;
}

type RowSeriesMode = "scalar" | "expanded";

function resolveFormulaScopeColumns<T extends object>(
  columns: ResolvedColumn<T>[],
  scopeId: string,
) {
  return columns.filter((column) => column.scopeIds.includes(scopeId));
}

function serializeFormulaScopeExpr<T extends object>(params: {
  aggregate: "AVERAGE" | "COUNT" | "MAX" | "MIN" | "SUM";
  columns: ResolvedColumn<T>[];
  scopeId: string;
  mode: "report" | "excel-table";
  tableName?: string;
  rowIndex: number;
  referenceRowsByColumnId?: Map<string, number>;
  rowSeriesBoundsByColumnId?: Map<string, { startRow: number; endRow: number }>;
}) {
  const scopeColumns = resolveFormulaScopeColumns(params.columns, params.scopeId);
  if (scopeColumns.length === 0) {
    throw new Error(`Unknown or empty formula scope reference '${params.scopeId}'.`);
  }

  if (params.mode === "excel-table") {
    const refs = scopeColumns.map((column) =>
      params.tableName
        ? serializeExcelTableCurrentRowRef(params.tableName, column.headerLabel)
        : `[@[${escapeStructuredReferenceHeader(column.headerLabel)}]]`,
    );
    return `${params.aggregate}(${refs.join(",")})`;
  }

  const cellRefs = scopeColumns.map((column) => {
    const columnIndex = params.columns.findIndex((candidate) => candidate.id === column.id);
    if (columnIndex < 0) {
      throw new Error(`Unknown formula column reference '${column.id}'.`);
    }
    const resolvedRowIndex = params.referenceRowsByColumnId?.get(column.id) ?? params.rowIndex;
    return toCellRef(resolvedRowIndex + 1, columnIndex);
  });

  return `${params.aggregate}(${cellRefs.join(",")})`;
}

export interface PlannedCell<T extends object> {
  columnId: string;
  value: CellData;
  hyperlink?: PlannedHyperlink;
  image?: PlannedImage;
  sourceRow: T;
  sourceRowIndex: number;
  subRowIndex: number;
}

export interface PlannedPhysicalRow<T extends object> {
  logicalRowIndex: number;
  physicalRowIndex: number;
  logicalRowStartIndex: number;
  logicalRowHeight: number;
  cells: PlannedCell<T>[];
  height: number;
}

export interface PlannedMergeRange {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

export interface PlannerStats {
  columnWidths: Map<string, number>;
  rowHeights: Map<number, number>;
}

export interface PlannerResult<T extends object> {
  columns: ResolvedColumn<T>[];
  rows: PlannedPhysicalRow<T>[];
  merges: PlannedMergeRange[];
  stats: PlannerStats;
}

interface ResolvedColumnsPlannerInput<T extends object> {
  kind: "report" | "excel-table";
  columns: ResolvedColumn<T>[];
  excelTableName?: string;
  context?: SchemaContext;
}

interface SummaryBinding<T extends object> {
  columnId: string;
  summaryIndex: number;
  definition: SummaryDefinition<T>;
  runtime: SummaryRuntime;
}

export type { SummaryBinding };

function defaultColumnHeader(id: string) {
  return (
    id.charAt(0).toUpperCase() +
    id
      .split(/(?=[A-Z])/)
      .join(" ")
      .toLowerCase()
      .slice(1)
      .replaceAll("_", " ")
  );
}

function toCellDataValues(value: unknown): CellData[] {
  return Array.isArray(value) ? (value as CellData[]) : [value as CellData];
}

function invokeRowTransform<T extends object>(params: {
  transform: NonNullable<ResolvedColumn<T>["transform"]>;
  value: unknown;
  row: T;
  rowIndex: number;
  ctx?: SchemaContext;
}) {
  if (params.transform.length >= 2) {
    return (
      params.transform as (value: unknown, row: T, rowIndex: number) => CellData | CellData[]
    )(params.value, params.row, params.rowIndex);
  }

  return (params.transform as (context: unknown) => CellData | CellData[])({
    ...params.row,
    ctx: params.ctx,
    row: params.row,
    rowIndex: params.rowIndex,
    value: params.value,
  });
}

function invokeRowStyle<T extends object>(params: {
  style: Extract<NonNullable<ResolvedColumn<T>["style"]>, (...args: any[]) => unknown>;
  row: T;
  rowIndex: number;
  subRowIndex: number;
  ctx?: SchemaContext;
}) {
  if (params.style.length >= 3) {
    return (
      params.style as (row: T, rowIndex: number, subRowIndex: number) => CellStyle | undefined
    )(params.row, params.rowIndex, params.subRowIndex);
  }

  return (params.style as (context: unknown) => CellStyle | undefined)({
    ...params.row,
    ctx: params.ctx,
    row: params.row,
    rowIndex: params.rowIndex,
    subRowIndex: params.subRowIndex,
  });
}

function invokeRowFormat<T extends object>(params: {
  format: Extract<NonNullable<ResolvedColumn<T>["format"]>, (...args: any[]) => unknown>;
  row: T;
  rowIndex: number;
  subRowIndex: number;
  ctx?: SchemaContext;
}) {
  if (params.format.length >= 3) {
    return (params.format as (row: T, rowIndex: number, subRowIndex: number) => string | undefined)(
      params.row,
      params.rowIndex,
      params.subRowIndex,
    );
  }

  return (params.format as (context: unknown) => string | undefined)({
    ...params.row,
    ctx: params.ctx,
    row: params.row,
    rowIndex: params.rowIndex,
    subRowIndex: params.subRowIndex,
  });
}

export function resolveColumnCellStyle<T extends object>(params: {
  column: ResolvedColumn<T>;
  row: T;
  rowIndex: number;
  subRowIndex: number;
  ctx?: SchemaContext;
}): CellStyle | undefined {
  const baseStyle =
    typeof params.column.style === "function"
      ? invokeRowStyle({
          ctx: params.ctx,
          row: params.row,
          rowIndex: params.rowIndex,
          style: params.column.style,
          subRowIndex: params.subRowIndex,
        })
      : params.column.style;
  const numberFormat =
    typeof params.column.format === "function"
      ? invokeRowFormat({
          ctx: params.ctx,
          format: params.column.format,
          row: params.row,
          rowIndex: params.rowIndex,
          subRowIndex: params.subRowIndex,
        })
      : params.column.format;

  if (!baseStyle && !numberFormat) {
    return undefined;
  }

  return {
    ...(baseStyle ?? {}),
    ...(numberFormat ? { numFmt: numberFormat } : {}),
  };
}

function invokeRowHyperlink<T extends object>(params: {
  hyperlink: Extract<NonNullable<ResolvedColumn<T>["hyperlink"]>, (...args: any[]) => unknown>;
  row: T;
  rowIndex: number;
  subRowIndex: number;
  ctx?: SchemaContext;
}) {
  if (params.hyperlink.length >= 2) {
    return (
      params.hyperlink as (
        row: T,
        rowIndex: number,
        subRowIndex: number,
      ) => string | PlannedHyperlink | null | undefined
    )(params.row, params.rowIndex, params.subRowIndex);
  }

  return (params.hyperlink as (context: unknown) => string | PlannedHyperlink | null | undefined)({
    ...params.row,
    ctx: params.ctx,
    row: params.row,
    rowIndex: params.rowIndex,
    subRowIndex: params.subRowIndex,
  });
}

function resolveCellHyperlink<T extends object>(params: {
  column: ResolvedColumn<T>;
  row: T;
  rowIndex: number;
  subRowIndex: number;
  ctx?: SchemaContext;
}): PlannedHyperlink | undefined {
  const hyperlink = params.column.hyperlink;
  if (!hyperlink) {
    return undefined;
  }

  const resolved =
    typeof hyperlink === "function"
      ? invokeRowHyperlink({
          ctx: params.ctx,
          hyperlink,
          row: params.row,
          rowIndex: params.rowIndex,
          subRowIndex: params.subRowIndex,
        })
      : hyperlink;

  if (!resolved) {
    return undefined;
  }

  if (typeof resolved === "string") {
    return { target: resolved };
  }

  return {
    ...resolved,
    tooltip: resolveLazyText(resolved.tooltip),
  };
}

function invokeRowImageValue<T extends object>(params: {
  value: (context: unknown) => unknown;
  row: T;
  rowIndex: number;
  subRowIndex: number;
  ctx?: SchemaContext;
}) {
  return (params.value as (context: unknown) => unknown)({
    ...params.row,
    ctx: params.ctx,
    row: params.row,
    rowIndex: params.rowIndex,
    subRowIndex: params.subRowIndex,
  });
}

function resolveImageOptionValue<T extends object, TValue>(params: {
  value: TValue | ((context: any) => TValue | undefined) | undefined;
  row: T;
  rowIndex: number;
  subRowIndex: number;
  ctx?: SchemaContext;
}) {
  if (typeof params.value !== "function") {
    return params.value;
  }

  return invokeRowImageValue({
    ctx: params.ctx,
    row: params.row,
    rowIndex: params.rowIndex,
    subRowIndex: params.subRowIndex,
    value: params.value as (context: unknown) => unknown,
  }) as TValue | undefined;
}

function resolveImageAlt<T extends object>(params: {
  column: ResolvedColumn<T>;
  row: T;
  rowIndex: number;
  subRowIndex: number;
  ctx?: SchemaContext;
}) {
  const alt = params.column.image?.alt;
  if (!alt) {
    return undefined;
  }

  if (typeof alt === "function") {
    return resolveImageOptionValue({
      ctx: params.ctx,
      row: params.row,
      rowIndex: params.rowIndex,
      subRowIndex: params.subRowIndex,
      value: alt,
    });
  }

  const pathValue = getValueAtPath(params.row, alt);
  return typeof pathValue === "string" ? pathValue : alt;
}

function resolveImageSourceValue<T extends object>(params: {
  column: ResolvedColumn<T>;
  row: T;
  sourceValue?: unknown;
  ctx?: SchemaContext;
}) {
  if (params.sourceValue !== undefined) {
    return params.sourceValue;
  }

  if (!params.column.accessor) {
    return undefined;
  }

  return resolveAccessor(params.row, params.column.accessor as any, params.ctx);
}

export function resolveColumnImage<T extends object>(params: {
  column: ResolvedColumn<T>;
  row: T;
  rowIndex: number;
  subRowIndex: number;
  sourceValue?: unknown;
  ctx?: SchemaContext;
}): PlannedImage | undefined {
  if (!params.column.image || params.column.image.source === "url") {
    return undefined;
  }

  const sourceValue = resolveImageSourceValue(params);
  const options: ImageColumnOptions = {
    mediaType: resolveImageOptionValue({
      ctx: params.ctx,
      row: params.row,
      rowIndex: params.rowIndex,
      subRowIndex: params.subRowIndex,
      value: params.column.image.mediaType,
    }),
    alt: resolveImageAlt(params),
    size: params.column.image.size,
    fit: params.column.image.fit,
    padding: params.column.image.padding,
  };

  return resolveImageValue(sourceValue as ImageSourceValue, options);
}

export function resolveColumnImageUrl<T extends object>(params: {
  column: ResolvedColumn<T>;
  row: T;
  rowIndex: number;
  subRowIndex: number;
  sourceValue?: unknown;
  ctx?: SchemaContext;
}): PlannedImageUrl | undefined {
  if (!params.column.image || params.column.image.source !== "url") {
    return undefined;
  }

  const sourceValue = resolveImageSourceValue(params);

  return resolveImageUrlValue(sourceValue as ImageUrlSourceValue, {
    alt: resolveImageAlt(params),
    size: params.column.image.size,
    fit: params.column.image.fit,
  });
}

export function resolveColumnCellValues<T extends object>(params: {
  column: ResolvedColumn<T>;
  imageUrl?: PlannedImageUrl;
  transformed: unknown;
}): CellData[] {
  if (params.column.formula) {
    return [];
  }

  if (params.imageUrl) {
    return [{ kind: "formula", formula: writeImageFormula(params.imageUrl) }];
  }

  if (params.column.image) {
    return [null];
  }

  return toCellDataValues(params.transformed);
}

function resolveFormulaCell<T extends object>(params: {
  column: ResolvedColumn<T>;
  columns: ResolvedColumn<T>[];
  expr?: FormulaExpr<string, string>;
  formulaMode: "report" | "excel-table";
  tableName?: string;
  rowIndex: number;
  ctx?: SchemaContext;
  referenceRowsByColumnId?: Map<string, number>;
  rowSeriesBoundsByColumnId?: Map<string, { startRow: number; endRow: number }>;
  value?: PrimitiveCellValue;
}) {
  if (!params.column.formula) {
    return undefined;
  }

  const expr =
    params.expr ??
    toExpr(
      params.column.formula({
        row: createFormulaRowContext<any, any>(),
        refs: createFormulaRefs<any, any, any>(),
        fx: createFormulaFunctionsContext<any, any>(),
        ctx: params.ctx as never,
      } as Parameters<NonNullable<typeof params.column.formula>>[0]),
    );

  return {
    kind: "formula" as const,
    formula: serializeFormulaExpr(
      expr,
      params.columns,
      params.rowIndex,
      params.formulaMode,
      params.tableName,
      params.referenceRowsByColumnId,
      params.rowSeriesBoundsByColumnId,
    ),
    ...(params.value !== undefined ? { value: params.value } : {}),
  };
}

function serializeFormulaExpr<T extends object>(
  expr: FormulaExpr<string, string>,
  columns: ResolvedColumn<T>[],
  rowIndex: number,
  mode: "report" | "excel-table",
  tableName?: string,
  referenceRowsByColumnId?: Map<string, number>,
  rowSeriesBoundsByColumnId?: Map<string, { startRow: number; endRow: number }>,
): string {
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
    const columnIndex = columns.findIndex((column) => column.id === expr.columnId);
    if (columnIndex < 0) {
      throw new Error(`Unknown formula column reference '${expr.columnId}'.`);
    }

    if (mode === "excel-table") {
      const headerLabel = columns[columnIndex]?.headerLabel;
      if (!headerLabel) {
        throw new Error(`Unknown formula column reference '${expr.columnId}'.`);
      }

      return tableName
        ? serializeExcelTableCurrentRowRef(tableName, headerLabel)
        : `[@[${escapeStructuredReferenceHeader(headerLabel)}]]`;
    }

    const resolvedRowIndex = referenceRowsByColumnId?.get(expr.columnId) ?? rowIndex;
    return toCellRef(resolvedRowIndex + 1, columnIndex);
  }

  if (expr.kind === "series") {
    throw new Error(`Series reference '${expr.columnId}' must be aggregated before serialization.`);
  }

  if (expr.kind === "collection-aggregate") {
    const columnIndex = columns.findIndex((column) => column.id === expr.target.columnId);
    if (columnIndex < 0) {
      throw new Error(`Unknown formula column reference '${expr.target.columnId}'.`);
    }

    if (mode === "excel-table") {
      throw new Error("Series aggregates are not supported in native Excel table formulas.");
    }

    const bounds = rowSeriesBoundsByColumnId?.get(expr.target.columnId);
    if (!bounds) {
      throw new Error(
        `Missing series bounds for formula column reference '${expr.target.columnId}'.`,
      );
    }

    const startRef = toCellRef(bounds.startRow + 1, columnIndex);
    const endRef = toCellRef(bounds.endRow + 1, columnIndex);
    return `${expr.aggregate}(${startRef}:${endRef})`;
  }

  if (expr.kind === "scope-aggregate") {
    return serializeFormulaScopeExpr({
      aggregate: expr.aggregate,
      columns,
      scopeId: expr.scopeId,
      mode,
      tableName,
      rowIndex,
      referenceRowsByColumnId,
      rowSeriesBoundsByColumnId,
    });
  }

  if (expr.kind === "function") {
    return `${expr.name}(${expr.args
      .map((arg) =>
        serializeFormulaExpr(
          arg,
          columns,
          rowIndex,
          mode,
          tableName,
          referenceRowsByColumnId,
          rowSeriesBoundsByColumnId,
        ),
      )
      .join(",")})`;
  }

  return `(${serializeFormulaExpr(expr.left, columns, rowIndex, mode, tableName, referenceRowsByColumnId, rowSeriesBoundsByColumnId)}${expr.op}${serializeFormulaExpr(expr.right, columns, rowIndex, mode, tableName, referenceRowsByColumnId, rowSeriesBoundsByColumnId)})`;
}

function createRowSeriesBoundsByColumnId(
  seriesModeByColumnId: Map<string, RowSeriesMode>,
  rowStartIndex: number,
  rowHeight: number,
) {
  return new Map(
    [...seriesModeByColumnId.entries()].map(([columnId, mode]) => [
      columnId,
      {
        startRow: rowStartIndex,
        endRow: rowStartIndex + (mode === "expanded" ? rowHeight - 1 : 0),
      },
    ]),
  );
}

function createReferenceRowsByColumnId(
  seriesModeByColumnId: Map<string, RowSeriesMode>,
  rowStartIndex: number,
  subRowIndex: number,
) {
  return new Map(
    [...seriesModeByColumnId.entries()].map(([columnId, mode]) => [
      columnId,
      mode === "expanded" ? rowStartIndex + subRowIndex : rowStartIndex,
    ]),
  );
}

function createFormulaEvaluationContext<T extends object>(params: {
  columns: ResolvedColumn<T>[];
  valuesByColumnId: Map<string, CellData[]>;
  seriesModeByColumnId: Map<string, RowSeriesMode>;
  subRowIndex: number;
}): FormulaEvaluationContext {
  const getColumnValue = (columnId: string): PrimitiveCellValue => {
    const values = params.valuesByColumnId.get(columnId);
    if (!values) {
      return undefined;
    }

    const index = params.seriesModeByColumnId.get(columnId) === "expanded" ? params.subRowIndex : 0;
    return getCellPrimitiveValue(values[index] ?? null);
  };

  return {
    getColumnValue,
    getColumnSeries(columnId) {
      return (params.valuesByColumnId.get(columnId) ?? []).map((value) =>
        getCellPrimitiveValue(value),
      );
    },
    getScopeValues(scopeId) {
      return resolveFormulaScopeColumns(params.columns, scopeId).map((column) =>
        getColumnValue(column.id),
      );
    },
  };
}

function formulaUsesExpandedRefs<T extends object>(
  expr: FormulaExpr<string, string>,
  seriesModeByColumnId: Map<string, RowSeriesMode>,
  columns: ResolvedColumn<T>[],
): boolean {
  if (expr.kind === "literal") {
    return false;
  }

  if (expr.kind === "ref") {
    return seriesModeByColumnId.get(expr.columnId) === "expanded";
  }

  if (expr.kind === "series") {
    return true;
  }

  if (expr.kind === "collection-aggregate") {
    return seriesModeByColumnId.get(expr.target.columnId) === "expanded";
  }

  if (expr.kind === "scope-aggregate") {
    return resolveFormulaScopeColumns(columns, expr.scopeId).some(
      (column) => seriesModeByColumnId.get(column.id) === "expanded",
    );
  }

  if (expr.kind === "function") {
    return expr.args.some((arg) => formulaUsesExpandedRefs(arg, seriesModeByColumnId, columns));
  }

  if (expr.kind !== "binary") {
    return false;
  }

  return (
    formulaUsesExpandedRefs(expr.left, seriesModeByColumnId, columns) ||
    formulaUsesExpandedRefs(expr.right, seriesModeByColumnId, columns)
  );
}

function formulaUsesSeriesAggregate(expr: FormulaExpr<string, string>): boolean {
  if (expr.kind === "literal" || expr.kind === "ref" || expr.kind === "scope-aggregate") {
    return false;
  }

  if (expr.kind === "series" || expr.kind === "collection-aggregate") {
    return true;
  }

  if (expr.kind === "function") {
    return expr.args.some((arg) => formulaUsesSeriesAggregate(arg));
  }

  if (expr.kind !== "binary") {
    return false;
  }

  return formulaUsesSeriesAggregate(expr.left) || formulaUsesSeriesAggregate(expr.right);
}

function isColumnNode<T extends object>(
  node: SchemaNode<T, any>,
): node is ColumnDefinition<T, any, any, any, any, any, any> {
  return (node.kind ?? "column") === "column";
}

function isGroupNode<T extends object>(
  node: SchemaNode<T, any>,
): node is GroupDefinition<T, string, any> {
  return node.kind === "group";
}

function isDynamicNode<T extends object>(
  node: SchemaNode<T, any>,
): node is DynamicDefinition<T, string, any> {
  return node.kind === "dynamic";
}

export function resolveColumns<T extends object>(
  schema: SchemaDefinition<T, any, any, any, any, any>,
  context?: SchemaContext,
  selection?: { include?: readonly string[]; exclude?: readonly string[] },
): ResolvedColumn<T>[] {
  const columns: ResolvedColumn<T>[] = [];
  const include = selection?.include ? new Set<string>(selection.include) : null;
  const exclude = selection?.exclude ? new Set<string>(selection.exclude) : null;

  function subtreeMatchesInclude(nodes: SchemaNode<T, any>[]): boolean {
    if (!include) {
      return true;
    }

    for (const node of nodes) {
      if (include.has(node.id)) {
        return true;
      }

      if (isGroupNode(node) && subtreeMatchesInclude(node.children)) {
        return true;
      }
    }

    return false;
  }

  function visitNodes(
    nodes: SchemaNode<T, any>[],
    groupPath: Array<{ id: string; headerLabel: string }>,
    dynamicPath: string[],
  ) {
    for (const node of nodes) {
      if (exclude?.has(node.id)) {
        continue;
      }
      if (node.condition && !node.condition({ ctx: context as never })) {
        continue;
      }

      if (isColumnNode(node)) {
        if (include && !include.has(node.id)) {
          continue;
        }

        columns.push({
          ...node,
          dynamicPath: [...dynamicPath],
          groupId: groupPath[groupPath.length - 1]?.id,
          groupPath: [...groupPath],
          headerLabel: node.header ?? defaultColumnHeader(node.id),
          scopeIds: [...groupPath.map((group) => group.id), ...dynamicPath],
        } as ResolvedColumn<T>);
        continue;
      }

      if (isGroupNode(node)) {
        if (include && !include.has(node.id) && !subtreeMatchesInclude(node.children)) {
          continue;
        }

        visitNodes(
          node.children,
          [
            ...groupPath,
            { id: node.id, headerLabel: String(node.header ?? defaultColumnHeader(node.id)) },
          ],
          dynamicPath,
        );
        continue;
      }

      if (isDynamicNode(node)) {
        if (include && !include.has(node.id)) {
          continue;
        }

        const dynamicBuilder =
          schema.kind === "excel-table"
            ? ExcelTableSchemaBuilder.create<T, any>()
            : SchemaBuilder.create<T, any>();
        node.build(dynamicBuilder as never, { ctx: context as never });
        visitNodes(dynamicBuilder.build().columns as SchemaNode<T, any>[], groupPath, [
          ...dynamicPath,
          node.id,
        ]);
      }
    }
  }

  visitNodes(schema.columns as SchemaNode<T, any>[], [], []);
  return columns;
}

export function createPlannerStats(columns: ResolvedColumn<any>[]): PlannerStats {
  const columnWidths = new Map<string, number>();

  for (const column of columns) {
    const headerWidth = measurePrimitiveValue(column.headerLabel);
    columnWidths.set(column.id, column.width ?? headerWidth);
  }

  return {
    columnWidths,
    rowHeights: new Map(),
  };
}

export function createSummaryBindings<T extends object>(
  columns: ResolvedColumn<T>[],
): Array<SummaryBinding<T>> {
  const bindings: Array<SummaryBinding<T>> = [];

  for (const column of columns) {
    if (!column.summary) continue;
    const summaries = normalizeSummaryInput(column.summary) ?? [];

    for (const [summaryIndex, definition] of summaries.entries()) {
      bindings.push({
        columnId: column.id,
        summaryIndex,
        definition,
        runtime: createSummaryRuntime(definition),
      });
    }
  }

  return bindings;
}

export function planRows<T extends object>(
  schema: SchemaDefinition<T, any, any, any, any, any>,
  rows: T[],
): PlannerResult<T>;
export function planRows<T extends object>(
  schema: {
    kind: "report" | "excel-table";
    columns: ResolvedColumn<T>[];
    excelTableName?: string;
    context?: SchemaContext;
  },
  rows: T[],
): PlannerResult<T>;
export function planRows<T extends object>(
  schema: SchemaDefinition<T, any, any, any, any, any> | ResolvedColumnsPlannerInput<T>,
  rows: T[],
): PlannerResult<T> {
  const columns = isResolvedColumnsInput(schema) ? schema.columns : resolveColumns(schema);
  const excelTableName = isResolvedColumnsInput(schema) ? schema.excelTableName : undefined;
  const context = isResolvedColumnsInput(schema) ? schema.context : undefined;
  const stats = createPlannerStats(columns);
  const summaryBindings = createSummaryBindings(columns);
  const plannedRows: PlannedPhysicalRow<T>[] = [];
  const merges: PlannedMergeRange[] = [];

  let physicalRowIndex = 0;

  rows.forEach((row, logicalRowIndex) => {
    let rowHeight = 1;
    const rawCells = columns.map((column) => {
      const rawValue = column.formula
        ? undefined
        : column.accessor
          ? resolveAccessor(row, column.accessor as any, context)
          : undefined;
      const transformed = column.transform
        ? invokeRowTransform({
            ctx: context,
            row,
            rowIndex: logicalRowIndex,
            transform: column.transform,
            value: rawValue,
          })
        : ((rawValue ?? column.defaultValue ?? null) as PrimitiveCellValue | PrimitiveCellValue[]);
      const image = resolveColumnImage({
        column,
        row,
        rowIndex: logicalRowIndex,
        subRowIndex: 0,
        sourceValue: rawValue,
        ctx: context,
      });
      const imageUrl = resolveColumnImageUrl({
        column,
        row,
        rowIndex: logicalRowIndex,
        subRowIndex: 0,
        sourceValue: rawValue,
        ctx: context,
      });
      const values = resolveColumnCellValues({
        column,
        imageUrl,
        transformed,
      });
      rowHeight = Math.max(rowHeight, values.length);

      const measuredWidth = Math.max(
        ...values.map((value) => measurePrimitiveValue(getCellPrimitiveValue(value))),
        image ? imageWidthToColumnWidth(image) : 0,
        imageUrl ? imageUrlWidthToColumnWidth(imageUrl) : 0,
        0,
      );
      const currentWidth = stats.columnWidths.get(column.id) ?? 0;
      stats.columnWidths.set(
        column.id,
        resolveColumnWidth({
          column,
          currentWidth,
          measuredWidth,
        }),
      );

      return {
        column,
        image,
        imageUrl,
        values,
      };
    });

    const rowStartIndex = physicalRowIndex;
    const seriesModeByColumnId = new Map<string, RowSeriesMode>();
    const valuesByColumnId = new Map<string, CellData[]>();
    const expandedCells = columns.map((column, columnIndex) => {
      if (!column.formula) {
        const values = rawCells[columnIndex]!.values;
        const seriesMode = values.length > 1 || column.sparkline ? "expanded" : "scalar";
        seriesModeByColumnId.set(column.id, seriesMode);
        valuesByColumnId.set(column.id, values);

        return {
          columnId: column.id,
          column,
          images: rawCells[columnIndex]!.image ? [rawCells[columnIndex]!.image] : [],
          imageUrls: rawCells[columnIndex]!.imageUrl ? [rawCells[columnIndex]!.imageUrl] : [],
          values,
          seriesMode,
        };
      }

      const expr = toExpr(
        column.formula({
          row: createFormulaRowContext<any, any>(),
          refs: createFormulaRefs<any, any, any>(),
          fx: createFormulaFunctionsContext<any, any>(),
          ctx: context as never,
        } as Parameters<NonNullable<typeof column.formula>>[0]),
      );
      const inferredSeriesMode: RowSeriesMode = formulaUsesSeriesAggregate(expr)
        ? "scalar"
        : rowHeight > 1 && formulaUsesExpandedRefs(expr, seriesModeByColumnId, columns)
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
        rowStartIndex,
        rowHeight,
      );

      const values =
        seriesMode === "expanded"
          ? Array.from({ length: rowHeight }, (_, subRowIndex) =>
              resolveFormulaCell({
                column,
                columns,
                expr,
                formulaMode: schema.kind,
                tableName: excelTableName,
                ctx: context,
                rowIndex: rowStartIndex + subRowIndex,
                referenceRowsByColumnId: createReferenceRowsByColumnId(
                  seriesModeByColumnId,
                  rowStartIndex,
                  subRowIndex,
                ),
                rowSeriesBoundsByColumnId,
                value:
                  schema.kind === "excel-table"
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
                formulaMode: schema.kind,
                tableName: excelTableName,
                ctx: context,
                rowIndex: rowStartIndex,
                referenceRowsByColumnId: createReferenceRowsByColumnId(
                  seriesModeByColumnId,
                  rowStartIndex,
                  0,
                ),
                rowSeriesBoundsByColumnId,
                value:
                  schema.kind === "excel-table"
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

      return {
        columnId: column.id,
        column,
        images: [],
        imageUrls: [],
        values,
        seriesMode,
      };
    });

    summaryBindings.forEach((binding) => {
      stepSummaryRuntime(binding.definition, binding.runtime, row, logicalRowIndex);
    });

    for (let subRowIndex = 0; subRowIndex < rowHeight; subRowIndex++) {
      const rowStyles: Array<CellStyle | undefined> = expandedCells.map((cell) =>
        resolveColumnCellStyle({
          column: cell.column,
          ctx: context,
          row,
          rowIndex: logicalRowIndex,
          subRowIndex,
        }),
      );
      const rowValues = expandedCells.map((cell) =>
        getCellPrimitiveValue(cell.values[subRowIndex] ?? null),
      );
      const imageHeight = Math.max(
        ...expandedCells.map((cell) =>
          cell.images[subRowIndex] ? imageHeightToPoints(cell.images[subRowIndex]!) : 0,
        ),
        ...expandedCells.map((cell) =>
          cell.imageUrls[subRowIndex] ? imageUrlHeightToPoints(cell.imageUrls[subRowIndex]!) : 0,
        ),
        0,
      );
      const physicalHeight = Math.max(estimateRowHeight(rowValues, rowStyles), imageHeight);

      plannedRows.push({
        logicalRowIndex,
        physicalRowIndex,
        logicalRowStartIndex: rowStartIndex,
        logicalRowHeight: rowHeight,
        height: physicalHeight,
        cells: expandedCells.map((cell) => ({
          columnId: cell.columnId,
          value: cell.values[subRowIndex] ?? null,
          hyperlink: resolveCellHyperlink({
            column: cell.column,
            row,
            rowIndex: logicalRowIndex,
            subRowIndex,
            ctx: context,
          }),
          image: cell.images[subRowIndex],
          sourceRow: row,
          sourceRowIndex: logicalRowIndex,
          subRowIndex,
        })),
      });

      stats.rowHeights.set(physicalRowIndex, physicalHeight);
      physicalRowIndex += 1;
    }

    if (rowHeight > 1) {
      expandedCells.forEach((cell, columnIndex) => {
        if (cell.seriesMode === "scalar") {
          merges.push({
            startRow: physicalRowIndex - rowHeight,
            endRow: physicalRowIndex - 1,
            startCol: columnIndex,
            endCol: columnIndex,
          });
        }
      });
    }
  });

  for (const binding of summaryBindings) {
    void finalizeSummaryRuntime(binding.definition, binding.runtime);
  }

  return {
    columns,
    rows: plannedRows,
    merges,
    stats,
  };
}

function isResolvedColumnsInput<T extends object>(
  value: SchemaDefinition<T, any, any, any, any, any> | ResolvedColumnsPlannerInput<T>,
): value is ResolvedColumnsPlannerInput<T> {
  return value.columns.length > 0 && "headerLabel" in value.columns[0]!;
}
