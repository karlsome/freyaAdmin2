import { useState, useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import TopNav from "./components/TopNav";
import DashboardPage from "./pages/DashboardPage";
import FactoriesPage from "./pages/FactoriesPage";
import FactoryDetailPage from "./pages/FactoryDetailPage";
import SensorDetailPage from "./pages/SensorDetailPage";
import PlaceholderPage from "./pages/PlaceholderPage";

const placeholderPages = [
  "factoryStatus",
  "planner",
  "inventory",
  "notifications",
  "analytics",
  "financials",
  "userManagement",
  "approvals",
  "masterDB",
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
      <Sidebar activePage={activePage} onNavigate={(page) => navigate(`/${page}`)} />
      <main className="ml-16 min-h-screen bg-background relative">
        <TopNav isDark={isDark} onToggleTheme={() => setIsDark((d) => !d)} />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          {placeholderPages.map((page) => (
            <Route key={page} path={`/${page}`} element={<PlaceholderPage page={page} />} />
          ))}
          <Route path="/factories" element={<FactoriesPage />} />
          <Route path="/factory/:factoryName" element={<FactoryDetailPage />} />
          <Route path="/sensors/:factoryName" element={<SensorDetailPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>

      {/* FAB */}
      <button className="fixed bottom-8 right-8 w-14 h-14 kinetic-gradient rounded-2xl shadow-[0_0_25px_rgba(99,102,241,0.4)] flex items-center justify-center text-white hover:scale-[1.04] active:scale-95 transition-all z-50">
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
          add
        </span>
      </button>
    </div>
  );
}

export default App;
