/** Render model of a generated workbook, drawn natively by the docs playground. */

/** Compact resolved cell style. Keys are short because every sheet ships with it. */
export interface PreviewStyle {
  b?: 1;
  i?: 1;
  u?: 1;
  st?: 1;
  /** font color */
  c?: string;
  /** font size in px */
  sz?: number;
  /** fill color */
  f?: string;
  /** borders: css shorthand per side */
  bt?: string;
  br?: string;
  bb?: string;
  bl?: string;
  /** horizontal / vertical alignment */
  ha?: string;
  va?: string;
  wrap?: 1;
  ind?: number;
  /** number format code */
  fmt?: string;
  /** rendered as an Excel checkbox control */
  cb?: 1;
  /** unlocked on a protected sheet */
  ul?: 1;
}

export interface PreviewCell {
  /** displayed text */
  v: string;
  /** cell type: n number, s string, b boolean, e error, img image */
  t?: "n" | "s" | "b" | "e" | "img";
  /** formula without the leading "=" */
  f?: string;
  /** raw value when it differs from the display (numbers, dates) */
  r?: string;
  /** style index into PreviewWorkbook.styles */
  s?: number;
  /** conditional format applied: index into PreviewWorkbook.dxfs */
  cf?: number;
  /** image url for IMAGE() formulas */
  src?: string;
}

export interface PreviewSparkline {
  cell: string;
  type: string;
  values: Array<number | null>;
  color: string;
  markers?: string;
  high?: string;
  low?: string;
  first?: string;
  last?: string;
  negative?: string;
  weight?: number;
}

export interface PreviewImage {
  /** pixel box relative to the sheet origin (A1 top-left) */
  x: number;
  y: number;
  w: number;
  h: number;
  src: string;
  alt: string;
}

export type PreviewChartKind = "bar" | "line" | "area" | "scatter" | "pie" | "doughnut";

export interface PreviewChartSeries {
  name: string;
  kind: PreviewChartKind;
  /** secondary value axis */
  y2?: 1;
  /** series color; pie and doughnut slices use `points` */
  color?: string;
  points?: Array<string | null>;
  /** category labels (scatter: x values as numbers in `xs`) */
  cats: string[];
  /** outer category labels of a multi-level axis, each at the index of its first category */
  groups?: Array<{ at: number; label: string }>;
  xs?: Array<number | null>;
  vals: Array<number | null>;
  dashed?: 1;
  /** markers drawn on a line */
  markers?: 1;
  smooth?: 1;
  /** data labels: "value" | "percent" */
  labels?: "value" | "percent";
  labelFmt?: string;
}

export interface PreviewChart {
  /** pixel box relative to the sheet origin (A1 top-left) */
  x: number;
  y: number;
  w: number;
  h: number;
  title?: string;
  series: PreviewChartSeries[];
  /** bar charts drawn horizontally */
  horizontal?: 1;
  /** "stacked" | "percentStacked" per chart kind */
  stack?: Partial<Record<PreviewChartKind, "stacked" | "percentStacked">>;
  hole?: number;
  axes: {
    x?: { title?: string; fmt?: string; min?: number; max?: number };
    y?: { title?: string; fmt?: string; min?: number; max?: number };
    y2?: { title?: string; fmt?: string; min?: number; max?: number };
  };
  legend?: "b" | "t" | "r" | "l";
  /** drawn from a pivot table */
  pivot?: 1;
}

export interface PreviewTable {
  name: string;
  ref: string;
  style: string;
  stripes: boolean;
  header: boolean;
  totals: boolean;
  filter: boolean;
}

export interface PreviewValidation {
  ref: string;
  type: string;
  operator?: string;
  list?: string[];
  f1?: string;
  f2?: string;
  prompt?: string;
  promptTitle?: string;
  error?: string;
}

export interface PreviewSheet {
  name: string;
  /** worksheet part, e.g. "sheet3.xml" */
  file: string;
  /** used range, full size */
  rows: number;
  cols: number;
  /** column widths in px, index 0 = column A */
  colWidths: number[];
  /** row heights in px, keyed by row number */
  rowHeights: Record<number, number>;
  defaultRowHeight: number;
  freeze?: { rows: number; cols: number };
  merges: string[];
  cells: Record<string, PreviewCell>;
  links: Record<string, { url?: string; location?: string; tip?: string }>;
  validations: PreviewValidation[];
  tables: PreviewTable[];
  sparklines: PreviewSparkline[];
  images: PreviewImage[];
  charts?: PreviewChart[];
  protected: boolean;
  /** rows elided from very long sheets: rows (after + 1 .. after + hidden) are not in `cells` */
  gap?: { after: number; hidden: number };
}

export interface PreviewWorkbook {
  /** size of the .xlsx file in bytes */
  fileSize?: number;
  sheets: PreviewSheet[];
  styles: PreviewStyle[];
  dxfs: PreviewStyle[];
}
