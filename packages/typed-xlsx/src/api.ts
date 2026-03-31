import { writeFile } from "node:fs/promises";
import type { SchemaDefinition, SchemaGroupContext, SchemaGroupId } from "./vnext/schema/builder";
import { SchemaBuilder } from "./vnext/schema/builder";
import { BufferedWorkbookBuilder } from "./vnext/workbook/buffered";
import { StreamWorkbookBuilder } from "./vnext/workbook/stream";
import type {
  BufferedTableInput,
  SheetLayoutOptions,
  SheetViewOptions,
  TableAutoFilterOptions,
  TableSelection,
} from "./vnext/workbook/types";
import { FileSpoolFactory } from "./vnext/workbook/internal/file-spool";
import { MemorySpoolFactory } from "./vnext/workbook/internal/memory";
import {
  NodeWritableWorkbookSink,
  WebWritableWorkbookSink,
  WorkbookByteStream,
} from "./vnext/workbook/internal/stream-sinks";
import { FileWorkbookSink } from "./vnext/workbook/internal/file-sink";

export interface WorkbookOptions {}
type AnySchemaDefinition = SchemaDefinition<any, any, any, any>;
type SchemaRow<TSchema extends AnySchemaDefinition> =
  TSchema extends SchemaDefinition<infer TRow, any, any, any> ? TRow : never;
type SchemaColumnIds<TSchema extends AnySchemaDefinition> =
  TSchema extends SchemaDefinition<any, infer TColumnId, any, any> ? TColumnId : never;
type SchemaGroupIds<TSchema extends AnySchemaDefinition> = SchemaGroupId<TSchema>;
type SchemaSelectableIds<TSchema extends AnySchemaDefinition> =
  | SchemaColumnIds<TSchema>
  | SchemaGroupIds<TSchema>;
type SchemaResolvedContext<TSchema extends AnySchemaDefinition> = SchemaGroupContext<TSchema>;
type SchemaContextualGroupIds<TSchema extends AnySchemaDefinition> = Extract<
  keyof SchemaResolvedContext<TSchema>,
  string
>;
type SelectionIncludedIds<TSelection> = TSelection extends {
  include: infer TInclude extends readonly unknown[];
}
  ? TInclude[number]
  : never;
type SelectionExcludedIds<TSelection> = TSelection extends {
  exclude: infer TExclude extends readonly unknown[];
}
  ? TExclude[number]
  : never;
type SelectedGroupIds<
  TSchema extends AnySchemaDefinition,
  TSelection extends TableSelection<SchemaSelectableIds<TSchema>> | undefined,
> = TSelection extends { include: readonly unknown[] }
  ? Exclude<
      Extract<SelectionIncludedIds<TSelection>, SchemaContextualGroupIds<TSchema>>,
      Extract<SelectionExcludedIds<TSelection>, SchemaContextualGroupIds<TSchema>>
    >
  : Exclude<
      SchemaContextualGroupIds<TSchema>,
      Extract<SelectionExcludedIds<TSelection>, SchemaContextualGroupIds<TSchema>>
    >;
type SelectedSchemaContext<
  TSchema extends AnySchemaDefinition,
  TSelection extends TableSelection<SchemaSelectableIds<TSchema>> | undefined,
> = Pick<SchemaResolvedContext<TSchema>, SelectedGroupIds<TSchema, TSelection>>;
type WorkbookTableContextField<
  TSchema extends AnySchemaDefinition,
  TSelection extends TableSelection<SchemaSelectableIds<TSchema>> | undefined = undefined,
> = [SelectedGroupIds<TSchema, TSelection>] extends [never]
  ? { context?: SelectedSchemaContext<TSchema, TSelection> }
  : { context: SelectedSchemaContext<TSchema, TSelection> };

export interface WorkbookSheetOptions extends SheetLayoutOptions, SheetViewOptions {}

export interface WorkbookTableInput<
  TSchema extends AnySchemaDefinition,
  TSelection extends TableSelection<SchemaSelectableIds<TSchema>> | undefined = undefined,
> extends Omit<
  BufferedTableInput<SchemaRow<TSchema>, SchemaColumnIds<TSchema>>,
  "schema" | "select" | "context"
> {
  schema: TSchema;
  select?: TSelection;
}
export type WorkbookTableOptions<
  TSchema extends AnySchemaDefinition,
  TSelection extends TableSelection<SchemaSelectableIds<TSchema>> | undefined = undefined,
> = WorkbookTableInput<TSchema, TSelection> & WorkbookTableContextField<TSchema, TSelection>;

export interface Workbook {
  sheet(name: string, options?: WorkbookSheetOptions): WorkbookSheet;
  toUint8Array(): Uint8Array;
  toBuffer(): Buffer;
  writeToFile(filePath: string): Promise<void>;
}

export interface WorkbookSheet {
  table<
    TSchema extends AnySchemaDefinition,
    const TSelection extends TableSelection<SchemaSelectableIds<TSchema>> | undefined = undefined,
  >(
    input: WorkbookTableOptions<TSchema, TSelection>,
  ): WorkbookSheet;
}

export interface WorkbookStreamOptions {
  tempStorage?: "file" | "memory";
  tempDirectory?: string;
  strings?: WorkbookStreamStringMode;
  memoryProfile?: WorkbookStreamMemoryProfile;
}

export type WorkbookStreamStringMode = "auto" | "inline" | "shared";
export type WorkbookStreamMemoryProfile = "balanced" | "low-memory" | "compact-file";

export interface WorkbookStreamSheetOptions extends SheetViewOptions {}

