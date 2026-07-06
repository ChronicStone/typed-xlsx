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

    const formulaColumnsSheet = readWorksheetByName(entries, "Formula Columns");
    const sparklineGallerySheet = readWorksheetByName(entries, "Sparkline Gallery");
    const styles = readWorkbookEntry(entries, "xl/styles.xml");
    const workbook = readWorkbookEntry(entries, "xl/workbook.xml");

    expect(workbook).toContain("Grouped Formula Scope");
    expect(sparklineGallerySheet).toContain("<x14:sparklineGroups");
    expect(sparklineGallerySheet).toContain('<row r="4" ht="44" customHeight="1">');
    expect(sparklineGallerySheet).toContain('type="line"');
    expect(sparklineGallerySheet).toContain('type="column"');
    expect(sparklineGallerySheet).toContain('type="stacked"');
    expect(formulaColumnsSheet).toContain("<conditionalFormatting");
    expect(formulaColumnsSheet).toContain('sqref="H4:H7"');
    expect(formulaColumnsSheet).toContain("($H2&lt;1000)");
    expect(formulaColumnsSheet).toContain("AND(($H2&gt;=5000),(G2&gt;=0.85))");
    expect(styles).toContain('<dxfs count="4"');
    expect(styles).toContain("FFFEE2E2");
    expect(styles).toContain("FFDCFCE7");
  });

  it("emits validation xml in the kitchen sink examples", async () => {
    const bufferedEntries = unzipWorkbookEntries(buildKitchenSinkBufferedExample());
    const bufferedValidationSheet = readWorksheetByName(bufferedEntries, "Validation");
    const bufferedProtectedSheet = readWorksheetByName(bufferedEntries, "Protected Input");
    const bufferedHyperlinkSheet = readWorksheetByName(bufferedEntries, "Hyperlinks");
    const bufferedHyperlinkRels = readWorksheetRelationshipsByName(bufferedEntries, "Hyperlinks");
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
    const streamedSparklineGallerySheet = readWorksheetByName(streamedEntries, "Sparkline Gallery");
    const streamedValidationSheet = readWorksheetByName(streamedEntries, "Validation");
    const streamedProtectedSheet = readWorksheetByName(streamedEntries, "Protected Input");
    const streamedHyperlinkSheet = readWorksheetByName(streamedEntries, "Hyperlinks");
    const streamedHyperlinkRels = readWorksheetRelationshipsByName(streamedEntries, "Hyperlinks");
    const streamedStyles = readWorkbookEntry(streamedEntries, "xl/styles.xml");
    const streamedWorkbook = readWorkbookEntry(streamedEntries, "xl/workbook.xml");

    expect(streamedSparklineGallerySheet).toContain("<x14:sparklineGroups");
    expect(streamedSparklineGallerySheet).toContain('<row r="4" ht="44" customHeight="1">');
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

function readWorksheetByName(entries: Map<string, string>, sheetName: string) {
  const path = resolveWorksheetPathByName(entries, sheetName);
  return readWorkbookEntry(entries, path);
}

function readWorksheetRelationshipsByName(entries: Map<string, string>, sheetName: string) {
  const path = resolveWorksheetPathByName(entries, sheetName);
  const sheetFileName = path.split("/").pop();
  return readWorkbookEntry(entries, `xl/worksheets/_rels/${sheetFileName}.rels`);
}

function resolveWorksheetPathByName(entries: Map<string, string>, sheetName: string) {
  const workbookXml = readWorkbookEntry(entries, "xl/workbook.xml");
  const workbookRelsXml = readWorkbookEntry(entries, "xl/_rels/workbook.xml.rels");
  const sheetMatch = [
    ...workbookXml.matchAll(/<sheet name="([^"]+)" sheetId="\d+" r:id="([^"]+)"/g),
  ].find((match) => match[1] === sheetName);
  if (!sheetMatch?.[2]) {
    throw new Error(`Missing sheet '${sheetName}'.`);
  }

  const relationshipMatch = new RegExp(
    `<Relationship Id="${sheetMatch[2]}"[^>]+Target="([^"]+)"`,
  ).exec(workbookRelsXml);
  if (!relationshipMatch?.[1]) {
    throw new Error(`Missing worksheet relationship for '${sheetName}'.`);
  }

  return `xl/${relationshipMatch[1]}`;
}
