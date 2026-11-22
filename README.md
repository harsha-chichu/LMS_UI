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
1. SQL editor → run the files in `supabase/migrations/` in order (`0001_init.sql` creates `lms_profiles`, `lms_sessions`, RLS policies and a sign-up trigger; later ones add saved questions, friends, server-only session writes, and the question bank with its seed; existing tables are untouched). Then copy the service_role key into `SUPABASE_SERVICE_ROLE_KEY`.
2. Authentication → URL configuration → site URL `http://localhost:3000`, redirect URL `http://localhost:3000/auth/callback`.
3. Authentication → Providers → Google → enable, paste the client id/secret from Google Cloud (authorised redirect URI: `https://<project>.supabase.co/auth/v1/callback`).

**How questions are picked**
- Questions come from a bank in Supabase (`lms_questions`, seeded by `supabase/migrations/0006_seed_question_bank.sql`), not generated per session. When a session completes, each bank question's score is recorded in `lms_question_attempts`.
- Sessions adapt to the user (`src/lib/questions/pick.ts`): about 60% from topics they haven't mastered, 25% questions they've never seen, 15% review of mastered topics not practised for 3 weeks. A topic is mastered after 2+ answers averaging 8/10 over the last 3. Questions from the last 5 sessions never repeat. Thresholds live in `ADAPTIVE` in `src/lib/constants.ts`.
- Only when the bank can't fill a session (a custom topic, or everything mastered) does Claude write new questions; they're saved to the bank for everyone. Duplicates are skipped, and generated questions that most people skip are retired automatically.
- Follow-ups are still generated live from the user's answer.
- The profile shows each user's weak and mastered topics.

**How voice answers are transcribed**
- With `DEEPGRAM_API_KEY` set, mic audio streams to Deepgram (nova-3) and words appear live as the user speaks (`src/hooks/deepgram.ts`). The browser gets a 60-second token from `/api/speech/token`; the key never leaves the server. Technical words from the question and the session's topics are sent as keyterms so names like `useEffect` or `OAuth` come out right.
- Without the key, or if Deepgram can't be reached, it falls back to the browser's own speech recognition (Chrome, Edge, Safari).
- Either way, the transcript lands in the answer box to fix before it's sent.

**How scoring works**
- Each answer goes to the eval agent (with the recorded audio for voice answers). It replies as soon as it has decided whether to ask a follow-up; scoring continues in the background and is collected when the session finishes.
- If the agent is down or errors, the built-in Claude evaluator (`src/lib/llm/`) scores instead. If that fails too, the answer is kept and retried when the session finishes; if it still can't be scored, the report marks it "not scored" and leaves it out of the average.
- The report weights answers 70% and communication 30%. With recorded audio, the agent's grammar / pronunciation / fluency / clarity scores are blended into communication.
- The agent keeps state in memory: restarting it mid-session drops in-flight evaluations (the fallback covers them).
- API routes require a signed-in user. Routes that cost money are rate-limited per user (`src/lib/rate-limit.ts`): 30 sessions a day, 120 transcription tokens and 300 answers an hour, 20 feedback messages a day. Counters live in Postgres (`lms_rate_limit`, migration 0013) and are taken atomically, so parallel requests can't slip past a limit.
- Saving an answer is a compare-and-set on that question (`lms_save_result_guarded`): a double submit or a second tab gets a 409 instead of overwriting the first answer.
- Users can read their own sessions but not write them: only the API routes do, with the service-role key, so scores on the friends leaderboard can't be edited from the browser.

## Checks

```bash
npm run lint
npm run typecheck   # generates Next's route types, then tsc
npm test            # vitest
npm run build
```

CI (`.github/workflows/ci.yml`) runs all of these on every pull request, plus `npm audit` for production dependencies and a job that applies every migration to a fresh Postgres.

**Region:** API routes run in Vercel's Seoul region (`icn1`, set in `vercel.json`), next to the Supabase project (ap-northeast-2). Each answer makes several sequential Supabase calls plus one to the eval agent (Singapore), so a far-away region adds a round trip to each. Move it if the database moves.

