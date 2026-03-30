import { writeFile } from "node:fs/promises";
import type { SchemaContext, SchemaDefinition } from "./vnext/schema/builder";
import { SchemaBuilder } from "./vnext/schema/builder";
import { BufferedWorkbookBuilder } from "./vnext/workbook/buffered";
import { StreamWorkbookBuilder } from "./vnext/workbook/stream";
import type {
  BufferedTableInput,
  SheetLayoutOptions,
  SheetViewOptions,
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

export interface WorkbookSheetOptions extends SheetLayoutOptions, SheetViewOptions {}

export interface WorkbookTableInput<T extends object> extends Omit<
  BufferedTableInput<T>,
  "select"
> {
  select?: TableSelection;
  context?: SchemaContext;
}

export interface Workbook {
  sheet(name: string, options?: WorkbookSheetOptions): WorkbookSheet;
  toUint8Array(): Uint8Array;
  toBuffer(): Buffer;
  writeToFile(filePath: string): Promise<void>;
}

export interface WorkbookSheet {
  table<T extends object>(input: WorkbookTableInput<T>): WorkbookSheet;
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

export interface WorkbookStreamTableOptions<T extends object> {
  id: string;
  schema: SchemaDefinition<T>;
  select?: TableSelection;
  context?: SchemaContext;
}

export interface WorkbookCommitBatch<T extends object> {
  rows: T[];
}

export interface WorkbookTableStream<T extends object> {
  commit(batch: WorkbookCommitBatch<T>): Promise<void>;
}

export interface WorkbookSheetStream {
  table<T extends object>(options: WorkbookStreamTableOptions<T>): Promise<WorkbookTableStream<T>>;
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

  table<T extends object>(input: WorkbookTableInput<T>) {
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

class WorkbookTableStreamAdapter<T extends object> implements WorkbookTableStream<T> {
  constructor(private readonly table: { commit(batch: WorkbookCommitBatch<T>): Promise<void> }) {}

  async commit(batch: WorkbookCommitBatch<T>) {
    await this.table.commit(batch);
  }
}

class WorkbookSheetStreamAdapter implements WorkbookSheetStream {
  constructor(private readonly sheetBuilder: ReturnType<StreamWorkbookBuilder["sheet"]>) {}

  async table<T extends object>(options: WorkbookStreamTableOptions<T>) {
    const table = await this.sheetBuilder.table(options);
    return new WorkbookTableStreamAdapter<T>(table);
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
