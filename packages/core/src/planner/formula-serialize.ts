import { serializeEmptyScopeAggregate } from "../formula/empty-scope";
import {
  escapeStructuredReferenceHeader,
  serializeExcelTableCurrentRowRef,
} from "../formula/structured-reference";
import { toCellRef } from "../ooxml/cells";
import type { ResolvedColumn } from "./rows";

export function resolveFormulaScopeColumns<T extends object>(
  columns: ResolvedColumn<T>[],
  scopeId: string,
) {
  return columns.filter((column) => column.scopeIds.includes(scopeId));
}

export function serializeFormulaScopeExpr<T extends object>(params: {
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
    return serializeEmptyScopeAggregate(params.aggregate, params.scopeId);
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
