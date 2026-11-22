import type { Instrumentation } from "next";

/**
 * Uncaught server errors (pages, layouts, route handlers that throw) go to the
 * admin error log (/admin/errors). Errors the routes already handle are logged
 * where they're caught. Only runs in the Node.js runtime, where the service key is.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Expected control flow (redirect(), notFound()) isn't an error.
  const digest = typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : undefined;
  if (digest?.startsWith("NEXT_REDIRECT") || digest?.startsWith("NEXT_HTTP_ERROR_FALLBACK")) return;
  const { logServerErrorNow } = await import("@/lib/admin/errors");
  await logServerErrorNow(context.routeType === "route" ? "route" : "render", err, {
    route: context.routePath,
    digest,
    details: { method: request.method, path: request.path, routerKind: context.routerKind },
  });
};
