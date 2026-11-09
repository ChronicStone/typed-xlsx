import type { PrimitiveCellValue } from "../schema/builder";
import type {
  ChartDataRef,
  ResolvedChart,
  ResolvedChartAnchor,
  ResolvedChartGroup,
  ResolvedChartSeries,
  ResolvedDataLabels,
} from "../chart/resolve";
import type { ChartCategoryAxisOptions, ChartValueAxisOptions } from "../chart/types";
import { xmlDocument, xmlElement, xmlEscape, xmlSelfClosing } from "./xml";

export const CHART_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.drawingml.chart+xml";
export const CHART_RELATIONSHIP =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart";
const CHART_NAMESPACE = "http://schemas.openxmlformats.org/drawingml/2006/chart";
const EMUS_PER_PIXEL = 9525;
const EMUS_PER_POINT = 12700;

const AXIS = {
  x: 500000001,
  y: 500000002,
  x2: 500000003,
  y2: 500000004,
} as const;

const LEGEND_POSITION = { top: "t", bottom: "b", left: "l", right: "r" } as const;

function val(name: string, value: string | number) {
  return xmlSelfClosing(name, { val: value });
}

function toExcelSerial(value: Date) {
  return (value.getTime() - Date.UTC(1899, 11, 30)) / 86_400_000;
}

// ── Data ─────────────────────────────────────────────────────────────────────

function points(
  values: readonly PrimitiveCellValue[],
  map: (value: PrimitiveCellValue) => string | undefined,
) {
  return values.flatMap((value, index) => {
    const text = map(value);
    return text === undefined
      ? []
      : [xmlElement("c:pt", { idx: index }, xmlElement("c:v", undefined, xmlEscape(text)))];
  });
}

function numberText(value: PrimitiveCellValue) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (value instanceof Date) return String(toExcelSerial(value));
  return undefined;
}

