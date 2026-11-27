"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Alert } from "@/components/Alert";
import { use, useEffect, useState } from "react";
import { IS_DEMO } from "@/lib/mode";
import { Required } from "@/components/Required";
import { missingForShipping, sizeProblems, sizeWarnings } from "@/lib/box-size";
import { daysText, expiryAlert, TOO_CLOSE_DAYS } from "@/lib/expiry";
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
import type { AzShipment, Location, LocationItem } from "@/lib/types";
import type { UnpackPlan } from "@/lib/api/client";
import { useBoxTag } from "@/lib/useBoxTag";

export default function BoxPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { box, setBox, locations, locationName, loading } = useBoxTag(id);
  const [shipments, setShipments] = useState<AzShipment[]>([]);
  const [locationId, setLocationId] = useState("");
  const [shipmentId, setShipmentId] = useState("");
  // Size and weight typed in at shipping time, for boxes sealed without them
  const [shipSize, setShipSize] = useState({ length: "", width: "", height: "", weight: "" });
  const [busy, setBusy] = useState<"store" | "ship" | null>(null);
  // Each message shows next to the button that caused it, so nobody has to scroll to find it
  const [message, setMessage] = useState<{
    at: "location" | "ship" | "unpack";
    tone: "ok" | "error" | "warn";
    title: string;
    text: string;
  } | null>(null);
  const [showPayload, setShowPayload] = useState(false);
  const [showLocationCalls, setShowLocationCalls] = useState(false);
  const [shelf, setShelf] = useState<LocationItem[] | null>(null);
  const shelfId = box?.status === "shipped" || box?.status === "unpacked" ? null : (box?.location_id ?? null);

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
  const open = box.status === "packed" || box.status === "stored";
  const shipExpiry = expiryAlert(box);
  const needsSize = missingForShipping(box);
  const positive = (v: string) => v.trim() !== "" && Number(v) > 0;
  const sizeTyped = (["length", "width", "height", "weight"] as const).every((k) => positive(shipSize[k]));
  const sizeForWarnings = needsSize.length
    ? {
        length: Number(shipSize.length) || null,
        width: Number(shipSize.width) || null,
        height: Number(shipSize.height) || null,
        weight: Number(shipSize.weight) || null,
      }
    : box;
  const shipWarnings = sizeWarnings(sizeForWarnings, totalUnits(box));
  // Shown once the size is complete, so half-typed numbers don't flash errors
  const shipProblems =
    missingForShipping(sizeForWarnings).length === 0 ? sizeProblems(sizeForWarnings, totalUnits(box)) : [];

  // SKUs where ScanPower has fewer units at this location than the box holds
  const missing =
    shelf && box.location_id
      ? box.items
          .map((i) => ({ sku: i.sku, inBox: i.quantity, inScanPower: shelf.find((r) => r.sku === i.sku)?.fulfillable ?? 0 }))
          .filter((m) => m.inScanPower < m.inBox)
      : [];
  const notice = (at: "location" | "ship" | "unpack") =>
    message?.at === at && (
      <div className="mt-3">
        <Alert
          tone={message.tone === "ok" ? "success" : message.tone === "warn" ? "warning" : "error"}
          title={message.title}
          onClose={() => setMessage(null)}
        >
          {message.text}
        </Alert>
      </div>
    );

  async function putAway() {
    const loc = locations.find((l) => l.location_id === locationId);
    if (!loc || !box) return;
    setBusy("store");
    try {
      const updated = await api.putAway(box.box_tag_id, loc);
      setBox(updated);
      setLocationId("");
      setMessage({
        at: "location",
        tone: "ok",
        title: box.location_id ? `Moved to ${loc.location_name}` : `Put away at ${loc.location_name}`,
        text: box.items.length === 1
          ? "ScanPower’s count was updated for the SKU in the box."
          : `ScanPower’s counts were updated for all ${box.items.length} SKUs in the box.`,
      });
    } catch (e) {
      setMessage({
        at: "location",
        tone: "error",
        title: "Couldn’t save the location",
        text: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function ship() {
    if (!shipment || !box) return;
    setBusy("ship");
    try {
      // Save the size and weight first if they were missing; Amazon needs them
      if (missingForShipping(box).length) {
        const n = (v: string) => Number(v);
        setBox(
          await api.setBoxSize(box.box_tag_id, {
            length: n(shipSize.length),
            width: n(shipSize.width),
            height: n(shipSize.height),
            weight: n(shipSize.weight),
          }),
        );
      }
      const { box: updated, problem } = await api.shipBoxTag(box.box_tag_id, shipment);
      setBox(updated);
      const from = box.location_id ? locationName(box.location_id) : null;
      setMessage(
        problem && from
          ? {
              at: "ship",
              tone: "warn",
              title: `Added to ${shipment.shipment_id}, but ${from} wasn’t updated`,
              text: `The box is in the shipment. ScanPower’s count at ${from} still includes its units, so fix that count in ScanPower. ${problem}`,
            }
          : {
              at: "ship",
              tone: "ok",
              title: `Added to ${shipment.shipment_id}`,
              text: `All ${totalUnits(updated)} units went in without unpacking the box${
                from ? `, and they were taken off ${from} in ScanPower` : ""
              }.`,
            },
      );
    } catch (e) {
      setMessage({
        at: "ship",
        tone: "error",
        title: "Couldn’t add the box",
        text: e instanceof Error ? e.message : "Please try again.",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-3xl font-bold">{box.box_tag_id}</h1>
        <StatusBadge status={box.status} />
        {box.status !== "unpacked" && (
          <>
            <Link href={`/labels/fnsku?box=${box.box_tag_id}`} className="btn-ghost ml-auto">
              <Icon name="printer" />
              Print FNSKU labels
            </Link>
            <Link href={`/boxes/${box.box_tag_id}/label`} className="btn-ghost">
              <Icon name="printer" />
              {box.history.some((h) => h.type === "label_printed") ? "Reprint box label" : "Print box label"}
            </Link>
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0 space-y-6">
          {/* Contents */}
          <section className="card">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-bold">What’s inside</h2>
              <span className="text-sm text-navy-soft">
                {totalUnits(box)} {totalUnits(box) === 1 ? "unit" : "units"} · {box.items.length}{" "}
                {box.items.length === 1 ? "SKU" : "SKUs"}
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
            {box.status === "unpacked" ? (
              <>
                <UnpackedSummary note={box.history.findLast((h) => h.type === "unpacked")} />
                {notice("unpack")}
              </>
            ) : box.status === "shipped" ? (
              <>
                <p className="mt-2 text-sm text-navy-soft">
                  Left its location. It’s in shipment{" "}
                  <span className="font-mono font-semibold text-navy">{box.shipment_id}</span>.
                </p>
                {notice("ship")}
              </>
            ) : (
              <>
                {box.location_id ? (
                  <div className="mt-3 flex items-center gap-3 rounded-md bg-sky-soft px-4 py-3">
                    <Icon name="pin" size={22} className="shrink-0 text-navy" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold uppercase tracking-wide text-navy-soft">Location</p>
                      <p className="text-xl font-bold leading-tight">{locationName(box.location_id)}</p>
                    </div>
                    <Link
                      href={`/locations?id=${encodeURIComponent(box.location_id)}`}
                      className="shrink-0 text-sm font-semibold text-navy underline-offset-2 hover:underline"
                    >
                      See what’s there
                    </Link>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-butter">Not put away yet</p>
                )}
                {missing.length > 0 && box.location_id && (
                  <div className="mt-3">
                    <Alert tone="warning" title={`ScanPower doesn’t have this box’s units at ${locationName(box.location_id)}`}>
                      <ul>
                        {missing.map((m) => (
                          <li key={m.sku}>
                            ScanPower shows {m.inScanPower} of <span className="font-mono text-xs">{m.sku}</span>, the box
                            holds {m.inBox}.
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1">
                        Moving is off until the count is fixed in ScanPower. You can still ship or unpack the box.
                      </p>
                    </Alert>
                  </div>
                )}
                <label className="label mt-4" htmlFor="location">
                  {box.location_id ? "Move to" : "Put away at"}
                  <Required />
                </label>
                <div className="flex gap-2">
                  <select
                    id="location"
                    className="input"
                    disabled={missing.length > 0}
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
                  <button className="btn-primary shrink-0" disabled={!locationId || busy !== null || missing.length > 0}
                    onClick={putAway}
                  >
                    <Icon name="shelf" />
                    {busy === "store" ? "Saving…" : "Save"}
                  </button>
                </div>
                {notice("location")}
                <p className="mt-2 text-sm text-navy-soft">
                  Saving also updates the counts in ScanPower.
                </p>
                {IS_DEMO && locationId && (
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
                      {shelf.length === 0 && (
                        <li className="py-1.5 text-navy-soft">ScanPower shows nothing at this location.</li>
                      )}
                    </ul>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Ship it */}
          {open && (
            <section className="card">
              <h2 className="text-lg font-bold">Add to a shipment</h2>
              {shipExpiry && shipExpiry.level !== "soon" && (
                <div className="mt-3">
                  <Alert
                    tone={shipExpiry.level === "expired" ? "error" : "warning"}
                    title={shipExpiry.level === "expired" ? "This box has expired" : `Under ${TOO_CLOSE_DAYS} days left`}
                  >
                    {daysText(shipExpiry.daysLeft)} ({formatDate(shipExpiry.date)}). Amazon wants more than {TOO_CLOSE_DAYS} days of
                    shelf life and disposes of items within 50 days of expiring, so this box may be refused or thrown out.{shipExpiry.level === "expired" && " Expired boxes can’t be added to a shipment."}
                  </Alert>
                </div>
              )}
              <p className="mt-1 text-sm text-navy-soft">
                Add the whole box to an open shipment. Every item comes along, so nobody has to
                unpack and rescan.
              </p>
              {needsSize.length > 0 && (
                <div className="mt-4 rounded-[4px] border border-butter-edge bg-butter-soft p-3">
                  <p className="text-sm font-bold text-butter-ink">Size and weight needed for shipping</p>
                  <p className="text-sm text-navy-soft">
                    This box was sealed without its {needsSize.join(" and ")}. Amazon needs both. Enter them once here
                    and they’re saved on the box.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(
                      [
                        ["length", "Length (in)"],
                        ["width", "Width (in)"],
                        ["height", "Height (in)"],
                        ["weight", "Weight (lb)"],
                      ] as const
                    ).map(([k, label]) => (
                      <div key={k}>
                        <label className="label" htmlFor={`ship-${k}`}>
                          {label}
                          <Required />
                        </label>
                        <input
                          id={`ship-${k}`}
                          className="input bg-white"
                          inputMode="decimal"
                          value={shipSize[k]}
                          onChange={(e) => setShipSize((sz) => ({ ...sz, [k]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {shipProblems.map((w) => (
                <p key={w} className="mt-3 text-sm font-semibold text-red-deep">
                  {w}
                </p>
              ))}
              {shipWarnings.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm text-butter">
                  {shipWarnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
              <label className="label mt-4" htmlFor="shipment">
                Shipment
                <Required />
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
              <button
                className="btn-accent mt-3 w-full"
                disabled={!shipment || busy !== null || (needsSize.length > 0 && !sizeTyped) || shipProblems.length > 0 || shipExpiry?.level === "expired"}
                onClick={ship}
              >
                <Icon name="truck" />
                {busy === "ship" ? "Adding…" : "Add box to shipment"}
              </button>
              {notice("ship")}

              {IS_DEMO && shipment && (
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

          {open && (
            <UnpackBox
              boxId={box.box_tag_id}
              where={box.location_id ? (locationName(box.location_id) ?? null) : null}
              otherLocations={locations.filter((l) => l.location_id !== box.location_id)}
              busy={busy !== null}
              onUnpack={async (plan) => {
                const where = box.location_id ? (locationName(box.location_id) ?? undefined) : undefined;
                const updated = await api.unpackBoxTag(box.box_tag_id, plan, where);
                setBox(updated);
                setMessage({
                  at: "unpack",
                  tone: "ok",
                  title: `${box.box_tag_id} was unpacked`,
                  text: "Its record and history are kept under Unpacked on the Boxes page.",
                });
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** "Unpacked on Nov 23, 2026" plus where it was and where its items went. */
function UnpackedSummary({ note }: { note?: { at: string; note: string } }) {
  if (!note) return <p className="mt-2 text-sm text-navy-soft">Unpacked.</p>;
  const detail = note.note.startsWith("Unpacked. ")
    ? note.note.slice("Unpacked. ".length)
    : note.note === "Unpacked before it was put away"
      ? "It was never put away"
      : note.note;
  return (
    <div className="mt-2 text-sm">
      <p className="font-semibold">Unpacked on {formatDate(note.at)}.</p>
      <p className="mt-0.5 text-navy-soft">{detail}.</p>
    </div>
  );
}

type Choice = "stay" | "move" | "remove";

/** Unpacking asks where the items went, then needs the box ID typed in, so nobody does it by accident. */
function UnpackBox({
  boxId,
  where,
  otherLocations,
  busy,
  onUnpack,
}: {
  boxId: string;
  where: string | null;
  otherLocations: Location[];
  busy: boolean;
  onUnpack: (plan: UnpackPlan) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [choice, setChoice] = useState<Choice>("stay");
  const [moveTo, setMoveTo] = useState("");
  const [typed, setTyped] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = otherLocations.find((l) => l.location_id === moveTo) ?? null;
  const ready = typed.trim().toUpperCase() === boxId && (choice !== "move" || target !== null);

  const choices: { value: Choice; title: string; text: string }[] = where
    ? [
        { value: "stay", title: `Still at ${where}`, text: "The items are loose there now. Nothing changes in ScanPower." },
        { value: "move", title: "Moved to another location", text: `ScanPower moves the units from ${where} to the location you pick.` },
        { value: "remove", title: "Removed from stock", text: `Damaged, lost or thrown out. ScanPower takes the units off ${where}.` },
      ]
    : [];

  function reset() {
    setConfirming(false);
    setChoice("stay");
    setMoveTo("");
    setTyped("");
    setError(null);
  }

  async function unpack() {
    setWorking(true);
    setError(null);
    try {
      await onUnpack(choice === "move" && target ? { kind: "move", to: target } : { kind: choice === "remove" ? "remove" : "stay" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
      setWorking(false);
    }
  }

  return (
    <section className="card">
      <h2 className="text-lg font-bold">Unpack this box</h2>
      <p className="mt-1 text-sm text-navy-soft">
        {where
          ? "Use this when the box is opened and its items are taken out."
          : "Use this if the box was sealed by mistake or opened before it was put away. Nothing changes in ScanPower."}{" "}
        The box record is kept as Unpacked, with its history.
      </p>

      {!confirming ? (
        <button className="btn-danger-ghost mt-4 w-full" disabled={busy} onClick={() => setConfirming(true)}>
          Unpack box…
        </button>
      ) : (
        <div className="mt-4 rounded-[4px] border-2 border-red-deep bg-red-soft p-4">
          {choices.length > 0 && (
            <fieldset className="mb-4">
              <legend className="text-sm font-bold text-navy">Where are the items now?</legend>
              <div className="mt-2 space-y-2">
                {choices.map((c) => (
                  <label
                    key={c.value}
                    className={`flex cursor-pointer gap-3 rounded-[4px] border bg-white px-3 py-2.5 ${
                      choice === c.value ? "border-navy" : "border-line"
                    }`}
                  >
                    <input
                      type="radio"
                      name="unpack-choice"
                      className="mt-1 accent-navy"
                      checked={choice === c.value}
                      onChange={() => setChoice(c.value)}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-navy">{c.title}</span>
                      <span className="block text-xs text-navy-soft">{c.text}</span>
                    </span>
                  </label>
                ))}
              </div>
              {choice === "move" && (
                <>
                <label className="label mt-3" htmlFor="unpack-move-to">
                  Move the items to
                  <Required />
                </label>
                <select
                  id="unpack-move-to"
                  className="input"
                  value={moveTo}
                  onChange={(e) => setMoveTo(e.target.value)}
                >
                  <option value="">Choose a location</option>
                  {otherLocations.map((l) => (
                    <option key={l.location_id} value={l.location_id}>
                      {l.location_name}
                    </option>
                  ))}
                </select>
                </>
              )}
            </fieldset>
          )}
          <p className="text-sm font-bold text-navy">This can’t be undone.</p>
          <label className="mt-2 block text-sm text-navy" htmlFor="confirm-unpack">
            To confirm, type <span className="font-mono font-bold">{boxId}</span>
            <Required />
          </label>
          <input
            id="confirm-unpack"
            className="input mt-1.5 font-mono"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          {error && <p className="mt-2 text-sm font-semibold text-red-deep">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button className="btn-ghost btn-sm flex-1" onClick={reset}>
              Cancel
            </button>
            <button className="btn-danger btn-sm flex-1" disabled={!ready || working} onClick={unpack}>
              {working ? "Unpacking…" : "Unpack box"}
            </button>
          </div>
        </div>
      )}
    </section>
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
