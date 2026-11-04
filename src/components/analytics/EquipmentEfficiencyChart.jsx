import React, { useEffect, useRef } from "react";
import ChartJS from "./chartSetup";
import { useLanguage } from "../../contexts/LanguageContext";

export default function EquipmentEfficiencyChart({ equipmentStats = [] }) {
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

    const topEquipment = equipmentStats.slice(0, 10);
    const labels = topEquipment.map((e) => e.equipment || e._id || (isJa ? "未設定" : "Unknown"));

    chartInstanceRef.current = new ChartJS(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: isJa ? "平均サイクルタイム (分)" : "Avg Cycle Time (min)",
            data: topEquipment.map((e) => Number((e.avgCycleTime || 0).toFixed(1))),
            backgroundColor: "#10B981",
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y", // Horizontal bar chart
        scales: {
          x: {
            beginAtZero: true,
            title: {
              display: true,
              text: isJa ? "サイクルタイム (分)" : "Cycle Time (min)",
              color: "#94a3b8",
              font: { size: 11 },
            },
            grid: {
              color: "rgba(148, 163, 184, 0.12)",
            },
            ticks: {
              callback: (val) => `${val}m`,
            },
          },
          y: {
            grid: {
              display: false,
            },
            ticks: {
              font: { size: 11 },
            },
          },
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            enabled: true,
            backgroundColor: "rgba(15, 23, 42, 0.92)",
            titleColor: "#ffffff",
            bodyColor: "#f1f5f9",
            borderColor: "rgba(16, 185, 129, 0.4)",
            borderWidth: 1,
            padding: 10,
            cornerRadius: 6,
            callbacks: {
              label: (ctxItem) => {
                const idx = ctxItem.dataIndex;
                const eq = topEquipment[idx];
                return [
                  `  ${isJa ? "平均サイクル" : "Avg Cycle"}: ${ctxItem.parsed.x} min`,
                  eq?.totalProduction ? `  ${isJa ? "生産数" : "Production"}: ${eq.totalProduction.toLocaleString()}` : "",
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
  }, [equipmentStats, isJa]);

  return (
    <div className="freya-card flex flex-col rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-teal-500">precision_manufacturing</span>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {isJa ? "設備別効率 (平均サイクルタイム)" : "Equipment Efficiency (Top 10)"}
          </h3>
        </div>
        <span className="font-mono text-xs text-[var(--text-muted)]">
          {equipmentStats.length} {isJa ? "設備" : "machines"}
        </span>
      </div>
      <div className="h-72 w-full relative">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
