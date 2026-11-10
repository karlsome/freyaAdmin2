import { createContext, useContext, useState } from "react";
import translations from "../i18n/translations";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(
    () => localStorage.getItem("lang") || "en"
  );

  function changeLanguage(lang) {
    localStorage.setItem("lang", lang);
    setLanguage(lang);
  }

  // Falls back to the key itself (so English text can be used as the key),
  // and supports {name} placeholders: t("Revision {n} created.", { n: 3 })
  function t(key, params) {
    const text = translations[language]?.[key] ?? key;
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
  }

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}
