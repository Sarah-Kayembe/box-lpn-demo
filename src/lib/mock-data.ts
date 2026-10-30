import type { AzShipment, BoxTag, InventoryItem, Location, PackTemplate } from "./types";

/* Sample data shaped like ScanPower v3 responses. Product names are made up. */

export const SHIP_FROM_ID = "sf-portland-01";

export const inventory: InventoryItem[] = [
  item("BTL-32-SAGE", "X00A1B2C3D", "Insulated Water Bottle 32 oz, Sage", 48),
  item("BTL-32-BLUSH", "X00A1B2C3E", "Insulated Water Bottle 32 oz, Blush", 36),
  item("TEA-GRN-20", "X00B7K9P2Q", "Organic Green Tea, 20 Bags", 120, true),
  item("GUM-VITC-60", "X00C4M8N1R", "Vitamin C Gummies, 60 Count", 72, true),
  item("PUZ-1000-LH", "X00D2F6G8H", "Lighthouse 1000 Piece Jigsaw Puzzle", 24),
  item("CRY-24-PAST", "X00E5T3Y7U", "Pastel Crayons, 24 Pack", 96),
  item("MUG-CER-12", "X00F9W1Q4E", "Ceramic Coffee Mug 12 oz, Speckled", 40),
  item("SOAP-LAV-3", "X00G6Z2X5C", "Lavender Bar Soap, 3 Pack", 60, true),
  item("CBL-USBC-6", "X00H8V4B7N", "Braided USB-C Cable, 6 ft", 150),
  item("NBK-A5-DOT", "X00J3L5K9M", "Dotted A5 Notebook, Hardcover", 80),
  item("SNK-ALM-12", "X00K7P1O3I", "Roasted Almond Snack Packs, 12 Count", 54, true),
  item("TOY-DINO-6", "X00L2U8Y6T", "Wind-Up Dinosaur Toys, 6 Pack", 30),
];

export const locations: Location[] = [
  loc("loc-rack-a01", "Rack A-01", "Rack"),
  loc("loc-rack-a02", "Rack A-02", "Rack"),
  loc("loc-rack-a03", "Rack A-03", "Rack"),
  loc("loc-rack-b01", "Rack B-01", "Rack"),
  loc("loc-rack-b02", "Rack B-02", "Rack"),
  loc("loc-floor-1", "Floor Storage 1", "Storage"),
  loc("loc-dock-1", "Dock 1 (staging)", "Dock"),
];

export const packTemplates: PackTemplate[] = [
  tpl("pt-small", "Small box 12 x 10 x 8", 12, 10, 8),
  tpl("pt-medium", "Medium box 18 x 14 x 12", 18, 14, 12),
  tpl("pt-large", "Large box 24 x 18 x 18", 24, 18, 18),
];

export const shipments: AzShipment[] = [
  {
    shipment_id: "FBA17XK2M9Q",
    plan_id: "plan-0921",
    inbound_plan_id: "wf7a3c1e90-5b2d",
    marketplace_id: "az-US",
    ship_from_id: SHIP_FROM_ID,
    status: "WORKING",
    name: "November restock",
    destination: { warehouse_id: "BOS7" },
    box_count: 3,
  },
  {
    shipment_id: "FBA17XK3P4L",
    plan_id: "plan-0934",
    inbound_plan_id: "wf8b4d2f01-6c3e",
    marketplace_id: "az-US",
    ship_from_id: SHIP_FROM_ID,
    status: "WORKING",
    name: "Holiday toys",
    destination: { warehouse_id: "ABE8" },
    box_count: 0,
  },
];

/** A few boxes so the demo doesn't start empty. */
export function seedBoxTags(): BoxTag[] {
  const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
  return [
    {
      box_tag_id: "BT-000101",
      status: "stored",
      items: [
        boxItem("BTL-32-SAGE", 12),
        boxItem("BTL-32-BLUSH", 12),
      ],
      pack_template_id: "pt-medium",
      length: 18,
      width: 14,
      height: 12,
      unit_of_measurement: "IN",
      weight: 21.5,
      unit_of_weight: "LB",
      location_id: "loc-rack-a02",
      shipment_id: null,
      notes: "",
      packed_at: day(6),
      packed_by: "Sarah",
      history: [
        { at: day(6), type: "packed", note: "Packed 24 units" },
        { at: day(6), type: "label_printed", note: "Label printed" },
        { at: day(6), type: "stored", note: "Put away at Rack A-02" },
      ],
    },
    {
      box_tag_id: "BT-000102",
      status: "stored",
      items: [
        boxItem("TEA-GRN-20", 40, "2027-08-31", "LOT-TG-0825"),
        boxItem("GUM-VITC-60", 24, "2027-03-15", "LOT-VC-1143"),
      ],
      pack_template_id: "pt-small",
      length: 12,
      width: 10,
      height: 8,
      unit_of_measurement: "IN",
      weight: 14.2,
      unit_of_weight: "LB",
      location_id: "loc-rack-b01",
      shipment_id: null,
      notes: "Keep away from heat",
      packed_at: day(3),
      packed_by: "Sarah",
      history: [
        { at: day(3), type: "packed", note: "Packed 64 units" },
        { at: day(3), type: "label_printed", note: "Label printed" },
        { at: day(3), type: "stored", note: "Put away at Rack B-01" },
      ],
    },
    {
      box_tag_id: "BT-000103",
      status: "packed",
      items: [boxItem("PUZ-1000-LH", 8), boxItem("TOY-DINO-6", 10)],
      pack_template_id: "pt-large",
      length: 24,
      width: 18,
      height: 18,
      unit_of_measurement: "IN",
      weight: 17.8,
      unit_of_weight: "LB",
      location_id: null,
      shipment_id: null,
      notes: "",
      packed_at: day(0),
      packed_by: "Sarah",
      history: [{ at: day(0), type: "packed", note: "Packed 18 units" }],
    },
  ];
}

function item(
  sku: string,
  fnsku: string,
  title: string,
  quantity: number,
  requiresExpiration = false,
): InventoryItem {
  return {
    sku,
    fnsku,
    marketplace_id: "az-US",
    fulfillment_channel: "fba",
    quantity,
    condition: "New",
    product: { title, requires_expiration: requiresExpiration },
  };
}

function loc(location_id: string, location_name: string, location_type: Location["location_type"]): Location {
  return { location_id, location_name, location_type, ship_from_id: SHIP_FROM_ID };
}

function tpl(id: string, name: string, l: number, w: number, h: number): PackTemplate {
  return {
    pack_template_id: id,
    pack_template_name: name,
    length: l,
    width: w,
    height: h,
    unit_of_measurement: "IN",
    weight: null,
    unit_of_weight: null,
  };
}

function boxItem(sku: string, quantity: number, expires: string | null = null, lot: string | null = null) {
  const inv = inventory.find((i) => i.sku === sku)!;
  return {
    sku,
    fnsku: inv.fnsku,
    title: inv.product.title,
    quantity,
    expires,
    manufacturing_lot_code: lot,
  };
}
