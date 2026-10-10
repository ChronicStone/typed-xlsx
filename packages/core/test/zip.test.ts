import { crc32 as zlibCrc32, inflateRawSync } from "node:zlib";
import { unzipSync } from "fflate";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { crc32, ZipBuilder, ZipStreamWriter } from "../src/archive/zip";

const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;

class ChunkSink {
  readonly chunks: Uint8Array[] = [];

  async write(chunk: Uint8Array) {
    this.chunks.push(chunk);
  }

  bytes() {
    return Buffer.concat(this.chunks.map((chunk) => Buffer.from(chunk)));
  }
}

function readLocalEntries(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries: Array<{
    path: string;
    method: number;
    flags: number;
    crc32: number;
    compressedSize: number;
    size: number;
    payload: Uint8Array;
  }> = [];
  let offset = 0;

  while (view.getUint32(offset, true) === 0x04034b50) {
    const flags = view.getUint16(offset + 6, true);
    const method = view.getUint16(offset + 8, true);
    const pathLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const path = new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + pathLength));
    const dataStart = offset + 30 + pathLength + extraLength;
    let crc = view.getUint32(offset + 14, true);
    let compressedSize = view.getUint32(offset + 18, true);
    let size = view.getUint32(offset + 22, true);
    let payloadEnd = dataStart + compressedSize;

    if (flags & 0x0008) {
      let cursor = dataStart;
      while (view.getUint32(cursor, true) !== 0x08074b50) {
        cursor += 1;
      }
      crc = view.getUint32(cursor + 4, true);
      compressedSize = view.getUint32(cursor + 8, true);
      size = view.getUint32(cursor + 12, true);
      payloadEnd = cursor;
      expect(payloadEnd - dataStart).toBe(compressedSize);
      offset = cursor + 16;
    } else {
      offset = payloadEnd;
    }

    entries.push({
      path,
      method,
      flags,
      crc32: crc,
      compressedSize,
      size,
      payload: bytes.subarray(dataStart, payloadEnd),
    });
  }

  return entries;
}

function inflateEntry(entry: { method: number; payload: Uint8Array }) {
  return entry.method === METHOD_DEFLATE
    ? new Uint8Array(inflateRawSync(entry.payload))
    : entry.payload;
}

const xml = `<?xml version="1.0"?><rows>${Array.from(
  { length: 2000 },
  (_, index) => `<row r="${index + 1}"><c r="A${index + 1}"><v>${index}</v></c></row>`,
).join("")}</rows>`;

async function* chunked(value: string, chunkSize: number) {
  const bytes = new TextEncoder().encode(value);
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    yield bytes.subarray(offset, offset + chunkSize);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("crc32", () => {
  it("matches the reference check value and handles empty and binary input", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
    const random = new Uint8Array(70_000);
    for (let index = 0; index < random.length; index += 1) {
      random[index] = (index * 2654435761) >>> 24;
    }
    expect(crc32(random)).toBe(zlibCrc32(random));
  });
});

describe("ZipStreamWriter", () => {
  it("deflates streamed entries and records compressed sizes in descriptors and directory", async () => {
    const sink = new ChunkSink();
    const writer = new ZipStreamWriter(sink);

    await writer.add("xl/worksheets/sheet1.xml", chunked(xml, 4096));
    await writer.add("docProps/app.xml", "<app/>");
    await writer.add("media/blob.bin", Uint8Array.from([1, 2, 3, 4, 5]));
    await writer.finalize();

    const bytes = sink.bytes();
    const entries = readLocalEntries(bytes);
    const source = new TextEncoder().encode(xml);

    expect(entries.map((entry) => entry.path)).toEqual([
      "xl/worksheets/sheet1.xml",
      "docProps/app.xml",
      "media/blob.bin",
    ]);
    expect(entries[0]!.method).toBe(METHOD_DEFLATE);
    expect(entries[0]!.size).toBe(source.length);
    expect(entries[0]!.compressedSize).toBeLessThan(source.length / 4);
    expect(entries[0]!.crc32).toBe(crc32(source));
    expect(Buffer.from(inflateEntry(entries[0]!)).equals(Buffer.from(source))).toBe(true);

    const archive = unzipSync(bytes);
    expect(Buffer.from(archive["xl/worksheets/sheet1.xml"]!).toString()).toBe(xml);
    expect(Buffer.from(archive["docProps/app.xml"]!).toString()).toBe("<app/>");
    expect([...archive["media/blob.bin"]!]).toEqual([1, 2, 3, 4, 5]);
  });

  it("falls back to stored entries when CompressionStream is unavailable", async () => {
    vi.stubGlobal("CompressionStream", undefined);

    const sink = new ChunkSink();
    const writer = new ZipStreamWriter(sink);
    await writer.add("a.xml", xml);
    await writer.finalize();

    const bytes = sink.bytes();
    const [entry] = readLocalEntries(bytes);
    expect(entry!.method).toBe(METHOD_STORED);
    expect(entry!.compressedSize).toBe(entry!.size);
    expect(Buffer.from(unzipSync(bytes)["a.xml"]!).toString()).toBe(xml);
  });

  it("propagates sink failures raised while compressed output is drained", async () => {
    const writer = new ZipStreamWriter({
      async write(chunk: Uint8Array) {
        if (chunk.length > 30) {
          throw new Error("disk full");
        }
      },
    });

    await expect(writer.add("a.xml", chunked(xml, 1024))).rejects.toThrow("disk full");
  });
});

describe("ZipBuilder", () => {
  it("deflates buffered entries when a synchronous deflate is available", () => {
    const zip = new ZipBuilder();
    const source = new TextEncoder().encode(xml);
    zip.add("xl/worksheets/sheet1.xml", source);
    zip.add("tiny.bin", Uint8Array.from([7]));

    const bytes = zip.build();
    const entries = readLocalEntries(bytes);

    expect(entries[0]!.method).toBe(METHOD_DEFLATE);
    expect(entries[0]!.flags).toBe(0);
    expect(entries[0]!.size).toBe(source.length);
    expect(entries[0]!.compressedSize).toBeLessThan(source.length / 4);
    expect(entries[1]!.method).toBe(METHOD_STORED);
    expect(Buffer.from(unzipSync(bytes)["xl/worksheets/sheet1.xml"]!).toString()).toBe(xml);
    expect([...unzipSync(bytes)["tiny.bin"]!]).toEqual([7]);
  });

  it("falls back to stored entries without a synchronous deflate", () => {
    vi.stubGlobal("process", { ...process, getBuiltinModule: undefined });

    const zip = new ZipBuilder();
    zip.add("a.xml", new TextEncoder().encode(xml));
    const bytes = zip.build();
    const [entry] = readLocalEntries(bytes);

    expect(entry!.method).toBe(METHOD_STORED);
    expect(Buffer.from(unzipSync(bytes)["a.xml"]!).toString()).toBe(xml);
  });
});
