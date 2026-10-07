// Client: remember the order of the last orders list so an order page can step to
// the one above / below it. Per-tab (sessionStorage); any failure just disables it.
const KEY = "xeno:order-nav";

export function saveOrderNav(ids: string[]) {
  try { sessionStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* storage unavailable */ }
}

export function neighboursFromList(id: string): { up: string | null; down: string | null } | null {
  try {
    const ids = JSON.parse(sessionStorage.getItem(KEY) ?? "[]") as string[];
    const i = ids.indexOf(id);
    if (i < 0) return null;
    return { up: ids[i - 1] ?? null, down: ids[i + 1] ?? null };
  } catch {
    return null;
  }
}
