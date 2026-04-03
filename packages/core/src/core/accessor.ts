import type { Path, PathValue } from "./path";
import { getValueAtPath } from "./path";

export type AccessorContext<T extends object, TContext = unknown> = {
  row: T;
  ctx: TContext;
};

export type Accessor<T extends object, TValue = unknown, TContext = unknown> =
  | Path<T>
  | ((context: T & AccessorContext<T, TContext>) => TValue);

export type AccessorValue<T extends object, TAccessor> = TAccessor extends (
  ...args: any[]
) => infer TReturn
  ? TReturn
  : TAccessor extends Path<T>
    ? PathValue<T, TAccessor>
    : unknown;

export function resolveAccessor<
  T extends object,
  TAccessor extends Accessor<T, unknown, TContext>,
  TContext = unknown,
>(row: T, accessor: TAccessor, ctx?: TContext): AccessorValue<T, TAccessor> | undefined {
  if (typeof accessor === "function") {
    const resolvedAccessor = accessor as (...args: any[]) => unknown;
    if (resolvedAccessor.length === 1) {
      return resolvedAccessor(row) as AccessorValue<T, TAccessor>;
    }

    return resolvedAccessor({ ...row, row, ctx } as T &
      AccessorContext<T, TContext>) as AccessorValue<T, TAccessor>;
  }

  return getValueAtPath(row, accessor as Path<T>) as AccessorValue<T, TAccessor> | undefined;
}
