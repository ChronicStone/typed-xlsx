import { planRows, resolveColumns } from "../planner/rows";
import { buildWorksheetConditionalFormatting } from "../styles/conditional-runtime";
import { buildBufferedWorkbookXlsx } from "../ooxml/package";
import type {
  BufferedExcelTablePart,
  BufferedSheetPlan,
  BufferedTableInput,
  BufferedTablePlan,
  BufferedWorkbookPlan,
  SheetLayoutOptions,
  SheetViewOptions,
} from "./types";
import { applyColumnSelection } from "./internal/selection";
import { computeSummaries } from "./internal/summaries";
import { resolveAutoFilter } from "./internal/auto-filter";
import { resolveExcelTableOptions } from "./internal/excel-table";

function isBufferedExcelTableInput<T extends object, TColumnId extends string>(
  table: BufferedTableInput<T, TColumnId>,
): table is import("./types").BufferedExcelTableInput<T, TColumnId> {
  return table.schema.kind === "excel-table";
}

function planTable<T extends object, TColumnId extends string>(
  id: string,
  table: BufferedTableInput<T, TColumnId>,
): BufferedTablePlan<T> {
  const context = "context" in table ? table.context : undefined;
  const resolvedColumns = applyColumnSelection(
    resolveColumns(table.schema, context, table.select),
    table.select,
  );
  const planner = planRows({ kind: table.schema.kind, columns: resolvedColumns }, table.rows);

  if (isBufferedExcelTableInput(table)) {
    const excelTable = resolveExcelTableOptions({
      autoFilter: table.autoFilter,
      columns: resolvedColumns,
      hasMerges: planner.merges.length > 0,
      id,
      name: table.name,
      style: table.style,
      totalsRow: table.totalsRow,
    });

    return {
      id,
      rowCount: table.rows.length,
      planner,
      summaries: [],
      conditionalFormatting: buildWorksheetConditionalFormatting({
        columns: resolvedColumns,
        rowStart: 1,
        rowEnd: planner.rows.length,
        columnOffset: 0,
        mode: table.schema.kind,
      }),
      autoFilter: false,
      excelTable,
    };
  }

  const reportTable = table;
  const summaries = computeSummaries(resolvedColumns, table.rows);

  return {
    id,
    title: reportTable.title,
    rowCount: table.rows.length,
    planner,
    summaries,
    conditionalFormatting: buildWorksheetConditionalFormatting({
      columns: resolvedColumns,
      rowStart: 1,
      rowEnd: planner.rows.length,
      columnOffset: 0,
      mode: table.schema.kind,
    }),
    autoFilter: resolveAutoFilter({
      autoFilter: reportTable.autoFilter,
      merges: planner.merges,
      tableId: id,
      mode: "buffered",
    }),
  };
}

class BufferedSheetBuilder {
  private readonly tables: Array<{ id: string; input: BufferedTableInput<any, string> }> = [];
  private layout: SheetLayoutOptions | undefined;
  private view: SheetViewOptions | undefined;

  constructor(private readonly name: string) {}

  options(options: SheetLayoutOptions & SheetViewOptions) {
    const { tablesPerRow, tableColumnGap, tableRowGap, ...view } = options;
    this.layout = {
      tablesPerRow,
      tableColumnGap,
      tableRowGap,
    };
    this.view = view;
    return this;
  }

  table<T extends object, TColumnId extends string>(
    id: string,
    input: BufferedTableInput<T, TColumnId>,
  ) {
    this.tables.push({ id, input });
    return this;
  }

  build(): BufferedSheetPlan {
    return {
      name: this.name,
      layout: this.layout,
      view: this.view,
      tables: this.tables.map((table) => planTable(table.id, table.input)),
    };
  }
}

export class BufferedWorkbookBuilder {
  private readonly sheets: BufferedSheetBuilder[] = [];

  static create() {
    return new BufferedWorkbookBuilder();
  }

  sheet(name: string) {
    const builder = new BufferedSheetBuilder(name);
    this.sheets.push(builder);
    return builder;
  }

  buildPlan(): BufferedWorkbookPlan {
    const sheets = this.sheets.map((sheet) => sheet.build());
    const excelTables: BufferedExcelTablePart[] = [];

    sheets.forEach((sheet, sheetIndex) => {
      sheet.tables.forEach((table) => {
        if (!table.excelTable) return;
        excelTables.push({
          sheetIndex,
          tableId: table.id,
          relId: `rIdTable${excelTables.length + 1}`,
          xml: "",
        });
      });
    });

    return {
      sheets,
      excelTables,
    };
  }

  buildXlsx() {
    return buildBufferedWorkbookXlsx(this.buildPlan());
  }
}
