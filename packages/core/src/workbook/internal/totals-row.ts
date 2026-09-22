import type { ExcelTableTotalsRowFunction, PrimitiveCellValue } from "../../schema/builder";

export type ExcelTotalsRowStats = {
  nonEmptyCount: number;
  numericCount: number;
  sum: number;
  min?: number;
  max?: number;
} & (
  | { functionName: "stdDev" | "var"; values: number[] }
  | { functionName: Exclude<ExcelTableTotalsRowFunction, "stdDev" | "var">; values?: never }
);

export function createExcelTotalsRowStats(
  functionName: ExcelTableTotalsRowFunction,
): ExcelTotalsRowStats {
  const stats = {
    nonEmptyCount: 0,
    numericCount: 0,
    sum: 0,
  };
  return functionName === "stdDev" || functionName === "var"
    ? { ...stats, functionName, values: [] }
    : { ...stats, functionName };
}

export function stepExcelTotalsRowStats(stats: ExcelTotalsRowStats, value: PrimitiveCellValue) {
  if (value !== null && value !== undefined && value !== "") {
    stats.nonEmptyCount += 1;
  }

  const number = toNumericCellValue(value);
  if (number === undefined) {
    return;
  }

  stats.values?.push(number);
  stats.numericCount += 1;
  stats.sum += number;
  stats.min = stats.min === undefined ? number : Math.min(stats.min, number);
  stats.max = stats.max === undefined ? number : Math.max(stats.max, number);
}

export function summarizeExcelTotalsRowValues(
  values: PrimitiveCellValue[],
  functionName: ExcelTableTotalsRowFunction,
): PrimitiveCellValue {
  const stats = createExcelTotalsRowStats(functionName);
  values.forEach((value) => stepExcelTotalsRowStats(stats, value));
  return finalizeExcelTotalsRowStats(stats);
}

export function finalizeExcelTotalsRowStats(stats: ExcelTotalsRowStats): PrimitiveCellValue {
  switch (stats.functionName) {
    case "count":
      return stats.nonEmptyCount;
    case "countNums":
      return stats.numericCount;
    case "sum":
      return stats.sum;
    case "average":
      return stats.numericCount > 0 ? stats.sum / stats.numericCount : undefined;
    case "min":
      return stats.min;
    case "max":
      return stats.max;
    case "stdDev":
    case "var": {
      if (stats.numericCount < 2) return undefined;
      const mean = stats.sum / stats.numericCount;
      const squaredDiffs = stats.values.reduce((sum, value) => sum + (value - mean) ** 2, 0);
      const sampleVariance = squaredDiffs / (stats.numericCount - 1);
      return stats.functionName === "stdDev" ? Math.sqrt(sampleVariance) : sampleVariance;
    }
  }
}

function toNumericCellValue(value: PrimitiveCellValue) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (value instanceof Date) {
    return (value.getTime() - Date.UTC(1899, 11, 30)) / 86_400_000;
  }

  return undefined;
}
