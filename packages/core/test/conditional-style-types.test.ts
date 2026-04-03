import { describe, expect, it } from "vitest";
import { conditionalStyle } from "../src";

void conditionalStyle().when(({ refs }) => refs.column("amount").gt(0), {
  font: {
    bold: true,
  },
});

void conditionalStyle().when(({ refs }) => refs.column("amount").gt(0), {
  // @ts-expect-error worksheet protection is not supported in conditional formatting styles
  protection: {
    locked: false,
  },
});

describe("conditional style types", () => {
  it("keeps the type guard file in the test suite", () => {
    expect(true).toBe(true);
  });
});
