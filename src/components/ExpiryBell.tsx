"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api/client";
import {
  daysText,
  expiryAlerts,
  SOON_DAYS,
  TOO_CLOSE_DAYS,
  type ExpiryAlert,
  type ExpiryLevel,
} from "@/lib/expiry";
import { formatDate } from "@/lib/format";
import { Icon } from "./Icon";

/*
 * Header bell listing boxes still in the warehouse that have expired or will
 * soon. When the app opens with newly expired boxes, a small notice says so
 * once. Box records live in this browser, so so does the bell.
 */

const SEEN_KEY = "boxtag.expired-seen.v1";

function readSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function writeSeen(ids: string[]) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable: the notice may show again next time */
  }
}

const groups: { level: ExpiryLevel; title: string; hint: string }[] = [
  {
    level: "expired",
    title: "Expired",
    hint: "Past the date. Take these out.",
  },
  {
    level: "tooClose",
    title: `Under ${TOO_CLOSE_DAYS} days left`,
    hint: "Too close to send to Amazon.",
  },
  {
    level: "soon",
    title: `Under ${SOON_DAYS} days left`,
    hint: "Ship these first.",
  },
];

export function ExpiryBell() {
  const pathname = usePathname();
  const [alerts, setAlerts] = useState<ExpiryAlert[]>([]);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string[] | null>(null);
  const checkedOnce = useRef(false);
  const wrapper = useRef<HTMLDivElement>(null);

  // Re-check on every page, since packing, shipping or unpacking changes the list
  useEffect(() => {
    let live = true;
    api
      .listBoxTags()
      .then((boxes) => {
        if (!live) return;
        const found = expiryAlerts(boxes);
        setAlerts(found);
        if (!checkedOnce.current) {
          checkedOnce.current = true;
          const seen = readSeen();
          const fresh = found.filter(
            (a) => a.level === "expired" && !seen.includes(a.box.box_tag_id),
          );
          if (fresh.length) setNotice(fresh.map((a) => a.box.box_tag_id));
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [pathname]);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (
        e instanceof KeyboardEvent
          ? e.key === "Escape"
          : !wrapper.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const urgent = alerts.filter((a) => a.level !== "soon").length;
  const count = urgent || alerts.length;

  function dismissNotice() {
    writeSeen([
      ...new Set([
        ...readSeen(),
        ...alerts
          .filter((a) => a.level === "expired")
          .map((a) => a.box.box_tag_id),
      ]),
    ]);
    setNotice(null);
  }

  return (
    <div ref={wrapper} className="relative">
      <button
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-navy transition hover:bg-sky-soft focus-visible:ring-4 focus-visible:ring-sky-brand focus-visible:outline-none"
        aria-label={
          alerts.length
            ? `Expiry alerts: ${alerts.length}`
            : "Expiry alerts: none"
        }
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          if (notice) dismissNotice();
        }}
      >
        <Icon name="bell" size={22} />
        {count > 0 && (
          <span
            className={`absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold text-white ${
              urgent ? "bg-red-deep" : "bg-butter"
            }`}
          >
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] rounded-[6px] border border-line bg-white p-4 shadow-[0_12px_32px_rgba(31,40,52,0.16)]">
          <p className="font-bold">Expiry alerts</p>
          {alerts.length === 0 ? (
            <p className="mt-2 text-sm text-navy-soft">
              Nothing in the warehouse expires in the next {SOON_DAYS} days.
            </p>
          ) : (
            <div className="mt-2 max-h-[60vh] space-y-4 overflow-y-auto">
              {groups.map((g) => {
                const list = alerts.filter((a) => a.level === g.level);
                if (!list.length) return null;
                return (
                  <section key={g.level}>
                    <p
                      className={`text-sm font-bold ${
                        g.level === "expired"
                          ? "text-red-deep"
                          : g.level === "tooClose"
                            ? "text-butter"
                            : "text-navy"
                      }`}
                    >
                      {g.title} · {list.length}
                    </p>
                    <p className="text-xs text-navy-soft">{g.hint}</p>
                    <ul className="mt-1.5 divide-y divide-line">
                      {list.map((a) => (
                        <li key={a.box.box_tag_id}>
                          <Link
                            href={`/boxes/${a.box.box_tag_id}`}
                            className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-sky-wash"
                          >
                            <span className="font-mono font-bold">
                              {a.box.box_tag_id}
                            </span>
                            <span className="text-right text-navy-soft">
                              {formatDate(a.date)} · {daysText(a.daysLeft)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      )}

      {notice &&
        !open &&
        // Rendered on the page body: the header's blur would otherwise pin it to the header
        createPortal(
          <div
            role="status"
            className="fixed right-4 bottom-4 z-40 flex w-[20rem] max-w-[calc(100vw-2rem)] items-start gap-3 rounded-[6px] border-l-4 border-red-deep bg-white p-4 shadow-[0_12px_32px_rgba(31,40,52,0.18)]"
          >
            <span className="mt-0.5 text-red-deep">
              <Icon name="bell" size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">
                {notice.length === 1
                  ? "A box has expired"
                  : `${notice.length} boxes have expired`}
              </p>
              <p className="mt-0.5 text-sm text-navy-soft">
                {notice.join(", ")}
              </p>
              <button
                className="mt-2 text-sm font-bold text-navy underline underline-offset-2"
                onClick={() => {
                  dismissNotice();
                  setOpen(true);
                }}
              >
                See expiry alerts
              </button>
            </div>
            <button
              className="text-navy-soft hover:text-navy"
              aria-label="Dismiss"
              onClick={dismissNotice}
            >
              <Icon name="close" size={18} />
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
