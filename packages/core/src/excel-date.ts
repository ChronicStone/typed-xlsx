const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const FIRST_DAY_AFTER_FAKE_LEAP_DAY_MS = Date.UTC(1900, 2, 1);
const DAY_MS = 86_400_000;

/**
 * Serial number of a date in Excel's 1900 date system, read in UTC.
 *
 * Excel counts a 1900-02-29 that never existed (serial 60), so a plain day count from 1899-12-30
 * is only right from 1900-03-01 (serial 61). Earlier dates are one lower: 1900-01-01 is 1.
 */
export function toExcelSerial(value: Date) {
  const time = value.getTime();
  const days = (time - EXCEL_EPOCH_MS) / DAY_MS;
  return time < FIRST_DAY_AFTER_FAKE_LEAP_DAY_MS ? days - 1 : days;
}
