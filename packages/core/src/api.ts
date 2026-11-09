import type {
  ExcelTableSchemaDefinition,
  ReportSchemaDefinition,
  SchemaContext,
  SchemaDefinition,
  SchemaContextOf,
  SchemaDynamicId,
  SchemaGroupId,
  SchemaKind,
} from "./schema/builder";
import { ExcelTableSchemaBuilder, SchemaBuilder } from "./schema/builder";
import { BufferedWorkbookBuilder } from "./workbook/buffered";
import { StreamWorkbookBuilder } from "./workbook/stream";
import type {
  BufferedExcelTableInput,
  BufferedReportTableInput,
  ReportTableRenderOptions,
  SheetLayoutOptions,
  SheetProtectionInput,
  SheetViewOptions,
  StreamExcelTableInput,
  StreamReportTableInput,
  StreamSheetSpool,
  StreamSpoolFactory,
  StreamWorkbookSink,
  TableStyleDefaults,
  TableSelection,
  WorkbookProtectionInput,
} from "./workbook/types";
import { MemorySpoolFactory } from "./workbook/internal/memory";
import { writeFileChunk } from "./workbook/internal/file-write";
import {
  NodeWritableWorkbookSink,
  WebWritableWorkbookSink,
  WorkbookByteStream,
} from "./workbook/internal/stream-sinks";
import type { SpreadsheetTheme } from "./styles/theme";
import type {
  ChartBookAddSheet,
  ChartBookAddTable,
  ChartMark,
  ChartPivotIdGuard,
  ChartRefs,
  ChartSheetNameGuard,
  ChartSpec,
  ChartSpecGuard,
  ChartTable,
  ChartTableIdGuard,
  ChartTableShapeOf,
  EmptyChartBook,
} from "./chart/types";
import { createChartTable } from "./chart/table";
import type { PivotChartSource, PivotShape, PivotSpec } from "./pivot/types";
import { STREAM_PIVOT_SOURCE } from "./pivot/stream-source";

export interface WorkbookOptions {
  protection?: WorkbookProtectionInput;
}
type AnySchemaDefinition = SchemaDefinition<any, any, any, any, any, any>;
type AnyReportSchemaDefinition = ReportSchemaDefinition<any, any, any, any, any>;
type AnyExcelTableSchemaDefinition = ExcelTableSchemaDefinition<any, any, any, any, any>;
type SchemaRow<TSchema extends AnySchemaDefinition> =
  TSchema extends SchemaDefinition<infer TRow, any, any, any, any, any> ? TRow : never;
type SchemaColumnIds<TSchema extends AnySchemaDefinition> =
  TSchema extends SchemaDefinition<any, infer TColumnId, any, any, any, any> ? TColumnId : never;
type SchemaGroupIds<TSchema extends AnySchemaDefinition> = SchemaGroupId<TSchema>;
type SchemaDynamicIds<TSchema extends AnySchemaDefinition> = SchemaDynamicId<TSchema>;
type SchemaSelectableIds<TSchema extends AnySchemaDefinition> =
  | SchemaColumnIds<TSchema>
  | SchemaGroupIds<TSchema>
  | SchemaDynamicIds<TSchema>;
type SchemaResolvedContext<TSchema extends AnySchemaDefinition> = SchemaContextOf<TSchema>;
type IsExactlyUnknown<T> = unknown extends T ? ([T] extends [unknown] ? true : false) : false;
type WorkbookTableContextField<TSchema extends AnySchemaDefinition> =
  IsExactlyUnknown<SchemaResolvedContext<TSchema>> extends true
    ? { context?: never }
    : { context: SchemaResolvedContext<TSchema> };

export interface WorkbookSheetOptions extends SheetLayoutOptions, SheetViewOptions {
  protection?: SheetProtectionInput;
}

export type WorkbookTableDefaults = TableStyleDefaults;
export type WorkbookReportRenderOptions = ReportTableRenderOptions;
export type WorkbookTheme = SpreadsheetTheme;

