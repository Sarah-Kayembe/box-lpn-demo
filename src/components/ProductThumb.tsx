/* eslint-disable @next/next/no-img-element -- product images come from ScanPower's CDN in live mode */

/** Small square product image, with the first letters of the title when there's no image. */
export function ProductThumb({ src, title, size = 48 }: { src?: string | null; title: string; size?: number }) {
  const style = { width: size, height: size };
  if (src) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        style={style}
        className="shrink-0 rounded-[4px] border border-line bg-white object-contain"
      />
    );
  }
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
