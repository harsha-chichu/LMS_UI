"use client";

import { useEffect, useRef, useState } from "react";
import { ACCENT_PRESETS, applyAccent, DEFAULT_ACCENT, normalizeAccent } from "@/lib/accent";
import { updatePreferences } from "@/lib/data";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types";

const RAINBOW = "conic-gradient(#ff6a00, #fbbf24, #4ade80, #22d3ee, #60a5fa, #a78bfa, #f472b6, #ff6a00)";

/** Preset swatches plus a "custom" swatch that opens the system colour picker. Saves as you pick. */
export function AccentPicker({ profile }: { profile: Profile }) {
  const saved = (profile.preferences.accent && normalizeAccent(profile.preferences.accent)) || DEFAULT_ACCENT;
  const [value, setValue] = useState(saved);
  const [lightened, setLightened] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const isPreset = ACCENT_PRESETS.some((p) => p.value === value);

  // The colour input fires on every drag step, so apply live and save once it settles.
  const pick = (raw: string, delay = 0) => {
    const accent = normalizeAccent(raw);
    if (!accent) return;
    setValue(accent);
    setLightened(accent !== raw.toLowerCase());
    applyAccent(accent);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void updatePreferences(profile, { accent }).catch(() => {}), delay);
  };

  const openCustom = () => {
    const input = inputRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.click();
    }
  };

  return (
    <div>
      <div role="radiogroup" aria-label="accent colour" className="mt-4 flex flex-wrap gap-3">
        {ACCENT_PRESETS.map((p) => (
          <Swatch key={p.value} label={p.name} selected={value === p.value} style={{ background: p.value }} onClick={() => pick(p.value)} />
        ))}
        <Swatch
          label={isPreset ? "custom colour" : `custom colour, ${value}`}
          selected={!isPreset}
          style={{ background: isPreset ? RAINBOW : value }}
          onClick={openCustom}
        >
          <input
            ref={inputRef}
            type="color"
            tabIndex={-1}
            aria-hidden
            value={value}
            onChange={(e) => pick(e.target.value, 400)}
            className="pointer-events-none absolute inset-0 size-full opacity-0"
          />
        </Swatch>
      </div>
      {lightened && <p className="mt-3 text-[13px] text-subtle">lightened a little so it stays readable on black.</p>}
    </div>
  );
}

function Swatch({
  label,
  selected,
  style,
  onClick,
  children,
}: {
  label: string;
  selected: boolean;
  style: React.CSSProperties;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={label}
      onClick={onClick}
      style={style}
      className={cn(
        "relative size-7 rounded-full transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
        selected && "ring-2 ring-white ring-offset-2 ring-offset-black",
      )}
    >
      {children}
    </button>
  );
}
