import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Call alert sounds for the standalone 3D page — mirrors factory-stopcall-tv.html:
 *  - plays leader / stop / box / roll(material) / 2-hour-QC MP3 when a call type is newly raised on a machine
 *  - re-plays leader / stop every 8 minutes while the call stays open
 * The MP3s are resolved relative to the page (Kurachi/src/*.mp3, next to factory3D.html).
 * Sound is ON by default; browsers keep audio blocked until the first click/touch, so we unlock then.
 */
const FILES = {
  leader: "src/leader.mp3",
  stop: "src/STOP.mp3",
  box: "src/box.mp3",
  material: "src/roll.mp3",
  quality: "src/2hourReminder.mp3",
};
const TYPES = Object.keys(FILES);
const RENOTIFY_MS = 8 * 60 * 1000;
const STORAGE_KEY = "freya.twin.callSound.v1";

export function useCallSounds(activeCalls, enabledFeature) {
  const [soundOn, setSoundOn] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) !== "0"; } catch { return true; }
  });
  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;
  const audios = useRef(null);
  const queue = useRef([]);
  const playing = useRef(false);
  const prevTypes = useRef(new Map());
  const renotified = useRef(new Map());

  const getAudios = () => {
    if (!audios.current) {
      audios.current = {};
      TYPES.forEach((t) => { audios.current[t] = new Audio(FILES[t]); audios.current[t].preload = "auto"; });
    }
    return audios.current;
  };

  const next = useCallback(() => {
    const type = queue.current.shift();
    if (!type) { playing.current = false; return; }
    playing.current = true;
    const a = getAudios()[type];
    let done = false;
    const finish = () => { if (done) return; done = true; a.removeEventListener("ended", finish); next(); };
    a.addEventListener("ended", finish);
    window.setTimeout(finish, 8000); // never stall the queue
    try {
      a.currentTime = 0;
      a.play().catch(finish);
    } catch { finish(); }
  }, []);

  const enqueue = useCallback((type) => {
    if (!soundOnRef.current) return;
    queue.current.push(type);
    if (!playing.current) next();
  }, [next]);

  // Unlock audio on first user gesture (autoplay policy)
  useEffect(() => {
    if (!enabledFeature) return undefined;
    const unlock = () => {
      Object.values(getAudios()).forEach((a) => {
        a.muted = true;
        a.play().then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; });
      });
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
    };
    document.addEventListener("click", unlock);
    document.addEventListener("touchstart", unlock);
    return () => {
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
    };
  }, [enabledFeature]);

  // New call types + 8-minute re-notify for leader/stop
  useEffect(() => {
    if (!enabledFeature) return;
    const nextTypes = new Map();
    const fresh = [];
    activeCalls.forEach((c) => {
      const before = prevTypes.current.get(c.machine) || {};
      const cur = {};
      TYPES.forEach((t) => {
        cur[t] = !!c[t];
        if (c[t] && !before[t]) fresh.push({ type: t, since: c.since || 0 });
      });
      nextTypes.set(c.machine, cur);
      if (c.leader || c.stop) {
        const idx = Math.floor((c.waitMs || 0) / RENOTIFY_MS);
        const last = renotified.current.get(c.machine) || 0;
        if (idx > last) {
          renotified.current.set(c.machine, idx);
          if ((c.waitMs % RENOTIFY_MS) < 10000) fresh.push({ type: c.stop ? "stop" : "leader", since: Infinity });
        }
      } else {
        renotified.current.delete(c.machine);
      }
    });
    renotified.current.forEach((_, m) => { if (!nextTypes.has(m)) renotified.current.delete(m); });
    prevTypes.current = nextTypes;
    fresh.sort((a, b) => a.since - b.since).forEach((f) => enqueue(f.type));
  }, [activeCalls, enabledFeature, enqueue]);

  const toggleSound = useCallback(() => {
    setSoundOn((v) => {
      const nv = !v;
      try { localStorage.setItem(STORAGE_KEY, nv ? "1" : "0"); } catch { /* ignore */ }
      if (!nv) queue.current = [];
      return nv;
    });
  }, []);

  return [soundOn, toggleSound];
}
