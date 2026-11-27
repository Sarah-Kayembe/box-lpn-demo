/*
 * Box size and weight checks. Amazon needs every box's size and weight when a
 * shipment is created, so BoxTag asks for them at shipping time if they were
 * skipped when packing, and warns about boxes Amazon handles differently.
 */

/** Over this, Amazon needs "Team Lift" labels on the box. */
export const AMAZON_TEAM_LIFT_LB = 50;
/** Over this on any side, Amazon may charge extra or review the box, unless the product itself is that big. */
export const AMAZON_MAX_SIDE_IN = 25;

export interface BoxSize {
  length: number | null;
  width: number | null;
  height: number | null;
  weight: number | null;
}

/** What's still missing before the box can ship: "size", "weight", both or neither. */
export function missingForShipping(box: BoxSize) {
  const missing: string[] = [];
  if (!box.length || !box.width || !box.height) missing.push("size");
  if (!box.weight) missing.push("weight");
  return missing;
}

export function sizeWarnings(box: BoxSize) {
  const warnings: string[] = [];
  if (box.weight && box.weight > AMAZON_TEAM_LIFT_LB) {
    warnings.push(`Over ${AMAZON_TEAM_LIFT_LB} lb: Amazon needs “Team Lift” labels on this box.`);
  }
  if ([box.length, box.width, box.height].some((n) => n && n > AMAZON_MAX_SIDE_IN)) {
    warnings.push(
      `A side is over ${AMAZON_MAX_SIDE_IN} in: Amazon may charge extra or review the box, unless the product itself is that big.`,
    );
  }
  return warnings;
}
