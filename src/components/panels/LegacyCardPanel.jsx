import { useEffect } from "react";
import { useTodayData } from "../../hooks/useTodayData";
import FinanceOverviewCard from "../dashboard/FinanceOverviewCard";
import LiveCameraFeedCard from "../dashboard/LiveCameraFeedCard";
import FactoryProductionCard from "../dashboard/FactoryProductionCard";
import MachineTelemetryCard from "../dashboard/MachineTelemetryCard";
import QualityDefectsCard from "../dashboard/QualityDefectsCard";
import IssuesApprovalsCard from "../dashboard/IssuesApprovalsCard";

/**
 * Mounted only while a detailed card is on screen, so the all-factory records
 * aren't fetched when nobody looks at them. Pushes the data up to the page.
 */
export function LegacyDataLoader({ onData }) {
  const data = useTodayData();
  const { kpis, issues, recent, byFactory, byProcess, loading, error } = data;
  useEffect(() => {
    onData({ kpis, issues, recent, byFactory, byProcess, loading, error, refresh: data.refresh });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, error, data.records, data.factoryNames]);
  return null;
}

/**
 * The previous dashboard cards, reused as slot widgets.
 */
export default function LegacyCardPanel({ widgetId, legacy, highlighted, onAskAI, onRecordClick, onOpenCamera }) {
  const d = legacy || { loading: true };
  const common = { isHighlighted: false, onAskAI };

  let card = null;
  switch (widgetId) {
    case "camera":
      card = <LiveCameraFeedCard {...common} onOpenModal={onOpenCamera} />;
      break;
    case "production":
      card = <FactoryProductionCard {...common} kpis={d.kpis} byFactory={d.byFactory} byProcess={d.byProcess} loading={d.loading} />;
      break;
    case "finance":
      card = <FinanceOverviewCard {...common} kpis={d.kpis} byProcess={d.byProcess} loading={d.loading} />;
      break;
    case "telemetry":
      card = <MachineTelemetryCard {...common} kpis={d.kpis} loading={d.loading} />;
      break;
    case "defects":
      card = <QualityDefectsCard {...common} kpis={d.kpis} issues={d.issues} byProcess={d.byProcess} onRecordClick={onRecordClick} />;
      break;
    case "issues":
      card = <IssuesApprovalsCard {...common} issues={d.issues} recent={d.recent} onRecordClick={onRecordClick} />;
      break;
    default:
      card = null;
  }

  return <div className={`dash-legacy ${highlighted ? "is-highlighted" : ""}`}>{card}</div>;
}
