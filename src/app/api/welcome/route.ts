import { after } from "next/server";
import { logServerError } from "@/lib/admin/errors";
import { requireUser } from "@/lib/auth";
import { personalize, shouldShowWelcome, welcomeTitle } from "@/lib/welcome";
import { announceSignup, claimSignup, getWelcomeSetting } from "@/lib/welcome-server";

/**
 * Called by the welcome popup on every signed-in page load. The first call for
 * a user counts as their sign-up: admins get an alert and the user gets the
 * welcome email (after the response). Returns the note while it's unread.
 */
export async function POST() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    const [welcome, signup] = await Promise.all([getWelcomeSetting(), claimSignup(auth.user.id)]);
    if (signup.isNew) after(() => announceSignup(auth.user, welcome));

    if (!shouldShowWelcome(welcome, signup.seenAt)) return Response.json({ show: false });
    const name = (auth.user.user_metadata?.name ?? auth.user.user_metadata?.full_name) as string | undefined;
    return Response.json({ show: true, title: personalize(welcomeTitle(welcome), name), body: personalize(welcome.body, name) });
  } catch (err) {
    console.error("[welcome] failed:", err);
    logServerError("welcome", err, { route: "/api/welcome", userId: auth.user.id });
    return Response.json({ show: false });
  }
}