function plainText(value: PrimitiveCellValue) {
  if (value === null || value === undefined) return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function numberData(ref: ChartDataRef, formatCode = "General") {
  const cache = ref.values
    ? xmlElement("c:numCache", undefined, [
        xmlElement("c:formatCode", undefined, xmlEscape(formatCode)),
        val("c:ptCount", ref.count),
        ...points(ref.values, numberText),
      ])
    : "";
  if (!ref.formula) {
    return xmlElement("c:numLit", undefined, [
      xmlElement("c:formatCode", undefined, "General"),
      val("c:ptCount", 0),
    ]);
  }
  return xmlElement("c:numRef", undefined, [
    xmlElement("c:f", undefined, xmlEscape(ref.formula)),
    cache,
  ]);
}

function textData(ref: ChartDataRef) {
  if (!ref.formula) {
    return xmlElement("c:strLit", undefined, val("c:ptCount", 0));
  }
  const cache = ref.values
    ? xmlElement("c:strCache", undefined, [
        val("c:ptCount", ref.count),
        ...points(ref.values, plainText),
      ])
    : "";
  return xmlElement("c:strRef", undefined, [
    xmlElement("c:f", undefined, xmlEscape(ref.formula)),
    cache,
  ]);
}

function categoryData(ref: ChartDataRef) {
  const present = (ref.values ?? []).filter(
    (value) => value !== null && value !== undefined && value !== "",
  );
  if (present.length > 0 && present.every((value) => value instanceof Date)) {
    return numberData(ref, "yyyy-mm-dd");
  }
  if (present.length > 0 && present.every((value) => typeof value === "number")) {
    return numberData(ref);
  }
  return textData(ref);
}

function seriesName(series: ResolvedChartSeries) {
  const { name } = series;
  if (!name.formula) {
    return xmlElement("c:tx", undefined, xmlElement("c:v", undefined, xmlEscape(name.text)));
  }
  return xmlElement(
    "c:tx",
    undefined,
    xmlElement("c:strRef", undefined, [
      xmlElement("c:f", undefined, xmlEscape(name.formula)),
      xmlElement("c:strCache", undefined, [
        val("c:ptCount", 1),
        xmlElement("c:pt", { idx: 0 }, xmlElement("c:v", undefined, xmlEscape(name.text))),
      ]),
    ]),
  );
}

// ── Shapes and labels ────────────────────────────────────────────────────────

function solidFill(color: string) {
  return xmlElement("a:solidFill", undefined, xmlSelfClosing("a:srgbClr", { val: color }));
}

function fillShape(color: string | undefined) {
  return color ? xmlElement("c:spPr", undefined, solidFill(color)) : "";
}

function lineShape(series: ResolvedChartSeries, visible = true) {
  if (!visible) {
    return xmlElement(
      "c:spPr",
      undefined,
      xmlElement("a:ln", { w: 19050 }, xmlSelfClosing("a:noFill")),
    );
  }
  if (!series.color && !series.dashed && series.width === undefined) return "";
  return xmlElement(
    "c:spPr",
    undefined,
    xmlElement("a:ln", { w: Math.round((series.width ?? 2.25) * EMUS_PER_POINT), cap: "rnd" }, [
      series.color ? solidFill(series.color) : "",
      series.dashed ? val("a:prstDash", "dash") : "",
      xmlSelfClosing("a:round"),
    ]),
  );
}

function marker(series: ResolvedChartSeries, defaultVisible: boolean) {
  const visible = series.markers ?? defaultVisible;
  if (!visible) return xmlElement("c:marker", undefined, val("c:symbol", "none"));
  return xmlElement("c:marker", undefined, [
    val("c:symbol", "circle"),
    val("c:size", 5),
    series.color
      ? xmlElement("c:spPr", undefined, [
          solidFill(series.color),
          xmlElement("a:ln", undefined, solidFill(series.color)),
        ])
      : "",
  ]);
}

function dataLabels(labels: ResolvedDataLabels | undefined) {
  if (!labels) return "";
  return xmlElement("c:dLbls", undefined, [
    labels.format ? xmlSelfClosing("c:numFmt", { formatCode: labels.format, sourceLinked: 0 }) : "",
    val("c:showLegendKey", 0),
    val("c:showVal", labels.value ? 1 : 0),
    val("c:showCatName", labels.category ? 1 : 0),
    val("c:showSerName", labels.series ? 1 : 0),
    val("c:showPercent", labels.percent ? 1 : 0),
    val("c:showBubbleSize", 0),
  ]);
}

// ── Series and groups ────────────────────────────────────────────────────────

function writeSeries(group: ResolvedChartGroup, series: ResolvedChartSeries, index: number) {
  const head = [val("c:idx", index), val("c:order", index), seriesName(series)];
  const categories = xmlElement("c:cat", undefined, categoryData(series.categories));
  const values = xmlElement("c:val", undefined, numberData(series.values));

  switch (group.type) {
    case "bar":
      return xmlElement("c:ser", undefined, [
        ...head,
        fillShape(series.color),
        val("c:invertIfNegative", 0),
        dataLabels(series.labels),
        categories,
        values,
      ]);
    case "area":
      return xmlElement("c:ser", undefined, [
        ...head,
        fillShape(series.color),
        dataLabels(series.labels),
        categories,
        values,
      ]);
    case "line":
      return xmlElement("c:ser", undefined, [
        ...head,
        lineShape(series),
        marker(series, true),
        dataLabels(series.labels),
        categories,
        values,
        val("c:smooth", series.smooth ? 1 : 0),
      ]);
    case "scatter":
      return xmlElement("c:ser", undefined, [
        ...head,
        lineShape(series, series.lines ?? false),
        marker(series, true),
        dataLabels(series.labels),
        xmlElement("c:xVal", undefined, numberData(series.categories)),
        xmlElement("c:yVal", undefined, numberData(series.values)),
        val("c:smooth", series.smooth ? 1 : 0),
      ]);
    case "pie":
    case "doughnut":
      return xmlElement("c:ser", undefined, [
        ...head,
        ...(series.pointColors ?? [])
          .slice(0, series.values.count)
          .map((color, point) =>
            xmlElement("c:dPt", undefined, [
              val("c:idx", point),
              val("c:bubble3D", 0),
              xmlElement("c:spPr", undefined, solidFill(color)),
            ]),
          ),
        dataLabels(series.labels),
        categories,
        values,
      ]);
  }
}

function grouping(group: ResolvedChartGroup, fallback: string) {
  if (group.stack === "percent") return "percentStacked";
  if (group.stack === "stacked") return "stacked";
  return fallback;
}

function writeGroup(group: ResolvedChartGroup, firstIndex: number) {
  const series = group.series.map((entry, offset) =>
    writeSeries(group, entry, firstIndex + offset),
  );
  const axes =
    group.axis === "y2"
      ? [val("c:axId", AXIS.x2), val("c:axId", AXIS.y2)]
      : [val("c:axId", AXIS.x), val("c:axId", AXIS.y)];

  switch (group.type) {
    case "bar":
      return xmlElement("c:barChart", undefined, [
        val("c:barDir", group.horizontal ? "bar" : "col"),
        val("c:grouping", grouping(group, "clustered")),
        val("c:varyColors", 0),
        ...series,
        val("c:gapWidth", group.gap ?? 150),
        group.stack ? val("c:overlap", 100) : "",
        ...axes,
      ]);
    case "line":
      return xmlElement("c:lineChart", undefined, [
        val("c:grouping", grouping(group, "standard")),
        val("c:varyColors", 0),
        ...series,
        val("c:marker", 1),
        ...axes,
      ]);
    case "area":
      return xmlElement("c:areaChart", undefined, [
        val("c:grouping", grouping(group, "standard")),
        val("c:varyColors", 0),
        ...series,
        ...axes,
      ]);
    case "scatter":
      return xmlElement("c:scatterChart", undefined, [
        val("c:scatterStyle", "lineMarker"),
        val("c:varyColors", 0),
        ...series,
        ...axes,
      ]);
    case "pie":
      return xmlElement("c:pieChart", undefined, [
        val("c:varyColors", 1),
        ...series,
        val("c:firstSliceAng", 0),
      ]);
    case "doughnut":
      return xmlElement("c:doughnutChart", undefined, [
        val("c:varyColors", 1),
        ...series,
        val("c:firstSliceAng", 0),
        val("c:holeSize", group.hole ?? 55),
      ]);
  }
}

// ── Axes ─────────────────────────────────────────────────────────────────────

function richText(text: string, rotation?: number) {
  return xmlElement("c:rich", undefined, [
    xmlSelfClosing(
      "a:bodyPr",
      rotation === undefined ? undefined : { rot: rotation, vert: "horz" },
    ),
    xmlSelfClosing("a:lstStyle"),
    xmlElement(
      "a:p",
      undefined,
      xmlElement("a:r", undefined, xmlElement("a:t", undefined, xmlEscape(text))),
    ),
  ]);
}

function title(text: string, rotation?: number) {
  return xmlElement("c:title", undefined, [
    xmlElement("c:tx", undefined, richText(text, rotation)),
    val("c:overlay", 0),
  ]);
}

function scaling(options: ChartValueAxisOptions) {
  return xmlElement("c:scaling", undefined, [
    options.logBase !== undefined ? val("c:logBase", options.logBase) : "",
    val("c:orientation", options.reverse ? "maxMin" : "minMax"),
    options.max !== undefined ? val("c:max", options.max) : "",
    options.min !== undefined ? val("c:min", options.min) : "",
  ]);
}

function axisHead(params: {
  id: number;
  options: ChartValueAxisOptions;
  position: "b" | "l" | "r";
  deleted: boolean;
  gridlines: boolean;
}) {
  const { options } = params;
  return [
    val("c:axId", params.id),
    scaling(options),
    val("c:delete", params.deleted ? 1 : 0),
    val("c:axPos", params.position),
    params.gridlines ? xmlSelfClosing("c:majorGridlines") : "",
    options.title ? title(options.title, params.position === "b" ? undefined : -5400000) : "",
    xmlSelfClosing("c:numFmt", {
      formatCode: options.format ?? "General",
      sourceLinked: options.format ? 0 : 1,
    }),
    val("c:majorTickMark", "out"),
    val("c:minorTickMark", "none"),
    val("c:tickLblPos", "nextTo"),
  ];
}

function categoryAxis(params: {
  id: number;
  crossAxis: number;
  options: ChartCategoryAxisOptions;
  position: "b" | "l";
  deleted?: boolean;
}) {
  return xmlElement("c:catAx", undefined, [
    ...axisHead({
      id: params.id,
      options: params.options,
      position: params.position,
      deleted: params.deleted ?? params.options.hidden ?? false,
      gridlines: params.options.gridlines ?? false,
    }),
    val("c:crossAx", params.crossAxis),
    val("c:crosses", "autoZero"),
    val("c:auto", 1),
    val("c:lblAlgn", "ctr"),
    val("c:lblOffset", 100),
    val("c:noMultiLvlLbl", 0),
  ]);
}

function valueAxis(params: {
  id: number;
  crossAxis: number;
  options: ChartValueAxisOptions;
  position: "b" | "l" | "r";
  gridlines: boolean;
  crosses?: "autoZero" | "max";
  crossBetween?: "between" | "midCat";
}) {
  return xmlElement("c:valAx", undefined, [
    ...axisHead({
      id: params.id,
      options: params.options,
      position: params.position,
      deleted: params.options.hidden ?? false,
      gridlines: params.options.gridlines ?? params.gridlines,
    }),
    val("c:crossAx", params.crossAxis),
    val("c:crosses", params.crosses ?? "autoZero"),
    val("c:crossBetween", params.crossBetween ?? "between"),
    params.options.step !== undefined ? val("c:majorUnit", params.options.step) : "",
  ]);
}

function writeAxes(chart: ResolvedChart) {
  if (chart.kind === "pie") return [];
  const x = chart.axes.x ?? {};
  const y = chart.axes.y ?? {};

  if (chart.kind === "scatter") {
    return [
      valueAxis({
        id: AXIS.x,
        crossAxis: AXIS.y,
        options: x,
        position: "b",
        gridlines: false,
        crossBetween: "midCat",
      }),
      valueAxis({
        id: AXIS.y,
        crossAxis: AXIS.x,
        options: y,
        position: "l",
        gridlines: true,
        crossBetween: "midCat",
      }),
    ];
  }

  // Horizontal bars read top-down in table order, as people expect; Excel's default is bottom-up.
  const horizontal = chart.groups.some((group) => group.horizontal);
  const categoryOptions = horizontal ? { ...x, reverse: !x.reverse } : x;
  const axes = [
    categoryAxis({
      id: AXIS.x,
      crossAxis: AXIS.y,
      options: categoryOptions,
      position: horizontal ? "l" : "b",
    }),
    valueAxis({
      id: AXIS.y,
      crossAxis: AXIS.x,
      options: y,
      position: horizontal ? "b" : "l",
      gridlines: true,
      crosses: categoryOptions.reverse ? "max" : "autoZero",
    }),
  ];
  if (chart.groups.some((group) => group.axis === "y2")) {
    axes.push(
      categoryAxis({ id: AXIS.x2, crossAxis: AXIS.y2, options: {}, position: "b", deleted: true }),
      valueAxis({
        id: AXIS.y2,
        crossAxis: AXIS.x2,
        options: chart.axes.y2 ?? {},
        position: "r",
        gridlines: false,
        crosses: "max",
      }),
    );
  }
  return axes;
}

// ── Chart part ───────────────────────────────────────────────────────────────

export function writeChartXml(chart: ResolvedChart) {
  let index = 0;
  const groups = chart.groups.map((group) => {
    const xml = writeGroup(group, index);
    index += group.series.length;
    return xml;
  });

  return xmlDocument(
    "c:chartSpace",
    {
      "xmlns:c": CHART_NAMESPACE,
      "xmlns:a": "http://schemas.openxmlformats.org/drawingml/2006/main",
      "xmlns:r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    },
    [
      val("c:roundedCorners", 0),
      chart.pivotSource
        ? xmlElement("c:pivotSource", undefined, [
            xmlElement("c:name", undefined, xmlEscape(chart.pivotSource)),
            val("c:fmtId", 0),
          ])
        : "",
      xmlElement("c:chart", undefined, [
        chart.title ? title(chart.title) : "",
        val("c:autoTitleDeleted", chart.title ? 0 : 1),
        chart.pivotSource
          ? xmlElement(
              "c:pivotFmts",
              undefined,
              xmlElement("c:pivotFmt", undefined, val("c:idx", 0)),
            )
          : "",
        xmlElement("c:plotArea", undefined, [
          xmlSelfClosing("c:layout"),
          ...groups,
          ...writeAxes(chart),
        ]),
        chart.legend
          ? xmlElement("c:legend", undefined, [
              val("c:legendPos", LEGEND_POSITION[chart.legend]),
              val("c:overlay", 0),
            ])
          : "",
        val("c:plotVisOnly", 1),
        val("c:dispBlanksAs", "gap"),
      ]),
    ],
  );
}

/** Drawing anchor placing a chart at a cell, sized in pixels. */
export function writeChartAnchor(params: {
  id: number;
  name: string;
  relId: string;
  anchor: ResolvedChartAnchor;
}) {
  const cx = Math.round(params.anchor.width * EMUS_PER_PIXEL);
  const cy = Math.round(params.anchor.height * EMUS_PER_PIXEL);
  return xmlElement("xdr:oneCellAnchor", undefined, [
    xmlElement("xdr:from", undefined, [
      xmlElement("xdr:col", undefined, String(params.anchor.col)),
      xmlElement("xdr:colOff", undefined, "0"),
      xmlElement("xdr:row", undefined, String(params.anchor.row)),
      xmlElement("xdr:rowOff", undefined, "0"),
    ]),
    xmlSelfClosing("xdr:ext", { cx, cy }),
    xmlElement("xdr:graphicFrame", { macro: "" }, [
      xmlElement("xdr:nvGraphicFramePr", undefined, [
        xmlSelfClosing("xdr:cNvPr", { id: params.id, name: params.name }),
        xmlSelfClosing("xdr:cNvGraphicFramePr"),
      ]),
      xmlElement("xdr:xfrm", undefined, [
        xmlSelfClosing("a:off", { x: 0, y: 0 }),
        xmlSelfClosing("a:ext", { cx, cy }),
      ]),
      xmlElement(
        "a:graphic",
        undefined,
        xmlElement(
          "a:graphicData",
          { uri: CHART_NAMESPACE },
          xmlSelfClosing("c:chart", { "xmlns:c": CHART_NAMESPACE, "r:id": params.relId }),
        ),
      ),
    ]),
    xmlSelfClosing("xdr:clientData"),
  ]);
}
