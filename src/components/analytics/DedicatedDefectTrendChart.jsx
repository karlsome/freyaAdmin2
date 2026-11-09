import React, { useEffect, useRef, useMemo } from "react";
import ChartJS from "./chartSetup";
import { useLanguage } from "../../contexts/LanguageContext";

export default function DedicatedDefectTrendChart({ dailyTrend = [] }) {
  const canvasRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const { language } = useLanguage();
  const isJa = language === "ja";

  const totalDefects = useMemo(() => {
    return dailyTrend.reduce((sum, d) => sum + (d.totalDefects || 0), 0);
  }, [dailyTrend]);

  const totalProduction = useMemo(() => {
    return dailyTrend.reduce((sum, d) => sum + (d.totalProduction || 0), 0);
  }, [dailyTrend]);

  const avgDefectRate = useMemo(() => {
    if (!totalProduction) return "0.00";
    return ((totalDefects / totalProduction) * 100).toFixed(2);
  }, [totalDefects, totalProduction]);

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
        return isNaN(dt.getTime())
          ? d.date
          : dt.toLocaleDateString(isJa ? "ja-JP" : "en-US", { month: "numeric", day: "numeric" });
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
            label: isJa ? "不良数" : "Defects",
            data: dailyTrend.map((d) => d.totalDefects || 0),
            borderColor: "#EF4444",
            backgroundColor: "rgba(239, 68, 68, 0.12)",
            borderWidth: 2,
            pointRadius: dailyTrend.length > 35 ? 1.5 : 3,
            pointHoverRadius: 5,
            pointBackgroundColor: "#EF4444",
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
              text: isJa ? "不良数 (個)" : "Defects (pcs)",
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
            display: false,
          },
          tooltip: {
            enabled: true,
            mode: "index",
            intersect: false,
            backgroundColor: "rgba(15, 23, 42, 0.92)",
            titleColor: "#ffffff",
            bodyColor: "#f1f5f9",
            borderColor: "rgba(239, 68, 68, 0.4)",
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
                const val = Number(ctxItem.parsed.y || 0).toLocaleString();
                return `  ${isJa ? "不良数" : "Defects"}: ${val}`;
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
                  `${isJa ? "当日不良率" : "Daily Defect Rate"}: ${rate}%`,
                  `${isJa ? "当日生産量" : "Daily Production"}: ${prod.toLocaleString()}`,
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
          <span className="material-symbols-outlined text-[18px] text-red-500">
            report_problem
          </span>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {isJa ? "不良数推移 (単独)" : "Dedicated Defect Trend"}
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-[4px] bg-red-500/10 px-2 py-0.5 font-semibold text-red-600 dark:text-red-400">
            {isJa ? "合計:" : "Total:"} {totalDefects.toLocaleString()} ({avgDefectRate}%)
          </span>
          <span className="font-mono text-[var(--text-muted)]">
            {dailyTrend.length} {isJa ? "日分" : "days"}
          </span>
        </div>
      </div>
      <div className="h-72 w-full relative">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
