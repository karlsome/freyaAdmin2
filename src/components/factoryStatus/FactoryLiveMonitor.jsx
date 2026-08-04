import React from 'react';
import FactoryLiveCard from './FactoryLiveCard';

export default function FactoryLiveMonitor({ factories, onMachineClick }) {
  if (!factories || factories.length === 0) {
    return (
      <div className="bg-surface-container rounded-3xl p-12 text-center border border-outline-variant">
        <h3 className="text-2xl font-bold text-on-surface mb-2">No Factories Selected</h3>
        <p className="text-on-surface-variant">
          Please select at least one factory from the filters above to view the live monitor.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {factories.map(factory => (
        <FactoryLiveCard key={factory} factory={factory} onRowClick={onMachineClick} />
      ))}
    </div>
  );
}
