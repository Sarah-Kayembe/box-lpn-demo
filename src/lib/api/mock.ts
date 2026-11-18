import { inventory, locations, packTemplateItems, packTemplates, seedBoxTags, shipments } from "../mock-data";
import type { ScanPowerSource } from "./client";
import type { ApiCall } from "./payloads";

/*
 * Demo stand-in for ScanPower's location inventory: shelf -> SKU -> units.
 * Saved in the browser and started from the starter boxes already on shelves.
 */
type Shelves = Record<string, Record<string, number>>;
const SHELVES_KEY = "boxtag.location-items.v2.mock";

function readShelves(): Shelves {
  try {
    const raw = localStorage.getItem(SHELVES_KEY);
    if (raw) return JSON.parse(raw) as Shelves;
  } catch {
    /* fall through to the starting state */
  }
  const shelves: Shelves = {};
  for (const box of seedBoxTags()) {
    if (!box.location_id) continue;
    const shelf = (shelves[box.location_id] ??= {});
    for (const i of box.items) shelf[i.sku] = (shelf[i.sku] ?? 0) + i.quantity;
  }
  return shelves;
}

function writeShelves(shelves: Shelves) {
  try {
    localStorage.setItem(SHELVES_KEY, JSON.stringify(shelves));
  } catch {
    /* storage unavailable */
  }
}

function addUnits(shelves: Shelves, locationId: string, sku: string, units: number) {
  const shelf = (shelves[locationId] ??= {});
  shelf[sku] = Math.max(0, (shelf[sku] ?? 0) + units);
  if (!shelf[sku]) delete shelf[sku];
}

/** Applies a call the same way ScanPower would. */
function apply(shelves: Shelves, call: ApiCall) {
  const body = call.body as {
    update_items?: { sku: string; fulfillable: number }[];
    transfer?: { sku: string; from_location_id: string; to_location_id: string; fulfillable: number }[];
  };
  const at = call.path.match(/^\/v3\/location\/([^/]+)\/items$/);
  if (at && body.update_items) for (const u of body.update_items) addUnits(shelves, at[1], u.sku, u.fulfillable);
  if (body.transfer) {
    for (const t of body.transfer) {
      addUnits(shelves, t.from_location_id, t.sku, -t.fulfillable);
      addUnits(shelves, t.to_location_id, t.sku, t.fulfillable);
    }
  }
}

const pause = (ms = 150) => new Promise((r) => setTimeout(r, ms));
let nextBoxId = 5001;

/** Sample data with the same shapes as the ScanPower v3 API. */
export const mockScanPower: ScanPowerSource = {
  async listInventory(search = "") {
    await pause();
    const q = search.trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter((i) =>
      [i.sku, i.fnsku ?? "", i.product.upc ?? "", i.product.title].some((v) => v.toLowerCase().includes(q)),
    );
  },

  async listLocations() {
    await pause();
    return locations;
  },

  async listPackTemplates() {
    await pause();
    return packTemplates;
  },

  async listPackTemplateItems(packTemplateId) {
    await pause();
    return packTemplateItems.filter((i) => i.pack_template_id === packTemplateId);
  },

  async listOpenShipments() {
    await pause();
    return shipments.filter((s) => s.status === "WORKING");
  },

  async listLocationItems(locationId) {
    await pause();
    const shelf = readShelves()[locationId] ?? {};
    return Object.entries(shelf).map(([sku, fulfillable]) => ({ sku, fulfillable }));
  },

  async sendLocationCalls(calls) {
    const shelves = readShelves();
    for (const call of calls) {
      await pause(60);
      apply(shelves, call);
    }
    writeShelves(shelves);
  },

  async addBoxToShipment(_tag, shipment) {
    await pause(400);
    shipment.box_count += 1;
    return String(nextBoxId++);
  },
};
