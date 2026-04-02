import { getDefaultRowHeight } from "../planner/metrics";
import type { WorksheetConditionalFormattingBlock } from "../styles/conditional-runtime";
import type { StylesCollector } from "../styles/collector";
import type { WorksheetDataValidation } from "../validation/runtime";
import type {
  FreezePane,
  ResolvedSheetProtectionOptions,
  SheetViewOptions,
} from "../workbook/types";
import type { WorksheetHyperlink } from "../workbook/types";
import { hashExcelProtectionPassword } from "./protection";
import { toCellRef } from "./cells";
import { xmlElement, xmlEscape, xmlSelfClosing } from "./xml";

export interface WorksheetColumnDefinition {
  index: number;
  width: number;
}

export interface WorksheetMergeRange {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

export interface WorksheetAutoFilterRange {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

export function writeWorksheetViews(view?: SheetViewOptions) {
  const attributes: Record<string, number> = {
    workbookViewId: 0,
  };

  if (view?.rightToLeft) {
    attributes.rightToLeft = 1;
  }

  const children: string[] = [];

  if (view?.freezePane) {
    children.push(...writeFreezePane(view.freezePane));
  }

  return xmlElement(
    "sheetViews",
    undefined,
    children.length > 0
      ? xmlElement("sheetView", attributes, children)
      : xmlSelfClosing("sheetView", attributes),
  );
}

export function createWorksheetRowNode(rowIndex: number, cells: string[], rowHeight?: number) {
  const defaultRowHeight = getDefaultRowHeight();
  const resolvedRowHeight = rowHeight ?? defaultRowHeight;

  return xmlElement(
    "row",
    {
      r: rowIndex + 1,
      ht: resolvedRowHeight,
      customHeight: 1,
    },
    cells,
  );
}

export function writeWorksheetColumns(columns: WorksheetColumnDefinition[]) {
  if (columns.length === 0) return "";

  return xmlElement(
    "cols",
    undefined,
    columns.map((column) =>
      xmlSelfClosing("col", {
        min: column.index + 1,
        max: column.index + 1,
        width: Math.max(column.width + 5, 1),
        customWidth: 1,
      }),
    ),
  );
}

export function writeWorksheetMerges(merges: WorksheetMergeRange[]) {
  if (merges.length === 0) return "";

  return xmlElement(
    "mergeCells",
    { count: merges.length },
    merges.map((merge) =>
      xmlSelfClosing("mergeCell", {
        ref: `${toCellRef(merge.startRow, merge.startCol)}:${toCellRef(merge.endRow, merge.endCol)}`,
      }),
    ),
  );
}

export function writeWorksheetAutoFilter(range?: WorksheetAutoFilterRange) {
  if (!range) return "";

  return xmlSelfClosing("autoFilter", {
    ref: `${toCellRef(range.startRow, range.startCol)}:${toCellRef(range.endRow, range.endCol)}`,
  });
}

export function writeWorksheetConditionalFormatting(
  blocks: WorksheetConditionalFormattingBlock[],
  styles: StylesCollector,
) {
  if (blocks.length === 0) return "";

  let priority = 1;

  return blocks
    .map((block) =>
      xmlElement(
        "conditionalFormatting",
        { sqref: block.ref },
        block.rules.map((rule) => {
          const dxfId = styles.addDifferentialStyle(rule.style);

          return xmlElement(
            "cfRule",
            {
              type: "expression",
              dxfId,
              priority: priority++,
            },
            xmlElement("formula", undefined, xmlEscape(rule.formula)),
          );
        }),
      ),
    )
    .join("");
}

export function writeWorksheetDataValidations(validations: WorksheetDataValidation[]) {
  if (validations.length === 0) return "";

  return xmlElement(
    "dataValidations",
    { count: validations.length },
    validations.map((validation) =>
      xmlElement(
        "dataValidation",
        {
          sqref: validation.ref,
          type: validation.type,
          operator: validation.operator,
          allowBlank: validation.allowBlank ? 1 : undefined,
          showDropDown:
            validation.showDropDown === undefined ? undefined : validation.showDropDown ? 0 : 1,
          showInputMessage: validation.prompt ? 1 : undefined,
          promptTitle: validation.prompt?.title,
          prompt: validation.prompt?.message,
          showErrorMessage: 1,
          errorTitle: validation.error?.title,
          error: validation.error?.message,
          errorStyle: "stop",
        },
        [
          validation.formula1
            ? xmlElement("formula1", undefined, xmlEscape(validation.formula1))
            : "",
          validation.formula2
            ? xmlElement("formula2", undefined, xmlEscape(validation.formula2))
            : "",
        ],
      ),
    ),
  );
}

export function writeWorksheetProtection(protection?: ResolvedSheetProtectionOptions) {
  if (!protection) return "";

  return xmlSelfClosing("sheetProtection", {
    sheet: protection.sheet ? 1 : undefined,
    password: protection.password ? hashExcelProtectionPassword(protection.password) : undefined,
    objects: protection.objects ? 1 : undefined,
    scenarios: protection.scenarios ? 1 : undefined,
    formatCells: protection.formatCells ? 1 : undefined,
    formatColumns: protection.formatColumns ? 1 : undefined,
    formatRows: protection.formatRows ? 1 : undefined,
    insertColumns: protection.insertColumns ? 1 : undefined,
    insertRows: protection.insertRows ? 1 : undefined,
    insertHyperlinks: protection.insertHyperlinks ? 1 : undefined,
    deleteColumns: protection.deleteColumns ? 1 : undefined,
    deleteRows: protection.deleteRows ? 1 : undefined,
    selectLockedCells: protection.selectLockedCells ? 1 : undefined,
    sort: protection.sort ? 1 : undefined,
    autoFilter: protection.autoFilter ? 1 : undefined,
    pivotTables: protection.pivotTables ? 1 : undefined,
    selectUnlockedCells: protection.selectUnlockedCells ? 1 : undefined,
  });
}

export function writeWorksheetHyperlinks(
  hyperlinks: Array<WorksheetHyperlink & { relId?: string }>,
) {
  if (hyperlinks.length === 0) return "";

  return xmlElement(
    "hyperlinks",
    undefined,
    hyperlinks.map((hyperlink) =>
      xmlSelfClosing("hyperlink", {
        ref: hyperlink.ref,
        location: hyperlink.target.startsWith("#") ? hyperlink.target.slice(1) : undefined,
        tooltip: hyperlink.tooltip,
        display: undefined,
        "r:id": hyperlink.relId,
      }),
    ),
  );
}

export function partitionWorksheetHyperlinks(hyperlinks: WorksheetHyperlink[]) {
  const externals: Array<WorksheetHyperlink & { relId: string }> = [];
  const internals: Array<WorksheetHyperlink & { relId?: string }> = [];
  let relIndex = 0;

  for (const hyperlink of hyperlinks) {
    if (hyperlink.target.startsWith("#")) {
      internals.push(hyperlink);
      continue;
    }

    relIndex += 1;
    externals.push({ ...hyperlink, relId: `rIdHyperlink${relIndex}` });
  }

  return {
    worksheetHyperlinks: [...internals, ...externals],
    externalRelationships: externals,
  };
}

function writeFreezePane(freezePane: FreezePane) {
  const rows = freezePane.rows ?? 0;
  const columns = freezePane.columns ?? 0;
  const topLeftCell = `${toWorksheetCol(freezePane.columns ?? 0)}${(freezePane.rows ?? 0) + 1}`;
  const activePane =
    rows > 0 && columns > 0 ? "bottomRight" : columns > 0 ? "topRight" : "bottomLeft";

  const children = [
    xmlSelfClosing("pane", {
      xSplit: columns || undefined,
      ySplit: rows || undefined,
      topLeftCell,
      state: "frozen",
      activePane,
    }),
  ];

  if (rows > 0 && columns > 0) {
    children.push(
      xmlSelfClosing("selection", { pane: "topRight" }),
      xmlSelfClosing("selection", { pane: "bottomLeft" }),
      xmlSelfClosing("selection", {
        pane: "bottomRight",
        activeCell: topLeftCell,
        sqref: topLeftCell,
      }),
    );
    return children;
  }

  children.push(
    xmlSelfClosing("selection", {
      pane: activePane,
      activeCell: topLeftCell,
      sqref: topLeftCell,
    }),
  );

  return children;
}

function toWorksheetCol(column: number) {
  if (column <= 0) return "A";

  let result = "";
  let current = column;

  do {
    result = String.fromCharCode(65 + (current % 26)) + result;
    current = Math.floor(current / 26) - 1;
  } while (current >= 0);

  return result;
}
