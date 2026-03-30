import type { SchemaContext, SchemaDefinition } from "../schema/builder";
import type { PlannerResult } from "../planner/rows";
import type { SummaryCellValue } from "../summary/runtime";
import type { CellStyle } from "../styles/types";

export interface TableSelection<TColumnId extends string = string> {
  include?: readonly TColumnId[];
  exclude?: readonly TColumnId[];
}

export interface BufferedTableInput<T extends object, TColumnId extends string = string> {
  id?: string;
  title?: string;
  schema: SchemaDefinition<T, TColumnId>;
  rows: T[];
  select?: TableSelection<TColumnId>;
  context?: SchemaContext;
}

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
  value: SummaryCellValue;
  style?: CellStyle;
}

export interface BufferedTablePlan<T extends object> {
  id: string;
  title?: string;
  rowCount: number;
  planner: PlannerResult<T>;
  summaries: PlannedSummaryCell[];
}

export interface BufferedSheetPlan {
  name: string;
  layout?: SheetLayoutOptions;
  view?: SheetViewOptions;
  tables: BufferedTablePlan<any>[];
}

export interface BufferedWorkbookPlan {
  sheets: BufferedSheetPlan[];
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

export interface StreamTableInput<T extends object, TColumnId extends string = string> {
  id: string;
  schema: SchemaDefinition<T, TColumnId>;
  select?: TableSelection<TColumnId>;
  context?: SchemaContext;
}
