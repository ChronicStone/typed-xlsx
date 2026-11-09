import type { PivotDateUnit } from "./types";

/** Calendar order of the units, outermost first. */
export const PIVOT_DATE_UNITS: readonly PivotDateUnit[] = ["year", "quarter", "month"];

/** Names Excel gives the fields it adds when a date is grouped on several levels. */
export const PIVOT_DATE_FIELD_NAMES: Record<PivotDateUnit, string> = {
  year: "Years",
  quarter: "Quarters",
  month: "Months",
};

/** `groupBy` value of each unit in the pivot cache. */
export const PIVOT_DATE_GROUP_BY: Record<PivotDateUnit, string> = {
  year: "years",
  quarter: "quarters",
  month: "months",
};

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const DAY = 86_400_000;

/** Dates are written as UTC serials, so they are grouped in UTC too. */
export function pivotDateKey(unit: PivotDateUnit, date: Date) {
  switch (unit) {
    case "year":
      return date.getUTCFullYear();
    case "quarter":
      return Math.floor(date.getUTCMonth() / 3) + 1;
    case "month":
      return date.getUTCMonth() + 1;
  }
}

/** Item label Excel shows for a group key, such as `2025`, `Qtr1` or `Jan`. */
export function pivotDateLabel(unit: PivotDateUnit, key: number) {
  switch (unit) {
    case "year":
      return String(key);
    case "quarter":
      return `Qtr${key}`;
    case "month":
      return MONTH_LABELS[key - 1]!;
  }
}

function startOfDay(time: number) {
  return Math.floor(time / DAY) * DAY;
}

function shortDate(time: number) {
  const date = new Date(time);
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()}`;
}

/**
 * Group items of a unit as Excel lists them: an item for dates before the range, one per
 * month, quarter or year, and an item for dates after it.
 */
export function pivotDateGroupItems(unit: PivotDateUnit, range: { min: number; max: number }) {
  const start = startOfDay(range.min);
  const end = startOfDay(range.max) + DAY;
  const firstYear = new Date(range.min).getUTCFullYear();
  const keys =
    unit === "year"
      ? Array.from(
          { length: new Date(range.max).getUTCFullYear() - firstYear + 1 },
          (_, index) => firstYear + index,
        )
      : Array.from({ length: unit === "quarter" ? 4 : 12 }, (_, index) => index + 1);

  return {
    start: new Date(start),
    end: new Date(end),
    labels: [
      `<${shortDate(start)}`,
      ...keys.map((key) => pivotDateLabel(unit, key)),
      `>${shortDate(end)}`,
    ],
    /** Position of a group key in `labels`. */
    position: (key: number) => (unit === "year" ? key - firstYear + 1 : key),
  };
}
