"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/Alert";
import { Icon } from "@/components/Icon";
import { ProductThumb } from "@/components/ProductThumb";
import { api } from "@/lib/api/client";
import { createPackTemplateBody } from "@/lib/api/payloads";
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
  const [lines, setLines] = useState<Line[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [dims, setDims] = useState({ length: "", width: "", height: "" });
  const [unit] = useState<UnitOfMeasurement>("IN");
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [templateNote, setTemplateNote] = useState<string | null>(null);
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
          image_url: inv.product.images?.[0] ?? null,
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
    const exact = results.find((i) => i.sku === code || i.fnsku === code || i.product.upc === code);
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
    setTemplateNote(null);
    const t = templates.find((x) => x.pack_template_id === id);
    if (!t) return;
    setDims({ length: String(t.length), width: String(t.width), height: String(t.height) });
    if (t.weight) setWeight(String(t.weight));

    const items = await api.listPackTemplateItems(id);
    if (!items.length) return;
    const all = await api.listInventory();
    setLines((current) => {
      const next = [...current];
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
          requiresExpiration: Boolean(inv?.product.requires_expiration),
        });
      }
      return next.map((l) => ({ ...l }));
    });
    const units = items.reduce((sum, i) => sum + i.quantity, 0);
    setTemplateNote(
      `Added ${units} units from “${t.pack_template_name}”. Adjust the quantities if this box is different.`,
    );
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
    pack_template_name: suggestTemplateName(lines),
    length: num(dims.length) ?? 0,
    width: num(dims.width) ?? 0,
    height: num(dims.height) ?? 0,
    unit_of_measurement: unit,
    weight: num(weight),
    unit_of_weight: "LB",
    items: lines.map((l) => ({ sku: l.sku, quantity: l.quantity })),
  };

  async function saveTemplate(name: string) {
    const created = await api.createPackTemplate({ ...newTemplate, pack_template_name: name });
    setTemplates((current) => [...current, created]);
    return created;
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
      const tag = await api.createBoxTag({
        items: lines.map((l) => ({
          sku: l.sku,
          fnsku: l.fnsku,
          title: l.title,
          quantity: l.quantity,
          expires: l.expires,
          manufacturing_lot_code: l.manufacturing_lot_code,
          image_url: l.image_url ?? null,
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
                className={`flex items-center gap-3 border-l-4 py-3 pr-1 pl-3 transition ${
                  inBox ? "border-l-navy bg-sky-soft" : "border-l-transparent"
                }`}
              >
                <ProductThumb src={inv.product.images?.[0]} title={inv.product.title} size={44} />
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
                    {inv.sku} · {inv.fnsku}
                    {inv.product.upc && ` · UPC ${inv.product.upc}`} · {inv.quantity} on hand
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

          <div className="mt-3">
            <label className="label" htmlFor="template">
              Pack template
            </label>
            <select
              id="template"
              className="input"
              value={templateId}
              onChange={(e) => chooseTemplate(e.target.value)}
            >
              <option value="">None, I’ll pack it myself (custom size)</option>
              {templates.map((t) => (
                <option key={t.pack_template_id} value={t.pack_template_id}>
                  {t.pack_template_name} ({t.length} × {t.width} × {t.height} in
                  {t.weight ? `, ${t.weight} lb` : ""})
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-sm text-navy-soft">
              A template sets the box size and weight, and fills in its SKUs if it has any.
            </p>
          </div>
          {templateNote && (
            <div className="mt-3">
              <Alert tone="info" title="Template applied" onClose={() => setTemplateNote(null)}>
                {templateNote}
              </Alert>
            </div>
          )}

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
                    <ProductThumb src={l.image_url} title={l.title} size={40} />
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
              FNSKU labels ({units})
            </button>
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

/** Tells the packer whether this box matches one of the account's pack templates. */
function TemplateMatch({
  match,
  draft,
  onSave,
}: {
  match: MatchResult;
  draft: NewPackTemplate;
  onSave: (name: string) => Promise<PackTemplate>;
}) {
  const [saved, setSaved] = useState<string | null>(null);
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
          {saved === t.pack_template_id && <p className="text-sm font-bold text-navy-soft">Template saved.</p>}
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
        None of your templates has this box size, weight, and these SKUs and quantities. Save it as a template so
        boxes packed the same way are recognized next time.
      </p>
      <SaveTemplateForm draft={draft} onSave={async (name) => setSaved((await onSave(name)).pack_template_id)} />
    </div>
  );
}

/** Names and creates a pack template from the box being packed. */
function SaveTemplateForm({ draft, onSave }: { draft: NewPackTemplate; onSave: (name: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(draft.pack_template_name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCall, setShowCall] = useState(false);

  if (!open) {
    return (
      <button
        className="btn-primary btn-sm mt-3"
        onClick={() => {
          setName(draft.pack_template_name);
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
      await onSave(name.trim());
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save the template");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <label className="label" htmlFor="template-name">
        Template name
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
        {draft.length} × {draft.width} × {draft.height} in, {draft.weight} lb,{" "}
        {(draft.items ?? []).map((i) => `${i.quantity} × ${i.sku}`).join(", ")}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary btn-sm" disabled={!name.trim() || busy} onClick={save}>
          {busy ? "Saving…" : "Save template"}
        </button>
        <button className="btn-ghost btn-sm" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
        <button
          className="ml-auto text-sm font-semibold text-navy-soft underline-offset-2 hover:underline"
          onClick={() => setShowCall((v) => !v)}
        >
          {showCall ? "Hide" : "Show"} the ScanPower API call
        </button>
      </div>
      {showCall && (
        <div className="rounded-[3px] border border-line bg-white p-3 text-xs">
          <p className="mb-1 font-mono font-semibold">POST /v3/pack-template</p>
          <pre className="max-h-56 overflow-auto font-mono text-[11px] leading-relaxed text-navy-soft">
            {JSON.stringify(createPackTemplateBody({ ...draft, pack_template_name: name.trim() }), null, 2)}
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
