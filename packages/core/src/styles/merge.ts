type Primitive = bigint | boolean | null | number | string | symbol | undefined;

type DeepMergeValue<T> = T extends Primitive
  ? T
  : T extends readonly unknown[]
    ? T
    : T extends object
      ? { [K in keyof T]?: DeepMergeValue<T[K]> }
      : T;

export function deepMerge<T extends object>(...values: Array<DeepMergeValue<T> | undefined>): T {
  const result: Record<string, unknown> = {};

  for (const value of values) {
    mergeInto(result, value);
  }

  return result as T;
}

function mergeInto(target: Record<string, unknown>, value: unknown) {
  if (!isPlainObject(value)) {
    return;
  }

  for (const [key, nextValue] of Object.entries(value)) {
    if (nextValue === undefined) {
      continue;
    }

    if (isPlainObject(nextValue)) {
      const existing = target[key];
      const nextTarget = isPlainObject(existing) ? existing : {};
      mergeInto(nextTarget, nextValue);
      target[key] = nextTarget;
      continue;
    }

    target[key] = nextValue;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
