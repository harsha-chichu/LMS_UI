# LMS. — interview practice

Pick a domain, answer out loud (or type), get follow-ups when an answer is thin, and finish with a report scored out of 100 (70% answer content, 30% communication). Each question shows what worked, what to improve, your answer and a suggested answer.

**Built with:** Next.js 16 (App Router), Supabase (auth + Postgres), Tailwind CSS v4 and shadcn/ui (Base UI).

**AI services:**
- **Scoring:** the separate **eval agent** ([`harsha-chichu/preppy_eval_agent`](https://github.com/harsha-chichu/preppy_eval_agent), Python, Gemini) decides follow-ups, scores answers, writes the suggested answers and summarises the session.
- **Claude** (Anthropic SDK) is the **backup** scorer when the agent fails, and writes new questions when the question bank can't fill a session.
- **Deepgram** transcribes voice answers live.

## Run it

```bash
npm install
cp .env.example .env.local      # fill in the keys (see "Environment variables")
npm run dev                     # http://localhost:3000
```

Run the eval agent from its own repo, in a second terminal:

```bash
git clone https://github.com/harsha-chichu/preppy_eval_agent
```

```bash
cd preppy_eval_agent && uv run uvicorn server:app --host 127.0.0.1 --port 8000
```

Use the same token on both sides: `EVAL_AGENT_TOKEN` in the agent's `.env` and in this app's `.env.local`. Point `EVAL_AGENT_URL` at the agent (`http://127.0.0.1:8000` locally). Without an agent the app still works, with Claude scoring everything.

## Environment variables

Set them in `.env.local` locally and in Vercel → Settings → Environment Variables in production, then redeploy. Never prefix a secret with `NEXT_PUBLIC_`. `/admin/system` shows which are set (names only).

| Variable | Needed? | What it's for | Without it |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL | nothing works |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `…_PUBLISHABLE_KEY`) | yes | browser and server Supabase clients | nothing works |
| `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`) | yes | server-only writes (sessions, admin, logs) | sessions can't be saved |
| `EVAL_AGENT_URL`, `EVAL_AGENT_TOKEN` | recommended | the eval agent (main scorer) | Claude scores everything |
| `ANTHROPIC_API_KEY` | recommended | backup scoring, follow-ups and summaries; new questions for custom topics | no backup when the agent fails (answers end up "not scored"); custom topics get existing bank questions instead of new ones |
| `DEEPGRAM_API_KEY` | optional | live transcription | browser speech recognition (Chrome, Edge, Safari) |
| `ADMIN_EMAILS` | for `/admin` | comma-separated admin emails | only profiles with `role = 'admin'` can open `/admin` |
| `ADMIN_MFA_REQUIRED` | optional | `false` turns off admin two-factor sign-in (local dev only) | 2FA required |
| `CRON_SECRET` | for alerts | lets the Supabase schedule call `/api/cron/tick` | no alerts or budget alerts |
| `RESEND_API_KEY`, `EMAIL_FROM` | optional | email alerts and `/admin/email` (needs a domain verified in Resend) | no email |
| `ALERT_EMAILS` | optional | who gets alert emails | alerts go to `ADMIN_EMAILS` |
| `ALERT_WEBHOOK_URL` | optional | Slack or Discord channel for alerts | no chat alerts |
| `NEXT_PUBLIC_APP_URL` | optional | links in emails and alerts | relative links |

## One-time Supabase setup
1. **SQL editor:** run every file in `supabase/migrations/`, in order (`0001` … `0015`).
   - The early ones create profiles, sessions, the question bank and their policies.
   - `0014` and `0015` add the admin dashboard.
   - Existing tables are untouched.
2. **Service key:** copy the service_role key into `SUPABASE_SERVICE_ROLE_KEY`.
3. **Authentication → URL configuration:**
   - site URL: `http://localhost:3000`
   - redirect URL: `http://localhost:3000/auth/callback`
4. **Authentication → Providers → Google:** enable it, then paste the client id and secret from Google Cloud. The authorised redirect URI is `https://<project>.supabase.co/auth/v1/callback`.
5. **For `/admin`:** follow "Admin dashboard → Setup" below (2FA and the health-check schedule).

## How it works

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
For each answer, in this order:
1. **Eval agent.** The answer (with the recording, for voice) goes to the eval agent. It replies as soon as it has decided whether to ask a follow-up. Scoring then continues in the background (score, feedback, strengths and weaknesses, suggested answer and key points, delivery scores for voice) and is collected when the session finishes.
2. **Claude.** If the agent is down or errors, Claude scores instead (`src/lib/llm/`).
3. **Not scored.** If both fail, the answer is kept and retried when the session finishes. If it still can't be scored, the report marks it "not scored" and leaves it out of the average. Admins can **re-score** it later from `/admin/sessions`.

More details:
- The session summary also comes from the agent first, then Claude, then a plain fallback text.
- The report weights answers 70% and communication 30%. With recorded audio, the agent's grammar, pronunciation, fluency and clarity scores are blended into communication.
- The agent keeps state in memory. Restarting it mid-session drops in-flight evaluations; the fallback covers them.
- API routes require a signed-in user. Routes that cost money are rate-limited per user (defaults in `src/lib/limits.ts`, editable in `/admin/system`): 30 sessions a day, 120 transcription tokens and 300 answers an hour, 20 feedback messages a day. Counters live in Postgres (`lms_rate_limit`) and are taken atomically.
- Saving an answer is a compare-and-set on that question (`lms_save_result_guarded`). A double submit or a second tab gets a 409 instead of overwriting the first answer.
- Users can read their own sessions but not write them. Only the API routes write them, with the service-role key, so scores on the friends leaderboard can't be edited from the browser.
- New sessions can be blocked by maintenance mode, "pause new sessions" or the daily AI budget (all in `/admin/system`). Everything else keeps working.

## Checks

```bash
npm run lint
npm run typecheck   # generates Next's route types, then tsc
npm test            # vitest
npm run build
```

CI (`.github/workflows/ci.yml`) runs all of these on every pull request, plus `npm audit` for production dependencies and a job that applies every migration to a fresh Postgres.

**Region:** API routes run in Vercel's Seoul region (`icn1`, set in `vercel.json`), next to the Supabase project (ap-northeast-2). Each answer makes several sequential Supabase calls plus one to the eval agent (Singapore), so a far-away region adds a round trip to each. Move it if the database moves.

**Deploying a new migration:** run it in Supabase *before* deploying the code that uses it. Without `0014` and `0015`, the app keeps working, but `/admin` shows errors, and usage and server errors aren't recorded.

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
| `/admin/sessions` | Filter by status (including stuck, "has unscored answers" and "missing suggested answers"), domain and level. Viewer with every answer, follow-up, evaluation, suggested answer and scoring error. **Add suggested answers** where the scorer left them out (score and feedback stay the same). **Re-score** unscored answers with the eval agent, Claude as backup (rebuilds the report and per-question stats); force-abandon stuck sessions |
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

| Route | What it is |
|---|---|
| `/` | Landing |
| `/setup` | Session setup |
| `/session/[id]` | Listening · follow-up · text mode (resumes after refresh) |
| `/report/[id]` | Final report: per question, what worked / to improve, then your answer next to the suggested answer |
| `/profile`, `/friends`, `/settings` | Progress, friends, preferences |
| `/admin/*` | Admin dashboard (see above) |
| `/admin-mfa` | Two-factor sign-in for admins |

Plus `/login`, `/signup`, `/forgot-password`, `/reset-password`. Everything except the landing page and auth screens requires sign-in (`src/proxy.ts`).

## Troubleshooting

| What you see | Why | Fix |
|---|---|---|
| Re-score or scoring error `claude: 401 … invalid x-api-key`; `/admin/system` shows Claude **key rejected** | `ANTHROPIC_API_KEY` is missing or wrong. Claude is only the backup, so this shows up when the eval agent also fails | Put a valid key from console.anthropic.com in Vercel, then redeploy |
| Answers "not scored" | The eval agent and Claude both failed at the time (the reason is on the session in `/admin/sessions`) | Fix the cause, then use **re-score** on the session |
| No "suggested answer" in a report, mostly on questions with follow-ups | The eval agent returned a score without one. Fixed in `preppy_eval_agent`, where the suggested answer is now required | Redeploy the agent. For existing reports, go to `/admin/sessions` → "missing suggested answers" → **add suggested answers** (scores don't change) |
| No alerts arrive | The scheduled check isn't running | Set `CRON_SECRET`, run the `cron.schedule` block from `0015` once, then check `select status_code, created from net._http_response order by created desc limit 5;` (401 = wrong secret, 503 = not set or not redeployed, 404 = wrong URL) |
| `/admin-mfa` can't show a QR code | TOTP is off in Supabase | Supabase → Authentication → Multi-factor → enable authenticator app (TOTP). It's free; only SMS is paid |
| Locked out of `/admin` (lost authenticator) | 2FA is required | Temporarily set `ADMIN_MFA_REQUIRED=false`, redeploy, set up 2FA again, then remove it |
| A page in `/admin` shows "This page couldn't load" | A server error | `/admin/errors` lists it with the stack trace, and so do the Vercel logs |

## Where things live

```
src/
├─ app/
│  ├─ (app)/               signed-in user screens (setup, profile, report, friends, settings)
│  ├─ (admin)/admin/       admin dashboard pages
│  ├─ (admin-mfa)/         two-factor sign-in for admins
│  └─ api/
│     ├─ sessions/*        start, answers, skip, complete, abandon
│     ├─ admin/*           admin actions (every route checks access + 2FA)
│     └─ cron/tick         scheduled health check (alerts)
├─ instrumentation.ts      records uncaught server errors for /admin/errors
├─ proxy.ts                Supabase session refresh + route gating (Next 16's "middleware")
├─ components/             auth, landing, setup, session, report, profile, admin, common, ui (shadcn)
├─ hooks/                  speech recognition, audio recorder, session state machine, timer
├─ lib/
│  ├─ admin/               guard (roles, 2FA), audit log, usage + error logging, alerts, budget, CSV, dashboard queries
│  ├─ agent/               HTTP client + mapping for the eval agent
│  ├─ sessions/            per-question scoring engine (agent → Claude), re-scoring, persistence
│  ├─ llm/                 Claude client, prompts, schemas
│  ├─ supabase/            browser + server clients
│  ├─ limits.ts            rate-limit defaults
│  ├─ scoring.ts           report assembly + 70/30 weighting
│  └─ stats.ts             streaks, heatmap, trend
└─ types/
supabase/migrations/       database schema (run in order)
```

The eval agent lives in its own repo, [`harsha-chichu/preppy_eval_agent`](https://github.com/harsha-chichu/preppy_eval_agent).
