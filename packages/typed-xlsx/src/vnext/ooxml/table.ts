import type { ResolvedExcelTableOptions } from "../workbook/types";
import { toCellRef } from "./cells";
import { xmlDocument, xmlElement, xmlSelfClosing } from "./xml";

function toExcelTotalsRowFunction(value: string) {
  switch (value) {
    case "countNums":
      return "countNums";
    case "stdDev":
      return "stdDev";
    default:
      return value;
  }
}

export interface WorksheetTablePart {
  id: string;
  relId: string;
  path: string;
  xml: string;
}

export function writeExcelTableXml(params: {
  tableId: number;
  displayName: string;
  reference: { startRow: number; endRow: number; startCol: number; endCol: number };
  columns: Array<{ id: string; headerLabel: string }>;
  options: ResolvedExcelTableOptions;
}) {
  const dataRef = `${toCellRef(params.reference.startRow, params.reference.startCol)}:${toCellRef(
    params.reference.endRow,
    params.reference.endCol,
  )}`;
  const tableRef = `${toCellRef(params.reference.startRow, params.reference.startCol)}:${toCellRef(
    params.options.totalsRow ? params.reference.endRow + 1 : params.reference.endRow,
    params.reference.endCol,
  )}`;

  return xmlDocument(
    "table",
    {
      xmlns: "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      id: params.tableId,
      name: params.displayName,
      displayName: params.displayName,
      ref: tableRef,
      totalsRowCount: params.options.totalsRow ? 1 : undefined,
      totalsRowShown: params.options.totalsRow ? undefined : 0,
      headerRowCount: 1,
    },
    [
      ...(params.options.autoFilter ? [xmlSelfClosing("autoFilter", { ref: dataRef })] : []),
      xmlElement(
        "tableColumns",
        { count: params.columns.length },
        params.columns.map((column, index) => {
          const totalsRow = params.options.totalsRowColumns[index]?.totalsRow;

          return xmlSelfClosing("tableColumn", {
            id: index + 1,
            name: column.headerLabel,
            ...(params.options.totalsRow && totalsRow && "label" in totalsRow
              ? { totalsRowLabel: totalsRow.label }
              : {}),
            ...(params.options.totalsRow && totalsRow && "function" in totalsRow
              ? { totalsRowFunction: toExcelTotalsRowFunction(totalsRow.function!) }
              : {}),
          });
        }),
      ),
      xmlSelfClosing("tableStyleInfo", {
        name: params.options.style,
        showFirstColumn: 0,
        showLastColumn: 0,
        showRowStripes: 1,
        showColumnStripes: 0,
      }),
    ],
  );
}

export function writeWorksheetTableParts(parts: WorksheetTablePart[]) {
  if (parts.length === 0) {
    return "";
  }

  return xmlElement(
    "tableParts",
    { count: parts.length },
    parts.map((part) => xmlSelfClosing("tablePart", { "r:id": part.relId })),
  );
}

export function writeWorksheetRelationshipsXml(parts: WorksheetTablePart[]) {
  return xmlDocument(
    "Relationships",
    {
      xmlns: "http://schemas.openxmlformats.org/package/2006/relationships",
    },
    parts.map((part) =>
      xmlSelfClosing("Relationship", {
        Id: part.relId,
        Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/table",
        Target: `../tables/${part.path.split("/").pop()}`,
      }),
    ),
  );
}
