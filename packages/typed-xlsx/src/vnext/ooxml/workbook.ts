import type { BufferedWorkbookPlan } from "../workbook/types";
import { createSharedStringsCollector, writeSharedStringsXml } from "./shared-strings";
import { writeWorksheetXml } from "./worksheet";
import { StylesCollector } from "../styles/collector";
import { xmlDocument, xmlElement, xmlSelfClosing } from "./xml";
import { buildWorksheetNames } from "./sheet-names";

export interface WorkbookXmlPart {
  path: string;
  xml: string;
}

export interface BufferedWorkbookXml {
  parts: WorkbookXmlPart[];
}

function writeWorkbookXml(plan: BufferedWorkbookPlan) {
  const sheetNames = buildWorksheetNames(plan.sheets.map((sheet) => sheet.name));
  const sheets = sheetNames.map((sheetName, index) =>
    xmlSelfClosing("sheet", {
      name: sheetName,
      sheetId: index + 1,
      "r:id": `rId${index + 1}`,
    }),
  );

  return xmlDocument(
    "workbook",
    {
      xmlns: "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "xmlns:r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    },
    xmlElement("sheets", undefined, sheets),
  );
}

export function serializeBufferedWorkbookPlan(plan: BufferedWorkbookPlan): BufferedWorkbookXml {
  const sharedStrings = createSharedStringsCollector();
  const styles = new StylesCollector();
  const worksheetParts: WorkbookXmlPart[] = [];

  plan.sheets.forEach((sheet, sheetIndex) => {
    worksheetParts.push({
      path: `xl/worksheets/sheet${sheetIndex + 1}.xml`,
      xml: writeWorksheetXml(sheet, sharedStrings, styles),
    });
  });

  return {
    parts: [
      {
        path: "xl/workbook.xml",
        xml: writeWorkbookXml(plan),
      },
      {
        path: "xl/styles.xml",
        xml: styles.toXml(),
      },
      {
        path: "xl/sharedStrings.xml",
        xml: writeSharedStringsXml(sharedStrings),
      },
      ...worksheetParts,
    ],
  };
}
