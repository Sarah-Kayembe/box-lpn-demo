"use client";

import { toSVG } from "bwip-js/browser";
import { useMemo } from "react";

type Props = {
  /** "code128" for warehouse scanners, "qrcode" for phones */
  type: "code128" | "qrcode";
  value: string;
  className?: string;
  /** Bar height in millimeters (Code 128 only) */
  height?: number;
};

/** Renders a barcode as inline SVG so it prints sharp at any size. */
export function Barcode({ type, value, className, height = 18 }: Props) {
  const svg = useMemo(() => {
    try {
      return toSVG(
        type === "code128"
          ? { bcid: "code128", text: value, scale: 3, height, includetext: false }
          : { bcid: "qrcode", text: value, scale: 3 },
      );
    } catch {
      return null;
    }
  }, [type, value, height]);

  if (!svg) return <p className="text-xs text-red-brand">Could not draw barcode for {value}</p>;

  return (
    <div
      className={`[&>svg]:h-full [&>svg]:w-full ${className ?? ""}`}
      role="img"
      aria-label={`${type === "qrcode" ? "QR code" : "Barcode"} for ${value}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
