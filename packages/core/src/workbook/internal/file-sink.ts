import fsp from "node:fs/promises";
import path from "node:path";
import type { StreamWorkbookSink } from "../types";

export class FileWorkbookSink implements StreamWorkbookSink {
  private handlePromise: Promise<fsp.FileHandle> | undefined;

  constructor(readonly filePath: string) {}

  private async handle() {
    this.handlePromise ??= (async () => {
      await fsp.mkdir(path.dirname(this.filePath), { recursive: true });
      return await fsp.open(this.filePath, "w");
    })();
    return await this.handlePromise;
  }

  async write(chunk: Uint8Array) {
    const handle = await this.handle();
    await handle.write(chunk, 0, chunk.length, null);
  }

  async close() {
    const handle = await this.handle();
    await handle.close();
  }
}
