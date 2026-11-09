import { deflateSync } from "node:zlib";
import { createShowcaseFaker } from "../../src/_shared/faker";

export const WEEKS = ["W36", "W37", "W38", "W39", "W40", "W41", "W42", "W43"];
export const SUPPLIERS = [
  "Nordic Parts AB",
  "Kessler GmbH",
  "Lumen Supply Co.",
  "Orient Components",
];

export type StockItem = {
  photo: Uint8Array;
  sku: string;
  product: string;
  category: "Lighting" | "Power" | "Sensors" | "Mounting";
  warehouse: "Rotterdam" | "Lyon" | "Leipzig";
  onHand: number;
  inbound: number;
  unitCost: number;
  leadTimeDays: number;
  salesByWeek: Record<string, number>;
  supplier: string;
  reorderQty: number;
};

const PRODUCTS: Array<[string, StockItem["category"], number]> = [
  ["LED panel 60×60 4000K", "Lighting", 38],
  ["LED strip 5 m warm", "Lighting", 14],
  ["Track spot 12 W", "Lighting", 22],
  ["Emergency exit sign", "Lighting", 41],
  ["Driver 40 W dimmable", "Power", 19],
  ["Driver 75 W DALI", "Power", 46],
  ["Power supply 24 V 150 W", "Power", 33],
  ["Motion sensor ceiling", "Sensors", 27],
  ["Daylight sensor", "Sensors", 31],
  ["Presence detector PIR", "Sensors", 24],
  ["Suspension kit 1.5 m", "Mounting", 9],
  ["Surface frame 60×60", "Mounting", 17],
  ["Recessed clip set", "Mounting", 4],
  ["Track rail 2 m", "Mounting", 21],
];

// ── Product thumbnails ───────────────────────────────────────────────────────
// Small flat pictograms drawn pixel by pixel and encoded as PNG, so the example needs no assets.

const CATEGORY_COLORS: Record<StockItem["category"], [number, number, number]> = {
  Lighting: [234, 179, 8],
  Power: [37, 99, 235],
  Sensors: [13, 148, 136],
  Mounting: [100, 116, 139],
};

function crc32(bytes: Uint8Array) {
  let crc = ~0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function pngChunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** Encodes an RGBA pixel callback as a PNG. */
function png(size: number, pixel: (x: number, y: number) => [number, number, number, number]) {
  const raw = new Uint8Array(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) raw.set(pixel(x, y), y * (size * 4 + 1) + 1 + x * 4);
  }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, size);
  view.setUint32(4, size);
  header.set([8, 6, 0, 0, 0], 8);
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", new Uint8Array()),
  ];
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** A rounded tile in the category colour with a white pictogram: bulb, plug, rings or bracket. */
function thumbnail(category: StockItem["category"], variant: number) {
  const [r, g, b] = CATEGORY_COLORS[category];
  const size = 48;
  return png(size, (x, y) => {
    const cx = x + 0.5 - size / 2;
    const cy = y + 0.5 - size / 2;
    const corner = Math.max(Math.abs(cx) - 15, 0) ** 2 + Math.max(Math.abs(cy) - 15, 0) ** 2;
    if (corner > 81) return [0, 0, 0, 0];
    const d = Math.hypot(cx, cy);
    let mark = false;
    if (category === "Lighting")
      mark = Math.hypot(cx, cy + 3) < 9 - (variant % 2) || (Math.abs(cx) < 4 && cy > 6 && cy < 12);
    else if (category === "Power")
      mark =
        (Math.abs(cx) < 9 && Math.abs(cy) < 7) ||
        (Math.abs(Math.abs(cx) - 4) < 1.5 && cy < -7 && cy > -13);
    else if (category === "Sensors")
      mark =
        Math.abs(d - 4) < 1.6 ||
        Math.abs(d - 9) < 1.6 ||
        (variant % 2 === 1 && Math.abs(d - 13.5) < 1.4);
    else
      mark =
        (Math.abs(cx + 6) < 2.5 && Math.abs(cy) < 12) ||
        (Math.abs(cy - 10) < 2.5 && cx > -8 && cx < 9);
    const shade = 1 - (y / size) * 0.18;
    return mark
      ? [255, 255, 255, 255]
      : [Math.round(r * shade), Math.round(g * shade), Math.round(b * shade), 255];
  });
}

/** Stock levels and eight weeks of sales per SKU. Reorder quantities start at zero: buyers fill them in. */
export function createStock(): StockItem[] {
  const faker = createShowcaseFaker(8086);
  const warehouses: StockItem["warehouse"][] = ["Rotterdam", "Lyon", "Leipzig"];
  return PRODUCTS.map(([product, category, unitCost], i) => {
    const weekly = faker.number.int({ min: 20, max: 160 });
    const salesByWeek = Object.fromEntries(
      WEEKS.map((w, k) => [
        w,
        Math.max(
          0,
          Math.round(weekly * (1 + (k - 4) * 0.04) + faker.number.int({ min: -12, max: 12 })),
        ),
      ]),
    );
    return {
      photo: thumbnail(category, i),
      sku: `${category.slice(0, 3).toUpperCase()}-${String(1040 + i * 7)}`,
      product,
      category,
      warehouse: faker.helpers.arrayElement(warehouses),
      onHand: faker.number.int({ min: weekly * 0.6, max: weekly * 7 }),
      inbound: faker.helpers.arrayElement([0, 0, 0, weekly * 2, weekly * 4]),
      unitCost,
      leadTimeDays: faker.helpers.arrayElement([14, 21, 28, 42]),
      salesByWeek,
      supplier: faker.helpers.arrayElement(SUPPLIERS),
      reorderQty: 0,
    };
  });
}
