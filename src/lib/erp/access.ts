/**
 * Access rules for the signed-in app that do not depend on Supabase settings.
 *
 * Company creation is invite-only: the server action allows it only for emails listed in BOH_COMPANY_CREATORS
 * (comma-separated, server-only). With no list set, nobody can create a company, even if sign-ups are switched
 * on by mistake. Members of an existing company are added by its owner or admin and are not affected.
 */

export function creatorList(raw: string | undefined): string[] {
  return (raw ?? "").split(",").map((item) => item.trim().toLowerCase()).filter((item) => /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(item));
}

export function canCreateCompany(email: string | null | undefined, creators: string[]): boolean {
  const normal = (email ?? "").trim().toLowerCase();
  return normal.length > 0 && creators.includes(normal);
}

export type AlertInput = { path: string; method: string; route: string; message: string; digest?: string };

/** The body sent to the optional ALERT_WEBHOOK_URL: no headers, cookies, query strings or form data. */
export function alertPayload(input: AlertInput) {
  const path = input.path.split("?")[0].slice(0, 200);
  const message = input.message.slice(0, 300);
  return {
    text: `BOH ERP server error on ${input.method} ${path}: ${message}`,
    path, method: input.method.slice(0, 10), route: input.route.slice(0, 200), message, digest: input.digest?.slice(0, 40),
  };
}
