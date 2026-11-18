"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Alert } from "@/components/Alert";
import { FnskuLabel } from "@/components/FnskuLabel";
import { Icon } from "@/components/Icon";
import { api } from "@/lib/api/client";
import { loadFnskuPrint, type FnskuPrintItem } from "@/lib/fnsku-print";

/** Prints one FNSKU label per unit, from a sealed box (?box=BT-...) or from the box being packed. */
export default function FnskuLabelsPage({ searchParams }: { searchParams: Promise<{ box?: string }> }) {
  const { box } = use(searchParams);
  const [items, setItems] = useState<FnskuPrintItem[] | null>(null);

  useEffect(() => {
    if (box) {
      api.getBoxTag(box).then((tag) => setItems(tag?.items ?? []));
    } else {
      setItems(loadFnskuPrint());
    }
  }, [box]);

  if (!items) return <p className="text-navy-soft">Loading…</p>;

  const printable = items.filter((i) => i.fnsku);
  const missing = items.filter((i) => !i.fnsku);
  const labels = printable.flatMap((i) => Array.from({ length: i.quantity }, () => i));

  return (
    <div className="space-y-6">
      {/* Each label prints on its own 2.25 x 1.25 in page */}
      <style>{`@media print { @page { size: 2.25in 1.25in; margin: 0; } .fnsku-wrap:not(:last-child) { break-after: page; } }`}</style>

      <div className="no-print flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-bold">FNSKU labels</h1>
          <p className="mt-1 text-sm text-navy-soft">
            {labels.length} labels, one for every unit. 2.25 × 1.25 in, for Rollo, Zebra and DYMO
            thermal printers.
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Link href={box ? `/boxes/${box}` : "/pack"} className="btn-ghost">
            Back
          </Link>
          <button className="btn-accent" onClick={() => window.print()} disabled={!labels.length}>
            <Icon name="printer" />
            Print {labels.length} labels
          </button>
        </div>
      </div>

      {missing.length > 0 && (
        <div className="no-print">
          <Alert tone="warning" title="Some items have no FNSKU">
            {missing.map((i) => i.sku).join(", ")} can’t get an Amazon label until they have an FNSKU.
          </Alert>
        </div>
      )}

      {labels.length === 0 ? (
        <p className="card no-print text-center text-navy-soft">Nothing to print yet. Add items to the box first.</p>
      ) : (
        <div className="flex flex-wrap gap-3 print:block">
          {labels.map((l, n) => (
            <div key={n} className="fnsku-wrap border border-[#c5d3dc] print:border-0">
              <FnskuLabel fnsku={l.fnsku!} title={l.title} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
