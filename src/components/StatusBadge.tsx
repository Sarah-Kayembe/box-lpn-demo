import type { BoxTagStatus } from "@/lib/types";

const styles: Record<BoxTagStatus, string> = {
  packed: "border-butter/50 bg-butter-soft text-butter",
  stored: "border-sky-brand bg-sky-soft text-navy",
  shipped: "border-mint/40 bg-mint-soft text-mint",
};

const labels: Record<BoxTagStatus, string> = {
  packed: "Packed, not put away",
  stored: "Stored",
  shipped: "In a shipment",
};

export function StatusBadge({ status }: { status: BoxTagStatus }) {
  return (
    <span className={`inline-flex rounded-[3px] border px-2 py-0.5 text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
