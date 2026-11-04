import { useEffect, useState } from "react";
import { fetchTwinFactories } from "../services/digitalTwinApi";
import { DEFAULT_3D_FACTORIES, DEFAULT_FACTORY, has3DLayout } from "../data/factoryLayouts";

const STORAGE_KEY = "freya.dashboard.factory.v1";

/** List of factories for the dashboard picker. Guarantees 3D factories (小瀬, SCNA) are always selectable. */
export function useTwinFactories() {
  const [factories, setFactories] = useState(DEFAULT_3D_FACTORIES);

  useEffect(() => {
    let alive = true;
    fetchTwinFactories()
      .then((list) => {
        if (!alive || !list.length) return;
        const map = new Map();
        DEFAULT_3D_FACTORIES.forEach((f) => map.set(f.factory, { ...f, has3D: has3DLayout(f.factory) }));
        list.forEach((f) => {
          const prev = map.get(f.factory) || {};
          map.set(f.factory, { ...prev, ...f, has3D: has3DLayout(f.factory) });
        });
        setFactories(Array.from(map.values()));
      })
      .catch(() => { /* keep the fallback list */ });
    return () => { alive = false; };
  }, []);

  return factories;
}

/** Selected factory: ?factory= in the URL wins, then the last choice, then the default. */
export function useSelectedFactory() {
  const [factory, setFactoryState] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("factory");
    if (fromUrl) return fromUrl;
    try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_FACTORY;
    } catch {
      return DEFAULT_FACTORY;
    }
  });

  const setFactory = (next) => {
    setFactoryState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
    const url = new URL(window.location.href);
    if (next === DEFAULT_FACTORY) url.searchParams.delete("factory");
    else url.searchParams.set("factory", next);
    window.history.replaceState(window.history.state, "", url);
  };

  return [factory, setFactory];
}
