"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Alert } from "@/components/Alert";
import { use, useEffect, useState } from "react";
import { ProductThumb } from "@/components/ProductThumb";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api/client";
import {
  insertAzBoxBody,
  locationChangeCalls,
  mergeAzBoxItemsBody,
  removeFromShelfCalls,
} from "@/lib/api/payloads";
import { earliestExpiry, formatDate, formatDims, totalUnits } from "@/lib/format";
import type { AzShipment, LocationItem } from "@/lib/types";
import { useBoxTag } from "@/lib/useBoxTag";

export default function BoxPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { box, setBox, locations, locationName, loading } = useBoxTag(id);
  const [shipments, setShipments] = useState<AzShipment[]>([]);
  const [locationId, setLocationId] = useState("");
  const [shipmentId, setShipmentId] = useState("");
  const [busy, setBusy] = useState<"store" | "ship" | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; title: string; text: string } | null>(null);
  const [showPayload, setShowPayload] = useState(false);
  const [showLocationCalls, setShowLocationCalls] = useState(false);
  const [shelf, setShelf] = useState<LocationItem[] | null>(null);
  const shelfId = box?.status === "shipped" ? null : (box?.location_id ?? null);

  // What ScanPower has on this box's shelf, refreshed whenever the box moves
  useEffect(() => {
    if (!shelfId) return setShelf(null);
    api.listLocationItems(shelfId).then(setShelf).catch(() => setShelf(null));
  }, [shelfId, box?.history.length]);

  useEffect(() => {
    api.listOpenShipments().then(setShipments);
  }, []);

  if (loading) return <p className="text-navy-soft">Loading…</p>;
  if (!box) {
    return (
      <div className="card mx-auto max-w-md text-center">
        <p className="font-semibold">No box found for “{id}”.</p>
        <Link href="/scan" className="btn-ghost mt-4">
          Scan another box
        </Link>
      </div>
    );
  }

  const shipment = shipments.find((s) => s.shipment_id === shipmentId) ?? null;
  const expiry = earliestExpiry(box);

  async function putAway() {
    const loc = locations.find((l) => l.location_id === locationId);
    if (!loc || !box) return;
    setBusy("store");
    try {
      const updated = await api.putAway(box.box_tag_id, loc);
      setBox(updated);
      setLocationId("");
      setMessage({
        tone: "ok",
        title: box.location_id ? `Moved to ${loc.location_name}` : `Put away at ${loc.location_name}`,
        text: `ScanPower’s location inventory was updated for all ${box.items.length} SKUs in the box.`,
      });
    } catch (e) {
      setMessage({ tone: "error", title: "Couldn’t save the location", text: e instanceof Error ? e.message : "Please try again." });
    } finally {
      setBusy(null);
    }
  }

  async function ship() {
    if (!shipment || !box) return;
    setBusy("ship");
    try {
      const updated = await api.shipBoxTag(box.box_tag_id, shipment);
      setBox(updated);
      setMessage({
        tone: "ok",
        title: `Added to ${shipment.shipment_id}`,
        text: `All ${totalUnits(updated)} units went in without unpacking the box${
          box.location_id ? `, and they were taken off ${locationName(box.location_id)} in ScanPower` : ""
        }.`,
      });
    } catch (e) {
      setMessage({ tone: "error", title: "Couldn’t add the box", text: e instanceof Error ? e.message : "Please try again." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-3xl font-bold">{box.box_tag_id}</h1>
        <StatusBadge status={box.status} />
        <Link href={`/labels/fnsku?box=${box.box_tag_id}`} className="btn-ghost ml-auto">
          <Icon name="printer" />
          FNSKU labels
        </Link>
        <Link href={`/boxes/${box.box_tag_id}/label`} className="btn-ghost">
          <Icon name="printer" />
          {box.history.some((h) => h.type === "label_printed") ? "Reprint label" : "Print label"}
        </Link>
      </div>

      {message && (
        <Alert
          tone={message.tone === "ok" ? "success" : "error"}
          title={message.title}
          onClose={() => setMessage(null)}
        >
          {message.text}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0 space-y-6">
          {/* Contents */}
          <section className="card">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-bold">What’s inside</h2>
              <span className="text-sm text-navy-soft">
                {totalUnits(box)} units · {box.items.length} SKUs
              </span>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-navy-soft">
                    <th className="py-2 font-semibold">Product</th>
                    <th className="py-2 font-semibold">FNSKU</th>
                    <th className="py-2 text-right font-semibold">Qty</th>
                    <th className="py-2 text-right font-semibold">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {box.items.map((i) => (
                    <tr key={i.sku} className="border-b border-line last:border-0">
                      <td className="py-2.5">
                        <div className="flex items-center gap-3">
                          <ProductThumb src={i.image_url} title={i.title} size={40} />
                          <div>
                            <p className="font-medium">{i.title}</p>
                            <p className="text-xs text-navy-soft">
                              {i.sku}
                              {i.manufacturing_lot_code && ` · Lot ${i.manufacturing_lot_code}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 font-mono text-xs">{i.fnsku}</td>
                      <td className="py-2.5 text-right font-semibold">{i.quantity}</td>
                      <td className="py-2.5 text-right">{i.expires ? formatDate(i.expires) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 rounded-[3px] border border-line bg-sky-wash p-4 text-sm sm:grid-cols-4">
              <Fact label="Size" value={formatDims(box)} />
              <Fact label="Weight" value={box.weight ? `${box.weight} lb` : "—"} />
              <Fact label="Packed" value={formatDate(box.packed_at)} />
              <Fact label="Earliest expiry" value={expiry ? formatDate(expiry) : "—"} />
            </dl>
            {box.notes && <p className="mt-3 text-sm italic text-navy-soft">Note: {box.notes}</p>}
          </section>

          {/* History */}
          <section className="card">
            <h2 className="text-lg font-bold">History</h2>
            <ol className="mt-3 space-y-3 border-l-2 border-sky-soft pl-4">
              {[...box.history].reverse().map((h, n) => (
                <li key={n} className="relative text-sm">
                  <span className="absolute -left-[23px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-sky-brand" />
                  <p className="font-medium">{h.note}</p>
                  <p className="text-xs text-navy-soft">{formatDate(h.at, true)}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          {/* Where it is */}
          <section className="card">
            <h2 className="text-lg font-bold">Where it is</h2>
            {box.status === "shipped" ? (
              <p className="mt-2 text-sm text-navy-soft">
                Left its location. It’s in shipment <span className="font-mono font-semibold text-navy">{box.shipment_id}</span>.
              </p>
            ) : (
              <>
                {box.location_id ? (
                  <div className="mt-3 flex items-center gap-3 rounded-md bg-sky-soft px-4 py-3">
                    <Icon name="pin" size={22} className="shrink-0 text-navy" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide text-navy-soft">Location</p>
                      <p className="text-xl font-bold leading-tight">{locationName(box.location_id)}</p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-butter">Not put away yet</p>
                )}
                <label className="label mt-4" htmlFor="location">
                  {box.location_id ? "Move to" : "Put away at"}
                </label>
                <div className="flex gap-2">
                  <select
                    id="location"
                    className="input"
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                  >
                    <option value="">Choose a location</option>
                    {locations
                      .filter((l) => l.location_id !== box.location_id)
                      .map((l) => (
                        <option key={l.location_id} value={l.location_id}>
                          {l.location_name}
                        </option>
                      ))}
                  </select>
                  <button className="btn-primary shrink-0" disabled={!locationId || busy !== null} onClick={putAway}>
                    <Icon name="shelf" />
                    {busy === "store" ? "Saving…" : "Save"}
                  </button>
                </div>
                <p className="mt-2 text-sm text-navy-soft">
                  Saving also updates ScanPower’s location inventory for each SKU in the box.
                </p>
                {locationId && (
                  <div className="mt-3">
                    <button
                      className="text-sm font-semibold text-navy-soft underline-offset-2 hover:underline"
                      onClick={() => setShowLocationCalls((v) => !v)}
                    >
                      {showLocationCalls ? "Hide" : "Show"} the ScanPower API calls this makes
                    </button>
                    {showLocationCalls && (
                      <div className="mt-2 space-y-2 text-xs">
                        {locationChangeCalls(box, locationId).map((c, n) => (
                          <Payload key={n} title={`${n + 1}. ${c.method} ${c.path}`} body={c.body} />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {shelf && box.location_id && (
                  <div className="mt-5 border-t border-line pt-4">
                    <p className="text-sm font-bold">At {locationName(box.location_id)} in ScanPower</p>
                    <p className="text-xs text-navy-soft">Everything at this location, counted by SKU.</p>
                    <ul className="mt-2 divide-y divide-line text-sm">
                      {shelf.map((row) => (
                        <li key={row.sku} className="flex justify-between py-1.5">
                          <span className="font-mono text-xs">{row.sku}</span>
                          <span className="font-semibold">{row.fulfillable}</span>
                        </li>
                      ))}
                      {shelf.length === 0 && <li className="py-1.5 text-navy-soft">Nothing recorded yet.</li>}
                    </ul>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Ship it */}
          {box.status !== "shipped" && (
            <section className="card">
              <h2 className="text-lg font-bold">Ready to ship?</h2>
              <p className="mt-1 text-sm text-navy-soft">
                Add the whole box to an open shipment. Every item comes along, so nobody has to
                unpack and rescan.
              </p>
              <label className="label mt-4" htmlFor="shipment">
                Shipment
              </label>
              <select
                id="shipment"
                className="input"
                value={shipmentId}
                onChange={(e) => setShipmentId(e.target.value)}
              >
                <option value="">Choose an open shipment</option>
                {shipments.map((s) => (
                  <option key={s.shipment_id} value={s.shipment_id}>
                    {s.shipment_id} · {s.name} · {s.destination?.warehouse_id ?? "FBA"} · {s.box_count} boxes
                  </option>
                ))}
              </select>
              <button className="btn-accent mt-3 w-full" disabled={!shipment || busy !== null} onClick={ship}>
                <Icon name="truck" />
                {busy === "ship" ? "Adding…" : "Add box to shipment"}
              </button>

              {shipment && (
                <div className="mt-4">
                  <button
                    className="text-sm font-semibold text-navy-soft underline-offset-2 hover:underline"
                    onClick={() => setShowPayload((v) => !v)}
                  >
                    {showPayload ? "Hide" : "Show"} the ScanPower API calls this makes
                  </button>
                  {showPayload && (
                    <div className="mt-2 space-y-2 text-xs">
                      <Payload title="1. POST /v3/az-box" body={insertAzBoxBody(box, shipment)} />
                      <Payload
                        title="2. PATCH /v3/az-box/items"
                        body={mergeAzBoxItemsBody(box, "<box_id from step 1>")}
                      />
                      {box.location_id &&
                        removeFromShelfCalls(box, box.location_id).map((c, n) => (
                          <Payload key={n} title={`${n + 3}. ${c.method} ${c.path} (take off this location)`} body={c.body} />
                        ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-navy-soft">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

function Payload({ title, body }: { title: string; body: unknown }) {
  return (
    <div className="rounded-[3px] border border-line bg-sky-wash p-3">
      <p className="mb-1 font-mono font-semibold">{title}</p>
      <pre className="max-h-56 overflow-auto whitespace-pre font-mono text-[11px] leading-relaxed text-navy-soft">
        {JSON.stringify(body, null, 2)}
      </pre>
    </div>
  );
}
