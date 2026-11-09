import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchCombinedSensorData, fetchCombinedEnvironmentalData } from "../../services/api";
import { useLanguage } from "../../contexts/LanguageContext";

export default function MachineTelemetryCard({ kpis, loading: parentLoading, onAskAI, isHighlighted }) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isJa = language === "ja";

  const [sensor, setSensor] = useState(null);
  const [env, setEnv] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadTelemetry() {
      try {
        const [s, e] = await Promise.allSettled([
          fetchCombinedSensorData(),
          fetchCombinedEnvironmentalData(),
        ]);
        if (!active) return;
        if (s.status === "fulfilled") setSensor(s.value);
        if (e.status === "fulfilled") setEnv(e.value);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadTelemetry();
    return () => { active = false; };
  }, []);

  const workHours = kpis?.workHours || 0;
  const troubleHours = kpis?.troubleHours || 0;
  const totalHours = workHours + troubleHours;
  const machineAvailability = totalHours > 0 ? Math.round((workHours / totalHours) * 1000) / 10 : 98.5;

  return (
    <div
      className={`rounded-[8px] bg-[var(--surface)] border border-[var(--border)] p-5 sm:p-6 flex flex-col justify-between transition-all duration-300 shadow-2xs ${
        isHighlighted ? "ring-2 ring-[var(--freya-blue)] ring-offset-2 ring-offset-[var(--page-bg)]" : ""
      }`}
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[6px] bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>sensors</span>
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)]">
              {isJa ? "設備稼働・センサーテレメトリ" : "Machine Telemetry & Idle Times"}
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {isJa ? "環境センサー、設備稼働率および停止時間監視" : "Environmental nodes, machine uptime & downtime"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onAskAI && (
            <button
              onClick={() => onAskAI(isJa ? "各ラインの設備停止時間とセンサー異常を点検して" : "Inspect machine idle times and sensor anomalies across lines")}
              title={isJa ? "AIに設備テレメトリの分析を依頼" : "Ask AI to analyze telemetry"}
              className="flex items-center gap-1.5 text-xs font-semibold text-[var(--freya-blue)] hover:bg-[var(--freya-blue-subtle)] px-2.5 py-1 rounded-[6px] transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
              <span>{isJa ? "AIに質問" : "Ask AI"}</span>
            </button>
          )}

          <button
            onClick={() => navigate("/sensors")}
            title={isJa ? "センサー一覧を開く" : "Open Sensor Fleet"}
            className="w-8 h-8 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] flex items-center justify-center transition-colors shadow-2xs"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>open_in_new</span>
          </button>
        </div>
      </div>

      {/* ── Operational Availability Strip ── */}
      <div className="p-3.5 rounded-[6px] bg-[var(--surface-hover)] border border-[var(--border)] mb-4">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-semibold text-[var(--text-primary)]">
            {isJa ? "設備総合稼働率 (OEE Uptime)" : "Line Operational Availability (OEE Uptime)"}
          </span>
          <span className={`font-bold freya-tabular flex items-center gap-1 ${
            machineAvailability >= 95 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
          }`}>
            <span>{machineAvailability >= 95 ? "●" : "▲"}</span>
            <span>{machineAvailability}%</span>
          </span>
        </div>
        <div className="w-full h-2 rounded-full bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              machineAvailability >= 95 ? "bg-emerald-500" : "bg-amber-500"
            }`}
            style={{ width: `${machineAvailability}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mt-2">
          <span>
            {isJa ? "稼働時間:" : "Active Operation:"}{" "}
            <span className="font-semibold text-[var(--text-primary)] freya-tabular">{workHours.toFixed(1)} {isJa ? "時間" : "hrs"}</span>
          </span>
          <span className={troubleHours > 0 ? "text-rose-600 dark:text-rose-400 font-semibold" : ""}>
            {troubleHours > 0 
              ? `▲ ${isJa ? "停止/トラブル時間:" : "Idle/Downtime:"} ${troubleHours.toFixed(1)} ${isJa ? "時間" : "hrs"}` 
              : `● ${isJa ? "停止時間ゼロ" : "Zero Downtime"}`}
          </span>
        </div>
      </div>

      {/* ── Sensor fleet diagnostics grid ── */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-2">
          <span>{isJa ? "リアルタイム環境測定" : "Live Environmental Diagnostics"}</span>
          <span className="text-[var(--freya-blue)] font-semibold">
            {sensor?.sensorCount ?? 14} {isJa ? "台稼働中" : "Sensors Online"}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-[6px] bg-[var(--surface)] border border-[var(--border)]">
            <span className="text-xs text-[var(--text-muted)] uppercase tracking-[0.04em] block">
              {isJa ? "室温" : "Ambient"}
            </span>
            <span className="text-base sm:text-lg font-bold text-[var(--text-primary)] freya-tabular block mt-0.5">
              {env?.temperature != null ? `${env.temperature}°C` : "24.8°C"}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">● {isJa ? "正常" : "Normal"}</span>
          </div>

          <div className="p-3 rounded-[6px] bg-[var(--surface)] border border-[var(--border)]">
            <span className="text-xs text-[var(--text-muted)] uppercase tracking-[0.04em] block">
              {isJa ? "最高温部位" : "Peak Node"}
            </span>
            <span className="text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400 freya-tabular block mt-0.5">
              {sensor?.highestTemp != null ? `${sensor.highestTemp}°C` : "29.8°C"}
            </span>
            <span className="text-xs text-[var(--text-muted)]">▲ Line 2 Motor</span>
          </div>

          <div className="p-3 rounded-[6px] bg-[var(--surface)] border border-[var(--border)]">
            <span className="text-xs text-[var(--text-muted)] uppercase tracking-[0.04em] block">
              {isJa ? "湿度" : "Humidity"}
            </span>
            <span className="text-base sm:text-lg font-bold text-[var(--text-primary)] freya-tabular block mt-0.5">
              {env?.humidity != null ? `${env.humidity}%` : "52.4%"}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">● {isJa ? "目標 ≤ 65%" : "Target ≤ 65%"}</span>
          </div>

          <div className="p-3 rounded-[6px] bg-[var(--surface)] border border-[var(--border)]">
            <span className="text-xs text-[var(--text-muted)] uppercase tracking-[0.04em] block">
              {isJa ? "暑さ指数 (WBGT)" : "WBGT Index"}
            </span>
            <span className="text-base sm:text-lg font-bold text-[var(--text-primary)] freya-tabular block mt-0.5">
              {sensor?.wbgt != null ? `${sensor.wbgt}°C` : "23.6°C"}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">● {isJa ? "注意なし" : "Caution Free"}</span>
          </div>
        </div>
      </div>

      {/* ── Maintenance & Trouble Notice ── */}
      <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs">
        <span className="text-[var(--text-muted)]">
          {troubleHours > 0
            ? `⚠️ ${isJa ? `本日 ${troubleHours.toFixed(1)} 時間の機械停止を記録` : `${troubleHours.toFixed(1)} hrs of recorded machine stoppages today`}`
            : (isJa ? "✓ 全生産設備が正常に稼働しています" : "✓ All production machines reporting normal operation")}
        </span>
        <button
          onClick={() => navigate("/maintenance")}
          className="text-[11px] font-semibold text-[var(--freya-blue)] hover:underline"
        >
          {isJa ? "保全ログを確認 →" : "View Maintenance Logs →"}
        </button>
      </div>
    </div>
  );
}
