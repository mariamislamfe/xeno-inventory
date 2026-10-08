// The dashboard's own order statuses. They live in tags only this system writes,
// so Shopify's state (a "confirmed" tag from Vrobo, an order marked fulfilled in
// Shopify) never decides them: every order starts as "جديد" until the team calls
// the customer and sets it. All of them can be changed again at any time.

export const STATUS_TAG = {
  waiting:   "xeno-waiting",
  confirmed: "xeno-confirmed",
  cancelled: "xeno-cancelled",
} as const;

export type ReviewStatus = "new" | keyof typeof STATUS_TAG;

const ALL_STATUS_TAGS: string[] = Object.values(STATUS_TAG);

export function isStatusTag(tag: string) {
  return ALL_STATUS_TAGS.includes(tag.trim().toLowerCase());
}

export function reviewStatus(tags: string[]): ReviewStatus {
  const t = tags.map((x) => x.trim().toLowerCase());
  if (t.includes(STATUS_TAG.cancelled)) return "cancelled";
  if (t.includes(STATUS_TAG.confirmed)) return "confirmed";
  if (t.includes(STATUS_TAG.waiting))   return "waiting";
  return "new";
}

/** Replace whatever status tag an order has with `status` ("new" = none). */
export function withStatus(tags: string[], status: ReviewStatus): string[] {
  const kept = tags.map((x) => x.trim()).filter((x) => x && !isStatusTag(x));
  return status === "new" ? kept : [...kept, STATUS_TAG[status]];
}
