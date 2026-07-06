import { Buffer } from "node:buffer";

export type ProductMediaRow = {
  sku: string;
  productName: string;
  category: string;
  status: "Live" | "Low stock" | "Launch";
  price: number;
  week1: number;
  week2: number;
  week3: number;
  week4: number;
  storefrontUrl: string;
  thumbnail: Uint8Array;
  thumbnailUrl: string;
};

const thumbnailPng = {
  box: "iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAbElEQVR4nO3QwQ2AIBREQSqxFkuxOc725wVLICTCapyfvCvZoWz72b5cSQ8ASA8ASA8ASA8ASA8AeOqho15DAQAABAGzbilg9Md7AQAAAAAAAAAAAPwIMOOWAd4UQDqAdADpANIBpANIB5DuBt7QUN1JPkANAAAAAElFTkSuQmCC",
  bolt: "iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAmElEQVR4nO3SsQ2AMBBD0VRMxAyswVzMxUAgCiREFV0i7CO/cB2/nMu0LkfmFHUBAOoCANQF0gLmfcsLuMqnBdzlUwKe5e0A73I1AQAAAAAA4wJ6vdsFEPl9qwtEAT0QckArwgLQgrABRBEAfguIwGwA0ctYAFqmJQfUTMsWUDMtW0DNtAAAAAAAwHiALwJAHQDqAFAHgDon2COGMuDoxsEAAAAASUVORK5CYII=",
  tag: "iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAaklEQVR4nO3PsQ2AQBADwa+Aigio8dslgJwUOHNiLG3uGXNbjs6N9AGA9AGA9AGA9AGA9AGA9AGA9IFSwD7XkgAACjG3AdcBAPwN8HYAAAAAAI+fBmgL+GIA6QDSAaQDSAeQDiAdQLr2gBM067YHeC33XQAAAABJRU5ErkJggg==",
  cube: "iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAk0lEQVR4nO3YywmAMBRE0RRiYRYk2JaFCboPxjz8zRu8gbvLYs4yKeMwb84V9QAA6gEA1AMAqAcAUA8AoB4AQD1ABnjjfA5YpvWxAAAAAABAc5g9IHI3PaB3Py0gikgNiCDSA3oIC8AZwgbQQlgBjhB2gBphCagRloC7iFRv4iuI//5KZAmAOgDqAKgDoA6AOnvADpw2UkaUcBnLAAAAAElFTkSuQmCC",
} satisfies Record<string, string>;

function decodePng(base64: string) {
  return new Uint8Array(Buffer.from(base64, "base64"));
}

export function createProductMediaRows(): ProductMediaRow[] {
  return [
    {
      sku: "BK-1024",
      productName: "Atlas Field Backpack",
      category: "Bags",
      status: "Live",
      price: 129,
      week1: 42,
      week2: 51,
      week3: 48,
      week4: 63,
      storefrontUrl: "https://example.com/products/atlas-field-backpack",
      thumbnail: decodePng(thumbnailPng.box),
      thumbnailUrl: "https://dummyimage.com/48x48/1e40af/ffffff.png&text=BK",
    },
    {
      sku: "EL-2088",
      productName: "Pulse USB-C Dock",
      category: "Electronics",
      status: "Launch",
      price: 189,
      week1: 18,
      week2: 31,
      week3: 46,
      week4: 58,
      storefrontUrl: "https://example.com/products/pulse-usb-c-dock",
      thumbnail: decodePng(thumbnailPng.bolt),
      thumbnailUrl: "https://dummyimage.com/48x48/065f46/ffffff.png&text=EL",
    },
    {
      sku: "HM-4310",
      productName: "Northstar Desk Lamp",
      category: "Home",
      status: "Low stock",
      price: 74,
      week1: 39,
      week2: 34,
      week3: 26,
      week4: 19,
      storefrontUrl: "https://example.com/products/northstar-desk-lamp",
      thumbnail: decodePng(thumbnailPng.tag),
      thumbnailUrl: "https://dummyimage.com/48x48/92400e/ffffff.png&text=HM",
    },
    {
      sku: "OF-7712",
      productName: "Modular Storage Cube",
      category: "Office",
      status: "Live",
      price: 52,
      week1: 28,
      week2: 33,
      week3: 37,
      week4: 41,
      storefrontUrl: "https://example.com/products/modular-storage-cube",
      thumbnail: decodePng(thumbnailPng.cube),
      thumbnailUrl: "https://dummyimage.com/48x48/581c87/ffffff.png&text=OF",
    },
  ];
}
