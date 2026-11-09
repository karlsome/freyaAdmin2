import { useEffect, useRef, useState } from "react";
import { getAuthDisplayName, getAuthInitials } from "../utils/auth";
import { useLanguage } from "../contexts/LanguageContext";
import IconButton from "./IconButton";

const LANGUAGES = [
  { code: "ja", label: "Japanese", nativeLabel: "日本語", flag: "🇯🇵" },
  { code: "en", label: "English", nativeLabel: "English", flag: "🇺🇸" },
];

export default function TopNav({ authUser, isDark, onLogout, onOpenMobileNav, onToggleTheme }) {
  const displayName = getAuthDisplayName(authUser);
  const initials = getAuthInitials(authUser);
  const usernameLine = authUser?.username ? `@${authUser.username}` : "";
  const roleLine = authUser?.role || "Authenticated user";
  const { t, language, changeLanguage } = useLanguage();
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const langDropdownRef = useRef(null);
  const userDropdownRef = useRef(null);

  const currentLang = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  useEffect(() => {
    function handleClickOutside(event) {
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target)) {
        setLangDropdownOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setUserDropdownOpen(false);
      }
    }
    if (langDropdownOpen || userDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [langDropdownOpen, userDropdownOpen]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setLangDropdownOpen(false);
        setUserDropdownOpen(false);
      }
    }
    if (langDropdownOpen || userDropdownOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [langDropdownOpen, userDropdownOpen]);

  return (
    <header className="topnav-glass fixed top-0 right-0 left-0 z-40 flex h-16 items-center justify-between px-4 font-headline antialiased sm:px-6 md:pl-24 md:pr-8">

      {/* Search */}
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4 md:gap-6">
        <IconButton
          icon="menu"
          onClick={onOpenMobileNav}
          variant="ghost"
          rounded="xl"
          ariaLabel="Open navigation menu"
          className="md:hidden"
        />

        <div className="relative w-full min-w-0 max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" style={{ fontSize: 18 }}>
            search
          </span>
          <input
            className="w-full bg-white/10 dark:bg-white/5 border border-primary/20 dark:border-primary/20 rounded-full pl-10 pr-4 py-2 text-sm text-on-surface placeholder:text-outline/70 focus:ring-2 focus:ring-primary/30 focus:border-primary/40 focus:bg-white/20 dark:focus:bg-white/8 transition-all outline-none backdrop-blur-sm"
            placeholder={t("globalSearch")}
            type="text"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="ml-3 flex flex-shrink-0 items-center gap-1.5 sm:gap-2">

        {/* Language Dropdown / Bubble Box */}
        <div className="relative" ref={langDropdownRef}>
          <button
            type="button"
            onClick={() => {
              setLangDropdownOpen((prev) => !prev);
              setUserDropdownOpen(false);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-outline-variant/30 bg-surface-container/60 px-2.5 py-1.5 text-xs font-semibold text-on-surface hover:border-primary/40 hover:bg-primary/10 hover:text-primary transition active:scale-95 shadow-2xs"
            title={t("language")}
            aria-expanded={langDropdownOpen}
            aria-haspopup="true"
          >
            <span className="text-sm leading-none">{currentLang.flag}</span>
            <span className="hidden md:inline text-[12px] font-medium">{currentLang.nativeLabel}</span>
            <span
              className={`material-symbols-outlined text-outline transition-transform duration-200 ${
                langDropdownOpen ? "rotate-180 text-primary" : ""
              }`}
              style={{ fontSize: 16 }}
            >
              arrow_drop_down
            </span>
          </button>

          {langDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl border border-white/20 dark:border-white/10 bg-surface/95 dark:bg-[rgba(15,18,32,0.96)] backdrop-blur-xl shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-2.5 py-1.5 border-b border-separator/40 mb-1 flex items-center justify-between text-outline">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em]">
                  {t("language")}
                </span>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>language</span>
              </div>
              <div className="space-y-0.5">
                {LANGUAGES.map(({ code, nativeLabel, flag }) => {
                  const isActive = language === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => {
                        changeLanguage(code);
                        setLangDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2.5 rounded-xl px-3 py-2 text-left transition-all ${
                        isActive
                          ? "bg-primary/15 text-primary font-bold shadow-2xs"
                          : "text-on-surface hover:bg-surface-container hover:text-primary"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base leading-none">{flag}</span>
                        <span className="text-xs font-semibold">{nativeLabel}</span>
                      </div>
                      {isActive && (
                        <span className="material-symbols-outlined text-primary" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>
                          check
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          className="p-2 text-outline hover:text-primary hover:bg-primary/10 rounded-xl transition-all duration-150"
          title={isDark ? t("switchToLight") : t("switchToDark")}
          type="button"
        >
          <span className="material-symbols-outlined">
            {isDark ? "light_mode" : "dark_mode"}
          </span>
        </button>

        {/* Notifications */}
        <button className="relative p-2 text-outline hover:text-primary hover:bg-primary/10 rounded-xl transition-all" type="button">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-transparent"></span>
        </button>

        {/* User Profile Avatar with Dropdown */}
        <div className="relative pl-1" ref={userDropdownRef}>
          <button
            type="button"
            onClick={() => {
              setUserDropdownOpen((prev) => !prev);
              setLangDropdownOpen(false);
            }}
            className={`h-9 w-9 rounded-full kinetic-gradient ring-2 transition-all flex items-center justify-center cursor-pointer select-none active:scale-95 ${
              userDropdownOpen
                ? "ring-primary shadow-[0_0_16px_rgba(99,102,241,0.55)] scale-105"
                : "ring-primary/40 hover:ring-primary/80 shadow-[0_0_12px_rgba(99,102,241,0.35)]"
            }`}
            title={displayName}
            aria-expanded={userDropdownOpen}
            aria-haspopup="true"
          >
            <span className="text-xs font-bold tracking-[0.14em] text-white">{initials}</span>
          </button>

          {userDropdownOpen && (
            <div className="absolute right-0 top-full mt-2.5 w-64 rounded-2xl border border-white/20 dark:border-white/10 bg-surface/95 dark:bg-[rgba(15,18,32,0.96)] backdrop-blur-xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              {/* User info header */}
              <div className="flex items-center gap-3 p-2.5 border-b border-separator/40 mb-1">
                <div className="h-10 w-10 rounded-full kinetic-gradient ring-2 ring-primary/40 shadow-sm flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold tracking-[0.14em] text-white">{initials}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-on-surface">{displayName}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    <span className="rounded-md bg-primary/10 px-1.5 py-0.2 text-[10px] font-semibold text-primary">
                      {roleLine}
                    </span>
                    {usernameLine && (
                      <span className="text-[11px] text-outline truncate">{usernameLine}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-0.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setUserDropdownOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-all text-left"
                >
                  <span className="material-symbols-outlined text-rose-600 dark:text-rose-400" style={{ fontSize: 18 }}>
                    logout
                  </span>
                  <span>{t("logout")}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
