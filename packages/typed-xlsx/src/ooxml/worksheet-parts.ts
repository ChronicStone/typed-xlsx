import { getDefaultRowHeight } from "../planner/metrics";
import type { WorksheetConditionalFormattingBlock } from "../styles/conditional-runtime";
import type { StylesCollector } from "../styles/collector";
import type { WorksheetDataValidation } from "../validation/runtime";
import type { FreezePane, SheetViewOptions } from "../workbook/types";
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
    children.push(writeFreezePane(view.freezePane));
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

function writeFreezePane(freezePane: FreezePane) {
  const topLeftCell = `${toWorksheetCol(freezePane.columns ?? 0)}${(freezePane.rows ?? 0) + 1}`;
  return xmlSelfClosing("pane", {
    xSplit: freezePane.columns || undefined,
    ySplit: freezePane.rows || undefined,
    topLeftCell,
    state: "frozen",
    activePane:
      (freezePane.rows ?? 0) > 0 && (freezePane.columns ?? 0) > 0
        ? "bottomRight"
        : (freezePane.columns ?? 0) > 0
          ? "topRight"
          : "bottomLeft",
  });
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
