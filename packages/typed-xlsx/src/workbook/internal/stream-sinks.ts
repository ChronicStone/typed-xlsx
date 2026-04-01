import { Readable } from "node:stream";
import type { StreamWorkbookSink } from "../types";

export class NodeWritableWorkbookSink implements StreamWorkbookSink {
  constructor(private readonly writable: NodeJS.WritableStream) {}

  async write(chunk: Uint8Array) {
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        this.writable.off("error", onError);
        reject(error);
      };

      this.writable.once("error", onError);
      const completed = this.writable.write(chunk, (error?: Error | null) => {
        this.writable.off("error", onError);
        if (error) {
          reject(error);
          return;
        }
        if (completed) {
          resolve();
        }
      });

      if (!completed) {
        this.writable.once("drain", () => {
          this.writable.off("error", onError);
          resolve();
        });
      }
    });
  }

  async close() {
    await new Promise<void>((resolve, reject) => {
      this.writable.end((error?: Error | null) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

export class WebWritableWorkbookSink implements StreamWorkbookSink {
  private readonly writer: WritableStreamDefaultWriter<Uint8Array>;

  constructor(stream: WritableStream<Uint8Array>) {
    this.writer = stream.getWriter();
  }

  async write(chunk: Uint8Array) {
    await this.writer.write(chunk);
  }

  async close() {
    await this.writer.close();
  }
}

export class WorkbookByteStream implements StreamWorkbookSink, AsyncIterable<Uint8Array> {
  private readonly chunks: Uint8Array[] = [];
  private readonly waiters: Array<(result: IteratorResult<Uint8Array>) => void> = [];
  private closed = false;
  private error: Error | undefined;

  async write(chunk: Uint8Array) {
    if (this.waiters.length > 0) {
      const resolve = this.waiters.shift()!;
      resolve({ done: false, value: chunk });
      return;
    }

    this.chunks.push(chunk);
  }

  async close() {
    this.closed = true;

    while (this.waiters.length > 0) {
      const resolve = this.waiters.shift()!;
      resolve({ done: true, value: undefined });
    }
  }

  fail(error: Error) {
    this.error = error;
    this.closed = true;

    while (this.waiters.length > 0) {
      const resolve = this.waiters.shift()!;
      resolve({ done: true, value: undefined });
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
    while (true) {
      if (this.chunks.length > 0) {
        yield this.chunks.shift()!;
        continue;
      }

      if (this.closed) {
        if (this.error) {
          throw this.error;
        }
        return;
      }

      const next = await new Promise<IteratorResult<Uint8Array>>((resolve) => {
        this.waiters.push(resolve);
      });

      if (next.done) {
        if (this.error) {
          throw this.error;
        }
        return;
      }

      yield next.value;
    }
  }

  toNodeReadable() {
    return Readable.from(this);
  }

  toReadableStream() {
    const iterator = this[Symbol.asyncIterator]();

    return new ReadableStream<Uint8Array>({
      async pull(controller) {
        const next = await iterator.next();
        if (next.done) {
          controller.close();
          return;
        }
        controller.enqueue(next.value);
      },
      async cancel() {
        if (typeof iterator.return === "function") {
          await iterator.return();
        }
      },
    });
  }
}
