import { earliestExpiry } from "./format";
import type { BoxTag } from "./types";

/*
 * Expiry checks for boxes that are still in the warehouse.
 * Amazon wants more than 90 days of shelf life left when stock arrives, and
 * disposes of items within 50 days of expiring, so:
 *   expired   past the date
 *   tooClose  under 90 days left: don't send to Amazon
 *   soon      under 120 days left: ship these first
 */

export const TOO_CLOSE_DAYS = 90;
export const SOON_DAYS = 120;

export type ExpiryLevel = "expired" | "tooClose" | "soon";

export interface ExpiryAlert {
  box: BoxTag;
  date: string;
  daysLeft: number;
  level: ExpiryLevel;
}

/** Whole days from today to an ISO date (YYYY-MM-DD), negative once it has passed. */
export function daysUntil(date: string, today = new Date()) {
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = date.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - start) / 86_400_000);
}

export function expiryLevel(daysLeft: number): ExpiryLevel | null {
  if (daysLeft < 0) return "expired";
  if (daysLeft < TOO_CLOSE_DAYS) return "tooClose";
  if (daysLeft < SOON_DAYS) return "soon";
  return null;
}

/** The alert for one box, if its earliest date is close. Shipped and unpacked boxes are left out. */
export function expiryAlert(box: BoxTag, today = new Date()): ExpiryAlert | null {
  if (box.status !== "packed" && box.status !== "stored") return null;
  const date = earliestExpiry(box);
  if (!date) return null;
  const daysLeft = daysUntil(date, today);
  const level = expiryLevel(daysLeft);
  return level ? { box, date, daysLeft, level } : null;
}

export function expiryAlerts(boxes: BoxTag[], today = new Date()) {
  return boxes
    .map((b) => expiryAlert(b, today))
    .filter((a): a is ExpiryAlert => a !== null)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export function daysText(daysLeft: number) {
  if (daysLeft < 0) return `Expired ${-daysLeft} ${daysLeft === -1 ? "day" : "days"} ago`;
  if (daysLeft === 0) return "Expires today";
  return `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`;
}
