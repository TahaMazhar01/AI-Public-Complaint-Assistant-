import Link from "next/link";
import LiveMap from "@/components/LiveMap";
import ConsoleClock from "@/components/ConsoleClock";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { fmt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { getStats, listComplaints } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live map" };

export default async function MapPage() {
  const { t } = await getI18n();
  const [complaints, stats] = await Promise.all([
    listComplaints({ status: "open", parentsOnly: true, limit: 400 }),
    getStats(),
  ]);

  return (
    <div className="bg-console text-console-ink flex h-dvh flex-col">
      <header className="border-console-rule flex h-20 shrink-0 sm:h-28 items-center justify-between gap-4 border-b px-5 sm:px-7">
        <div className="flex items-baseline gap-3">
          <Link
            href="/"
            className="text-[22px] leading-none sm:text-[30px]"
            style={{ fontVariationSettings: '"wdth" 122, "wght" 700', letterSpacing: "0.02em" }}
          >
            AWAAZ
          </Link>
          <span className="type-eyebrow text-console-faint">{t.map.title}</span>
        </div>

        <div className="type-meta text-console-muted hidden items-center gap-5 sm:flex">
          <span>{fmt(t.map.open, { n: stats.open })}</span>
          <span className="text-p1">{fmt(t.map.critical, { n: stats.critical })}</span>
          <span className="text-p1">{fmt(t.map.overdue, { n: stats.overdue })}</span>
          <span>{t.common.city}</span>
          <ConsoleClock />
        </div>

        <nav className="type-eyebrow text-console-faint flex items-center gap-5">
          <Link href="/console" className="hover:text-console-ink transition-colors">
            {t.map.console}
          </Link>
          <Link href="/" className="hover:text-console-ink transition-colors">
            {t.common.exit}
          </Link>
          <LanguageSwitcher dark />
        </nav>
      </header>

      <h1 className="sr-only">{t.map.title}</h1>

      <div className="min-h-0 flex-1">
        <LiveMap complaints={complaints} />
      </div>
    </div>
  );
}
