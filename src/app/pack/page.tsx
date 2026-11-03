"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { api } from "@/lib/api/client";
import type { BoxTagItem, InventoryItem, PackTemplate, UnitOfMeasurement } from "@/lib/types";

type Line = BoxTagItem & { requiresExpiration: boolean };

export default function PackPage() {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<InventoryItem[]>([]);
  const [templates, setTemplates] = useState<PackTemplate[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [dims, setDims] = useState({ length: "", width: "", height: "" });
  const [unit] = useState<UnitOfMeasurement>("IN");
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
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

  function addItem(inv: InventoryItem) {
    setLines((current) => {
      const existing = current.find((l) => l.sku === inv.sku);
      if (existing) {
        return current.map((l) => (l.sku === inv.sku ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...current,
        {
          sku: inv.sku,
          fnsku: inv.fnsku,
          title: inv.product.title,
          quantity: 1,
          expires: null,
          manufacturing_lot_code: null,
          requiresExpiration: Boolean(inv.product.requires_expiration),
        },
      ];
    });
    setFlash(inv.sku);
    setTimeout(() => setFlash(null), 600);
  }

  /** Scanners type the code and press Enter. An exact SKU or FNSKU match adds one unit. */
  function onScan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const code = search.trim().toUpperCase();
    const exact = results.find((i) => i.sku === code || i.fnsku === code);
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

  function chooseTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.pack_template_id === id);
    if (t) setDims({ length: String(t.length), width: String(t.width), height: String(t.height) });
  }

  const units = lines.reduce((s, l) => s + l.quantity, 0);
  const missingExpiry = lines.filter((l) => l.requiresExpiration && !l.expires);
  const canSave = lines.length > 0 && missingExpiry.length === 0 && !saving;

  const hint = useMemo(() => {
    if (!lines.length) return "Scan or search for an item to start packing.";
    if (missingExpiry.length) return `Add an expiration date for ${missingExpiry.map((l) => l.sku).join(", ")}.`;
    return `${units} ${units === 1 ? "unit" : "units"} across ${lines.length} SKU${lines.length > 1 ? "s" : ""}. Ready to seal.`;
  }, [lines, missingExpiry, units]);

  async function seal() {
    setSaving(true);
    setError(null);
    try {
      const num = (v: string) => (v.trim() ? Number(v) : null);
      const tag = await api.createBoxTag({
        items: lines.map((l) => ({
          sku: l.sku,
          fnsku: l.fnsku,
          title: l.title,
          quantity: l.quantity,
          expires: l.expires,
          manufacturing_lot_code: l.manufacturing_lot_code,
        })),
        pack_template_id: templateId || null,
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
            placeholder="Scan an FNSKU or type a SKU or product name"
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
                className={`flex items-center gap-3 border-l-4 py-3 pr-1 pl-3 transition ${
                  inBox ? "border-l-navy bg-sky-soft" : "border-l-transparent"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {inv.product.title}
                    {inBox > 0 && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-navy px-2 py-px align-middle text-xs font-bold text-white">
                        <Icon name="check" size={12} />
                        {inBox} in box
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-navy-soft">
                    {inv.sku} · {inv.fnsku} · {inv.quantity} on hand
                    {inv.product.requires_expiration && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-butter/60 bg-butter-soft px-2 py-px font-bold text-butter">
                        <span className="h-1.5 w-1.5 rounded-full bg-butter" />
                        needs expiry
                      </span>
                    )}
                  </p>
                </div>
                <button className="btn-ghost btn-sm" onClick={() => addItem(inv)}>
                  <Icon name="plus" size={16} />
                  {inBox ? "Add 1" : "Add"}
                </button>
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
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-bold">This box</h2>
            <span className="text-sm text-navy-soft">
              {units} {units === 1 ? "unit" : "units"}
            </span>
          </div>

          {lines.length === 0 ? (
            <div className="mt-4 rounded-[4px] border border-dashed border-[#c5d3dc] bg-sky-wash p-8 text-center text-sm text-navy-soft">
              Nothing in the box yet.
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {lines.map((l) => (
                <li
                  key={l.sku}
                  className={`rounded-[4px] border border-l-4 border-sky-brand border-l-navy p-3 transition-colors duration-500 ${
                    flash === l.sku ? "bg-sky-brand/60" : "bg-sky-soft"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{l.title}</p>
                      <p className="text-xs text-navy-soft">
                        {l.sku} · {l.fnsku}
                      </p>
                    </div>
                    <Stepper
                      value={l.quantity}
                      onChange={(q) => (q <= 0 ? removeLine(l.sku) : updateLine(l.sku, { quantity: q }))}
                    />
                    <button
                      className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-transparent text-navy-soft transition hover:border-red-brand/40 hover:bg-red-soft hover:text-red-brand"
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
                        Expires {l.requiresExpiration && <span className="text-red-brand">*</span>}
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
                        Lot code
                      </label>
                      <input
                        id={`lot-${l.sku}`}
                        className="input"
                        placeholder="Optional"
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

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="template">
                Box size
              </label>
              <select
                id="template"
                className="input"
                value={templateId}
                onChange={(e) => chooseTemplate(e.target.value)}
              >
                <option value="">Custom size</option>
                {templates.map((t) => (
                  <option key={t.pack_template_id} value={t.pack_template_id}>
                    {t.pack_template_name}
                  </option>
                ))}
              </select>
            </div>
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
                Notes
              </label>
              <input
                id="notes"
                className="input"
                placeholder="Optional"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <p className={`flex-1 text-sm ${missingExpiry.length ? "text-red-brand" : "text-navy-soft"}`}>
              {hint}
            </p>
            <button className="btn-accent" disabled={!canSave} onClick={seal}>
              <Icon name="printer" />
              {saving ? "Sealing…" : "Seal box and print label"}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-brand">{error}</p>}
        </section>
      </div>
    </div>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center rounded-full border border-line">
      <button
        className="h-8 w-8 rounded-full text-lg leading-none hover:bg-sky-soft"
        aria-label="One less"
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <input
        className="w-12 bg-transparent text-center text-sm font-semibold outline-none"
        inputMode="numeric"
        value={value}
        aria-label="Quantity"
        onChange={(e) => onChange(Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0))}
      />
      <button
        className="h-8 w-8 rounded-full text-lg leading-none hover:bg-sky-soft"
        aria-label="One more"
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}
