/**
 * Builds a render model of a generated .xlsx so the docs playground can draw the real workbook
 * without Office Online. Formula cells carry no cached values in typed-xlsx output, so they are
 * evaluated here with a small engine that covers the functions the showcase uses.
 */
import { DOMParser } from "@xmldom/xmldom";
import { unzipSync } from "fflate";
import type { Element as XmlElement } from "@xmldom/xmldom";
import type {
  PreviewCell,
  PreviewImage,
  PreviewSheet,
  PreviewSparkline,
  PreviewStyle,
  PreviewTable,
  PreviewValidation,
  PreviewWorkbook,
} from "../src/_shared/preview-types";

/* ============================== xml helpers ============================== */

const parser = new DOMParser();
const parse = (xml: string) => parser.parseFromString(xml, "application/xml");
const kids = (el: XmlElement | null | undefined, tag: string) =>
  el ? (Array.from(el.getElementsByTagName(tag)) as XmlElement[]) : [];
const first = (el: XmlElement | null | undefined, tag: string) => kids(el, tag)[0] ?? null;
const directKids = (el: XmlElement | null | undefined, tag: string) =>
  el
    ? (Array.from(el.childNodes).filter(
        (n) => n.nodeType === 1 && (n as XmlElement).tagName === tag,
      ) as XmlElement[])
    : [];
const attr = (el: XmlElement | null | undefined, name: string) => el?.getAttribute(name) ?? null;
const text = (el: XmlElement | null | undefined) => (el?.textContent ?? "") as string;

function resolvePath(base: string, target: string) {
  if (target.startsWith("/")) return target.slice(1);
  const parts = base.split("/").slice(0, -1);
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

function readRels(files: Map<string, string>, part: string) {
  const dir = part.split("/").slice(0, -1).join("/");
  const name = part.split("/").pop();
  const relsXml = files.get(`${dir}/_rels/${name}.rels`);
  const rels = new Map<string, { target: string; external: boolean }>();
  if (!relsXml) return rels;
  for (const rel of kids(parse(relsXml).documentElement as unknown as XmlElement, "Relationship")) {
    const external = attr(rel, "TargetMode") === "External";
    const target = attr(rel, "Target") ?? "";
    rels.set(attr(rel, "Id") ?? "", {
      target: external ? target : resolvePath(part, target),
      external,
    });
  }
  return rels;
}

/* ============================== cell refs ============================== */

export function colToIndex(col: string) {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}
export function indexToCol(n: number) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
export function parseRef(ref: string) {
  const m = ref.replace(/\$/g, "").match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  return { c: colToIndex(m[1]!), r: Number(m[2]) };
}
function parseRange(ref: string) {
  const [a, b] = ref.split(":");
  const s = parseRef(a!);
  const e = parseRef(b ?? a!);
  if (!s || !e) return null;
  return {
    r1: Math.min(s.r, e.r),
    c1: Math.min(s.c, e.c),
    r2: Math.max(s.r, e.r),
    c2: Math.max(s.c, e.c),
  };
}
const key = (r: number, c: number) => `${indexToCol(c)}${r}`;

/* ============================== colors + styles ============================== */

const INDEXED: Record<number, string> = {
  0: "#000000",
  1: "#ffffff",
  2: "#ff0000",
  3: "#00ff00",
  4: "#0000ff",
  8: "#000000",
  9: "#ffffff",
  10: "#ff0000",
  12: "#0000ff",
  22: "#c0c0c0",
  23: "#808080",
};
function color(el: XmlElement | null): string | undefined {
  if (!el) return undefined;
  const rgb = attr(el, "rgb");
  if (rgb) return "#" + rgb.slice(-6).toLowerCase();
  const indexed = attr(el, "indexed");
  if (indexed != null) return INDEXED[Number(indexed)];
  const theme = attr(el, "theme");
  if (theme != null)
    return Number(theme) === 0 ? "#ffffff" : Number(theme) === 1 ? "#000000" : undefined;
  return undefined;
}

const BORDER_CSS: Record<string, string> = {
  thin: "1px solid",
  hair: "1px solid",
  medium: "2px solid",
  thick: "3px solid",
  double: "3px double",
  dashed: "1px dashed",
  mediumDashed: "2px dashed",
  dotted: "1px dotted",
  dashDot: "1px dashed",
};

const BUILTIN_FORMATS: Record<number, string> = {
  1: "0",
  2: "0.00",
  3: "#,##0",
  4: "#,##0.00",
  9: "0%",
  10: "0.00%",
  11: "0.00E+00",
  14: "m/d/yyyy",
  15: "d-mmm-yy",
  16: "d-mmm",
  17: "mmm-yy",
  20: "h:mm",
  22: "m/d/yyyy h:mm",
  37: "#,##0 ;(#,##0)",
  38: "#,##0 ;[Red](#,##0)",
  39: "#,##0.00;(#,##0.00)",
  40: "#,##0.00;[Red](#,##0.00)",
  49: "@",
};

function readFont(font: XmlElement | null, out: PreviewStyle) {
  if (!font) return;
  if (first(font, "b") && attr(first(font, "b"), "val") !== "0") out.b = 1;
  if (first(font, "i") && attr(first(font, "i"), "val") !== "0") out.i = 1;
  if (first(font, "u")) out.u = 1;
  if (first(font, "strike")) out.st = 1;
  const c = color(first(font, "color"));
  if (c) out.c = c;
  const sz = attr(first(font, "sz"), "val");
  if (sz && Number(sz) !== 11) out.sz = Math.round((Number(sz) * 4) / 3);
}
function readFill(fill: XmlElement | null, out: PreviewStyle) {
  const pattern = first(fill, "patternFill");
  if (!pattern) return;
  const type = attr(pattern, "patternType");
  if (type && type !== "none") {
    const c = color(first(pattern, "fgColor")) ?? color(first(pattern, "bgColor"));
    if (c) out.f = c;
  }
}
function readBorder(border: XmlElement | null, out: PreviewStyle) {
  if (!border) return;
  (
    [
      ["top", "bt"],
      ["right", "br"],
      ["bottom", "bb"],
      ["left", "bl"],
    ] as const
  ).forEach(([side, k]) => {
    const el = first(border, side);
    const style = attr(el, "style");
    if (el && style && BORDER_CSS[style])
      out[k] = `${BORDER_CSS[style]} ${color(first(el, "color")) ?? "#000000"}`;
  });
}

function readStyles(xml: string | undefined) {
  const styles: PreviewStyle[] = [];
  const dxfs: PreviewStyle[] = [];
  if (!xml) return { styles: [{}], dxfs };
  const doc = parse(xml).documentElement as unknown as XmlElement;
  const numFmts = new Map<number, string>();
  for (const nf of kids(doc, "numFmt"))
    numFmts.set(Number(attr(nf, "numFmtId")), attr(nf, "formatCode") ?? "");
  const fonts = directKids(first(doc, "fonts"), "font");
  const fills = directKids(first(doc, "fills"), "fill");
  const borders = directKids(first(doc, "borders"), "border");
  for (const xf of directKids(first(doc, "cellXfs"), "xf")) {
    const s: PreviewStyle = {};
    readFont(fonts[Number(attr(xf, "fontId") ?? 0)] ?? null, s);
    readFill(fills[Number(attr(xf, "fillId") ?? 0)] ?? null, s);
    readBorder(borders[Number(attr(xf, "borderId") ?? 0)] ?? null, s);
    const id = Number(attr(xf, "numFmtId") ?? 0);
    const fmt = numFmts.get(id) ?? BUILTIN_FORMATS[id];
    if (fmt && fmt !== "General") s.fmt = fmt;
    const al = first(xf, "alignment");
    if (al) {
      const h = attr(al, "horizontal");
      const v = attr(al, "vertical");
      if (h && h !== "general") s.ha = h;
      if (v) s.va = v;
      if (attr(al, "wrapText") === "1") s.wrap = 1;
      if (attr(al, "indent")) s.ind = Number(attr(al, "indent"));
    }
    if (attr(first(xf, "protection"), "locked") === "0") s.ul = 1;
    if (first(xf, "xfpb:xfComplement")) s.cb = 1;
    styles.push(s);
  }
  for (const dxf of directKids(first(doc, "dxfs"), "dxf")) {
    const s: PreviewStyle = {};
    readFont(first(dxf, "font"), s);
    readFill(first(dxf, "fill"), s);
    readBorder(first(dxf, "border"), s);
    dxfs.push(s);
  }
  return { styles: styles.length ? styles : [{}], dxfs };
}

/* ============================== number formats ============================== */

function splitSections(code: string) {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i]!;
    if (ch === '"') quoted = !quoted;
    if (ch === ";" && !quoted) {
      out.push(cur);
      cur = "";
      continue;
    }
    if (ch === "\\" && !quoted) {
      cur += ch + (code[++i] ?? "");
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}
const unquote = (s: string) =>
  s
    .replace(/\[[^\]]*\]/g, "")
    .replace(/"([^"]*)"/g, "$1")
    .replace(/\\(.)/g, "$1")
    .replace(/_./g, " ")
    .replace(/\*./g, "");
