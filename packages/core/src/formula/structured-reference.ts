export function escapeStructuredReferenceHeader(headerLabel: string) {
  return headerLabel.replaceAll("]", "]]");
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
