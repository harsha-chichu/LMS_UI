import { isAdmin } from "@/lib/admin/guard";
import { requireUser } from "@/lib/auth";

/** Whether the signed-in user can open /admin (drives the link in settings). */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return Response.json({ admin: false }, { headers: { "cache-control": "no-store" } });
  return Response.json({ admin: await isAdmin(auth.user) }, { headers: { "cache-control": "private, no-store" } });
}
