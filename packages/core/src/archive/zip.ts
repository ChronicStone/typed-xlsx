const SIG_LOCAL_FILE = 0x04034b50;
const SIG_CENTRAL_DIR = 0x02014b50;
const SIG_END_OF_CENTRAL_DIR = 0x06054b50;
const SIG_DATA_DESCRIPTOR = 0x08074b50;
const FLAG_DATA_DESCRIPTOR = 0x0008;
const DOS_EPOCH_DATE = 0x0021;
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;
const ZIP_VERSION = 20;

const CRC_TABLE = createCrcTable();

function createCrcTable() {
  const table = new Uint32Array(256);

  for (let n = 0; n < 256; n += 1) {
    let value = n;

    for (let k = 0; k < 8; k += 1) {
      value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
    }

    table[n] = value >>> 0;
  }

  return table;
}

function updateCrc32(current: number, bytes: Uint8Array) {
  let crc = current;

  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]!) & 0xff]! ^ (crc >>> 8);
  }

  return crc;
}

export function crc32(bytes: Uint8Array) {
  return (updateCrc32(-1, bytes) ^ -1) >>> 0;
}

type SyncDeflate = (bytes: Uint8Array) => Uint8Array;

interface ZlibModuleLike {
  deflateRawSync?: (bytes: Uint8Array) => Uint8Array;
}

function getBuiltinModule(specifier: string) {
  const processLike = (globalThis as { process?: { getBuiltinModule?: (name: string) => unknown } })
    .process;

  try {
    return processLike?.getBuiltinModule?.(specifier);
  } catch {
    return undefined;
  }
}

export function resolveSyncDeflate(): SyncDeflate | undefined {
  const zlib = (getBuiltinModule("node:zlib") ?? getBuiltinModule("zlib")) as
    | ZlibModuleLike
    | undefined;
  const deflateRawSync = zlib?.deflateRawSync;

  if (typeof deflateRawSync !== "function") {
    return undefined;
  }

  return (bytes) => deflateRawSync(bytes);
}

export function createDeflateRawStream(): TransformStream<Uint8Array, Uint8Array> | undefined {
  const CompressionStreamConstructor = (
    globalThis as {
      CompressionStream?: new (format: string) => TransformStream<Uint8Array, Uint8Array>;
    }
  ).CompressionStream;

  if (typeof CompressionStreamConstructor !== "function") {
    return undefined;
  }

  try {
    return new CompressionStreamConstructor("deflate-raw");
  } catch {
    return undefined;
  }
}

interface ZipEntry {
  path: string;
  data: Uint8Array;
}

interface StreamingZipEntry {
  path: Uint8Array;
  offset: number;
  crc32: number;
  method: number;
  compressedSize: number;
  size: number;
}

export interface ZipChunkSink {
  write(chunk: Uint8Array): Promise<void>;
}

export type ZipEntrySource = Uint8Array | string | AsyncIterable<Uint8Array>;

