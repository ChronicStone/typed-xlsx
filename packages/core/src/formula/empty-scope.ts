/** Thrown while serializing a scope aggregate whose group or dynamic block has no columns. */
export class EmptyFormulaScopeError extends Error {
  constructor(readonly scopeId: string) {
    super(
      `Formula aggregates dynamic block '${scopeId}', which generated no columns for this export.`,
    );
    this.name = "EmptyFormulaScopeError";
  }
}

/** SUM and COUNT of nothing are 0; other aggregates have no sensible empty result. */
export function serializeEmptyScopeAggregate(
  aggregate: "AVERAGE" | "COUNT" | "MAX" | "MIN" | "SUM",
  scopeId: string,
) {
  if (aggregate === "SUM" || aggregate === "COUNT") {
    return "0";
  }

  throw new EmptyFormulaScopeError(scopeId);
}

/** Re-throws an empty-scope error with the name of the formula column that caused it. */
export function withFormulaColumnId<R>(columnId: string, serialize: () => R): R {
  try {
    return serialize();
  } catch (error) {
    if (error instanceof EmptyFormulaScopeError) {
      throw new Error(
        `Formula column '${columnId}' aggregates dynamic block '${error.scopeId}', which generated no columns for this export.`,
        { cause: error },
      );
    }
    throw error;
  }
}
