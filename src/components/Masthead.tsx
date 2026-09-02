import Link from "next/link";
import { CITY } from "@/lib/taxonomy";

/* The citizen surface header. The authority console has its own,
   inverted — the two surfaces are never meant to be confused. */
export default function Masthead() {
  return (
    <header className="rule-b bg-paper/85 sticky top-0 z-40 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-baseline gap-3">
          <span
            className="text-[15px] leading-none"
            style={{ fontVariationSettings: '"wdth" 122, "wght" 700', letterSpacing: "0.02em" }}
          >
            AWAAZ
          </span>
          <span className="type-urdu text-ink-faint text-[13px] leading-none">آواز</span>
        </Link>

        <nav className="type-eyebrow text-ink-muted hidden items-center gap-7 sm:flex">
          <Link href="/track" className="hover:text-ink transition-colors">Track</Link>
          <Link href="/map" className="hover:text-ink transition-colors">Live map</Link>
          <Link href="/console" className="hover:text-ink transition-colors">Authority</Link>
        </nav>

        <div className="type-meta text-ink-muted flex items-center gap-2">
          <span className="pulse-dot text-resolved block size-1.5 rounded-full bg-current" />
          <span className="tracking-wider uppercase">{CITY.name}</span>
        </div>
      </div>
    </header>
  );
}
