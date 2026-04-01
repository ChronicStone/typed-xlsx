import { describe, expect, it } from "vitest";
import { buildKitchenSinkBufferedExample } from "./fixtures/kitchen-sink/buffered";
import { buildKitchenSinkStreamExample } from "./fixtures/kitchen-sink/stream";
import {
  expectWorkbookXmlToBeWellFormed,
  readWorkbookEntry,
  unzipWorkbookEntries,
} from "./support/xlsx";

describe("kitchen sink examples", () => {
  it("builds buffered and stream kitchen sink workbooks", async () => {
    buildKitchenSinkBufferedExample();
    await buildKitchenSinkStreamExample();
  });

  it("emits a structurally valid buffered kitchen sink workbook with conditional formatting", () => {
    const entries = unzipWorkbookEntries(buildKitchenSinkBufferedExample());

    expectWorkbookXmlToBeWellFormed(entries);

    const sheet5 = readWorkbookEntry(entries, "xl/worksheets/sheet5.xml");
    const styles = readWorkbookEntry(entries, "xl/styles.xml");
    const workbook = readWorkbookEntry(entries, "xl/workbook.xml");

    expect(workbook).toContain("Grouped Formula Scope");
    expect(sheet5).toContain("<conditionalFormatting");
    expect(sheet5).toContain('sqref="G2:G5"');
    expect(sheet5).toContain("($G2&lt;1000)");
    expect(sheet5).toContain("AND(($G2&gt;=5000),(H2&gt;=0.85))");
    expect(styles).toContain('<dxfs count="4"');
    expect(styles).toContain("FFFEE2E2");
    expect(styles).toContain("FFDCFCE7");
  });

  it("emits validation xml in the kitchen sink examples", async () => {
    const bufferedEntries = unzipWorkbookEntries(buildKitchenSinkBufferedExample());
    const bufferedValidationSheet = readWorkbookEntry(bufferedEntries, "xl/worksheets/sheet6.xml");
    const bufferedProtectedSheet = readWorkbookEntry(bufferedEntries, "xl/worksheets/sheet7.xml");
    const bufferedHyperlinkSheet = readWorkbookEntry(bufferedEntries, "xl/worksheets/sheet8.xml");
    const bufferedHyperlinkRels = readWorkbookEntry(
      bufferedEntries,
      "xl/worksheets/_rels/sheet8.xml.rels",
    );
    const bufferedStyles = readWorkbookEntry(bufferedEntries, "xl/styles.xml");
    const bufferedWorkbook = readWorkbookEntry(bufferedEntries, "xl/workbook.xml");

    expect(bufferedValidationSheet).toContain("<dataValidations");
    expect(bufferedValidationSheet).toContain('type="list"');
    expect(bufferedValidationSheet).toContain('type="whole"');
    expect(bufferedValidationSheet).toContain('type="date"');
    expect(bufferedProtectedSheet).toContain("<sheetProtection");
    expect(bufferedProtectedSheet).toContain('password="');
    expect(bufferedStyles).toContain('<protection locked="0"/>');
    expect(bufferedStyles).toContain('<protection hidden="1"/>');
    expect(bufferedHyperlinkSheet).toContain("<hyperlinks>");
    expect(bufferedHyperlinkRels).toContain("relationships/hyperlink");
    expect(bufferedWorkbook).toContain("<workbookProtection");
    expect(bufferedWorkbook).toContain('lockStructure="1"');
    expect(bufferedWorkbook).toContain('workbookPassword="');

    const streamedEntries = unzipWorkbookEntries(await buildKitchenSinkStreamExample());
    const streamedValidationSheet = readWorkbookEntry(streamedEntries, "xl/worksheets/sheet6.xml");
    const streamedProtectedSheet = readWorkbookEntry(streamedEntries, "xl/worksheets/sheet7.xml");
    const streamedHyperlinkSheet = readWorkbookEntry(streamedEntries, "xl/worksheets/sheet8.xml");
    const streamedHyperlinkRels = readWorkbookEntry(
      streamedEntries,
      "xl/worksheets/_rels/sheet8.xml.rels",
    );
    const streamedStyles = readWorkbookEntry(streamedEntries, "xl/styles.xml");
    const streamedWorkbook = readWorkbookEntry(streamedEntries, "xl/workbook.xml");

    expect(streamedValidationSheet).toContain("<dataValidations");
    expect(streamedValidationSheet).toContain('type="list"');
    expect(streamedValidationSheet).toContain('type="whole"');
    expect(streamedValidationSheet).toContain('type="date"');
    expect(streamedProtectedSheet).toContain("<sheetProtection");
    expect(streamedProtectedSheet).toContain('password="');
    expect(streamedStyles).toContain('<protection locked="0"/>');
    expect(streamedStyles).toContain('<protection hidden="1"/>');
    expect(streamedHyperlinkSheet).toContain("<hyperlinks>");
    expect(streamedHyperlinkRels).toContain("relationships/hyperlink");
    expect(streamedWorkbook).toContain("<workbookProtection");
    expect(streamedWorkbook).toContain('lockStructure="1"');
    expect(streamedWorkbook).toContain('workbookPassword="');
  });
});
