import type { FulfillmentChannel, InventoryItem, MarketplaceId } from "../types";

/*
 * Turns ScanPower's real GET /v3/inventory replies into BoxTag's InventoryItem,
 * and decides how to search for what someone typed or scanned.
 */

/** One entry of inventory[].items[] as ScanPower actually sends it (only the fields BoxTag reads). */
export interface RawInventoryItem {
  sku: string;
  fnsku?: string | null;
  marketplace_id?: string | null;
  fulfillment_channel?: string | null;
  quantity?: number | null;
  condition?: string | null;
  condition_id?: number | null;
  external_id?: string | null;
  detail?: { fulfillableQuantity?: number | null } | null;
  product?: {
    title?: string | null;
    gtins?: string[] | null;
    images?: string[] | null;
    expiration_required?: boolean | null;
  } | null;
}

/** Digits only, without leading zeros, so a 12-digit UPC equals its 14-digit GTIN. */
export function normalizeBarcode(code: string) {
  return code.replace(/\D/g, "").replace(/^0+/, "");
}

/** True when a scanned barcode is one of the product's UPC or GTIN codes. */
export function matchesBarcode(scanned: string, codes: (string | null | undefined)[]) {
  const s = normalizeBarcode(scanned);
  return s.length >= 8 && codes.some((c) => c && normalizeBarcode(c) === s);
}

/** A 14-digit GTIN that starts with 00 is a 12-digit UPC with padding. */
function upcFrom(gtins: string[]) {
  const padded = gtins.find((g) => /^00\d{12}$/.test(g));
  return padded ? padded.slice(2) : null;
}

export function toInventoryItem(raw: RawInventoryItem): InventoryItem {
  const gtins = raw.product?.gtins ?? [];
  return {
    sku: raw.sku,
    fnsku: raw.fnsku ?? null,
    marketplace_id: (raw.marketplace_id ?? "az-US") as MarketplaceId,
    fulfillment_channel: (raw.fulfillment_channel ?? "fba") as FulfillmentChannel,
    // FBA items leave this empty; their count is stock at Amazon, kept separately below
    quantity: raw.quantity ?? null,
    amazon_fulfillable: raw.detail?.fulfillableQuantity ?? null,
    condition: raw.condition ?? "New",
    product: {
      title: raw.product?.title ?? raw.sku,
      asin: raw.external_id ?? undefined,
      upc: upcFrom(gtins),
      gtins,
      images: raw.product?.images ?? [],
      requires_expiration: Boolean(raw.product?.expiration_required),
    },
  };
}

/**
 * ScanPower searches one field at a time (search_by), so BoxTag picks the fields
 * from what was typed or scanned and runs those searches together.
 */
export function inventorySearches(query: string): URLSearchParams[] {
  const q = query.trim();
  const make = (search_by?: string, search = q) => {
    const p = new URLSearchParams({ limit: "100" });
    if (search) p.set("search", search);
    if (search_by) p.set("search_by", search_by);
    return p;
  };
  if (!q) return [make()];
  if (/^\d{8,14}$/.test(q)) return [make("upc"), make("gtin")];
  const searches = [make("title"), make("sku")];
  if (/^B0[A-Z0-9]{8}$/i.test(q) || /^\d{9}[\dX]$/i.test(q)) searches.push(make("asin"));
  return searches;
}

/** FNSKUs (like X00A1B2C3D) can't be searched by field, so they're matched on the loaded list. */
export const looksLikeFnsku = (q: string) => /^X0[A-Z0-9]{8}$/i.test(q.trim());
