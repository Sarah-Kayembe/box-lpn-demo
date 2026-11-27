/*
 * Box size and weight checks. Amazon needs every box's size and weight when a
 * shipment is created, so BoxTag asks for them at shipping time if they were
 * skipped when packing.
 *
 * Amazon's limits: a box may weigh up to 50 lb and measure up to 25 in on a
 * side, unless it holds a single item that is itself heavier or bigger (then
 * it needs "Team Lift" labels or may cost extra). Boxes that break the limits,
 * or numbers too big to be real, stop the box from being sealed or shipped.
 */

export const AMAZON_MAX_LB = 50;
export const AMAZON_MAX_SIDE_IN = 25;
/** Beyond these, the numbers are almost certainly a typo. */
export const SANE_MAX_SIDE_IN = 100;
export const SANE_MAX_LB = 150;

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

const longestSide = (box: BoxSize) => Math.max(box.length ?? 0, box.width ?? 0, box.height ?? 0);

/** Numbers too big to be real, for any box or saved size. */
export function typoProblems(box: BoxSize) {
  const problems: string[] = [];
  const side = longestSide(box);
  if (side > SANE_MAX_SIDE_IN) {
    problems.push(`Check the measurements: ${side} in is about ${Math.round(side / 12)} feet.`);
  }
  if (box.weight && box.weight > SANE_MAX_LB) {
    problems.push(`Check the weight: ${box.weight} lb is more than a box can hold.`);
  }
  return problems;
}

/** Problems that stop a box from being sealed or shipped. */
export function sizeProblems(box: BoxSize, units: number) {
  const problems = typoProblems(box);
  if (problems.length) return problems;
  if (units > 1 && box.weight && box.weight > AMAZON_MAX_LB) {
    problems.push(
      `Over ${AMAZON_MAX_LB} lb with ${units} units. Amazon only allows that for a single heavy item. Split it into two boxes or take units out.`,
    );
  }
  if (units > 1 && longestSide(box) > AMAZON_MAX_SIDE_IN) {
    problems.push(
      `A side is over ${AMAZON_MAX_SIDE_IN} in with ${units} units. Amazon only allows that for a single big item. Use a smaller box.`,
    );
  }
  return problems;
}

/** Things to know that don't stop the box: a single heavy or big item. */
export function sizeWarnings(box: BoxSize, units: number) {
  if (units !== 1 || typoProblems(box).length) return [];
  const warnings: string[] = [];
  if (box.weight && box.weight > AMAZON_MAX_LB) {
    warnings.push(`Over ${AMAZON_MAX_LB} lb: put “Team Lift” labels on this box.`);
  }
  if (longestSide(box) > AMAZON_MAX_SIDE_IN) {
    warnings.push(`A side is over ${AMAZON_MAX_SIDE_IN} in: Amazon may charge extra for this box.`);
  }
  return warnings;
}
