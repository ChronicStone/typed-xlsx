import type { ExcelTableTotalsRowFunction, PrimitiveCellValue } from "../../schema/builder";

export interface ExcelTotalsRowStats {
  values: number[];
  nonEmptyCount: number;
  numericCount: number;
  sum: number;
  min?: number;
  max?: number;
}

export function createExcelTotalsRowStats(): ExcelTotalsRowStats {
  return {
    values: [],
    nonEmptyCount: 0,
    numericCount: 0,
    sum: 0,
  };
}

export function stepExcelTotalsRowStats(stats: ExcelTotalsRowStats, value: PrimitiveCellValue) {
  if (value !== null && value !== undefined && value !== "") {
    stats.nonEmptyCount += 1;
  }

  const number = toNumericCellValue(value);
  if (number === undefined) {
    return;
  }

  stats.values.push(number);
  stats.numericCount += 1;
  stats.sum += number;
  stats.min = stats.min === undefined ? number : Math.min(stats.min, number);
  stats.max = stats.max === undefined ? number : Math.max(stats.max, number);
}

export function summarizeExcelTotalsRowValues(
  values: PrimitiveCellValue[],
  functionName: ExcelTableTotalsRowFunction,
): PrimitiveCellValue {
  const stats = createExcelTotalsRowStats();
  values.forEach((value) => stepExcelTotalsRowStats(stats, value));
  return finalizeExcelTotalsRowStats(stats, functionName);
}

export function finalizeExcelTotalsRowStats(
  stats: ExcelTotalsRowStats,
  functionName: ExcelTableTotalsRowFunction,
): PrimitiveCellValue {
  if (functionName === "count") {
    return stats.nonEmptyCount;
  }

  if (functionName === "countNums") {
    return stats.numericCount;
  }

  if (functionName === "sum") {
    return stats.sum;
  }

  if (stats.numericCount === 0) {
    return undefined;
  }

  if (functionName === "average") {
    return stats.sum / stats.numericCount;
  }

  if (functionName === "min") {
    return stats.min;
  }

  if (functionName === "max") {
    return stats.max;
  }

  if (stats.numericCount < 2) {
    return undefined;
  }

  const mean = stats.sum / stats.numericCount;
  const squaredDiffs = stats.values.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  const sampleVariance = squaredDiffs / (stats.numericCount - 1);

  return functionName === "stdDev" ? Math.sqrt(sampleVariance) : sampleVariance;
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
