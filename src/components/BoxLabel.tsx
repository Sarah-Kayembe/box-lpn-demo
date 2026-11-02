import { Barcode } from "./Barcode";
import { earliestExpiry, formatDate, formatDims, totalUnits } from "@/lib/format";
import type { BoxTag } from "@/lib/types";

const MAX_LINES = 7;

/**
 * A 4 x 6 inch box label, the size Rollo and Zebra thermal printers use.
 * Black on white only, so it prints cleanly on direct thermal labels.
 */
export function BoxLabel({ box, locationName, url }: { box: BoxTag; locationName: string | null; url: string }) {
  const shown = box.items.slice(0, MAX_LINES);
  const hidden = box.items.length - shown.length;
  const expiry = earliestExpiry(box);

  return (
    <div className="label-4x6 flex h-[6in] w-[4in] flex-col bg-white p-[0.18in] font-sans text-black">
      <div className="flex items-baseline justify-between border-b-2 border-black pb-1">
        <span className="text-[11px] font-bold tracking-[0.2em]">BOXTAG</span>
        <span className="text-[10px]">Packed {formatDate(box.packed_at)}</span>
      </div>

      <p className="mt-2 text-center font-mono text-[30px] font-bold leading-none tracking-wider">
        {box.box_tag_id}
      </p>
      <Barcode type="code128" value={box.box_tag_id} height={16} className="mx-auto mt-1.5 h-[0.85in] w-[3.4in]" />

      <div className="mt-2 grid grid-cols-3 border-y border-black text-center text-[10px] leading-tight">
        <Stat label="Units" value={String(totalUnits(box))} />
        <Stat label="SKUs" value={String(box.items.length)} border />
        <Stat label="Weight" value={box.weight ? `${box.weight} lb` : "—"} border />
      </div>

      <table className="mt-2 w-full text-[10px] leading-tight">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-0.5 font-bold">SKU</th>
            <th className="py-0.5 font-bold">FNSKU</th>
            <th className="py-0.5 text-right font-bold">Qty</th>
            <th className="py-0.5 pl-1 text-right font-bold">Expires</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((i) => (
            <tr key={i.sku} className="border-b border-black/30">
              <td className="py-[2px] font-mono">{i.sku}</td>
              <td className="py-[2px] font-mono">{i.fnsku}</td>
              <td className="py-[2px] text-right font-bold">{i.quantity}</td>
              <td className="py-[2px] pl-1 text-right">{i.expires ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {hidden > 0 && <p className="mt-1 text-[10px] italic">+ {hidden} more SKUs. Scan the QR code for the full list.</p>}

      <div className="mt-auto flex items-end gap-3 border-t-2 border-black pt-2">
        <Barcode type="qrcode" value={url} className="h-[1.15in] w-[1.15in] shrink-0" />
        <div className="min-w-0 flex-1 space-y-1 text-[10px] leading-tight">
          <p>
            <span className="font-bold">Size </span>
            {formatDims(box)}
          </p>
          {expiry && (
            <p>
              <span className="font-bold">Earliest expiry </span>
              {formatDate(expiry)}
            </p>
          )}
          <p>
            <span className="font-bold">Location </span>
            {locationName ?? "________________"}
          </p>
          {box.notes && <p className="truncate italic">{box.notes}</p>}
          <p className="pt-1 text-[9px]">Scan the QR code with a phone to see live contents.</p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, border }: { label: string; value: string; border?: boolean }) {
  return (
    <div className={`py-1 ${border ? "border-l border-black" : ""}`}>
      <p className="text-[8px] uppercase tracking-wider">{label}</p>
      <p className="text-[14px] font-bold">{value}</p>
    </div>
  );
}
