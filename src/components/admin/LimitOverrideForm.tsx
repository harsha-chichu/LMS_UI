"use client";

import { JsonForm } from "@/components/admin/actions";
import { AdminSelect, inputCls } from "@/components/admin/inputs";
import { LIMIT_LABELS, LIMIT_NAMES } from "@/lib/limits";

/** Gives one user a different limit for a number of hours. */
export function LimitOverrideForm({ userId }: { userId: string }) {
  return (
    <JsonForm
      url={`/api/admin/users/${userId}/limits`}
      submitLabel="set override"
      transform={(f) => ({ bucket: f.bucket, maxCount: Number(f.maxCount), hours: Number(f.hours) })}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-[12px] text-subtle">
          limit
          <AdminSelect wrapperClassName="w-full" name="bucket" className={inputCls} defaultValue="session">
            {LIMIT_NAMES.map((n) => (
              <option key={n} value={n}>
                {LIMIT_LABELS[n]}
              </option>
            ))}
          </AdminSelect>
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-subtle">
          new limit
          <input name="maxCount" type="number" min={0} max={100000} required defaultValue={100} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-subtle">
          for how many hours
          <input name="hours" type="number" min={1} max={2160} required defaultValue={24} className={inputCls} />
        </label>
      </div>
    </JsonForm>
  );
}