export interface WorkbookReportTableInput<
  TSchema extends AnyReportSchemaDefinition,
  TSelection extends TableSelection<SchemaSelectableIds<TSchema>> | undefined = undefined,
> extends Omit<
  BufferedReportTableInput<
    SchemaRow<TSchema>,
    SchemaSelectableIds<TSchema>,
    SchemaResolvedContext<TSchema>
  >,
  "schema" | "select" | "context"
> {
  schema: TSchema;
  select?: TSelection;
}
export interface WorkbookExcelTableInput<
  TSchema extends AnyExcelTableSchemaDefinition,
  TSelection extends TableSelection<SchemaSelectableIds<TSchema>> | undefined = undefined,
> extends Omit<
  BufferedExcelTableInput<
    SchemaRow<TSchema>,
    SchemaSelectableIds<TSchema>,
    SchemaResolvedContext<TSchema>
  >,
  "schema" | "select" | "context"
> {
  schema: TSchema;
  select?: TSelection;
}
export type WorkbookReportTableOptions<
  TSchema extends AnyReportSchemaDefinition,
  TSelection extends TableSelection<SchemaSelectableIds<TSchema>> | undefined = undefined,
> = WorkbookReportTableInput<TSchema, TSelection> & WorkbookTableContextField<TSchema>;
export type WorkbookExcelTableOptions<
  TSchema extends AnyExcelTableSchemaDefinition,
  TSelection extends TableSelection<SchemaSelectableIds<TSchema>> | undefined = undefined,
> = WorkbookExcelTableInput<TSchema, TSelection> & WorkbookTableContextField<TSchema>;
export type WorkbookTableInput<
  TSchema extends AnySchemaDefinition,
  TSelection extends TableSelection<SchemaSelectableIds<TSchema>> | undefined = undefined,
> = TSchema extends AnyExcelTableSchemaDefinition
  ? WorkbookExcelTableInput<TSchema, TSelection>
  : TSchema extends AnyReportSchemaDefinition
    ? WorkbookReportTableInput<TSchema, TSelection>
    : never;
export type WorkbookTableOptions<
  TSchema extends AnySchemaDefinition,
  TSelection extends TableSelection<SchemaSelectableIds<TSchema>> | undefined = undefined,
> = TSchema extends AnyExcelTableSchemaDefinition
  ? WorkbookExcelTableOptions<TSchema, TSelection>
  : TSchema extends AnyReportSchemaDefinition
    ? WorkbookReportTableOptions<TSchema, TSelection>
    : never;

export interface Workbook {
  sheet<const TName extends string>(
    name: TName,
    options?: WorkbookSheetOptions,
  ): WorkbookSheet<ChartBookAddSheet<EmptyChartBook, TName>, TName>;
  toUint8Array(): Uint8Array;
  toBuffer(): Buffer;
  writeToFile(filePath: string): Promise<void>;
}

/**
 * A sheet in a buffered workbook. Chaining `.table()`, `.chart()` and `.sheet()` keeps a
 * type-level registry of every table declared so far (`TBook`), which charts read through `refs`.
 */
