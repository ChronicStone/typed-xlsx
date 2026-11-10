import type { AccessorContext } from "./accessor";
import type { Path, PathValue } from "./path";

/**
 * A type-level error message. The trailing zero-width space keeps a real string from ever
 * matching it, so the message shows up verbatim in the editor at the offending property.
 */
export type ErrorMessage<TMessage extends string> = `${TMessage}​`;

type UnionToIntersection<U> = (U extends unknown ? (value: U) => void : never) extends (
  value: infer I,
) => void
  ? I
  : never;

type LastOfUnion<U> =
  UnionToIntersection<U extends unknown ? () => U : never> extends () => infer R ? R : never;

/**
 * Joins a union of string literals into `"a, b, c"`, for listing accepted values in a message. It
 * stops after 30 names (`"…, b, c"`): each name taken out of a union costs a pass over what is left,
 * so a full list of a wide table's columns would cost its square, and TypeScript builds these
 * messages even for valid code.
 */
export type JoinUnion<U, TAcc extends string = "", TCount extends unknown[] = []> = [U] extends [
  never,
]
  ? TAcc
  : TCount["length"] extends 30
    ? `…, ${TAcc}`
    : JoinUnion<
        Exclude<U, LastOfUnion<U>>,
        TAcc extends "" ? `${LastOfUnion<U> & string}` : `${LastOfUnion<U> & string}, ${TAcc}`,
        [...TCount, unknown]
      >;

/** Keys of an object type that can actually be given, skipping the ones typed `never`. */
export type AllowedKeys<T> = T extends unknown
  ? { [K in keyof T]-?: [Exclude<T[K], undefined>] extends [never] ? never : K }[keyof T]
  : never;

/** Keys worth listing as options: the allowed ones, minus those typed as an error message. */
export type OptionKeys<T> = T extends unknown
  ? {
      [K in keyof T]-?: [Exclude<T[K], undefined>] extends [never]
        ? never
        : [Exclude<T[K], undefined>] extends [`${string}\u200B`]
          ? never
          : K;
    }[keyof T]
  : never;

/** Paths of `T` whose value fits `TValue`. */
export type PathsWithValue<T, TValue> = {
  [P in Path<T>]: PathValue<T, P> extends TValue ? P : never;
}[Path<T>];

type AccessorFn<T extends object, TContext, TValue> = (
  context: T & AccessorContext<T, TContext>,
) => TValue;

/**
 * Fields that fit, falling back to every field. The `& string` rebuilds the union without its alias
 * name, so editors print the field names instead of `PathsWithValue<Row, …>`.
 */
type FittingPaths<T, TValue> = ([PathsWithValue<T, TValue>] extends [never]
  ? Path<T>
  : PathsWithValue<T, TValue>) &
  string;

/**
 * The fields that fit, as a list for messages. It depends only on the row type and the column
 * kind, so TypeScript computes it once and reuses it: built per accessor, it was rebuilt for every
 * column while inference compared values against both branches of the check.
 */
type FittingPathList<T, TValue> = JoinUnion<PathsWithValue<T, TValue>>;

/**
 * Checks an accessor against the row type.
 *
 * - An unknown field is rejected against the fields that fit, so the editor lists them and
 *   suggests the closest one.
 * - A field whose value doesn't fit the column (an object in a plain column, a string in a
 *   checkbox column) gets a message naming the fields that do.
 * - A function must return a value that fits.
 *
 * While the accessor is still being inferred (`never`, or its whole constraint including any
 * string), any field or row function is accepted: an arrow function gets its `row` type, and the
 * checks below don't run once per field of the row. That branch doesn't depend on the accessor,
 * so TypeScript computes it once per row type.
 */
export type ValidateAccessor<
  T extends object,
  TAccessor,
  TContext,
  TValue,
  TValueLabel extends string,
> = [TAccessor] extends [never]
  ? unknown
  : string extends TAccessor
    ? [TAccessor] extends [string]
      ? // A plain \`string\` (a variable): it can't be checked, so it is rejected against the fields.
        ([PathsWithValue<T, TValue>] extends [never] ? Path<T> : PathsWithValue<T, TValue>) & string
      : // The whole constraint, while inference hasn't settled: nothing to check yet.
        unknown
    : TAccessor extends string
      ? TAccessor extends Path<T>
        ? [PathValue<T, TAccessor>] extends [TValue]
          ? TAccessor
          : [PathsWithValue<T, TValue>] extends [never]
            ? ErrorMessage<`'${TAccessor}' doesn't hold ${TValueLabel}, and no field of the row does. Use an accessor function to compute one`>
            : ErrorMessage<`'${TAccessor}' doesn't hold ${TValueLabel}. Fields that do: ${FittingPathList<T, TValue>}`>
        : // Inline rather than `FittingPaths<…>`: editors would print that name, not the fields.
          ([PathsWithValue<T, TValue>] extends [never] ? Path<T> : PathsWithValue<T, TValue>) &
            string
      : TAccessor extends (context: any) => infer TReturn
        ? [TAccessor] extends [(context: T & AccessorContext<T, TContext>) => unknown]
          ? [TReturn] extends [TValue]
            ? TAccessor
            : ErrorMessage<`The accessor function must return ${TValueLabel}`>
          : ErrorMessage<"The accessor function receives the row: write (row) => … without a parameter type, or type it as the row type">
        : FittingPaths<T, TValue> | AccessorFn<T, TContext, TValue>;

/**
 * Key check for an options object, in the style of arktype: each key of the inferred `TInput` that
 * isn't in `TAllowed` becomes a message on that key, listing the options. Pair it with the real
 * options type (`ValidateKeys<TInput, keyof TOptions, "a table option"> & TOptions`): this layer
 * reports unknown keys, the options type types the values.
 */
export type ValidateKeys<TInput, TAllowed extends PropertyKey, TLabel extends string> = {
  [K in keyof TInput]: K extends TAllowed
    ? unknown
    : ErrorMessage<`'${K & string}' is not ${TLabel}. Options: ${JoinUnion<TAllowed>}`>;
};
