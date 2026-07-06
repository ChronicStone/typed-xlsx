export type SparklineType = "line" | "column" | "winLoss";
export type SparklineEmptyCells = "gap" | "zero" | "span";
export type SparklineAxisType = "individual" | "group" | "custom";

export type SparklineSource<
  TColumnId extends string = string,
  TGroupId extends string = string,
  TDynamicId extends string = string,
> =
  | readonly TColumnId[]
  | { from: TColumnId; to: TColumnId }
  | { group: TGroupId }
  | { dynamic: TDynamicId };

export interface SparklineShowOptions {
  markers?: boolean;
  first?: boolean;
  last?: boolean;
  high?: boolean;
  low?: boolean;
  negative?: boolean;
  axis?: boolean;
  hidden?: boolean;
}

export interface SparklineColorSet {
  series?: string;
  markers?: string;
  first?: string;
  last?: string;
  high?: string;
  low?: string;
  negative?: string;
  axis?: string;
}

export type SparklinePointStyle =
  | boolean
  | {
      visible?: boolean;
      color?: string;
    };

export type SparklineAxisBound =
  | SparklineAxisType
  | {
      type?: SparklineAxisType;
      value?: number;
    };

export interface SparklineAxisStyle {
  visible?: boolean;
  color?: string;
  min?: SparklineAxisBound;
  max?: SparklineAxisBound;
}

export interface SparklineLineStyle {
  color?: string;
  weight?: number;
}

export interface SparklineStyleOptions {
  series?: string;
  line?: SparklineLineStyle;
  markers?: SparklinePointStyle;
  dots?: SparklinePointStyle;
  first?: SparklinePointStyle;
  last?: SparklinePointStyle;
  high?: SparklinePointStyle;
  low?: SparklinePointStyle;
  negative?: SparklinePointStyle;
  axis?: boolean | SparklineAxisStyle;
  hidden?: boolean;
  rightToLeft?: boolean;
}

export interface SparklineDefinition<
  TColumnId extends string = string,
  TGroupId extends string = string,
  TDynamicId extends string = string,
> {
  source: SparklineSource<TColumnId, TGroupId, TDynamicId>;
  type?: SparklineType;
  emptyCells?: SparklineEmptyCells;
  show?: SparklineShowOptions;
  colors?: SparklineColorSet;
  style?: SparklineStyleOptions;
  lineWeight?: number;
  minAxisType?: SparklineAxisType;
  maxAxisType?: SparklineAxisType;
  manualMin?: number;
  manualMax?: number;
  rightToLeft?: boolean;
}

export type SparklineInput<
  TColumnId extends string = string,
  TGroupId extends string = string,
  TDynamicId extends string = string,
> = SparklineDefinition<TColumnId, TGroupId, TDynamicId>;

export type ResolvedSparklineDefinition = SparklineDefinition<string, string, string>;

export interface SparklineDefaults {
  type?: SparklineType;
  emptyCells?: SparklineEmptyCells;
  show?: SparklineShowOptions;
  colors?: SparklineColorSet;
  style?: SparklineStyleOptions;
  lineWeight?: number;
  minAxisType?: SparklineAxisType;
  maxAxisType?: SparklineAxisType;
  manualMin?: number;
  manualMax?: number;
  rightToLeft?: boolean;
}

export function normalizeSparklineInput(
  input?: SparklineInput<string, string, string>,
): ResolvedSparklineDefinition | undefined {
  if (!input) {
    return undefined;
  }

  return normalizeSparklinePresentation({
    ...input,
    source: input.source,
  });
}

export function normalizeSparklineDefaults(
  input?: SparklineDefaults,
): SparklineDefaults | undefined {
  return input ? normalizeSparklinePresentation(input) : undefined;
}

function normalizeSparklinePresentation<T extends SparklineDefaults | ResolvedSparklineDefinition>(
  input: T,
): T {
  const style = input.style;
  const styleShow: SparklineShowOptions = {};
  const styleColors: SparklineColorSet = {};
  let lineWeight = input.lineWeight;
  let minAxisType = input.minAxisType;
  let maxAxisType = input.maxAxisType;
  let manualMin = input.manualMin;
  let manualMax = input.manualMax;
  let rightToLeft = input.rightToLeft;

  if (style) {
    if (style.series) {
      styleColors.series = style.series;
    }
    if (style.line) {
      if (style.line.color) {
        styleColors.series = style.line.color;
      }
      if (style.line.weight !== undefined) {
        lineWeight = style.line.weight;
      }
    }

    applyPointStyle(style.markers ?? style.dots, "markers", "markers", styleShow, styleColors);
    applyPointStyle(style.first, "first", "first", styleShow, styleColors);
    applyPointStyle(style.last, "last", "last", styleShow, styleColors);
    applyPointStyle(style.high, "high", "high", styleShow, styleColors);
    applyPointStyle(style.low, "low", "low", styleShow, styleColors);
    applyPointStyle(style.negative, "negative", "negative", styleShow, styleColors);

    if (style.axis !== undefined) {
      if (typeof style.axis === "boolean") {
        styleShow.axis = style.axis;
      } else {
        if (style.axis.visible !== undefined) {
          styleShow.axis = style.axis.visible;
        }
        if (style.axis.color) {
          styleColors.axis = style.axis.color;
        }

        const min = resolveAxisBound(style.axis.min);
        if (min.type !== undefined) {
          minAxisType = min.type;
        }
        if (min.value !== undefined) {
          manualMin = min.value;
          minAxisType ??= "custom";
        }

        const max = resolveAxisBound(style.axis.max);
        if (max.type !== undefined) {
          maxAxisType = max.type;
        }
        if (max.value !== undefined) {
          manualMax = max.value;
          maxAxisType ??= "custom";
        }
      }
    }

    if (style.hidden !== undefined) {
      styleShow.hidden = style.hidden;
    }
    if (style.rightToLeft !== undefined) {
      rightToLeft = style.rightToLeft;
    }
  }

  return {
    ...input,
    ...(Object.keys(styleShow).length > 0 || input.show
      ? { show: { ...(input.show ?? {}), ...styleShow } }
      : {}),
    ...(Object.keys(styleColors).length > 0 || input.colors
      ? { colors: { ...(input.colors ?? {}), ...styleColors } }
      : {}),
    ...(input.style ? { style: { ...input.style } } : {}),
    ...(lineWeight !== undefined ? { lineWeight } : {}),
    ...(minAxisType !== undefined ? { minAxisType } : {}),
    ...(maxAxisType !== undefined ? { maxAxisType } : {}),
    ...(manualMin !== undefined ? { manualMin } : {}),
    ...(manualMax !== undefined ? { manualMax } : {}),
    ...(rightToLeft !== undefined ? { rightToLeft } : {}),
  } as T;
}

function applyPointStyle(
  point: SparklinePointStyle | undefined,
  showKey: keyof SparklineShowOptions,
  colorKey: keyof SparklineColorSet,
  show: SparklineShowOptions,
  colors: SparklineColorSet,
) {
  if (point === undefined) {
    return;
  }

  if (typeof point === "boolean") {
    show[showKey] = point;
    return;
  }

  if (point.visible !== undefined) {
    show[showKey] = point.visible;
  } else if (point.color) {
    show[showKey] = true;
  }

  if (point.color) {
    colors[colorKey] = point.color;
  }
}

function resolveAxisBound(bound: SparklineAxisBound | undefined) {
  if (!bound) {
    return {};
  }

  if (typeof bound === "string") {
    return { type: bound };
  }

  return bound;
}