export interface WorkbookSheet<TBook = EmptyChartBook, TSheet extends string = string> {
  table<
    TSchema extends AnyReportSchemaDefinition,
    const TSelection extends TableSelection<SchemaSelectableIds<TSchema>> | undefined = undefined,
    const TTableId extends string = string,
  >(
    id: TTableId,
    input: WorkbookReportTableOptions<TSchema, TSelection> &
      ChartTableIdGuard<TTableId, TBook, TSheet>,
  ): WorkbookSheet<
    ChartBookAddTable<TBook, TSheet, TTableId, ChartTableShapeOf<TSchema, TSelection>>,
    TSheet
  >;
  table<
    TSchema extends AnyExcelTableSchemaDefinition,
    const TSelection extends TableSelection<SchemaSelectableIds<TSchema>> | undefined = undefined,
    const TTableId extends string = string,
  >(
    id: TTableId,
    input: WorkbookExcelTableOptions<TSchema, TSelection> &
      ChartTableIdGuard<TTableId, TBook, TSheet>,
  ): WorkbookSheet<
    ChartBookAddTable<TBook, TSheet, TTableId, ChartTableShapeOf<TSchema, TSelection>>,
    TSheet
  >;
  /**
   * Adds a native Excel chart built from marks of tables declared earlier in the chain:
   * `refs.table(id)` on this sheet, `refs.sheet(name).table(id)` on another one.
   *
   * @example
   * .chart("revenue", ({ refs }) => ({
   *   title: "Revenue vs target",
   *   marks: [
   *     refs.table("sales").bar({ x: "month", y: "revenue" }),
   *     refs.table("targets").line({ x: "month", y: "target" }),
   *   ],
   * }))
   */
  chart<const TMarks extends readonly [ChartMark<any, any>, ...ChartMark<any, any>[]]>(
    id: string,
    build: (args: { refs: ChartRefs<TBook, TSheet> }) => ChartSpec<TMarks> & ChartSpecGuard<TMarks>,
  ): WorkbookSheet<TBook, TSheet>;
  /**
   * Adds a native Excel pivot table over a table declared earlier in the chain. Excel refreshes it
   * when the file opens; the library also writes its totals, so the file reads right before that.
   *
   * @example
   * .pivot("byRegion", ({ refs }) =>
   *   refs.table("sales").pivot({ rows: ["region"], columns: ["month"], values: { revenue: "sum" } }),
   * )
   */
  pivot<const TPivotId extends string, TShape extends PivotShape>(
    id: TPivotId & ChartPivotIdGuard<TPivotId, TBook, TSheet>,
    build: (args: { refs: ChartRefs<TBook, TSheet> }) => PivotSpec<TShape>,
  ): WorkbookSheet<ChartBookAddTable<TBook, TSheet, TPivotId, TShape>, TSheet>;
  /** Starts the next sheet of the same workbook, keeping the tables declared so far. */
  sheet<const TName extends string>(
    name: TName & ChartSheetNameGuard<TName, TBook>,
    options?: WorkbookSheetOptions,
  ): WorkbookSheet<ChartBookAddSheet<TBook, TName>, TName>;
  toUint8Array(): Uint8Array;
  toBuffer(): Buffer;
  writeToFile(filePath: string): Promise<void>;
}

export interface WorkbookStreamOptions {
  protection?: WorkbookProtectionInput;
  tempStorage?: "file" | "memory";
  tempDirectory?: string;
  strings?: WorkbookStreamStringMode;
  memoryProfile?: WorkbookStreamMemoryProfile;
}

export type WorkbookStreamStringMode = "auto" | "inline" | "shared";
export type WorkbookStreamMemoryProfile = "balanced" | "low-memory" | "compact-file";

export interface WorkbookStreamSheetOptions extends SheetLayoutOptions, SheetViewOptions {
  protection?: SheetProtectionInput;
}

export interface WorkbookStreamTableOptions<
  TSchema extends AnyReportSchemaDefinition,
  TSelection extends TableSelection<SchemaSelectableIds<TSchema>> | undefined = undefined,
> extends Omit<
  StreamReportTableInput<
    SchemaRow<TSchema>,
    SchemaSelectableIds<TSchema>,
    SchemaResolvedContext<TSchema>
  >,
  "schema" | "select" | "context"
> {
  schema: TSchema;
  select?: TSelection;
}
export interface WorkbookStreamExcelTableOptions<
  TSchema extends AnyExcelTableSchemaDefinition,
  TSelection extends TableSelection<SchemaSelectableIds<TSchema>> | undefined = undefined,
> extends Omit<
  StreamExcelTableInput<
    SchemaRow<TSchema>,
    SchemaSelectableIds<TSchema>,
    SchemaResolvedContext<TSchema>
  >,
  "schema" | "select" | "context"