**Deploying a new migration:** run it in Supabase *before* deploying the code that uses it. Apply 0014 before this version goes live: without it the app keeps working, but `/admin` errors and usage events are dropped.

## Admin dashboard (`/admin`)

**Setup (once):**
1. Run `supabase/migrations/0014_admin.sql` in the Supabase SQL editor *before* deploying this version. The API now records usage events and reads app settings from it.
2. Set `ADMIN_EMAILS` to a comma-separated list of admin emails, in `.env.local` and in Vercel (Project → Settings → Environment Variables), then redeploy. Those accounts can open `/admin`. Emails live in env only, never in the repo.
3. Admins can give other users admin access from `/admin/users/[id]` (stored as `lms_profiles.role = 'admin'`). Admins also get an "open admin dashboard" link in settings.

**Pages:**

| Route | What it does |
|---|---|
| `/admin` | KPIs (users, daily and monthly actives, sessions, completion rate, average score, AI error rate), daily trends, sessions by domain, weekly retention, things needing attention |
| `/admin/users` | Search and sort users. Detail page: stats, sessions, feedback, AI usage; suspend (bans the auth user), make/remove admin, reset progress, delete account, export all their data as JSON |
| `/admin/sessions` | Filter by status (including stuck > 2h), domain and level. Viewer: questions, answers, follow-ups, evaluations, who scored each answer and why scoring failed. Force-abandon stuck sessions |
| `/admin/questions` | Bank browser with times asked, skip rate and average score; add, edit, retire/restore; coverage per domain and level; review generated questions; CSV export |
| `/admin/feedback` | Inbox with new / triaged / resolved status, private notes, CSV export |
| `/admin/ai` | Claude, eval agent and Deepgram calls, failures and latency per operation; estimated Claude cost from token counts (`src/lib/admin/pricing.ts`); agent vs fallback vs not-scored share; score distribution |
| `/admin/system` | Live checks (database, eval agent, keys present), DB size and table rows, busiest rate-limit buckets; switches to **pause new sessions** and show a **maintenance banner** |
| `/admin/announcements` | Banners shown at the top of the app, with an optional end time |
| `/admin/audit` | Every admin action: who, what, when |

**Security:** each admin page and `/api/admin/*` route checks admin access on the server (`src/lib/admin/guard.ts`); non-admins are sent back to the app and get 403 from the APIs. Admin data is read with the service-role key, server-side only, through `lms_admin_*` functions only the service role can call. Users can't change their own `role` or suspension (a trigger rejects it). Every write is logged to `lms_admin_audit`. You can't suspend, demote or delete your own account from the dashboard.

**Usage numbers** start from the deploy that includes migration 0014: each Claude, eval-agent and Deepgram call is recorded in `lms_usage_events` after the response is sent (`src/lib/admin/usage.ts`), and a failed write never affects the user.

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
├─ app/                  routes; (admin)/admin/* dashboard; api/sessions/*, api/admin/*; auth/callback
├─ proxy.ts              Supabase session refresh + route gating (Next 16's "middleware")
├─ components/           auth, landing, setup, session, report, profile, common, ui (shadcn)
├─ hooks/                speech recognition, audio recorder, session state machine, timer
├─ lib/
│  ├─ admin/             admin guard, audit log, usage tracking, dashboard queries
│  ├─ agent/             HTTP client + mapping for the Python eval agent
│  ├─ sessions/          per-question scoring engine (agent → Claude fallback), persistence
│  ├─ supabase/          browser + server clients
│  ├─ llm/               Claude client, prompts, schemas
│  ├─ data.ts            SWR hooks (profile, sessions) + session API calls
│  ├─ scoring.ts         report assembly + 70/30 weighting
│  └─ stats.ts           streaks, heatmap, trend
└─ types/
supabase/migrations/     database schema
agents/eval_agent/       the evaluation agent (separate repo); server.py is its HTTP wrapper
```
