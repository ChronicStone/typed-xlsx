export async function writeFileChunk(
  handle: {
    write: (
      buffer: Uint8Array,
      offset: number,
      length: number,
      position: null,
    ) => Promise<{ bytesWritten: number }>;
  },
  chunk: Uint8Array,
) {
  let offset = 0;
  while (offset < chunk.length) {
    const { bytesWritten } = await handle.write(chunk, offset, chunk.length - offset, null);
    if (bytesWritten === 0) {
      throw new Error("Unable to write the workbook: the file write made no progress.");
    }
    offset += bytesWritten;
  }
}