const stripLiterals = (s: string) =>
  s
    .replace(/"[^"]*"/g, "")
    .replace(/\\./g, "")
    .replace(/\[[^\]]*\]/g, "");

function isDateFormat(section: string) {
  return /[ymdhs]/i.test(stripLiterals(section)) && !/[0#?]/.test(stripLiterals(section));
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
function formatDate(serial: number, section: string) {
  const d = new Date(Math.round((serial - 25569) * 86400000));
  const Y = d.getUTCFullYear();
  const M = d.getUTCMonth();
  const D = d.getUTCDate();
  const h = d.getUTCHours();
  const mi = d.getUTCMinutes();
  const s = d.getUTCSeconds();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = section.replace(/\[[^\]]*\]/g, "");
  let out = "";
  let i = 0;
  let lastWasHour = false;
  while (i < fmt.length) {
    const rest = fmt.slice(i);
    const lower = rest.toLowerCase();
    if (rest[0] === '"') {
      const end = rest.indexOf('"', 1);
      out += rest.slice(1, end < 0 ? undefined : end);
      i += end < 0 ? rest.length : end + 1;
      continue;
    }
    if (rest[0] === "\\") {
      out += rest[1] ?? "";
      i += 2;
      continue;
    }
    const tok = lower.match(/^(yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s|am\/pm)/)?.[0];
    if (!tok) {
      out += rest[0];
      i += 1;
      continue;
    }
    if (tok === "yyyy") out += Y;
    else if (tok === "yy") out += pad(Y % 100);
    else if (tok === "mmmm") out += MONTHS[M];
    else if (tok === "mmm") out += MONTHS[M]!.slice(0, 3);
    else if (tok === "mm" || tok === "m")
      out += lastWasHour ? (tok === "mm" ? pad(mi) : mi) : tok === "mm" ? pad(M + 1) : M + 1;
    else if (tok === "dddd")
      out += d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
    else if (tok === "ddd")
      out += d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
    else if (tok === "dd") out += pad(D);
    else if (tok === "d") out += D;
    else if (tok === "hh") out += pad(h);
    else if (tok === "h") out += h;
    else if (tok === "ss") out += pad(s);
    else if (tok === "s") out += s;
    else if (tok === "am/pm") out += h < 12 ? "AM" : "PM";
    lastWasHour = tok === "hh" || tok === "h";
    i += tok.length;
  }
  return out;
}

function generalNumber(n: number) {
  if (!Number.isFinite(n)) return "#NUM!";
  if (Number.isInteger(n) && Math.abs(n) < 1e11) return String(n);
  const abs = Math.abs(n);
  if (abs !== 0 && (abs < 1e-9 || abs >= 1e11)) return n.toExponential(5).toUpperCase();
  return String(Number(n.toPrecision(10)));
}

export function formatNumber(n: number, code?: string): string {
  if (!code || code === "General" || code === "@") return generalNumber(n);
  const sections = splitSections(code);
  let section = sections[0]!;
  let value = n;
  let sign = "";
  if (n < 0 && sections.length > 1 && sections[1]) {
    section = sections[1];
    value = -n;
  } else if (n === 0 && sections.length > 2 && sections[2]) {
    section = sections[2];
  } else if (n < 0) {
    sign = "-";
    value = -n;
  }
  if (isDateFormat(section)) return formatDate(n, section);
  const bare = stripLiterals(section);
  if (bare.includes("%")) value *= 100;
  const scientific = /E[+-]/i.test(bare);
  const m = section.match(/[0#?][0#?,]*(\.[0#?]*)?|\.[0#?]+/);
  if (!m) return sign + unquote(section);
  const pattern = m[0];
  const prefix = unquote(section.slice(0, m.index));
  const suffix = unquote(section.slice((m.index ?? 0) + pattern.length));
  if (scientific)
    return (
      sign +
      prefix +
      value.toExponential((pattern.split(".")[1] ?? "").length).toUpperCase() +
      suffix
    );
  const decimals = (pattern.split(".")[1] ?? "").replace(/[^0#?]/g, "").length;
  const minDecimals = (pattern.split(".")[1] ?? "").replace(/[^0]/g, "").length;
  const grouping = /[0#?],[0#?]/.test(pattern);
  let body = value.toLocaleString("en-US", {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: decimals,
    useGrouping: grouping,
  });
  const intZeros = (pattern.split(".")[0] ?? "").replace(/[^0]/g, "").length;
  if (intZeros === 0 && body.startsWith("0.")) body = body.slice(1);
  if (intZeros === 0 && body === "0") body = "";
  return sign + prefix + body + suffix;
}

/* ============================== formula engine ============================== */

type ErrorValue = { err: string };
type ImageValue = { image: string };
type Scalar = number | string | boolean | null | ErrorValue | ImageValue;
type RangeValue = { range: Scalar[][] };
type Value = Scalar | RangeValue;

const isErr = (v: unknown): v is ErrorValue => typeof v === "object" && v !== null && "err" in v;
const isRange = (v: unknown): v is RangeValue =>
  typeof v === "object" && v !== null && "range" in v;
const err = (e: string): ErrorValue => ({ err: e });

type Node =
  | { k: "num"; v: number }
  | { k: "str"; v: string }
  | { k: "bool"; v: boolean }
  | { k: "err"; v: string }
  | { k: "ref"; sheet?: string; c: number; r: number; ac: boolean; ar: boolean }
  | {
      k: "range";
      sheet?: string;
      c1: number;
      r1: number;
      c2: number;
      r2: number;
      ac1: boolean;
      ar1: boolean;
      ac2: boolean;
      ar2: boolean;
    }
  | { k: "sref"; table?: string; spec: string }
  | { k: "call"; name: string; args: Node[] }
  | { k: "bin"; op: string; l: Node; r: Node }
  | { k: "neg"; e: Node }
  | { k: "pct"; e: Node };

type Tok = { t: string; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const cellRe = /^(\$?)([A-Z]{1,3})(\$?)(\d+)/;
  while (i < src.length) {
    const rest = src.slice(i);
    const ch = src[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      let s = "";
      while (j < src.length) {
        if (src[j] === '"' && src[j + 1] === '"') {
          s += '"';
          j += 2;
        } else if (src[j] === '"') break;
        else s += src[j++];
      }
      out.push({ t: "str", v: s });
      i = j + 1;
      continue;
    }
    if (ch === "#") {
      const m = rest.match(/^#(DIV\/0!|N\/A|VALUE!|REF!|NAME\?|NUM!|NULL!)/);
      if (m) {
        out.push({ t: "err", v: m[0] });
        i += m[0].length;
        continue;
      }
    }
    // sheet-qualified reference
    const sheetM = rest.match(/^(?:'((?:[^']|'')+)'|([A-Za-z_][\w.]*))!/);
    if (sheetM) {
      const sheet = (sheetM[1] ?? sheetM[2] ?? "").replace(/''/g, "'");
      out.push({ t: "sheet", v: sheet });
      i += sheetM[0].length;
      continue;
    }
    // structured reference: Table[...] or [...]
    const tableM = rest.match(/^([A-Za-z_][\w.]*)\[/);
    if (ch === "[" || (tableM && !cellRe.test(rest))) {
      const name = ch === "[" ? "" : tableM![1]!;
      let j = i + name.length;
      let depth = 0;
      do {
        if (src[j] === "[") depth++;
        else if (src[j] === "]") depth--;
        j++;
      } while (j < src.length && depth > 0);
      out.push({ t: "sref", v: `${name}\u0000${src.slice(i + name.length, j)}` });
      i = j;
      continue;
    }
    const fn = rest.match(/^([A-Z][A-Z0-9._]*)\(/i);
    if (fn) {
      out.push({ t: "fn", v: fn[1]!.toUpperCase() });
      i += fn[0].length;
      continue;
    }
    const cell = rest.match(cellRe);
    if (cell) {
      out.push({ t: "cell", v: cell[0] });
      i += cell[0].length;
      continue;
    }
    const num = rest.match(/^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/);
    if (num) {
      out.push({ t: "num", v: num[0] });
      i += num[0].length;
      continue;
    }
    const bool = rest.match(/^(TRUE|FALSE)\b/i);
    if (bool) {
      out.push({ t: "bool", v: bool[0].toUpperCase() });
      i += bool[0].length;
      continue;
    }
    const op = rest.match(/^(<>|<=|>=|[-+*/^&=<>%(),:;])/);
    if (op) {
      out.push({ t: "op", v: op[0] });
      i += op[0].length;
      continue;
    }
    throw new Error(`Unsupported formula token at "${rest.slice(0, 20)}" in ${src}`);
  }
  return out;
}

function parseFormula(src: string): Node {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++]!;
  const expectOp = (v: string) => {
    const t = next();
    if (!t || t.t !== "op" || t.v !== v) throw new Error(`Expected "${v}" in ${src}`);
  };
  const BIN: Record<string, number> = {
    "=": 1,
    "<>": 1,
    "<": 1,
    ">": 1,
    "<=": 1,
    ">=": 1,
    "&": 2,
    "+": 3,
    "-": 3,
    "*": 4,
    "/": 4,
    "^": 5,
  };

  function cellNode(v: string, sheet?: string): Node {
    const m = v.match(/^(\$?)([A-Z]{1,3})(\$?)(\d+)$/)!;
    return {
      k: "ref",
      sheet,
      c: colToIndex(m[2]!),
      r: Number(m[4]),
      ac: m[1] === "$",
      ar: m[3] === "$",
    };
  }
  function primary(): Node {
    const t = next();
    if (!t) throw new Error(`Unexpected end of ${src}`);
    if (t.t === "num") return { k: "num", v: Number(t.v) };
    if (t.t === "str") return { k: "str", v: t.v };
    if (t.t === "bool") return { k: "bool", v: t.v === "TRUE" };
    if (t.t === "err") return { k: "err", v: t.v };
    if (t.t === "sref") {
      const [table, spec] = t.v.split("\u0000") as [string, string];
      return { k: "sref", table: table || undefined, spec };
    }
    if (t.t === "sheet") {
      const c = next();
      return refOrRange(cellNode(c.v, t.v), t.v);
    }
    if (t.t === "cell") return refOrRange(cellNode(t.v));
    if (t.t === "fn") {
      const args: Node[] = [];
      if (!(peek()?.t === "op" && peek()!.v === ")")) {
        for (;;) {
          if (peek()?.t === "op" && (peek()!.v === "," || peek()!.v === ")"))
            args.push({ k: "str", v: "" });
          else args.push(expr(0));
          const sep = next();
          if (sep.t === "op" && sep.v === ")") break;
          if (!(sep.t === "op" && (sep.v === "," || sep.v === ";")))
            throw new Error(`Bad argument list in ${src}`);
        }
      } else next();
      return { k: "call", name: t.v, args };
    }
    if (t.t === "op" && t.v === "(") {
      const e = expr(0);
      expectOp(")");
      return e;
    }
    if (t.t === "op" && t.v === "-") return { k: "neg", e: unary() };
    if (t.t === "op" && t.v === "+") return unary();
    throw new Error(`Unexpected token "${t.v}" in ${src}`);
  }
  function refOrRange(start: Node, sheet?: string): Node {
    if (peek()?.t === "op" && peek()!.v === ":" && toks[p + 1]?.t === "cell") {
      next();
      const end = cellNode(next().v, sheet) as Extract<Node, { k: "ref" }>;
      const s = start as Extract<Node, { k: "ref" }>;
      return {
        k: "range",
        sheet,
        c1: s.c,
        r1: s.r,
        c2: end.c,
        r2: end.r,
        ac1: s.ac,
        ar1: s.ar,
        ac2: end.ac,
        ar2: end.ar,
      };
    }
    return start;
  }
  function unary(): Node {
    let e = primary();
    while (peek()?.t === "op" && peek()!.v === "%") {
      next();
      e = { k: "pct", e };
    }
    return e;
  }
  function expr(minPrec: number): Node {
    let left = unary();
    for (;;) {
      const t = peek();
      if (!t || t.t !== "op" || !(t.v in BIN)) break;
      const prec = BIN[t.v]!;
      if (prec < minPrec) break;
      next();
      // every Excel binary operator is left-associative
      const right = expr(prec + 1);
      left = { k: "bin", op: t.v, l: left, r: right };
    }
    return left;
  }
  const out = expr(0);
  if (p < toks.length) throw new Error(`Trailing tokens in ${src}`);
  return out;
}

interface RawCell {
  t?: string;
  v?: string;
  f?: string;
  s?: number;
}
interface EvalSheet {
  name: string;
  cells: Map<string, RawCell>;
  memo: Map<string, Scalar>;
}
interface EvalTable {
  name: string;
  sheet: string;
  r1: number;
  c1: number;
  r2: number;
  c2: number;
  columns: string[];
  header: boolean;
  totals: boolean;
}
interface Ctx {
  sheet: EvalSheet;
  r: number;
  c: number;
  /** relative shift applied to non-absolute refs (conditional formats) */
  dr: number;
  dc: number;
}

class Engine {
  sheets = new Map<string, EvalSheet>();
  tables: EvalTable[] = [];
  parsed = new Map<string, Node>();
  stack = new Set<string>();
  constructor(public sharedStrings: string[]) {}

  node(src: string) {
    let n = this.parsed.get(src);
    if (!n) {
      n = parseFormula(src);
      this.parsed.set(src, n);
    }
    return n;
  }

  cellValue(sheet: EvalSheet, r: number, c: number): Scalar {
    const k = key(r, c);
    const cell = sheet.cells.get(k);
    if (!cell) return null;
    if (cell.f != null) {
      const memoKey = k;
      if (sheet.memo.has(memoKey)) return sheet.memo.get(memoKey)!;
      const stackKey = `${sheet.name}!${k}`;
      if (this.stack.has(stackKey)) return err("#REF!");
      this.stack.add(stackKey);
      let v: Scalar;
      try {
        v = this.scalar(this.evalNode(this.node(cell.f), { sheet, r, c, dr: 0, dc: 0 }));
      } catch {
        v = err("#NAME?");
      }
      this.stack.delete(stackKey);
      sheet.memo.set(memoKey, v);
      return v;
    }
    switch (cell.t) {
      case "s":
        return this.sharedStrings[Number(cell.v)] ?? "";
      case "b":
        return cell.v === "1";
      case "e":
        return err(cell.v ?? "#VALUE!");
      case "str":
      case "inlineStr":
        return cell.v ?? "";
      default:
        return cell.v == null || cell.v === "" ? null : Number(cell.v);
    }
  }

  evalFormulaAt(src: string, sheet: EvalSheet, r: number, c: number, dr = 0, dc = 0): Scalar {
    try {
      return this.scalar(this.evalNode(this.node(src), { sheet, r, c, dr, dc }));
    } catch {
      return err("#NAME?");
    }
  }

  scalar(v: Value): Scalar {
    if (isRange(v)) return v.range[0]?.[0] ?? null;
    return v;
  }

  sheetOf(name: string | undefined, ctx: Ctx) {
    return name ? this.sheets.get(name) : ctx.sheet;
  }

  rangeValue(
    sheet: EvalSheet | undefined,
    r1: number,
    c1: number,
    r2: number,
    c2: number,
  ): RangeValue {
    const range: Scalar[][] = [];
    if (!sheet) return { range: [[err("#REF!")]] };
    for (let r = r1; r <= r2; r++) {
      const row: Scalar[] = [];
      for (let c = c1; c <= c2; c++) row.push(this.cellValue(sheet, r, c));
      range.push(row);
    }
    return { range };
  }

  tableFor(name: string | undefined, ctx: Ctx) {
    if (name) return this.tables.find((t) => t.name === name);
    return this.tables.find(
      (t) =>
        t.sheet === ctx.sheet.name &&
        ctx.r >= t.r1 &&
        ctx.r <= t.r2 &&
        ctx.c >= t.c1 &&
        ctx.c <= t.c2,
    );
  }

  structured(node: Extract<Node, { k: "sref" }>, ctx: Ctx): Value {
    const table = this.tableFor(node.table, ctx);
    if (!table) return err("#REF!");
    const inner = node.spec.slice(1, -1);
    const parts = inner.startsWith("[")
      ? inner.match(/\[[^\]]*\]/g)!.map((s) => s.slice(1, -1))
      : [inner];
    let area: "data" | "this" | "headers" | "totals" | "all" = "data";
    const cols: string[] = [];
    for (const part of parts) {
      if (part.startsWith("@")) {
        area = "this";
        const rest = part.slice(1).replace(/^\[|\]$/g, "");
        if (rest) cols.push(rest);
      } else if (part === "#This Row") area = "this";
      else if (part === "#Headers") area = "headers";
      else if (part === "#Totals") area = "totals";
      else if (part === "#All") area = "all";
      else if (part === "#Data") area = "data";
      else cols.push(part);
    }
    const idx = cols.map((c) => table.columns.indexOf(c));
    if (idx.some((i) => i < 0)) return err("#REF!");
    const c1 = table.c1 + (idx.length ? Math.min(...idx) : 0);
    const c2 = table.c1 + (idx.length ? Math.max(...idx) : table.columns.length - 1);
    const dataStart = table.r1 + (table.header ? 1 : 0);
    const dataEnd = table.r2 - (table.totals ? 1 : 0);
    const sheet = this.sheets.get(table.sheet);
    if (area === "this") return this.rangeValue(sheet, ctx.r, c1, ctx.r, c2);
    if (area === "headers") return this.rangeValue(sheet, table.r1, c1, table.r1, c2);
    if (area === "totals") return this.rangeValue(sheet, table.r2, c1, table.r2, c2);
    if (area === "all") return this.rangeValue(sheet, table.r1, c1, table.r2, c2);
    return this.rangeValue(sheet, dataStart, c1, dataEnd, c2);
  }

  evalNode(n: Node, ctx: Ctx): Value {
    switch (n.k) {
      case "num":
        return n.v;
      case "str":
        return n.v;
      case "bool":
        return n.v;
      case "err":
        return err(n.v);
      case "ref": {
        const sheet = this.sheetOf(n.sheet, ctx);
        if (!sheet) return err("#REF!");
        return this.cellValue(sheet, n.r + (n.ar ? 0 : ctx.dr), n.c + (n.ac ? 0 : ctx.dc));
      }
      case "range": {
        const sheet = this.sheetOf(n.sheet, ctx);
        return this.rangeValue(
          sheet,
          n.r1 + (n.ar1 ? 0 : ctx.dr),
          n.c1 + (n.ac1 ? 0 : ctx.dc),
          n.r2 + (n.ar2 ? 0 : ctx.dr),
          n.c2 + (n.ac2 ? 0 : ctx.dc),
        );
      }
      case "sref":
        return this.structured(n, ctx);
      case "neg": {
        const v = toNumber(this.scalar(this.evalNode(n.e, ctx)));
        return isErr(v) ? v : -v;
      }
      case "pct": {
        const v = toNumber(this.scalar(this.evalNode(n.e, ctx)));
        return isErr(v) ? v : v / 100;
      }
      case "bin":
        return binary(
          n.op,
          this.scalar(this.evalNode(n.l, ctx)),
          this.scalar(this.evalNode(n.r, ctx)),
        );
      case "call":
        return this.call(n.name, n.args, ctx);
    }
  }

  call(name: string, args: Node[], ctx: Ctx): Value {
    const ev = (i: number) => this.evalNode(args[i]!, ctx);
    const sc = (i: number) => (args[i] ? this.scalar(ev(i)) : null);
    switch (name) {
      case "IF": {
        const cond = toBool(sc(0));
        if (isErr(cond)) return cond;
        return cond ? (args[1] ? ev(1) : true) : args[2] ? ev(2) : false;
      }
      case "IFERROR": {
        const v = sc(0);
        return isErr(v) ? ev(1) : v;
      }
      case "AND":
      case "OR": {
        const vals = flatten(args.map((_, i) => ev(i))).filter(
          (v) => v !== null && typeof v !== "string",
        );
        const bools = vals.map(toBool);
        const e = bools.find(isErr);
        if (e) return e;
        return name === "AND" ? bools.every(Boolean) : bools.some(Boolean);
      }
      case "NOT": {
        const v = toBool(sc(0));
        return isErr(v) ? v : !v;
      }
      case "ROUND":
      case "ROUNDUP":
      case "ROUNDDOWN": {
        const x = toNumber(sc(0));
        const d = toNumber(sc(1) ?? 0);
        if (isErr(x)) return x;
        if (isErr(d)) return d;
        const f = 10 ** d;
        const y = x * f;
        const r =
          name === "ROUND"
            ? Math.sign(y) * Math.round(Math.abs(y) + 1e-9)
            : name === "ROUNDUP"
              ? Math.sign(y) * Math.ceil(Math.abs(y) - 1e-9)
              : Math.trunc(y);
        return r / f;
      }
      case "ABS": {
        const x = toNumber(sc(0));
        return isErr(x) ? x : Math.abs(x);
      }
      case "SUM":
      case "AVERAGE":
      case "MIN":
      case "MAX":
      case "COUNT":
      case "COUNTA":
        return aggregate(
          name,
          args.map((_, i) => ev(i)),
        );
      case "SUBTOTAL": {
        const fn = toNumber(sc(0));
        if (isErr(fn)) return fn;
        const map: Record<number, string> = {
          1: "AVERAGE",
          2: "COUNT",
          3: "COUNTA",
          4: "MAX",
          5: "MIN",
          9: "SUM",
        };
        const agg = map[fn % 100];
        if (!agg) return err("#VALUE!");
        return aggregate(
          agg,
          args.slice(1).map((_, i) => ev(i + 1)),
        );
      }
      case "CONCAT":
      case "CONCATENATE":
        return flatten(args.map((_, i) => ev(i)))
          .map(toText)
          .join("");
      case "IMAGE": {
        const url = sc(0);
        return typeof url === "string" ? { image: url } : err("#VALUE!");
      }
      case "INDIRECT": {
        const refText = toText(sc(0));
        const a1 = sc(1);
        if (a1 === false) {
          const m = refText.match(/^R(\[(-?\d+)\]|(\d+))?C(\[(-?\d+)\]|(\d+))?$/);
          if (!m) return err("#REF!");
          const row =
            m[2] != null
              ? ctx.r + ctx.dr + Number(m[2])
              : m[3] != null
                ? Number(m[3])
                : ctx.r + ctx.dr;
          const col =
            m[5] != null
              ? ctx.c + ctx.dc + Number(m[5])
              : m[6] != null
                ? Number(m[6])
                : ctx.c + ctx.dc;
          return this.cellValue(ctx.sheet, row, col);
        }
        const ref = parseRef(refText);
        return ref ? this.cellValue(ctx.sheet, ref.r, ref.c) : err("#REF!");
      }
      case "LEN":
        return toText(sc(0)).length;
      case "UPPER":
        return toText(sc(0)).toUpperCase();
      case "LOWER":
        return toText(sc(0)).toLowerCase();
      default:
        return err("#NAME?");
    }
  }
}

function flatten(values: Value[]): Scalar[] {
  return values.flatMap((v) => (isRange(v) ? v.range.flat() : [v]));
}
function aggregate(name: string, values: Value[]): Scalar {
  const nums: number[] = [];
  let counta = 0;
  for (const v of values) {
    if (isRange(v)) {
      for (const x of v.range.flat()) {
        if (isErr(x)) return x;
        if (x !== null && x !== "") counta++;
        if (typeof x === "number") nums.push(x);
      }
    } else {
      if (isErr(v)) return v;
      if (v !== null) counta++;
      const n = toNumber(v);
      if (!isErr(n)) nums.push(n);
    }
  }
  if (name === "SUM") return nums.reduce((a, b) => a + b, 0);
  if (name === "COUNT") return nums.length;
  if (name === "COUNTA") return counta;
  if (name === "AVERAGE")
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : err("#DIV/0!");
  if (name === "MIN") return nums.length ? Math.min(...nums) : 0;
  if (name === "MAX") return nums.length ? Math.max(...nums) : 0;
  return err("#NAME?");
}
function toNumber(v: Scalar): number | ErrorValue {
  if (isErr(v)) return v;
  if (v === null || v === "") return 0;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return err("#VALUE!");
}
function toBool(v: Scalar): boolean | ErrorValue {
  if (isErr(v)) return v;
  if (typeof v === "boolean") return v;
  if (v === null) return false;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    if (v.toUpperCase() === "TRUE") return true;
    if (v.toUpperCase() === "FALSE") return false;
  }
  return err("#VALUE!");
}
function toText(v: Scalar): string {
  if (v === null) return "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return generalNumber(v);
  if (isErr(v)) return v.err;
  if (typeof v === "object") return "";
  return v;
}
function compare(a: Scalar, b: Scalar): number {
  const rank = (v: Scalar) =>
    typeof v === "number" || v === null ? 0 : typeof v === "string" ? 1 : 2;
  const na = a === null ? (typeof b === "string" ? "" : typeof b === "boolean" ? false : 0) : a;
  const nb = b === null ? (typeof a === "string" ? "" : typeof a === "boolean" ? false : 0) : b;
  if (rank(na as Scalar) !== rank(nb as Scalar)) return rank(na as Scalar) - rank(nb as Scalar);
  if (typeof na === "string" && typeof nb === "string")
    return na.toLowerCase().localeCompare(nb.toLowerCase());
  return Number(na) - Number(nb);
}
function binary(op: string, a: Scalar, b: Scalar): Scalar {
  if (isErr(a)) return a;
  if (isErr(b)) return b;
  if (op === "&") return toText(a) + toText(b);
  if (["=", "<>", "<", ">", "<=", ">="].includes(op)) {
    const c = compare(a, b);
    return op === "="
      ? c === 0
      : op === "<>"
        ? c !== 0
        : op === "<"
          ? c < 0
          : op === ">"
            ? c > 0
            : op === "<="
              ? c <= 0
              : c >= 0;
  }
  const x = toNumber(a);
  const y = toNumber(b);
  if (isErr(x)) return x;
  if (isErr(y)) return y;
  if (op === "+") return x + y;
  if (op === "-") return x - y;
  if (op === "*") return x * y;
  if (op === "/") return y === 0 ? err("#DIV/0!") : x / y;
  if (op === "^") return x ** y;
  return err("#VALUE!");
}

/* ============================== workbook ============================== */

const EMU_PER_PX = 9525;
const colWidthPx = (w: number) => Math.round(w * 7 + 5);
const ptToPx = (pt: number) => Math.round((pt * 4) / 3);

export interface PreviewOptions {
  /** sheets longer than this keep their head and tail rows only */
  maxRows?: number;
  headRows?: number;
  tailRows?: number;
}

export function buildWorkbookPreview(
  bytes: Uint8Array,
  options: PreviewOptions = {},
): PreviewWorkbook {
  const maxRows = options.maxRows ?? 200;
  const headRows = options.headRows ?? 120;
  const tailRows = options.tailRows ?? 6;
  const zip = unzipSync(bytes);
  const files = new Map<string, string>();
  const binaries = new Map<string, Uint8Array>();
  for (const [name, content] of Object.entries(zip)) {
    if (/\.(xml|rels)$/.test(name)) files.set(name, Buffer.from(content).toString("utf8"));
    else binaries.set(name, content);
  }

  const sharedStrings = kids(
    files.get("xl/sharedStrings.xml")
      ? (parse(files.get("xl/sharedStrings.xml")!).documentElement as unknown as XmlElement)
      : null,
    "si",
  ).map((si) => kids(si, "t").map(text).join(""));
  const { styles, dxfs } = readStyles(files.get("xl/styles.xml"));
  const engine = new Engine(sharedStrings);

  const workbook = parse(files.get("xl/workbook.xml") ?? "<workbook/>")
    .documentElement as unknown as XmlElement;
  const wbRels = readRels(files, "xl/workbook.xml");
  const sheetDefs = kids(workbook, "sheet").map((el) => ({
    name: attr(el, "name") ?? "Sheet",
    part: wbRels.get(attr(el, "r:id") ?? "")?.target ?? "",
  }));

  // pass 1: load raw cells and tables for every sheet so cross-sheet formulas resolve
  const loaded = sheetDefs.map((def) => {
    const xml = files.get(def.part) ?? "<worksheet/>";
    const doc = parse(xml).documentElement as unknown as XmlElement;
    const rels = readRels(files, def.part);
    const evalSheet: EvalSheet = { name: def.name, cells: new Map(), memo: new Map() };
    let maxR = 0;
    let maxC = 0;
    const rowHeights: Record<number, number> = {};
    for (const row of kids(doc, "row")) {
      const r = Number(attr(row, "r"));
      if (attr(row, "ht") && attr(row, "customHeight") === "1")
        rowHeights[r] = ptToPx(Number(attr(row, "ht")));
      for (const c of directKids(row, "c")) {
        const ref = parseRef(attr(c, "r") ?? "");
        if (!ref) continue;
        const f = first(c, "f");
        const t = attr(c, "t") ?? undefined;
        const isText = t === "inlineStr" ? kids(first(c, "is"), "t").map(text).join("") : undefined;
        evalSheet.cells.set(key(ref.r, ref.c), {
          t,
          v: isText ?? (first(c, "v") ? text(first(c, "v")) : undefined),
          f: f ? text(f) : undefined,
          s: attr(c, "s") ? Number(attr(c, "s")) : undefined,
        });
        maxR = Math.max(maxR, ref.r);
        maxC = Math.max(maxC, ref.c);
      }
    }
    engine.sheets.set(def.name, evalSheet);
    const tables: PreviewTable[] = [];
    for (const tp of kids(doc, "tablePart")) {
      const target = rels.get(attr(tp, "r:id") ?? "")?.target;
      const tableXml = target ? files.get(target) : undefined;
      if (!tableXml) continue;
      const t = parse(tableXml).documentElement as unknown as XmlElement;
      const range = parseRange(attr(t, "ref") ?? "");
      if (!range) continue;
      const header = attr(t, "headerRowCount") !== "0";
      const totals = Number(attr(t, "totalsRowCount") ?? 0) > 0;
      engine.tables.push({
        name: attr(t, "displayName") ?? attr(t, "name") ?? "",
        sheet: def.name,
        ...range,
        columns: kids(t, "tableColumn").map((c) => attr(c, "name") ?? ""),
        header,
        totals,
      });
      const info = first(t, "tableStyleInfo");
      tables.push({
        name: attr(t, "displayName") ?? "",
        ref: attr(t, "ref") ?? "",
        style: attr(info, "name") ?? "TableStyleMedium2",
        stripes: attr(info, "showRowStripes") !== "0",
        header,
        totals,
        filter: !!first(t, "autoFilter"),
      });
    }
    return { def, doc, rels, evalSheet, maxR, maxC, rowHeights, tables };
  });

  // pass 2: evaluate and build the render model
  const sheets = loaded.map(({ def, doc, rels, evalSheet, maxR, maxC, rowHeights, tables }) => {
    const dim = parseRange(attr(first(doc, "dimension"), "ref") ?? "A1");
    const rows = Math.max(maxR, dim?.r2 ?? 1);
    const cols = Math.max(maxC, dim?.c2 ?? 1);
    const fmtPr = first(doc, "sheetFormatPr");
    const defaultRowHeight = ptToPx(Number(attr(fmtPr, "defaultRowHeight") ?? 15));
    const defaultColWidth = Number(attr(fmtPr, "defaultColWidth") ?? 8.43);
    const colWidths = Array.from({ length: cols }, () => colWidthPx(defaultColWidth));
    for (const col of kids(doc, "col")) {
      const min = Number(attr(col, "min"));
      const max = Number(attr(col, "max"));
      const w =
        attr(col, "hidden") === "1" ? 0 : colWidthPx(Number(attr(col, "width") ?? defaultColWidth));
      for (let i = min; i <= Math.min(max, cols); i++) colWidths[i - 1] = w;
    }
    const pane = first(doc, "pane");
    const freeze =
      pane && (attr(pane, "state") === "frozen" || attr(pane, "state") === "frozenSplit")
        ? { rows: Number(attr(pane, "ySplit") ?? 0), cols: Number(attr(pane, "xSplit") ?? 0) }
        : undefined;

    const keep = (r: number) => rows <= maxRows || r <= headRows || r > rows - tailRows;
    const gap =
      rows > maxRows ? { after: headRows, hidden: rows - headRows - tailRows } : undefined;

    const cells: Record<string, PreviewCell> = {};
    for (const [k, raw] of evalSheet.cells) {
      const ref = parseRef(k)!;
      if (!keep(ref.r)) continue;
      const value = engine.cellValue(evalSheet, ref.r, ref.c);
      const style = raw.s != null ? styles[raw.s] : undefined;
      const cell: PreviewCell = { v: "" };
      if (raw.s) cell.s = raw.s;
      if (raw.f != null) cell.f = raw.f;
      if (value === null) {
        cell.v = "";
      } else if (typeof value === "number") {
        cell.t = "n";
        cell.v = formatNumber(value, style?.fmt);
        const rawText = generalNumber(value);
        if (rawText !== cell.v || raw.f != null) cell.r = rawText;
      } else if (typeof value === "boolean") {
        cell.t = "b";
        cell.v = value ? "TRUE" : "FALSE";
      } else if (isErr(value)) {
        cell.t = "e";
        cell.v = value.err;
      } else if (typeof value === "object" && "image" in value) {
        cell.t = "img";
        cell.v = "";
        cell.src = value.image;
      } else {
        cell.v = String(value);
      }
      if (!cell.v && !cell.s && cell.f == null && !cell.src) continue;
      cells[k] = cell;
    }

    // conditional formats: rules are relative to the top-left cell of their range (ECMA-376)
    for (const block of kids(doc, "conditionalFormatting")) {
      const ranges = (attr(block, "sqref") ?? "")
        .split(/\s+/)
        .map(parseRange)
        .filter(Boolean) as NonNullable<ReturnType<typeof parseRange>>[];
      if (!ranges.length) continue;
      const anchor = ranges[0]!;
      const rules = kids(block, "cfRule")
        .filter((rule) => attr(rule, "type") === "expression")
        .sort((a, b) => Number(attr(a, "priority") ?? 0) - Number(attr(b, "priority") ?? 0))
        .map((rule) => ({
          formula: text(first(rule, "formula")),
          dxf: Number(attr(rule, "dxfId") ?? 0),
        }));
      for (const range of ranges) {
        for (let r = range.r1; r <= range.r2; r++) {
          if (!keep(r)) continue;
          for (let c = range.c1; c <= range.c2; c++) {
            for (const rule of rules) {
              const v = engine.evalFormulaAt(
                rule.formula,
                evalSheet,
                anchor.r1,
                anchor.c1,
                r - anchor.r1,
                c - anchor.c1,
              );
              if (v === true || (typeof v === "number" && v !== 0)) {
                const k = key(r, c);
                cells[k] ??= { v: "" };
                cells[k]!.cf = rule.dxf;
                break;
              }
            }
          }
        }
      }
    }

    const merges = kids(doc, "mergeCell")
      .map((m) => attr(m, "ref") ?? "")
      .filter((ref) => {
        const range = parseRange(ref);
        return range && keep(range.r1) && keep(range.r2);
      });

    const links: PreviewSheet["links"] = {};
    for (const h of kids(doc, "hyperlink")) {
      const ref = attr(h, "ref") ?? "";
      const rid = attr(h, "r:id");
      links[ref] = {
        url: rid ? rels.get(rid)?.target : undefined,
        location: attr(h, "location") ?? undefined,
        tip: attr(h, "tooltip") ?? undefined,
      };
    }

    const validations: PreviewValidation[] = kids(doc, "dataValidation").map((dv) => {
      const f1 = text(first(dv, "formula1"));
      const type = attr(dv, "type") ?? "any";
      const v: PreviewValidation = { ref: attr(dv, "sqref") ?? "", type };
      if (type === "list" && /^".*"$/.test(f1)) v.list = f1.slice(1, -1).split(",");
      else if (f1) v.f1 = f1;
      const f2 = text(first(dv, "formula2"));
      if (f2) v.f2 = f2;
      if (attr(dv, "operator")) v.operator = attr(dv, "operator")!;
      if (attr(dv, "prompt")) v.prompt = attr(dv, "prompt")!;
      if (attr(dv, "promptTitle")) v.promptTitle = attr(dv, "promptTitle")!;
      if (attr(dv, "error")) v.error = attr(dv, "error")!;
      return v;
    });

    const sparklines: PreviewSparkline[] = [];
    for (const group of kids(doc, "x14:sparklineGroup")) {
      const g = {
        type: attr(group, "type") ?? "line",
        color: color(first(group, "x14:colorSeries")) ?? "#2563eb",
        markers:
          attr(group, "markers") === "1" ? color(first(group, "x14:colorMarkers")) : undefined,
        high: attr(group, "high") === "1" ? color(first(group, "x14:colorHigh")) : undefined,
        low: attr(group, "low") === "1" ? color(first(group, "x14:colorLow")) : undefined,
        first: attr(group, "first") === "1" ? color(first(group, "x14:colorFirst")) : undefined,
        last: attr(group, "last") === "1" ? color(first(group, "x14:colorLast")) : undefined,
        negative:
          attr(group, "negative") === "1" ? color(first(group, "x14:colorNegative")) : undefined,
        weight: attr(group, "lineWeight") ? Number(attr(group, "lineWeight")) : undefined,
      };
      for (const sp of kids(group, "x14:sparkline")) {
        const source = text(first(sp, "xm:f"));
        const target = text(first(sp, "xm:sqref"));
        const m = source.match(/^(?:'((?:[^']|'')+)'|([^!]+))!(.+)$/);
        const sheetName = m ? (m[1] ?? m[2] ?? "").replace(/''/g, "'") : def.name;
        const range = parseRange(m ? m[3]! : source);
        const sheet = engine.sheets.get(sheetName);
        const values: Array<number | null> = [];
        if (range && sheet) {
          for (let r = range.r1; r <= range.r2; r++)
            for (let c = range.c1; c <= range.c2; c++) {
              const v = engine.cellValue(sheet, r, c);
              values.push(typeof v === "number" ? v : null);
            }
        }
        const t = parseRef(target);
        if (t && keep(t.r)) sparklines.push({ cell: target, values, ...g });
      }
    }

    // images anchored through the drawing part
    const images: PreviewImage[] = [];
    const colLeft = (c0: number) => colWidths.slice(0, c0).reduce((a, b) => a + b, 0);
    const rowTop = (r0: number) => {
      let y = 0;
      for (let r = 1; r <= r0; r++) y += rowHeights[r] ?? defaultRowHeight;
      return y;
    };
    for (const d of kids(doc, "drawing")) {
      const part = rels.get(attr(d, "r:id") ?? "")?.target;
      const drawingXml = part ? files.get(part) : undefined;
      if (!part || !drawingXml) continue;
      const drawing = parse(drawingXml).documentElement as unknown as XmlElement;
      const drels = readRels(files, part);
      const anchors = [
        ...kids(drawing, "xdr:oneCellAnchor"),
        ...kids(drawing, "xdr:twoCellAnchor"),
        ...kids(drawing, "xdr:absoluteAnchor"),
      ];
      for (const a of anchors) {
        const blip = first(a, "a:blip");
        const media = drels.get(attr(blip, "r:embed") ?? "")?.target;
        const bytesOf = media ? binaries.get(media) : undefined;
        if (!bytesOf || !media) continue;
        const from = first(a, "xdr:from");
        const fc = Number(text(first(from, "xdr:col")));
        const fr = Number(text(first(from, "xdr:row")));
        if (!keep(fr + 1)) continue;
        const x = colLeft(fc) + Number(text(first(from, "xdr:colOff"))) / EMU_PER_PX;
        const y = rowTop(fr) + Number(text(first(from, "xdr:rowOff"))) / EMU_PER_PX;
        let w = 0;
        let h = 0;
        const ext = first(a, "xdr:ext");
        if (ext) {
          w = Number(attr(ext, "cx")) / EMU_PER_PX;
          h = Number(attr(ext, "cy")) / EMU_PER_PX;
        } else {
          const to = first(a, "xdr:to");
          w =
            colLeft(Number(text(first(to, "xdr:col")))) +
            Number(text(first(to, "xdr:colOff"))) / EMU_PER_PX -
            x;
          h =
            rowTop(Number(text(first(to, "xdr:row")))) +
            Number(text(first(to, "xdr:rowOff"))) / EMU_PER_PX -
            y;
        }
        const ext2 = media.split(".").pop()?.toLowerCase();
        const mime =
          ext2 === "jpg" || ext2 === "jpeg"
            ? "image/jpeg"
            : ext2 === "gif"
              ? "image/gif"
              : "image/png";
        images.push({
          x: Math.round(x),
          y: Math.round(y),
          w: Math.round(w),
          h: Math.round(h),
          src: `data:${mime};base64,${Buffer.from(bytesOf).toString("base64")}`,
          alt: attr(first(a, "xdr:cNvPr"), "descr") ?? "",
        });
      }
    }

    const sheet: PreviewSheet = {
      name: def.name,
      file: def.part.split("/").pop() ?? "",
      rows,
      cols,
      colWidths,
      rowHeights: Object.fromEntries(Object.entries(rowHeights).filter(([r]) => keep(Number(r)))),
      defaultRowHeight,
      merges,
      cells,
      links,
      validations,
      tables,
      sparklines,
      images,
      protected: !!first(doc, "sheetProtection"),
    };
    if (freeze && (freeze.rows || freeze.cols)) sheet.freeze = freeze;
    if (gap) sheet.gap = gap;
    return sheet;
  });

  return { sheets, styles, dxfs };
}

/** A small crop of one sheet for gallery thumbnails. */
export function buildPreviewThumb(
  model: PreviewWorkbook,
  sheetIndex = 0,
  maxRows = 10,
  maxCols = 7,
): PreviewWorkbook {
  const sheet = model.sheets[sheetIndex] ?? model.sheets[0]!;
  const cells: Record<string, PreviewCell> = {};
  for (const [k, cell] of Object.entries(sheet.cells)) {
    const ref = parseRef(k)!;
    if (ref.r <= maxRows && ref.c <= maxCols) cells[k] = cell;
  }
  const inBox = (ref: string) => {
    const r = parseRange(ref);
    return r && r.r1 <= maxRows && r.c1 <= maxCols;
  };
  return {
    fileSize: model.fileSize,
    styles: model.styles,
    dxfs: model.dxfs,
    sheets: [
      {
        ...sheet,
        rows: Math.min(sheet.rows, maxRows),
        cols: Math.min(sheet.cols, maxCols),
        colWidths: sheet.colWidths.slice(0, maxCols),
        cells,
        // clamp merges to the crop so centered titles stay inside the thumbnail
        merges: sheet.merges.filter(inBox).map((ref) => {
          const r = parseRange(ref)!;
          return `${indexToCol(r.c1)}${r.r1}:${indexToCol(Math.min(r.c2, maxCols))}${Math.min(r.r2, maxRows)}`;
        }),
        sparklines: sheet.sparklines.filter((s) => inBox(s.cell)),
        images: sheet.images.filter((img) => img.y < 400),
        links: Object.fromEntries(Object.entries(sheet.links).filter(([ref]) => inBox(ref))),
        validations: [],
        gap: undefined,
      },
    ],
  };
}
