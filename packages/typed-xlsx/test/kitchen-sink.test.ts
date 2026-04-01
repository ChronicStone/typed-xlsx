import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildKitchenSinkBufferedExample } from "../examples/kitchen-sink-source/buffered";
import { buildKitchenSinkStreamExample } from "../examples/kitchen-sink-source/stream";
import {
  expectWorkbookXmlToBeWellFormed,
  readWorkbookEntry,
  unzipWorkbookEntries,
} from "./support/xlsx";

describe("kitchen sink examples", () => {
  it("exports buffered and stream kitchen sink workbooks", async () => {
    const examplesDirectory = path.resolve(import.meta.dirname, "../examples");
    fs.mkdirSync(examplesDirectory, { recursive: true });

    fs.writeFileSync(
      path.join(examplesDirectory, "kitchen-sink-buffered.xlsx"),
      buildKitchenSinkBufferedExample(),
    );
    fs.writeFileSync(
      path.join(examplesDirectory, "kitchen-sink-stream.xlsx"),
      await buildKitchenSinkStreamExample(),
    );
  });

  it("emits a structurally valid buffered kitchen sink workbook with conditional formatting", () => {
    const entries = unzipWorkbookEntries(buildKitchenSinkBufferedExample());

    expectWorkbookXmlToBeWellFormed(entries);

    const sheet5 = readWorkbookEntry(entries, "xl/worksheets/sheet5.xml");
    const styles = readWorkbookEntry(entries, "xl/styles.xml");
    const workbook = readWorkbookEntry(entries, "xl/workbook.xml");

    expect(workbook).not.toContain("Grouped Formula Scope");
    expect(sheet5).toContain("<conditionalFormatting");
    expect(sheet5).toContain('sqref="G2:G5"');
    expect(sheet5).toContain("($G2&lt;1000)");
    expect(sheet5).toContain("AND(($G2&gt;=5000),(H2&gt;=0.85))");
    expect(styles).toContain('<dxfs count="4"');
    expect(styles).toContain("FFFEE2E2");
    expect(styles).toContain("FFDCFCE7");
  });
});
