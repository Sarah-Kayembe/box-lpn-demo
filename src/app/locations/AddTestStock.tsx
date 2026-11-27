"use client";

import { useState } from "react";
import { api } from "@/lib/api/client";
import { SHIP_FROM_ID } from "@/lib/api/live";
import { addTestStock, type TestStockStep } from "@/lib/api/test-stock";
import { Icon } from "@/components/Icon";
import { Required } from "@/components/Required";
import type { Location } from "@/lib/types";

/*
 * Test site only: puts stock of one SKU at a location by creating and
 * receiving a purchase order in ScanPower, so moves can be tested.
 */
export function AddTestStock({ locations, onAdded }: { locations: Location[]; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [locationId, setLocationId] = useState("");
  const [sku, setSku] = useState("");
  const [quantity, setQuantity] = useState("100");
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<TestStockStep[]>([]);
  const [error, setError] = useState<string | null>(null);

  const location = locations.find((l) => l.location_id === locationId) ?? null;
  const qty = Number(quantity);
  const ready = location && sku.trim() && Number.isInteger(qty) && qty > 0 && qty <= 1000 && SHIP_FROM_ID;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || !location) return;
    setBusy(true);
    setSteps([]);
    setError(null);
    try {
      // Receiving goes by barcode, so look up the SKU's GTIN first
      const wanted = sku.trim().toLowerCase();
      const item = (await api.listInventory(sku.trim())).find((i) => i.sku.toLowerCase() === wanted);
      if (!item) throw new Error(`No product with SKU ${sku.trim()} was found in ScanPower.`);
      const gtin = item.product.gtins?.[0];
      if (!gtin) throw new Error(`${item.sku} has no UPC or GTIN in ScanPower, so it can’t be received.`);

      await addTestStock(
        { locationId: location.location_id, locationName: location.location_name, sku: item.sku, gtin, quantity: qty },
        setSteps,
      );
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card border-dashed">
      <button className="flex w-full items-center justify-between text-left" onClick={() => setOpen((o) => !o)}>
        <span>
          <span className="block text-lg font-bold">Add test stock</span>
          <span className="block text-sm text-navy-soft">Test site only. Puts units of a SKU at a location.</span>
        </span>
        <span className="text-sm font-semibold text-navy">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <form onSubmit={add} className="mt-4 space-y-3">
          <p className="text-sm text-navy-soft">
            ScanPower only adds new stock by receiving a purchase order, so this creates one named “BoxTag test stock”
            for ship-from {SHIP_FROM_ID || "(not set)"}, adds the SKU and receives it at the location.
          </p>
          {!SHIP_FROM_ID && (
            <p className="text-sm font-semibold text-red-deep">
              Set NEXT_PUBLIC_SCANPOWER_SHIP_FROM_ID in Vercel first.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_0.6fr]">
            <div>
              <label className="label" htmlFor="stock-location">
                Location
                <Required />
              </label>
              <select
                id="stock-location"
                className="input"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
              >
                <option value="">Choose a location</option>
                {locations.map((l) => (
                  <option key={l.location_id} value={l.location_id}>
                    {l.location_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="stock-sku">
                SKU
                <Required />
              </label>
              <input
                id="stock-sku"
                className="input font-mono"
                placeholder="SP_WELCOME_2019_001"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="stock-qty">
                Units
                <Required />
              </label>
              <input
                id="stock-qty"
                className="input"
                type="number"
                min={1}
                max={1000}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          </div>
          <button className="btn-primary w-full" disabled={!ready || busy}>
            {busy ? "Adding…" : location ? `Add ${qty || 0} units to ${location.location_name}` : "Add stock"}
          </button>

          {steps.length > 0 && (
            <ol className="space-y-1.5 text-sm">
              {steps.map((s) => (
                <li key={s.label} className="flex gap-2">
                  <span className={s.ok ? "text-mint" : "text-red-deep"}>
                    <Icon name={s.ok ? "check" : "alert"} size={18} />
                  </span>
                  <span>
                    <span className="font-semibold">{s.label}:</span> {s.detail}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {error && !steps.some((s) => !s.ok) && <p className="text-sm font-semibold text-red-deep">{error}</p>}
        </form>
      )}
    </section>
  );
}
