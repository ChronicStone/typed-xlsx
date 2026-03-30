function escapeText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function xmlEscape(value: unknown) {
  return escapeText(String(value));
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
