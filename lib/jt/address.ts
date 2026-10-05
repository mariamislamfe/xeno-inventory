// Map a free-form Shopify address onto J&T's address table.
// J&T rejects any prov/city/area that isn't spelled exactly as in its table
// (errors 145003060/61/62), so every shipment goes through resolveJTAddress.
import {
  EGYPT_DIVISIONS, normalizeArabic, rankByQuery, type EgyptProvince, type EgyptCity,
} from "@/lib/data/egypt-divisions";

export interface JTAddress {
  prov: string;
  city: string;
  area: string;
  areaGuessed: boolean; // true when no area was found in the address and a default was used
}

export type JTAddressResult = ({ ok: true } & JTAddress) | { ok: false; error: string };

// Shopify stores Egyptian governorates in English; key = lowercase letters only, "al/el" dropped
const EN_PROVINCES: Record<string, string> = {
  cairo: "القاهرة", alexandria: "الإسكندرية", giza: "الجيزة",
  sharqia: "الشرقية", sharkia: "الشرقية", sharqiya: "الشرقية",
  dakahlia: "الدقهلية", daqahliya: "الدقهلية", beheira: "البحيرة", buhayrah: "البحيرة",
  monufia: "المنوفية", menofia: "المنوفية", minufiya: "المنوفية",
  gharbia: "الغربية", gharbiya: "الغربية",
  kafrsheikh: "كفر الشيخ", kafrelsheikh: "كفر الشيخ", kafrashshaykh: "كفر الشيخ",
  ismailia: "الإسماعيلية", portsaid: "بور سعيد", suez: "السويس",
  northsinai: "شمال سيناء", southsinai: "جنوب سيناء",
  faiyum: "الفيوم", fayoum: "الفيوم", fayyum: "الفيوم",
  benisuef: "بني سويف", banisuwayf: "بني سويف",
  minya: "المنيا", asyut: "أسيوط", assiut: "أسيوط", sohag: "سوهاج", qena: "قنا",
  luxor: "الأقصر", aswan: "أسوان", redsea: "البحر الأحمر", newvalley: "الوادي الجديد",
  matrouh: "مرسى مطروح", marsamatrouh: "مرسى مطروح", matruh: "مرسى مطروح",
  damietta: "دمياط", qalyubia: "القليوبية", qaliubiya: "القليوبية", qalyubiyya: "القليوبية",
};

// Arabic spellings that differ from J&T's
const AR_PROVINCE_ALIASES: Record<string, string> = {
  [normalizeArabic("مطروح")]:   "مرسى مطروح",
  [normalizeArabic("بورسعيد")]: "بور سعيد",
  [normalizeArabic("بنى سويف")]: "بني سويف",
  [normalizeArabic("شرقيه")]:   "الشرقية",
  [normalizeArabic("اسكندريه")]: "الإسكندرية",
};

// Well-known place names (Arabic + English) that J&T files under a different city name
const CITY_ALIASES: [string[], string, string][] = [
  [["التجمع", "التجمع الخامس", "التجمع الثالث", "القاهره الجديده", "الرحاب", "newcairo", "fifthsettlement", "tagamoa", "rehab"], "القاهرة", "القاهرة الجديدة"],
  [["مصر الجديده", "heliopolis", "masrelgedida"], "القاهرة", "هليوبوليس"],
  [["nasrcity", "madinetnasr"], "القاهرة", "مدينة نصر"],
  [["maadi"], "القاهرة", "المعادي"],
  [["zamalek"], "القاهرة", "الزمالك"],
  [["helwan"], "القاهرة", "حلوان"],
  [["mokattam", "mokatam"], "القاهرة", "المقطم"],
  [["shorouk", "elshorouk"], "القاهرة", "الشروق"],
  [["madinaty"], "القاهرة", "مدينتي"],
  [["شبرا", "shubra", "shoubra"], "القاهرة", "شبرا مصر"],
  [["اكتوبر", "6 اكتوبر", "6th of october", "october", "sixthofoctober", "6october"], "الجيزة", "مدينة السادس من أكتوبر"],
  [["الشيخ زايد", "زايد", "sheikhzayed", "zayed"], "الجيزة", "مدينة الشيخ زايد"],
  [["mohandessin", "mohandseen", "mohandesin"], "الجيزة", "المهندسين"],
  [["dokki", "doki"], "الجيزة", "الدقي"],
  [["haram", "pyramids"], "الجيزة", "الهرم"],
  [["faisal"], "الجيزة", "فيصل"],
  [["imbaba"], "الجيزة", "إمبابة"],
  [["obour", "elobour"], "القليوبية", "العبور"],
  [["banha", "benha"], "القليوبية", "بنها"],
  [["سموحه", "smouha"], "الإسكندرية", "سيدي جابر"],
  [["العجمي", "agami"], "الإسكندرية", "الدخيلة"],
  [["ميامي", "سيدي بشر", "المندره", "miami", "sidibishr", "mandara", "montaza"], "الإسكندرية", "المنتزه"],
  [["العاشر", "العاشر من رمضان", "10th of ramadan", "tenthoframadan", "10thoframadan"], "الشرقية", "مدينة العاشر من رمضان"],
  [["zagazig"], "الشرقية", "الزقازيق"],
  [["mansoura"], "الدقهلية", "المنصورة"],
  [["tanta"], "الغربية", "طنطا"],
  [["mahalla", "elmahalla"], "الغربية", "المحلة الكبرى"],
  [["damanhour"], "البحيرة", "دمنهور"],
  [["hurghada"], "البحر الأحمر", "الغردقة"],
  [["sharm", "sharmelsheikh"], "جنوب سيناء", "شرم الشيخ"],
  [["shebinelkom", "shibinelkom"], "المنوفية", "شبين الكوم"],
];