export interface WorkbookStreamTableOptions<
  TSchema extends AnySchemaDefinition,
  TSelection extends TableSelection<SchemaSelectableIds<TSchema>> | undefined = undefined,
> {
  id: string;
  schema: TSchema;
  select?: TSelection;
  autoFilter?: boolean | TableAutoFilterOptions;
}
export type WorkbookStreamResolvedTableOptions<
  TSchema extends AnySchemaDefinition,
  TSelection extends TableSelection<SchemaSelectableIds<TSchema>> | undefined = undefined,
> = WorkbookStreamTableOptions<TSchema, TSelection> &
  WorkbookTableContextField<TSchema, TSelection>;

export interface WorkbookCommitBatch<TRow extends object> {
  rows: TRow[];
}

export interface WorkbookTableStream<TRow extends object> {
  commit(batch: WorkbookCommitBatch<TRow>): Promise<void>;
}

export interface WorkbookSheetStream {
  table<
    TSchema extends AnySchemaDefinition,
    const TSelection extends TableSelection<SchemaSelectableIds<TSchema>> | undefined = undefined,
  >(
    options: WorkbookStreamResolvedTableOptions<TSchema, TSelection>,
  ): Promise<WorkbookTableStream<SchemaRow<TSchema>>>;
}

export interface WorkbookStream {
  sheet(name: string, options?: WorkbookStreamSheetOptions): WorkbookSheetStream;
  writeToFile(filePath: string): Promise<void>;
  pipeTo(stream: WritableStream<Uint8Array>): Promise<void>;
  pipeToNode(stream: NodeJS.WritableStream): Promise<void>;
  toReadableStream(): ReadableStream<Uint8Array>;
  toNodeReadable(): NodeJS.ReadableStream;
}

class PublicWorkbookSheet implements WorkbookSheet {
  constructor(private readonly sheetBuilder: ReturnType<BufferedWorkbookBuilder["sheet"]>) {}

  table<
    TSchema extends AnySchemaDefinition,
    const TSelection extends TableSelection<SchemaSelectableIds<TSchema>> | undefined = undefined,
  >(input: WorkbookTableOptions<TSchema, TSelection>) {
    this.sheetBuilder.table(input);
    return this;
  }
}

class PublicWorkbook implements Workbook {
  private readonly workbook = BufferedWorkbookBuilder.create();

  sheet(name: string, options?: WorkbookSheetOptions) {
    const sheetBuilder = this.workbook.sheet(name);
    if (options) {
      sheetBuilder.options(options);
    }

    return new PublicWorkbookSheet(sheetBuilder);
  }

  toUint8Array() {
    return this.workbook.buildXlsx();
  }

  toBuffer() {
    return Buffer.from(this.toUint8Array());
  }

  async writeToFile(filePath: string) {
    await writeFile(filePath, this.toBuffer());
  }
}

class WorkbookTableStreamAdapter<TRow extends object> implements WorkbookTableStream<TRow> {
  constructor(
    private readonly table: { commit(batch: WorkbookCommitBatch<TRow>): Promise<void> },
  ) {}

  async commit(batch: WorkbookCommitBatch<TRow>) {
    await this.table.commit(batch);
  }
}

class WorkbookSheetStreamAdapter implements WorkbookSheetStream {
  constructor(private readonly sheetBuilder: ReturnType<StreamWorkbookBuilder["sheet"]>) {}

  async table<
    TSchema extends AnySchemaDefinition,
    const TSelection extends TableSelection<SchemaSelectableIds<TSchema>> | undefined = undefined,
  >(options: WorkbookStreamResolvedTableOptions<TSchema, TSelection>) {
    const table = await this.sheetBuilder.table(options);
    return new WorkbookTableStreamAdapter<SchemaRow<TSchema>>(table);
  }
}

class PublicWorkbookStream implements WorkbookStream {
  private readonly workbook: StreamWorkbookBuilder;
  private outputStarted = false;

  constructor(options: WorkbookStreamOptions = {}) {
    const spoolFactory =
      options.tempStorage === "memory"
        ? new MemorySpoolFactory()
        : new FileSpoolFactory(options.tempDirectory);
    const stringMode = resolveStringMode(options);

    this.workbook = StreamWorkbookBuilder.create({ spoolFactory, stringMode });
  }

  sheet(name: string, options?: WorkbookStreamSheetOptions) {
    return new WorkbookSheetStreamAdapter(this.workbook.sheet(name, options));
  }

  async writeToFile(filePath: string) {
    await this.finalizeWith(new FileWorkbookSink(filePath));
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
    const byteStream = this.createByteStreamOutput();
    return byteStream.toNodeReadable();
  }

  private createByteStreamOutput() {
    const byteStream = new WorkbookByteStream();
    this.startOutput(byteStream).catch((error) => {
      byteStream.fail(error instanceof Error ? error : new Error(String(error)));
    });
    return byteStream;
  }

  private async finalizeWith(
    sink: FileWorkbookSink | NodeWritableWorkbookSink | WebWritableWorkbookSink,
  ) {
    await this.startOutput(sink);
  }

  private async startOutput(sink: {
    write(chunk: Uint8Array): Promise<void>;
    close(): Promise<void>;
  }) {
    if (this.outputStarted) {
      throw new Error("Workbook stream output has already started.");
    }

    this.outputStarted = true;
    await this.workbook.finish(sink);
  }
}

export function createExcelSchema<T extends object>() {
  return SchemaBuilder.create<T>();
}

export function createWorkbook(_options?: WorkbookOptions) {
  return new PublicWorkbook();
}

export function createWorkbookStream(options?: WorkbookStreamOptions) {
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
