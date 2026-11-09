import type { PivotAccumulator } from "./engine";
import type { PivotSpec } from "./types";

/** Links a pivot spec made by a streamed table handle back to the table, so it can tally rows. */
export const STREAM_PIVOT_SOURCE: unique symbol = Symbol("typed-xlsx.stream-pivot-source");

export interface StreamPivotSource {
  attachPivot(id: string, spec: PivotSpec): PivotAccumulator;
}

export function streamPivotSourceOf(spec: PivotSpec): StreamPivotSource | undefined {
  return (spec as unknown as { [STREAM_PIVOT_SOURCE]?: StreamPivotSource })[STREAM_PIVOT_SOURCE];
}
