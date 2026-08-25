import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Hls from "hls.js";
import { BASE_URL } from "../services/api";

const FACTORY_CAMS = {
  '小瀬': [
    { id: 'tapo_cam',  label: 'CAM 1' },
    { id: 'tapo_cam2', label: 'CAM 2' },
    { id: 'tapo_cam3', label: 'CAM 3' },
  ],
  '倉知': [
    { id: 'kurachi_cam',  label: 'CAM 1' },
    { id: 'kurachi_cam2', label: 'CAM 2' },
  ],
};

export default function CameraModal({ onClose, factory = '小瀬', stream }) {
  const camLabels = FACTORY_CAMS[factory] ?? FACTORY_CAMS['小瀬'];
  const videoRef = useRef(null);
  const [activeStream, setActiveStream] = useState(stream || camLabels[0].id);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const src = `${BASE_URL}api/cam?stream=${activeStream}`;
    const camUser = import.meta.env.VITE_CAM_USER || '';
    const camPass = import.meta.env.VITE_CAM_PASS || '';
    const basicAuth = camUser ? 'Basic ' + btoa(`${camUser}:${camPass}`) : '';

    if (Hls.isSupported()) {
      const hls = new Hls({
        xhrSetup: (xhr) => {
          if (basicAuth) xhr.setRequestHeader("Authorization", basicAuth);
        },
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        lowLatencyMode: false,
        liveBackBufferLength: 0,
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
          else hls.destroy();
        }
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
      return () => hls.destroy();
    }
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.play().catch(() => {});
    }
  }, [activeStream]);

  const activeLabel = camLabels.find(c => c.id === activeStream)?.label ?? 'CAM 1';
  const otherCams = camLabels.filter(c => c.id !== activeStream);

  const modal = (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="dashboard-section rounded-2xl w-full max-w-5xl flex flex-col overflow-hidden shadow-2xl"
        style={{ maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-separator/40 px-6 py-5 bg-surface">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{factory} — Live Camera</p>
            <h2 className="mt-1 text-xl font-semibold text-on-surface">Live Feed — {activeLabel}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-outline hover:bg-surface-container hover:text-on-surface transition-all duration-150 active:scale-95"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>
        <div className="relative flex-1 bg-black flex items-center justify-center" style={{ minHeight: "60vh" }}>
          <video
            ref={videoRef}
            className="w-full h-full"
            style={{ maxHeight: "70vh" }}
            controls
            playsInline
            muted
          />
          <div className="absolute bottom-4 right-4 flex gap-2">
            {otherCams.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveStream(c.id)}
                className="px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white text-xs font-semibold hover:bg-black/80 transition-all border border-white/20 active:scale-95"
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
