import React from 'react';
import FactoryLiveCard from './FactoryLiveCard';

export default function FactoryLiveMonitor({ factories, onMachineClick }) {
  if (!factories || factories.length === 0) {
    return (
      <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">No Factories Selected</h3>
        <p className="text-xs text-[var(--text-muted)]">
          Please select at least one factory from the filters above to view the live monitor.
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
