import React from 'react';
import FactoryLiveCard from './FactoryLiveCard';
import { useLanguage } from '../../contexts/LanguageContext';

export default function FactoryLiveMonitor({ factories, onMachineClick }) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  if (!factories || factories.length === 0) {
    return (
      <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">
          {isJa ? "工場が選択されていません" : "No Factories Selected"}
        </h3>
        <p className="text-xs text-[var(--text-muted)]">
          {isJa ? "ライブモニターを表示するには、上のフィルターから1つ以上の工場を選択してください。" : "Please select at least one factory from the filters above to view the live monitor."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {factories.map(factory => (
        <FactoryLiveCard key={factory} factory={factory} onRowClick={onMachineClick} />
      ))}
    </div>
  );
}
