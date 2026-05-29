import { useState, useEffect } from "react";
import { flushSync } from "react-dom";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import { fetchNgInspectionCount } from "./services/api";
import TopNav from "./components/TopNav";
import SettingsModal from "./components/SettingsModal";
import DashboardPage from "./pages/DashboardPage";
import FactoriesPage from "./pages/FactoriesPage";
import FactoryDetailPage from "./pages/FactoryDetailPage";
import SensorDetailPage from "./pages/SensorDetailPage";
import SensorsPage from "./pages/SensorsPage";
import DevicesPage from "./pages/DevicesPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import MasterDBPage from "./pages/MasterDBPage";
import PlannerPage from "./pages/PlannerPage";
import ApprovalsPage from "./pages/ApprovalsPage";
import NodaPage from "./pages/NodaPage";
import InventoryPage from "./pages/InventoryPage";
import FactoryStatusPage from "./pages/FactoryStatusPage";
import FactoryStatusLogsPage from "./pages/FactoryStatusLogsPage";
import MaintenancePage from "./pages/MaintenancePage";
import ChecklistSubmissionsPage from "./pages/ChecklistSubmissionsPage";
import TicketSubmissionsPage from "./pages/TicketSubmissionsPage";
import LoginPage from "./pages/LoginPage";
import VideoManualPage from "./pages/VideoManualPage";
import VideoManualProjectPage from "./pages/VideoManualProjectPage";
import {
  clearStoredAuthUser,
  isAuthenticatedUser,
  persistAuthUser,
  readStoredAuthUser,
} from "./utils/auth";

const placeholderPages = [
  "notifications",
  "analytics",
  "financials",
  "userManagement",
  "customerManagement",
  "equipment",
  "scna",
];

const SHELL_INTRO_DURATION_MS = 900;

function supportsViewTransitions() {
  return typeof document !== "undefined" && typeof document.startViewTransition === "function";
}

function App() {
  const [authUser, setAuthUser] = useState(() => readStoredAuthUser());
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return true;
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [badges, setBadges] = useState({ approvals: 12 });
  const [shellIntro, setShellIntro] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const activePage = location.pathname.slice(1) || "dashboard";
  const isLoginRoute = location.pathname === "/login";
  const isAuthenticated = isAuthenticatedUser(authUser);
  const justLoggedIn = Boolean(location.state?.justLoggedIn);
  const canUseViewTransitions = supportsViewTransitions();

  function resolveRedirectPath() {
    const requestedPath = location.state?.from?.pathname;
    if (typeof requestedPath === "string" && requestedPath !== "/login") {
      return requestedPath;
    }
    return "/dashboard";
  }

  function handleLogin(nextAuthUser) {
    const redirectPath = resolveRedirectPath();

    const commitLogin = () => {
      const normalized = persistAuthUser(nextAuthUser);
      setAuthUser(normalized);
      setMobileNavOpen(false);
      navigate(redirectPath, { replace: true, state: { justLoggedIn: true } });
    };

    if (canUseViewTransitions) {
      const transition = document.startViewTransition(() => {
        flushSync(() => {
          commitLogin();
        });
      });

      return transition.finished.catch(() => {});
    }

    commitLogin();
    return Promise.resolve();
  }

  function handleLogout() {
    clearStoredAuthUser();
    setAuthUser(null);
    setMobileNavOpen(false);
    navigate("/login", { replace: true });
  }

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = mobileNavOpen ? "hidden" : previousOverflow || "";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    function handleStorage() {
      setAuthUser(readStoredAuthUser());
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    async function loadNgCount() {
      try {
        const count = await fetchNgInspectionCount();
        setBadges((prev) => ({ ...prev, maintenance: count || undefined }));
      } catch {
        // leave badge unchanged on error
      }
    }

    loadNgCount();
    const interval = window.setInterval(loadNgCount, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!justLoggedIn || isLoginRoute) {
      setShellIntro(false);
      return undefined;
    }

    setShellIntro(true);
    const timeoutId = window.setTimeout(() => {
      setShellIntro(false);
    }, SHELL_INTRO_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isLoginRoute, justLoggedIn, location.key]);

  if (!isAuthenticated && !isLoginRoute) {
    return (
      <Navigate
        replace
        state={{
          from: {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
          },
        }}
        to="/login"
      />
    );
  }

  if (isAuthenticated && isLoginRoute) {
    return <Navigate replace to={resolveRedirectPath()} />;
  }

  return (
    <div className="overflow-hidden">
      {isDark && (
        <div className="aurora-bg" aria-hidden="true">
          <div className="aurora-blob aurora-blob-1" />
          <div className="aurora-blob aurora-blob-2" />
          <div className="aurora-blob aurora-blob-3" />
          <div className="aurora-blob aurora-blob-4" />
        </div>
      )}
      {isLoginRoute ? (
        <LoginPage
          isDark={isDark}
          onLogin={handleLogin}
          onToggleTheme={() => setIsDark((darkMode) => !darkMode)}
        />
      ) : (
        <>
          <Sidebar
            activePage={activePage}
            badges={badges}
            className={shellIntro ? "app-shell-sidebar--enter" : ""}
            mobileOpen={mobileNavOpen}
            onClose={() => setMobileNavOpen(false)}
            onLogout={handleLogout}
            onNavigate={(page) => navigate(`/${page}`)}
            onOpenSettings={() => setSettingsOpen(true)}
          />
          <main
            className={`app-main-shell ml-0 min-h-screen bg-background dark:bg-transparent relative md:ml-16 ${shellIntro && !canUseViewTransitions ? "app-main-shell--enter" : ""} ${justLoggedIn && canUseViewTransitions ? "app-main-shell--handoff-target" : ""}`}
            style={{ zIndex: 1 }}
          >
            <TopNav
              authUser={authUser}
              isDark={isDark}
              onLogout={handleLogout}
              onOpenMobileNav={() => setMobileNavOpen(true)}
              onOpenSettings={() => setSettingsOpen(true)}
              onToggleTheme={() => setIsDark((darkMode) => !darkMode)}
            />
            <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/planner" element={<PlannerPage />} />
              <Route path="/approvals" element={<ApprovalsPage />} />
              <Route path="/noda" element={<NodaPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/factoryStatus" element={<FactoryStatusPage />} />
              <Route path="/factoryStatus/logs" element={<FactoryStatusLogsPage />} />
              <Route path="/videoManual" element={<VideoManualPage />} />
              <Route path="/videoManual/project/:projectId" element={<VideoManualProjectPage />} />
              {placeholderPages.map((page) => (
                <Route key={page} path={`/${page}`} element={<PlaceholderPage page={page} />} />
              ))}
              <Route path="/maintenance" element={<MaintenancePage />} />
              <Route path="/maintenance/submissions" element={<ChecklistSubmissionsPage />} />
              <Route path="/maintenance/submissions/tickets" element={<TicketSubmissionsPage />} />
              <Route path="/masterDB" element={<MasterDBPage />} />
              <Route path="/factories" element={<FactoriesPage />} />
              <Route path="/sensors" element={<SensorsPage />} />
              <Route path="/devices" element={<DevicesPage />} />
              <Route path="/factory/overview" element={<FactoryDetailPage combined />} />
              <Route path="/factory/:factoryName" element={<FactoryDetailPage />} />
              <Route path="/sensors/:factoryName" element={<SensorDetailPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </>
      )}

    </div>
  );
}

export default App;
