import { describe, expect, it } from "vitest";
import { deepMerge } from "../src/styles/merge";
import type { CellStyle } from "../src/styles/types";

describe("deepMerge", () => {
  it("deep-merges nested style objects without dropping sibling keys", () => {
    const merged = deepMerge<CellStyle>(
      {
        alignment: { horizontal: "center", vertical: "center" },
        border: { top: { style: "thin" } },
        font: { color: { rgb: "111111" }, underline: true },
      },
      {
        alignment: { wrapText: true },
        border: { top: { color: { rgb: "222222" } }, bottom: { style: "medium" } },
        font: { bold: true },
      },
    );

    expect(merged).toEqual({
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: {
        top: { color: { rgb: "222222" }, style: "thin" },
        bottom: { style: "medium" },
      },
      font: { bold: true, color: { rgb: "111111" }, underline: true },
    });
  });

  it("treats arrays and primitive values as replace operations", () => {
    const merged = deepMerge<{ flags?: string[]; nested?: { enabled?: boolean; label?: string } }>(
      { flags: ["a"], nested: { enabled: true, label: "left" } },
      { flags: ["b", "c"], nested: { label: "right" } },
    );

    expect(merged).toEqual({
      flags: ["b", "c"],
      nested: { enabled: true, label: "right" },
    });
  });
});
