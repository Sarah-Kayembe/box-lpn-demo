import type { AzShipment, BoxTag, InventoryItem, Location, NewBoxTag, PackTemplate } from "../types";
import { boxTagStore } from "./box-tag-store";
import { liveScanPower } from "./live";
import { mockScanPower } from "./mock";

/** The ScanPower calls BoxTag needs. Mock and live both implement this. */
export interface ScanPowerSource {
  listInventory(search?: string): Promise<InventoryItem[]>;
  listLocations(): Promise<Location[]>;
  listPackTemplates(): Promise<PackTemplate[]>;
  listOpenShipments(): Promise<AzShipment[]>;
  /** Creates the shipment box and its items. Returns the new box_id. */
  addBoxToShipment(tag: BoxTag, shipment: AzShipment): Promise<string>;
}

export const MODE: "mock" | "live" =
  process.env.NEXT_PUBLIC_BOXTAG_MODE === "live" ? "live" : "mock";

const source: ScanPowerSource = MODE === "live" ? liveScanPower : mockScanPower;

/** Everything the screens call goes through here. */
export const api = {
  mode: MODE,
  ...bind(source),

  listBoxTags: () => boxTagStore.list(),
  getBoxTag: (id: string) => boxTagStore.get(id),
  createBoxTag: (input: NewBoxTag) => boxTagStore.create(input),
  putAway: (id: string, location: Location) => boxTagStore.putAway(id, location),
  markLabelPrinted: (id: string) => boxTagStore.markLabelPrinted(id),

  async shipBoxTag(id: string, shipment: AzShipment) {
    const tag = await boxTagStore.get(id);
    if (!tag) throw new Error(`Box ${id} was not found`);
    if (tag.status === "shipped") throw new Error(`Box ${id} is already in a shipment`);
    const boxId = await source.addBoxToShipment(tag, shipment);
    return boxTagStore.markShipped(id, shipment, boxId);
  },

  resetDemo: () => boxTagStore.reset(),
};

function bind(s: ScanPowerSource): ScanPowerSource {
  return {
    listInventory: s.listInventory.bind(s),
    listLocations: s.listLocations.bind(s),
    listPackTemplates: s.listPackTemplates.bind(s),
    listOpenShipments: s.listOpenShipments.bind(s),
    addBoxToShipment: s.addBoxToShipment.bind(s),
  };
}
