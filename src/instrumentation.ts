import type { Instrumentation } from "next";

/**
 * Server error reporting. Every error Next.js catches on the server is written as one JSON line to the server log
 * (Vercel → Project → Logs, filter "boh-error"). No third-party service and no account needed.
 * Only the path without its query, the method, where it happened and the error's message and digest are logged:
 * never headers, cookies, query strings or request bodies, so sign-in tokens and form data stay out of the logs.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const message = error instanceof Error ? error.message : String(error);
  const digest = typeof error === "object" && error !== null && "digest" in error ? String((error as { digest: unknown }).digest) : undefined;
  console.error(JSON.stringify({
    tag: "boh-error",
    at: new Date().toISOString(),
    path: request.path.split("?")[0],
    method: request.method,
    route: context.routePath,
    type: context.routeType,
    message: message.slice(0, 500),
    digest,
  }));
};
