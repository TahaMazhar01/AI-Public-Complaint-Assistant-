# Awaaz — AI Public Complaint Assistant

آواز · Lahore

Citizens report civic problems in plain language — spoken or typed, Urdu, Roman
Urdu, or English. Awaaz identifies the issue, routes it to the authority that
actually owns it, assigns a priority with a stated reason, files a formal
complaint, and hands back a tracking number. Departments work the queue from a
live console.

---

## Run it

```bash
pnpm install
pnpm dev --port 3400
```

Open http://localhost:3400. **It works with no API keys and no database** — the
AI falls back to an on-device heuristic and the data layer is seeded in memory.

---

## The three surfaces

| Route | Who | What |
|---|---|---|
| `/` | Citizen | Intake. Speak or type, watch the pipeline, get a receipt. |
| `/track`, `/track/[id]` | Citizen | Public case register and full case history. |
| `/console`, `/console/[id]` | Authority | Dispatch queue, SLA countdowns, status actions. |
| `/map` | Both | Every open case in the city, sized by corroboration. |

---

## How a complaint is processed

`POST /api/intake` streams NDJSON — one line per stage, emitted when that stage
actually finishes. The animation the citizen watches is a real progress report.

```
received → understanding → classified → routed → deduped → drafted → filed
```

1. **understanding** — one structured model call returns category, priority,
   hazard flags, a formal summary, and detected language. That is the only
   model call in the system.
2. **routed** — the model does *not* pick the department. `src/lib/taxonomy.ts`
   maps category → authority. Routing stays deterministic and auditable even
   when the model is wrong.
3. **deduped** — semantic similarity **and** within 300 m **and** same category.
   All three must agree before two reports merge. Enough corroboration
   escalates the priority automatically.

---

## Configuration

Copy `.env.example` to `.env.local`.

### AI provider

Set `AI_PROVIDER` to one of `qwen` / `google` / `anthropic` / `mock`.

```env
AI_PROVIDER=qwen
DASHSCOPE_API_KEY=...
DASHSCOPE_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen-plus
```

Alibaba Model Studio speaks the OpenAI wire format, so it needs no special
adapter. Switching providers changes one env var and nothing else.

With `mock` — or no key, or a failed call — the pipeline uses the heuristic
analyser in `src/lib/ai/analyze.ts`. It reads Roman Urdu cues, matches
categories, detects hazards, and derives a priority. Noticeably worse titles
than a real model, but it never fails and it never costs anything.

### Database

Not yet wired. `src/lib/store.ts` is the only module that touches data; every
page and route calls it and nothing else. When Supabase lands, implement the
same functions against Postgres and no caller changes. `db/schema.sql` is ready
to run as-is — sequence-generated tracking IDs, an append-only event log, and
`match_duplicates()` mirroring the in-memory logic.

---

## Demo safety

The venue wifi will fail. Plan for it.

- `AI_PROVIDER=mock` removes every outbound AI call.
- The seed corpus is deterministic — the same 70 cases on every machine, every run.
- Six **hotspots** carry real duplicate clusters (Gulberg III sewerage has 12
  reports). This is what makes "8 other people have reported this" true rather
  than staged.
- The map needs tiles from the network. Everything else runs offline.

Seed the demo before you present: the console is meant to look busy.

---

## Design system

`src/app/globals.css`. Two opposed surfaces — **paper** for citizens, **console**
for authorities. Rules to keep:

- **Colour encodes priority or status. Never decoration.** Buttons are ink.
- **Monospace for machine data** — IDs, timestamps, coordinates, counts.
- **Archivo's width axis** carries display type; body stays normal width.
- Hairline rules, not drop shadows.

---

## Stack

Next.js 16 · React 19 · Tailwind v4 · TypeScript · Vercel AI SDK v7 ·
Leaflet · Motion

> Leaflet rather than a WebGL map deliberately: maplibre's tile worker does not
> resolve under Turbopack, and CARTO's keyless dark basemap now watermarks every
> tile. Esri's dark canvas is raster, keyless, and has nothing to fail on stage.
