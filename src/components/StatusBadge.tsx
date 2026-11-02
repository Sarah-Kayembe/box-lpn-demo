import type { BoxTagStatus } from "@/lib/types";

const styles: Record<BoxTagStatus, { tag: string; dot: string; label: string }> = {
  packed: { tag: "border-butter/60 bg-butter-soft text-butter", dot: "bg-butter", label: "Not put away" },
  stored: { tag: "border-navy/30 bg-sky-soft text-navy", dot: "bg-navy", label: "Stored" },
  shipped: { tag: "border-mint/50 bg-mint-soft text-mint", dot: "bg-mint", label: "In a shipment" },
};

export function StatusBadge({ status }: { status: BoxTagStatus }) {
  const s = styles[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-[13px] font-bold ${s.tag}`}
    >
      <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden="true" />
      {s.label}
    </span>
  );
}
