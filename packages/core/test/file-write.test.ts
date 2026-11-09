import { describe, expect, it, vi } from "vite-plus/test";
import { writeFileChunk } from "../src/workbook/internal/file-write";

describe("file writes", () => {
  it("retries partial writes without dropping or duplicating bytes", async () => {
    const text = "café & <review> 🚀".repeat(10);
    const source = new TextEncoder().encode(text);
    const output: number[] = [];
    const write = vi.fn(async (buffer: Uint8Array, offset: number, length: number) => {
      const bytesWritten = Math.min(length, 7);
      output.push(...buffer.subarray(offset, offset + bytesWritten));
      return { bytesWritten };
    });
    await writeFileChunk({ write }, source);
    expect(write.mock.calls.length).toBeGreaterThan(1);
    expect(new TextDecoder().decode(Uint8Array.from(output))).toBe(text);
  });

  it("rejects stalled writes and propagates I/O failures without retrying", async () => {
    const write = vi.fn(async () => ({ bytesWritten: 0 }));
    await expect(writeFileChunk({ write }, new Uint8Array([1]))).rejects.toThrow(
      "made no progress",
    );
    expect(write).toHaveBeenCalledTimes(1);
    const error = new Error("Disk full");
    write.mockRejectedValueOnce(error);
    await expect(writeFileChunk({ write }, new Uint8Array([1]))).rejects.toBe(error);
    expect(write).toHaveBeenCalledTimes(2);
  });
});
