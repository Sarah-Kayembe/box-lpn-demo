import type { AzShipment, InventoryItem, Location, PackTemplate } from "../types";
import type { ScanPowerSource } from "./client";
import { insertAzBoxBody, mergeAzBoxItemsBody } from "./payloads";

/*
 * Talks to the real ScanPower API through this app's own /api/scanpower
 * route, which keeps the credentials on the server. Written from the v3
 * OpenAPI document and not yet tested against a real account.
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
    const params = new URLSearchParams({ limit: "100", with_data: "true" });
    if (search) params.set("search", search);
    const data = await call<{ inventory: { sku: string; items: InventoryItem[] }[] }>(
      `/v3/inventory?${params}`,
    );
    return data.inventory.flatMap((row) => row.items.slice(0, 1));
  },

  async listLocations() {
    const params = new URLSearchParams({ limit: "200" });
    if (SHIP_FROM_ID) params.set("ship_from_id", SHIP_FROM_ID);
    const data = await call<{ locations: Location[] }>(`/v3/location?${params}`);
    return data.locations;
  },

  async listPackTemplates() {
    const data = await call<{ pack_templates: PackTemplate[] }>(`/v3/pack-template?limit=100`);
    return data.pack_templates;
  },

  async listOpenShipments() {
    const params = new URLSearchParams({ limit: "50" });
    if (SHIP_FROM_ID) params.set("ship_from_id", SHIP_FROM_ID);
    const data = await call<{ az_shipments: AzShipment[] }>(`/v3/az-shipment?${params}`);
    return data.az_shipments
      .filter((s) => s.status === "WORKING")
      .map((s) => ({ ...s, box_count: s.box_count ?? 0 }));
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
