import React, { useEffect, useRef } from "react";
import ChartJS from "./chartSetup";
import { useLanguage } from "../../contexts/LanguageContext";

export default function QualityTrendChart({ dailyTrend = [] }) {
  const canvasRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const { language } = useLanguage();
  const isJa = language === "ja";

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");

    const existing = ChartJS.getChart(canvasRef.current);
    if (existing) {
      existing.destroy();
    }
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }

    const labels = dailyTrend.map((d) => {
      try {
        const dt = new Date(d.date);
        return isNaN(dt.getTime()) ? d.date : dt.toLocaleDateString(isJa ? "ja-JP" : "en-US", { month: "numeric", day: "numeric" });
      } catch {
        return d.date;
      }
    });

    chartInstanceRef.current = new ChartJS(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: isJa ? "不良率 (%)" : "Defect Rate (%)",
            data: dailyTrend.map((d) => (d.defectRate != null ? Number(d.defectRate.toFixed(2)) : 0)),
            borderColor: "#F59E0B",
            backgroundColor: "rgba(245, 158, 11, 0.12)",
            borderWidth: 2,
            pointRadius: dailyTrend.length > 35 ? 2 : 3.5,
            pointHoverRadius: 6,
            pointBackgroundColor: "#F59E0B",
            fill: true,
            tension: 0.2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: "index",
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: isJa ? "不良率 (%)" : "Defect Rate (%)",
              color: "#94a3b8",
              font: { size: 11 },
            },
            grid: {
              color: "rgba(148, 163, 184, 0.12)",
            },
            ticks: {
              callback: (val) => `${val}%`,
            },
          },
          x: {
            title: {
              display: true,
              text: isJa ? "日付" : "Date",
              color: "#94a3b8",
              font: { size: 11 },
            },
            grid: {
              color: "rgba(148, 163, 184, 0.08)",
            },
            ticks: {
              maxRotation: 45,
              autoSkip: true,
              maxTicksLimit: 14,
            },
          },
        },
        plugins: {
          legend: {
            display: true,
            position: "top",
            labels: {
              boxWidth: 12,
              font: { size: 11, weight: "500" },
              color: "var(--text-secondary, #64748b)",
            },
          },
          tooltip: {
            enabled: true,
            mode: "index",
            intersect: false,
            backgroundColor: "rgba(15, 23, 42, 0.92)",
            titleColor: "#ffffff",
            bodyColor: "#f1f5f9",
            borderColor: "rgba(245, 158, 11, 0.5)",
            borderWidth: 1,
            padding: 10,
            cornerRadius: 6,
            callbacks: {
              title: (ctxList) => {
                const idx = ctxList[0]?.dataIndex;
                const d = dailyTrend[idx];
                return d?.date || ctxList[0]?.label || "";
              },
              label: (ctxItem) => {
                const rate = Number(ctxItem.parsed.y || 0);
                let status = isJa ? "🟢 優秀" : "🟢 Excellent";
                if (rate > 10) status = isJa ? "🔴 要改善" : "🔴 Action Required";
                else if (rate > 5) status = isJa ? "🟠 注意" : "🟠 Warning";
                else if (rate > 2) status = isJa ? "🟡 良好" : "🟡 Good";

                return `  ${isJa ? "不良率" : "Defect Rate"}: ${rate.toFixed(2)}%  ${status}`;
              },
              afterBody: (ctxList) => {
                const idx = ctxList[0]?.dataIndex;
                const d = dailyTrend[idx];
                if (!d) return [];
                return [
                  "",
                  `${isJa ? "生産量" : "Production"}: ${(d.totalProduction || 0).toLocaleString()}`,
                  `${isJa ? "不良数" : "Defects"}: ${(d.totalDefects || 0).toLocaleString()}`,
                ];
              },
            },
          },
        },
      },
    });

    return () => {
      if (canvasRef.current) {
        const existingChart = ChartJS.getChart(canvasRef.current);
        if (existingChart) {
          existingChart.destroy();
        }
      }
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [dailyTrend, isJa]);

  return (
    <div className="freya-card flex flex-col rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-amber-500">verified</span>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {isJa ? "品質トレンド (不良率推移)" : "Quality Trend (Defect Rate)"}
          </h3>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
            ≤2% {isJa ? "優秀" : "Target"}
          </span>
        </div>
      </div>
      <div className="h-72 w-full relative">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
