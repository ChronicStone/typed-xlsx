import { toCellRef } from "../ooxml/cells";
import { xmlElement, xmlSelfClosing } from "../ooxml/xml";
import type {
  ResolvedSparklineDefinition,
  SparklineColorSet,
  SparklineDefaults,
  SparklineSource,
} from "./types";
import { normalizeSparklineDefaults, normalizeSparklineInput } from "./types";

const SPARKLINE_EXTENSION_URI = "{05C60535-1F16-4fd2-B633-F4F36F0B64E0}";
const SPARKLINE_X14_NAMESPACE = "http://schemas.microsoft.com/office/spreadsheetml/2009/9/main";
const SPARKLINE_XM_NAMESPACE = "http://schemas.microsoft.com/office/excel/2006/main";

export interface SparklineColumnLike {
  id: string;
  scopeIds: string[];
  sparkline?: ResolvedSparklineDefinition;
}

export interface WorksheetSparkline {
  dataRange: string;
  targetRef: string;
}

export interface WorksheetSparklineGroup {
  definition: ResolvedSparklineDefinition;
  colors: SparklineColorSet;
  sparklines: WorksheetSparkline[];
}

export function buildWorksheetSparklineGroups(params: {
  columns: SparklineColumnLike[];
  rowStart: number;
  rowEnd: number;
  columnOffset: number;
  sheetName: string;
  defaults?: SparklineDefaults;
}): WorksheetSparklineGroup[] {
  if (params.rowEnd < params.rowStart) {
    return [];
  }

  return params.columns.flatMap((column, columnIndex) => {
    if (!column.sparkline) {
      return [];
    }

    const sourceIndexes = resolveSparklineSourceIndexes(
      column.sparkline.source,
      params.columns,
      column.id,
    );
    if (sourceIndexes.includes(columnIndex)) {
      throw new Error(`Sparkline column '${column.id}' cannot use itself as a source.`);
    }

    assertContiguousSource(column.id, sourceIndexes);

    const sourceStartColumn = params.columnOffset + sourceIndexes[0]!;
    const sourceEndColumn = params.columnOffset + sourceIndexes[sourceIndexes.length - 1]!;
    const targetColumn = params.columnOffset + columnIndex;
    const definition = mergeSparklineDefaults(params.defaults, column.sparkline);

    return [
      {
        definition,
        colors: normalizeSparklineColors(definition.colors),
        sparklines: Array.from({ length: params.rowEnd - params.rowStart + 1 }, (_, rowOffset) => {
          const row = params.rowStart + rowOffset;
          return {
            dataRange: qualifySheetRange(
              params.sheetName,
              toCellRef(row, sourceStartColumn),
              toCellRef(row, sourceEndColumn),
            ),
            targetRef: toCellRef(row, targetColumn),
          };
        }),
      },
    ];
  });
}

