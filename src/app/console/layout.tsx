import Link from "next/link";
import ConsoleClock from "@/components/ConsoleClock";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { getI18n } from "@/lib/i18n/server";

/* The authority surface. Deliberately inverted from the citizen app:
   warm near-black, dense, no marketing. It should feel like a room
   where work gets assigned, not a product page. */
export default async function ConsoleLayout({ children }: LayoutProps<"/console">) {
  const { t } = await getI18n();
  return (
    <div className="bg-console text-console-ink flex min-h-full flex-col">
      <header className="border-console-rule bg-console/90 sticky top-0 z-40 border-b backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-4 px-5 sm:px-7">
          <div className="flex items-baseline gap-3">
            <Link
              href="/console"
              className="text-[15px] leading-none"
              style={{ fontVariationSettings: '"wdth" 122, "wght" 700', letterSpacing: "0.02em" }}
            >
              AWAAZ
            </Link>
            <span className="type-eyebrow text-console-faint">{t.console.title}</span>
          </div>

          <div className="flex items-center gap-5">
            <span className="type-meta text-console-muted hidden sm:inline">
              {t.common.city} · {t.console.subtitle}
            </span>
            <span className="type-eyebrow text-resolved flex items-center gap-2">
              <span className="pulse-dot block size-1.5 rounded-full bg-current" />
              {t.common.live}
            </span>
            <ConsoleClock />
            <Link
              href="/"
              className="type-eyebrow text-console-faint hover:text-console-ink transition-colors"
            >
              {t.common.exit}
            </Link>
            <LanguageSwitcher dark />
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