const enKey = (s: string) =>
  s.toLowerCase().replace(/\b(al|el|ash|as|ad|ar)[\s-]+/g, "").replace(/[^a-z]/g, "");

const norm = normalizeArabic;
const findProvince = (name: string) => EGYPT_DIVISIONS.find((p) => p.name === name);

// alias lookups: English keys by enKey, Arabic keys by normalized text
const ALIAS_EN = new Map<string, { prov: string; city: string }>();
const ALIAS_AR = new Map<string, { prov: string; city: string }>();
for (const [names, prov, city] of CITY_ALIASES) {
  for (const n of names) {
    if (/[a-z]/i.test(n)) ALIAS_EN.set(enKey(n), { prov, city });
    else ALIAS_AR.set(norm(n), { prov, city });
  }
}

function aliasCity(candidates: string[], fullText: string): { prov: string; city: string } | undefined {
  for (const cand of candidates) {
    const hit = ALIAS_AR.get(norm(cand)) ?? (enKey(cand) ? ALIAS_EN.get(enKey(cand)) : undefined);
    if (hit) return hit;
  }
  // Written inside a longer line ("التجمع الخامس - فيلا 3"); longest key first
  const text = norm(fullText);
  const ar = [...ALIAS_AR.keys()].filter((k) => k.length >= 4 && text.includes(k)).sort((a, b) => b.length - a.length)[0];
  if (ar) return ALIAS_AR.get(ar);
  const textEn = enKey(fullText);
  const en = [...ALIAS_EN.keys()].filter((k) => k.length >= 5 && textEn.includes(k)).sort((a, b) => b.length - a.length)[0];
  return en ? ALIAS_EN.get(en) : undefined;
}

function resolveProvince(raw: string): EgyptProvince | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  if (EN_PROVINCES[enKey(s)]) return findProvince(EN_PROVINCES[enKey(s)]);
  const n = norm(s);
  if (AR_PROVINCE_ALIASES[n]) return findProvince(AR_PROVINCE_ALIASES[n]);
  const direct = EGYPT_DIVISIONS.find((p) => norm(p.name) === n || norm(p.name) === norm(`ال${s}`));
  if (direct) return direct;
  const close = rankByQuery(EGYPT_DIVISIONS.map((p) => ({ p, norm: norm(p.name) })), s, 1)[0];
  return close?.p;
}

/** Split an address line into the pieces people separate with commas / dashes / new lines. */
function segments(...texts: string[]): string[] {
  return texts
    .flatMap((t) => (t ?? "").split(/[،,\-–\n/|]+/))
    .map((t) => t.trim())
    .filter(Boolean);
}

const stripPrefix = (n: string) => n.replace(/^(مدينه|مركز|حي|قريه)\s+/, "");

