export function escapeStructuredReferenceHeader(headerLabel: string) {
  // Inside a structured reference, Excel's escape character is the apostrophe: it goes before
  // ', [, ] and #.
  return headerLabel.replace(/(['[\]#])/g, "'$1");
}

export function serializeExcelTableCurrentRowRef(tableName: string, headerLabel: string) {
  return `${tableName}[[#This Row],[${escapeStructuredReferenceHeader(headerLabel)}]]`;
}

export function serializeExcelTableCurrentRowRange(
  tableName: string,
  startHeaderLabel: string,
  endHeaderLabel: string,
) {
  return `${tableName}[[#This Row],[${escapeStructuredReferenceHeader(
    startHeaderLabel,
  )}]:[${escapeStructuredReferenceHeader(endHeaderLabel)}]]`;
}
