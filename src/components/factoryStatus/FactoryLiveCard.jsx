import React, { useEffect, useState, useMemo } from 'react';
import { fetchFactoryLiveMachines, BASE_URL } from '../../services/factoryStatusApi';
import DataTable from '../DataTable';
import LiquidSegmentedControl from '../LiquidSegmentedControl';
import CameraModal from '../CameraModal';
import { useLanguage } from '../../contexts/LanguageContext';
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
  const { language } = useLanguage();
  const isJa = language === "ja";
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

    const baseUrlNoSlash = BASE_URL.replace(/\/$/, "");
    const es = new EventSource(`${baseUrlNoSlash}/sse/factory/${encodeURIComponent(factory)}`);

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
      
      let statusText = isJa ? "停止中" : "停止 / IDLE";
      let statusCellClass = "";
      let elapsedText = "";
      let elapsedMs = 0;
      
      if (isCalling) {
        statusText = call.leader
          ? (isJa ? 'リーダー呼出' : 'LEADER CALL')
          : (call.box ? (isJa ? '箱呼出' : 'BOX CALL') : (isJa ? '材料呼出' : 'MATERIAL CALL'));
        statusCellClass = call.leader ? "bg-red-500 text-white font-bold animate-pulse" : 
                          (call.box ? "bg-yellow-400 text-black font-bold animate-pulse" : "bg-blue-500 text-white font-bold animate-pulse");
        elapsedMs = now - call.since;
        elapsedText = fmtWait(elapsedMs);
      } else {
        if (mode === 'running') {
          statusText = isJa ? "稼働中" : "稼働 / RUNNING";
          statusCellClass = "text-emerald-500 font-semibold";
          const prod = (state.prodAccumMs || 0) + (state.runSince ? (now - state.runSince) : 0);
          elapsedMs = prod;
          elapsedText = fmtWait(prod);
        } else if (mode === 'break') {
          statusText = isJa ? "休憩中" : "休憩中 / BREAK";
          statusCellClass = "text-blue-400 font-medium";
          elapsedMs = state.modeSince ? (now - state.modeSince) : 0;
          elapsedText = elapsedMs ? fmtWait(elapsedMs) : '';
        } else if (mode === 'maintenance') {
          statusText = isJa ? "整備中" : "整備中 / MAINTENANCE";
          statusCellClass = "text-amber-500 font-medium";
          elapsedMs = state.modeSince ? (now - state.modeSince) : 0;
          elapsedText = elapsedMs ? fmtWait(elapsedMs) : '';
        } else {
          statusText = isJa ? "停止中" : "停止 / IDLE";
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
  }, [machineRoster, activeCalls, machineState, now, viewMode, isJa]);

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
    <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
            {factory}
          </h3>
          <LiquidSegmentedControl
            items={[
              { label: isJa ? "個別" : "Individual", key: "individual" },
              { label: isJa ? "グループ" : "Grouped", key: "grouped" }
            ]}
            activeKey={viewMode}
            onChange={setViewMode}
            size="sm"
          />
        </div>
        <div className="flex items-center gap-2">
          {(factory === "小瀬" || factory === "倉知") && (
            <button
              onClick={() => setCameraModalOpen(true)}
              className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 mr-1 rounded-[6px] text-xs font-medium border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] active:scale-95 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>videocam</span>
              {isJa ? "ライブ映像" : "View Live Feed"}
            </button>
          )}
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
          <span className="text-xs font-mono font-medium text-[var(--text-secondary)]">
            {isConnected ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>

      {machineRoster.length === 0 ? (
        <div className="text-xs text-[var(--text-muted)] text-center py-8">
          {isJa ? "設備データを待機中..." : "Waiting for machine data..."}
        </div>
      ) : (
        <DataTable
          columns={[
            { key: "machine", label: isJa ? "設備名" : "Machine Name", sortable: true, cellClassName: "font-semibold text-xs text-[var(--text-primary)]" },
            { 
              key: "status", 
              label: isJa ? "ステータス" : "Status", 
              sortable: true,
              cellClassName: (r) => r.statusCellClass,
              renderCell: (r) => r.statusText
            },
            { 
              key: "totalNG", 
              label: isJa ? "不良数" : "Defect Count", 
              sortable: true,
              renderCell: (r) => r.totalNG > 0 ? <span className="text-red-500 font-bold font-mono freya-tabular text-xs">{r.totalNG}</span> : <span className="text-[var(--text-muted)] font-mono freya-tabular text-xs">0</span>
            },
            { 
              key: "elapsed", 
              label: isJa ? "稼働時間" : "Running Time", 
              sortable: true,
              cellClassName: "font-mono freya-tabular text-xs",
              renderCell: (r) => r.elapsedText || "-"
            },
            { key: "sebanggo", label: isJa ? "背番号" : "Serial No.", sortable: true, cellClassName: "font-mono text-xs", renderCell: (r) => r.sebanggo || "-" },
            { key: "hinban", label: isJa ? "品番" : "Part No.", sortable: true, cellClassName: "font-mono text-xs", renderCell: (r) => r.hinban || "-" }
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
          getRowClassName={() => "cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"}
          layoutStorageKey={`live-monitor-${factory}`}
          enableColumnResize={true}
          enableColumnReorder={true}
          hidePagination={true}
        />
      )}

      {cameraModalOpen && (
        <CameraModal onClose={() => setCameraModalOpen(false)} factory={factory} />
      )}
    </div>
  );
}
