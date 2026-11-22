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

**Deploying a new migration:** run it in Supabase *before* deploying the code that uses it. Apply 0014 and 0015 before this version goes live: without them the app keeps working, but `/admin` shows errors and usage and server errors aren't recorded.

## Admin dashboard (`/admin`)

**Setup (once):**
1. Run `supabase/migrations/0014_admin.sql`, then `0015_admin_more.sql`, in the Supabase SQL editor *before* deploying.
2. In Vercel (Project → Settings → Environment Variables) and `.env.local`, set:
   - `ADMIN_EMAILS`: comma-separated admin emails. Those accounts are always admins. Emails live in env only, never in the repo.
   - `CRON_SECRET`: a long random string, for the scheduled health check.
   - Optional: `RESEND_API_KEY` + `EMAIL_FROM` (email alerts and `/admin/email`), `ALERT_EMAILS`, `ALERT_WEBHOOK_URL` (Slack or Discord), `NEXT_PUBLIC_APP_URL` (links in emails).
3. **Two-factor sign-in:** in Supabase → Authentication → Multi-factor, make sure TOTP (authenticator app) is enabled. Every admin is asked to set it up at `/admin-mfa` the first time, then to enter a code once per sign-in. `ADMIN_MFA_REQUIRED=false` turns this off (local development only).
4. **Schedule the health check:** run the commented `cron.schedule` block at the top of `0015_admin_more.sql` once in the SQL editor, with your app URL and `CRON_SECRET`. Supabase then calls `/api/cron/tick` every 10 minutes. This works on any Vercel plan.
5. Redeploy.

**Roles:** `ADMIN_EMAILS` and `role = 'admin'` get full access. `role = 'support'` can see everything but change nothing (no buttons, 403 from write APIs; CSV/JSON exports are allowed). Set roles from `/admin/users/[id]`. Admins and support get an "open admin dashboard" link in settings.

**Pages:**

| Route | What it does |
|---|---|
| `/admin` | KPIs, daily trends, sign-up funnel (signed up → started → finished → came back), sessions by domain, weekly retention, and everything needing attention (open alerts, unscored answers, new errors, new feedback, stuck sessions) |
| `/admin/ai` | Claude, eval agent and Deepgram calls, failures and latency per operation; estimated Claude cost (`src/lib/admin/pricing.ts`); agent vs fallback vs not-scored share; score distribution |
| `/admin/errors` | Server errors grouped by kind (count, users affected, first/last seen, recent stack traces). Recorded from API routes and from `src/instrumentation.ts` for anything uncaught |
| `/admin/alerts` | Open alerts and history, thresholds, delivery status, "send test alert". The 10-minute check alerts on AI failure rate, eval agent down, stuck sessions, new kinds of error and budget (80% / 100%), and again when each recovers (one message per incident) |
| `/admin/system` | Live checks, configuration, DB size, busiest rate-limit buckets. Switches: **maintenance mode** (banner + no new sessions), **pause new sessions**. **Daily AI budget**: new sessions pause once today's estimated Claude spend reaches it. **Rate limits** editable without a deploy |
| `/admin/users` | Search, sort, CSV export. Detail page: stats, sessions, feedback, AI usage; suspend, roles (admin / support), temporary rate-limit override, reset progress, delete account, JSON data export |
| `/admin/sessions` | Filter by status (including stuck and "has unscored answers"), domain and level. Viewer with every answer, follow-up, evaluation and scoring error. **Re-score** unscored answers with Claude (rebuilds the report and per-question stats); force-abandon stuck sessions |
| `/admin/feedback` | Inbox with new / triaged / resolved status, private notes, CSV export |
| `/admin/email` | Email users through Resend: people who said ok to contact, inactive for N days, everyone, or one user. Preview recipients first; opted-out users are skipped; every send is logged |
| `/admin/announcements` | Banners shown at the top of the app, with an optional end time |
| `/admin/questions` | Bank browser with stats; add, edit, retire/restore; **CSV import** (checked first, duplicates skipped); coverage per domain and level; CSV export |
| `/admin/quality` | Spot-check random scored answers (fair / too high / too low) with a summary by domain and scorer; weakest and strongest topics across all users, with "add question" for a topic |
| `/admin/audit` | Every admin action: who, what, when |
| `/admin/search` | The search box in the header: users, sessions and questions; a pasted id opens it directly |

**Security:** each admin page and `/api/admin/*` route checks access, role and two-factor sign-in on the server (`src/lib/admin/guard.ts`). Admin data is read with the service-role key, server-side only, through `lms_admin_*` functions only the service role can call. Users can't change their own role or suspension (a trigger rejects it). Every write is logged to `lms_admin_audit`. You can't suspend, demote or delete your own account from the dashboard.

**Recorded by the app:** Claude, eval-agent and Deepgram calls (`lms_usage_events`, since 0014) and server errors (`lms_error_events`, since 0015). Both are written after the response is sent, and a failed write never affects the user.

**Users' side:** settings has a "product emails" switch (`lms_profiles.email_opt_out`). Rate limits resolve as: the user's unexpired override, then the admin setting, then the default in `src/lib/limits.ts`. They're cached for a minute per server instance.

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
