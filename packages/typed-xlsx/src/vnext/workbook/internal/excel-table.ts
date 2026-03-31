import type { ResolvedColumn } from "../../planner/rows";
import type { ExcelTableStyle, ResolvedExcelTableOptions } from "../types";

const DEFAULT_EXCEL_TABLE_STYLE: ExcelTableStyle = "TableStyleMedium2";

export function resolveExcelTableOptions(params: {
  id: string;
  name?: string;
  style?: ExcelTableStyle;
  autoFilter?: boolean;
  hasMerges?: boolean;
  totalsRow?: boolean;
  columns: ResolvedColumn<any>[];
}) {
  if (params.hasMerges) {
    throw new Error(
      "Native Excel tables require flat physical rows. Remove array-expanded columns and merged body cells, or use the default report table mode.",
    );
  }

  return {
    name: resolveExcelTableName(params.name, params.id),
    style: params.style ?? DEFAULT_EXCEL_TABLE_STYLE,
    autoFilter: params.autoFilter ?? true,
    totalsRow: params.totalsRow ?? false,
    totalsRowColumns: params.columns.map((column) => ({
      id: column.id,
      headerLabel: column.headerLabel,
      totalsRow: column.totalsRow,
    })),
  } satisfies ResolvedExcelTableOptions;
}

function resolveExcelTableName(name: string | undefined, id: string) {
  const candidate = name ?? toExcelTableName(id);

  if (!isValidExcelTableName(candidate)) {
    throw new Error(
      `Invalid Excel table name '${candidate}'. Excel table names must start with a letter or underscore and contain only letters, numbers, or underscores.`,
    );
  }

  return candidate;
}

function toExcelTableName(value: string) {
  const cleaned = value.replace(/[^A-Za-z0-9_]/g, "_");
  const prefixed = /^[A-Za-z_]/.test(cleaned) ? cleaned : `_${cleaned}`;
  return prefixed || "_table";
}

function isValidExcelTableName(value: string) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}
