import React, { useEffect, useState, useMemo } from 'react';
import { fetchFactoryLiveMachines } from '../../services/factoryStatusApi';
import DataTable from '../DataTable';
import LiquidSegmentedControl from '../LiquidSegmentedControl';
import CameraModal from '../CameraModal';
import './FactoryLiveMonitor.css';

function fmtWait(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p = n => String(n).padStart(2, '0');
  return h > 0 ? `${p(h)}:${p(m)}:${p(ss)}` : `${p(m)}:${p(ss)}`;
}

export default function FactoryLiveCard({ factory, onRowClick }) {
  const [machineState, setMachineState] = useState(new Map());
  const [activeCalls, setActiveCalls] = useState([]);
  const [masterMachines, setMasterMachines] = useState([]);
  const [now, setNow] = useState(() => Date.now());
  const [isConnected, setIsConnected] = useState(false);
  const [sort, setSort] = useState(null);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem(`factoryLiveMonitor_viewMode_${factory}`) || 'individual';
  });

  useEffect(() => {
    localStorage.setItem(`factoryLiveMonitor_viewMode_${factory}`, viewMode);
  }, [viewMode, factory]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!factory) return;
    
    let mounted = true;
    fetchFactoryLiveMachines(factory).then(res => {
      if (mounted && res && res.machines) {
        setMasterMachines(res.machines);
      }
    }).catch(err => console.error("Failed to load master machines", err));

    return () => { mounted = false; };
  }, [factory]);

  useEffect(() => {
    if (!factory) return;

    // Temporarily hardcode to onrender to see live data
    const PROD_URL = "https://kurachi.onrender.com";
    const es = new EventSource(`${PROD_URL}/sse/factory/${encodeURIComponent(factory)}`);

    es.onopen = () => setIsConnected(true);
    es.onerror = () => setIsConnected(false);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'connected') {
          setIsConnected(true);
        } else if (data.type === 'stopcall') {
          setActiveCalls(data.active || []);
        } else if (data.type === 'machine_state') {
          setMachineState(prevMap => {
            const newMap = new Map(prevMap);
            (data.machines || []).forEach(m => {
              newMap.set(m.equipment, { ...m });
            });
            return newMap;
          });
        }
      } catch (err) {
        console.error("Error parsing SSE data", err);
      }
    };

    return () => {
      es.close();
      setIsConnected(false);
    };
  }, [factory]);

  const machineRoster = useMemo(() => {
    const roster = masterMachines.map(m => m.name);
    const set = new Set(roster);
    for (const key of machineState.keys()) set.add(key);
    activeCalls.forEach(call => set.add(call.machine));
    
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [masterMachines, machineState, activeCalls]);

  const tableRows = useMemo(() => {
    // Determine which machines to show based on viewMode
    let displayMachines = [];
    if (viewMode === 'individual') {
      displayMachines = machineRoster.filter(m => !m.includes(','));
    } else {
      // Grouped mode
      const groups = machineRoster.filter(m => m.includes(','));
      const constituentsToHide = new Set();
      groups.forEach(g => {
        g.split(',').forEach(c => constituentsToHide.add(c.trim()));
      });
      displayMachines = machineRoster.filter(m => !constituentsToHide.has(m));
    }
    
    // Create a mapping from individual machine to its grouped name (if any)
    const groupedNamesByConstituent = {};
    machineRoster.filter(m => m.includes(',')).forEach(g => {
      g.split(',').forEach(c => {
        groupedNamesByConstituent[c.trim()] = g;
      });
    });

    return displayMachines.map(machine => {
      let activeMachineForData = machine;
      let isCalling = false;
      let call = null;
      
      let dbEquipmentName = machine;
      if (viewMode === 'individual' && groupedNamesByConstituent[machine]) {
        dbEquipmentName = groupedNamesByConstituent[machine];
      }
      
      // If it's a grouped machine and doesn't have explicit state, borrow state from its first constituent
      if (machine.includes(',') && !machineState.has(machine)) {
        const constituents = machine.split(',').map(c => c.trim());
        activeMachineForData = constituents[0];
        
        // Find ALL active calls for this group's constituents
        const constituentCalls = activeCalls.filter(c => constituents.includes(c.machine));
        if (constituentCalls.length > 0) {
          isCalling = true;
          // Alternate them every second based on `now` timestamp
          const callIndex = Math.floor(now / 1000) % constituentCalls.length;
          call = constituentCalls[callIndex];
        }
      } else {
        const callIdx = activeCalls.findIndex(c => c.machine === activeMachineForData);
        isCalling = callIdx >= 0;
        call = isCalling ? activeCalls[callIdx] : null;
      }

      const state = machineState.get(activeMachineForData) || { mode: 'idle', totalNG: 0 };
      const mode = state.mode || 'idle';
      
      let statusText = "停止 / IDLE";
      let statusCellClass = "";
      let elapsedText = "";
      let elapsedMs = 0;
      
      if (isCalling) {
        statusText = call.leader ? 'LEADER CALL' : (call.box ? 'BOX CALL' : 'MATERIAL CALL');
        statusCellClass = call.leader ? "bg-red-500 text-white font-bold animate-pulse" : 
                          (call.box ? "bg-yellow-400 text-black font-bold animate-pulse" : "bg-blue-500 text-white font-bold animate-pulse");
        elapsedMs = now - call.since;
        elapsedText = fmtWait(elapsedMs);
      } else {
        if (mode === 'running') {
          statusText = "稼働 / RUNNING";
          statusCellClass = "text-emerald-500 font-semibold";
          const prod = (state.prodAccumMs || 0) + (state.runSince ? (now - state.runSince) : 0);
          elapsedMs = prod;
          elapsedText = fmtWait(prod);
        } else if (mode === 'break') {
          statusText = "休憩中 / BREAK";
          statusCellClass = "text-blue-400 font-medium";
          elapsedMs = state.modeSince ? (now - state.modeSince) : 0;
          elapsedText = elapsedMs ? fmtWait(elapsedMs) : '';
        } else if (mode === 'maintenance') {
          statusText = "整備中 / MAINTENANCE";
          statusCellClass = "text-amber-500 font-medium";
          elapsedMs = state.modeSince ? (now - state.modeSince) : 0;
          elapsedText = elapsedMs ? fmtWait(elapsedMs) : '';
        } else {
          statusText = "停止 / IDLE";
          statusCellClass = "text-on-surface-variant";
        }
      }

      return {
        id: machine,
        machine,
        dbEquipmentName,
        statusText,
        statusCellClass,
        totalNG: state.totalNG || 0,
        elapsedText,
        elapsedMs,
        sebanggo: state.sebanggo,
        hinban: state.hinban
      };
    });
  }, [machineRoster, activeCalls, machineState, now, viewMode]);

  const sortedRows = useMemo(() => {
    let sorted = [...tableRows];
    if (sort) {
      sorted.sort((a, b) => {
        let valA = a[sort.column];
        let valB = b[sort.column];
        
        if (sort.column === 'elapsed') { valA = a.elapsedMs; valB = b.elapsedMs; }
        if (sort.column === 'status') { valA = a.statusText; valB = b.statusText; }
        
        if (valA == null) valA = '';
        if (valB == null) valB = '';

        if (valA < valB) return sort.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sorted;
  }, [tableRows, sort]);

  return (
    <div className="bg-surface-container rounded-2xl border border-outline-variant p-5 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-xl font-bold text-on-surface flex items-center gap-2">
            {factory}
          </h3>
          <LiquidSegmentedControl
            items={[
              { label: "Individual", key: "individual" },
              { label: "Grouped", key: "grouped" }
            ]}
            activeKey={viewMode}
            onChange={setViewMode}
            size="sm"
          />
        </div>
        <div className="flex items-center gap-2">
          {factory === "小瀬" && (
            <button
              onClick={() => setCameraModalOpen(true)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 mr-2 rounded-xl text-xs font-semibold border border-outline-variant/30 bg-surface text-on-surface hover:bg-surface-container hover:border-primary/30 hover:text-primary active:scale-95 transition-all duration-150"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>videocam</span>
              View Live Feed
            </button>
          )}
          <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'}`}></div>
          <span className="text-sm font-semibold text-on-surface-variant">
            {isConnected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {machineRoster.length === 0 ? (
        <div className="text-on-surface-variant text-center py-8">
          Waiting for machine data...
        </div>
      ) : (
        <DataTable
          columns={[
            { key: "machine", label: "Machine Name", sortable: true, cellClassName: "font-semibold" },
            { 
              key: "status", 
              label: "Status", 
              sortable: true,
              cellClassName: (r) => r.statusCellClass,
              renderCell: (r) => r.statusText
            },
            { 
              key: "totalNG", 
              label: "Defect Count", 
              sortable: true,
              renderCell: (r) => r.totalNG > 0 ? <span className="text-red-500 font-bold">{r.totalNG}</span> : <span className="text-on-surface-variant">0</span>
            },
            { 
              key: "elapsed", 
              label: "Running Time", 
              sortable: true,
              cellClassName: "font-mono",
              renderCell: (r) => r.elapsedText || "-"
            },
            { key: "sebanggo", label: "背番号", sortable: true, renderCell: (r) => r.sebanggo || "-" },
            { key: "hinban", label: "品番", sortable: true, renderCell: (r) => r.hinban || "-" }
          ]}
          rows={sortedRows}
          sort={sort}
          onSort={(colKey) => setSort((prev) => {
            if (prev && prev.column === colKey) {
              if (prev.direction === "asc") return { column: colKey, direction: "desc" };
              return null;
            }
            return { column: colKey, direction: "asc" };
          })}
          onRowClick={(row) => onRowClick && onRowClick(factory, row.dbEquipmentName)}
          getRowClassName={() => "cursor-pointer hover:bg-surface-container-high transition-colors"}
          layoutStorageKey={`live-monitor-${factory}`}
          enableColumnResize={true}
          enableColumnReorder={true}
          hidePagination={true}
        />
      )}

      {cameraModalOpen && (
        <CameraModal onClose={() => setCameraModalOpen(false)} />
      )}
    </div>
  );
}
