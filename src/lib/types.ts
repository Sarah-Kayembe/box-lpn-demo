/*
 * Types for the parts of the ScanPower v3 API that BoxTag uses.
 * Field names match the OpenAPI document (ScanPower API Docs 3.0.0) so the
 * mock data and the live API can be swapped without touching the screens.
 */

export type MarketplaceId = "az-US" | "az-CA" | "wm-US";
export type FulfillmentChannel = "fba" | "sf" | "wfs";
export type UnitOfMeasurement = "IN" | "CM";
export type UnitOfWeight = "LB" | "KG";

/** GET /v3/inventory  ->  inventory[].items[] (trimmed to what BoxTag needs) */
export interface InventoryItem {
  sku: string;
  fnsku: string | null;
  marketplace_id: MarketplaceId;
  fulfillment_channel: FulfillmentChannel;
  quantity: number;
  condition: string;
  product: {
    title: string;
    asin?: string;
    requires_expiration?: boolean;
  };
}

/** GET /v3/location  ->  locations[] */
export interface Location {
  location_id: string;
  location_name: string;
  location_type: "Bin" | "Cart" | "Dock" | "Rack" | "Storage" | "Table";
  ship_from_id: string;
}

/** GET /v3/pack-template  ->  pack_templates[] */
export interface PackTemplate {
  pack_template_id: string;
  pack_template_name: string;
  length: number;
  width: number;
  height: number;
  unit_of_measurement: UnitOfMeasurement;
  weight: number | null;
  unit_of_weight: UnitOfWeight | null;
}

/** GET /v3/az-shipment  ->  az_shipments[] (trimmed) */
export interface AzShipment {
  shipment_id: string;
  plan_id: string | null;
  inbound_plan_id: string | null;
  marketplace_id: MarketplaceId;
  ship_from_id: string;
  status: string;
  name: string;
  destination?: { warehouse_id?: string };
  box_count: number;
}

/*
 * BoxTag's own records. ScanPower boxes (/v3/az-box) always belong to a
 * shipment, so a box that is packed now and shipped later needs a home of its
 * own. In this demo these live in the browser. The README proposes a
 * /v3/box-tag endpoint for the real thing.
 */

export type BoxTagStatus = "packed" | "stored" | "shipped";

export interface BoxTagItem {
  sku: string;
  fnsku: string | null;
  title: string;
  quantity: number;
  /** ISO date (YYYY-MM-DD) or null */
  expires: string | null;
  manufacturing_lot_code: string | null;
}

export interface BoxTagEvent {
  at: string;
  type: "packed" | "stored" | "moved" | "shipped" | "label_printed";
  note: string;
}

export interface BoxTag {
  box_tag_id: string;
  status: BoxTagStatus;
  items: BoxTagItem[];
  pack_template_id: string | null;
  length: number | null;
  width: number | null;
  height: number | null;
  unit_of_measurement: UnitOfMeasurement;
  weight: number | null;
  unit_of_weight: UnitOfWeight;
  location_id: string | null;
  shipment_id: string | null;
  notes: string;
  packed_at: string;
  packed_by: string;
  history: BoxTagEvent[];
}

export type NewBoxTag = Pick<
  BoxTag,
  | "items"
  | "pack_template_id"
  | "length"
  | "width"
  | "height"
  | "unit_of_measurement"
  | "weight"
  | "unit_of_weight"
  | "notes"
>;
