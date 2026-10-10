import { describe, expect, it } from "vite-plus/test";
import { TableBodyStyles } from "../src/styles/body";
import { StylesCollector } from "../src/styles/collector";
import { withCellControl } from "../src/styles/internal";

describe("table body styles", () => {
  it("observes style mutations and distinguishes hyperlink and checkbox styles", () => {
    const collector = new StylesCollector();
    const styles = new TableBodyStyles(collector);
    const style = { font: { color: { rgb: "FF0000" } } };
    const first = styles.resolve(0, { style });
    expect(styles.resolve(0, { style: { font: { color: { rgb: "FF0000" } } } })).toBe(first);
    style.font.color.rgb = "00FF00";
    const changed = styles.resolve(0, { style });
    expect(changed).not.toBe(first);
    const linked = styles.resolve(0, { style, hyperlink: { target: "https://example.com" } });
    expect(linked).not.toBe(changed);
    expect(styles.resolve(0, { style, hyperlink: { target: "https://example.org" } })).toBe(linked);
    expect(styles.resolve(0, { style: withCellControl(style, "checkbox") })).not.toBe(changed);
    expect(styles.resolve(0, { style })).toBe(changed);
    expect(collector.toXml()).toContain('rgb="FFFF0000"');
    expect(collector.toXml()).toContain('rgb="FF00FF00"');
    expect(collector.hasFeaturePropertyBag()).toBe(true);
  });

  it("keeps defaults isolated between tables sharing a workbook style registry", () => {
    const collector = new StylesCollector();
    const first = new TableBodyStyles(collector, { cells: { base: { font: { bold: true } } } });
    const second = new TableBodyStyles(collector, { cells: { base: { font: { italic: true } } } });
    expect(first.resolve(0, {})).not.toBe(second.resolve(0, {}));
  });
});
