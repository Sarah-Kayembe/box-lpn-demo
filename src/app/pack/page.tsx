"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/Alert";
import { Toggle } from "@/components/Toggle";
import { Required } from "@/components/Required";
import { missingForShipping, sizeWarnings } from "@/lib/box-size";
import { BoxSizes } from "./BoxSizes";
import { IS_DEMO } from "@/lib/mode";
import { AddPill, QuantityPill } from "@/components/QuantityPill";
import { Icon } from "@/components/Icon";
import { ProductThumb } from "@/components/ProductThumb";
import { api } from "@/lib/api/client";
import { createPackTemplateBody } from "@/lib/api/payloads";
import { matchesBarcode } from "@/lib/api/scanpower-inventory";
import { saveFnskuPrint } from "@/lib/fnsku-print";
import { matchPackTemplate, WEIGHT_TOLERANCE_LB, type MatchResult } from "@/lib/pack-template-match";
import type { BoxTagItem, InventoryItem, NewPackTemplate, PackTemplate, UnitOfMeasurement } from "@/lib/types";

type Line = BoxTagItem & { requiresExpiration: boolean };

export default function PackPage() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<InventoryItem[]>([]);
  const [templates, setTemplates] = useState<PackTemplate[]>([]);
  // Off: pack a box. On: manage box sizes (templates with measurements only)
  const [sizeMode, setSizeMode] = useState(false);
  const [sizeId, setSizeId] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [dims, setDims] = useState({ length: "", width: "", height: "" });
  const [unit] = useState<UnitOfMeasurement>("IN");
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  // What the last template added, so it can be undone
  const [applied, setApplied] = useState<{
    name: string;
    added: { sku: string; quantity: number }[];
    before: { dims: { length: string; width: string; height: string }; weight: string };
  } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listPackTemplates().then(setTemplates);
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    let live = true;
    api.listInventory(search).then((r) => live && setResults(r));
    return () => {
      live = false;
    };
  }, [search]);

  function addItem(inv: InventoryItem, count = 1) {
    setLines((current) => {
      const existing = current.find((l) => l.sku === inv.sku);
      if (existing) {
        return current.map((l) => (l.sku === inv.sku ? { ...l, quantity: l.quantity + count } : l));
      }
      return [
        ...current,
        {
          sku: inv.sku,
          fnsku: inv.fnsku,
          title: inv.product.title,
          quantity: count,
          expires: null,
          manufacturing_lot_code: null,
          image_url: inv.product.images?.[0] ?? null,
          asin: inv.product.asin ?? null,
          requiresExpiration: Boolean(inv.product.requires_expiration),
        },
      ];
    });
    setFlash(inv.sku);
    setTimeout(() => setFlash(null), 600);
  }

  /** Scanners type the code and press Enter. An exact UPC, FNSKU or SKU match adds one unit. */
  function onScan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const code = search.trim().toUpperCase();
    const exact = results.find(
      (i) =>
        i.sku.toUpperCase() === code ||
        i.fnsku?.toUpperCase() === code ||
        matchesBarcode(code, [i.product.upc, ...(i.product.gtins ?? [])]),
    );
    const only = results.length === 1 ? results[0] : null;
    const match = exact ?? only;
    if (match) {
      addItem(match);
      setSearch("");
    }
  }

  function removeLine(sku: string) {
    setLines((current) => current.filter((l) => l.sku !== sku));
  }

  function updateLine(sku: string, change: Partial<Line>) {
    setLines((current) => current.map((l) => (l.sku === sku ? { ...l, ...change } : l)));
  }

  /** Templates set the box size and weight, and can also fill the box with their SKUs. */
  async function chooseTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.pack_template_id === id);
    if (!t) return;
    const before = { dims, weight };
    setDims({ length: String(t.length), width: String(t.width), height: String(t.height) });
    if (t.weight) setWeight(String(t.weight));

    const items = await api.listPackTemplateItems(id);
    const added = items.map(({ sku, quantity }) => ({ sku, quantity }));
    // Undo is offered only once the products are in, so it always has something to take back
    if (!items.length) return setApplied({ name: t.pack_template_name, added, before });
    const all = await api.listInventory();
    setLines((current) => {
      const next = current.map((l) => ({ ...l }));
      for (const ti of items) {
        const existing = next.find((l) => l.sku === ti.sku);
        if (existing) {
          existing.quantity += ti.quantity;
          continue;
        }
        const inv = all.find((i) => i.sku === ti.sku);
        next.push({
          sku: ti.sku,
          fnsku: inv?.fnsku ?? null,
          title: inv?.product.title ?? ti.sku,
          quantity: ti.quantity,
          expires: null,
          manufacturing_lot_code: null,
          image_url: inv?.product.images?.[0] ?? null,
          asin: inv?.product.asin ?? null,
          requiresExpiration: Boolean(inv?.product.requires_expiration),
        });
      }
      return next;
    });
    setApplied({ name: t.pack_template_name, added, before });
  }

  /** Takes back what the last template added and restores the size and weight from before it. */
  function undoTemplate() {
    if (!applied) return;
    setLines((current) =>
      current
        .map((l) => {
          const took = applied.added.filter((a) => a.sku === l.sku).reduce((sum, a) => sum + a.quantity, 0);
          return took ? { ...l, quantity: l.quantity - took } : l;
        })
        .filter((l) => l.quantity > 0),
    );
    setDims(applied.before.dims);
    setWeight(applied.before.weight);
    setTemplateId("");
    setApplied(null);
  }

  /** Takes out the products the template added but keeps its size and weight. */
  function keepSizeOnly() {
    if (!applied) return;
    setLines((current) =>
      current
        .map((l) => {
          const took = applied.added.filter((a) => a.sku === l.sku).reduce((sum, a) => sum + a.quantity, 0);
          return took ? { ...l, quantity: l.quantity - took } : l;
        })
        .filter((l) => l.quantity > 0),
    );
    setApplied({ ...applied, added: [] });
  }

  function clearBox() {
    setLines([]);
    setDims({ length: "", width: "", height: "" });
    setWeight("");
    setNotes("");
    setTemplateId("");
    setApplied(null);
    setConfirmClear(false);
  }


  const num = (v: string) => (v.trim() && !Number.isNaN(Number(v)) ? Number(v) : null);

  // Checked on every change, against the templates loaded when the page opened
  const match = useMemo(
    () =>
      matchPackTemplate(
        { length: num(dims.length), width: num(dims.width), height: num(dims.height), weight: num(weight), items: lines },
        templates,
      ),
    [dims, weight, lines, templates],
  );

  // What a new template would be, built from this box
  const newTemplate: NewPackTemplate = {
    pack_template_name: lines.length
      ? suggestTemplateName(lines)
      : `Box ${dims.length || "?"} × ${dims.width || "?"} × ${dims.height || "?"} in`,
    length: num(dims.length) ?? 0,
    width: num(dims.width) ?? 0,
    height: num(dims.height) ?? 0,
    unit_of_measurement: unit,
    weight: num(weight),
    unit_of_weight: "LB",
    items: lines.map((l) => ({ sku: l.sku, quantity: l.quantity })),
  };

  // Templates with products come from boxes packed before; the rest are box sizes
  const productTemplates = templates.filter((t) => (t.items?.length ?? 0) > 0);
  // Smallest to largest, so similar sizes sit together
  const boxSizes = templates
    .filter((t) => !(t.items?.length ?? 0))
    .sort((a, b) => a.length * a.width * a.height - b.length * b.width * b.height);

  /** Fills in a saved box size without touching the products. */
  function applyBoxSize(size: PackTemplate | undefined) {
    setSizeId(size?.pack_template_id ?? "");
    if (!size) return;
    setDims({ length: String(size.length), width: String(size.width), height: String(size.height) });
    if (size.weight) setWeight(String(size.weight));
  }

  async function saveTemplate(template: NewPackTemplate) {
    const created = await api.createPackTemplate(template);
    setTemplates((current) => [...current, created]);
    return created;
  }

  const units = lines.reduce((s, l) => s + l.quantity, 0);
  const missingExpiry = lines.filter((l) => l.requiresExpiration && !l.expires);
  const canSave = lines.length > 0 && missingExpiry.length === 0 && !saving;

  const hint = useMemo(() => {
    if (!lines.length) return "Scan or search for an item to start packing.";
    if (missingExpiry.length) return `Add an expiration date for ${missingExpiry.map((l) => l.title).join(", ")}.`;
    return `${units} ${units === 1 ? "unit" : "units"} of ${lines.length} ${lines.length > 1 ? "products" : "product"}. Ready to seal.`;
  }, [lines, missingExpiry, units]);

  async function seal() {
    setSaving(true);
    setError(null);
    try {
      const tag = await api.createBoxTag({
        items: lines.map((l) => ({
          sku: l.sku,
          fnsku: l.fnsku,
          title: l.title,
          quantity: l.quantity,
          expires: l.expires,
          manufacturing_lot_code: l.manufacturing_lot_code,
          image_url: l.image_url ?? null,
          asin: l.asin ?? null,
        })),
        pack_template_id: match.kind === "match" ? match.template.pack_template_id : templateId || null,
        length: num(dims.length),
        width: num(dims.width),
        height: num(dims.height),
        unit_of_measurement: unit,
        weight: num(weight),
        unit_of_weight: "LB",
        notes: notes.trim(),
      });
      router.push(`/boxes/${tag.box_tag_id}/label?new=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the box");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pack a box</h1>
        <p className="mt-1 text-sm text-navy-soft">
          Scan items into the box. When you seal it, BoxTag gives the box its own barcode so it can
          be stored now and shipped later.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        {/* Inventory */}
        <section className="card min-w-0">
          <label className="label" htmlFor="scan">
            Scan or search inventory
          </label>
          <input
            id="scan"
            ref={searchRef}
            className="input"
            placeholder="Scan a UPC or FNSKU, or type a SKU or product name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={onScan}
            autoComplete="off"
          />
          <ul className="mt-4 max-h-[460px] divide-y divide-line overflow-y-auto">
            {results.map((inv) => {
              const inBox = lines.find((l) => l.sku === inv.sku)?.quantity ?? 0;
              return (
              <li
                key={inv.sku}
                className={`flex flex-wrap items-center gap-3 border-l-4 py-3 pr-1 pl-3 transition ${
                  inBox ? "border-l-navy bg-sky-soft" : "border-l-transparent"
                }`}
              >
                <ProductThumb src={inv.product.images?.[0]} title={inv.product.title} size={44} />
                <div className="min-w-[11rem] flex-1">
                  <p className="truncate text-sm font-semibold">
                    {inv.product.title}
                  </p>
                  <p className="text-xs text-navy-soft">
                    {inv.sku} · {inv.fnsku}
                    {inv.product.upc && ` · UPC ${inv.product.upc}`}
                    {stockText(inv) && ` · ${stockText(inv)}`}
                    {inv.product.requires_expiration && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-butter px-2 py-px font-bold text-white">
                        needs expiry date
                      </span>
                    )}
                  </p>
                </div>
                <div className="ml-auto">
                  {inBox ? (
                    <QuantityPill
                      value={inBox}
                      title={inv.product.title}
                      onChange={(n) => updateLine(inv.sku, { quantity: n })}
                      onRemove={() => removeLine(inv.sku)}
                    />
                  ) : (
                    <AddPill title={inv.product.title} onAdd={() => addItem(inv)} />
                  )}
                </div>
              </li>
              );
            })}
            {results.length === 0 && (
              <li className="py-6 text-center text-sm text-navy-soft">No items match “{search}”.</li>
            )}
          </ul>
        </section>

        {/* The box */}
        <section className="card flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[6px] bg-sky-wash px-3 py-2.5">
            <div className="min-w-0">
              <p className="font-bold">Box sizes only</p>
              <p className="text-xs text-navy-soft">
                {sizeMode ? "Saving measurements, no products." : "Turn on to save or pick a box size without packing."}
              </p>
            </div>
            <Toggle checked={sizeMode} onChange={setSizeMode} label="Box sizes only" />
          </div>

          {sizeMode ? (
            <>
              <h2 className="mt-4 text-lg font-bold">Box sizes</h2>
              <BoxSizes
                sizes={boxSizes}
                onUse={(size) => {
                  applyBoxSize(size);
                  setSizeMode(false);
                }}
                onCreate={async (size) => {
                  const created = await api.createPackTemplate(size);
                  setTemplates((current) => [...current, { ...created, items: [] }]);
                  return created;
                }}
              />
            </>
          ) : (
            <>
              <div className="mt-4 flex items-baseline justify-between">
                <h2 className="text-lg font-bold">This box</h2>
                <span className="flex items-baseline gap-3 text-sm text-navy-soft">
                  {units} {units === 1 ? "unit" : "units"}
                  {(lines.length > 0 || dims.length || weight) && (
                    <button
                      className={`font-semibold underline-offset-2 hover:underline ${confirmClear ? "text-red-deep" : "text-navy"}`}
                      onClick={() => {
                        if (confirmClear) return clearBox();
                        setConfirmClear(true);
                        setTimeout(() => setConfirmClear(false), 3000);
                      }}
                    >
                      {confirmClear ? "Tap again to clear" : "Clear box"}
                    </button>
                  )}
                </span>
              </div>

              <div className="mt-4">
                <label className="text-[15px] font-bold" htmlFor="template">
                  Start from a pack template <span className="font-normal text-navy-soft">(optional)</span>
                </label>
                <select
                  id="template"
                  className="input mt-1.5"
                  value={templateId}
                  onChange={(e) => chooseTemplate(e.target.value)}
                >
                  <option value="">No template</option>
                  {productTemplates.map((t) => (
                    <option key={t.pack_template_id} value={t.pack_template_id}>
                      {t.pack_template_name} ({t.length} × {t.width} × {t.height} in
                      {t.weight ? `, ${t.weight} lb` : ""})
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-sm text-navy-soft">
                  Templates from boxes you packed before. Fills in the products, size and weight.
                </p>
              </div>
              {applied && (
                <div className="mt-3">
                  <Alert tone="info" title={`Template “${applied.name}” applied`} onClose={() => setApplied(null)}>
                    {applied.added.length
                      ? `Added ${applied.added.reduce((sum, a) => sum + a.quantity, 0)} units and set the size and weight. Adjust anything that's different in this box.`
                      : "Set the size and weight."}
                    <span className="mt-1 flex flex-wrap gap-x-4">
                      {applied.added.length > 0 && (
                        <button className="font-bold text-navy underline underline-offset-2" onClick={keepSizeOnly}>
                          Keep size only
                        </button>
                      )}
                      <button className="font-bold text-navy underline underline-offset-2" onClick={undoTemplate}>
                        Undo
                      </button>
                    </span>
                  </Alert>
                </div>
              )}

              <h3 className="mt-6 text-[15px] font-bold">Products in this box</h3>
              {lines.length === 0 ? (
                <div className="mt-2 rounded-[4px] border border-dashed border-[#c5d3dc] bg-sky-wash p-6 text-center text-sm text-navy-soft">
                  Nothing in the box yet. Scan or search for products to add them.
                </div>
              ) : (
                <ul className="mt-2 space-y-3">
                  {lines.map((l) => (
                    <li
                      key={l.sku}
                      className={`rounded-[4px] border border-l-4 border-sky-brand border-l-navy p-3 transition-colors duration-500 ${
                        flash === l.sku ? "bg-sky-brand/60" : "bg-sky-soft"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <ProductThumb src={l.image_url} title={l.title} size={40} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{l.title}</p>
                          <p className="text-xs text-navy-soft">
                            {l.sku} · {l.fnsku}
                          </p>
                        </div>
                        <QuantityPill
                          value={l.quantity}
                          title={l.title}
                          onChange={(n) => updateLine(l.sku, { quantity: n })}
                          onRemove={() => removeLine(l.sku)}
                          trashAtOne={false}
                        />
                        <button
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-navy-soft transition hover:bg-red-soft hover:text-red-deep"
                          onClick={() => removeLine(l.sku)}
                          aria-label={`Remove ${l.title} from the box`}
                          title="Remove from box"
                        >
                          <Icon name="trash" size={18} />
                        </button>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div>
                          <label className="label" htmlFor={`exp-${l.sku}`}>
                            Expires{" "}
                            {l.requiresExpiration ? (
                              <Required />
                            ) : (
                              <span className="font-normal text-navy-soft">(optional)</span>
                            )}
                          </label>
                          <input
                            id={`exp-${l.sku}`}
                            type="date"
                            className={`input ${l.requiresExpiration && !l.expires ? "border-red-brand/60" : ""}`}
                            value={l.expires ?? ""}
                            onChange={(e) => updateLine(l.sku, { expires: e.target.value || null })}
                          />
                        </div>
                        <div>
                          <label className="label" htmlFor={`lot-${l.sku}`}>
                            Lot code <span className="font-normal text-navy-soft">(optional)</span>
                          </label>
                          <input
                            id={`lot-${l.sku}`}
                            className="input"
                            value={l.manufacturing_lot_code ?? ""}
                            onChange={(e) =>
                              updateLine(l.sku, { manufacturing_lot_code: e.target.value || null })
                            }
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="mt-6 text-[15px] font-bold">Box size and weight</h3>
              <div className="mt-2">
                <label className="label" htmlFor="box-size">
                  Use a saved box size <span className="font-normal text-navy-soft">(optional)</span>
                </label>
                <select
                  id="box-size"
                  className="input"
                  value={sizeId}
                  onChange={(e) => applyBoxSize(boxSizes.find((b) => b.pack_template_id === e.target.value))}
                >
                  <option value="">{boxSizes.length ? "Choose a box size" : "No box sizes saved yet"}</option>
                  {boxSizes.map((b) => (
                    <option key={b.pack_template_id} value={b.pack_template_id}>
                      {b.pack_template_name} ({b.length} × {b.width} × {b.height} in{b.weight ? `, ${b.weight} lb` : ""})
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-sm text-navy-soft">
                  Or type the measurements.{" "}
                  <button className="font-semibold text-navy underline underline-offset-2" onClick={() => setSizeMode(true)}>
                    Manage box sizes
                  </button>
                </p>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                  {(["length", "width", "height"] as const).map((k) => (
                    <div key={k}>
                      <label className="label" htmlFor={k}>
                        {{ length: "Length", width: "Width", height: "Height" }[k]} (in)
                      </label>
                      <input
                        id={k}
                        inputMode="decimal"
                        className="input"
                        value={dims[k]}
                        onChange={(e) => {
                          setTemplateId("");
                          setSizeId("");
                          setDims((d) => ({ ...d, [k]: e.target.value }));
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="label" htmlFor="weight">
                    Weight (lb)
                  </label>
                  <input
                    id="weight"
                    inputMode="decimal"
                    className="input"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="notes">
                    Notes <span className="font-normal text-navy-soft">(optional)</span>
                  </label>
                  <input
                    id="notes"
                    className="input"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              {(() => {
                const size = { length: num(dims.length), width: num(dims.width), height: num(dims.height), weight: num(weight) };
                const missing = missingForShipping(size);
                const warnings = sizeWarnings(size);
                return (
                  <>
                    {lines.length > 0 && missing.length > 0 && (
                      <p className="mt-3 flex items-start gap-2 text-sm text-butter">
                        <Icon name="info" size={16} className="mt-0.5 shrink-0" />
                        No {missing.join(" or ")} yet. You can seal now, but you’ll need them before this box can ship.
                      </p>
                    )}
                    {warnings.map((w) => (
                      <p key={w} className="mt-2 text-sm text-butter">
                        {w}
                      </p>
                    ))}
                  </>
                );
              })()}

              <TemplateMatch match={match} draft={newTemplate} onSave={saveTemplate} />

              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-4">
                <p className={`min-w-[14rem] flex-1 text-sm ${missingExpiry.length ? "text-red-brand" : "text-navy-soft"}`}>
                  {hint}
                </p>
                <button
                  className="btn-ghost"
                  disabled={!lines.length}
                  onClick={() => {
                    saveFnskuPrint(lines);
                    window.open("/labels/fnsku", "_blank");
                  }}
                >
                  <Icon name="printer" />
                  Print FNSKU labels ({units})
                </button>
                <button className="btn-accent" disabled={!canSave} onClick={seal}>
                  <Icon name="printer" />
                  {saving ? "Sealing…" : "Seal box and print label"}
                </button>
              </div>
              {error && <p className="mt-2 text-sm text-red-brand">{error}</p>}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/** "48 on hand" for warehouse stock, "12 at Amazon" for FBA items, or nothing when unknown. */
function stockText(inv: InventoryItem) {
  if (inv.quantity != null) return `${inv.quantity} on hand`;
  if (inv.amazon_fulfillable != null) return `${inv.amazon_fulfillable} at Amazon`;
  return null;
}

/** Tells the packer whether this box matches one of the account's pack templates. */
function TemplateMatch({
  match,
  draft,
  onSave,
}: {
  match: MatchResult;
  draft: NewPackTemplate;
  onSave: (template: NewPackTemplate) => Promise<PackTemplate>;
}) {
  const [saved, setSaved] = useState<PackTemplate | null>(null);
  if (match.kind === "empty") return null;

  if (match.kind === "incomplete") {
    return (
      <p className="mt-5 flex items-center gap-2 text-sm text-navy-soft">
        <Icon name="info" size={16} />
        Add the {match.missing.join(" and ")} to check this box against your pack templates.
      </p>
    );
  }

  if (match.kind === "match") {
    const t = match.template;
    return (
      <div role="status" className="mt-5 flex items-start gap-3 rounded-[4px] border border-l-4 border-sky-brand border-l-navy bg-sky-soft px-4 py-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-white">
          <Icon name="check" size={15} />
        </span>
        <div className="min-w-0">
          {saved?.pack_template_id === t.pack_template_id && (
            <p className="text-sm font-bold text-navy-soft">Template saved.</p>
          )}
          <p className="font-bold">Matches pack template “{t.pack_template_name}”</p>
          <p className="text-sm text-navy-soft">
            Same box size, SKUs and quantities, and the weight is within {WEIGHT_TOLERANCE_LB} lb of {t.weight} lb.
            The box will be saved with this template.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div role="status" className="mt-5 rounded-[4px] border border-dashed border-[#b9c8d2] bg-sky-wash px-4 py-3">
      <p className="font-bold">No pack template matches this box</p>
      <p className="text-sm text-navy-soft">
        None of your templates has this size, weight and these products. Save it as a template to reuse it next time.
      </p>
      {saved && (
        <p className="mt-2 text-sm font-bold">
          Saved “{saved.pack_template_name}”{saved.items?.length ? "" : " (size and weight only)"}.
        </p>
      )}
      <SaveTemplateForm draft={draft} onSave={async (t) => setSaved({ ...(await onSave(t)), items: t.items })} />
    </div>
  );
}

/**
 * Names and creates a pack template from the box being packed. With products
 * in the box, it asks whether the template keeps them or only the size.
 */
function SaveTemplateForm({
  draft,
  onSave,
}: {
  draft: NewPackTemplate;
  onSave: (template: NewPackTemplate) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(draft.pack_template_name);
  const [withProducts, setWithProducts] = useState(true);
  const sizeName = `Box ${draft.length} × ${draft.width} × ${draft.height} in`;
  const template: NewPackTemplate = { ...draft, pack_template_name: name.trim(), items: withProducts ? draft.items : [] };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCall, setShowCall] = useState(false);

  if (!open) {
    return (
      <button
        className="btn-primary btn-sm mt-3"
        onClick={() => {
          setName(withProducts ? draft.pack_template_name : sizeName);
          setOpen(true);
        }}
      >
        <Icon name="plus" size={16} />
        Save as pack template
      </button>
    );
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await onSave(template);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save the template");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      {(draft.items ?? []).length > 0 && (
        <fieldset>
          <legend className="label">What should the template keep?</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {[
              { value: false, label: "Size and weight only" },
              { value: true, label: "Size, weight and products" },
            ].map((o) => (
              <label key={o.label} className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="template-keeps"
                  className="accent-navy"
                  checked={withProducts === o.value}
                  onChange={() => {
                    setWithProducts(o.value);
                    // Swap the suggested name too, unless it was edited
                    if (name === draft.pack_template_name || name === sizeName) {
                      setName(o.value ? draft.pack_template_name : sizeName);
                    }
                  }}
                />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <label className="label" htmlFor="template-name">
        Template name
        <Required />
      </label>
      <input
        id="template-name"
        className="input"
        value={name}
        autoFocus
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && name.trim() && save()}
      />
      <p className="text-sm text-navy-soft">
        {draft.length} × {draft.width} × {draft.height} in{draft.weight ? `, ${draft.weight} lb` : ""}
        {withProducts && (draft.items ?? []).length > 0 &&
          `, ${(draft.items ?? []).map((i) => `${i.quantity} × ${i.sku}`).join(", ")}`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary btn-sm" disabled={!name.trim() || busy} onClick={save}>
          {busy ? "Saving…" : "Save template"}
        </button>
        <button className="btn-ghost btn-sm" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
        {IS_DEMO && (
          <button
            className="ml-auto text-sm font-semibold text-navy-soft underline-offset-2 hover:underline"
            onClick={() => setShowCall((v) => !v)}
          >
            {showCall ? "Hide" : "Show"} the ScanPower API call
          </button>
        )}
      </div>
      {showCall && (
        <div className="rounded-[3px] border border-line bg-white p-3 text-xs">
          <p className="mb-1 font-mono font-semibold">POST /v3/pack-template</p>
          <pre className="max-h-56 overflow-auto font-mono text-[11px] leading-relaxed text-navy-soft">
            {JSON.stringify(createPackTemplateBody(template), null, 2)}
          </pre>
        </div>
      )}
      {error && <p className="text-sm text-red-brand">{error}</p>}
    </div>
  );
}

/** A readable default name, like "12 × Insulated Water Bottle 32 oz, Sage". */
function suggestTemplateName(lines: { quantity: number; title: string }[]) {
  const name = lines.map((l) => `${l.quantity} × ${l.title}`).join(" + ");
  return name.length > 80 ? `${name.slice(0, 78).trimEnd()}…` : name;
}
