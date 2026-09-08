import { useState, useRef, useEffect } from "react";
import Hls from "hls.js";
import { BASE_URL } from "../../services/api";
import { useLanguage } from "../../contexts/LanguageContext";

const FACTORY_CAMS = {
  '小瀬': [
    { id: 'tapo_cam',  label: 'CAM 1 (SRS Line)', labelJa: 'CAM 1（SRSライン）' },
    { id: 'tapo_cam2', label: 'CAM 2 (Press Line)', labelJa: 'CAM 2（プレスライン）' },
    { id: 'tapo_cam3', label: 'CAM 3 (Inspection)', labelJa: 'CAM 3（検査）' },
  ],
  '倉知': [
    { id: 'kurachi_cam',  label: 'CAM 1 (Assembly)', labelJa: 'CAM 1（組立）' },
    { id: 'kurachi_cam2', label: 'CAM 2 (Packaging)', labelJa: 'CAM 2（梱包）' },
  ],
};

export default function LiveCameraFeedCard({ onOpenModal, onAskAI, isHighlighted }) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const [activeFactory, setActiveFactory] = useState('小瀬');
  const camList = FACTORY_CAMS[activeFactory] || FACTORY_CAMS['小瀬'];
  const [activeStream, setActiveStream] = useState(camList[0].id);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    // When factory changes, reset active stream to first camera
    setActiveStream(FACTORY_CAMS[activeFactory][0].id);
  }, [activeFactory]);

  useEffect(() => {
    if (!isStreaming) {
      setStreamError(false);
      return;
    }

    const video = videoRef.current;
    if (!video) return;
    setStreamError(false);

    const camBase = import.meta.env.VITE_CAM_URL || BASE_URL;
    const src = `${camBase}api/cam?stream=${activeStream}`;
    const camUser = import.meta.env.VITE_CAM_USER || '';
    const camPass = import.meta.env.VITE_CAM_PASS || '';
    const basicAuth = camUser ? 'Basic ' + btoa(`${camUser}:${camPass}`) : '';

    let hls = null;
    if (Hls.isSupported()) {
      hls = new Hls({
        xhrSetup: (xhr) => {
          if (basicAuth) xhr.setRequestHeader("Authorization", basicAuth);
        },
        liveSyncDurationCount: 2,
        liveMaxLatencyDurationCount: 6,
        lowLatencyMode: true,
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          setStreamError(true);
          hls.destroy();
        }
      });

      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => setStreamError(true));
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.play().catch(() => setStreamError(true));
    } else {
      setStreamError(true);
    }

    return () => {
      if (hls) hls.destroy();
    };
  }, [activeStream, isStreaming]);

  const activeCamObj = camList.find(c => c.id === activeStream);
  const activeCamLabel = activeCamObj ? (isJa ? (activeCamObj.labelJa || activeCamObj.label) : activeCamObj.label) : (isJa ? "カメラ" : "Camera");

  return (
    <div
      className={`rounded-[8px] bg-[var(--surface)] border border-[var(--border)] p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 shadow-2xs ${
        isHighlighted ? "ring-2 ring-[var(--freya-blue)] ring-offset-2 ring-offset-[var(--page-bg)]" : ""
      }`}
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[6px] bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>videocam</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)]">
                {isJa ? "工場ライブ映像" : "Live Factory Feeds"}
              </h3>
              {isStreaming ? (
                <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-[4px] text-xs font-semibold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {isJa ? "● ライブ配信中" : "● Live Feed"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-[4px] text-xs font-semibold uppercase bg-slate-500/10 text-[var(--text-muted)] border border-[var(--border)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  {isJa ? "待機中（データ節約）" : "Standby (Data Saver)"}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {isJa ? "各拠点のリアルタイムカメラ映像" : "Real-time facility camera streaming"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onAskAI && (
            <button
              onClick={() => onAskAI(`Check live camera stream for ${activeFactory} - ${activeCamLabel}`)}
              title={isJa ? "AIに映像の分析を依頼" : "Ask AI to analyze video feed"}
              className="flex items-center gap-1.5 text-xs font-semibold text-[var(--freya-blue)] hover:bg-[var(--freya-blue-subtle)] px-2.5 py-1 rounded-[6px] transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
              <span>{isJa ? "AIに聞く" : "Ask AI"}</span>
            </button>
          )}

          {onOpenModal && (
            <button
              onClick={() => onOpenModal(activeFactory, activeStream)}
              title={isJa ? "カメラ画面を拡大表示" : "Expand full-screen camera modal"}
              className="w-8 h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] flex items-center justify-center transition-colors shadow-2xs"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>open_in_full</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Controls: Factory tabs & Camera buttons ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="inline-flex p-1 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)] gap-1">
          {['小瀬', '倉知'].map((f) => (
            <button
              key={f}
              onClick={() => setActiveFactory(f)}
              className={`h-7 px-3 text-xs font-semibold rounded-[4px] transition-all ${
                activeFactory === f
                  ? "bg-[var(--freya-blue)] text-white shadow-xs"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]/70"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {camList.map((cam) => (
            <button
              key={cam.id}
              onClick={() => setActiveStream(cam.id)}
              className={`px-2 py-1 text-[11px] font-semibold rounded-[4px] border transition-colors ${
                activeStream === cam.id
                  ? "bg-[var(--surface-hover)] text-[var(--freya-blue)] border-[var(--freya-blue)] font-semibold shadow-2xs"
                  : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text-primary)] font-medium"
              }`}
            >
              {isJa ? (cam.labelJa || cam.label) : cam.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Video Player Area / Data-Saver Standby ── */}
      {!isStreaming ? (
        <div className="relative aspect-video w-full rounded-[6px] overflow-hidden bg-[var(--surface-hover)] border border-[var(--border)] flex flex-col items-center justify-center p-5 text-center">
          <div className="w-11 h-11 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--freya-blue)] mb-2.5 shadow-2xs">
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>videocam</span>
          </div>
          <p className="text-xs font-semibold text-[var(--text-primary)]">{activeFactory} · {activeCamLabel}</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5 max-w-[260px] mb-3">
            {isJa ? "データ通信量節約のため一時停止しています。下のボタンで再生を開始します。" : "Live stream is paused to save data. Click below to connect live video."}
          </p>
          <button
            onClick={() => setIsStreaming(true)}
            className="h-8 px-4 rounded-[6px] bg-[var(--freya-blue)] hover:bg-[var(--freya-blue-hover)] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>play_arrow</span>
            <span>{isJa ? "配信を開始" : "Start Stream"}</span>
          </button>
        </div>
      ) : (
        <div className="relative aspect-video w-full rounded-[6px] overflow-hidden bg-slate-900 border border-[var(--border)] flex items-center justify-center group">
          <video
            ref={videoRef}
            className={`w-full h-full object-cover ${streamError ? "hidden" : "block"}`}
            autoPlay
            muted
            playsInline
          />

          {/* Floating Pause Stream Button */}
          <div className="absolute top-2 right-2 flex items-center gap-1.5 z-20">
            <button
              onClick={() => setIsStreaming(false)}
              title={isJa ? "データ節約のため配信を停止" : "Stop streaming to save data"}
              className="h-6 px-2 rounded-[4px] bg-black/70 hover:bg-black/90 backdrop-blur-xs text-white text-[10px] font-semibold border border-white/20 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-rose-400" style={{ fontSize: 13 }}>pause</span>
              <span>{isJa ? "停止" : "Stop Stream"}</span>
            </button>
          </div>

          {/* Fallback / Offline overlay */}
          {streamError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-slate-950 text-slate-300 z-10">
              <span className="material-symbols-outlined text-slate-500 mb-2" style={{ fontSize: 32 }}>videocam_off</span>
              <p className="text-xs font-semibold text-slate-200">{activeFactory} · {activeCamLabel}</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-[280px]">
                {isJa ? "カメラ待機中。ネットワーク接続が確立され次第、自動的に再開されます。" : "Camera proxy link standby. Local stream feed will resume automatically upon network handshake."}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => setIsStreaming(false)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-[6px] bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  {isJa ? "配信を閉じる" : "Close Stream"}
                </button>
                <button
                  onClick={() => onOpenModal && onOpenModal(activeFactory, activeStream)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-[6px] bg-[var(--freya-blue)] text-white hover:bg-[var(--freya-blue-hover)] transition-colors"
                >
                  {isJa ? "診断モーダル" : "Diagnostics Modal"}
                </button>
              </div>
            </div>
          )}

          {/* Live Overlay Bar */}
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between px-2.5 py-1 rounded-[4px] bg-black/60 backdrop-blur-xs text-white text-[10px]">
            <span className="font-semibold tracking-wide flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {activeFactory} · {activeCamLabel}
            </span>
            <span className="font-mono opacity-80">{new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
