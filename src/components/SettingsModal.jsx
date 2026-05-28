import { useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import IconButton from "./IconButton";

const LANGUAGES = [
  { code: "en", label: "English", nativeLabel: "English", flag: "🇺🇸" },
  { code: "ja", label: "Japanese", nativeLabel: "日本語", flag: "🇯🇵" },
];

export default function SettingsModal({ isOpen, onClose }) {
  const { t, language, changeLanguage } = useLanguage();

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close settings"
      />

      <div className="relative w-full max-w-sm rounded-[28px] border border-white/20 bg-surface/90 dark:bg-[rgba(12,14,26,0.92)] backdrop-blur-2xl shadow-[0_32px_96px_rgba(0,0,0,0.28)] dark:shadow-[0_32px_96px_rgba(0,0,0,0.6)]">
        <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-[linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01))]" />

        <div className="relative px-6 py-5">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>settings</span>
              </div>
              <h2 className="text-lg font-bold text-on-surface">{t("settings")}</h2>
            </div>
            <IconButton
              icon="close"
              onClick={onClose}
              variant="ghost"
              size="md"
              rounded="xl"
              iconSize={20}
              ariaLabel="Close"
            />
          </div>

          {/* Language section */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-outline" style={{ fontSize: 16 }}>language</span>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-outline">{t("language")}</p>
            </div>

            <div className="space-y-2">
              {LANGUAGES.map(({ code, nativeLabel, flag }) => {
                const isActive = language === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => changeLanguage(code)}
                    className={`w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                      isActive
                        ? "border-primary/40 bg-primary/8 dark:bg-primary/12"
                        : "border-white/10 bg-white/5 hover:border-primary/20 hover:bg-primary/5 dark:border-white/8 dark:bg-white/3"
                    }`}
                  >
                    <span className="text-xl">{flag}</span>
                    <span className={`flex-1 text-sm font-semibold ${isActive ? "text-primary" : "text-on-surface"}`}>
                      {nativeLabel}
                    </span>
                    {isActive && (
                      <span className="material-symbols-outlined text-primary" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>
                        check_circle
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
