import React, { useEffect, useRef } from "react";
import ChartJS from "./chartSetup";
import { useLanguage } from "../../contexts/LanguageContext";

export default function FactoryDefectsChart({ factoryStats = [] }) {
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

    const sortedByDefects = [...factoryStats].sort((a, b) => (b.totalDefects || 0) - (a.totalDefects || 0));
    const labels = sortedByDefects.map((f) => f.factory || f._id || (isJa ? "未設定" : "Unknown"));
    const data = sortedByDefects.map((f) => f.totalDefects || 0);

    chartInstanceRef.current = new ChartJS(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: isJa ? "総不良数" : "Total Defects",
            data,
            backgroundColor: "#EF4444",
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            enabled: true,
            backgroundColor: "rgba(15, 23, 42, 0.92)",
            titleColor: "#ffffff",
            bodyColor: "#f1f5f9",
            borderColor: "rgba(239, 68, 68, 0.4)",
            borderWidth: 1,
            padding: 10,
            cornerRadius: 6,
            callbacks: {
              label: (ctxItem) => {
                const idx = ctxItem.dataIndex;
                const f = sortedByDefects[idx];
                const count = Number(ctxItem.parsed.y || 0).toLocaleString();
                const rate = f?.defectRate != null ? `${f.defectRate.toFixed(2)}%` : "—";
                return [
                  `  ${isJa ? "不良数" : "Defects"}: ${count}`,
                  `  ${isJa ? "不良率" : "Defect Rate"}: ${rate}`,
                ];
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: isJa ? "不良数" : "Defects",
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
            grid: {
              display: false,
            },
            ticks: {
              font: { size: 11 },
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
  }, [factoryStats, isJa]);

  return (
    <div className="freya-card flex flex-col rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-red-500">warning</span>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {isJa ? "工場別不良総数比較" : "Total Defects per Factory"}
          </h3>
        </div>
        <span className="font-mono text-xs text-[var(--text-muted)]">
          {factoryStats.length} {isJa ? "工場" : "factories"}
        </span>
      </div>
      <div className="h-72 w-full relative">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