> {
  schema: TSchema;
  select?: TSelection;
}
export type WorkbookStreamResolvedReportTableOptions<
  TSchema extends AnyReportSchemaDefinition,
  TSelection extends TableSelection<SchemaSelectableIds<TSchema>> | undefined = undefined,
> = WorkbookStreamTableOptions<TSchema, TSelection> & WorkbookTableContextField<TSchema>;
export type WorkbookStreamResolvedExcelTableOptions<
  TSchema extends AnyExcelTableSchemaDefinition,
  TSelection extends TableSelection<SchemaSelectableIds<TSchema>> | undefined = undefined,
> = WorkbookStreamExcelTableOptions<TSchema, TSelection> & WorkbookTableContextField<TSchema>;
export type WorkbookStreamResolvedTableOptions<
  TSchema extends AnySchemaDefinition,
  TSelection extends TableSelection<SchemaSelectableIds<TSchema>> | undefined = undefined,
> = TSchema extends AnyExcelTableSchemaDefinition
  ? WorkbookStreamResolvedExcelTableOptions<TSchema, TSelection>
  : TSchema extends AnyReportSchemaDefinition
    ? WorkbookStreamResolvedReportTableOptions<TSchema, TSelection>
    : never;

export interface WorkbookCommitBatch<TRow extends object> {
  rows: TRow[];
}

/**
 * A streamed table. Besides committing rows, it creates chart marks from its rendered columns,
 * such as `sales.line({ x: "month", y: "revenue" })`, for `sheet.chart(...)`.
 */
export interface WorkbookTableStream<
  TRow extends object,
  TColumns = Record<string, unknown>,
  TDynamic extends string = string,
> extends ChartTable<TColumns, TDynamic> {
  commit(batch: WorkbookCommitBatch<TRow>): Promise<void>;
}

type StreamTableOf<TSchema extends AnySchemaDefinition, TSelection> =
  ChartTableShapeOf<TSchema, TSelection> extends {
    columns: infer TColumns;
    dynamic: infer TDynamic extends string;
  }
    ? WorkbookTableStream<SchemaRow<TSchema>, TColumns, TDynamic>
    : never;

export interface WorkbookSheetStream {
  table<
    TSchema extends AnyReportSchemaDefinition,
    const TSelection extends TableSelection<SchemaSelectableIds<TSchema>> | undefined = undefined,
  >(
    id: string,
    options: WorkbookStreamResolvedReportTableOptions<TSchema, TSelection>,
  ): Promise<StreamTableOf<TSchema, TSelection>>;
  table<
    TSchema extends AnyExcelTableSchemaDefinition,
    const TSelection extends TableSelection<SchemaSelectableIds<TSchema>> | undefined = undefined,
  >(
    id: string,
    options: WorkbookStreamResolvedExcelTableOptions<TSchema, TSelection>,
  ): Promise<StreamTableOf<TSchema, TSelection>>;
  /**
   * Adds a native Excel chart built from marks of streamed tables, written when the workbook
   * is finalized. Charts can read tables of any sheet of the same workbook.
   *
   * @example
   * const sales = await workbook.sheet("Sales").table("sales", { schema });
   * workbook.sheet("Dashboard").chart("revenue", {
   *   marks: [sales.line({ x: "month", y: "revenue" })],
   * });
   */
  chart<const TMarks extends readonly [ChartMark<any, any>, ...ChartMark<any, any>[]]>(
    id: string,
    spec: ChartSpec<TMarks> & ChartSpecGuard<TMarks>,
  ): WorkbookSheetStream;
  /**
   * Adds a native Excel pivot table over a streamed table. Declare it before committing rows to
   * that table: rows are tallied as they arrive. Returns the pivot's marks for `sheet.chart`.
   *
   * @example
   * const sales = await workbook.sheet("Sales").table("sales", { schema });
   * const byRegion = workbook.sheet("Analysis").pivot("byRegion", sales.pivot({
   *   rows: ["region"], values: { revenue: "sum" },
   * }));
   */
  pivot<TShape extends PivotShape>(
    id: string,
    spec: PivotSpec<TShape>,
  ): PivotChartSource<TShape["pie"]>;
}

