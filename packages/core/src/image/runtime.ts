import {
  DEFAULT_IMAGE_SIZE,
  type ImageColumnOptions,
  type ImageData,
  type ImageMediaType,
  type ImagePadding,
  type ImageSourceValue,
  type ImageUrlSourceValue,
  type ImageUrlValue,
  type ImageValue,
  type ResolvedImageUrlValue,
  type ResolvedImageValue,
} from "./types";

const POINTS_PER_PIXEL = 0.75;
const COLUMN_WIDTH_PIXELS = 7;

export function resolveImageValue(
  value: ImageSourceValue,
  options: ImageColumnOptions = {},
): ResolvedImageValue | undefined {
  if (!value) {
    return undefined;
  }

  const input = isImageValue(value) ? value : { data: value };
  const data = toUint8Array(input.data);
  const mediaType = input.mediaType ?? options.mediaType ?? inferImageMediaType(data);

  if (!mediaType) {
    throw new Error(
      "Image columns require a mediaType when image bytes are not a PNG or JPEG with a recognizable signature.",
    );
  }

  const size = input.size ?? options.size ?? DEFAULT_IMAGE_SIZE;
  assertPositiveSize(size);

  return {
    data,
    mediaType,
    alt: input.alt ?? options.alt,
    size,
    fit: input.fit ?? options.fit ?? "contain",
    padding: normalizeImagePadding(input.padding ?? options.padding),
  };
}

export function imageHeightToPoints(image: ResolvedImageValue) {
  return (image.size.height + (image.padding.y ?? 0) * 2) * POINTS_PER_PIXEL;
}

export function imageWidthToColumnWidth(image: ResolvedImageValue) {
  return Math.ceil((image.size.width + (image.padding.x ?? 0) * 2) / COLUMN_WIDTH_PIXELS);
}

export function imageExtension(mediaType: ImageMediaType) {
  return mediaType === "image/png" ? "png" : "jpeg";
}

export function imageContentType(mediaType: ImageMediaType) {
  return mediaType;
}

export function resolveImageUrlValue(
  value: ImageUrlSourceValue,
  options: ImageColumnOptions = {},
): ResolvedImageUrlValue | undefined {
  if (!value) {
    return undefined;
  }

  const input = isImageUrlValue(value) ? value : { url: String(value) };
  const hasCustomSize = input.size !== undefined || options.size !== undefined;
  const size = input.size ?? options.size ?? DEFAULT_IMAGE_SIZE;
  assertPositiveSize(size);

  return {
    url: input.url,
    alt: input.alt ?? options.alt,
    size,
    fit: input.fit ?? options.fit ?? "contain",
    hasCustomSize,
  };
}

export function imageUrlHeightToPoints(image: ResolvedImageUrlValue) {
  return image.size.height * POINTS_PER_PIXEL;
}

export function imageUrlWidthToColumnWidth(image: ResolvedImageUrlValue) {
  return Math.ceil(image.size.width / COLUMN_WIDTH_PIXELS);
}

export function writeImageFormula(image: ResolvedImageUrlValue) {
  const args = [quoteFormulaString(image.url)];

  if (image.alt !== undefined || image.fit !== "contain" || image.hasCustomSize) {
    args.push(quoteFormulaString(image.alt ?? ""));
  }

  if (image.hasCustomSize) {
    args.push("3", String(image.size.height), String(image.size.width));
  } else if (image.fit !== "contain") {
    args.push(String(imageFitToFormulaSizing(image.fit)));
  }

  return `IMAGE(${args.join(",")})`;
}

function isImageValue(value: ImageSourceValue): value is ImageValue {
  return (
    typeof value === "object" && value !== null && "data" in value && !isArrayBufferLike(value)
  );
}

function isImageUrlValue(value: ImageUrlSourceValue): value is ImageUrlValue {
  return typeof value === "object" && value !== null && "url" in value;
}

function toUint8Array(data: ImageData) {
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

function inferImageMediaType(data: Uint8Array): ImageMediaType | undefined {
  if (
    data.length >= 8 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47 &&
    data[4] === 0x0d &&
    data[5] === 0x0a &&
    data[6] === 0x1a &&
    data[7] === 0x0a
  ) {
    return "image/png";
  }

  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return "image/jpeg";
  }

  return undefined;
}

function normalizeImagePadding(padding: number | ImagePadding | undefined): ImagePadding {
  if (typeof padding === "number") {
    assertNonNegativeFiniteNumber(padding, "Image column padding");
    return { x: padding, y: padding };
  }

  const normalized = {
    x: padding?.x ?? 0,
    y: padding?.y ?? 0,
  };

  assertNonNegativeFiniteNumber(normalized.x, "Image column horizontal padding");
  assertNonNegativeFiniteNumber(normalized.y, "Image column vertical padding");

  return normalized;
}

function assertPositiveSize(size: { width: number; height: number }) {
  if (!Number.isFinite(size.width) || !Number.isFinite(size.height)) {
    throw new Error("Image column size must use finite width and height values.");
  }

  if (size.width <= 0 || size.height <= 0) {
    throw new Error("Image column size must use positive width and height values.");
  }
}

function assertNonNegativeFiniteNumber(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite value.`);
  }
}

function isArrayBufferLike(value: object): value is ArrayBuffer {
  return value instanceof ArrayBuffer;
}

function imageFitToFormulaSizing(fit: NonNullable<ImageColumnOptions["fit"]>) {
  return fit === "contain" ? 0 : 1;
}

function quoteFormulaString(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
