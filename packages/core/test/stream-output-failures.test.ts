import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createExcelSchema, createWorkbookStream } from "../src";
import { WorkbookByteStream } from "../src/workbook/internal/stream-sinks";

const schema = createExcelSchema<{ id: number; value: string }>()
  .column("id", { accessor: "id" })
  .column("value", { accessor: "value" })
  .build();

const directories: string[] = [];

function makeTempDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "typed-xlsx-output-test-"));
  directories.push(directory);
  return directory;
}

function makeRows(count: number) {
  return Array.from({ length: count }, (_, index) => ({ id: index, value: `row-${index}` }));
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of directories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

// Two marks with different row counts: the export fails while the workbook is being finalized.
async function makeFailingWorkbook() {
  const workbook = createWorkbookStream({ tempDirectory: makeTempDirectory() });
  const sheet = workbook.sheet("Sales");
  const first = await sheet.table("first", { schema });
  const second = await sheet.table("second", { schema });
  await first.commit({ rows: makeRows(3) });
  await second.commit({ rows: makeRows(2) });
  sheet.chart("broken", {
    marks: [first.bar({ x: "value", y: "id" }), second.line({ x: "value", y: "id" })],
  });
  return workbook;
}

async function makeLargeWorkbook(rowCount: number) {
  const workbook = createWorkbookStream({ tempStorage: "memory" });
  const table = await workbook.sheet("Big").table("rows", { schema });
  for (let start = 0; start < rowCount; start += 5_000) {
    await table.commit({
      rows: makeRows(5_000).map((row) => ({ id: start + row.id, value: `row-${start + row.id}` })),
    });
  }
  return workbook;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("stream output failures", () => {
  it("keeps the previous file and leaves no temp file when writeToFile fails half-way", async () => {
    const directory = makeTempDirectory();
    const filePath = path.join(directory, "report.xlsx");
    fs.writeFileSync(filePath, "previous");

    const workbook = createWorkbookStream({ tempDirectory: directory });
    const table = await workbook.sheet("Logs").table("logs", { schema });
    await table.commit({ rows: makeRows(2_000) });

    // Fail the third write to the output file. Spool appends already happened above.
    const handle = await fsp.open(path.join(directory, "probe"), "w");
    const original = Object.getPrototypeOf(handle).write as (...args: unknown[]) => unknown;
    await handle.close();
    let writes = 0;
    const failure = new Error("disk full");
    vi.spyOn(Object.getPrototypeOf(handle), "write").mockImplementation(function (
      this: unknown,
      ...args: unknown[]
    ) {
      writes += 1;
      if (writes === 3) return Promise.reject(failure);
      return original.apply(this, args);
    });

    await expect(workbook.writeToFile(filePath)).rejects.toBe(failure);

    expect(writes).toBeGreaterThanOrEqual(3);
    expect(fs.readFileSync(filePath, "utf8")).toBe("previous");
    expect(fs.readdirSync(directory).filter((name) => name.endsWith(".tmp"))).toEqual([]);
  });

  it("aborts a web destination with the error when the export fails", async () => {
    const workbook = await makeFailingWorkbook();
    let aborted: unknown;
    let closed = false;

    await expect(
      workbook.pipeTo(
        new WritableStream<Uint8Array>({
          close() {
            closed = true;
          },
          abort(reason) {
            aborted = reason;
          },
        }),
      ),
    ).rejects.toThrow("has 2 categories");

    expect(aborted).toBeInstanceOf(Error);
    expect((aborted as Error).message).toContain("has 2 categories");
    expect(closed).toBe(false);
  });

  it("rejects pipeToNode instead of hanging when the destination is destroyed", async () => {
    const workbook = await makeLargeWorkbook(20_000);
    const destination = new PassThrough();
    let destroyed = false;
    destination.on("data", () => {
      if (!destroyed) {
        destroyed = true;
        destination.destroy();
      }
    });

    const outcome = await Promise.race([
      workbook.pipeToNode(destination).then(
        () => "resolved",
        (error: Error) => error.message,
      ),
      wait(1_000).then(() => "timeout"),
    ]);

    expect(outcome).toBe("The destination stream closed before the workbook was fully written.");
  });

  it("stops producing when the reader cancels a readable stream", async () => {
    const write = vi.spyOn(WorkbookByteStream.prototype, "write");

    const full = (await makeLargeWorkbook(20_000)).toReadableStream().getReader();
    for (;;) {
      if ((await full.read()).done) break;
    }
    const totalChunks = write.mock.calls.length;
    expect(totalChunks).toBeGreaterThan(40);

    write.mockClear();
    const reader = (await makeLargeWorkbook(20_000)).toReadableStream().getReader();
    await reader.read();
    await reader.cancel();
    await wait(100);
    const afterCancel = write.mock.calls.length;
    await wait(100);

    expect(write.mock.calls.length).toBe(afterCancel);
    expect(afterCancel).toBeLessThan(totalChunks);
  });

  it("waits for the reader instead of queueing the whole workbook", async () => {
    const write = vi.spyOn(WorkbookByteStream.prototype, "write");
    const workbook = await makeLargeWorkbook(20_000);
    const stream = workbook.toReadableStream();

    await wait(200);
    // 16 queued chunks plus at most one write that is waiting for the reader.
    expect(write.mock.calls.length).toBeLessThan(32);
    expect(write.mock.calls.length).toBeGreaterThan(0);

    await stream.cancel();
  });

  it("throws when rows are committed after the workbook was finalized", async () => {
    const directory = makeTempDirectory();
    const workbook = createWorkbookStream({ tempDirectory: directory });
    const table = await workbook.sheet("Logs").table("logs", { schema });
    await table.commit({ rows: makeRows(2) });
    await workbook.writeToFile(path.join(directory, "report.xlsx"));

    await expect(table.commit({ rows: makeRows(1) })).rejects.toThrow(
      "Cannot commit rows to table 'logs': the workbook has already been finalized.",
    );
  });
});
