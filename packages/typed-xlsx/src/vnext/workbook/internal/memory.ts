import type { StreamSheetSpool, StreamSpoolFactory, StreamWorkbookSink } from "../types";

export class MemorySheetSpool implements StreamSheetSpool {
  readonly chunks: Uint8Array[] = [];
  closed = false;

  async append(chunk: Uint8Array) {
    this.chunks.push(chunk);
  }

  async *read(): AsyncIterable<Uint8Array> {
    for (const chunk of this.chunks) {
      yield chunk;
    }
  }

  async close() {
    this.closed = true;
  }
}

export class MemorySpoolFactory implements StreamSpoolFactory {
  readonly spools = new Map<string, MemorySheetSpool>();

  async create(sheetName: string) {
    const spool = new MemorySheetSpool();
    this.spools.set(sheetName, spool);
    return spool;
  }
}

export class MemoryWorkbookSink implements StreamWorkbookSink {
  readonly chunks: Uint8Array[] = [];
  closed = false;

  async write(chunk: Uint8Array) {
    this.chunks.push(chunk);
  }

  async close() {
    this.closed = true;
  }
}
