// Which orders are duplicates of each other (same customer ordering twice before
// shipping). Shared by the orders page and the server-side auto-merge so both
// always agree on what gets merged.
import { phoneKey } from "@/lib/phone";
import { reviewStatus } from "@/lib/order-status";

interface MergeableOrder {
  shopifyId: number;
  customerName: string;
  customerPhone: string;
  status: string;
  tags: string[];
  trackingNumber?: string;
}

// Normalize Arabic name for fuzzy matching (strip diacritics, unify alef forms, collapse spaces)
export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[ً-ٰٟ]/g, "")   // strip tashkeel + superscript alef
    .replace(/[أإآ]/g, "ا")                   // unify alef variants
    .replace(/ة/g, "ه")                        // teh marbuta → heh
    .replace(/\s+/g, " ");
}

export function namesMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return true;
  // Accept if first word (first name) matches — handles "محمد" vs "محمد أحمد"
  const firstA = na.split(" ")[0];
  const firstB = nb.split(" ")[0];
  return firstA.length >= 3 && firstA === firstB;
}

/** Still open, not ملغي on the dashboard and not sent to J&T yet. */
export function isMergeCandidate(o: MergeableOrder): boolean {
  if (o.status !== "pending" && o.status !== "processing") return false;
  if (reviewStatus(o.tags) === "cancelled") return false;
  if (o.trackingNumber) return false;   // already sent to J&T — never merge/delete it
  return phoneKey(o.customerPhone) !== "";
}

/** Groups of 2+ orders with the same phone AND matching name, keyed by "phone_n". */
export function findMergeGroups<T extends MergeableOrder>(orders: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const o of orders) {
    if (!isMergeCandidate(o)) continue;
    const phone = phoneKey(o.customerPhone); // +20 / 0020 / 0 prefixes → same key
    if (!groups.has(phone)) groups.set(phone, []);
    groups.get(phone)!.push(o);
  }
  const result = new Map<string, T[]>();
  for (const [phone, group] of groups) {
    if (group.length < 2) continue;
    // Split into sub-groups where all names match each other
    const subGroups: T[][] = [];
    for (const order of group) {
      const matched = subGroups.find((sg) => namesMatch(sg[0].customerName, order.customerName));
      if (matched) matched.push(order);
      else subGroups.push([order]);
    }
    subGroups.forEach((sg, i) => {
      if (sg.length >= 2) result.set(`${phone}_${i}`, sg);
    });
  }
  return result;
}

/** Same group of orders → same key, whatever the order. */
export function mergeGroupKey(group: { shopifyId: number }[]): string {
  return group.map((o) => o.shopifyId).sort((a, b) => a - b).join(",");
}
