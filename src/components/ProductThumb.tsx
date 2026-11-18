"use client";
/* eslint-disable @next/next/no-img-element -- product images come from ScanPower's CDN in live mode */

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

/**
 * Small square product image. Clicking it opens a larger view.
 * Shows the first letters of the title when there's no image.
 */
export function ProductThumb({ src, title, size = 48 }: { src?: string | null; title: string; size?: number }) {
  const [open, setOpen] = useState(false);
  const style = { width: size, height: size };

  if (!src) {
    const initials = title
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
    return (
      <span
        style={style}
        aria-hidden="true"
        className="flex shrink-0 items-center justify-center rounded-[4px] border border-line bg-sky-soft text-sm font-bold text-navy-soft"
      >
        {initials}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`See a larger image of ${title}`}
        title="Click to enlarge"
        style={style}
        className="group relative shrink-0 cursor-zoom-in overflow-hidden rounded-[4px] border border-line bg-white transition hover:border-navy focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-brand"
      >
        <img src={src} alt="" loading="lazy" className="h-full w-full object-contain" />
        <span className="absolute right-0.5 bottom-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-navy/80 text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
          <Icon name="plus" size={10} />
        </span>
      </button>
      {open && <ImageViewer src={src} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Full-screen view of one product image. Closes with the X, the Esc key, or a click outside. */
function ImageViewer({ src, title, onClose }: { src: string; title: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-[6px] border border-line bg-white p-4 shadow-[0_20px_60px_rgba(31,40,52,0.35)]"
      >
        <div className="flex items-start gap-3">
          <p className="flex-1 font-bold text-navy">{title}</p>
          <button
            onClick={onClose}
            autoFocus
            aria-label="Close"
            className="-mt-1 -mr-1 rounded-full p-1.5 text-navy-soft transition hover:bg-sky-soft hover:text-navy"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        <img src={src} alt={title} className="mt-3 aspect-square w-full rounded-[4px] bg-sky-wash object-contain" />
      </div>
    </div>
  );
}
