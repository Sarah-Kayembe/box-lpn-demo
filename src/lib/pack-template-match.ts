import type { PackTemplate } from "./types";

/*
 * Checks a packed box against the account's pack templates.
 * A template matches when the box size, weight, SKUs and quantities all line up.
 */

/** How far the box weight can be from the template weight and still match, in pounds. */
export const WEIGHT_TOLERANCE_LB = 0.5;

export interface PackedBox {
  length: number | null;
  width: number | null;
  height: number | null;
  weight: number | null;
  items: { sku: string; quantity: number }[];
}

export type MatchResult =
  | { kind: "empty" }
  | { kind: "incomplete"; missing: string[] }
  | { kind: "match"; template: PackTemplate }
  | { kind: "none" };

/** The same three numbers in any order, so 18 × 14 × 12 and 14 × 18 × 12 are the same box. */
function sameSize(a: number[], b: number[]) {
  const x = [...a].sort((m, n) => m - n);
  const y = [...b].sort((m, n) => m - n);
  return x.every((v, i) => Math.abs(v - y[i]) < 0.01);
}

/** The same SKUs with the same quantities, in any order. */
function sameItems(a: { sku: string; quantity: number }[], b: { sku: string; quantity: number }[]) {
  const count = (list: typeof a) => {
    const m = new Map<string, number>();
    for (const i of list) m.set(i.sku, (m.get(i.sku) ?? 0) + i.quantity);
    return m;
  };
  const x = count(a);
  const y = count(b);
  return x.size === y.size && [...x].every(([sku, qty]) => y.get(sku) === qty);
}

export function matchPackTemplate(box: PackedBox, templates: PackTemplate[]): MatchResult {
  if (!box.items.length) return { kind: "empty" };

  const missing: string[] = [];
  if (!box.length || !box.width || !box.height) missing.push("box size");
  if (!box.weight) missing.push("weight");
  if (missing.length) return { kind: "incomplete", missing };

  const size = [box.length!, box.width!, box.height!];
  const template = templates.find(
    (t) =>
      (t.items?.length ?? 0) > 0 &&
      t.unit_of_measurement === "IN" &&
      sameSize(size, [t.length, t.width, t.height]) &&
      t.weight != null &&
      Math.abs(t.weight - box.weight!) <= WEIGHT_TOLERANCE_LB &&
      sameItems(box.items, t.items!),
  );
  return template ? { kind: "match", template } : { kind: "none" };
}
