import { useEffect, useRef } from "react";
import ChartJS from "../analytics/chartSetup";

// Thin Chart.js wrapper: rebuilds the chart whenever `config` changes.
export default function FinancialsChart({ config }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    ChartJS.getChart(canvas)?.destroy();
    const chart = new ChartJS(canvas.getContext("2d"), config);
    return () => chart.destroy();
  }, [config]);

  return <canvas ref={canvasRef} />;
}
