/**
 * Reads a DrawingML chart part (`xl/charts/chartN.xml`) into the playground's chart model.
 * typed-xlsx writes a value cache next to every series reference, so the chart is drawn from
 * those caches without evaluating the referenced cells.
 */
import { DOMParser } from "@xmldom/xmldom";
import type { Element as XmlElement } from "@xmldom/xmldom";
import type {
  PreviewChart,
  PreviewChartKind,
  PreviewChartSeries,
} from "../src/_shared/preview-types";

const parser = new DOMParser();
const kids = (el: XmlElement | null | undefined, tag: string) =>
  el ? (Array.from(el.getElementsByTagName(tag)) as XmlElement[]) : [];
const first = (el: XmlElement | null | undefined, tag: string) => kids(el, tag)[0] ?? null;
const direct = (el: XmlElement | null | undefined, tag: string) =>
  el
    ? (Array.from(el.childNodes).filter(
        (n) => n.nodeType === 1 && (n as XmlElement).tagName === tag,
      ) as XmlElement[])
    : [];
const directFirst = (el: XmlElement | null | undefined, tag: string) => direct(el, tag)[0] ?? null;
const val = (el: XmlElement | null | undefined) => el?.getAttribute("val") ?? null;
const richText = (el: XmlElement | null | undefined) =>
  kids(el, "a:t")
    .map((t) => t.textContent ?? "")
    .join("");

const GROUPS: Record<string, PreviewChartKind> = {
  "c:barChart": "bar",
  "c:lineChart": "line",
  "c:areaChart": "area",
  "c:scatterChart": "scatter",
  "c:pieChart": "pie",
  "c:doughnutChart": "doughnut",
};

/** Cached points of a `c:cat` / `c:val` / `c:xVal` / `c:yVal` / `c:tx` node, in index order. */
function cached(node: XmlElement | null): string[] {
  if (!node) return [];
  const literal = directFirst(node, "c:v");
  if (literal) return [literal.textContent ?? ""];
  const cache = first(node, "c:strCache") ?? first(node, "c:numCache") ?? first(node, "c:lvl");
  if (!cache) return [];
  const count = Number(val(first(cache, "c:ptCount")) ?? 0);
  const out = Array.from({ length: count }, () => "");
  for (const pt of kids(cache, "c:pt")) {
    const idx = Number(pt.getAttribute("idx"));
    out[idx] = first(pt, "c:v")?.textContent ?? "";
  }
  return out;
}
const numbers = (raw: string[]) =>
  raw.map((v) => (v === "" || Number.isNaN(Number(v)) ? null : Number(v)));

function fillColor(spPr: XmlElement | null, line = false) {
  if (!spPr) return undefined;
  const host = line ? first(spPr, "a:ln") : spPr;
  const fill = line ? first(host, "a:solidFill") : directFirst(host, "a:solidFill");
  const rgb = val(first(fill, "a:srgbClr"));
  return rgb ? `#${rgb}` : undefined;
}

function axisInfo(ax: XmlElement | null) {
  if (!ax) return undefined;
  const fmt = first(ax, "c:numFmt")?.getAttribute("formatCode") ?? undefined;
  const scaling = first(ax, "c:scaling");
  const min = val(first(scaling, "c:min"));
  const max = val(first(scaling, "c:max"));
  const title = richText(directFirst(ax, "c:title")) || undefined;
  return {
    ...(title ? { title } : {}),
    ...(fmt && fmt !== "General" ? { fmt } : {}),
    ...(min != null ? { min: Number(min) } : {}),
    ...(max != null ? { max: Number(max) } : {}),
  };
}

/**
 * `resolve` reads a range the cache leaves blank: formula columns carry no cached value until
 * Excel calculates them, so the preview evaluates them instead.
 */
