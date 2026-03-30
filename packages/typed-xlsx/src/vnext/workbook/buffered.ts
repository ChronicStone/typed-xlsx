import { planRows, resolveColumns } from "../planner/rows";
import { buildBufferedWorkbookXlsx } from "../ooxml/package";
import type {
  BufferedSheetPlan,
  BufferedTableInput,
  BufferedTablePlan,
  BufferedWorkbookPlan,
  SheetLayoutOptions,
  SheetViewOptions,
} from "./types";
import { applyColumnSelection } from "./internal/selection";
import { computeSummaries } from "./internal/summaries";

function planTable<T extends object>(
  table: BufferedTableInput<T>,
  fallbackIndex: number,
): BufferedTablePlan<T> {
  const resolvedColumns = applyColumnSelection(resolveColumns(table.schema), table.select);
  const planner = planRows({ columns: resolvedColumns }, table.rows);
  const summaries = computeSummaries(resolvedColumns, table.rows);

  return {
    id: table.id ?? `table-${fallbackIndex + 1}`,
    title: table.title,
    rowCount: table.rows.length,
    planner,
    summaries,
  };
}

class BufferedSheetBuilder {
  private readonly tables: BufferedTableInput<any>[] = [];
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

  table<T extends object>(input: BufferedTableInput<T>) {
    this.tables.push(input);
    return this;
  }

  build(): BufferedSheetPlan {
    return {
      name: this.name,
      layout: this.layout,
      view: this.view,
      tables: this.tables.map((table, index) => planTable(table, index)),
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
    return {
      sheets: this.sheets.map((sheet) => sheet.build()),
    };
  }

  buildXlsx() {
    return buildBufferedWorkbookXlsx(this.buildPlan());
  }
}
