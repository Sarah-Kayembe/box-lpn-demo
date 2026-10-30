"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Overview" },
  { href: "/pack", label: "Pack a box" },
  { href: "/boxes", label: "Boxes" },
  { href: "/scan", label: "Scan" },
];

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark />
          <span className="text-lg font-bold tracking-tight">BoxTag</span>
        </Link>

        <nav className="flex flex-wrap gap-1 text-sm">
          {links.map((link) => {
            const active =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3.5 py-1.5 font-medium transition ${
                  active ? "bg-sky-soft text-navy" : "text-navy-soft hover:bg-sky-wash"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <span className="ml-auto rounded-full bg-butter-soft px-3 py-1 text-xs font-semibold text-butter">
          Demo data
        </span>
      </div>
    </header>
  );
}

function LogoMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="2" y="7" width="28" height="20" rx="4" fill="#9BD5F2" />
      <path d="M2 13h28" stroke="#1F2834" strokeWidth="2" />
      <g fill="#1F2834">
        <rect x="7" y="17" width="2" height="6" />
        <rect x="11" y="17" width="1" height="6" />
        <rect x="14" y="17" width="3" height="6" />
        <rect x="19" y="17" width="1" height="6" />
        <rect x="22" y="17" width="2" height="6" />
      </g>
      <circle cx="26" cy="7" r="4" fill="#D64D41" />
    </svg>
  );
}
