"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert } from "@/components/Alert";
import { Icon } from "@/components/Icon";
import { ProductThumb } from "@/components/ProductThumb";
import { api } from "@/lib/api/client";
import { totalUnits } from "@/lib/format";
import type { BoxTag, InventoryItem, ItemLocation, Location } from "@/lib/types";

/*
 * Every warehouse location, what ScanPower has there, and which BoxTag boxes
 * are there. Read only: nothing on this page changes ScanPower.
 */

type Product = { title: string; image: string | null };

export default function LocationsPage() {
  return (
    <Suspense>
      <Locations />
    </Suspense>
  );
}

function Locations() {
  const router = useRouter();
  const selectedId = useSearchParams().get("id");

  const [locations, setLocations] = useState<Location[] | null>(null);
  const [rows, setRows] = useState<ItemLocation[]>([]);
  const [boxes, setBoxes] = useState<BoxTag[]>([]);
  const [products, setProducts] = useState<Map<string, Product>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.listLocations(), api.listItemLocations(), api.listBoxTags(), api.listInventory()])
      .then(([locs, items, tags, inventory]) => {
        setLocations(locs);
        setRows(items);
        setBoxes(tags);
        setProducts(productMap(inventory));
      })
      .catch((e) => {
        setLocations([]);
        setError(e instanceof Error ? e.message : "Couldn’t load locations.");
      });
  }, []);

  const name = (id: string) => locations?.find((l) => l.location_id === id)?.location_name ?? id;
  const detailRef = useRef<HTMLElement>(null);
  const picked = useRef(false);
  const select = (id: string) => {
    picked.current = true;
    router.replace(`/locations?id=${encodeURIComponent(id)}`, { scroll: false });
  };

  // On phones the details sit below the list, so bring them into view after a tap
  useEffect(() => {
    if (!picked.current || !selectedId) return;
    picked.current = false;
    if (window.matchMedia("(max-width: 1023px)").matches) detailRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedId]);

  const summaries = useMemo(
    () =>
      (locations ?? []).map((loc) => {
        const here = rows.filter((r) => r.location_id === loc.location_id && r.fulfillable > 0);
        const boxesHere = boxes.filter((b) => b.status === "stored" && b.location_id === loc.location_id);
        return {
          loc,
          units: here.reduce((s, r) => s + r.fulfillable, 0),
          skus: here.length,
          boxes: boxesHere.length,
          mismatches: mismatches(here, boxesHere),
        };
      }),
    [locations, rows, boxes],
  );

  const selected = summaries.find((s) => s.loc.location_id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Locations</h1>
        <p className="mt-1 text-sm text-navy-soft">
          What ScanPower has at each warehouse location, and which BoxTag boxes are there.
        </p>
      </div>

      {error && (
        <Alert tone="error" title="Couldn’t load locations">
          {error}
        </Alert>
      )}

      <FindSku products={products} name={name} onPick={select} />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className="card min-w-0">
          <h2 className="text-lg font-bold">All locations</h2>
          {locations === null && <p className="mt-3 text-sm text-navy-soft">Loading…</p>}
          {locations?.length === 0 && !error && (
            <p className="mt-3 text-sm text-navy-soft">ScanPower has no locations for this account yet.</p>
          )}
          <ul className="mt-3 space-y-2">
            {summaries.map((s) => {
              const active = s.loc.location_id === selectedId;
              return (
                <li key={s.loc.location_id}>
                  <button
                    onClick={() => select(s.loc.location_id)}
                    aria-current={active ? "true" : undefined}
                    className={`flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left transition ${
                      active ? "border-navy bg-sky-soft" : "border-line bg-white hover:bg-sky-wash"
                    }`}
                  >
                    <Icon name="pin" size={20} className="text-navy-soft" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{s.loc.location_name}</span>
                        <span className="text-xs text-navy-soft">{s.loc.location_type}</span>
                        {s.mismatches.length > 0 && (
                          <span className="rounded-full bg-butter px-2 py-px text-xs font-bold text-white">
                            Doesn’t match
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-sm text-navy-soft">
                        {s.units} units · {s.skus} {s.skus === 1 ? "SKU" : "SKUs"} · {s.boxes}{" "}
                        {s.boxes === 1 ? "box" : "boxes"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section ref={detailRef} className="card min-w-0 scroll-mt-24">
          {selected ? (
            <LocationDetail
              loc={selected.loc}
              rows={rows.filter((r) => r.location_id === selected.loc.location_id && r.fulfillable > 0)}
              boxes={boxes.filter((b) => b.status === "stored" && b.location_id === selected.loc.location_id)}
              mismatches={selected.mismatches}
              products={products}
            />
          ) : (
            <p className="text-sm text-navy-soft">Choose a location to see what’s there.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function LocationDetail({
  loc,
  rows,
  boxes,
  mismatches,
  products,
}: {
  loc: Location;
  rows: ItemLocation[];
  boxes: BoxTag[];
  mismatches: Mismatch[];
  products: Map<string, Product>;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-md bg-sky-soft px-4 py-3">
        <Icon name="pin" size={22} className="text-navy" />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-navy-soft">{loc.location_type}</p>
          <p className="text-xl font-bold leading-tight">{loc.location_name}</p>
        </div>
      </div>

      {mismatches.length > 0 && (
        <Alert tone="warning" title="BoxTag and ScanPower don’t match here">
          <ul className="space-y-0.5">
            {mismatches.map((m) => (
              <li key={m.sku}>
                Boxes here hold {m.inBoxes} of <span className="font-mono text-xs">{m.sku}</span>, but ScanPower shows{" "}
                {m.inScanPower}.
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <div>
        <h3 className="font-bold">In ScanPower</h3>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-navy-soft">ScanPower shows nothing at this location.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {rows.map((r) => {
              const p = products.get(r.sku);
              return (
                <li key={r.sku} className="flex items-center gap-3 py-2.5">
                  <ProductThumb src={p?.image} title={p?.title ?? r.sku} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p?.title ?? r.sku}</span>
                    {p && <span className="block font-mono text-xs text-navy-soft">{r.sku}</span>}
                  </span>
                  <span className="font-bold">{r.fulfillable}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <h3 className="font-bold">BoxTag boxes here</h3>
        {boxes.length === 0 ? (
          <p className="mt-2 text-sm text-navy-soft">No sealed boxes are recorded at this location.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {boxes.map((b) => (
              <li key={b.box_tag_id}>
                <Link
                  href={`/boxes/${b.box_tag_id}`}
                  className="flex items-center gap-3 py-2.5 transition hover:bg-sky-wash"
                >
                  <span className="font-mono font-bold">{b.box_tag_id}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-navy-soft">
                    {b.items.map((i) => `${i.quantity} × ${i.title}`).join(", ")}
                  </span>
                  <span className="text-sm font-semibold">{totalUnits(b)} units</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Search by SKU, product name, FNSKU or UPC, then list every location that holds the matching SKUs. */
function FindSku({
  products,
  name,
  onPick,
}: {
  products: Map<string, Product>;
  name: (id: string) => string;
  onPick: (locationId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ sku: string; title: string; image: string | null; at: ItemLocation[] }[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  async function find(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setBusy(true);
    setError(null);
    try {
      // Turn what was typed into SKUs, keeping what was typed in case it's already a SKU
      const matches = await api.listInventory(q);
      const skus = [...new Set([...matches.map((m) => m.sku), q])].slice(0, 10);
      const found = productMap(matches);
      const lists = await Promise.all(skus.map((sku) => api.listItemLocations(sku)));
      setResults(
        skus
          .map((sku, n) => {
            const p = found.get(sku) ?? products.get(sku);
            return { sku, title: p?.title ?? sku, image: p?.image ?? null, at: lists[n].filter((r) => r.fulfillable > 0) };
          })
          .filter((r) => r.at.length > 0 || found.has(r.sku)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
      setResults(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2 className="text-lg font-bold">Find a SKU</h2>
      <form onSubmit={find} className="mt-3 flex gap-2">
        <label htmlFor="find-sku" className="sr-only">
          SKU, product name, FNSKU or UPC
        </label>
        <input
          id="find-sku"
          className="input"
          placeholder="SKU, product name, FNSKU or UPC"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn-primary shrink-0" disabled={!query.trim() || busy}>
          {busy ? "Finding…" : "Find"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-brand">{error}</p>}
      {results?.length === 0 && <p className="mt-3 text-sm text-navy-soft">No product or SKU matches “{query.trim()}”.</p>}

      {results && results.length > 0 && (
        <ul className="mt-4 space-y-3">
          {results.map((r) => (
            <li key={r.sku} className="rounded-md border border-line p-3">
              <div className="flex items-center gap-3">
                <ProductThumb src={r.image} title={r.title} size={40} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.title}</p>
                  <p className="font-mono text-xs text-navy-soft">{r.sku}</p>
                </div>
              </div>
              {r.at.length === 0 ? (
                <p className="mt-2 text-sm text-navy-soft">Not at any location in ScanPower.</p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {r.at.map((a) => (
                    <li key={a.location_id}>
                      <button
                        onClick={() => onPick(a.location_id)}
                        className="rounded-full border border-line bg-sky-wash px-3 py-1 text-sm transition hover:border-navy"
                      >
                        <span className="font-semibold">{name(a.location_id)}</span> · {a.fulfillable}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Mismatch = { sku: string; inBoxes: number; inScanPower: number };

/** SKUs where the boxes recorded at a location hold more units than ScanPower shows there. */
function mismatches(rows: ItemLocation[], boxes: BoxTag[]): Mismatch[] {
  const inBoxes = new Map<string, number>();
  for (const b of boxes) for (const i of b.items) inBoxes.set(i.sku, (inBoxes.get(i.sku) ?? 0) + i.quantity);
  return [...inBoxes]
    .map(([sku, units]) => ({
      sku,
      inBoxes: units,
      inScanPower: rows.filter((r) => r.sku === sku).reduce((s, r) => s + r.fulfillable, 0),
    }))
    .filter((m) => m.inBoxes > m.inScanPower);
}

function productMap(items: InventoryItem[]) {
  return new Map(items.map((i) => [i.sku, { title: i.product.title, image: i.product.images?.[0] ?? null }]));
}
