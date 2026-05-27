import { useEffect, useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";

const navItems = [
  { icon: "dashboard",                labelKey: "dashboard",           page: "dashboard" },
  { icon: "factory",                   labelKey: "factories",           page: "factories",
    children: [
      { icon: "overview",             labelKey: "overview",            page: "factory/overview" },
      { icon: "sensors",              labelKey: "sensors",             page: "sensors" },
    ]
  },
  { icon: "precision_manufacturing",   labelKey: "factoryStatus",       page: "factoryStatus" },
  { icon: "event_note",               labelKey: "planner",             page: "planner" },
  { icon: "inventory_2",              labelKey: "inventory",           page: "inventory" },
  { icon: "notifications",            labelKey: "notifications",       page: "notifications" },
  { icon: "analytics",                labelKey: "analytics",           page: "analytics" },
  { icon: "payments",                 labelKey: "financials",          page: "financials" },
  { icon: "group",                    labelKey: "userManagement",      page: "userManagement" },
  { icon: "fact_check",               labelKey: "approvals",           page: "approvals" },
  { icon: "database",                 labelKey: "masterDB",            page: "masterDB" },
  { icon: "hub",                      labelKey: "customerManagement",  page: "customerManagement" },
  { icon: "construction",             labelKey: "equipment",           page: "equipment" },
  { icon: "checklist",                labelKey: "maintenance",         page: "maintenance",
    children: [
      { icon: "table_chart",          labelKey: "checklistSubmissions", page: "maintenance/submissions" },
      { icon: "confirmation_number",  labelKey: "submittedTickets",     page: "maintenance/submissions/tickets" },
    ]
  },
  { icon: "lan",                      labelKey: "scna",                page: "scna" },
  { icon: "settings_input_component", labelKey: "noda",                page: "noda" },
  { icon: "play_circle",              labelKey: "videoManual",         page: "videoManual" },
];

function hasActiveChild(item, activePage) {
  return Boolean(item.children?.some((child) => isActiveFor(child, activePage)));
}

function matchesNavPage(page, activePage) {
  return activePage === page || activePage.startsWith(`${page}/`);
}

function getActiveChildPage(item, activePage) {
  if (!item.children?.length) return "";

  const matchingChildren = item.children.filter((child) => matchesNavPage(child.page, activePage));
  if (matchingChildren.length === 0) return "";

  return matchingChildren.reduce((bestMatch, child) => (
    child.page.length > bestMatch.page.length ? child : bestMatch
  )).page;
}

function isActiveFor(item, activePage) {
  if (activePage === item.page) return true;
  if (
    item.page === "factories" &&
    (activePage.startsWith("factory/") ||
      activePage === "sensors" ||
      activePage.startsWith("sensors/"))
  ) return true;
  if (item.children) return item.children.some((c) => isActiveFor(c, activePage));
  return false;
}

export default function Sidebar({ activePage, badges = {}, mobileOpen = false, onClose, onLogout, onNavigate, onOpenSettings, className = "" }) {
  const [openItems, setOpenItems] = useState(() => new Set());
  const { t } = useLanguage();

  useEffect(() => {
    if (!mobileOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen, onClose]);

  function toggleOpen(page) {
    setOpenItems((prev) => {
      const next = new Set(prev);
      next.has(page) ? next.delete(page) : next.add(page);
      return next;
    });
  }

  function renderSidebarContent(isMobile) {
    return (
      <>
        <div className="mb-10 flex items-center justify-between px-3">
          <div className={`flex items-center gap-3 ${isMobile ? "" : "min-w-[256px]"}`}>
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl kinetic-gradient shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
                precision_manufacturing
              </span>
            </div>
            <div className={`overflow-hidden transition-opacity duration-200 ${isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
              <h1 className="whitespace-nowrap text-lg font-black leading-none text-on-surface">Freya Admin</h1>
              <p className="mt-0.5 whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-primary">Detailed Data</p>
            </div>
          </div>

          {isMobile && (
            <button
              type="button"
              onClick={() => onClose?.()}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-outline transition-all hover:bg-primary/10 hover:text-primary"
              aria-label="Close navigation menu"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto scrollbar-hide px-3">
          {navItems.map((item) => {
            const isActive = isActiveFor(item, activePage);
            const hasChildren = !!item.children?.length;
            const isOpen = openItems.has(item.page) || hasActiveChild(item, activePage);
            const activeChildPage = getActiveChildPage(item, activePage);
            const label = t(item.labelKey);

            return (
              <div key={item.page}>
                <div className={`flex items-center ${isMobile ? "" : "min-w-[232px]"}`}>
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate(item.page);
                      if (isMobile) onClose?.();
                    }}
                    title={label}
                    className={`min-w-0 flex-1 flex items-center gap-3 rounded-xl text-left transition-all duration-200 ease-in-out ${
                      isMobile
                        ? "px-3 py-2.5"
                        : "px-0 py-2.5"
                    } ${
                      isActive
                        ? "bg-primary/5 text-primary dark:bg-transparent dark:shadow-[0_0_15px_rgba(192,193,255,0.2)]"
                        : "text-outline hover:bg-primary/5 hover:text-primary dark:hover:bg-white/5 dark:hover:text-on-surface"
                    }`}
                  >
                    <span
                      className={`flex-shrink-0 material-symbols-outlined ${isMobile ? "" : "w-10 flex items-center justify-center"}`}
                      style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
                    >
                      {item.icon}
                    </span>
                    <span className={`flex-1 whitespace-nowrap overflow-hidden ${
                      isMobile
                        ? isActive ? "font-semibold" : ""
                        : `${isActive ? "font-semibold " : ""}opacity-0 transition-opacity duration-200 group-hover:opacity-100`
                    }`}>
                      {label}
                    </span>
                    {badges[item.page] > 0 && (
                      <span className={`mr-2 flex-shrink-0 rounded-full bg-error px-1.5 py-0.5 text-[10px] font-bold text-on-error dark:bg-error-container dark:text-on-error-container dark:rounded-md ${
                        isMobile ? "opacity-100" : "opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                      }`}>
                        {badges[item.page]}
                      </span>
                    )}
                  </button>

                  {hasChildren && (
                    <button
                      type="button"
                      onClick={() => toggleOpen(item.page)}
                      aria-label={`${isOpen ? "Collapse" : "Expand"} ${label} submenu`}
                      title={`${isOpen ? "Collapse" : "Expand"} ${label}`}
                      className={`mr-1.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-all duration-300 hover:bg-primary/5 ${
                        isOpen ? "rotate-180" : "rotate-0"
                      } ${
                        isActive ? "text-primary" : "text-outline"
                      } ${
                        isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                        expand_more
                      </span>
                    </button>
                  )}
                </div>

                {hasChildren && (
                  <div
                    className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                      isOpen ? "max-h-40" : "max-h-0"
                    } ${isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                  >
                    <div className="relative mb-1 ml-[18px] mt-0.5">
                      <div className="absolute bottom-0 top-0 left-0 w-px rounded-full bg-outline-variant/30" />

                      {item.children.map((child, idx) => {
                        const childActive = activeChildPage === child.page;
                        const isLast = idx === item.children.length - 1;
                        const childLabel = t(child.labelKey);

                        return (
                          <div key={child.page} className="relative flex items-center">
                            <div className="flex flex-shrink-0 items-center self-stretch">
                              {isLast && <div className="absolute bottom-0 top-1/2 left-0 w-px bg-transparent" />}
                              <div className="ml-px h-px w-4 bg-outline-variant/30" />
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                onNavigate(child.page);
                                if (isMobile) onClose?.();
                              }}
                              title={childLabel}
                              className={`min-w-0 flex-1 rounded-xl py-1.5 pr-2 text-left transition-all duration-200 ${
                                isMobile ? "pl-2.5" : "pl-1"
                              } ${
                                childActive
                                  ? "bg-primary/5 text-primary"
                                  : "text-outline hover:bg-primary/5 hover:text-primary dark:hover:bg-white/5 dark:hover:text-on-surface"
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <span
                                  className="material-symbols-outlined flex-shrink-0"
                                  style={{
                                    fontSize: 16,
                                    ...(childActive ? { fontVariationSettings: "'FILL' 1" } : {}),
                                  }}
                                >
                                  {child.icon}
                                </span>
                                <span className={`overflow-hidden whitespace-nowrap text-xs ${childActive ? "font-semibold" : ""}`}>
                                  {childLabel}
                                </span>
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="mt-auto space-y-0.5 border-t border-outline-variant/20 px-3 pt-6">
          <button
            className={`w-full flex items-center gap-3 rounded-xl text-outline transition-all duration-200 hover:bg-primary/5 hover:text-primary dark:hover:bg-white/5 dark:hover:text-on-surface ${
              isMobile ? "px-3 py-2.5" : "min-w-[232px] px-0 py-2.5"
            }`}
            onClick={onOpenSettings}
            title={t("settings")}
            type="button"
          >
            <span className={`material-symbols-outlined ${isMobile ? "" : "w-10 flex items-center justify-center"}`}>settings</span>
            <span className={isMobile ? "whitespace-nowrap" : "whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100"}>{t("settings")}</span>
          </button>
          <button
            className={`w-full flex items-center gap-3 rounded-xl text-error/70 transition-all duration-200 hover:bg-error/5 hover:text-error dark:text-outline dark:hover:bg-white/5 dark:hover:text-on-surface ${
              isMobile ? "px-3 py-2.5" : "min-w-[232px] px-0 py-2.5"
            }`}
            onClick={onLogout}
            title={t("logout")}
            type="button"
          >
            <span className={`material-symbols-outlined ${isMobile ? "" : "w-10 flex items-center justify-center"}`}>logout</span>
            <span className={isMobile ? "whitespace-nowrap" : "whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100"}>{t("logout")}</span>
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <aside className={`group fixed left-0 top-0 z-50 hidden h-full w-16 overflow-hidden sidebar-glass py-6 font-headline text-sm font-medium transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:w-64 md:flex md:flex-col ${className}`}>
        {renderSidebarContent(false)}
      </aside>

      <div className={`fixed inset-0 z-50 md:hidden ${mobileOpen ? "" : "pointer-events-none"}`}>
        <button
          type="button"
          onClick={() => onClose?.()}
          aria-label="Close navigation menu"
          className={`absolute inset-0 bg-black/45 backdrop-blur-sm transition-opacity ${mobileOpen ? "opacity-100" : "opacity-0"}`}
        />

        <aside className={`absolute left-0 top-0 z-10 flex h-full w-72 max-w-[82vw] flex-col sidebar-glass py-6 font-headline text-sm font-medium shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
          {renderSidebarContent(true)}
        </aside>
      </div>
    </>
  );
}
