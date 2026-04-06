import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { StreamSheetSpool, StreamSpoolFactory } from "../types";

function sanitizeName(value: string) {
  return value.replaceAll(/[^a-zA-Z0-9._-]/g, "_");
}

export class FileSheetSpool implements StreamSheetSpool {
  private readonly handlePromise: Promise<fsp.FileHandle>;
  private closed = false;

  constructor(readonly filePath: string) {
    this.handlePromise = fsp.open(this.filePath, "a+");
  }

  async append(chunk: Uint8Array) {
    const handle = await this.handlePromise;
    await handle.write(chunk, 0, chunk.length, null);
  }

  async *read(): AsyncIterable<Uint8Array> {
    const stream = fs.createReadStream(this.filePath);

    for await (const chunk of stream) {
      yield chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
    }
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    const handle = await this.handlePromise;
    await handle.close();
  }
}

export class FileSpoolFactory implements StreamSpoolFactory {
  readonly directory: string;

  constructor(directory?: string) {
    this.directory =
      directory ?? path.join(os.tmpdir(), `xlsmith-spool-${Date.now().toString(36)}`);
  }

  async create(sheetName: string): Promise<StreamSheetSpool> {
    await fsp.mkdir(this.directory, { recursive: true });
    const filePath = path.join(this.directory, `${sanitizeName(sheetName)}.spool`);
    await fsp.writeFile(filePath, "");
    return new FileSheetSpool(filePath);
  }
}
