// Helpers generic over a schema's row and context must keep compiling: apps wrap the table API
// in their own export runners (a sheet interface, a helper that forwards `context`).

import {
  createExcelSchema,
  createWorkbook,
  createWorkbookStream,
  type ReportSchemaDefinition,
  type TableSelection,
  type WorkbookTableStream,
} from "typed-xlsx";

type BaseContext = { locale: string };

// The exassess pattern: a hand-written sheet interface, generic over the context.
interface SheetStream {
  table<
    TRow extends object,
    TColumnId extends string,
    TGroupId extends string,
    TDynamicId extends string,
    TContext extends BaseContext,
  >(
    id: string,
    options: {
      schema: ReportSchemaDefinition<TRow, TColumnId, TGroupId, TDynamicId, TContext>;
      context: TContext;
      select?: TableSelection<TColumnId | TGroupId | TDynamicId>;
    },
  ): Promise<WorkbookTableStream<TRow>>;
}
export const sheet: SheetStream = createWorkbookStream().sheet("x");

export function buffered<
  Row extends object,
  C extends string,
  G extends string,
  D extends string,
  Ctx extends BaseContext,
>(o: { schema: ReportSchemaDefinition<Row, C, G, D, Ctx>; rows: Row[]; context: Ctx }) {
  createWorkbook().sheet("x").table("d", { schema: o.schema, rows: o.rows, context: o.context });
}

export async function streamed<Row extends object, Ctx extends BaseContext>(o: {
  schema: ReportSchemaDefinition<Row, string, string, string, Ctx>;
  context: Ctx;
}) {
  const table = await createWorkbookStream()
    .sheet("x")
    .table("d", { schema: o.schema, context: o.context });
  return table;
}

const withContext = createExcelSchema<{ a: number }, { x: number }>()
  .column("a", { accessor: "a" })
  .build();
// @ts-expect-error context is required
createWorkbook().sheet("A").table("t", { schema: withContext, rows: [] });
createWorkbook()
  .sheet("B")
  // @ts-expect-error context has the wrong type
  .table("t", { schema: withContext, rows: [], context: { x: "1" } });
createWorkbook()
  .sheet("C")
  .table("t", { schema: withContext, rows: [], context: { x: 1 } });
const without = createExcelSchema<{ a: number }>().column("a", { accessor: "a" }).build();
createWorkbook().sheet("D").table("t", { schema: without, rows: [] });
// A schema without context accepts one and ignores it.
createWorkbook()
  .sheet("E")
  .table("t", { schema: without, rows: [], context: { x: 1 } });
