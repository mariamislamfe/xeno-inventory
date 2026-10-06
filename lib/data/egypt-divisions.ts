// Egyptian address tree from the J&T "Addresses with codes" sheet.
// Data lives in jt-addresses.json — regenerate it from the sheet rather than editing by hand.
import raw from "./jt-addresses.json";

export interface EgyptArea {
  name: string;
  code: string; // J&T district code
}

export interface EgyptCity {
  name: string;
  code: string; // J&T city code
  areas: EgyptArea[];
}

export interface EgyptProvince {
  name: string; // Arabic name as used by J&T
  code: string; // J&T province code
  cities: EgyptCity[];
}

type RawData = [string, string, [string, string, [string, string][]][]][];

export const EGYPT_DIVISIONS: EgyptProvince[] = (raw as RawData).map(([name, code, cities]) => ({
  name,
  code,
  cities: cities.map(([cName, cCode, areas]) => ({
    name: cName,
    code: cCode,
    areas: areas.map(([aName, aCode]) => ({ name: aName, code: aCode })),
  })),
}));

export const EG_PROVINCES = EGYPT_DIVISIONS.map((p) => p.name);

/** Fast lookup: province name → list of city names */
export function getCities(provinceName: string): string[] {
  const prov = EGYPT_DIVISIONS.find((p) => p.name === provinceName);
  return prov ? prov.cities.map((c) => c.name) : [];
}

/** Fast lookup: province + city → list of area names */
export function getAreas(provinceName: string, cityName: string): string[] {
  const prov = EGYPT_DIVISIONS.find((p) => p.name === provinceName);
  const city = prov?.cities.find((c) => c.name === cityName);
  return city ? city.areas.map((a) => a.name) : [];
}

// ── Search ─────────────────────────────────────────────────────────────

/** Normalize Arabic for matching: unify alef/yeh/teh-marbuta, strip tashkeel and tatweel. */
export function normalizeArabic(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

// "الزقازيق" should match "زقازيق" — the definite article is optional when typing
const stripAl = (w: string) => (w.startsWith("ال") && w.length > 3 ? w.slice(2) : w);

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Direct match — lower is better, -1 = none: 0 name starts with query · 1 a word does · 2 contains it */
export function matchScore(name: string, q: string): number {
  if (!q) return 0;
  if (name.startsWith(q) || stripAl(name).startsWith(q)) return 0;
  if (name.split(" ").some((w) => w.startsWith(q) || stripAl(w).startsWith(q))) return 1;
  if (name.includes(q)) return 2;
  return -1;
}

/** Typo distance between the query and the closest word beginning (Infinity if hopeless). */
function typoDistance(name: string, q: string): number {
  let best = Infinity;
  for (const w of name.split(" ")) {
    for (const cand of [w, stripAl(w)]) {
      // Compare against the same-length prefix, ±1 letter for a missing/extra one
      for (const len of [q.length - 1, q.length, q.length + 1]) {
        if (len <= 0 || len > cand.length + 1) continue;
        best = Math.min(best, editDistance(q, cand.slice(0, len)));
      }
    }
  }
  return best;
}

/**
 * Filter + sort searchable items, closest matches first.
 * Falls back to typo-tolerant matching only when nothing contains the query.
 */
export function rankByQuery<T extends { norm: string }>(items: T[], query: string, limit = 60): T[] {
  const q = normalizeArabic(query);
  if (!q) return items.slice(0, limit);

  const byScore = (a: { item: T; score: number }, b: { item: T; score: number }) =>
    a.score - b.score || a.item.norm.length - b.item.norm.length;

  const hits: { item: T; score: number }[] = [];
  for (const item of items) {
    const score = matchScore(item.norm, q);
    if (score >= 0) hits.push({ item, score });
  }
  if (hits.length > 0) return hits.sort(byScore).slice(0, limit).map((h) => h.item);

  // Typos only make sense once a few letters are typed
  const allowed = q.length < 3 ? 0 : q.length < 6 ? 1 : 2;
  if (allowed === 0) return [];
  const near: { item: T; score: number }[] = [];
  for (const item of items) {
    const d = typoDistance(item.norm, q);
    if (d <= allowed) near.push({ item, score: d });
  }
  return near.sort(byScore).slice(0, limit).map((h) => h.item);
}

// Flat, pre-normalized lists so city/area fields can search across all governorates
export interface CityEntry { province: string; city: string; norm: string }
export interface AreaEntry { province: string; city: string; area: string; norm: string }

export const PROVINCE_ENTRIES = EGYPT_DIVISIONS.map((p) => ({ province: p.name, norm: normalizeArabic(p.name) }));

export const CITY_ENTRIES: CityEntry[] = EGYPT_DIVISIONS.flatMap((p) =>
  p.cities.map((c) => ({ province: p.name, city: c.name, norm: normalizeArabic(c.name) }))
);

export const AREA_ENTRIES: AreaEntry[] = EGYPT_DIVISIONS.flatMap((p) =>
  p.cities.flatMap((c) => c.areas.map((a) => ({ province: p.name, city: c.name, area: a.name, norm: normalizeArabic(a.name) })))
);

// ── Map a saved order address back onto the J&T list (for editing) ──
const squash = (s: string) => normalizeArabic(s).replace(/\s+/g, "");
const dropCityPrefix = (s: string) => s.replace(/^(مدينه|مركز|حي|قسم)\s+/, "");

function findByName<T>(items: T[], raw: string, name: (t: T) => string): T | undefined {
  const q = squash(dropCityPrefix(normalizeArabic(raw)));
  if (!q) return undefined;
  return items.find((t) => squash(name(t)) === q)
    ?? items.find((t) => squash(dropCityPrefix(normalizeArabic(name(t)))) === q)
    ?? items.find((t) => stripAl(squash(name(t))) === stripAl(q))
    // "مطروح" ↔ "مرسى مطروح"
    ?? (q.length >= 4 ? items.find((t) => squash(name(t)).endsWith(q) || q.endsWith(squash(name(t)))) : undefined);
}

/**
 * Orders store the area as a prefix of address1 ("المعادي، 12 شارع 9").
 * Returns J&T names where they match, otherwise the raw text so nothing is lost.
 */
export function resolveSavedAddress(input: { governorate: string; city: string; address: string }) {
  const prov = findByName(EGYPT_DIVISIONS, input.governorate, (p) => p.name);
  const cities = prov ? prov.cities : EGYPT_DIVISIONS.flatMap((p) => p.cities);
  const city = findByName(cities, input.city, (c) => c.name);
  const province = prov?.name
    ?? (city ? EGYPT_DIVISIONS.find((p) => p.cities.includes(city))?.name : undefined)
    ?? input.governorate;

  let area = "";
  let street = input.address ?? "";
  const m = street.match(/^([^،,]+)[،,]\s*(.*)$/);
  if (m && city) {
    const a = findByName(city.areas, m[1], (x) => x.name);
    if (a) { area = a.name; street = m[2]; }
  }
  return { province, city: city?.name ?? input.city, area, street };
}
