export type Primitive = string | number | boolean | bigint | symbol | null | undefined | Date;

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;

type PrevDepth = [never, 0, 1, 2, 3, 4, 5];

export type Path<T, TDepth extends number = 5> = [TDepth] extends [never]
  ? never
  : T extends Primitive
    ? never
    : T extends readonly unknown[]
      ? never
      : {
          [K in keyof T & string]: T[K] extends Primitive | readonly unknown[]
            ? K
            : K | Join<K, Path<NonNullable<T[K]>, PrevDepth[TDepth]>>;
        }[keyof T & string];

export type PathValue<T, TPath extends string> = TPath extends keyof T
  ? T[TPath]
  : TPath extends `${infer K}.${infer Rest}`
    ? K extends keyof T
      ? PathValue<NonNullable<T[K]>, Rest>
      : never
    : never;

export function getValueAtPath<T extends object>(row: T, path: string): unknown {
  let current: unknown = row;

  for (const segment of String(path).split(".")) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}
