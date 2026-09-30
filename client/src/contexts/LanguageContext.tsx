import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { TRANSLATIONS, type Language, type TranslationDict } from "@/lib/translations";

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: TranslationDict;
  isRtl: boolean;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem("cbdrop_lang") as Language;
      if (saved && (saved === "en" || saved === "ar")) {
        return saved;
      }
      // If user browser language starts with ar
      const navLang = navigator.language?.toLowerCase() || "";
      if (navLang.startsWith("ar")) return "ar";
    } catch {}
    return "en";
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    try {
      localStorage.setItem("cbdrop_lang", newLang);
    } catch {}
  };

  const isRtl = lang === "ar";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
  }, [lang, isRtl]);

  const t = TRANSLATIONS[lang];

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, isRtl }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      lang: "en" as Language,
      setLang: () => {},
      t: TRANSLATIONS.en,
      isRtl: false,
    };
  }
  return context;
}