export function writeWorksheetSparklines(groups: WorksheetSparklineGroup[]) {
  if (groups.length === 0) {
    return "";
  }

  return xmlElement(
    "extLst",
    undefined,
    xmlElement(
      "ext",
      { "xmlns:x14": SPARKLINE_X14_NAMESPACE, uri: SPARKLINE_EXTENSION_URI },
      xmlElement(
        "x14:sparklineGroups",
        { "xmlns:xm": SPARKLINE_XM_NAMESPACE },
        groups.map((group) =>
          xmlElement(
            "x14:sparklineGroup",
            {
              type: toSparklineOoxmlType(group.definition.type),
              displayEmptyCellsAs: group.definition.emptyCells ?? "gap",
              markers: group.definition.show?.markers ? 1 : undefined,
              first: group.definition.show?.first ? 1 : undefined,
              last: group.definition.show?.last ? 1 : undefined,
              high: group.definition.show?.high ? 1 : undefined,
              low: group.definition.show?.low ? 1 : undefined,
              negative: group.definition.show?.negative ? 1 : undefined,
              displayXAxis: group.definition.show?.axis ? 1 : undefined,
              displayHidden: group.definition.show?.hidden ? 1 : undefined,
              rightToLeft: group.definition.rightToLeft ? 1 : undefined,
              lineWeight: group.definition.lineWeight,
              minAxisType: group.definition.minAxisType,
              maxAxisType: group.definition.maxAxisType,
              manualMin: group.definition.manualMin,
              manualMax: group.definition.manualMax,
            },
            [
              writeSparklineColor("x14:colorSeries", group.colors.series),
              writeSparklineColor("x14:colorNegative", group.colors.negative),
              writeSparklineColor("x14:colorAxis", group.colors.axis),
              writeSparklineColor("x14:colorMarkers", group.colors.markers),
              writeSparklineColor("x14:colorFirst", group.colors.first),
              writeSparklineColor("x14:colorLast", group.colors.last),
              writeSparklineColor("x14:colorHigh", group.colors.high),
              writeSparklineColor("x14:colorLow", group.colors.low),
              xmlElement(
                "x14:sparklines",
                undefined,
                group.sparklines.map((sparkline) =>
                  xmlElement("x14:sparkline", undefined, [
                    xmlElement("xm:f", undefined, xmlText(sparkline.dataRange)),
                    xmlElement("xm:sqref", undefined, xmlText(sparkline.targetRef)),
                  ]),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

export function worksheetSparklineNamespaceAttributes(_hasSparklines: boolean) {
  return {};
}

function resolveSparklineSourceIndexes(
  source: SparklineSource<string, string, string>,
  columns: SparklineColumnLike[],
  targetColumnId: string,
) {
  if (Array.isArray(source)) {
    if (source.length === 0) {
      throw new Error(`Sparkline column '${targetColumnId}' requires at least one source column.`);
    }

    return source.map((columnId) => findSourceColumnIndex(columns, columnId, targetColumnId));
  }

  if ("from" in source) {
    const fromIndex = findSourceColumnIndex(columns, source.from, targetColumnId);
    const toIndex = findSourceColumnIndex(columns, source.to, targetColumnId);
    if (fromIndex > toIndex) {
      throw new Error(
        `Sparkline column '${targetColumnId}' source range must follow worksheet column order.`,
      );
    }

    return Array.from({ length: toIndex - fromIndex + 1 }, (_, index) => fromIndex + index);
  }

  const scopeId = "group" in source ? source.group : "dynamic" in source ? source.dynamic : "";
  if (!scopeId) {
    throw new Error(`Sparkline column '${targetColumnId}' has an unsupported source.`);
  }
  const indexes = columns.flatMap((column, index) =>
    column.scopeIds.includes(scopeId) ? [index] : [],
  );
  if (indexes.length === 0) {
    throw new Error(
      `Sparkline column '${targetColumnId}' source scope '${scopeId}' resolved to no visible columns.`,
    );
  }

  return indexes;
}

function findSourceColumnIndex(
  columns: SparklineColumnLike[],
  columnId: string,
  targetColumnId: string,
) {
  const columnIndex = columns.findIndex((column) => column.id === columnId);
  if (columnIndex < 0) {
    throw new Error(
      `Sparkline column '${targetColumnId}' references unknown or excluded source column '${columnId}'.`,
    );
  }

  return columnIndex;
}

function assertContiguousSource(targetColumnId: string, indexes: number[]) {
  const unique = new Set(indexes);
  if (unique.size !== indexes.length) {
    throw new Error(`Sparkline column '${targetColumnId}' source columns must be unique.`);
  }

  for (let index = 1; index < indexes.length; index += 1) {
    if (indexes[index] !== indexes[index - 1]! + 1) {
      throw new Error(
        `Sparkline column '${targetColumnId}' source columns must be contiguous after selection.`,
      );
    }
  }
}

function mergeSparklineDefaults(
  defaults: SparklineDefaults | undefined,
  definition: ResolvedSparklineDefinition,
): ResolvedSparklineDefinition {
  const normalizedDefaults = normalizeSparklineDefaults(defaults);
  const normalizedDefinition = normalizeSparklineInput(definition)!;

  return {
    ...normalizedDefaults,
    ...normalizedDefinition,
    source: normalizedDefinition.source,
    show: {
      ...(normalizedDefaults?.show ?? {}),
      ...(normalizedDefinition.show ?? {}),
    },
    colors: {
      ...(normalizedDefaults?.colors ?? {}),
      ...(normalizedDefinition.colors ?? {}),
    },
  };
}

function normalizeSparklineColors(colors?: SparklineColorSet): SparklineColorSet {
  return {
    series: normalizeRgb(colors?.series),
    markers: normalizeRgb(colors?.markers),
    first: normalizeRgb(colors?.first),
    last: normalizeRgb(colors?.last),
    high: normalizeRgb(colors?.high),
    low: normalizeRgb(colors?.low),
    negative: normalizeRgb(colors?.negative),
    axis: normalizeRgb(colors?.axis),
  };
}

function normalizeRgb(color: string | undefined) {
  if (!color) {
    return undefined;
  }

  const normalized = color.replace(/^#/, "").toUpperCase();
  if (/^[0-9A-F]{6}$/.test(normalized)) {
    return `FF${normalized}`;
  }
  if (/^[0-9A-F]{8}$/.test(normalized)) {
    return normalized;
  }

  return color;
}

function writeSparklineColor(name: string, color: string | undefined) {
  return color ? xmlSelfClosing(name, { rgb: color }) : "";
}

function xmlText(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function toSparklineOoxmlType(type: ResolvedSparklineDefinition["type"]) {
  return type === "winLoss" ? "stacked" : (type ?? "line");
}

function qualifySheetRange(sheetName: string, startRef: string, endRef: string) {
  const escapedSheetName = sheetName.replaceAll("'", "''");
  return `'${escapedSheetName}'!${startRef}:${endRef}`;
}
