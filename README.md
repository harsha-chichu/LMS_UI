# LMS. — interview practice

Pick a domain, answer out loud (or type), get follow-ups when an answer is thin, and finish with a report scored out of 100 (70% answer content, 30% communication).

Built with Next.js 16 (App Router), Tailwind CSS v4, shadcn/ui (Base UI) and the Anthropic SDK.

## Run it

```bash
npm install
cp .env.example .env.local      # fill in Claude + Supabase keys
npm run dev                     # http://localhost:3000

# in a second terminal — the eval agent
cd agents/eval_agent
uv run python -m uvicorn server:app --host 127.0.0.1 --port 8000
```

**One-time Supabase setup**
1. SQL editor → run the files in `supabase/migrations/` in order (`0001_init.sql` creates `lms_profiles`, `lms_sessions`, RLS policies and a sign-up trigger; later ones add saved questions, friends, and server-only session writes; existing tables are untouched). Then copy the service_role key into `SUPABASE_SERVICE_ROLE_KEY`.
2. Authentication → URL configuration → site URL `http://localhost:3000`, redirect URL `http://localhost:3000/auth/callback`.
3. Authentication → Providers → Google → enable, paste the client id/secret from Google Cloud (authorised redirect URI: `https://<project>.supabase.co/auth/v1/callback`).

**How scoring works**
- Each answer goes to the eval agent (with the recorded audio for voice answers). It replies as soon as it has decided whether to ask a follow-up; scoring continues in the background and is collected when the session finishes.
- If the agent is down or errors, the built-in Claude evaluator (`src/lib/llm/`) scores instead, so a session never gets stuck. `LMS_MOCK_LLM=1` swaps Claude for a heuristic too.
- The report weights answers 70% and communication 30%. With recorded audio, the agent's grammar / pronunciation / fluency / clarity scores are blended into communication.
- The agent keeps state in memory: restarting it mid-session drops in-flight evaluations (the fallback covers them).
- API routes require a signed-in user; each account can start 30 sessions per 24 hours.
- Users can read their own sessions but not write them: only the API routes do, with the service-role key, so scores on the friends leaderboard can't be edited from the browser.

## Screens

| Route | Design |
|---|---|
| `/` | Landing |
| `/setup` | Session setup |
| `/session/[id]` | Listening · follow-up · text mode (resumes after refresh) |
| `/report/[id]` | Final report |
| `/profile` | Profile |

Plus `/login`, `/signup`, `/forgot-password`, `/reset-password`. Everything except the landing page and auth screens requires sign-in (`src/proxy.ts`).

## Where things live

```
src/
├─ app/                  routes; api/sessions/* (create, answers, skip, complete, abandon); auth/callback
├─ proxy.ts              Supabase session refresh + route gating (Next 16's "middleware")
├─ components/           auth, landing, setup, session, report, profile, common, ui (shadcn)
├─ hooks/                speech recognition, audio recorder, session state machine, timer
├─ lib/
│  ├─ agent/             HTTP client + mapping for the Python eval agent
│  ├─ sessions/          per-question scoring engine (agent → Claude fallback), persistence
│  ├─ supabase/          browser + server clients
│  ├─ llm/               Claude client, prompts, schemas, mock fallback
│  ├─ data.ts            SWR hooks (profile, sessions) + session API calls
│  ├─ scoring.ts         report assembly + 70/30 weighting
│  └─ stats.ts           streaks, heatmap, trend
├─ data/                 fallback question bank
└─ types/
supabase/migrations/     database schema
agents/eval_agent/       the evaluation agent (separate repo); server.py is its HTTP wrapper
```
