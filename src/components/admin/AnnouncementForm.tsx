"use client";

import { JsonForm } from "@/components/admin/actions";
import { inputCls } from "@/components/admin/inputs";

/** New-announcement form. The end time is converted from the admin's local time in the browser. */
export function AnnouncementForm() {
  return (
    <JsonForm
      url="/api/admin/announcements"
      submitLabel="publish"
      resetOnSuccess
      transform={(f) => ({
        message: f.message,
        level: f.level,
        endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : undefined,
      })}
    >
      <label className="flex flex-col gap-1 text-[12px] text-subtle">
        message
        <textarea name="message" required maxLength={500} rows={2} className={inputCls} placeholder="e.g. new system design questions are live!" />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[12px] text-subtle">
          style
          <select name="level" defaultValue="info" className={inputCls}>
            <option value="info">info</option>
            <option value="warning">warning</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-subtle">
          ends (optional)
          <input type="datetime-local" name="endsAt" className={inputCls} />
        </label>
      </div>
    </JsonForm>
  );
}
