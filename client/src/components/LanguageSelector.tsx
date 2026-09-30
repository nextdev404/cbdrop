import { useState, useRef, useEffect } from "react";
import { Globe, Check } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Language } from "@/lib/translations";

const LANGUAGES: { code: Language; label: string; native: string; flag: string }[] = [
  { code: "en", label: "English", native: "English", flag: "🇬🇧" },
  { code: "ar", label: "Arabic", native: "العربية", flag: "🇸🇦" },
];

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const current = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Select language"
        className="flex items-center gap-1.5 rounded-full border border-[#dedfd8] bg-white px-2.5 py-1.5 text-xs font-bold text-[#44474f] shadow-xs transition hover:border-[#5e5ce6] hover:text-[#5e5ce6] dark:border-white/10 dark:bg-white/5 dark:text-[#b7bac6] dark:hover:text-white"
      >
        <Globe size={14} className="text-[#5e5ce6]" />
        {!compact && <span className="uppercase text-[11px] font-black">{current.code}</span>}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-44 origin-top-right rounded-2xl border border-[#dedfd8] bg-white/95 p-1.5 shadow-xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 dark:border-white/10 dark:bg-[#181a22]/95"
          dir="ltr"
        >
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#8b8d98]">
            Language / اللغة
          </div>
          <div className="space-y-0.5">
            {LANGUAGES.map((l) => {
              const active = l.code === lang;
              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => {
                    setLang(l.code);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs font-bold transition ${
                    active
                      ? "bg-[#5e5ce6]/10 text-[#5e5ce6] dark:bg-[#5e5ce6]/20 dark:text-[#8c8bf5]"
                      : "text-[#33353c] hover:bg-black/5 dark:text-[#e4e5ea] dark:hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{l.flag}</span>
                    <span>{l.native}</span>
                  </div>
                  {active && <Check size={14} className="text-[#5e5ce6]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
