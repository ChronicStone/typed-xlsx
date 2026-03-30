import fsp from "node:fs/promises";
import path from "node:path";
import type { StreamWorkbookSink } from "../types";

export class FileWorkbookSink implements StreamWorkbookSink {
  private initialized = false;

  constructor(readonly filePath: string) {}

  async write(chunk: Uint8Array) {
    await fsp.mkdir(path.dirname(this.filePath), { recursive: true });

    if (!this.initialized) {
      await fsp.writeFile(this.filePath, chunk);
      this.initialized = true;
      return;
    }

    await fsp.appendFile(this.filePath, chunk);
  }

  async close() {}
}
