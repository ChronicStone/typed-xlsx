import type { BorderStyle, CellStyle, FillStyle, FontStyle } from "./types";
import { xmlDocument, xmlElement, xmlSelfClosing } from "../ooxml/xml";

interface FontEntry {
  key: string;
  value: FontStyle;
}

interface FillEntry {
  key: string;
  value: FillStyle;
}

interface BorderEntry {
  key: string;
  value: BorderStyle;
}

interface XfEntry {
  key: string;
  numFmt: string;
  fontId: number;
  fillId: number;
  borderId: number;
  style: CellStyle;
}

interface DxfEntry {
  key: string;
  style: CellStyle;
}

function colorRgb(value?: { rgb: string }) {
  if (!value?.rgb) return undefined;
  return value.rgb.length === 6 ? `FF${value.rgb}` : value.rgb;
}

function fontKey(font?: FontStyle) {
  if (!font) return "";
  return JSON.stringify(font);
}

function fillKey(fill?: FillStyle) {
  if (!fill) return "";
  return JSON.stringify(fill);
}

function borderKey(border?: BorderStyle) {
  if (!border) return "";
  return JSON.stringify(border);
}

function serializeFont(font?: FontStyle) {
  if (!font) return xmlElement("font", undefined, []);

  const children: string[] = [];
  if (font.bold) children.push(xmlSelfClosing("b"));
  if (font.italic) children.push(xmlSelfClosing("i"));
  if (font.underline) children.push(xmlSelfClosing("u"));
  if (font.strike) children.push(xmlSelfClosing("strike"));
  if (font.color) children.push(xmlSelfClosing("color", { rgb: colorRgb(font.color) }));
  if (font.size !== undefined) children.push(xmlSelfClosing("sz", { val: font.size }));
  if (font.name) children.push(xmlSelfClosing("name", { val: font.name }));
  return xmlElement("font", undefined, children);
}

function serializeFill(fill?: FillStyle) {
  if (!fill?.color) {
    return xmlElement("fill", undefined, xmlSelfClosing("patternFill", { patternType: "none" }));
  }

  return xmlElement(
    "fill",
    undefined,
    xmlElement("patternFill", { patternType: "solid" }, [
      xmlSelfClosing("fgColor", { rgb: colorRgb(fill.color) }),
      xmlSelfClosing("bgColor", { indexed: 64 }),
    ]),
  );
}

function serializeDifferentialFill(fill?: FillStyle) {
  if (!fill?.color) {
    return undefined;
  }

  return xmlElement(
    "fill",
    undefined,
    xmlElement("patternFill", { patternType: "solid" }, [
      xmlSelfClosing("fgColor", { rgb: colorRgb(fill.color) }),
    ]),
  );
}

function serializeBorder(border?: BorderStyle) {
  const side = (name: string, value?: { style?: string; color?: { rgb: string } }) => {
    if (!value?.style) return xmlSelfClosing(name);
    return xmlElement(
      name,
      { style: value.style },
      value.color ? xmlSelfClosing("color", { rgb: colorRgb(value.color) }) : "",
    );
  };

  return xmlElement("border", undefined, [
    side("left", border?.left),
    side("right", border?.right),
    side("top", border?.top),
    side("bottom", border?.bottom),
    xmlSelfClosing("diagonal"),
  ]);
}

function serializeAlignment(style: CellStyle) {
  if (!style.alignment) return "";
  return xmlSelfClosing("alignment", {
    horizontal: style.alignment.horizontal,
    vertical: style.alignment.vertical,
    wrapText: style.alignment.wrapText ? 1 : undefined,
    shrinkToFit: style.alignment.shrinkToFit ? 1 : undefined,
    textRotation: style.alignment.textRotation,
    indent: style.alignment.indent,
    readingOrder:
      style.alignment.readingOrder === "ltr"
        ? 1
        : style.alignment.readingOrder === "rtl"
          ? 2
          : undefined,
  });
}

export class StylesCollector {
  private readonly fonts: FontEntry[] = [{ key: "", value: { name: "Calibri", size: 11 } }];
  private readonly fills: FillEntry[] = [
    { key: "__none__", value: {} },
    { key: "__gray125__", value: { color: { rgb: "CCCCCC" } } },
  ];
  private readonly borders: BorderEntry[] = [{ key: "", value: {} }];
  private readonly xfs: XfEntry[] = [
    { key: "", numFmt: "", fontId: 0, fillId: 0, borderId: 0, style: {} },
  ];
  private readonly dxfs: DxfEntry[] = [];
  private readonly fontMap = new Map<string, number>([["", 0]]);
  private readonly fillMap = new Map<string, number>([
    ["__none__", 0],
    ["__gray125__", 1],
  ]);
  private readonly borderMap = new Map<string, number>([["", 0]]);
  private readonly xfMap = new Map<string, number>([["", 0]]);
  private readonly dxfMap = new Map<string, number>();
  private readonly numFmtIds = new Map<string, number>();
  private nextNumFmtId = 164;

