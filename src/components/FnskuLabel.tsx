import { Barcode } from "./Barcode";

/**
 * Amazon FNSKU unit label at 2.25 × 1.25 in, the common thermal size.
 * Barcode of the FNSKU, the FNSKU in text, a shortened title, and the condition.
 */
export function FnskuLabel({ fnsku, title, condition = "New" }: { fnsku: string; title: string; condition?: string }) {
  const short = title.length > 46 ? `${title.slice(0, 44).trimEnd()}…` : title;
  return (
    <div className="fnsku-label flex h-[1.25in] w-[2.25in] flex-col items-center justify-center bg-white px-[0.08in] font-sans text-black">
      <Barcode type="code128" value={fnsku} height={9} className="h-[0.5in] w-[2in]" />
      <p className="mt-[2px] font-mono text-[10px] font-bold leading-none">{fnsku}</p>
      <p className="mt-[3px] w-full truncate text-center text-[8px] leading-tight">{short}</p>
      <p className="text-[8px] font-bold leading-tight">{condition}</p>
    </div>
  );
}
