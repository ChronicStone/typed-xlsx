import type { StreamWorkbookSink } from "../types";

const nodeStreamSpecifier = `${"node:"}stream`;

type NodeReadableModule = {
  Readable: {
    from(source: AsyncIterable<Uint8Array>): NodeJS.ReadableStream;
  };
};

function isNodeReadableModule(value: unknown): value is NodeReadableModule {
  const readable = (value as { Readable?: unknown } | undefined)?.Readable;
  const readableFrom = (readable as { from?: unknown } | undefined)?.from;

  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    typeof readable === "function" &&
    typeof readableFrom === "function"
  );
}

function getNodeReadableModule() {
  const processLike =
    typeof process === "object"
      ? process
      : ((globalThis as { process?: { getBuiltinModule?: (specifier: string) => unknown } })
          .process ?? undefined);

  const builtInModule =
    processLike?.getBuiltinModule?.(nodeStreamSpecifier) ??
    processLike?.getBuiltinModule?.("stream");

  if (isNodeReadableModule(builtInModule)) {
    return builtInModule;
  }

  const requireLike = (globalThis as { require?: unknown }).require;
  if (typeof requireLike === "function") {
    const requiredModule = requireLike(nodeStreamSpecifier);
    if (isNodeReadableModule(requiredModule)) {
      return requiredModule;
    }
  }

  throw new Error(
    "toNodeReadable() requires a Node.js-compatible stream module. Use toReadableStream() in browser runtimes.",
  );
}

const DESTINATION_CLOSED_MESSAGE =
  "The destination stream closed before the workbook was fully written.";
const STREAM_CANCELLED_MESSAGE = "The workbook stream was cancelled by its reader.";
// Number of queued chunks after which write() waits for the reader.
const BYTE_STREAM_HIGH_WATER_MARK = 16;

type DestroyableWritable = NodeJS.WritableStream & {
  destroyed?: boolean;
  writableEnded?: boolean;
  destroy?(error?: Error): unknown;
};

export class NodeWritableWorkbookSink implements StreamWorkbookSink {
  constructor(private readonly writable: DestroyableWritable) {}

  async write(chunk: Uint8Array) {
    const writable = this.writable;
    if (writable.destroyed || writable.writableEnded) {
      throw new Error(DESTINATION_CLOSED_MESSAGE);
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let waitingForDrain = false;

      const cleanup = () => {
        writable.off("error", onError);
        writable.off("close", onClose);
        writable.off("drain", onDrain);
      };
      const settle = (error?: Error | null) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) {
          reject(error);
          return;
        }
        resolve();
      };
      const onError = (error: Error) => settle(error);
      const onClose = () => settle(new Error(DESTINATION_CLOSED_MESSAGE));
      const onDrain = () => settle();

      writable.once("error", onError);
      writable.once("close", onClose);
      const flushed = writable.write(chunk, (error?: Error | null) => {
        if (error) {
          settle(error);
          return;
        }
        if (!waitingForDrain) {
          settle();
        }
      });

      if (!flushed && !settled) {
        waitingForDrain = true;
        writable.once("drain", onDrain);
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

  abort(error: Error) {
    if (!this.writable.destroy || this.writable.destroyed) return;
    // The export promise already rejects with this error; without a listener, destroy(error)
    // would also raise it as an uncaught 'error' event.
    this.writable.once("error", () => {});
    this.writable.destroy(error);
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

  async abort(error: Error) {
    await this.writer.abort(error);
  }
}

export class WorkbookByteStream implements StreamWorkbookSink, AsyncIterable<Uint8Array> {
  private readonly chunks: Uint8Array[] = [];
  private readonly waiters: Array<(result: IteratorResult<Uint8Array>) => void> = [];
  private readonly drainWaiters: Array<() => void> = [];
  private closed = false;
  private cancelled = false;
  private error: Error | undefined;

  async write(chunk: Uint8Array) {
    if (this.cancelled) {
      throw new Error(STREAM_CANCELLED_MESSAGE);
    }

    if (this.waiters.length > 0) {
      const resolve = this.waiters.shift()!;
      resolve({ done: false, value: chunk });
      return;
    }

    this.chunks.push(chunk);

    // Wait for the reader instead of queueing the whole workbook in memory.
    while (this.chunks.length >= BYTE_STREAM_HIGH_WATER_MARK && !this.cancelled && !this.closed) {
      await new Promise<void>((resolve) => {
        this.drainWaiters.push(resolve);
      });
    }

    if (this.cancelled) {
      throw new Error(STREAM_CANCELLED_MESSAGE);
    }
  }

  async close() {
    this.closed = true;
    this.releaseWaiters();
  }

  abort(error: Error) {
    this.error = error;
    this.closed = true;
    this.releaseWaiters();
  }

  /** The reader is gone: drop queued chunks and make the producer's next write throw. */
  private cancel() {
    this.cancelled = true;
    this.chunks.length = 0;
    this.releaseWaiters();
  }

  private releaseWaiters() {
    while (this.waiters.length > 0) {
      const resolve = this.waiters.shift()!;
      resolve({ done: true, value: undefined });
    }
    this.releaseDrainWaiters();
  }

  private releaseDrainWaiters() {
    while (this.drainWaiters.length > 0) {
      const resolve = this.drainWaiters.shift()!;
      resolve();
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
    try {
      while (true) {
        if (this.chunks.length > 0) {
          const chunk = this.chunks.shift()!;
          if (this.chunks.length < BYTE_STREAM_HIGH_WATER_MARK) {
            this.releaseDrainWaiters();
          }
          yield chunk;
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
    } finally {
      // Leaving the loop early (return() or a reader that stopped) must stop the producer.
      if (!this.closed) {
        this.cancel();
      }
    }
  }

  toNodeReadable(): NodeJS.ReadableStream {
    const { Readable } = getNodeReadableModule();
    return Readable.from(this);
  }

  toReadableStream() {
    const iterator = this[Symbol.asyncIterator]();

    return new ReadableStream<Uint8Array>({
      pull: async (controller) => {
        const next = await iterator.next();
        if (next.done) {
          controller.close();
          return;
        }
        controller.enqueue(next.value);
      },
      cancel: async () => {
        // Release a pending read first: return() waits behind it otherwise.
        this.cancel();
        if (typeof iterator.return === "function") {
          await iterator.return();
        }
      },
    });
  }
}
