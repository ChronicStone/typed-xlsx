import type {
  ExcelTableTotalsRowDefinition,
  ExcelTableSchemaDefinition,
  ReportSchemaDefinition,
  SchemaContext,
  SchemaDefinition,
} from "../schema/builder";
import type { PlannerResult } from "../planner/rows";
import type { SummaryResolvedValue } from "../summary/runtime";
import type { WorksheetConditionalFormattingBlock } from "../styles/conditional-runtime";
import type { CellStyle } from "../styles/types";

export interface TableSelection<TColumnId extends string = string> {
  include?: readonly TColumnId[];
  exclude?: readonly TColumnId[];
}

export interface TableAutoFilterOptions {
  enabled?: boolean;
}

export type ExcelTableStyle =
  | "TableStyleLight1"
  | "TableStyleLight2"
  | "TableStyleLight3"
  | "TableStyleLight4"
  | "TableStyleLight5"
  | "TableStyleLight6"
  | "TableStyleLight7"
  | "TableStyleLight8"
  | "TableStyleLight9"
  | "TableStyleLight10"
  | "TableStyleLight11"
  | "TableStyleLight12"
  | "TableStyleLight13"
  | "TableStyleLight14"
  | "TableStyleLight15"
  | "TableStyleLight16"
  | "TableStyleLight17"
  | "TableStyleLight18"
  | "TableStyleLight19"
  | "TableStyleLight20"
  | "TableStyleLight21"
  | "TableStyleMedium1"
  | "TableStyleMedium2"
  | "TableStyleMedium3"
  | "TableStyleMedium4"
  | "TableStyleMedium5"
  | "TableStyleMedium6"
  | "TableStyleMedium7"
  | "TableStyleMedium8"
  | "TableStyleMedium9"
  | "TableStyleMedium10"
  | "TableStyleMedium11"
  | "TableStyleMedium12"
  | "TableStyleMedium13"
  | "TableStyleMedium14"
  | "TableStyleMedium15"
  | "TableStyleMedium16"
  | "TableStyleMedium17"
  | "TableStyleMedium18"
  | "TableStyleMedium19"
  | "TableStyleMedium20"
  | "TableStyleMedium21"
  | "TableStyleMedium22"
  | "TableStyleMedium23"
  | "TableStyleMedium24"
  | "TableStyleMedium25"
  | "TableStyleMedium26"
  | "TableStyleMedium27"
  | "TableStyleMedium28"
  | "TableStyleDark1"
  | "TableStyleDark2"
  | "TableStyleDark3"
  | "TableStyleDark4"
  | "TableStyleDark5"
  | "TableStyleDark6"
  | "TableStyleDark7"
  | "TableStyleDark8"
  | "TableStyleDark9"
  | "TableStyleDark10"
  | "TableStyleDark11";

export interface ResolvedExcelTableOptions {
  name: string;
  style: ExcelTableStyle;
  autoFilter: boolean;
  totalsRow: boolean;
  totalsRowColumns: Array<{
    id: string;
    headerLabel: string;
    formula?: string;
    totalsRow?: ExcelTableTotalsRowDefinition;
  }>;
}

export function serializeExcelTotalsRowFormula(
  _displayName: string,
  headerLabel: string,
  functionName: string,
) {
  const escapedHeader = headerLabel.replaceAll("]", "]]");
  const localColumnRef = `[${escapedHeader}]`;

  switch (functionName) {
    case "sum":
      return `SUBTOTAL(109,${localColumnRef})`;
    case "average":
      return `SUBTOTAL(101,${localColumnRef})`;
    case "count":
      return `SUBTOTAL(103,${localColumnRef})`;
    case "countNums":
      return `SUBTOTAL(102,${localColumnRef})`;
    case "min":
      return `SUBTOTAL(105,${localColumnRef})`;
    case "max":
      return `SUBTOTAL(104,${localColumnRef})`;
    case "stdDev":
      return `SUBTOTAL(107,${localColumnRef})`;
    case "var":
      return `SUBTOTAL(110,${localColumnRef})`;
    default:
      return undefined;
  }
}

export interface BufferedReportTableInput<
  T extends object,
  TSelectableId extends string = string,
  TSchemaContext extends SchemaContext = SchemaContext,
