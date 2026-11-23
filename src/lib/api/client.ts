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
import { locationChangeCalls, removeFromShelfCalls, type ApiCall } from "./payloads";
import { MODE } from "../mode";
import { boxTagStore } from "./box-tag-store";
import { liveScanPower } from "./live";
import { mockScanPower } from "./mock";

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

  async shipBoxTag(id: string, shipment: AzShipment) {
    const tag = await boxTagStore.get(id);
    if (!tag) throw new Error(`Box ${id} was not found`);
    if (tag.status === "shipped") throw new Error(`Box ${id} is already in a shipment`);
    if (tag.status === "unpacked") throw new Error(`Box ${id} was unpacked`);
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

  /** Marks the box Unpacked. Nothing is sent to ScanPower: its units stay counted where they are. */
  async unpackBoxTag(id: string, locationName?: string) {
    const tag = await boxTagStore.get(id);
    if (!tag) throw new Error(`Box ${id} was not found`);
    if (tag.status === "shipped") throw new Error(`Box ${id} is in a shipment and can’t be unpacked here`);
    if (tag.status === "unpacked") throw new Error(`Box ${id} was already unpacked`);
    const note = locationName ? `Unpacked at ${locationName}. Its units stay counted there` : "Unpacked before it was put away";
    return boxTagStore.unpack(id, note);
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
