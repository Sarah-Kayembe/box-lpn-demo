import { seedBoxTags } from "../mock-data";
import type { AzShipment, BoxTag, Location, NewBoxTag } from "../types";

/*
 * Stores BoxTag records in the browser so the demo keeps its state between
 * visits. In production this would be a ScanPower endpoint such as
 * /v3/box-tag (see README).
 */

const KEY = "boxtag.boxes.v1";

function read(): BoxTag[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as BoxTag[];
  } catch {
    /* storage unavailable or corrupted, fall back to seed data */
  }
  const seeded = seedBoxTags();
  write(seeded);
  return seeded;
}

function write(boxes: BoxTag[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(boxes));
  } catch {
    /* private mode or storage full, keep working in memory */
    memory = boxes;
  }
}

let memory: BoxTag[] | null = null;
const all = () => memory ?? read();

function update(id: string, change: (b: BoxTag) => BoxTag): BoxTag {
  const boxes = all();
  const index = boxes.findIndex((b) => b.box_tag_id === id);
  if (index === -1) throw new Error(`Box ${id} was not found`);
  boxes[index] = change(boxes[index]);
  write(boxes);
  return boxes[index];
}

function nextId(boxes: BoxTag[]) {
  const max = boxes.reduce((m, b) => Math.max(m, Number(b.box_tag_id.slice(3)) || 0), 100);
  return `BT-${String(max + 1).padStart(6, "0")}`;
}

/** Accepts "BT-000101", "bt000101", "101" and similar scanner or typed input. */
export function normalizeBoxTagId(input: string): string {
  const digits = input.trim().toUpperCase().replace(/^BT-?/, "").replace(/\D/g, "");
  return digits ? `BT-${digits.padStart(6, "0")}` : input.trim().toUpperCase();
}

const now = () => new Date().toISOString();

export const boxTagStore = {
  async list() {
    return [...all()].sort((a, b) => b.packed_at.localeCompare(a.packed_at));
  },

  async get(id: string) {
    const wanted = normalizeBoxTagId(id);
    return all().find((b) => b.box_tag_id === wanted) ?? null;
  },

  async create(input: NewBoxTag) {
    const boxes = all();
    const units = input.items.reduce((s, i) => s + i.quantity, 0);
    const tag: BoxTag = {
      ...input,
      box_tag_id: nextId(boxes),
      status: "packed",
      location_id: null,
      shipment_id: null,
      packed_at: now(),
      packed_by: "Demo user",
      history: [{ at: now(), type: "packed", note: `Packed ${units} units` }],
    };
    write([...boxes, tag]);
    return tag;
  },

  async putAway(id: string, location: Location) {
    return update(id, (b) => ({
      ...b,
      status: b.status === "shipped" ? b.status : "stored",
      location_id: location.location_id,
      history: [
        ...b.history,
        {
          at: now(),
          type: b.location_id ? "moved" : "stored",
          note: `${b.location_id ? "Moved to" : "Put away at"} ${location.location_name}`,
        },
      ],
    }));
  },

  async markLabelPrinted(id: string) {
    return update(id, (b) => ({
      ...b,
      history: [...b.history, { at: now(), type: "label_printed", note: "Label printed" }],
    }));
  },

  async markShipped(id: string, shipment: AzShipment, boxId: string) {
    return update(id, (b) => ({
      ...b,
      status: "shipped",
      shipment_id: shipment.shipment_id,
      location_id: null,
      history: [
        ...b.history,
        {
          at: now(),
          type: "shipped",
          note: `Added to ${shipment.shipment_id} (${shipment.name}) as box ${boxId}`,
        },
      ],
    }));
  },

  async reset() {
    memory = null;
    write(seedBoxTags());
  },
};
