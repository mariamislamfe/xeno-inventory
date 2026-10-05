"use client";

import React, { useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  PROVINCE_ENTRIES, CITY_ENTRIES, AREA_ENTRIES,
  rankByQuery, normalizeArabic,
} from "@/lib/data/egypt-divisions";

export interface AddressValue { province: string; city: string; area: string }

interface AddressPickerProps {
  value: AddressValue;
  onChange: (next: AddressValue) => void;
}

interface Option { key: string; label: string; sub?: string; norm: string; next: AddressValue }

// ── Combobox: pick from the list, or type and get the closest matches ──
interface ComboFieldProps {
  label: string;
  placeholder: string;
  value: string;
  options: Option[];
  onPick: (next: AddressValue) => void;
  onClear: () => void;
}

function ComboField({ label, placeholder, value, options, onPick, onClear }: ComboFieldProps) {
  const [query,  setQuery]  = useState<string | null>(null); // null = not typing, show the value
  const [open,   setOpen]   = useState(false);
  const [active, setActive] = useState(0);

  const results = useMemo(() => rankByQuery(options, query ?? ""), [options, query]);

  function pick(opt: Option | undefined) {
    if (opt) onPick(opt.next);
    setQuery(null);
    setOpen(false);
  }

  function handleBlur() {
    setTimeout(() => {
      // Typed the full name without clicking a suggestion → accept it
      const q = normalizeArabic(query ?? "");
      if (q && results[0]?.norm === q) onPick(results[0].next);
      setQuery(null);
      setOpen(false);
    }, 150);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && open && results.length > 0) { e.preventDefault(); pick(results[active]); }
    else if (e.key === "Escape") { setQuery(null); setOpen(false); }
  }

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{label}</label>
      <div className="relative">
        <input
          value={query ?? value}
          placeholder={placeholder}
          className="form-input pl-8"
          onFocus={(e) => { e.target.select(); setOpen(true); setActive(0); }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
        {value && query === null && (
          <button
            type="button"
            title="مسح"
            onMouseDown={(e) => { e.preventDefault(); onClear(); }}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--danger)]"
          >
            <X size={13} />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 top-full right-0 left-0 mt-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[var(--radius-md)] shadow-xl max-h-64 overflow-y-auto">
          {results.length === 0 ? (
            <p className="p-3 text-xs text-[var(--text-muted)]">لا توجد نتائج قريبة</p>
          ) : results.map((o, i) => (
            <button
              key={o.key}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); pick(o); }}
              onMouseEnter={() => setActive(i)}
              className={`w-full text-right px-3 py-2 flex items-center justify-between gap-3 transition-colors ${
                i === active ? "bg-[var(--bg-base)]" : ""
              }`}
            >
              <span className={`text-xs truncate ${o.label === value ? "font-bold text-[var(--primary)]" : "text-[var(--text-primary)]"}`}>
                {o.label}
              </span>
              {o.sub && <span className="text-[10px] text-[var(--text-muted)] flex-shrink-0">{o.sub}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 3-level Egyptian address picker ───────────────────────────────────
// Every field accepts typing. City and area can be searched before choosing a
// governorate — picking one fills in the levels above it.
export default function AddressPicker({ value, onChange }: AddressPickerProps) {
  const { province, city, area } = value;

  const provinceOptions = useMemo<Option[]>(() => PROVINCE_ENTRIES.map((p) => ({
    key: p.province,
    label: p.province,
    norm: p.norm,
    next: p.province === province ? value : { province: p.province, city: "", area: "" },
  })), [province, value]);

  const cityOptions = useMemo<Option[]>(() => CITY_ENTRIES
    .filter((c) => !province || c.province === province)
    .map((c) => ({
      key: `${c.province}|${c.city}`,
      label: c.city,
      sub: province ? undefined : c.province,
      norm: c.norm,
      next: { province: c.province, city: c.city, area: c.city === city && c.province === province ? area : "" },
    })), [province, city, area]);

  const areaOptions = useMemo<Option[]>(() => AREA_ENTRIES
    .filter((a) => (!province || a.province === province) && (!city || a.city === city))
    .map((a) => ({
      key: `${a.province}|${a.city}|${a.area}`,
      label: a.area,
      sub: city ? undefined : province ? a.city : `${a.city}، ${a.province}`,
      norm: a.norm,
      next: { province: a.province, city: a.city, area: a.area },
    })), [province, city]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:col-span-2">
      <ComboField
        label="المحافظة *" placeholder="اكتب أو اختر المحافظة"
        value={province} options={provinceOptions}
        onPick={onChange}
        onClear={() => onChange({ province: "", city: "", area: "" })}
      />
      <ComboField
        label="المدينة *" placeholder="اكتب أو اختر المدينة"
        value={city} options={cityOptions}
        onPick={onChange}
        onClear={() => onChange({ province, city: "", area: "" })}
      />
      <ComboField
        label="المنطقة" placeholder="اكتب أو اختر المنطقة"
        value={area} options={areaOptions}
        onPick={onChange}
        onClear={() => onChange({ province, city, area: "" })}
      />
    </div>
  );
}
