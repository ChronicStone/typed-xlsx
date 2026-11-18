// XML 1.0 forbids most control characters, U+FFFE, U+FFFF and unpaired surrogates. Excel repairs
// or refuses a file that contains them, so they are dropped from every text node and attribute.
const INVALID_XML_CHAR_SOURCE =
  "[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\uFFFE\\uFFFF]|[\\uD800-\\uDBFF](?![\\uDC00-\\uDFFF])|(?<![\\uD800-\\uDBFF])[\\uDC00-\\uDFFF]";
const NEEDS_ESCAPE_OR_STRIP = new RegExp(`[&<>"']|${INVALID_XML_CHAR_SOURCE}`);
const INVALID_XML_CHARS = new RegExp(INVALID_XML_CHAR_SOURCE, "g");

function escapeText(value: string) {
  if (!NEEDS_ESCAPE_OR_STRIP.test(value)) return value;
  return value
    .replace(INVALID_XML_CHARS, "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function xmlEscape(value: unknown) {
  return escapeText(String(value));
}

// Spreadsheet text (ST_Xstring) reads `_xHHHH_` as the character U+HHHH. A literal one keeps its
// text by writing its leading underscore as `_x005F_`.
const XSTRING_ESCAPE_SEQUENCE = /_(?=x[0-9A-Fa-f]{4}_)/g;

/** Escapes text that a reader would otherwise decode as `_xHHHH_` character codes. */
export function xstring(value: string) {
  return value.includes("_x") ? value.replace(XSTRING_ESCAPE_SEQUENCE, "_x005F_") : value;
}

/** Formula text. Excel decodes `_xHHHH_` in formulas too, so it must match escaped cell text. */
export function formulaText(formula: string) {
  return escapeText(xstring(formula));
}

/** A `<t>` element; keeps leading, trailing and line-break whitespace that Excel would trim. */
export function textElement(value: string) {
  const preserve = /^\s|\s$|[\n\t]/.test(value);
  return `<t${preserve ? ' xml:space="preserve"' : ""}>${escapeText(xstring(value))}</t>`;
}

export function xmlSelfClosing(
  name: string,
  attributes?: Record<string, string | number | boolean | undefined>,
) {
  const attrs = !attributes
    ? ""
    : Object.entries(attributes)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => ` ${key}="${xmlEscape(value)}"`)
        .join("");

  return `<${name}${attrs}/>`;
}

export function xmlElement(
  name: string,
  attributes?: Record<string, string | number | boolean | undefined>,
  children?: string | string[],
) {
  const attrs = !attributes
    ? ""
    : Object.entries(attributes)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => ` ${key}="${xmlEscape(value)}"`)
        .join("");

  const content = Array.isArray(children) ? children.join("") : (children ?? "");
  return `<${name}${attrs}>${content}</${name}>`;
}

export function xmlDocument(
  name: string,
  attributes?: Record<string, string | number | boolean | undefined>,
  children?: string | string[],
) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${xmlElement(
    name,
    attributes,
    children,
  )}`;
}
