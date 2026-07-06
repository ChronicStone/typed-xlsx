import { createWorkbook } from "typed-xlsx";
import { createProductMediaRows } from "./data";
import { productMediaCatalogSchema } from "./schema";

export function buildProductMediaCatalogWorkbook() {
  const workbook = createWorkbook();

  workbook
    .sheet("Catalog", {
      freezePane: { rows: 2, columns: 2 },
    })
    .table("products", {
      title: "Product Media Catalog",
      rows: createProductMediaRows(),
      schema: productMediaCatalogSchema,
      defaults: {
        title: { style: { fill: { color: { rgb: "E0F2FE" } } } },
        header: { preset: "header.inverse", style: { fill: { color: { rgb: "0F172A" } } } },
        cells: {
          base: { style: { alignment: { vertical: "center" } } },
          hyperlink: { style: { font: { color: { rgb: "0563C1" }, underline: true } } },
        },
      },
    });

  return workbook.toUint8Array();
}

export const buildArtifact = buildProductMediaCatalogWorkbook;
