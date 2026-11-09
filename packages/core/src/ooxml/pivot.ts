import type { PrimitiveCellValue } from "../schema/builder";
import { PIVOT_DATE_GROUP_BY, pivotDateGroupItems } from "../pivot/dates";
import type { PivotAccumulator, PivotFieldDefinition, PivotLayout } from "../pivot/engine";
import type { PivotDateUnit, PivotShowAs } from "../pivot/types";
import { toCellRef } from "./cells";
import { xmlDocument, xmlElement, xmlEscape, xmlSelfClosing } from "./xml";

export const PIVOT_TABLE_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotTable+xml";
export const PIVOT_CACHE_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotCacheDefinition+xml";
export const PIVOT_TABLE_RELATIONSHIP =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/pivotTable";
export const PIVOT_CACHE_RELATIONSHIP =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/pivotCacheDefinition";

const MAIN_NAMESPACE = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const RELATIONSHIP_NAMESPACE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

export type PivotCacheSource = { sheet: string; ref: string } | { tableName: string };

const SHOW_DATA_AS: Record<PivotShowAs, string> = {
  percentOfTotal: "percentOfTotal",
  percentOfRow: "percentOfRow",
  percentOfColumn: "percentOfCol",
};

/** Placeholder range for a grouped date column without rows, so the group stays well formed. */
const EMPTY_DATE_RANGE = { min: Date.UTC(2000, 0, 1), max: Date.UTC(2000, 0, 1) };

function dateRangeOf(accumulator: PivotAccumulator, source: number) {
  return accumulator.dateRanges.get(source) ?? EMPTY_DATE_RANGE;
}

interface CacheFieldGroup {
  index: number;
  name: string;
  unit: PivotDateUnit;
  source: number;
  /** Next larger level, such as the years above quarters. */
  parent?: number;
}

/** Every grouped cache field: the source columns grouped by their finest unit, and the levels above them. */
function cacheFieldGroups(accumulator: PivotAccumulator) {
  return accumulator.definition.dateGroups.flatMap((group) =>
    group.levels.map((level, position): CacheFieldGroup => ({
      ...level,
      source: group.source,
      ...(position > 0 ? { parent: group.levels[position - 1]!.index } : {}),
    })),
  );
}

function writeFieldGroup(accumulator: PivotAccumulator, group: CacheFieldGroup) {
  const items = pivotDateGroupItems(group.unit, dateRangeOf(accumulator, group.source));
  return xmlElement("fieldGroup", { par: group.parent, base: group.source }, [
    xmlSelfClosing("rangePr", {
      groupBy: PIVOT_DATE_GROUP_BY[group.unit],
      startDate: isoDate(items.start),
      endDate: isoDate(items.end),
    }),
    xmlElement(
      "groupItems",
      { count: items.labels.length },
      items.labels.map((label) => xmlSelfClosing("s", { v: label })),
    ),
  ]);
}

/** Shared items of a grouped date column: only its range, since its items are the groups. */
function writeDateSharedItems(range: { min: number; max: number }) {
  return xmlSelfClosing("sharedItems", {
    containsSemiMixedTypes: 0,
    containsNonDate: 0,
    containsDate: 1,
    containsString: 0,
    minDate: isoDate(new Date(range.min)),
    maxDate: isoDate(new Date(range.max)),
  });
}

function isBlank(value: PrimitiveCellValue) {
  return value === null || value === undefined || value === "";
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 19);
}

/** Field names as Excel derives them from the header row: blanks rejected, duplicates numbered. */
export function pivotCacheFieldNames(headers: readonly string[], pivotId: string) {
  const seen = new Map<string, number>();
  return headers.map((header) => {
    const name = header.trim();
    if (!name) {
      throw new Error(`Pivot "${pivotId}": every source column needs a header.`);
    }
    const key = name.toLocaleLowerCase();
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    return count === 1 ? name : `${name}${count}`;
  });
}

