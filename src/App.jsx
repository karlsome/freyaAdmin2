import Sidebar from "./components/Sidebar";
import TopNav from "./components/TopNav";
import Dashboard from "./components/Dashboard";

function App() {
  return (
    <div className="overflow-hidden">
      <Sidebar />
      <main className="ml-64 min-h-screen bg-[#10131a] relative">
        <TopNav />
        <Dashboard />
      </main>

      {/* FAB */}
      <button className="fixed bottom-8 right-8 w-14 h-14 bg-indigo-600 rounded-2xl shadow-[0_0_25px_rgba(79,70,229,0.5)] flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all z-50">
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
      </button>
    </div>
  );
}

export default App;
