import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import LanguageSwitcher from "./LanguageSwitcher";

/* The citizen surface header. The authority console has its own,
   inverted — the two surfaces are never meant to be confused. */
export default async function Masthead() {
  const { t } = await getI18n();

  return (
    <header className="rule-b bg-paper/85 sticky top-0 z-40 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" className="shrink-0">
          <span
            className="text-[15px] leading-none"
            style={{
              fontFamily: "var(--font-archivo)",
              fontVariationSettings: '"wdth" 122, "wght" 700',
              letterSpacing: "0.02em",
            }}
          >
            AWAAZ
          </span>
        </Link>

        <nav className="type-action text-ink-muted hidden items-center gap-7 text-[0.85rem] sm:flex">
          <Link href="/track" className="hover:text-ink transition-colors">
            {t.nav.track}
          </Link>
          <Link href="/map" className="hover:text-ink transition-colors">
            {t.nav.map}
          </Link>
          <Link href="/console" className="hover:text-ink transition-colors">
            {t.nav.authority}
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <span className="type-meta text-ink-muted hidden items-center gap-2 sm:flex">
            <span className="pulse-dot text-resolved block size-1.5 rounded-full bg-current" />
            <span className="tracking-wider uppercase">{t.common.city}</span>
          </span>
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