function writeSharedItems(values: readonly PrimitiveCellValue[]) {
  const present = values.filter((value) => !isBlank(value));
  const strings = present.some((value) => typeof value === "string");
  const numbers = present.filter((value): value is number => typeof value === "number");
  const dates = present.filter((value): value is Date => value instanceof Date);
  const booleans = present.some((value) => typeof value === "boolean");
  const blanks = present.length !== values.length;
  const kinds = [strings, numbers.length > 0, dates.length > 0, booleans].filter(Boolean).length;

  const attributes: Record<string, string | number | undefined> = {};
  if (!strings) {
    attributes.containsSemiMixedTypes = blanks ? undefined : 0;
    attributes.containsString = 0;
  }
  if (kinds > 1) attributes.containsMixedTypes = 1;
  if (numbers.length > 0) {
    attributes.containsNumber = 1;
    if (numbers.every((value) => Number.isInteger(value))) attributes.containsInteger = 1;
    attributes.minValue = Math.min(...numbers);
    attributes.maxValue = Math.max(...numbers);
  }
  if (dates.length > 0) {
    attributes.containsNonDate = kinds > 1 || blanks ? undefined : 0;
    attributes.containsDate = 1;
    const times = dates.map((value) => value.getTime());
    attributes.minDate = isoDate(new Date(Math.min(...times)));
    attributes.maxDate = isoDate(new Date(Math.max(...times)));
  }
  if (blanks) attributes.containsBlank = 1;
  attributes.count = values.length;

  const items = values.map((value) => {
    if (isBlank(value)) return xmlSelfClosing("m");
    if (value instanceof Date) return xmlSelfClosing("d", { v: isoDate(value) });
    if (typeof value === "number") return xmlSelfClosing("n", { v: value });
    if (typeof value === "boolean") return xmlSelfClosing("b", { v: value ? 1 : 0 });
    return xmlSelfClosing("s", { v: String(value) });
  });
  return xmlElement("sharedItems", attributes, items);
}

/**
 * Pivot cache that Excel refreshes on open. Source rows are not copied: only the distinct items
 * of row, column and filter fields, which the pivot table needs to describe its layout.
 */
export function writePivotCacheDefinitionXml(params: {
  accumulator: PivotAccumulator;
  fieldNames: readonly string[];
  source: PivotCacheSource;
}) {
  const { accumulator, fieldNames, source } = params;
  const groups = cacheFieldGroups(accumulator);
  const groupOf = new Map(groups.map((group) => [group.index, group]));
  const addedFields = groups.filter((group) => group.index >= fieldNames.length);
  const worksheetSource =
    "tableName" in source
      ? xmlSelfClosing("worksheetSource", { name: source.tableName })
      : xmlSelfClosing("worksheetSource", { ref: source.ref, sheet: source.sheet });

  return xmlDocument(
    "pivotCacheDefinition",
    {
      xmlns: MAIN_NAMESPACE,
      "xmlns:r": RELATIONSHIP_NAMESPACE,
      refreshOnLoad: 1,
      saveData: 0,
      createdVersion: 6,
      refreshedVersion: 6,
      minRefreshableVersion: 3,
      recordCount: accumulator.recordCount,
    },
    [
      xmlElement("cacheSource", { type: "worksheet" }, worksheetSource),
      xmlElement("cacheFields", { count: fieldNames.length + addedFields.length }, [
        ...fieldNames.map((name, index) => {
          const group = groupOf.get(index);
          if (group) {
            return xmlElement("cacheField", { name, numFmtId: 0 }, [
              writeDateSharedItems(dateRangeOf(accumulator, index)),
              writeFieldGroup(accumulator, group),
            ]);
          }
          const items = accumulator.items.get(index);
          return xmlElement(
            "cacheField",
            { name, numFmtId: 0 },
            items ? writeSharedItems(items.values) : xmlSelfClosing("sharedItems"),
          );
        }),
        // Date levels above a grouped column are fields of their own, with no column behind them.
        ...addedFields.map((group) =>
          xmlElement(
            "cacheField",
            { name: group.name, numFmtId: 0, databaseField: 0 },
            writeFieldGroup(accumulator, group),
          ),
        ),
      ]),
    ],
  );
}

