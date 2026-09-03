# Deploying Awaaz to Vercel

Ten minutes, most of it waiting. Do the steps in this order — the
`NEXT_PUBLIC_*` variables are inlined at **build** time, so setting them
after the first deploy means building again.

---

## 1. Import the repository

1. Go to **[vercel.com/new](https://vercel.com/new)** and sign in with GitHub.
2. Import **`TahaMazhar01/AI-Public-Complaint-Assistant-`**.
3. Vercel detects Next.js on its own. **Do not change** the framework,
   build command, or output directory.
4. **Before clicking Deploy**, open **Environment Variables** and add the
   ones below. This is the step people skip.

---

## 2. Environment variables

Copy the values out of your local `.env.local`. Add every one to
**Production, Preview and Development** unless noted.

| Variable | Value | Notes |
|---|---|---|
| `AI_PROVIDER` | `qwen` | |
| `DASHSCOPE_API_KEY` | your `sk-…` key | secret |
| `DASHSCOPE_BASE_URL` | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` | must match the key's region |
| `DASHSCOPE_MODEL` | `qwen-plus` | |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project>.supabase.co` | **project origin, not the `/rest/v1/` endpoint** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key | public by design |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key | **secret — never expose to the browser** |

Anything prefixed `NEXT_PUBLIC_` is compiled into the client bundle and is
readable by anyone. That is correct for the Supabase URL and anon key, which
are protected by row-level security. It is never correct for the service role
key or the DashScope key, and neither carries that prefix.

**If the Supabase variables are missing, the app still boots** — it silently
falls back to the in-memory corpus. On serverless that is worse than an error:
each request may hit a different instance, so complaints appear and vanish at
random. The console footer states which backend served the page. Check it
after the first deploy.

---

## 3. Deploy, then verify

Click **Deploy** and wait for the build. Then check, in this order:

1. **`/console`** — the footer should read **"Storage · Postgres · persisted"**.
   If it says the in-memory corpus, the Supabase variables did not reach the
   build. Fix them and redeploy.
2. **`/`** — file a complaint. The pipeline should reach **Filed** and show a
   tracking number. It takes 5–9 seconds; that is the model thinking, not a hang.
3. **`/track/<that tracking number>`** — the case should be there. That proves
   the write persisted rather than living in one lambda's memory.
4. **`/map`** — pins should render over the dark basemap. Tiles come from Esri
   over the network; everything else works offline.
5. Switch language in the header and reload. Every string should change,
   including the ones rendered on the server.

---

## 4. Things that will actually go wrong

**The intake route needs headroom.** It paces itself deliberately and then waits
on Qwen, so a filing takes 5–9 seconds. `src/app/api/intake/route.ts` declares
`maxDuration = 60` for that reason. If you see a function timeout, that
declaration was removed or the plan does not permit it.

**Region matters for latency.** Set the Vercel project region to Singapore
(`sin1`) or Mumbai (`bom1`) under *Settings → Functions*. The default is
Washington, which puts every Supabase and DashScope round trip across an
ocean and adds seconds to the demo.

**The DashScope endpoint is region-locked.** An international key will not work
against the mainland-China endpoint or vice versa. `pnpm check:ai` prints both
URLs when a key is rejected.

**Seed the database before presenting.** An empty console loses the room:

```bash
pnpm check:db   # reachable? schema applied?
pnpm seed       # 111 complaints, 501 events
```

Run these locally — they talk to the same Supabase project the deployment uses.

---

## 5. Before the pitch

- Open the deployed URL on the actual machine you will present from, on the
  actual network, and file one complaint end to end.
- Have the URL open in a tab already. Do not type it on stage.
- If the venue network is hostile, set `AI_PROVIDER=mock` and redeploy: the
  on-device heuristic keeps the entire pipeline working with no outbound AI
  calls. Titles get noticeably worse; nothing breaks.
- Record a backup video of the working demo. Do this the day before.
