import type { Path, PathValue } from "./path";
import { getValueAtPath } from "./path";

export type Accessor<T extends object, TValue = unknown> = string | ((row: T) => TValue);

export type AccessorValue<T extends object, TAccessor> = TAccessor extends (
  ...args: any[]
) => infer TReturn
  ? TReturn
  : TAccessor extends Path<T>
    ? PathValue<T, TAccessor>
    : unknown;

export function resolveAccessor<T extends object, TAccessor extends Accessor<T, unknown>>(
  row: T,
  accessor: TAccessor,
): AccessorValue<T, TAccessor> | undefined {
  if (typeof accessor === "function") {
    return accessor(row) as AccessorValue<T, TAccessor>;
  }

  return getValueAtPath(row, accessor) as AccessorValue<T, TAccessor> | undefined;
}
