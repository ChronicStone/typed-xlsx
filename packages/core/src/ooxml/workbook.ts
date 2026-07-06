import type { BufferedWorkbookPlan, ResolvedWorkbookProtectionOptions } from "../workbook/types";
import { createSharedStringsCollector, writeSharedStringsXml } from "./shared-strings";
import { serializeWorksheet } from "./worksheet";
import { StylesCollector } from "../styles/collector";
import { xmlDocument, xmlElement, xmlSelfClosing } from "./xml";
import { buildWorksheetNames } from "./sheet-names";
import { writeWorksheetRelationshipsXml } from "./table";
import { hashExcelProtectionPassword } from "./protection";
import { partitionWorksheetHyperlinks } from "./worksheet-parts";
import {
  createWorksheetDrawingPart,
  createWorksheetMediaRegistry,
  writeWorksheetDrawingRelationship,
  type WorksheetDrawingPart,
} from "./drawing";
import type { ImageMediaType } from "../image/types";

export interface WorkbookXmlPart {
  path: string;
  xml: string;
}

export interface WorkbookBinaryPart {
  path: string;
  data: Uint8Array;
  mediaType?: ImageMediaType;
}

export interface BufferedWorkbookXml {
  parts: WorkbookXmlPart[];
  binaryParts: WorkbookBinaryPart[];
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
    [
      writeWorkbookProtectionXml(plan.protection),
      xmlElement("sheets", undefined, sheets),
      writeWorkbookCalculationXml(),
    ],
  );
}

function writeWorkbookCalculationXml() {
  return xmlSelfClosing("calcPr", {
    calcMode: "auto",
    fullCalcOnLoad: 1,
    forceFullCalc: 1,
  });
}

function writeWorkbookProtectionXml(protection?: ResolvedWorkbookProtectionOptions) {
  if (!protection) {
    return "";
  }

  return xmlSelfClosing("workbookProtection", {
    lockStructure: protection.lockStructure ? 1 : undefined,
    lockWindows: protection.lockWindows ? 1 : undefined,
    workbookPassword: protection.workbookPassword
      ? hashExcelProtectionPassword(protection.workbookPassword)
      : undefined,
  });
}

export function serializeBufferedWorkbookPlan(plan: BufferedWorkbookPlan): BufferedWorkbookXml {
  const sharedStrings = createSharedStringsCollector();
  const styles = new StylesCollector();
  const sheetNames = buildWorksheetNames(plan.sheets.map((sheet) => sheet.name));
  const worksheetParts: WorkbookXmlPart[] = [];
  const tableParts: WorkbookXmlPart[] = [];
  const drawingParts: WorkbookXmlPart[] = [];
  const binaryParts: WorkbookBinaryPart[] = [];
  const mediaRegistry = createWorksheetMediaRegistry();
  let tableIndex = 0;
  let drawingIndex = 0;
  let pictureIndex = 0;

  plan.sheets.forEach((sheet, sheetIndex) => {
    const serialized = serializeWorksheet(
      sheet,
      sharedStrings,
      styles,
      tableIndex,
      sheetNames[sheetIndex],
    );
    const partitionedHyperlinks = partitionWorksheetHyperlinks(serialized.hyperlinks ?? []);
    const drawing =
      serialized.images.length > 0
        ? createWorksheetDrawingPart({
            drawingIndex: drawingIndex + 1,
            imageStartIndex: pictureIndex + 1,
            images: serialized.images,
            mediaRegistry,
          })
        : undefined;
    worksheetParts.push({
      path: `xl/worksheets/sheet${sheetIndex + 1}.xml`,
      xml: serialized.xml,
    });
    if (
      serialized.tableParts.length > 0 ||
      partitionedHyperlinks.externalRelationships.length > 0 ||
      drawing
    ) {
      worksheetParts.push({
        path: `xl/worksheets/_rels/sheet${sheetIndex + 1}.xml.rels`,
        xml: writeWorksheetObjectRelationshipsXml({
          tableParts: serialized.tableParts,
          hyperlinks: partitionedHyperlinks.externalRelationships,
          drawing,
        }),
      });
      tableParts.push(...serialized.tableParts.map((part) => ({ path: part.path, xml: part.xml })));
    }
    if (drawing) {
      drawingIndex += 1;
      pictureIndex += serialized.images.length;
      drawingParts.push(
        { path: drawing.path, xml: drawing.xml },
        { path: drawing.relsPath, xml: drawing.relationshipsXml },
      );
      binaryParts.push(
        ...drawing.mediaParts.map((part) => ({
          path: part.path,
          data: part.data,
          mediaType: part.mediaType,
        })),
      );
    }
    tableIndex += serialized.tableParts.length;
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
      ...tableParts,
      ...drawingParts,
    ],
    binaryParts,
  };
}

function writeWorksheetObjectRelationshipsXml(params: {
  tableParts: import("./table").WorksheetTablePart[];
  hyperlinks: Array<{ relId: string; target: string }>;
  drawing?: WorksheetDrawingPart;
}) {
  if (params.hyperlinks.length === 0 && !params.drawing) {
    return writeWorksheetRelationshipsXml(params.tableParts);
  }

  return xmlDocument(
    "Relationships",
    {
      xmlns: "http://schemas.openxmlformats.org/package/2006/relationships",
    },
    [
      ...params.tableParts.map((part) =>
        xmlSelfClosing("Relationship", {
          Id: part.relId,
          Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/table",
          Target: `../tables/${part.path.split("/").pop()}`,
        }),
      ),
      ...(params.drawing
        ? [
            writeWorksheetDrawingRelationship({
              relId: params.drawing.relId,
              drawingPath: params.drawing.path,
            }),
          ]
        : []),
      ...params.hyperlinks.map((hyperlink) =>
        xmlSelfClosing("Relationship", {
          Id: hyperlink.relId,
          Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink",
          Target: hyperlink.target,
          TargetMode: "External",
        }),
      ),
    ],
  );
}