> {
  title?: string;
  schema: ReportSchemaDefinition<T, string, string, SchemaContext>;
  rows: T[];
  select?: TableSelection<TSelectableId>;
  context?: TSchemaContext;
  autoFilter?: boolean | TableAutoFilterOptions;
}

export interface BufferedExcelTableInput<
  T extends object,
  TSelectableId extends string = string,
  TSchemaContext extends SchemaContext = SchemaContext,
> {
  schema: ExcelTableSchemaDefinition<T, string, string, TSchemaContext>;
  rows: T[];
  select?: TableSelection<TSelectableId>;
  context?: TSchemaContext;
  name?: string;
  style?: ExcelTableStyle;
  autoFilter?: boolean;
  totalsRow?: boolean;
}

export type BufferedTableInput<
  T extends object,
  TSelectableId extends string = string,
  TSchemaContext extends SchemaContext = SchemaContext,
> =
  | BufferedReportTableInput<T, TSelectableId, TSchemaContext>
  | BufferedExcelTableInput<T, TSelectableId, TSchemaContext>;

export interface FreezePane {
  rows?: number;
  columns?: number;
}

export interface SheetLayoutOptions {
  tablesPerRow?: number;
  tableColumnGap?: number;
  tableRowGap?: number;
}

export interface SheetViewOptions {
  rightToLeft?: boolean;
  freezePane?: FreezePane;
}

export interface PlannedSummaryCell {
  columnId: string;
  summaryIndex: number;
  value: SummaryResolvedValue;
  style?: CellStyle;
  conditionalFormatting?: WorksheetConditionalFormattingBlock[];
  unstyled?: boolean;
}

export interface BufferedTablePlan<T extends object> {
  id: string;
  title?: string;
  rowCount: number;
  planner: PlannerResult<T>;
  summaries: PlannedSummaryCell[];
  conditionalFormatting?: WorksheetConditionalFormattingBlock[];
  autoFilter: boolean;
  excelTable?: ResolvedExcelTableOptions;
}

export interface BufferedExcelTablePart {
  sheetIndex: number;
  tableId: string;
  xml: string;
  relId: string;
}

export interface BufferedSheetPlan {
  name: string;
  layout?: SheetLayoutOptions;
  view?: SheetViewOptions;
  tables: BufferedTablePlan<any>[];
}

export interface BufferedWorkbookPlan {
  sheets: BufferedSheetPlan[];
  excelTables: BufferedExcelTablePart[];
}

export interface StreamWorkbookSink {
  write(chunk: Uint8Array): Promise<void>;
  close(): Promise<void>;
}

export interface StreamSheetSpool {
  append(chunk: Uint8Array): Promise<void>;
  read(): AsyncIterable<Uint8Array>;
  close(): Promise<void>;
}

export interface StreamSpoolFactory {
  create(sheetName: string): Promise<StreamSheetSpool>;
}

export interface StreamTableCommit<T extends object> {
  rows: T[];
}

export interface StreamTableInput<T extends object, TSelectableId extends string = string> {
  schema: SchemaDefinition<T, string, string, SchemaContext, any>;
  select?: TableSelection<TSelectableId>;
}

export interface StreamReportTableInput<
  T extends object,
  TSelectableId extends string = string,
  TSchemaContext extends SchemaContext = SchemaContext,
> extends StreamTableInput<T, TSelectableId> {
  schema: ReportSchemaDefinition<T, string, string, SchemaContext>;
  context?: TSchemaContext;
  autoFilter?: boolean | TableAutoFilterOptions;
}

export interface StreamExcelTableInput<
  T extends object,
  TSelectableId extends string = string,
  TSchemaContext extends SchemaContext = SchemaContext,
> extends StreamTableInput<T, TSelectableId> {
  schema: ExcelTableSchemaDefinition<T, string, string, TSchemaContext>;
  context?: TSchemaContext;
  name?: string;
  style?: ExcelTableStyle;
  autoFilter?: boolean;
  totalsRow?: boolean;
}

export type AnyStreamTableInput<
  T extends object,
  TSelectableId extends string = string,
  TSchemaContext extends SchemaContext = SchemaContext,
> =
  | StreamReportTableInput<T, TSelectableId, TSchemaContext>
  | StreamExcelTableInput<T, TSelectableId, TSchemaContext>;