export interface WorkbookStream {
  sheet(name: string, options?: WorkbookStreamSheetOptions): WorkbookSheetStream;
  dispose(): Promise<void>;
  writeToFile(filePath: string): Promise<void>;
  pipeTo(stream: WritableStream<Uint8Array>): Promise<void>;
  pipeToNode(stream: NodeJS.WritableStream): Promise<void>;
  toReadableStream(): ReadableStream<Uint8Array>;
  toNodeReadable(): NodeJS.ReadableStream;
}

const nodeProtocol = "node:";

function importNodeFs() {
  return import(`${nodeProtocol}fs`) as Promise<typeof import("node:fs")>;
}

function importNodeFsPromises() {
  return import(`${nodeProtocol}fs/promises`) as Promise<typeof import("node:fs/promises")>;
}

function importNodeOs() {
  return import(`${nodeProtocol}os`) as Promise<typeof import("node:os")>;
}

function importNodePath() {
  return import(`${nodeProtocol}path`) as Promise<typeof import("node:path")>;
}

function sanitizeFileName(value: string) {
  return value.replaceAll(/[^a-zA-Z0-9._-]/g, "_");
}

class LazyFileSheetSpool implements StreamSheetSpool {
  private handlePromise: Promise<import("node:fs/promises").FileHandle> | undefined;
  private closed = false;

  constructor(private readonly filePath: string) {}

  private async handle() {
    this.handlePromise ??= importNodeFsPromises().then((fsp) => fsp.open(this.filePath, "a+"));
    return await this.handlePromise;
  }

  async append(chunk: Uint8Array) {
    const handle = await this.handle();
    await writeFileChunk(handle, chunk);
  }

  async *read(): AsyncIterable<Uint8Array> {
    const fs = await importNodeFs();
    const stream = fs.createReadStream(this.filePath);

    for await (const chunk of stream) {
      yield chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
    }
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    const handle = await this.handle();
    await handle.close();
  }
}

class LazyFileSpoolFactory implements StreamSpoolFactory {
  private directoryPromise: Promise<string> | undefined;

  constructor(private readonly directory: string | undefined) {}

  private async resolveDirectory() {
    if (this.directory) return this.directory;

    this.directoryPromise ??= Promise.all([importNodeOs(), importNodePath()]).then(([os, path]) =>
      path.join(os.tmpdir(), `typed-xlsx-spool-${Date.now().toString(36)}`),
    );

    return await this.directoryPromise;
  }

  async create(sheetName: string): Promise<StreamSheetSpool> {
    const [fsp, path, directory] = await Promise.all([
      importNodeFsPromises(),
      importNodePath(),
      this.resolveDirectory(),
    ]);
    await fsp.mkdir(directory, { recursive: true });
    const filePath = path.join(directory, `${sanitizeFileName(sheetName)}.spool`);
    await fsp.writeFile(filePath, "");
    return new LazyFileSheetSpool(filePath);
  }
}

class LazyFileWorkbookSink implements StreamWorkbookSink {
  private handlePromise: Promise<import("node:fs/promises").FileHandle> | undefined;

  constructor(private readonly filePath: string) {}

  private async handle() {
    this.handlePromise ??= (async () => {
      const [fsp, path] = await Promise.all([importNodeFsPromises(), importNodePath()]);
      await fsp.mkdir(path.dirname(this.filePath), { recursive: true });
      return await fsp.open(this.filePath, "w");
    })();
    return await this.handlePromise;
  }

  async write(chunk: Uint8Array) {
    const handle = await this.handle();
    await writeFileChunk(handle, chunk);
  }

  async close() {
    const handle = await this.handle();
    await handle.close();
  }
}

class PublicWorkbookSheet implements WorkbookSheet<any, any> {
  constructor(
    private readonly sheetBuilder: ReturnType<BufferedWorkbookBuilder["sheet"]>,
    private readonly workbook: PublicWorkbook,
  ) {}

