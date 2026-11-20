import type { AzShipment, InventoryItem, Location, LocationItem, PackTemplate, PackTemplateItem } from "../types";
import type { ScanPowerSource } from "./client";
import { inventorySearches, looksLikeFnsku, toInventoryItem, type RawInventoryItem } from "./scanpower-inventory";
import { createPackTemplateBody, insertAzBoxBody, mergeAzBoxItemsBody } from "./payloads";

/*
 * Talks to the real ScanPower API through this app's own /api/scanpower
 * route, which keeps the credentials on the server. Written from the v3
 * OpenAPI document.
 */

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/scanpower${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.errors?.length) {
    const message = body?.errors?.[0]?.message ?? `ScanPower returned ${res.status}`;
    throw new Error(message);
  }
  return body as T;
}

const SHIP_FROM_ID = process.env.NEXT_PUBLIC_SCANPOWER_SHIP_FROM_ID ?? "";

export const liveScanPower: ScanPowerSource = {
  async listInventory(search = "") {
    type Reply = { inventory: { sku: string; items: RawInventoryItem[] }[] };
    const fetchRows = async (params: URLSearchParams) =>
      (await call<Reply>(`/v3/inventory?${params}`)).inventory.flatMap((row) => row.items.slice(0, 1));

    // ScanPower searches one field at a time, so run the likely ones together and merge
    const results = await Promise.all(inventorySearches(search).map((p) => fetchRows(p).catch(() => [])));
    const bySku = new Map<string, InventoryItem>();
    for (const raw of results.flat()) if (!bySku.has(raw.sku)) bySku.set(raw.sku, toInventoryItem(raw));

    // An FNSKU can't be searched by field, so look for it in the unfiltered list
    if (!bySku.size && looksLikeFnsku(search)) {
      const all = await fetchRows(new URLSearchParams({ limit: "500" }));
      const wanted = search.trim().toUpperCase();
      for (const raw of all) if (raw.fnsku?.toUpperCase() === wanted) bySku.set(raw.sku, toInventoryItem(raw));
    }
    return [...bySku.values()];
  },

  async listLocations() {
    const params = new URLSearchParams({ limit: "200" });
    if (SHIP_FROM_ID) params.set("ship_from_id", SHIP_FROM_ID);
    const data = await call<{ locations: Location[] }>(`/v3/location?${params}`);
    return data.locations;
  },

  /** One call loads every template with its SKUs, so boxes can be matched as they're packed. */
  async listPackTemplates() {
    type Row = Omit<PackTemplate, "items"> & {
      deleted?: string | null;
      items?: (PackTemplateItem & { deleted?: string | null })[] | null;
    };
    const data = await call<{ pack_templates: Row[] }>(`/v3/pack-template?limit=500&with_items=true`);
    return data.pack_templates
      .filter((t) => !t.deleted)
      .map((t) => ({
        ...t,
        items: (t.items ?? []).filter((i) => !i.deleted).map(({ sku, quantity }) => ({ sku, quantity })),
      }));
  },

  async createPackTemplate(input) {
    const data = await call<{ pack_templates: PackTemplate[] }>(`/v3/pack-template`, {
      method: "POST",
      body: JSON.stringify(createPackTemplateBody(input)),
    });
    return data.pack_templates[0];
  },

  async listPackTemplateItems(packTemplateId) {
    const data = await call<{ pack_template_items: PackTemplateItem[] }>(
      `/v3/pack-template/${encodeURIComponent(packTemplateId)}/items?limit=200`,
    );
    return data.pack_template_items.filter((i) => !(i as { deleted?: string | null }).deleted);
  },

  async listOpenShipments() {
    const params = new URLSearchParams({ limit: "50" });
    if (SHIP_FROM_ID) params.set("ship_from_id", SHIP_FROM_ID);
    const data = await call<{ az_shipments: AzShipment[] }>(`/v3/az-shipment?${params}`);
    return data.az_shipments
      .filter((s) => s.status === "WORKING")
      .map((s) => ({ ...s, box_count: s.box_count ?? 0 }));
  },

  async listLocationItems(locationId) {
    const data = await call<{ item_locations: LocationItem[] }>(
      `/v3/location/${encodeURIComponent(locationId)}/items?limit=200`,
    );
    const bySku = new Map<string, number>();
    for (const row of data.item_locations) bySku.set(row.sku, (bySku.get(row.sku) ?? 0) + (row.fulfillable ?? 0));
    return [...bySku].map(([sku, fulfillable]) => ({ sku, fulfillable }));
  },

  /** One request per SKU, sent in order, as ScanPower's location endpoints expect. */
  async sendLocationCalls(calls) {
    for (const c of calls) {
      await call(c.path, { method: c.method, body: JSON.stringify(c.body) });
    }
  },

  async addBoxToShipment(tag, shipment) {
    const created = await call<{ boxes: { box_id: string }[] }>(`/v3/az-box`, {
      method: "POST",
      body: JSON.stringify(insertAzBoxBody(tag, shipment)),
    });
    const boxId = created.boxes[0].box_id;
    await call(`/v3/az-box/items`, {
      method: "PATCH",
      body: JSON.stringify(mergeAzBoxItemsBody(tag, boxId)),
    });
    return boxId;
  },
};
