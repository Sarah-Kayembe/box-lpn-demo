"use client";

/*
 * An on/off switch: a pill track with a round knob that slides across.
 * On is ScanPower sky blue with navy text; off is light grey.
 */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-9 w-[4.75rem] shrink-0 items-center rounded-full border transition-colors duration-200 focus-visible:ring-4 focus-visible:ring-sky-brand focus-visible:outline-none ${
        checked ? "border-[#7cc4e8] bg-sky-brand" : "border-[#cfd8df] bg-[#e9eef2]"
      } shadow-[inset_0_2px_4px_rgba(31,40,52,0.12)]`}
    >
      <span
        aria-hidden="true"
        className={`absolute text-[11px] font-bold tracking-wide transition-opacity ${
          checked ? "left-3 text-navy opacity-100" : "right-2.5 text-[#7b8794] opacity-100"
        }`}
      >
        {checked ? "ON" : "OFF"}
      </span>
      <span
        aria-hidden="true"
        className={`absolute top-1/2 h-7 w-7 -translate-y-1/2 rounded-full border border-[#dde4e9] bg-white shadow-[0_2px_5px_rgba(31,40,52,0.25)] transition-[left] duration-200 ${
          checked ? "left-[calc(100%-2rem)]" : "left-1"
        }`}
      />
    </button>
  );
}
