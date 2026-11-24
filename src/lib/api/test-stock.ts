import { call, SHIP_FROM_ID } from "./live";

/*
 * Puts stock at a location on the test account, so location moves can be
 * tested. ScanPower only adds new stock to a location by receiving a purchase
 * order, so this creates one, adds the SKU, and receives it there.
 * Used by the test site only, never in demo mode.
 */

export interface TestStockStep {
  label: string;
  ok: boolean;
  detail: string;
}

export async function addTestStock(
  input: { locationId: string; locationName: string; sku: string; gtin: string; quantity: number },
  onStep: (steps: TestStockStep[]) => void,
) {
  const steps: TestStockStep[] = [];
  const record = (label: string, ok: boolean, detail: string) => {
    steps.push({ label, ok, detail });
    onStep([...steps]);
  };
  const run = async <T>(label: string, send: () => Promise<T>, describe: (reply: T) => string) => {
    try {
      const reply = await send();
      record(label, true, describe(reply));
      return reply;
    } catch (e) {
      record(label, false, e instanceof Error ? e.message : "ScanPower refused the request.");
      throw e;
    }
  };

  const { sku, gtin, quantity, locationId, locationName } = input;
  const day = new Date().toISOString().slice(0, 10);

  const po = await run(
    "Create purchase order",
    () =>
      call<{ purchase_orders: { purchase_order_id: string; purchase_order_name: string }[] }>(`/v3/purchase-order`, {
        method: "POST",
        body: JSON.stringify({
          purchase_orders: [
            {
              purchase_order_name: `BoxTag test stock ${day}`,
              ship_from_id: SHIP_FROM_ID,
              notes: `Test stock for location testing in BoxTag: ${quantity} of ${sku} into ${locationName}`,
            },
          ],
        }),
      }),
    (r) => `Created “${r.purchase_orders[0].purchase_order_name}” (${r.purchase_orders[0].purchase_order_id})`,
  );
  const purchaseOrderId = po.purchase_orders[0].purchase_order_id;

  await run(
    "Add the SKU to it",
    () =>
      call(`/v3/purchase-order/${encodeURIComponent(purchaseOrderId)}/items`, {
        method: "POST",
        body: JSON.stringify({ purchase_order_items: [{ sku, gtin, ordered: quantity }] }),
      }),
    () => `${quantity} × ${sku}`,
  );

  await run(
    `Receive into ${locationName}`,
    () =>
      call(`/v3/location/${encodeURIComponent(locationId)}/items`, {
        method: "POST",
        body: JSON.stringify({
          purchase_order_items: [{ purchase_order_id: purchaseOrderId, gtin, received: quantity }],
        }),
      }),
    () => `${quantity} received`,
  );

  return steps;
}