/** Pivot table definition. Row and column items are left for Excel to rebuild on refresh. */
export function writePivotTableXml(params: {
  name: string;
  cacheId: number;
  accumulator: PivotAccumulator;
  layout: PivotLayout;
  fieldCount: number;
  /** Absolute top-left cell of the pivot, filters included. */
  anchor: { row: number; col: number };
  valueNames: readonly string[];
  valueNumFmtIds: readonly (number | undefined)[];
}) {
  const { accumulator, layout, anchor } = params;
  const definition = accumulator.definition;
  const { rows, column, filters, values } = definition;
  const axisOf = new Map<number, string>();
  rows.forEach((field) => axisOf.set(field.index, "axisRow"));
  if (column) axisOf.set(column.index, "axisCol");
  filters.forEach((field) => axisOf.set(field.index, "axisPage"));
  const dataIndexes = new Set(values.map((value) => value.index));
  const groupedFields = new Map<number, PivotFieldDefinition>();
  for (const field of [...rows, ...(column ? [column] : []), ...filters]) {
    if (field.group) groupedFields.set(field.index, field);
  }

  /**
   * Item positions in the cache. Grouped dates point at their group items, all of them in calendar
   * order: groups without rows, such as the range bounds, stay hidden.
   */
  const itemPositions = (field: PivotFieldDefinition | undefined, order: number[]) => {
    if (!field?.group) return order;
    const { labels } = pivotDateGroupItems(
      field.group,
      dateRangeOf(accumulator, field.source ?? field.index),
    );
    const positions = labels.map((_, position) => position);
    return definition.sort === "descending" ? positions.reverse() : positions;
  };

  const pivotFields = Array.from({ length: params.fieldCount }, (_, index) => {
    const axis = axisOf.get(index);
    // Items are listed in display order rather than sorted by Excel: Excel sorts names such as
    // months with its own lists, which would not match the cells written before it refreshes.
    const attributes = {
      axis,
      dataField: dataIndexes.has(index) ? 1 : undefined,
      showAll: 0,
    };
    if (!axis) return xmlSelfClosing("pivotField", attributes);
    const order = itemPositions(groupedFields.get(index), layout.order.get(index)!);
    return xmlElement(
      "pivotField",
      attributes,
      xmlElement("items", { count: order.length + 1 }, [
        ...order.map((item) => xmlSelfClosing("item", { x: item })),
        xmlSelfClosing("item", { t: "default" }),
      ]),
    );
  });

  const columnFields = [...(column ? [column.index] : []), ...(values.length > 1 ? [-2] : [])];
  const firstRow = anchor.row + layout.table.firstRow;
  const location = `${toCellRef(firstRow, anchor.col)}:${toCellRef(
    anchor.row + layout.table.lastRow,
    anchor.col + layout.table.lastCol,
  )}`;

  return xmlDocument(
    "pivotTableDefinition",
    {
      xmlns: MAIN_NAMESPACE,
      name: params.name,
      cacheId: params.cacheId,
      applyNumberFormats: 0,
      applyBorderFormats: 0,
      applyFontFormats: 0,
      applyPatternFormats: 0,
      applyAlignmentFormats: 0,
      applyWidthHeightFormats: 1,
      dataCaption: "Values",
      grandTotalCaption: definition.grandTotalLabel,
      rowGrandTotals: definition.columnTotals ? undefined : 0,
      colGrandTotals: definition.rowTotals ? undefined : 0,
      updatedVersion: 6,
      minRefreshableVersion: 3,
      useAutoFormatting: 1,
      itemPrintTitles: 1,
      createdVersion: 6,
      outline: 1,
      outlineData: 1,
      multipleFieldFilters: 0,
      rowHeaderCaption: rows.map((field) => field.header).join(" / "),
      colHeaderCaption: column?.header,
    },
    [
      xmlSelfClosing("location", {
        ref: location,
        firstHeaderRow: layout.firstHeaderRow,
        firstDataRow: layout.firstDataRow,
        firstDataCol: layout.firstDataCol,
        rowPageCount: filters.length > 0 ? filters.length : undefined,
        colPageCount: filters.length > 0 ? 1 : undefined,
      }),
      xmlElement("pivotFields", { count: params.fieldCount }, pivotFields),
      xmlElement(
        "rowFields",
        { count: rows.length },
        rows.map((field) => xmlSelfClosing("field", { x: field.index })),
      ),
      columnFields.length > 0
        ? xmlElement(
            "colFields",
            { count: columnFields.length },
            columnFields.map((index) => xmlSelfClosing("field", { x: index })),
          )
        : "",
      filters.length > 0
        ? xmlElement(
            "pageFields",
            { count: filters.length },
            filters.map((field) => xmlSelfClosing("pageField", { fld: field.index, hier: -1 })),
          )
        : "",
      xmlElement(
        "dataFields",
        { count: values.length },
        values.map((value, index) =>
          xmlSelfClosing("dataField", {
            name: params.valueNames[index],
            fld: value.index,
            subtotal: value.aggregate === "sum" ? undefined : value.aggregate,
            showDataAs: value.show ? SHOW_DATA_AS[value.show] : undefined,
            baseField: 0,
            baseItem: 0,
            numFmtId: params.valueNumFmtIds[index],
          }),
        ),
      ),
      xmlSelfClosing("pivotTableStyleInfo", {
        name: definition.style,
        showRowHeaders: 1,
        showColHeaders: 1,
        showRowStripes: 0,
        showColStripes: 0,
        showLastColumn: 1,
      }),
    ],
  );
}

