import type { BoxTagStatus } from "@/lib/types";

const styles: Record<BoxTagStatus, { tag: string; label: string }> = {
  packed: { tag: "bg-butter", label: "Not put away" },
  stored: { tag: "bg-navy", label: "Stored" },
  shipped: { tag: "bg-mint", label: "In a shipment" },
};

export function StatusBadge({ status }: { status: BoxTagStatus }) {
  const s = styles[status];
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-bold text-white ${s.tag}`}
    >
      {s.label}
    </span>
  );
}
