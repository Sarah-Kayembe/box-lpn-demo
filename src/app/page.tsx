"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api/client";
import { formatDate, totalUnits } from "@/lib/format";
import type { BoxTag } from "@/lib/types";

const steps = [
  { title: "Pack", text: "Scan items into a box and seal it." },
  { title: "Label", text: "Print one 4 × 6 barcode for the box and everything in it." },
  { title: "Store", text: "Put it on a shelf. The label remembers where." },
  { title: "Ship", text: "Scan it later and add the whole box to a shipment." },
];

export default function Home() {
  const [boxes, setBoxes] = useState<BoxTag[]>([]);

  useEffect(() => {
    api.listBoxTags().then(setBoxes);
  }, []);

  const stored = boxes.filter((b) => b.status === "stored");
  const waiting = boxes.filter((b) => b.status === "packed");
  const unitsOnShelves = stored.reduce((s, b) => s + totalUnits(b), 0);

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl bg-sky-brand/60 p-6 sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-widest text-navy-soft">Pack now, ship later</p>
        <h1 className="mt-2 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
          One barcode for the box and everything inside it.
        </h1>
        <p className="mt-3 max-w-xl text-navy-soft">
          Pack ahead of time, store boxes on your shelves, and ship them whenever the shipment is
          ready, without opening a single box to check what’s in it.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/pack" className="btn-primary">
            Pack a box
          </Link>
          <Link href="/scan" className="btn-ghost">
            Scan a box
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Boxes on shelves" value={stored.length} />
        <Stat label="Units on shelves" value={unitsOnShelves} />
        <Stat label="Waiting to be put away" value={waiting.length} tone={waiting.length ? "warn" : undefined} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, n) => (
          <div key={s.title} className="card">
            <span className="text-sm font-bold text-red-brand">Step {n + 1}</span>
            <p className="mt-1 text-lg font-bold">{s.title}</p>
            <p className="mt-1 text-sm text-navy-soft">{s.text}</p>
          </div>
        ))}
      </section>

      <section className="card">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">Recent boxes</h2>
          <Link href="/boxes" className="text-sm font-semibold text-navy-soft hover:text-navy">
            See all
          </Link>
        </div>
        <ul className="mt-3 divide-y divide-line">
          {boxes.slice(0, 5).map((b) => (
            <li key={b.box_tag_id}>
              <Link href={`/boxes/${b.box_tag_id}`} className="flex flex-wrap items-center gap-3 py-3 hover:bg-sky-wash">
                <span className="font-mono font-bold">{b.box_tag_id}</span>
                <span className="text-sm text-navy-soft">
                  {totalUnits(b)} units · packed {formatDate(b.packed_at)}
                </span>
                <span className="ml-auto">
                  <StatusBadge status={b.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <button
          className="mt-4 text-xs font-semibold text-navy-soft hover:text-navy"
          onClick={async () => {
            await api.resetDemo();
            setBoxes(await api.listBoxTags());
          }}
        >
          Reset demo data
        </button>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className={`card ${tone === "warn" ? "bg-butter-soft" : ""}`}>
      <p className="text-sm text-navy-soft">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </div>
  );
}
