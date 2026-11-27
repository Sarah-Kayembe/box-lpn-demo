import type {
  AzShipment,
  BoxTag,
  InventoryItem,
  Location,
  NewBoxTag,
  PackTemplate,
  PackTemplateItem,
  LocationItem,
  ItemLocation,
  NewPackTemplate,
} from "../types";
import { locationChangeCalls, moveCalls, removeFromShelfCalls, type ApiCall } from "./payloads";
import { MODE } from "../mode";
import { boxTagStore } from "./box-tag-store";
import { liveScanPower } from "./live";
import { mockScanPower } from "./mock";

/** What happens to a box's items when it's unpacked. */
export type UnpackPlan = { kind: "stay" } | { kind: "move"; to: Location } | { kind: "remove" };

/** The ScanPower calls BoxTag needs. Mock and live both implement this. */
export interface ScanPowerSource {
  listInventory(search?: string): Promise<InventoryItem[]>;
  listLocations(): Promise<Location[]>;
  /** All pack templates, each with its SKUs and quantities. */
  listPackTemplates(): Promise<PackTemplate[]>;
  listPackTemplateItems(packTemplateId: string): Promise<PackTemplateItem[]>;
  /** Creates one pack template with its SKUs and returns it. */
  createPackTemplate(template: NewPackTemplate): Promise<PackTemplate>;
  listOpenShipments(): Promise<AzShipment[]>;
  /** What ScanPower has at one location, per SKU. */
  listLocationItems(locationId: string): Promise<LocationItem[]>;
  /** Every SKU at every location, or only the given SKU's locations. */
  listItemLocations(sku?: string): Promise<ItemLocation[]>;
  /** Sends location updates one by one, in order. */
  sendLocationCalls(calls: ApiCall[]): Promise<void>;
  /** Creates the shipment box and its items. Returns the new box_id. */
  addBoxToShipment(tag: BoxTag, shipment: AzShipment): Promise<string>;
}

const source: ScanPowerSource = MODE === "live" ? liveScanPower : mockScanPower;

/** Everything the screens call goes through here. */
export const api = {
  mode: MODE,
  ...bind(source),

  listBoxTags: () => boxTagStore.list(),
  getBoxTag: (id: string) => boxTagStore.get(id),
  createBoxTag: (input: NewBoxTag) => boxTagStore.create(input),
  /** Puts a box on a shelf (or moves it) and updates ScanPower's location inventory for every SKU in it. */
  async putAway(id: string, location: Location) {
    const tag = await boxTagStore.get(id);
    if (!tag) throw new Error(`Box ${id} was not found`);
    if (tag.status === "shipped") throw new Error(`Box ${id} is already in a shipment`);
    if (tag.status === "unpacked") throw new Error(`Box ${id} was unpacked`);
    await source.sendLocationCalls(locationChangeCalls(tag, location.location_id));
    return boxTagStore.putAway(id, location);
  },
  markLabelPrinted: (id: string) => boxTagStore.markLabelPrinted(id),
  setBoxSize: (id: string, size: { length: number; width: number; height: number; weight: number }) =>
    boxTagStore.setSize(id, size),

  async shipBoxTag(id: string, shipment: AzShipment) {
    const tag = await boxTagStore.get(id);
    if (!tag) throw new Error(`Box ${id} was not found`);
    if (tag.status === "shipped") throw new Error(`Box ${id} is already in a shipment`);
    if (tag.status === "unpacked") throw new Error(`Box ${id} was unpacked`);
    if (!tag.length || !tag.width || !tag.height || !tag.weight) {
      throw new Error("Amazon needs the box size and weight before it can ship.");
    }
    const boxId = await source.addBoxToShipment(tag, shipment);

    // The box is in the shipment now, so a failed location update must not hide that
    let problem: string | undefined;
    if (tag.location_id) {
      try {
        await source.sendLocationCalls(removeFromShelfCalls(tag, tag.location_id));
      } catch (e) {
        problem = e instanceof Error ? e.message : "ScanPower’s location count was not updated.";
      }
    }
    const box = await boxTagStore.markShipped(id, shipment, boxId, problem);
    return { box, problem };
  },

  /**
   * Marks the box Unpacked and, for a box at a location, updates ScanPower to
   * match where its items went: left there, moved to another location, or
   * taken out of stock. If ScanPower refuses, the box stays as it was.
   */
  async unpackBoxTag(id: string, plan: UnpackPlan, fromName?: string) {
    const tag = await boxTagStore.get(id);
    if (!tag) throw new Error(`Box ${id} was not found`);
    if (tag.status === "shipped") throw new Error(`Box ${id} is in a shipment and can’t be unpacked here`);
    if (tag.status === "unpacked") throw new Error(`Box ${id} was already unpacked`);

    if (!tag.location_id) return boxTagStore.unpack(id, "Unpacked before it was put away");
    const from = fromName ?? "its location";
    if (plan.kind === "move") {
      await source.sendLocationCalls(moveCalls(tag, tag.location_id, plan.to.location_id));
      return boxTagStore.unpack(id, `Unpacked. It was at ${from}, and its items were moved to ${plan.to.location_name}`);
    }
    if (plan.kind === "remove") {
      await source.sendLocationCalls(removeFromShelfCalls(tag, tag.location_id));
      return boxTagStore.unpack(id, `Unpacked. It was at ${from}, and its items were taken out of stock`);
    }
    return boxTagStore.unpack(id, `Unpacked. It was at ${from}, and its items stay counted there`);
  },

  async resetDemo() {
    try {
      localStorage.removeItem("boxtag.location-items.v2.mock");
      localStorage.removeItem("boxtag.pack-templates.v1.mock");
    } catch {
      /* storage unavailable */
    }
    return boxTagStore.reset();
  },
};

function bind(s: ScanPowerSource): ScanPowerSource {
  return {
    listInventory: s.listInventory.bind(s),
    listLocations: s.listLocations.bind(s),
    listPackTemplates: s.listPackTemplates.bind(s),
    listPackTemplateItems: s.listPackTemplateItems.bind(s),
    createPackTemplate: s.createPackTemplate.bind(s),
    listOpenShipments: s.listOpenShipments.bind(s),
    listLocationItems: s.listLocationItems.bind(s),
    listItemLocations: s.listItemLocations.bind(s),
    sendLocationCalls: s.sendLocationCalls.bind(s),
    addBoxToShipment: s.addBoxToShipment.bind(s),
  };
}
