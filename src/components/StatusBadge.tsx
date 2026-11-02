import type { BoxTagStatus } from "@/lib/types";

const styles: Record<BoxTagStatus, string> = {
  packed: "bg-butter-soft text-butter",
  stored: "bg-sky-soft text-navy",
  shipped: "bg-mint-soft text-mint",
};

const labels: Record<BoxTagStatus, string> = {
  packed: "Packed, not put away",
  stored: "Stored",
  shipped: "In a shipment",
};

export function StatusBadge({ status }: { status: BoxTagStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
