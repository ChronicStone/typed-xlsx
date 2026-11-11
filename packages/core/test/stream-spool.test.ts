import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createExcelSchema, createWorkbookStream } from "../src";
import { unzipWorkbookEntries } from "./support/xlsx";

const schema = createExcelSchema<{ value: string }>()
  .column("value", { accessor: "value" })
  .build();

const directories: string[] = [];

function makeTempDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "typed-xlsx-spool-test-"));
  directories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true });
  }
});

// Returns the text of every string cell in a worksheet, whether stored inline or shared.
function sheetTexts(filePath: string, sheetNumber: number) {
  const entries = unzipWorkbookEntries(fs.readFileSync(filePath));
  const sheetXml = entries.get(`xl/worksheets/sheet${sheetNumber}.xml`) ?? "";
  const shared = [
    ...(entries.get("xl/sharedStrings.xml") ?? "").matchAll(/<si><t>(.*?)<\/t><\/si>/g),
  ].map((match) => match[1]!);
  const texts: string[] = [];
  for (const match of sheetXml.matchAll(/<c [^>]*t="(s|inlineStr)"[^>]*>(.*?)<\/c>/g)) {
    texts.push(
      match[1] === "s"
        ? (shared[Number(/<v>(\d+)<\/v>/.exec(match[2]!)?.[1])] ?? "")
        : (/<t>(.*?)<\/t>/.exec(match[2]!)?.[1] ?? ""),
    );
  }
  return texts;
}

describe("stream spool isolation", () => {
  it("keeps tables apart when their sheet names sanitize to the same file name", async () => {
    const directory = makeTempDirectory();
    const filePath = path.join(directory, "out.xlsx");
    const workbook = createWorkbookStream({ tempDirectory: directory });
    const first = await workbook.sheet("销售").table("t", { schema });
    const second = await workbook.sheet("报表").table("t", { schema });

    await first.commit({ rows: [{ value: "sales-1" }, { value: "sales-2" }] });
    await second.commit({ rows: [{ value: "report-1" }, { value: "report-2" }] });
    await workbook.writeToFile(filePath);

    expect(sheetTexts(filePath, 1)).toEqual(["Value", "sales-1", "sales-2"]);
    expect(sheetTexts(filePath, 2)).toEqual(["Value", "report-1", "report-2"]);
  });

  it("keeps two concurrent exports with the same sheet name apart", async () => {
    const directory = makeTempDirectory();
    const exportWith = async (label: string) => {
      const filePath = path.join(directory, `${label}.xlsx`);
      const workbook = createWorkbookStream({ tempDirectory: directory });
      const table = await workbook.sheet("Report").table("rows", { schema });
      await table.commit({ rows: [{ value: `${label}-1` }, { value: `${label}-2` }] });
      await workbook.writeToFile(filePath);
      return filePath;
    };

    const [alphaPath, betaPath] = await Promise.all([exportWith("alpha"), exportWith("beta")]);

    expect(sheetTexts(alphaPath, 1)).toEqual(["Value", "alpha-1", "alpha-2"]);
    expect(sheetTexts(betaPath, 1)).toEqual(["Value", "beta-1", "beta-2"]);
  });

  it("removes its private spool directory after a successful export", async () => {
    const directory = makeTempDirectory();
    const workbook = createWorkbookStream({ tempDirectory: directory });
    const table = await workbook.sheet("Logs").table("logs", { schema });
    await table.commit({ rows: [{ value: "line-1" }] });

    expect(fs.readdirSync(directory).filter((name) => name.startsWith("typed-xlsx-"))).toHaveLength(
      1,
    );

    await workbook.writeToFile(path.join(directory, "out.xlsx"));

    expect(fs.readdirSync(directory).filter((name) => name.startsWith("typed-xlsx-"))).toEqual([]);
    expect(fs.existsSync(directory)).toBe(true);
  });

  it("removes its private spool directory after a failed export and after dispose", async () => {
    const directory = makeTempDirectory();
    const failing = createWorkbookStream({ tempDirectory: directory });
    const table = await failing.sheet("Logs").table("logs", { schema });
    await table.commit({ rows: [{ value: "line-1" }] });

    const outputError = new Error("output failed");
    await expect(
      failing.pipeTo(
        new WritableStream<Uint8Array>({
          write() {
            throw outputError;
          },
        }),
      ),
    ).rejects.toBe(outputError);
    expect(fs.readdirSync(directory)).toEqual([]);

    const disposed = createWorkbookStream({ tempDirectory: directory });
    const other = await disposed.sheet("Logs").table("logs", { schema });
    await other.commit({ rows: [{ value: "line-1" }] });
    expect(fs.readdirSync(directory)).toHaveLength(1);
    await disposed.dispose();
    await disposed.dispose();
    expect(fs.readdirSync(directory)).toEqual([]);
  });

  it.skipIf(process.platform === "win32")(
    "creates the private spool directory with owner-only permissions",
    async () => {
      const directory = makeTempDirectory();
      const workbook = createWorkbookStream({ tempDirectory: directory });
      const table = await workbook.sheet("Logs").table("logs", { schema });
      await table.commit({ rows: [{ value: "line-1" }] });

      const [spoolDirectory] = fs.readdirSync(directory);
      expect(spoolDirectory).toBeDefined();
      const mode = fs.statSync(path.join(directory, spoolDirectory!)).mode & 0o777;
      expect(mode).toBe(0o700);

      await workbook.dispose();
    },
  );
});
