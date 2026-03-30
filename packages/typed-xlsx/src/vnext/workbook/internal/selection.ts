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
    if (include && !include.has(column.id)) return false;
    if (exclude && exclude.has(column.id)) return false;
    return true;
  });
}
