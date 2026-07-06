import { createExcelSchema } from "typed-xlsx";
import type { ProductMediaRow } from "./data";

const headerStyle = {
  fill: { color: { rgb: "0F172A" } },
  font: { color: { rgb: "FFFFFF" }, bold: true },
  alignment: { vertical: "center" },
} as const;

const rightAligned = { alignment: { horizontal: "right" } } as const;

export const productMediaCatalogSchema = createExcelSchema<ProductMediaRow>()
  .column("thumbnail", {
    type: "image",
    header: "Image",
    accessor: "thumbnail",
    alt: "productName",
    size: { width: 44, height: 44 },
    padding: 3,
    width: 10,
    headerStyle,
  })
  .column("remotePreview", {
    type: "image",
    source: "url",
    header: "URL Image",
    accessor: "thumbnailUrl",
    alt: "productName",
    size: { width: 44, height: 44 },
    width: 10,
    headerStyle,
  })
  .column("sku", {
    header: "SKU",
    accessor: "sku",
    width: 12,
    headerStyle,
  })
  .column("productName", {
    header: "Product",
    accessor: "productName",
    minWidth: 24,
    style: { alignment: { wrapText: true, vertical: "center" } },
    headerStyle,
  })
  .column("category", {
    header: "Category",
    accessor: "category",
    width: 14,
    headerStyle,
  })
  .column("status", {
    type: "badge",
    header: "Status",
    accessor: "status",
    width: 12,
    variants: {
      Live: {
        style: {
          fill: { color: { rgb: "DCFCE7" } },
          font: { color: { rgb: "166534" }, bold: true },
        },
      },
      "Low stock": {
        style: {
          fill: { color: { rgb: "FEF3C7" } },
          font: { color: { rgb: "92400E" }, bold: true },
        },
      },
      Launch: {
        style: {
          fill: { color: { rgb: "DBEAFE" } },
          font: { color: { rgb: "1D4ED8" }, bold: true },
        },
      },
    },
    headerStyle,
  })
  .column("listedOnline", {
    type: "checkbox",
    header: "Listed",
    accessor: "listedOnline",
    width: 9,
    headerStyle,
  })
  .column("price", {
    header: "Price",
    accessor: "price",
    width: 10,
    style: { numFmt: '"$"#,##0', ...rightAligned },
    headerStyle,
  })
  .group("weeklySales", { header: "Weekly Sales" }, (group) => {
    group
      .column("week1", {
        header: "W1",
        accessor: "week1",
        width: 8,
        style: rightAligned,
        headerStyle,
      })
      .column("week2", {
        header: "W2",
        accessor: "week2",
        width: 8,
        style: rightAligned,
        headerStyle,
      })
      .column("week3", {
        header: "W3",
        accessor: "week3",
        width: 8,
        style: rightAligned,
        headerStyle,
      })
      .column("week4", {
        header: "W4",
        accessor: "week4",
        width: 8,
        style: rightAligned,
        headerStyle,
      });
  })
  .column("trend", {
    type: "sparkline",
    header: "Trend",
    source: { group: "weeklySales" },
    sparklineType: "line",
    width: 16,
    style: {
      line: { color: "#2563EB", weight: 1.5 },
      markers: { visible: true, color: "#0F172A" },
      high: { visible: true, color: "#16A34A" },
      low: { visible: true, color: "#EF4444" },
    },
    headerStyle,
  })
  .column("storefront", {
    type: "hyperlink",
    header: "Storefront",
    accessor: "productName",
    target: (row: ProductMediaRow) => row.storefrontUrl,
    tooltip: "Open product page",
    minWidth: 18,
    headerStyle,
  })
  .build();