function matchCity(prov: EgyptProvince, candidates: string[], fullText: string): { city: EgyptCity; area?: string } | undefined {
  const cities = prov.cities.map((c) => ({ c, norm: norm(c.name) }));

  // 1) exact name (ignoring "مدينة"/"مركز" prefixes)
  for (const cand of candidates) {
    const n = norm(cand);
    const hit = cities.find((x) => x.norm === n || stripPrefix(x.norm) === stripPrefix(n));
    if (hit) return { city: hit.c };
  }
  // 2) the candidate is exactly an area → its city
  for (const cand of candidates) {
    const n = norm(cand);
    for (const c of prov.cities) {
      const a = c.areas.find((a) => norm(a.name) === n);
      if (a) return { city: c, area: a.name };
    }
  }
  // 3) a well-known name J&T files under another city (التجمع → القاهرة الجديدة, Nasr City, ...)
  const alias = aliasCity(candidates, fullText);
  if (alias && alias.prov === prov.name) {
    const c = prov.cities.find((x) => x.name === alias.city);
    if (c) return { city: c };
  }
  // 4) a city name written inside the text (longest name first, e.g. "مدينة نصر - الحي العاشر")
  const text = norm(fullText);
  const inside = cities
    .filter((x) => stripPrefix(x.norm).length >= 3 && text.includes(stripPrefix(x.norm)))
    .sort((a, b) => b.norm.length - a.norm.length)[0];
  if (inside) return { city: inside.c };
  // 5) closest city name (handles small typos)
  for (const cand of candidates) {
    if (norm(cand).length < 3) continue;
    const close = rankByQuery(cities, cand, 1)[0];
    if (close) return { city: close.c };
  }
  return undefined;
}

function matchArea(city: EgyptCity, candidates: string[], fullText: string): string | undefined {
  const areas = city.areas.map((a) => ({ a: a.name, norm: norm(a.name) }));
  for (const cand of candidates) {
    const hit = areas.find((x) => x.norm === norm(cand));
    if (hit) return hit.a;
  }
  const text = norm(fullText);
  const inside = areas
    .filter((x) => x.norm.length >= 4 && text.includes(x.norm))
    .sort((a, b) => b.norm.length - a.norm.length)[0];
  return inside?.a;
}

export function resolveJTAddress(input: { governorate: string; city: string; address: string }): JTAddressResult {
  const candidates = segments(input.city, input.address);
  const fullText   = [input.city, input.address].join(" ");

  let prov  = resolveProvince(input.governorate);
  let match = prov ? matchCity(prov, candidates, fullText) : undefined;

  // Governorate missing or wrong → an exact city name or a known alias anywhere in Egypt
  if (!match) {
    const alias = aliasCity(segments(input.city), input.city);
    const aliasProv = alias && findProvince(alias.prov);
    const aliasCityObj = aliasProv?.cities.find((c) => c.name === alias!.city);
    if (aliasProv && aliasCityObj && !prov) {
      prov = aliasProv; match = { city: aliasCityObj };
    }
  }
  if (!match) {
    for (const p of EGYPT_DIVISIONS) {
      const m = matchCity(p, segments(input.city), input.city);
      if (m && segments(input.city).some((c) => norm(c) === norm(m.city.name))) { prov = p; match = m; break; }
    }
  }

  if (!prov) {
    return { ok: false, error: `المحافظة "${input.governorate}" مش موجودة في جدول J&T — عدّل عنوان الطلب` };
  }
  if (!match) {
    return { ok: false, error: `المدينة "${input.city}" مش موجودة في محافظة ${prov.name} في جدول J&T — عدّل عنوان الطلب` };
  }

  // The area usually lives in the address line — check it before the city field
  const area = match.area ?? matchArea(match.city, segments(input.address, input.city), [input.address, input.city].join(" "));
  if (area) return { ok: true, prov: prov.name, city: match.city.name, area, areaGuessed: false };

  // No area in the address: prefer the area named like the city ("المنصورة" / "مدينة المنصورة"),
  // else "وسط البلد", else the city's first area (شمال سيناء has none → the city name itself)
  const cityKey  = stripPrefix(norm(match.city.name));
  const fallback =
    match.city.areas.find((a) => stripPrefix(norm(a.name)) === cityKey) ??
    match.city.areas.find((a) => norm(a.name) === norm("وسط البلد")) ??
    match.city.areas[0];
  return { ok: true, prov: prov.name, city: match.city.name, area: fallback?.name ?? match.city.name, areaGuessed: true };
}
