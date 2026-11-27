import type { AzShipment, BoxTag, NewPackTemplate } from "../types";

/*
 * Turns a BoxTag into the requests ScanPower already accepts for shipment
 * boxes. Used by the live client and by the "API preview" panel, so what the
 * demo shows is exactly what would be sent.
 */

/** POST /v3/az-box */
export function insertAzBoxBody(tag: BoxTag, shipment: AzShipment) {
  return {
    boxes: [
      {
        shipment_id: shipment.shipment_id,
        plan_id: shipment.plan_id,
        inbound_plan_id: shipment.inbound_plan_id,
        content_information_source: "BOX_CONTENT_PROVIDED",
        quantity: tag.items.reduce((sum, i) => sum + i.quantity, 0),
        length: tag.length,
        width: tag.width,
        height: tag.height,
        unit_of_measurement: tag.unit_of_measurement,
        weight: tag.weight,
        unit_of_weight: tag.unit_of_weight,
        print_box_label_quantity: 1,
      },
    ],
  };
}

/** PATCH /v3/az-box/items, sent once the new box_id comes back */
export function mergeAzBoxItemsBody(tag: BoxTag, boxId: string | number) {
  return {
    items: tag.items.map((i) => ({
      box_id: boxId,
      sku: i.sku,
      fnsku: i.fnsku,
      set_quantity: i.quantity,
      expires: i.expires ? `${i.expires}T00:00:00.000Z` : null,
      manufacturing_lot_code: i.manufacturing_lot_code,
    })),
  };
}

/* ---------- Warehouse locations ---------- */

/** One request to ScanPower, kept as data so it can be shown on screen and sent as is. */
export interface ApiCall {
  method: "PATCH";
  path: string;
  body: unknown;
}

/** Put-away: one PATCH /v3/location/{id}/items per SKU, adding the box's quantity to that shelf. */
export function putAwayCalls(tag: BoxTag, locationId: string): ApiCall[] {
  return tag.items.map((i) => ({
    method: "PATCH",
    path: `/v3/location/${locationId}/items`,
    body: { update_items: [{ sku: i.sku, fulfillable: i.quantity }] },
  }));
}

/** Move: one PATCH /v3/location/transfer per SKU, from the old shelf to the new one. */
export function moveCalls(tag: BoxTag, fromId: string, toId: string): ApiCall[] {
  return tag.items.map((i) => ({
    method: "PATCH",
    path: "/v3/location/transfer",
    body: { transfer: [{ sku: i.sku, from_location_id: fromId, to_location_id: toId, fulfillable: i.quantity }] },
  }));
}

/** Ship: one PATCH /v3/location/{id}/items per SKU, taking the box's quantity off the shelf. */
export function removeFromShelfCalls(tag: BoxTag, locationId: string): ApiCall[] {
  return tag.items.map((i) => ({
    method: "PATCH",
    path: `/v3/location/${locationId}/items`,
    body: { update_items: [{ sku: i.sku, fulfillable: -i.quantity }] },
  }));
}

/** The calls a location change makes, whichever kind it is. */
export function locationChangeCalls(tag: BoxTag, toId: string): ApiCall[] {
  return tag.location_id ? moveCalls(tag, tag.location_id, toId) : putAwayCalls(tag, toId);
}

/* ---------- Pack templates ---------- */

/*
 * ScanPower keeps pack template sizes and weights in hundredths: 1000 means
 * 10.00 in, 1400 means 14.00 lb. BoxTag works in whole units and converts here.
 */
const HUNDREDTHS = 100;
export const toHundredths = (n: number) => Math.round(n * HUNDREDTHS);
export const fromHundredths = (n: number) => n / HUNDREDTHS;

/** POST /v3/pack-template, with the template's SKUs included in the same call */
export function createPackTemplateBody(template: NewPackTemplate) {
  return {
    pack_templates: [
      {
        pack_template_name: template.pack_template_name,
        length: toHundredths(template.length),
        width: toHundredths(template.width),
        height: toHundredths(template.height),
        unit_of_measurement: template.unit_of_measurement,
        weight: template.weight == null ? null : toHundredths(template.weight),
        unit_of_weight: template.unit_of_weight,
        items: (template.items ?? []).map(({ sku, quantity }) => ({ sku, quantity })),
      },
    ],
  };
}
