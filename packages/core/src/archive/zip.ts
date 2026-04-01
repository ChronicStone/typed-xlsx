const SIG_LOCAL_FILE = 0x04034b50;
const SIG_CENTRAL_DIR = 0x02014b50;
const SIG_END_OF_CENTRAL_DIR = 0x06054b50;
const SIG_DATA_DESCRIPTOR = 0x08074b50;

export function crc32(bytes: Uint8Array) {
  let crc = -1;

  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i]!;

    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ -1) >>> 0;
}

interface ZipEntry {
  path: string;
  data: Uint8Array;
}

interface StreamingZipEntry {
  path: string;
  offset: number;
  crc32: number;
  size: number;
}

export interface ZipChunkSink {
  write(chunk: Uint8Array): Promise<void>;
}

export type ZipEntrySource = Uint8Array | string | AsyncIterable<Uint8Array>;

export class ZipBuilder {
  private readonly entries: ZipEntry[] = [];

  add(path: string, data: Uint8Array) {
    this.entries.push({ path, data });
  }

  build() {
    const encoder = new TextEncoder();
    const encodedPaths = this.entries.map((entry) => encoder.encode(entry.path));

    let localSize = 0;
    let centralSize = 0;

    for (let i = 0; i < this.entries.length; i += 1) {
      localSize += 30 + encodedPaths[i]!.length + this.entries[i]!.data.length;
      centralSize += 46 + encodedPaths[i]!.length;
    }

    const totalSize = localSize + centralSize + 22;
    const output = new Uint8Array(totalSize);
    const view = new DataView(output.buffer);
    const localOffsets: number[] = [];

    let offset = 0;

    for (let i = 0; i < this.entries.length; i += 1) {
      const entry = this.entries[i]!;
      const path = encodedPaths[i]!;
      const checksum = crc32(entry.data);

      localOffsets.push(offset);

      view.setUint32(offset, SIG_LOCAL_FILE, true);
      view.setUint16(offset + 4, 20, true);
      view.setUint16(offset + 6, 0, true);
      view.setUint16(offset + 8, 0, true);
      view.setUint16(offset + 10, 0, true);
      view.setUint16(offset + 12, 0x0021, true);
      view.setUint32(offset + 14, checksum, true);
      view.setUint32(offset + 18, entry.data.length, true);
      view.setUint32(offset + 22, entry.data.length, true);
      view.setUint16(offset + 26, path.length, true);
      view.setUint16(offset + 28, 0, true);

      output.set(path, offset + 30);
      offset += 30 + path.length;

      output.set(entry.data, offset);
      offset += entry.data.length;
    }

    const centralDirOffset = offset;

    for (let i = 0; i < this.entries.length; i += 1) {
      const entry = this.entries[i]!;
      const path = encodedPaths[i]!;
      const checksum = crc32(entry.data);

      view.setUint32(offset, SIG_CENTRAL_DIR, true);
      view.setUint16(offset + 4, 20, true);
      view.setUint16(offset + 6, 20, true);
      view.setUint16(offset + 8, 0, true);
      view.setUint16(offset + 10, 0, true);
      view.setUint16(offset + 12, 0, true);
      view.setUint16(offset + 14, 0x0021, true);
      view.setUint32(offset + 16, checksum, true);
      view.setUint32(offset + 20, entry.data.length, true);
      view.setUint32(offset + 24, entry.data.length, true);
      view.setUint16(offset + 28, path.length, true);
      view.setUint16(offset + 30, 0, true);
      view.setUint16(offset + 32, 0, true);
      view.setUint16(offset + 34, 0, true);
      view.setUint16(offset + 36, 0, true);
      view.setUint32(offset + 38, 0, true);
      view.setUint32(offset + 42, localOffsets[i]!, true);

      output.set(path, offset + 46);
      offset += 46 + path.length;
    }

    const centralDirSize = offset - centralDirOffset;

    view.setUint32(offset, SIG_END_OF_CENTRAL_DIR, true);
    view.setUint16(offset + 4, 0, true);
    view.setUint16(offset + 6, 0, true);
    view.setUint16(offset + 8, this.entries.length, true);
    view.setUint16(offset + 10, this.entries.length, true);
    view.setUint32(offset + 12, centralDirSize, true);
    view.setUint32(offset + 16, centralDirOffset, true);
    view.setUint16(offset + 20, 0, true);

    return output;
  }
}