export function readChart(
  xml: string,
  box: { x: number; y: number; w: number; h: number },
  resolve?: (ref: string) => Array<number | null>,
): PreviewChart {
  const doc = parser.parseFromString(xml, "application/xml")
    .documentElement as unknown as XmlElement;
  const chart = first(doc, "c:chart");
  const plot = first(chart, "c:plotArea");
  const title = richText(directFirst(chart, "c:title")) || undefined;

  const axes = new Map<string, XmlElement>();
  for (const tag of ["c:catAx", "c:valAx", "c:dateAx"])
    for (const ax of direct(plot, tag)) axes.set(val(first(ax, "c:axId")) ?? "", ax);

  const series: PreviewChartSeries[] = [];
  const stack: PreviewChart["stack"] = {};
  let horizontal = false;
  let hole: number | undefined;
  let primaryIds: string[] | null = null;
  let y2Ids: string[] | null = null;

  for (const node of Array.from(plot?.childNodes ?? [])) {
    if (node.nodeType !== 1) continue;
    const group = node as XmlElement;
    const kind = GROUPS[group.tagName];
    if (!kind) continue;
    const grouping = val(directFirst(group, "c:grouping"));
    if (grouping === "stacked" || grouping === "percentStacked") stack[kind] = grouping;
    if (kind === "bar" && val(directFirst(group, "c:barDir")) === "bar") horizontal = true;
    if (kind === "doughnut") hole = Number(val(directFirst(group, "c:holeSize")) ?? 50);
    const ids = direct(group, "c:axId").map((a) => val(a) ?? "");
    let onY2 = false;
    if (ids.length) {
      if (!primaryIds) primaryIds = ids;
      else if (ids.join() !== primaryIds.join()) {
        onY2 = true;
        y2Ids = ids;
      }
    }
    const groupMarker = val(directFirst(group, "c:marker"));
    for (const ser of direct(group, "c:ser")) {
      const spPr = directFirst(ser, "c:spPr");
      const isLine = kind === "line" || kind === "scatter";
      const marker = directFirst(ser, "c:marker");
      const symbol = val(first(marker, "c:symbol"));
      const dLbls = directFirst(ser, "c:dLbls");
      const s: PreviewChartSeries = {
        name: cached(directFirst(ser, "c:tx"))[0] ?? "",
        kind,
        cats: cached(directFirst(ser, kind === "scatter" ? "c:xVal" : "c:cat")),
        vals: numbers(cached(directFirst(ser, kind === "scatter" ? "c:yVal" : "c:val"))),
      };
      const valNode = directFirst(ser, kind === "scatter" ? "c:yVal" : "c:val");
      const valRef = first(valNode, "c:f")?.textContent;
      if (resolve && valRef && s.vals.every((v) => v == null)) s.vals = resolve(valRef);
      const levels = kids(first(ser, "c:multiLvlStrCache"), "c:lvl");
      if (levels.length > 1) {
        s.groups = kids(levels[1], "c:pt").map((pt) => ({
          at: Number(pt.getAttribute("idx")),
          label: first(pt, "c:v")?.textContent ?? "",
        }));
      }
      if (kind === "scatter") {
        s.xs = numbers(s.cats);
        s.cats = [];
      }
      const color =
        fillColor(spPr, isLine) ??
        (kind === "scatter" ? fillColor(directFirst(marker, "c:spPr")) : undefined);
      if (color) s.color = color;
      if (onY2) s.y2 = 1;
      if (first(spPr, "a:prstDash")) s.dashed = 1;
      if (kind === "line" && symbol !== "none" && (symbol || groupMarker === "1")) s.markers = 1;
      if (kind === "scatter" && symbol !== "none") s.markers = 1;
      if (val(directFirst(ser, "c:smooth")) === "1") s.smooth = 1;
      const dPts = direct(ser, "c:dPt");
      if (dPts.length) {
        const points: Array<string | null> = [];
        for (const d of dPts)
          points[Number(val(first(d, "c:idx")))] = fillColor(first(d, "c:spPr")) ?? null;
        s.points = points;
      }
      if (dLbls) {
        if (val(first(dLbls, "c:showPercent")) === "1") s.labels = "percent";
        else if (val(first(dLbls, "c:showVal")) === "1") s.labels = "value";
        const lf = first(dLbls, "c:numFmt")?.getAttribute("formatCode");
        if (lf) s.labelFmt = lf;
      }
      series.push(s);
    }
  }

  const ids = primaryIds as string[] | null;
  const cat = ids?.map((id) => axes.get(id)).find((ax) => ax?.tagName !== "c:valAx" || false);
  const vals = ids?.map((id) => axes.get(id)).filter((ax) => ax?.tagName === "c:valAx") ?? [];
  // scatter: two value axes, the bottom one is x
  const xAx =
    cat ?? vals.find((ax) => ["b", "t"].includes(val(first(ax, "c:axPos")) ?? "")) ?? undefined;
  const yAx = vals.find((ax) => ax !== xAx);
  const y2Ax = (y2Ids as string[] | null)
    ?.map((id) => axes.get(id))
    .find((ax) => ax?.tagName === "c:valAx");
  const legendPos = val(first(first(chart, "c:legend"), "c:legendPos"));

  const out: PreviewChart = {
    ...box,
    series,
    axes: {
      ...(xAx ? { x: axisInfo(xAx) } : {}),
      ...(yAx ? { y: axisInfo(yAx) } : {}),
      ...(y2Ax ? { y2: axisInfo(y2Ax) } : {}),
    },
  };
  if (title) out.title = title;
  if (horizontal) out.horizontal = 1;
  if (Object.keys(stack).length) out.stack = stack;
  if (hole != null) out.hole = hole;
  if (legendPos) out.legend = legendPos as PreviewChart["legend"];
  if (first(doc, "c:pivotSource")) out.pivot = 1;
  return out;
}
