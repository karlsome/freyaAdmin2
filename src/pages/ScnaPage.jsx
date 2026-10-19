import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import MasterTabNav from "../components/MasterTabNav";
import PageHeader from "../components/PageHeader";
import ScnaFreyaTabletTab from "../components/scna/ScnaFreyaTabletTab";
import ScnaMachineAnalyticsTab from "../components/scna/ScnaMachineAnalyticsTab";
import ScnaWorkOrderTab from "../components/scna/ScnaWorkOrderTab";

const SCNA_TABS = [
  {
    key: "freyaTablet",
    icon: "tablet_mac",
    label: "Freya Tablet",
    labelEn: "Freya Tablet",
    labelJa: "Freya Tablet",
  },
  {
    key: "workOrder",
    icon: "assignment",
    label: "Work Order",
    labelEn: "Work Order",
    labelJa: "ワークオーダー",
  },
  {
    key: "analytics",
    icon: "analytics",
    label: "Analytics",
    labelEn: "Analytics",
    labelJa: "分析",
  },
];

function FlashBanner({ flash, onClose }) {
  if (!flash) return null;

  const tone =
    flash.type === "error"
      ? "border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 text-[var(--status-danger)]"
      : flash.type === "warning"
        ? "border-[var(--status-warning)]/30 bg-[var(--status-warning)]/10 text-[var(--status-warning)]"
        : "border-[var(--status-normal)]/30 bg-[var(--status-normal)]/10 text-[var(--status-normal)]";

  return (
    <div
      className={`mb-6 rounded-[8px] border px-4 py-3 freya-card shadow-sm ${tone}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.04em]">
            Status
          </p>
          <p className="mt-0.5 text-xs font-medium">{flash.message}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-current/70 transition hover:text-current"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            close
          </span>
        </button>
      </div>
    </div>
  );
}

export default function ScnaPage() {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const navigate = useNavigate();
  const { tab } = useParams();

  const validTabs = new Set(SCNA_TABS.map((t) => t.key));
  const activeTab = validTabs.has(tab) ? tab : "freyaTablet";
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    if (!flash) return undefined;
    const timer = window.setTimeout(() => setFlash(null), 5000);
    return () => window.clearTimeout(timer);
  }, [flash]);

  function handleTabChange(nextTabKey) {
    if (nextTabKey === "freyaTablet") {
      navigate("/scna");
    } else {
      navigate(`/scna/${nextTabKey}`);
    }
  }

  return (
    <section className="w-full h-screen overflow-y-auto space-y-6 pt-20 px-4 sm:px-6 md:px-8 pb-16">
      <div className="w-full">
        <PageHeader
          eyebrow="SCNA"
          eyebrowClassName="tracking-[0.18em] text-[var(--freya-blue)]"
          title={isJa ? "SCNA管理" : "SCNA Management"}
          subtitle={
            isJa
              ? "サプライチェーンネットワーク分析とワークオーダー管理"
              : "Supply Chain Network Analytics & Work Order Management"
          }
          className="mb-6"
        />

        <MasterTabNav
          tabs={SCNA_TABS}
          activeTab={activeTab}
          onChange={handleTabChange}
        />

        <FlashBanner flash={flash} onClose={() => setFlash(null)} />

        {activeTab === "freyaTablet" && (
          <ScnaFreyaTabletTab onFlash={setFlash} />
        )}
        {activeTab === "workOrder" && (
          <ScnaWorkOrderTab onFlash={setFlash} />
        )}
        {activeTab === "analytics" && (
          <ScnaMachineAnalyticsTab onFlash={setFlash} />
        )}
      </div>
    </section>
  );
}

