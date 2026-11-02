"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api/client";
import { earliestExpiry, formatDate, totalUnits } from "@/lib/format";
import type { BoxTag, BoxTagStatus, Location } from "@/lib/types";

const filters: { value: BoxTagStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "packed", label: "Not put away" },
  { value: "stored", label: "Stored" },
  { value: "shipped", label: "Shipped" },
];

export default function BoxesPage() {
  const [boxes, setBoxes] = useState<BoxTag[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [filter, setFilter] = useState<BoxTagStatus | "all">("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    api.listBoxTags().then(setBoxes);
    api.listLocations().then(setLocations);
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return boxes.filter(
      (b) =>
        (filter === "all" || b.status === filter) &&
        (!q ||
          b.box_tag_id.toLowerCase().includes(q) ||
          b.items.some((i) => [i.sku, i.fnsku ?? "", i.title].some((v) => v.toLowerCase().includes(q)))),
    );
  }, [boxes, filter, query]);

  const where = (b: BoxTag) =>
    b.status === "shipped"
      ? b.shipment_id
      : (locations.find((l) => l.location_id === b.location_id)?.location_name ?? "Not put away");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-bold">Boxes</h1>
          <p className="mt-1 text-sm text-navy-soft">Every sealed box, where it is, and what’s in it.</p>
        </div>
        <Link href="/pack" className="btn-primary ml-auto">
          Pack a box
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              filter === f.value ? "bg-navy text-white" : "bg-white text-navy-soft ring-1 ring-line hover:bg-sky-soft"
            }`}
          >
            {f.label}
          </button>
        ))}
        <input
          className="input ml-auto max-w-xs"
          placeholder="Find a box by ID, SKU or product"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((b) => {
          const expiry = earliestExpiry(b);
          return (
            <Link
              key={b.box_tag_id}
              href={`/boxes/${b.box_tag_id}`}
              className="card block transition hover:-translate-y-0.5 hover:border-sky-brand"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-lg font-bold">{b.box_tag_id}</span>
                <StatusBadge status={b.status} />
              </div>
              <p className="mt-3 line-clamp-2 text-sm">{b.items.map((i) => `${i.quantity} × ${i.title}`).join(", ")}</p>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-navy-soft">
                <span>{totalUnits(b)} units</span>
                <span>{where(b)}</span>
                <span>Packed {formatDate(b.packed_at)}</span>
                {expiry && <span className="text-butter">Expires {formatDate(expiry)}</span>}
              </div>
            </Link>
          );
        })}
      </div>
      {shown.length === 0 && (
        <p className="card text-center text-sm text-navy-soft">No boxes match. Try another filter or search.</p>
      )}
    </div>
  );
}
