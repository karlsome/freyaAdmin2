import { useState, useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import TopNav from "./components/TopNav";
import DashboardPage from "./pages/DashboardPage";
import FactoriesPage from "./pages/FactoriesPage";
import FactoryDetailPage from "./pages/FactoryDetailPage";
import SensorDetailPage from "./pages/SensorDetailPage";
import SensorsPage from "./pages/SensorsPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import MasterDBPage from "./pages/MasterDBPage";
import PlannerPage from "./pages/PlannerPage";
import ApprovalsPage from "./pages/ApprovalsPage";
import LoginPage from "./pages/LoginPage";
import {
  clearStoredAuthUser,
  isAuthenticatedUser,
  persistAuthUser,
  readStoredAuthUser,
} from "./utils/auth";

const placeholderPages = [
  "factoryStatus",
  "inventory",
  "notifications",
  "analytics",
  "financials",
  "userManagement",
  "customerManagement",
  "equipment",
  "scna",
  "noda",
  "videoManual",
];

function App() {
  const [authUser, setAuthUser] = useState(() => readStoredAuthUser());
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return true;
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const activePage = location.pathname.slice(1) || "dashboard";
  const isLoginRoute = location.pathname === "/login";
  const isAuthenticated = isAuthenticatedUser(authUser);

  function resolveRedirectPath() {
    const requestedPath = location.state?.from?.pathname;
    if (typeof requestedPath === "string" && requestedPath !== "/login") {
      return requestedPath;
    }
    return "/dashboard";
  }

  function handleLogin(nextAuthUser) {
    const normalized = persistAuthUser(nextAuthUser);
    setAuthUser(normalized);
    navigate(resolveRedirectPath(), { replace: true });
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
    return <Navigate replace to="/dashboard" />;
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
            mobileOpen={mobileNavOpen}
            onClose={() => setMobileNavOpen(false)}
            onLogout={handleLogout}
            onNavigate={(page) => navigate(`/${page}`)}
          />
          <main className="ml-0 min-h-screen bg-background dark:bg-transparent relative md:ml-16" style={{ zIndex: 1 }}>
            <TopNav
              authUser={authUser}
              isDark={isDark}
              onLogout={handleLogout}
              onOpenMobileNav={() => setMobileNavOpen(true)}
              onToggleTheme={() => setIsDark((darkMode) => !darkMode)}
            />
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/planner" element={<PlannerPage />} />
              <Route path="/approvals" element={<ApprovalsPage />} />
              {placeholderPages.map((page) => (
                <Route key={page} path={`/${page}`} element={<PlaceholderPage page={page} />} />
              ))}
              <Route path="/masterDB" element={<MasterDBPage />} />
              <Route path="/factories" element={<FactoriesPage />} />
              <Route path="/sensors" element={<SensorsPage />} />
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