  addStyle(style?: CellStyle) {
    if (!style) return 0;

    const fontId = this.addFont(style.font);
    const fillId = this.addFill(style.fill);
    const borderId = this.addBorder(style.border);
    const numFmt = style.numFmt ?? "";
    const key = JSON.stringify({ fontId, fillId, borderId, numFmt, alignment: style.alignment });
    const existing = this.xfMap.get(key);
    if (existing !== undefined) return existing;

    const index = this.xfs.length;
    this.xfs.push({
      key,
      numFmt,
      fontId,
      fillId,
      borderId,
      style,
    });
    this.xfMap.set(key, index);
    return index;
  }

  addDifferentialStyle(style?: CellStyle) {
    if (!style) {
      return undefined;
    }

    const key = JSON.stringify(style);
    const existing = this.dxfMap.get(key);
    if (existing !== undefined) return existing;

    const index = this.dxfs.length;
    this.dxfs.push({ key, style });
    this.dxfMap.set(key, index);
    return index;
  }

  private addFont(font?: FontStyle) {
    const key = fontKey(font);
    const existing = this.fontMap.get(key);
    if (existing !== undefined) return existing;
    const index = this.fonts.length;
    this.fonts.push({ key, value: font ?? {} });
    this.fontMap.set(key, index);
    return index;
  }

  private addFill(fill?: FillStyle) {
    const key = fillKey(fill);
    const existing = this.fillMap.get(key);
    if (existing !== undefined) return existing;
    const index = this.fills.length;
    this.fills.push({ key, value: fill ?? {} });
    this.fillMap.set(key, index);
    return index;
  }

  private addBorder(border?: BorderStyle) {
    const key = borderKey(border);
    const existing = this.borderMap.get(key);
    if (existing !== undefined) return existing;
    const index = this.borders.length;
    this.borders.push({ key, value: border ?? {} });
    this.borderMap.set(key, index);
    return index;
  }

  private numFmtId(format: string) {
    if (!format) return 0;
    const existing = this.numFmtIds.get(format);
    if (existing !== undefined) return existing;
    const id = this.nextNumFmtId++;
    this.numFmtIds.set(format, id);
    return id;
  }

  toXml() {
    for (const xf of this.xfs) {
      if (xf.numFmt) {
        this.numFmtId(xf.numFmt);
      }
    }

    const numFmtEntries = [...this.numFmtIds.entries()].map(([format, id]) =>
      xmlSelfClosing("numFmt", { numFmtId: id, formatCode: format }),
    );

    return xmlDocument(
      "styleSheet",
      { xmlns: "http://schemas.openxmlformats.org/spreadsheetml/2006/main" },
      [
        ...(numFmtEntries.length > 0
          ? [xmlElement("numFmts", { count: numFmtEntries.length }, numFmtEntries)]
          : []),
        xmlElement(
          "fonts",
          { count: this.fonts.length },
          this.fonts.map((font) => serializeFont(font.value)),
        ),
        xmlElement(
          "fills",
          { count: this.fills.length },
          this.fills.map((fill) => serializeFill(fill.value)),
        ),
        xmlElement(
          "borders",
          { count: this.borders.length },
          this.borders.map((border) => serializeBorder(border.value)),
        ),
        xmlElement(
          "cellStyleXfs",
          { count: 1 },
          xmlSelfClosing("xf", { numFmtId: 0, fontId: 0, fillId: 0, borderId: 0 }),
        ),
        xmlElement(
          "cellXfs",
          { count: this.xfs.length },
          this.xfs.map((xf) =>
            xmlElement(
              "xf",
              {
                numFmtId: this.numFmtId(xf.numFmt),
                fontId: xf.fontId,
                fillId: xf.fillId,
                borderId: xf.borderId,
                xfId: 0,
                applyNumberFormat: xf.numFmt ? 1 : undefined,
                applyFont: xf.fontId ? 1 : undefined,
                applyFill: xf.fillId ? 1 : undefined,
                applyBorder: xf.borderId ? 1 : undefined,
                applyAlignment: xf.style.alignment ? 1 : undefined,
              },
              xf.style.alignment ? serializeAlignment(xf.style) : "",
            ),
          ),
        ),
        xmlElement(
          "cellStyles",
          { count: 1 },
          xmlSelfClosing("cellStyle", { name: "Normal", xfId: 0, builtinId: 0 }),
        ),
        xmlElement(
          "dxfs",
          { count: this.dxfs.length },
          this.dxfs.map((dxf) => serializeDxf(dxf.style)),
        ),
      ],
    );
  }
}

function serializeDxf(style: CellStyle) {
  const children = [] as string[];

  if (style.font) {
    children.push(serializeFont(style.font));
  }

  if (style.fill) {
    const fill = serializeDifferentialFill(style.fill);
    if (fill) {
      children.push(fill);
    }
  }

  if (style.border) {
    children.push(serializeBorder(style.border));
  }

  if (style.numFmt) {
    children.push(xmlSelfClosing("numFmt", { numFmtId: 0, formatCode: style.numFmt }));
  }

  if (style.alignment) {
    children.push(serializeAlignment(style));
  }

  return xmlElement("dxf", undefined, children);
}
