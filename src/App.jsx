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

const placeholderPages = [
  "factoryStatus",
  "planner",
  "inventory",
  "notifications",
  "analytics",
  "financials",
  "userManagement",
  "approvals",
  "customerManagement",
  "equipment",
  "scna",
  "noda",
  "videoManual",
];

function App() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return true;
  });
  const location = useLocation();
  const navigate = useNavigate();
  const activePage = location.pathname.slice(1) || "dashboard";

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
      <Sidebar activePage={activePage} onNavigate={(page) => navigate(`/${page}`)} />
      <main className="ml-16 min-h-screen bg-background dark:bg-transparent relative" style={{ zIndex: 1 }}>
        <TopNav isDark={isDark} onToggleTheme={() => setIsDark((d) => !d)} />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          {placeholderPages.map((page) => (
            <Route key={page} path={`/${page}`} element={<PlaceholderPage page={page} />} />
          ))}
          <Route path="/masterDB" element={<MasterDBPage />} />
          <Route path="/factories" element={<FactoriesPage />} />
          <Route path="/sensors" element={<SensorsPage />} />
          <Route path="/factory/:factoryName" element={<FactoryDetailPage />} />
          <Route path="/sensors/:factoryName" element={<SensorDetailPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>

    </div>
  );
}

export default App;
