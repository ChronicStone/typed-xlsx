import type { WorksheetImage } from "../workbook/types";
import { imageExtension } from "../image/runtime";
import { crc32 } from "../archive/zip";
import { xmlDocument, xmlElement, xmlSelfClosing } from "./xml";

const EMUS_PER_PIXEL = 9525;
const DRAWING_RELATIONSHIP =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing";
const IMAGE_RELATIONSHIP =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";

export interface WorksheetDrawingImage extends WorksheetImage {
  id: number;
  name: string;
  relId: string;
  mediaPath: string;
}

export interface WorksheetMediaPart {
  path: string;
  data: Uint8Array;
  mediaType: WorksheetImage["mediaType"];
}

export interface WorksheetMediaRegistry {
  readonly mediaParts: WorksheetMediaPart[];
  resolve(
    data: Uint8Array,
    mediaType: WorksheetImage["mediaType"],
  ): { created: boolean; part: WorksheetMediaPart };
}

export interface WorksheetDrawingPart {
  path: string;
  relsPath: string;
  relId: string;
  xml: string;
  relationshipsXml: string;
  mediaParts: WorksheetMediaPart[];
}

export function createWorksheetMediaRegistry(imageStartIndex = 1): WorksheetMediaRegistry {
  const entries = new Map<string, WorksheetMediaPart[]>();
  const mediaParts: WorksheetMediaPart[] = [];
  let nextMediaIndex = imageStartIndex;

  return {
    mediaParts,
    resolve(data, mediaType) {
      const media = resolveMediaPart({
        data,
        entries,
        mediaParts,
        mediaType,
        nextMediaIndex,
      });
      nextMediaIndex += media.created ? 1 : 0;

      return media;
    },
  };
}

export function createWorksheetDrawingPart(params: {
  drawingIndex: number;
  imageStartIndex: number;
  images: WorksheetImage[];
  mediaRegistry?: WorksheetMediaRegistry;
}): WorksheetDrawingPart {
  const relId = "rIdDrawing1";
  const path = `xl/drawings/drawing${params.drawingIndex}.xml`;
  const mediaRegistry =
    params.mediaRegistry ?? createWorksheetMediaRegistry(params.imageStartIndex);
  const existingMediaCount = mediaRegistry.mediaParts.length;
  const preparedImages = params.images.map((image, index) => {
    const media = mediaRegistry.resolve(image.data, image.mediaType);

    return {
      ...image,
      id: index + 1,
      name: `Picture ${params.imageStartIndex + index}`,
      relId: `rIdImage${index + 1}`,
      mediaPath: media.part.path,
    };
  });

  return {
    path,
    relsPath: `xl/drawings/_rels/drawing${params.drawingIndex}.xml.rels`,
    relId,
    xml: writeDrawingXml(preparedImages),
    relationshipsXml: writeDrawingRelationshipsXml(preparedImages),
    mediaParts: mediaRegistry.mediaParts.slice(existingMediaCount),
  };
}

export function writeWorksheetDrawing(relId?: string) {
  return relId ? xmlSelfClosing("drawing", { "r:id": relId }) : "";
}

export function writeWorksheetDrawingRelationship(params: { relId: string; drawingPath: string }) {
  return xmlSelfClosing("Relationship", {
    Id: params.relId,
    Type: DRAWING_RELATIONSHIP,
    Target: `../drawings/${params.drawingPath.split("/").pop()}`,
  });
}

function writeDrawingXml(images: WorksheetDrawingImage[]) {
  return xmlDocument(
    "xdr:wsDr",
    {
      "xmlns:xdr": "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing",
      "xmlns:a": "http://schemas.openxmlformats.org/drawingml/2006/main",
      "xmlns:r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    },
    images.map(writeImageAnchor),
  );
}

function writeImageAnchor(image: WorksheetDrawingImage) {
  const paddingX = image.padding.x ?? 0;
  const paddingY = image.padding.y ?? 0;

  return xmlElement("xdr:oneCellAnchor", undefined, [
    xmlElement("xdr:from", undefined, [
      xmlElement("xdr:col", undefined, String(image.column)),
      xmlElement("xdr:colOff", undefined, String(toEmu(paddingX))),
      xmlElement("xdr:row", undefined, String(image.row)),
      xmlElement("xdr:rowOff", undefined, String(toEmu(paddingY))),
    ]),
    xmlSelfClosing("xdr:ext", {
      cx: toEmu(image.size.width),
      cy: toEmu(image.size.height),
    }),
    xmlElement("xdr:pic", undefined, [
      xmlElement("xdr:nvPicPr", undefined, [
        xmlSelfClosing("xdr:cNvPr", {
          id: image.id,
          name: image.name,
          descr: image.alt,
        }),
        xmlElement("xdr:cNvPicPr", undefined, xmlSelfClosing("a:picLocks", { noChangeAspect: 1 })),
      ]),
      xmlElement("xdr:blipFill", undefined, [
        xmlSelfClosing("a:blip", { "r:embed": image.relId }),
        xmlElement("a:stretch", undefined, xmlSelfClosing("a:fillRect")),
      ]),
      xmlElement("xdr:spPr", undefined, [
        xmlElement("a:xfrm", undefined, [
          xmlSelfClosing("a:off", { x: 0, y: 0 }),
          xmlSelfClosing("a:ext", {
            cx: toEmu(image.size.width),
            cy: toEmu(image.size.height),
          }),
        ]),
        xmlElement("a:prstGeom", { prst: "rect" }, xmlSelfClosing("a:avLst")),
      ]),
    ]),
    xmlSelfClosing("xdr:clientData"),
  ]);
}

function writeDrawingRelationshipsXml(images: WorksheetDrawingImage[]) {
  return xmlDocument(
    "Relationships",
    {
      xmlns: "http://schemas.openxmlformats.org/package/2006/relationships",
    },
    images.map((image) =>
      xmlSelfClosing("Relationship", {
        Id: image.relId,
        Type: IMAGE_RELATIONSHIP,
        Target: `../media/${image.mediaPath.split("/").pop()}`,
      }),
    ),
  );
}

function resolveMediaPart(params: {
  data: Uint8Array;
  entries: Map<string, WorksheetMediaPart[]>;
  mediaParts: WorksheetMediaPart[];
  mediaType: WorksheetImage["mediaType"];
  nextMediaIndex: number;
}) {
  const key = `${params.mediaType}:${params.data.length}:${crc32(params.data)}`;
  const matches = params.entries.get(key) ?? [];
  const existing = matches.find((candidate) => bytesEqual(candidate.data, params.data));

  if (existing) {
    return { created: false, part: existing };
  }

  const part = {
    path: `xl/media/image${params.nextMediaIndex}.${imageExtension(params.mediaType)}`,
    data: params.data,
    mediaType: params.mediaType,
  };
  matches.push(part);
  params.entries.set(key, matches);
  params.mediaParts.push(part);

  return { created: true, part };
}

function bytesEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

function toEmu(pixels: number) {
  return Math.round(pixels * EMUS_PER_PIXEL);
}
