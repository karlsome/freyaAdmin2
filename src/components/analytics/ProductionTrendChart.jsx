import React, { useEffect, useRef } from "react";
import ChartJS from "./chartSetup";
import { useLanguage } from "../../contexts/LanguageContext";

export default function ProductionTrendChart({ dailyTrend = [] }) {
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
            label: isJa ? "生産量" : "Production",
            data: dailyTrend.map((d) => d.totalProduction || 0),
            borderColor: "#3B82F6",
            backgroundColor: "#3B82F6",
            borderWidth: 2,
            pointRadius: dailyTrend.length > 35 ? 1.5 : 3,
            pointHoverRadius: 5,
            fill: false,
            tension: 0.15,
          },
          {
            label: isJa ? "不良数" : "Defects",
            data: dailyTrend.map((d) => d.totalDefects || 0),
            borderColor: "#EF4444",
            backgroundColor: "#EF4444",
            borderWidth: 2,
            pointRadius: dailyTrend.length > 35 ? 1.5 : 3,
            pointHoverRadius: 5,
            fill: false,
            tension: 0.15,
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
              text: isJa ? "数量" : "Quantity",
              color: "#94a3b8",
              font: { size: 11 },
            },
            grid: {
              color: "rgba(148, 163, 184, 0.12)",
            },
            ticks: {
              callback: (val) => Number(val).toLocaleString(),
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
            borderColor: "rgba(59, 130, 246, 0.4)",
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
                const label = ctxItem.dataset.label || "";
                const val = Number(ctxItem.parsed.y || 0).toLocaleString();
                return `  ${label}: ${val}`;
              },
              afterBody: (ctxList) => {
                const idx = ctxList[0]?.dataIndex;
                const d = dailyTrend[idx];
                if (!d) return [];
                const prod = d.totalProduction || 0;
                const def = d.totalDefects || 0;
                const rate = prod > 0 ? ((def / prod) * 100).toFixed(2) : "0.00";
                return [
                  "",
                  `${isJa ? "不良率" : "Defect Rate"}: ${rate}%`,
                  d.avgCycleTime > 0 ? `${isJa ? "平均サイクル" : "Avg Cycle"}: ${d.avgCycleTime} min` : "",
                ].filter(Boolean);
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
          <span className="material-symbols-outlined text-[18px] text-[var(--freya-blue)]">show_chart</span>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {isJa ? "生産量・不良数の推移" : "Production & Defect Trend"}
          </h3>
        </div>
        <span className="font-mono text-xs text-[var(--text-muted)]">
          {dailyTrend.length} {isJa ? "日分" : "days"}
        </span>
      </div>
      <div className="h-72 w-full relative">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
