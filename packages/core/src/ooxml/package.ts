import type { BufferedWorkbookPlan } from "../workbook/types";
import {
  ZipBuilder,
  ZipStreamWriter,
  type ZipChunkSink,
  type ZipEntrySource,
} from "../archive/zip";
import { serializeBufferedWorkbookPlan } from "./workbook";
import { xmlDocument, xmlElement, xmlSelfClosing } from "./xml";
import type { ImageMediaType } from "../image/types";
import type { WorkbookBinaryPart, WorkbookXmlPart } from "./workbook";
import {
  FEATURE_PROPERTY_BAG_CONTENT_TYPE,
  FEATURE_PROPERTY_BAG_PATH,
  FEATURE_PROPERTY_BAG_RELATIONSHIP_TYPE,
} from "./feature-property-bag";

export interface WorkbookPackagePartSource {
  path: string;
  source: ZipEntrySource;
}

export function writeContentTypesXml(
  sheetCount: number,
  hasSharedStrings: boolean,
  tableCount: number,
  drawingCount = 0,
  mediaTypes: ImageMediaType[] = [],
  hasFeaturePropertyBag = false,
) {
  const uniqueMediaTypes = [...new Set(mediaTypes)];
  const overrides = [
    xmlSelfClosing("Override", {
      PartName: "/xl/workbook.xml",
      ContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
    }),
    ...Array.from({ length: sheetCount }, (_, index) =>
      xmlSelfClosing("Override", {
        PartName: `/xl/worksheets/sheet${index + 1}.xml`,
        ContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml",
      }),
    ),
    xmlSelfClosing("Override", {
      PartName: "/xl/styles.xml",
      ContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml",
    }),
    ...(hasFeaturePropertyBag
      ? [
          xmlSelfClosing("Override", {
            PartName: `/${FEATURE_PROPERTY_BAG_PATH}`,
            ContentType: FEATURE_PROPERTY_BAG_CONTENT_TYPE,
          }),
        ]
      : []),
    ...(hasSharedStrings
      ? [
          xmlSelfClosing("Override", {
            PartName: "/xl/sharedStrings.xml",
            ContentType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml",
          }),
        ]
      : []),
    ...Array.from({ length: tableCount }, (_, index) =>
      xmlSelfClosing("Override", {
        PartName: `/xl/tables/table${index + 1}.xml`,
        ContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml",
      }),
    ),
    ...Array.from({ length: drawingCount }, (_, index) =>
      xmlSelfClosing("Override", {
        PartName: `/xl/drawings/drawing${index + 1}.xml`,
        ContentType: "application/vnd.openxmlformats-officedocument.drawing+xml",
      }),
    ),
  ];

  return xmlDocument(
    "Types",
    {
      xmlns: "http://schemas.openxmlformats.org/package/2006/content-types",
    },
    [
      xmlSelfClosing("Default", {
        Extension: "rels",
        ContentType: "application/vnd.openxmlformats-package.relationships+xml",
      }),
      xmlSelfClosing("Default", {
        Extension: "xml",
        ContentType: "application/xml",
      }),
      ...(uniqueMediaTypes.includes("image/png")
        ? [xmlSelfClosing("Default", { Extension: "png", ContentType: "image/png" })]
        : []),
      ...(uniqueMediaTypes.includes("image/jpeg")
        ? [xmlSelfClosing("Default", { Extension: "jpeg", ContentType: "image/jpeg" })]
        : []),
      ...overrides,
    ],
  );
}

export function writeRootRelationshipsXml() {
  return xmlDocument(
    "Relationships",
    {
      xmlns: "http://schemas.openxmlformats.org/package/2006/relationships",
    },
    xmlSelfClosing("Relationship", {
      Id: "rId1",
      Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument",
      Target: "xl/workbook.xml",
    }),
  );
}

export function writeWorkbookRelationshipsXml(
  sheetCount: number,
  hasSharedStrings: boolean,
  hasFeaturePropertyBag = false,
) {
  const relationships = [
    ...Array.from({ length: sheetCount }, (_, index) =>
      xmlSelfClosing("Relationship", {
        Id: `rId${index + 1}`,
        Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet",
        Target: `worksheets/sheet${index + 1}.xml`,
      }),
    ),
    xmlSelfClosing("Relationship", {
      Id: `rId${sheetCount + 1}`,
      Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles",
      Target: "styles.xml",
    }),
  ];
  let nextRelationshipId = sheetCount + 2;

  if (hasSharedStrings) {
    relationships.push(
      xmlSelfClosing("Relationship", {
        Id: `rId${nextRelationshipId}`,
        Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings",
        Target: "sharedStrings.xml",
      }),
    );
    nextRelationshipId += 1;
  }

  if (hasFeaturePropertyBag) {
    relationships.push(
      xmlSelfClosing("Relationship", {
        Id: `rId${nextRelationshipId}`,
        Type: FEATURE_PROPERTY_BAG_RELATIONSHIP_TYPE,
        Target: "featurePropertyBag/featurePropertyBag.xml",
      }),
    );
  }

  return xmlDocument(
    "Relationships",
    {
      xmlns: "http://schemas.openxmlformats.org/package/2006/relationships",
    },
    relationships,
  );
}

