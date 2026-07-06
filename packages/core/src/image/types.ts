export type ImageMediaType = "image/png" | "image/jpeg";
export type ImageFit = "contain" | "cover" | "stretch";
export type ImageColumnSource = "embed" | "url";

export interface ImageSize {
  width: number;
  height: number;
}

export interface ImagePadding {
  x?: number;
  y?: number;
}

export type ImageData = Uint8Array | ArrayBuffer;

export interface ImageValue {
  data: ImageData;
  mediaType?: ImageMediaType;
  alt?: string;
  size?: ImageSize;
  fit?: ImageFit;
  padding?: number | ImagePadding;
}

export type ImageSourceValue = ImageData | ImageValue | null | undefined;

export interface ImageUrlValue {
  url: string;
  alt?: string;
  size?: ImageSize;
  fit?: ImageFit;
}

export type ImageUrlSourceValue = string | ImageUrlValue | null | undefined;

export interface ResolvedImageValue {
  data: Uint8Array;
  mediaType: ImageMediaType;
  alt?: string;
  size: ImageSize;
  fit: ImageFit;
  padding: ImagePadding;
}

export interface ResolvedImageUrlValue {
  url: string;
  alt?: string;
  size: ImageSize;
  fit: ImageFit;
  hasCustomSize: boolean;
}

export interface ImageColumnOptions {
  source?: ImageColumnSource;
  mediaType?: ImageMediaType;
  alt?: string;
  size?: ImageSize;
  fit?: ImageFit;
  padding?: number | ImagePadding;
}

export const DEFAULT_IMAGE_SIZE: ImageSize = {
  width: 64,
  height: 64,
};
