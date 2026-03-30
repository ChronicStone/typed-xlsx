import { describe, expect, it } from "vitest";
import * as VNext from "../../src/vnext";

describe("vnext core", () => {
  it("resolves typed paths at runtime", () => {
    const row = {
      profile: {
        email: "hello@example.com",
      },
    };

    expect(VNext.getValueAtPath(row, "profile.email")).toBe("hello@example.com");
  });

  it("supports string and callback accessors", () => {
    const row = {
      profile: { email: "hello@example.com" },
      firstName: "Ada",
      lastName: "Lovelace",
    };

    expect(VNext.resolveAccessor(row, "profile.email")).toBe("hello@example.com");
    expect(VNext.resolveAccessor(row, (value) => `${value.firstName} ${value.lastName}`)).toBe(
      "Ada Lovelace",
    );
  });

  it("prevents duplicate schema column ids", () => {
    const builder = VNext.SchemaBuilder.create<{ id: string }>();
    builder.column("id", {
      accessor: "id",
    });

    expect(() =>
      builder.column("id", {
        accessor: "id",
      }),
    ).toThrow("Column with id 'id' already exists.");
  });

  it("exposes shared planner metrics for width and height estimation", () => {
    const width = VNext.resolveColumnWidth({
      column: {
        id: "name",
        accessor: "name",
        headerLabel: "Name",
        autoWidth: false,
      },
      currentWidth: 4,
      measuredWidth: 20,
    });

    expect(width).toBe(4);
    expect(VNext.measurePrimitiveValue("hello\nworld")).toBe(5);
    expect(
      VNext.estimateRowHeight(
        ["hello\nworld"],
        [
          {
            font: { size: 14 },
          },
        ],
      ),
    ).toBeGreaterThan(VNext.getDefaultRowHeight());
  });
});
