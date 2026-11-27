"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Required } from "@/components/Required";
import type { NewPackTemplate, PackTemplate } from "@/lib/types";

/*
 * Box sizes: pack templates that keep only measurements, no products.
 * Lists the saved ones with "Use this size", and adds new ones without
 * packing anything first.
 */
export function BoxSizes({
  sizes,
  onUse,
  onCreate,
}: {
  sizes: PackTemplate[];
  onUse: (size: PackTemplate) => void;
  onCreate: (size: NewPackTemplate) => Promise<PackTemplate>;
}) {
  const [form, setForm] = useState({ name: "", length: "", width: "", height: "", weight: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Search by name or measurement, for example "mailer" or "12"
  const q = query.trim().toLowerCase();
  const shown = q
    ? sizes.filter((s) =>
        `${s.pack_template_name} ${s.length} × ${s.width} × ${s.height} ${s.length}x${s.width}x${s.height}`
          .toLowerCase()
          .includes(q),
      )
    : sizes;

  const num = (v: string) => (v.trim() && Number(v) > 0 ? Number(v) : null);
  const [l, w, h] = [num(form.length), num(form.width), num(form.height)];
  const suggested = l && w && h ? `Box ${l} × ${w} × ${h} in` : "";
  const ready = l && w && h && !busy;

  async function save() {
    if (!l || !w || !h) return;
    setBusy(true);
    setError(null);
    try {
      const created = await onCreate({
        pack_template_name: form.name.trim() || suggested,
        length: l,
        width: w,
        height: h,
        unit_of_measurement: "IN",
        weight: num(form.weight),
        unit_of_weight: "LB",
        items: [],
      });
      setSaved(created.pack_template_name);
      setForm({ name: "", length: "", width: "", height: "", weight: "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save the box size.");
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof typeof form, label: string, required = false) => (
    <div>
      <label className="label" htmlFor={`size-${key}`}>
        {label}
        {required && <Required />}
      </label>
      <input
        id={`size-${key}`}
        className="input"
        inputMode={key === "name" ? undefined : "decimal"}
        placeholder={key === "name" ? suggested || "For example, Small mailer" : undefined}
        value={form[key]}
        onChange={(e) => {
          setSaved(null);
          setForm((f) => ({ ...f, [key]: e.target.value }));
        }}
      />
    </div>
  );

  return (
    <div className="mt-4 space-y-6">
      <section>
        <h3 className="text-[15px] font-bold">
          Your saved box sizes{" "}
          {sizes.length > 0 && <span className="font-normal text-navy-soft">({sizes.length})</span>}
        </h3>
        {sizes.length > 6 && (
          <input
            className="input mt-2"
            placeholder="Search by name or size, like 12 or mailer"
            aria-label="Search box sizes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
        {sizes.length === 0 ? (
          <p className="mt-2 rounded-[4px] border border-dashed border-[#c5d3dc] bg-sky-wash p-5 text-center text-sm text-navy-soft">
            No box sizes saved yet. Add one below.
          </p>
        ) : (
          <ul className="mt-2 max-h-[21rem] divide-y divide-line overflow-y-auto rounded-[4px] border border-line">
            {shown.length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-navy-soft">No box size matches “{query.trim()}”.</li>
            )}
            {shown.map((s) => (
              <li key={s.pack_template_id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <div className="min-w-[10rem] flex-1">
                  <p className="text-sm font-semibold">{s.pack_template_name}</p>
                  <p className="text-xs text-navy-soft">
                    {s.length} × {s.width} × {s.height} in{s.weight ? `, ${s.weight} lb` : ""}
                  </p>
                </div>
                <button className="btn-ghost btn-sm ml-auto" onClick={() => onUse(s)}>
                  Use this size
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-[15px] font-bold">Add a box size</h3>
        <p className="mt-0.5 text-sm text-navy-soft">Just the measurements. No products needed.</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {field("length", "Length (in)", true)}
          {field("width", "Width (in)", true)}
          {field("height", "Height (in)", true)}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr]">
          {field("weight", "Weight (lb, optional)")}
          {field("name", "Name (optional)")}
        </div>
        <button className="btn-primary mt-4 w-full" disabled={!ready} onClick={save}>
          <Icon name="plus" size={18} />
          {busy ? "Saving…" : "Save box size"}
        </button>
        {saved && (
          <p role="status" className="mt-2 text-sm font-semibold text-navy">
            Saved “{saved}”. It’s in the list above.
          </p>
        )}
        {error && <p className="mt-2 text-sm font-semibold text-red-deep">{error}</p>}
      </section>
    </div>
  );
}
