import React, { useEffect, useRef } from "react";
import ChartJS from "./chartSetup";

export default function MachineComparisonChart({
  machines = [],
  onSelectMachine,
  isJa = true,
}) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  // Filter to active machines and sort descending by total shots
  const sorted = [...machines]
    .filter((m) => (m.analytics?.totalShots || 0) > 0)
    .sort((a, b) => (b.analytics?.totalShots || 0) - (a.analytics?.totalShots || 0))
    .slice(0, 15); // Top 15 active machines

  const labels = sorted.map((m) => (m.factory ? `${m.machine} (${m.factory})` : m.machine));
  const data = sorted.map((m) => m.analytics?.totalShots || 0);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");

    const existing = ChartJS.getChart(canvasRef.current);
    if (existing) {
      existing.destroy();
    }
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    if (sorted.length === 0) return;

    chartRef.current = new ChartJS(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: isJa ? "総ショット数" : "Total Shots",
            data,
            backgroundColor: "rgba(59, 130, 246, 0.75)",
            hoverBackgroundColor: "rgba(37, 99, 235, 0.95)",
            borderColor: "#3b82f6",
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        onClick: (event, elements) => {
          if (elements.length > 0 && onSelectMachine) {
            const index = elements[0].index;
            const target = sorted[index];
            if (target) onSelectMachine(target.machine);
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            titleColor: "#ffffff",
            bodyColor: "#f1f5f9",
            borderColor: "rgba(59, 130, 246, 0.4)",
            borderWidth: 1,
            padding: 10,
            cornerRadius: 6,
            callbacks: {
              title: (items) => {
                const idx = items[0]?.dataIndex;
                const m = sorted[idx];
                return m ? `${m.machine} • ${m.factory || ""}` : "";
              },
              label: (item) => {
                const idx = item.dataIndex;
                const m = sorted[idx];
                const shots = Number(item.parsed.x || 0).toLocaleString();
                const perDay = m?.analytics?.avgShotsPerDay || 0;
                const hours = m?.analytics?.workingHours || 0;
                return [
                  `  ${isJa ? "総ショット数" : "Total Shots"}: ${shots}`,
                  `  ${isJa ? "日平均" : "Avg / Day"}: ${Number(perDay).toLocaleString()}`,
                  `  ${isJa ? "総稼働時間" : "Total Hours"}: ${hours}h`,
                  `  💡 ${isJa ? "クリックして詳細を表示" : "Click to view full details"}`,
                ];
              },
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: {
              color: "rgba(148, 163, 184, 0.12)",
            },
            ticks: {
              precision: 0,
              callback: (v) => Number(v).toLocaleString(),
            },
            title: {
              display: true,
              text: isJa ? "総ショット数 (shots)" : "Total Shots",
              color: "#94a3b8",
              font: { size: 11 },
            },
          },
          y: {
            grid: { display: false },
            ticks: {
              autoSkip: false,
              font: { size: 11, weight: "500" },
            },
          },
        },
      },
    });

    return () => {
      if (canvasRef.current) {
        const c = ChartJS.getChart(canvasRef.current);
        if (c) c.destroy();
      }
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [labels, data, sorted, isJa, onSelectMachine]);

  if (sorted.length === 0) {
    return null;
  }

  const chartHeight = Math.max(220, sorted.length * 28 + 60);

  return (
    <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xs">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-[var(--freya-blue)]">leaderboard</span>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {isJa ? "設備ショット数 比較ランキング (TOP 15)" : "Machine Shot Comparison Ranking (Top 15)"}
          </h3>
        </div>
        <span className="text-[11px] text-[var(--text-muted)]">
          {isJa ? "棒をクリックで詳細を開く" : "Click any bar for details"}
        </span>
      </div>

      <div style={{ height: `${chartHeight}px` }} className="w-full relative">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
