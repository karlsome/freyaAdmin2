import { useEffect, useState } from "react";
import { fetchFactoryDBRecords } from "../services/api";

function FactoryBox({ factory }) {
  const name = factory["工場"] || "—";

  return (
    <div className="rounded-3xl border border-outline-variant/25 bg-surface-container p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>
            factory
          </span>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">工場</p>
          <h4 className="text-base font-black text-on-surface">{name}</h4>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-outline-variant/20 bg-surface px-4 py-3">
        <p className="text-xs font-medium text-on-surface-variant/60">設備情報</p>
        <p className="mt-1 text-xs text-on-surface-variant/40 italic">— 設備データは次のタスクで追加されます —</p>
      </div>
    </div>
  );
}

export default function SetsubiDBWorkspace({ refreshToken }) {
  const [factories, setFactories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadFactories() {
      setLoading(true);
      setError("");
      try {
        const records = await fetchFactoryDBRecords();
        if (!active) return;
        setFactories(Array.isArray(records) ? records : []);
      } catch (err) {
        if (!active) return;
        setError(err?.message || "Failed to load factories.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadFactories();
    return () => {
      active = false;
    };
  }, [refreshToken]);

  return (
    <section className="glass-card rounded-3xl p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-outline">設備</p>
          <h3 className="mt-1 text-2xl font-black text-on-surface">Equipment by Factory</h3>
        </div>
        <div className="text-sm text-on-surface-variant">
          {!loading && !error && (
            factories.length
              ? `${factories.length} ${factories.length === 1 ? "factory" : "factories"}`
              : "No factories found."
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-sm font-medium text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin mr-2" style={{ fontSize: 18 }}>progress_activity</span>
          Loading factories…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-2xl bg-error/10 px-5 py-4 text-sm font-medium text-error">
          {error}
        </div>
      )}

      {!loading && !error && factories.length === 0 && (
        <div className="rounded-2xl border border-outline-variant/20 bg-surface px-5 py-8 text-center text-sm text-on-surface-variant">
          No factory records found in factoryDB.
        </div>
      )}

      {!loading && !error && factories.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {factories.map((factory, index) => {
            const id = factory._id?.$oid ?? factory._id ?? String(index);
            return <FactoryBox key={id} factory={factory} />;
          })}
        </div>
      )}
    </section>
  );
}
