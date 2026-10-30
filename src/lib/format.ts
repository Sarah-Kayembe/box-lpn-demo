import type { BoxTag } from "./types";

export const totalUnits = (tag: Pick<BoxTag, "items">) =>
  tag.items.reduce((sum, i) => sum + i.quantity, 0);

export function formatDate(iso: string | null, withTime = false) {
  if (!iso) return "";
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

export function formatDims(tag: Pick<BoxTag, "length" | "width" | "height" | "unit_of_measurement">) {
  if (!tag.length || !tag.width || !tag.height) return "Size not set";
  return `${tag.length} × ${tag.width} × ${tag.height} ${tag.unit_of_measurement.toLowerCase()}`;
}

/** Earliest expiration date in the box, if any item has one. */
export function earliestExpiry(tag: Pick<BoxTag, "items">) {
  const dates = tag.items.map((i) => i.expires).filter(Boolean) as string[];
  return dates.sort()[0] ?? null;
}
