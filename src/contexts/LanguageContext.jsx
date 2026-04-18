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

  function t(key) {
    return translations[language]?.[key] ?? key;
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
