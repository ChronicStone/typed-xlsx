import type { PlannedMergeRange } from "../../planner/rows";
import type { TableAutoFilterOptions } from "../types";

function isAutoFilterRequested(autoFilter: boolean | TableAutoFilterOptions | undefined) {
  if (typeof autoFilter === "boolean") {
    return autoFilter;
  }

  return autoFilter?.enabled ?? false;
}

export function resolveAutoFilter(params: {
  autoFilter: boolean | TableAutoFilterOptions | undefined;
  merges: PlannedMergeRange[];
  tableId: string;
  mode: "buffered" | "stream";
  warn?: boolean;
}) {
  if (!isAutoFilterRequested(params.autoFilter)) {
    return false;
  }

  if (params.merges.length === 0) {
    return true;
  }

  if (params.warn !== false) {
    console.warn(
      `[typed-xlsx] Disabled autoFilter for ${params.mode} table '${params.tableId}' because the rendered report contains vertically merged body cells from sub-row expansion. Worksheet auto-filters operate on flat physical rows; use a flat report table or native Excel tables for filtered views.`,
    );
  }

  return false;
}
