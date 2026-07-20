"use client";

import { useState, useRef, useEffect } from "react";
import { Globe, ChevronDown, Check } from "lucide-react";

/**
 * Language selector.
 *
 * The app ships English only today, so this persists the choice to
 * localStorage and sets <html lang> rather than pretending to translate.
 * Wiring it to a real i18n backend later means replacing the onSelect body;
 * the control itself does not change.
 */
const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
] as const;

export function LanguageSelector() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<(typeof LANGUAGES)[number]>(LANGUAGES[0]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("kick.lang");
    const match = LANGUAGES.find((l) => l.code === saved);
    if (match) setCurrent(match);
  }, []);

  // Close on outside click and on Escape — a dropdown that can only be
  // dismissed by re-clicking the trigger traps keyboard users.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const select = (lang: (typeof LANGUAGES)[number]) => {
    setCurrent(lang);
    window.localStorage.setItem("kick.lang", lang.code);
    document.documentElement.lang = lang.code;
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-9 items-center gap-2 rounded-md px-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Globe className="h-4 w-4" aria-hidden="true" />
        {current.label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-10 mt-1 w-40 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg"
        >
          {LANGUAGES.map((lang) => (
            <li key={lang.code}>
              <button
                type="button"
                role="option"
                aria-selected={lang.code === current.code}
                onClick={() => select(lang)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
              >
                {lang.label}
                {lang.code === current.code && <Check className="h-3.5 w-3.5 text-status-info" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
