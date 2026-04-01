import type { ResolvedColumn } from "../../planner/rows";
import type { TableSelection } from "../types";

export function applyColumnSelection<T extends object, TColumnId extends string>(
  columns: ResolvedColumn<T>[],
  selection?: TableSelection<TColumnId>,
): ResolvedColumn<T>[] {
  if (!selection) return columns;

  const include = selection.include ? new Set<string>(selection.include) : null;
  const exclude = selection.exclude ? new Set<string>(selection.exclude) : null;

  return columns.filter((column) => {
    const selectedIds = column.groupId ? [column.id, column.groupId] : [column.id];

    if (include && !selectedIds.some((id) => include.has(id))) return false;
    if (exclude && selectedIds.some((id) => exclude.has(id))) return false;
    return true;
  });
}
