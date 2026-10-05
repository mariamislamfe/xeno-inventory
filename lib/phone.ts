// Egyptian phone normalization — "+20 101 234 5678", "00201012345678",
// "01012345678" and "1012345678" are all the same number.

/** Canonical key for comparing phones: the 10-digit national number for Egyptian mobiles, else the raw digits. */
export function phoneKey(raw: string | null | undefined): string {
  let d = (raw ?? "").replace(/[^0-9]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 12 && d.startsWith("20")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}

/** True when both phones are the same number (empty phones never match). */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = phoneKey(a);
  return ka !== "" && ka === phoneKey(b);
}

/** International format Shopify stores: +20XXXXXXXXXX for Egyptian mobiles. */
export function toE164(raw: string | null | undefined): string {
  const key = phoneKey(raw);
  if (!key) return "";
  return key.length === 10 && key.startsWith("1") ? `+20${key}` : `+${key}`;
}

/** Local format 01XXXXXXXXX (what people usually type). */
export function toLocal(raw: string | null | undefined): string {
  const key = phoneKey(raw);
  return key.length === 10 && key.startsWith("1") ? `0${key}` : key;
}
