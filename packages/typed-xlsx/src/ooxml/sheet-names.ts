const INVALID_SHEET_NAME_PATTERN = /[\\/*?:[\]|]/g;
const MAX_SHEET_NAME_LENGTH = 31;

function normalizeSheetName(name: string) {
  const replaced = name
    .replace(INVALID_SHEET_NAME_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^'+|'+$/g, "");

  return replaced.length > 0 ? replaced : "Sheet";
}

function truncateSheetName(name: string, maxLength: number) {
  return name.length <= maxLength ? name : name.slice(0, maxLength).trimEnd();
}

export function buildWorksheetNames(names: string[]) {
  const used = new Set<string>();

  return names.map((name, index) => {
    const normalized = normalizeSheetName(name);
    let candidate = truncateSheetName(normalized, MAX_SHEET_NAME_LENGTH);

    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }

    let duplicateIndex = 2;
    while (true) {
      const suffix = ` (${duplicateIndex})`;
      const base = truncateSheetName(normalized, MAX_SHEET_NAME_LENGTH - suffix.length);
      candidate = `${base}${suffix}`;

      if (!used.has(candidate)) {
        used.add(candidate);
        return candidate;
      }

      duplicateIndex += 1;
      if (duplicateIndex > names.length + index + 10) {
        const fallback = truncateSheetName(`Sheet ${index + 1}`, MAX_SHEET_NAME_LENGTH);
        if (!used.has(fallback)) {
          used.add(fallback);
          return fallback;
        }
      }
    }
  });
}
