"use client";

import { Icon, type IconName } from "./Icon";

type Tone = "success" | "error" | "info" | "warning";

const tones: Record<Tone, { box: string; badge: string; icon: IconName; role: "status" | "alert" }> = {
  success: { box: "border-mint bg-mint-soft", badge: "bg-mint", icon: "check", role: "status" },
  error: { box: "border-red-brand bg-red-soft", badge: "bg-red-brand", icon: "alert", role: "alert" },
  info: { box: "border-navy bg-sky-soft", badge: "bg-navy", icon: "info", role: "status" },
  warning: { box: "border-butter bg-butter-soft", badge: "bg-butter", icon: "alert", role: "status" },
};

/** Tinted alert with a solid left edge, a filled icon, a bold title and an optional close button. */
export function Alert({
  tone,
  title,
  children,
  onClose,
}: {
  tone: Tone;
  title: string;
  children?: React.ReactNode;
  onClose?: () => void;
}) {
  const t = tones[tone];
  return (
    <div role={t.role} className={`flex items-start gap-3 rounded-[4px] border-l-[5px] px-4 py-3.5 ${t.box}`}>
      <span className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-white ${t.badge}`}>
        <Icon name={t.icon} size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-navy">{title}</p>
        {children && <div className="mt-0.5 text-[15px] text-navy-soft">{children}</div>}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="-mr-1 rounded-full p-1 text-navy-soft transition hover:bg-white/70 hover:text-navy"
          aria-label="Dismiss"
        >
          <Icon name="close" size={18} />
        </button>
      )}
    </div>
  );
}