  table<
    TSchema extends AnySchemaDefinition,
    const TSelection extends TableSelection<SchemaSelectableIds<TSchema>> | undefined = undefined,
  >(id: string, input: WorkbookTableOptions<TSchema, TSelection>): any {
    this.sheetBuilder.table(id, input);
    return this;
  }

  chart(id: string, build: (args: { refs: ChartRefs<any, string> }) => ChartSpec): any {
    this.sheetBuilder.chart(id, build);
    return this;
  }

  pivot(id: string, build: (args: { refs: ChartRefs<any, string> }) => PivotSpec): any {
    this.sheetBuilder.pivot(id, build);
    return this;
  }

  sheet(name: string, options?: WorkbookSheetOptions): any {
    return this.workbook.sheet(name, options);
  }

  toUint8Array() {
    return this.workbook.toUint8Array();
  }

  toBuffer() {
    return this.workbook.toBuffer();
  }

  async writeToFile(filePath: string) {
    await this.workbook.writeToFile(filePath);
  }
}

class PublicWorkbook implements Workbook {
  private readonly workbook: BufferedWorkbookBuilder;

  constructor(options: WorkbookOptions = {}) {
    this.workbook = BufferedWorkbookBuilder.create({ protection: options.protection });
  }

  sheet<const TName extends string>(
    name: TName,
    options?: WorkbookSheetOptions,
  ): WorkbookSheet<ChartBookAddSheet<EmptyChartBook, TName>, TName> {
    const sheetBuilder = this.workbook.sheet(name);
    if (options) {
      sheetBuilder.options(options);
    }

    // The runtime sheet is untyped; the chain's registry only exists at the type level.
    return new PublicWorkbookSheet(sheetBuilder, this) as never;
  }

  toUint8Array() {
    return this.workbook.buildXlsx();
  }

  toBuffer() {
    return Buffer.from(this.toUint8Array());
  }

  async writeToFile(filePath: string) {
    const { writeFile } = await importNodeFsPromises();
    await writeFile(filePath, this.toBuffer());
  }
}

function createWorkbookTableStream<TRow extends object>(
  table: { commit(batch: WorkbookCommitBatch<TRow>): Promise<void> },
  sheetName: string,
  tableId: string,
): WorkbookTableStream<TRow, any, any> {
  const chartTable = createChartTable(sheetName, tableId);
  return {
    ...chartTable,
    pivot: (options: never) =>
      Object.assign(chartTable.pivot(options), { [STREAM_PIVOT_SOURCE]: table }) as never,
    async commit(batch: WorkbookCommitBatch<TRow>) {
      await table.commit(batch);
    },
  };
}

class WorkbookSheetStreamAdapter implements WorkbookSheetStream {
  constructor(private readonly sheetBuilder: ReturnType<StreamWorkbookBuilder["sheet"]>) {}

  async table<
    TSchema extends AnySchemaDefinition,
    const TSelection extends TableSelection<SchemaSelectableIds<TSchema>> | undefined = undefined,
  >(id: string, options: WorkbookStreamResolvedTableOptions<TSchema, TSelection>): Promise<any> {
    const table = await this.sheetBuilder.table(id, options);
    return createWorkbookTableStream<SchemaRow<TSchema>>(table, this.sheetBuilder.sheetName, id);
  }

  chart(id: string, spec: ChartSpec): WorkbookSheetStream {
    this.sheetBuilder.chart(id, spec);
    return this;
  }

  pivot(id: string, spec: PivotSpec): any {
    return this.sheetBuilder.pivot(id, spec);
  }
}

class PublicWorkbookStream implements WorkbookStream {
  private readonly workbook: StreamWorkbookBuilder;
  private outputStarted = false;