function encodePath(path: string) {
  return new TextEncoder().encode(path);
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

function writeLocalFileHeader(
  view: DataView,
  offset: number,
  entry: {
    path: Uint8Array;
    flags: number;
    method: number;
    crc32: number;
    compressedSize: number;
    size: number;
  },
) {
  writeUint32(view, offset, SIG_LOCAL_FILE);
  writeUint16(view, offset + 4, ZIP_VERSION);
  writeUint16(view, offset + 6, entry.flags);
  writeUint16(view, offset + 8, entry.method);
  writeUint16(view, offset + 10, 0);
  writeUint16(view, offset + 12, DOS_EPOCH_DATE);
  writeUint32(view, offset + 14, entry.crc32);
  writeUint32(view, offset + 18, entry.compressedSize);
  writeUint32(view, offset + 22, entry.size);
  writeUint16(view, offset + 26, entry.path.length);
  writeUint16(view, offset + 28, 0);
}

function writeCentralDirectoryHeader(
  view: DataView,
  offset: number,
  entry: {
    path: Uint8Array;
    flags: number;
    method: number;
    crc32: number;
    compressedSize: number;
    size: number;
    localOffset: number;
  },
) {
  writeUint32(view, offset, SIG_CENTRAL_DIR);
  writeUint16(view, offset + 4, ZIP_VERSION);
  writeUint16(view, offset + 6, ZIP_VERSION);
  writeUint16(view, offset + 8, entry.flags);
  writeUint16(view, offset + 10, entry.method);
  writeUint16(view, offset + 12, 0);
  writeUint16(view, offset + 14, DOS_EPOCH_DATE);
  writeUint32(view, offset + 16, entry.crc32);
  writeUint32(view, offset + 20, entry.compressedSize);
  writeUint32(view, offset + 24, entry.size);
  writeUint16(view, offset + 28, entry.path.length);
  writeUint16(view, offset + 30, 0);
  writeUint16(view, offset + 32, 0);
  writeUint16(view, offset + 34, 0);
  writeUint16(view, offset + 36, 0);
  writeUint32(view, offset + 38, 0);
  writeUint32(view, offset + 42, entry.localOffset);
}

function writeEndOfCentralDirectory(
  view: DataView,
  offset: number,
  entryCount: number,
  centralDirectorySize: number,
  centralDirectoryOffset: number,
) {
  writeUint32(view, offset, SIG_END_OF_CENTRAL_DIR);
  writeUint16(view, offset + 4, 0);
  writeUint16(view, offset + 6, 0);
  writeUint16(view, offset + 8, entryCount);
  writeUint16(view, offset + 10, entryCount);
  writeUint32(view, offset + 12, centralDirectorySize);
  writeUint32(view, offset + 16, centralDirectoryOffset);
  writeUint16(view, offset + 20, 0);
}

export class ZipBuilder {
  private readonly entries: ZipEntry[] = [];

  add(path: string, data: Uint8Array) {
    this.entries.push({ path, data });
  }

  build() {
    const deflate = resolveSyncDeflate();
    const prepared = this.entries.map((entry) => {
      const compressed = deflate ? deflate(entry.data) : entry.data;
      const useDeflate = deflate !== undefined && compressed.length < entry.data.length;

      return {
        path: encodePath(entry.path),
        flags: 0,
        method: useDeflate ? METHOD_DEFLATE : METHOD_STORED,
        crc32: crc32(entry.data),
        payload: useDeflate ? compressed : entry.data,
        size: entry.data.length,
      };
    });

    let localSize = 0;
    let centralSize = 0;

    for (const entry of prepared) {
      localSize += 30 + entry.path.length + entry.payload.length;
      centralSize += 46 + entry.path.length;
    }

    const output = new Uint8Array(localSize + centralSize + 22);
    const view = new DataView(output.buffer);
    const localOffsets: number[] = [];
    let offset = 0;

    for (const entry of prepared) {
      localOffsets.push(offset);
      writeLocalFileHeader(view, offset, { ...entry, compressedSize: entry.payload.length });
      output.set(entry.path, offset + 30);
      offset += 30 + entry.path.length;
      output.set(entry.payload, offset);
      offset += entry.payload.length;
    }

    const centralDirectoryOffset = offset;

    prepared.forEach((entry, index) => {
      writeCentralDirectoryHeader(view, offset, {
        ...entry,
        compressedSize: entry.payload.length,
        localOffset: localOffsets[index]!,
      });
      output.set(entry.path, offset + 46);
      offset += 46 + entry.path.length;
    });

    writeEndOfCentralDirectory(
      view,
      offset,
      prepared.length,
      offset - centralDirectoryOffset,
      centralDirectoryOffset,
    );

    return output;
  }
}

function createStreamingLocalFileHeader(path: Uint8Array, method: number) {
  const output = new Uint8Array(30 + path.length);
  writeLocalFileHeader(new DataView(output.buffer), 0, {
    path,
    flags: FLAG_DATA_DESCRIPTOR,
    method,
    crc32: 0,
    compressedSize: 0,
    size: 0,
  });
  output.set(path, 30);

  return output;
}

function createDataDescriptor(checksum: number, compressedSize: number, size: number) {
  const output = new Uint8Array(16);
  const view = new DataView(output.buffer);

  writeUint32(view, 0, SIG_DATA_DESCRIPTOR);
  writeUint32(view, 4, checksum);
  writeUint32(view, 8, compressedSize);
  writeUint32(view, 12, size);

  return output;
}

function createStreamingCentralDirectoryHeader(entry: StreamingZipEntry) {
  const output = new Uint8Array(46 + entry.path.length);
  writeCentralDirectoryHeader(new DataView(output.buffer), 0, {
    path: entry.path,
    flags: FLAG_DATA_DESCRIPTOR,
    method: entry.method,
    crc32: entry.crc32,
    compressedSize: entry.compressedSize,
    size: entry.size,
    localOffset: entry.offset,
  });
  output.set(entry.path, 46);

  return output;
}

async function* toAsyncChunks(source: ZipEntrySource): AsyncIterable<Uint8Array> {
  if (typeof source === "string") {
    yield new TextEncoder().encode(source);
    return;
  }

  if (source instanceof Uint8Array) {
    yield source;
    return;
  }

  for await (const chunk of source) {
    yield chunk;
  }
}

function ignore() {}

export class ZipStreamWriter {
  private readonly entries: StreamingZipEntry[] = [];
  private offset = 0;

  constructor(private readonly sink: ZipChunkSink) {}

  async add(path: string, source: ZipEntrySource) {
    const encodedPath = encodePath(path);
    const compressor = createDeflateRawStream();
    const method = compressor ? METHOD_DEFLATE : METHOD_STORED;
    const localHeader = createStreamingLocalFileHeader(encodedPath, method);
    const entryOffset = this.offset;

    await this.write(localHeader);

    let checksum = -1;
    let size = 0;
    let compressedSize = 0;

    if (compressor) {
      const writer = compressor.writable.getWriter();
      const reader = compressor.readable.getReader();
      let drainError: unknown;
      const drained = (async () => {
        while (true) {
          const next = await reader.read();
          if (next.done) {
            return;
          }
          compressedSize += next.value.length;
          await this.write(next.value);
        }
      })().catch((error: unknown) => {
        drainError = error;
        reader.cancel(error).catch(ignore);
      });

      try {
        for await (const chunk of toAsyncChunks(source)) {
          checksum = updateCrc32(checksum, chunk);
          size += chunk.length;
          await writer.write(chunk);
        }
        await writer.close();
      } catch (error) {
        writer.abort(error).catch(ignore);
        await drained;
        throw drainError ?? error;
      }

      await drained;

      if (drainError !== undefined) {
        throw drainError;
      }
    } else {
      for await (const chunk of toAsyncChunks(source)) {
        checksum = updateCrc32(checksum, chunk);
        size += chunk.length;
        await this.write(chunk);
      }

      compressedSize = size;
    }

    const normalizedChecksum = (checksum ^ -1) >>> 0;
    await this.write(createDataDescriptor(normalizedChecksum, compressedSize, size));

    this.entries.push({
      path: encodedPath,
      offset: entryOffset,
      crc32: normalizedChecksum,
      method,
      compressedSize,
      size,
    });
  }

  async finalize() {
    const centralDirectoryOffset = this.offset;

    for (const entry of this.entries) {
      await this.write(createStreamingCentralDirectoryHeader(entry));
    }

    const end = new Uint8Array(22);
    writeEndOfCentralDirectory(
      new DataView(end.buffer),
      0,
      this.entries.length,
      this.offset - centralDirectoryOffset,
      centralDirectoryOffset,
    );
    await this.write(end);
  }

  private async write(chunk: Uint8Array) {
    await this.sink.write(chunk);
    this.offset += chunk.length;
  }
}
