"use client";

import { JsonForm } from "@/components/admin/actions";
import { inputCls } from "@/components/admin/inputs";
import type { AlertSettings } from "@/lib/admin/alert-rules";
import { LIMIT_LABELS, LIMIT_NAMES, LIMITS } from "@/lib/limits";

const label = "flex flex-col gap-1 text-[12px] text-subtle";

export function BudgetForm({ enabled, dailyUsd }: { enabled: boolean; dailyUsd: number }) {
  return (
    <JsonForm
      url="/api/admin/config"
      submitLabel="save budget"
      transform={(f) => ({ key: "budget", value: { enabled: f.enabled === "on", daily_usd: Number(f.daily_usd) } })}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={label}>
          daily limit (USD)
          <input name="daily_usd" type="number" min={0} max={100000} step="0.5" required defaultValue={dailyUsd || 20} className={inputCls} />
        </label>
        <label className="flex items-center gap-2 self-end pb-2 text-[13px]">
          <input name="enabled" type="checkbox" defaultChecked={enabled} className="size-4 accent-[var(--brand)]" />
          pause new sessions when it&apos;s reached
        </label>
      </div>
    </JsonForm>
  );
}

export function RateLimitsForm({ current }: { current: Record<string, number> }) {
  return (
    <JsonForm
      url="/api/admin/config"
      submitLabel="save limits"
      transform={(f) => ({
        key: "rate_limits",
        value: Object.fromEntries(LIMIT_NAMES.map((n) => [n, Number(f[n])])),
      })}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {LIMIT_NAMES.map((n) => (
          <label key={n} className={label}>
            <span>
              {LIMIT_LABELS[n]} <span className="text-faint">(default {LIMITS[n].limit})</span>
            </span>
            <input name={n} type="number" min={0} max={100000} required defaultValue={current[n]} className={inputCls} />
          </label>
        ))}
      </div>
    </JsonForm>
  );
}

export function AlertSettingsForm({ settings }: { settings: AlertSettings }) {
  return (
    <JsonForm
      url="/api/admin/config"
      submitLabel="save thresholds"
      transform={(f) => ({
        key: "alerts",
        value: {
          enabled: f.enabled === "on",
          aiErrorRate: Number(f.aiErrorRate) / 100,
          aiMinCalls: Number(f.aiMinCalls),
          stuckSessions: Number(f.stuckSessions),
          newErrorGroups: Number(f.newErrorGroups),
        },
      })}
    >
      <label className="flex items-center gap-2 text-[13px]">
        <input name="enabled" type="checkbox" defaultChecked={settings.enabled} className="size-4 accent-[var(--brand)]" />
        run health checks and send alerts
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={label}>
          AI failure rate, last 30 min (%)
          <input name="aiErrorRate" type="number" min={1} max={100} required defaultValue={Math.round(settings.aiErrorRate * 100)} className={inputCls} />
        </label>
        <label className={label}>
          …only when at least this many calls
          <input name="aiMinCalls" type="number" min={0} max={100000} required defaultValue={settings.aiMinCalls} className={inputCls} />
        </label>
        <label className={label}>
          stuck sessions (in progress &gt; 2h)
          <input name="stuckSessions" type="number" min={0} max={100000} required defaultValue={settings.stuckSessions} className={inputCls} />
        </label>
        <label className={label}>
          new kinds of error in an hour
          <input name="newErrorGroups" type="number" min={0} max={100000} required defaultValue={settings.newErrorGroups} className={inputCls} />
        </label>
      </div>
      <p className="text-[12px] text-faint">0 turns a check off. The eval agent and budget checks always run.</p>
    </JsonForm>
  );
}
