import { Info, TriangleAlert } from "lucide-react";
import { connection } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

type Banner = { id: string; message: string; level: "info" | "warning" };

/**
 * Live announcements and the maintenance message, set from /admin. Read with
 * the user's own client: RLS only returns live rows, and nothing when signed out.
 * Never breaks the page: any error just hides the banner.
 */
export async function AnnouncementBanner() {
  await connection();
  let banners: Banner[] = [];
  try {
    const supabase = await createSupabaseServer();
    const [ann, settings] = await Promise.all([
      supabase.from("lms_announcements").select("id, message, level").order("created_at", { ascending: false }).limit(3),
      supabase.from("lms_app_settings").select("key, value").in("key", ["maintenance", "sessions_paused"]),
    ]);
    for (const s of settings.data ?? []) {
      const v = s.value as { enabled?: boolean; message?: string };
      if (!v?.enabled) continue;
      const fallback =
        s.key === "maintenance" ? "we're doing some maintenance — things may be slow for a bit." : "starting new sessions is paused for a moment. please try again soon.";
      banners.push({ id: s.key, message: v.message?.trim() || fallback, level: "warning" });
    }
    banners = [...banners, ...((ann.data ?? []) as Banner[])];
  } catch {
    return null;
  }
  if (!banners.length) return null;

  return (
    <div className="flex flex-col">
      {banners.map((b) => {
        const Icon = b.level === "warning" ? TriangleAlert : Info;
        return (
          <div
            key={b.id}
            role={b.level === "warning" ? "alert" : "status"}
            className={
              b.level === "warning"
                ? "flex items-start justify-center gap-2 border-b border-[#4a3a10] bg-[#2a2108] px-4 py-2.5 text-center text-[13px] text-[#fbd27a]"
                : "flex items-start justify-center gap-2 border-b border-line bg-bubble px-4 py-2.5 text-center text-[13px] text-foreground/90"
            }
          >
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{b.message}</span>
          </div>
        );
      })}
    </div>
  );
}
