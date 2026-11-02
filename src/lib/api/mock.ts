import { inventory, locations, packTemplates, shipments } from "../mock-data";
import type { ScanPowerSource } from "./client";

const pause = (ms = 150) => new Promise((r) => setTimeout(r, ms));
let nextBoxId = 5001;

/** Sample data with the same shapes as the ScanPower v3 API. */
export const mockScanPower: ScanPowerSource = {
  async listInventory(search = "") {
    await pause();
    const q = search.trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter((i) =>
      [i.sku, i.fnsku ?? "", i.product.title].some((v) => v.toLowerCase().includes(q)),
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

  async listOpenShipments() {
    await pause();
    return shipments.filter((s) => s.status === "WORKING");
  },

  async addBoxToShipment(_tag, shipment) {
    await pause(400);
    shipment.box_count += 1;
    return String(nextBoxId++);
  },
};