export function writeMinimalStylesXml() {
  return xmlDocument(
    "styleSheet",
    {
      xmlns: "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    },
    [
      xmlElement("fonts", { count: 1 }, xmlSelfClosing("font")),
      xmlElement("fills", { count: 2 }, [
        xmlSelfClosing("fill", undefined),
        xmlElement("fill", undefined, xmlSelfClosing("patternFill", { patternType: "gray125" })),
      ]),
      xmlElement("borders", { count: 1 }, xmlSelfClosing("border")),
      xmlElement(
        "cellStyleXfs",
        { count: 1 },
        xmlSelfClosing("xf", { numFmtId: 0, fontId: 0, fillId: 0, borderId: 0 }),
      ),
      xmlElement(
        "cellXfs",
        { count: 1 },
        xmlSelfClosing("xf", { numFmtId: 0, fontId: 0, fillId: 0, borderId: 0, xfId: 0 }),
      ),
      xmlElement(
        "cellStyles",
        { count: 1 },
        xmlSelfClosing("cellStyle", { name: "Normal", xfId: 0, builtinId: 0 }),
      ),
    ],
  );
}

export function buildBufferedWorkbookXlsx(plan: BufferedWorkbookPlan) {
  const xml = serializeBufferedWorkbookPlan(plan);
  const worksheetCount = plan.sheets.length;
  const hasSharedStrings = xml.parts.some((part) => part.path === "xl/sharedStrings.xml");
  const tableCount = xml.parts.filter((part) => part.path.startsWith("xl/tables/")).length;
  const drawingCount = xml.parts.filter((part) =>
    part.path.startsWith("xl/drawings/drawing"),
  ).length;
  const hasFeaturePropertyBag = xml.parts.some((part) => part.path === FEATURE_PROPERTY_BAG_PATH);
  return buildXlsxPackage(xml.parts, {
    worksheetCount,
    hasSharedStrings,
    tableCount,
    drawingCount,
    hasFeaturePropertyBag,
    mediaTypes: xml.binaryParts.flatMap((part) => (part.mediaType ? [part.mediaType] : [])),
    binaryParts: xml.binaryParts,
  });
}

export function buildXlsxPackage(
  parts: WorkbookXmlPart[],
  options: {
    worksheetCount: number;
    hasSharedStrings: boolean;
    tableCount: number;
    drawingCount?: number;
    hasFeaturePropertyBag?: boolean;
    mediaTypes?: ImageMediaType[];
    binaryParts?: WorkbookBinaryPart[];
  },
) {
  const zip = new ZipBuilder();
  const encoder = new TextEncoder();
  const hasStyles = parts.some((part) => part.path === "xl/styles.xml");
  const hasFeaturePropertyBag =
    options.hasFeaturePropertyBag ?? parts.some((part) => part.path === FEATURE_PROPERTY_BAG_PATH);

  zip.add(
    "[Content_Types].xml",
    encoder.encode(
      writeContentTypesXml(
        options.worksheetCount,
        options.hasSharedStrings,
        options.tableCount,
        options.drawingCount ?? 0,
        options.mediaTypes ?? [],
        hasFeaturePropertyBag,
      ),
    ),
  );
  zip.add("_rels/.rels", encoder.encode(writeRootRelationshipsXml()));
  zip.add(
    "xl/_rels/workbook.xml.rels",
    encoder.encode(
      writeWorkbookRelationshipsXml(
        options.worksheetCount,
        options.hasSharedStrings,
        hasFeaturePropertyBag,
      ),
    ),
  );
  if (!hasStyles) {
    zip.add("xl/styles.xml", encoder.encode(writeMinimalStylesXml()));
  }

  for (const part of parts) {
    zip.add(part.path, encoder.encode(part.xml));
  }
  for (const part of options.binaryParts ?? []) {
    zip.add(part.path, part.data);
  }

  return zip.build();
}

export async function writeXlsxPackageToSink(
  parts: WorkbookPackagePartSource[],
  options: {
    worksheetCount: number;
    hasSharedStrings: boolean;
    tableCount: number;
    drawingCount?: number;
    hasFeaturePropertyBag?: boolean;
    mediaTypes?: ImageMediaType[];
  },
  sink: ZipChunkSink,
) {
  const zip = new ZipStreamWriter(sink);
  const hasStyles = parts.some((part) => part.path === "xl/styles.xml");
  const hasFeaturePropertyBag =
    options.hasFeaturePropertyBag ?? parts.some((part) => part.path === FEATURE_PROPERTY_BAG_PATH);

  await zip.add(
    "[Content_Types].xml",
    writeContentTypesXml(
      options.worksheetCount,
      options.hasSharedStrings,
      options.tableCount,
      options.drawingCount ?? 0,
      options.mediaTypes ?? [],
      hasFeaturePropertyBag,
    ),
  );
  await zip.add("_rels/.rels", writeRootRelationshipsXml());
  await zip.add(
    "xl/_rels/workbook.xml.rels",
    writeWorkbookRelationshipsXml(
      options.worksheetCount,
      options.hasSharedStrings,
      hasFeaturePropertyBag,
    ),
  );
  if (!hasStyles) {
    await zip.add("xl/styles.xml", writeMinimalStylesXml());
  }

  for (const part of parts) {
    await zip.add(part.path, part.source);
  }

  await zip.finalize();
}
