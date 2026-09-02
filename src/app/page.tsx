import { ArrowRight, Camera, MapPin, Mic } from "lucide-react";
import { CITY } from "@/lib/taxonomy";

/* Placeholder feed until the database is wired. Shape matches the real query. */
const TICKER = [
  { id: "AWZ-LHR-2609-0041", what: "Sewerage overflow", where: "Gulberg III", p: "P1", dept: "WASA" },
  { id: "AWZ-LHR-2609-0040", what: "Street light out", where: "Johar Town G1", p: "P3", dept: "MCL" },
  { id: "AWZ-LHR-2609-0039", what: "Garbage uncollected", where: "Shadman", p: "P2", dept: "LWMC" },
  { id: "AWZ-LHR-2609-0038", what: "Pothole cluster", where: "Ferozepur Rd", p: "P2", dept: "TEPA" },
  { id: "AWZ-LHR-2609-0037", what: "Transformer sparking", where: "Iqbal Town", p: "P1", dept: "LESCO" },
  { id: "AWZ-LHR-2609-0036", what: "Water pressure low", where: "Model Town", p: "P3", dept: "WASA" },
];

const PRIORITY_COLOR: Record<string, string> = {
  P1: "text-p1",
  P2: "text-p2",
  P3: "text-p3",
  P4: "text-p4",
};

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      {/* ── MASTHEAD ─────────────────────────────────────────── */}
      <header className="rule-b sticky top-0 z-40 bg-paper/85 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-5 sm:px-8">
          <div className="flex items-baseline gap-3">
            <span
              className="text-[15px] leading-none"
              style={{ fontVariationSettings: '"wdth" 122, "wght" 700', letterSpacing: "0.02em" }}
            >
              AWAAZ
            </span>
            <span className="type-urdu text-ink-faint text-[13px] leading-none">آواز</span>
          </div>

          <nav className="type-eyebrow hidden items-center gap-7 text-ink-muted sm:flex">
            <a href="/track" className="transition-colors hover:text-ink">Track</a>
            <a href="/map" className="transition-colors hover:text-ink">Live map</a>
            <a href="/console" className="transition-colors hover:text-ink">Authority</a>
          </nav>

          <div className="type-meta flex items-center gap-2 text-ink-muted">
            <span className="pulse-dot text-resolved block size-1.5 rounded-full bg-current" />
            <span className="tracking-wider uppercase">{CITY.name}</span>
          </div>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 sm:px-8">
        <section className="grid gap-12 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-20">
          {/* Left: the claim */}
          <div className="flex flex-col justify-center">
            <div className="type-eyebrow text-ink-faint mb-7 flex items-center gap-3">
              <span className="bg-signal block h-px w-8" />
              <span>Public Complaint Assistant</span>
            </div>

            <h1 className="type-display text-balance">
              Say it once.
              <br />
              <span className="text-ink-muted">We file it</span> properly.
            </h1>

            <p className="type-lead mt-7 max-w-[46ch]">
              No forms. No department names to memorise. Describe the problem the
              way you would to a neighbour — in Urdu, English, or both. Awaaz
              identifies the issue, routes it to the authority that actually owns
              it, sets a deadline, and hands you a tracking number.
            </p>

            {/* Proof strip — three numbers, no illustrations */}
            <dl className="rule-t mt-11 grid grid-cols-3 gap-4 pt-6">
              {[
                { n: "18", l: "Issue types" },
                { n: "12", l: "Departments" },
                { n: "6s", l: "To a filed case" },
              ].map((s) => (
                <div key={s.l}>
                  <dt className="type-numeral text-[2.5rem]">{s.n}</dt>
                  <dd className="type-eyebrow text-ink-faint mt-2">{s.l}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Right: the product itself, not a screenshot of it */}
          <div className="flex items-center">
            <div className="border-rule bg-paper-raised w-full border">
              {/* console header */}
              <div className="rule-b flex items-center justify-between px-4 py-2.5">
                <span className="type-eyebrow text-ink-faint">New report</span>
                <span className="type-meta text-ink-faint">01 / INTAKE</span>
              </div>

              <div className="p-4 sm:p-5">
                <textarea
                  rows={6}
                  placeholder="Gulberg mein sewerage ka pani sarak pe khara hai, teen din se. Bachay wahan khelte hain…"
                  className="type-body placeholder:text-ink-faint/70 w-full resize-none bg-transparent outline-none"
                />

                {/* attachment rail */}
                <div className="rule-t mt-4 flex flex-wrap items-center gap-2 pt-4">
                  <button className="border-rule text-ink-muted hover:border-ink hover:text-ink inline-flex items-center gap-2 border px-3 py-2 transition-colors">
                    <Mic className="size-3.5" />
                    <span className="type-eyebrow">Speak</span>
                  </button>
                  <button className="border-rule text-ink-muted hover:border-ink hover:text-ink inline-flex items-center gap-2 border px-3 py-2 transition-colors">
                    <Camera className="size-3.5" />
                    <span className="type-eyebrow">Photo</span>
                  </button>
                  <button className="border-rule text-ink-muted hover:border-ink hover:text-ink inline-flex items-center gap-2 border px-3 py-2 transition-colors">
                    <MapPin className="size-3.5" />
                    <span className="type-eyebrow">Locate me</span>
                  </button>

                  <button className="bg-ink text-paper hover:bg-signal ml-auto inline-flex items-center gap-2 px-4 py-2 transition-colors">
                    <span className="type-eyebrow">File complaint</span>
                    <ArrowRight className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* footer note */}
              <div className="rule-t bg-paper-sunk px-4 py-2.5">
                <p className="type-meta text-ink-faint">
                  Analysed on device submission · No account required
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── LIVE TICKER — a departures board for the city ─────── */}
      <div className="rule-t bg-paper-sunk overflow-hidden">
        <div className="mx-auto max-w-[1400px]">
          <div className="flex items-stretch">
            <div className="rule-r bg-ink text-paper flex shrink-0 items-center gap-2 px-4">
              <span className="pulse-dot text-signal block size-1.5 rounded-full bg-current" />
              <span className="type-eyebrow">Live</span>
            </div>
            <ul className="flex flex-1 items-center gap-8 overflow-x-auto px-5 py-3">
              {TICKER.map((t) => (
                <li key={t.id} className="type-meta flex shrink-0 items-center gap-3">
                  <span className="text-ink-faint">{t.id}</span>
                  <span className="text-ink">{t.what}</span>
                  <span className="text-ink-faint">{t.where}</span>
                  <span className={PRIORITY_COLOR[t.p]}>{t.p}</span>
                  <span className="border-rule-strong text-ink-muted border px-1.5">{t.dept}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
