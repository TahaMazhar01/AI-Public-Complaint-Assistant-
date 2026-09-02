import Link from "next/link";
import LiveMap from "@/components/LiveMap";
import ConsoleClock from "@/components/ConsoleClock";
import { CITY } from "@/lib/taxonomy";
import { getStats, listComplaints } from "@/lib/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live map" };

export default async function MapPage() {
  const [complaints, stats] = await Promise.all([
    listComplaints({ status: "open", parentsOnly: true, limit: 400 }),
    getStats(),
  ]);

  return (
    <div className="bg-console text-console-ink flex h-dvh flex-col">
      <header className="border-console-rule flex h-14 shrink-0 items-center justify-between gap-4 border-b px-5 sm:px-7">
        <div className="flex items-baseline gap-3">
          <Link
            href="/"
            className="text-[15px] leading-none"
            style={{ fontVariationSettings: '"wdth" 122, "wght" 700', letterSpacing: "0.02em" }}
          >
            AWAAZ
          </Link>
          <span className="type-eyebrow text-console-faint">Live map</span>
        </div>

        <div className="type-meta text-console-muted hidden items-center gap-5 sm:flex">
          <span>{stats.open} open</span>
          <span className="text-p1">{stats.critical} critical</span>
          <span className="text-p1">{stats.overdue} past deadline</span>
          <span>{CITY.name}</span>
          <ConsoleClock />
        </div>

        <nav className="type-eyebrow text-console-faint flex items-center gap-5">
          <Link href="/console" className="hover:text-console-ink transition-colors">
            Console
          </Link>
          <Link href="/" className="hover:text-console-ink transition-colors">
            Exit
          </Link>
        </nav>
      </header>

      <div className="min-h-0 flex-1">
        <LiveMap complaints={complaints} />
      </div>
    </div>
  );
}