function encodePath(path: string) {
  return new TextEncoder().encode(path);
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

function createLocalFileHeader(path: Uint8Array) {
  const output = new Uint8Array(30 + path.length);
  const view = new DataView(output.buffer);

  writeUint32(view, 0, SIG_LOCAL_FILE);
  writeUint16(view, 4, 20);
  writeUint16(view, 6, 0x0008);
  writeUint16(view, 8, 0);
  writeUint16(view, 10, 0);
  writeUint16(view, 12, 0x0021);
  writeUint32(view, 14, 0);
  writeUint32(view, 18, 0);
  writeUint32(view, 22, 0);
  writeUint16(view, 26, path.length);
  writeUint16(view, 28, 0);
  output.set(path, 30);

  return output;
}

function createDataDescriptor(checksum: number, size: number) {
  const output = new Uint8Array(16);
  const view = new DataView(output.buffer);

  writeUint32(view, 0, SIG_DATA_DESCRIPTOR);
  writeUint32(view, 4, checksum);
  writeUint32(view, 8, size);
  writeUint32(view, 12, size);

  return output;
}

function createCentralDirectoryHeader(entry: StreamingZipEntry) {
  const path = encodePath(entry.path);
  const output = new Uint8Array(46 + path.length);
  const view = new DataView(output.buffer);

  writeUint32(view, 0, SIG_CENTRAL_DIR);
  writeUint16(view, 4, 20);
  writeUint16(view, 6, 20);
  writeUint16(view, 8, 0x0008);
  writeUint16(view, 10, 0);
  writeUint16(view, 12, 0);
  writeUint16(view, 14, 0x0021);
  writeUint32(view, 16, entry.crc32);
  writeUint32(view, 20, entry.size);
  writeUint32(view, 24, entry.size);
  writeUint16(view, 28, path.length);
  writeUint16(view, 30, 0);
  writeUint16(view, 32, 0);
  writeUint16(view, 34, 0);
  writeUint16(view, 36, 0);
  writeUint32(view, 38, 0);
  writeUint32(view, 42, entry.offset);
  output.set(path, 46);

  return output;
}

function createEndOfCentralDirectory(
  entryCount: number,
  centralDirectorySize: number,
  centralDirectoryOffset: number,
) {
  const output = new Uint8Array(22);
  const view = new DataView(output.buffer);

  writeUint32(view, 0, SIG_END_OF_CENTRAL_DIR);
  writeUint16(view, 4, 0);
  writeUint16(view, 6, 0);
  writeUint16(view, 8, entryCount);
  writeUint16(view, 10, entryCount);
  writeUint32(view, 12, centralDirectorySize);
  writeUint32(view, 16, centralDirectoryOffset);
  writeUint16(view, 20, 0);

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

export class ZipStreamWriter {
  private readonly entries: StreamingZipEntry[] = [];
  private offset = 0;

  constructor(private readonly sink: ZipChunkSink) {}

  async add(path: string, source: ZipEntrySource) {
    const encodedPath = encodePath(path);
    const localHeader = createLocalFileHeader(encodedPath);
    const entryOffset = this.offset;

    await this.sink.write(localHeader);
    this.offset += localHeader.length;

    let checksum = -1;
    let size = 0;

    for await (const chunk of toAsyncChunks(source)) {
      checksum = updateCrc32(checksum, chunk);
      size += chunk.length;
      await this.sink.write(chunk);
      this.offset += chunk.length;
    }

    const normalizedChecksum = (checksum ^ -1) >>> 0;
    const dataDescriptor = createDataDescriptor(normalizedChecksum, size);
    await this.sink.write(dataDescriptor);
    this.offset += dataDescriptor.length;

    this.entries.push({
      path,
      offset: entryOffset,
      crc32: normalizedChecksum,
      size,
    });
  }

  async finalize() {
    const centralDirectoryOffset = this.offset;
    let centralDirectorySize = 0;

    for (const entry of this.entries) {
      const header = createCentralDirectoryHeader(entry);
      centralDirectorySize += header.length;
      await this.sink.write(header);
      this.offset += header.length;
    }

    const end = createEndOfCentralDirectory(
      this.entries.length,
      centralDirectorySize,
      centralDirectoryOffset,
    );
    await this.sink.write(end);
    this.offset += end.length;
  }
}

function updateCrc32(current: number, bytes: Uint8Array) {
  let crc = current;

  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= bytes[index]!;

    for (let step = 0; step < 8; step += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return crc;
}
