"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

/*
 * The long pills used for packing, modeled on Walmart's cart buttons.
 * AddPill is the sky blue "Add" for a product not in the box yet.
 * QuantityPill is the white pill for one already in it: minus, the number,
 * plus. The number has a dotted underline and can be tapped to type a
 * quantity. At 1, minus becomes a trash icon that removes the product, unless
 * trashAtOne is off (where a separate remove button sits next to the pill).
 */

const pill = "flex h-11 w-40 shrink-0 items-center rounded-full";

export function AddPill({ title, onAdd }: { title: string; onAdd: () => void }) {
  return (
    <button
      className={`${pill} justify-center gap-1.5 bg-sky-brand font-bold text-navy transition hover:bg-[#86cbee] focus-visible:ring-4 focus-visible:ring-navy/30 focus-visible:outline-none active:translate-y-px`}
      onClick={onAdd}
      aria-label={`Add ${title} to the box`}
    >
      <Icon name="plus" size={18} />
      Add
    </button>
  );
}

export function QuantityPill({
  value,
  title,
  onChange,
  onRemove,
  trashAtOne = true,
}: {
  value: number;
  title: string;
  onChange: (n: number) => void;
  onRemove: () => void;
  trashAtOne?: boolean;
}) {
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!typing) setDraft(String(value));
  }, [value, typing]);

  useEffect(() => {
    if (typing) input.current?.select();
  }, [typing]);

  const commit = () => {
    const n = parseInt(draft, 10);
    if (n > 0 && n !== value) onChange(n);
    setTyping(false);
  };

  const side =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-navy transition hover:bg-sky-soft focus-visible:ring-4 focus-visible:ring-sky-brand focus-visible:outline-none";

  return (
    <div
      className={`${pill} justify-between border border-line bg-white/80 shadow-[0_2px_10px_rgba(31,40,52,0.08)] backdrop-blur`}
    >
      {value <= 1 && trashAtOne ? (
        <button className={`${side} hover:text-red-deep`} onClick={onRemove} aria-label={`Remove ${title} from the box`}>
          <Icon name="trash" size={18} />
        </button>
      ) : (
        <button
          className={`${side} disabled:opacity-35 disabled:hover:bg-transparent`}
          disabled={value <= 1}
          onClick={() => onChange(value - 1)}
          aria-label={`One less ${title}`}
        >
          <Icon name="minus" size={18} />
        </button>
      )}

      {typing ? (
        <input
          ref={input}
          className="h-8 w-14 rounded-md border border-navy bg-white text-center font-bold text-navy outline-none"
          inputMode="numeric"
          aria-label={`Quantity of ${title}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 4))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(String(value));
              setTyping(false);
            }
          }}
        />
      ) : (
        <button
          className="h-8 min-w-10 rounded-md px-2 font-bold text-navy underline decoration-navy-soft decoration-dotted decoration-2 underline-offset-4 transition hover:bg-sky-soft"
          onClick={() => setTyping(true)}
          aria-label={`Quantity ${value}. Tap to type a quantity`}
          title="Tap to type a quantity"
        >
          {value}
        </button>
      )}

      <button className={side} onClick={() => onChange(value + 1)} aria-label={`One more ${title}`}>
        <Icon name="plus" size={18} />
      </button>
    </div>
  );
}
