"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { BoxLabel } from "@/components/BoxLabel";
import { api } from "@/lib/api/client";
import { totalUnits } from "@/lib/format";
import { useBoxTag } from "@/lib/useBoxTag";

export default function LabelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { id } = use(params);
  const isNew = use(searchParams).new === "1";
  const { box, locationName, loading, reload } = useBoxTag(id);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  if (loading) return <p className="text-navy-soft">Loading…</p>;
  if (!box) return <NotFound id={id} />;

  async function print() {
    window.print();
    await api.markLabelPrinted(box!.box_tag_id);
    reload();
  }

  return (
    <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center">
      <div className="no-print w-full max-w-sm space-y-4 lg:order-2">
        {isNew && (
          <div className="rounded-2xl bg-mint-soft p-4 text-sm text-mint">
            <p className="font-bold">Box {box.box_tag_id} is sealed.</p>
            <p className="mt-1">
              {totalUnits(box)} units are now tied to this one barcode. Print the label and stick it
              on the box.
            </p>
          </div>
        )}
        <div className="card space-y-3">
          <h1 className="text-xl font-bold">Box label</h1>
          <p className="text-sm text-navy-soft">
            4 × 6 in, for Rollo, Zebra and other thermal label printers. In the print window, choose
            your label printer and set the paper size to 4 × 6.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button className="btn-accent" onClick={print}>
              Print label
            </button>
            <Link className="btn-ghost" href={`/boxes/${box.box_tag_id}`}>
              {box.status === "packed" ? "Next, put it away" : "Back to box"}
            </Link>
          </div>
        </div>
        <div className="card text-sm text-navy-soft">
          <p className="font-semibold text-navy">What the codes do</p>
          <p className="mt-1">
            The long barcode holds the box ID, so any warehouse scanner can pull the box up. The QR
            code opens this box in BoxTag on a phone, with the live contents and location.
          </p>
        </div>
      </div>

      <div className="rounded-sm shadow-[0_8px_30px_rgba(31,40,52,0.15)] lg:order-1 print:shadow-none">
        <BoxLabel box={box} locationName={locationName(box.location_id)} url={`${origin}/boxes/${box.box_tag_id}`} />
      </div>
    </div>
  );
}

function NotFound({ id }: { id: string }) {
  return (
    <div className="card mx-auto max-w-md text-center">
      <p className="font-semibold">No box found for “{id}”.</p>
      <Link href="/boxes" className="btn-ghost mt-4">
        See all boxes
      </Link>
    </div>
  );
}