export function writePivotTableRelationshipsXml(cacheIndex: number) {
  return xmlDocument(
    "Relationships",
    { xmlns: "http://schemas.openxmlformats.org/package/2006/relationships" },
    xmlSelfClosing("Relationship", {
      Id: "rId1",
      Type: PIVOT_CACHE_RELATIONSHIP,
      Target: `../pivotCache/pivotCacheDefinition${cacheIndex}.xml`,
    }),
  );
}

export function writeWorkbookPivotCachesXml(count: number) {
  if (count === 0) return "";
  return xmlElement(
    "pivotCaches",
    undefined,
    Array.from({ length: count }, (_, index) =>
      xmlSelfClosing("pivotCache", { cacheId: index + 1, "r:id": `rIdPivotCache${index + 1}` }),
    ),
  );
}

function toExcelSerial(value: Date) {
  return (value.getTime() - Date.UTC(1899, 11, 30)) / 86_400_000;
}

/** Pivot cell written before Excel refreshes the pivot. Text is inline, so it works in streams too. */
export function serializePivotCell(
  row: number,
  col: number,
  value: PrimitiveCellValue,
  styleIndex?: number,
) {
  const ref = toCellRef(row, col);
  const style = styleIndex ? { s: styleIndex } : {};
  if (value === null || value === undefined) {
    return styleIndex ? xmlSelfClosing("c", { r: ref, ...style }) : "";
  }
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? xmlElement("c", { r: ref, ...style }, xmlElement("v", undefined, String(value)))
      : "";
  }
  if (typeof value === "boolean") {
    return xmlElement(
      "c",
      { r: ref, t: "b", ...style },
      xmlElement("v", undefined, value ? "1" : "0"),
    );
  }
  if (value instanceof Date) {
    return xmlElement(
      "c",
      { r: ref, ...style },
      xmlElement("v", undefined, String(toExcelSerial(value))),
    );
  }
  return xmlElement(
    "c",
    { r: ref, t: "inlineStr", ...style },
    xmlElement("is", undefined, xmlElement("t", undefined, xmlEscape(value))),
  );
}
