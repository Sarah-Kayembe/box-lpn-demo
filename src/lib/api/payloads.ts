import type { AzShipment, BoxTag } from "../types";

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
      quantity: i.quantity,
      expires: i.expires ? `${i.expires}T00:00:00.000Z` : null,
      manufacturing_lot_code: i.manufacturing_lot_code,
    })),
  };
}
