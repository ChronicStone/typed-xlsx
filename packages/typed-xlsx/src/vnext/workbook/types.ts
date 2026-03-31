import type { SchemaContext, SchemaDefinition } from "../schema/builder";
import type { PlannerResult } from "../planner/rows";
import type { SummaryResolvedValue } from "../summary/runtime";
import type { CellStyle } from "../styles/types";

export interface TableSelection<TColumnId extends string = string> {
  include?: readonly TColumnId[];
  exclude?: readonly TColumnId[];
}

export interface TableAutoFilterOptions {
  enabled?: boolean;
}

export interface BufferedTableInput<
  T extends object,
  TSelectableId extends string = string,
  TSchemaContext extends SchemaContext = SchemaContext,
> {
  id?: string;
  title?: string;
  schema: SchemaDefinition<T, string, string, SchemaContext>;
  rows: T[];
  select?: TableSelection<TSelectableId>;
  context?: TSchemaContext;
  autoFilter?: boolean | TableAutoFilterOptions;
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
  value: SummaryResolvedValue;
  style?: CellStyle;
  unstyled?: boolean;
}

export interface BufferedTablePlan<T extends object> {
  id: string;
  title?: string;
  rowCount: number;
  planner: PlannerResult<T>;
  summaries: PlannedSummaryCell[];
  autoFilter: boolean;
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

export interface StreamTableInput<
  T extends object,
  TSelectableId extends string = string,
  TSchemaContext extends SchemaContext = SchemaContext,
> {
  id: string;
  schema: SchemaDefinition<T, string, string, SchemaContext>;
  select?: TableSelection<TSelectableId>;
  context?: TSchemaContext;
  autoFilter?: boolean | TableAutoFilterOptions;
}