  constructor(options: WorkbookStreamOptions = {}) {
    const spoolFactory =
      options.tempStorage === "memory"
        ? new MemorySpoolFactory()
        : new LazyFileSpoolFactory(options.tempDirectory);
    const stringMode = resolveStringMode(options);

    this.workbook = StreamWorkbookBuilder.create({
      spoolFactory,
      stringMode,
      protection: options.protection,
    });
  }

  sheet(name: string, options?: WorkbookStreamSheetOptions) {
    return new WorkbookSheetStreamAdapter(this.workbook.sheet(name, options));
  }

  async dispose() {
    await this.workbook.dispose();
  }

  async writeToFile(filePath: string) {
    await this.finalizeWith(new LazyFileWorkbookSink(filePath));
  }

  async pipeTo(stream: WritableStream<Uint8Array>) {
    await this.finalizeWith(new WebWritableWorkbookSink(stream));
  }

  async pipeToNode(stream: NodeJS.WritableStream) {
    await this.finalizeWith(new NodeWritableWorkbookSink(stream));
  }

  toReadableStream() {
    const byteStream = this.createByteStreamOutput();
    return byteStream.toReadableStream();
  }

  toNodeReadable() {
    const byteStream = new WorkbookByteStream();
    const readable = byteStream.toNodeReadable();
    this.startOutput(byteStream).catch((error) => {
      byteStream.fail(error instanceof Error ? error : new Error(String(error)));
    });
    return readable;
  }

  private createByteStreamOutput() {
    const byteStream = new WorkbookByteStream();
    this.startOutput(byteStream).catch((error) => {
      byteStream.fail(error instanceof Error ? error : new Error(String(error)));
    });
    return byteStream;
  }

  private async finalizeWith(sink: StreamWorkbookSink) {
    await this.startOutput(sink);
  }

  private async startOutput(sink: {
    write(chunk: Uint8Array): Promise<void>;
    close(): Promise<void>;
    fail?(error: Error): void;
  }) {
    if (this.outputStarted) {
      throw new Error("Workbook stream output has already started.");
    }

    this.outputStarted = true;
    try {
      await this.workbook.finish(sink);
    } catch (error) {
      // A byte stream must end with the error; closing it first would hand readers an empty file.
      const failure = error instanceof Error ? error : new Error(String(error));
      await Promise.allSettled([
        this.workbook.dispose(),
        sink.fail ? Promise.resolve(sink.fail(failure)) : sink.close(),
      ]);
      throw error;
    }
  }
}

export function createExcelSchema<T extends object>(): SchemaBuilder<T>;
export function createExcelSchema<T extends object, TContext extends object>(): SchemaBuilder<
  T,
  never,
  never,
  never,
  TContext
>;
export function createExcelSchema<T extends object>(options: { mode: "report" }): SchemaBuilder<T>;
export function createExcelSchema<T extends object, TContext extends object>(options: {
  mode: "report";
}): SchemaBuilder<T, never, never, never, TContext>;
export function createExcelSchema<T extends object>(options: {
  mode: "excel-table";
}): ExcelTableSchemaBuilder<T>;
export function createExcelSchema<T extends object, TContext extends object>(options: {
  mode: "excel-table";
}): ExcelTableSchemaBuilder<T, never, never, never, TContext>;
export function createExcelSchema<
  T extends object,
  TContext extends SchemaContext = unknown,
>(options?: { mode: SchemaKind }) {
  return options?.mode === "excel-table"
    ? ExcelTableSchemaBuilder.create<T, TContext>()
    : SchemaBuilder.create<T, TContext>();
}

export function createWorkbook(_options?: WorkbookOptions): Workbook {
  return new PublicWorkbook(_options);
}

export function createWorkbookStream(options?: WorkbookStreamOptions): WorkbookStream {
  return new PublicWorkbookStream(options);
}

function resolveStringMode(options: WorkbookStreamOptions): "inline" | "shared" {
  if (options.strings && options.strings !== "auto") {
    return options.strings;
  }

  switch (options.memoryProfile) {
    case "low-memory":
      return "inline";
    case "compact-file":
      return "shared";
    default:
      return "shared";
  }
}
