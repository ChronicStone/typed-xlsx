export interface ColorStyle {
  rgb: string;
}

export interface FontStyle {
  name?: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: ColorStyle;
}

export interface BorderSideStyle {
  color?: ColorStyle;
  style?:
    | "thin"
    | "medium"
    | "thick"
    | "dotted"
    | "dashed"
    | "double"
    | "hair"
    | "dashDot"
    | "dashDotDot";
}

export interface BorderStyle {
  top?: BorderSideStyle;
  right?: BorderSideStyle;
  bottom?: BorderSideStyle;
  left?: BorderSideStyle;
}

export interface FillStyle {
  color?: ColorStyle;
}

export interface AlignmentStyle {
  horizontal?: "left" | "center" | "right" | "fill" | "justify";
  vertical?: "top" | "center" | "bottom" | "justify";
  wrapText?: boolean;
  shrinkToFit?: boolean;
  textRotation?: number;
  indent?: number;
  readingOrder?: "ltr" | "rtl" | "context";
}

export interface CellProtectionStyle {
  locked?: boolean;
  hidden?: boolean;
}

export interface CellStyle {
  font?: FontStyle;
  fill?: FillStyle;
  border?: BorderStyle;
  alignment?: AlignmentStyle;
  numFmt?: string;
  protection?: CellProtectionStyle;
}
