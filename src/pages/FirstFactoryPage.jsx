import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../contexts/LanguageContext';
import MasterTabNav from '../components/MasterTabNav';

export default function FirstFactoryPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('fetching'); // 'fetching' | 'scheduling'
  
  const [data, setData] = useState([]);
  const [savedSchedules, setSavedSchedules] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 30;

  // We need a selected Date for the scheduling tab
  // Default to today in local timezone
  const getLocalYYYYMMDD = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  };
  
  const [selectedDateStr, setSelectedDateStr] = useState(getLocalYYYYMMDD());
  
  // Extract month (YYYY-MM) and day (1-31) from selectedDateStr
  const selectedMonth = selectedDateStr.substring(0, 7);
  const selectedDay = parseInt(selectedDateStr.substring(8, 10), 10);

  const handleMonthChange = (e) => {
    const newMonth = e.target.value;
    if (!newMonth) return;
    const parts = selectedDateStr.split('-');
    let day = parts[2];
    if (parseInt(day, 10) > 28) day = '01'; // Safe fallback for shortest month
    setSelectedDateStr(`${newMonth}-${day}`);
  };

  const fetchSchedule = async (month) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:3000/api/production/schedule?month=${month}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setSavedSchedules(json.schedules || []);
      }
    } catch (err) {
      console.error('Error fetching schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch when month changes
  useEffect(() => {
    fetchSchedule(selectedMonth);
  }, [selectedMonth]);

  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncTargetMonth, setSyncTargetMonth] = useState(selectedMonth);

  const handleSyncExcel = async (monthToSync) => {
    setIsSyncModalOpen(false);
    setSyncing(true);
    try {
      const res = await fetch('http://localhost:3000/api/production/sync-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: monthToSync })
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        if (monthToSync === selectedMonth) {
          fetchSchedule(selectedMonth);
        }
      } else {
        alert('Sync failed: ' + json.message);
      }
    } catch (err) {
      console.error('Error syncing:', err);
      alert('Error connecting to backend');
    } finally {
      setSyncing(false);
    }
  };

  const lastSynced = useMemo(() => {
    if (data.length > 0 && data[0].syncedAt) {
      return new Date(data[0].syncedAt).toLocaleString();
    }
    return null;
  }, [data]);

  const filteredData = data.filter(item => item.hinban.toLowerCase().includes(filter.toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filteredData.length / ITEMS_PER_PAGE));
  const currentData = filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleFilterChange = (e) => {
    setFilter(e.target.value);
    setCurrentPage(1);
  };

  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  // --- SCHEDULING LOGIC ---
  
  // Get the saved schedule for the current date
  const currentSavedSchedule = useMemo(() => {
    return savedSchedules.find(s => s.date === selectedDay) || { scheduleOrder: [] };
  }, [savedSchedules, selectedDay]);

  const [scheduleOrder, setScheduleOrder] = useState([]);
  const [startTime, setStartTime] = useState('09:00');
  
  const [modalData, setModalData] = useState(null);
  const [materialDetailOpen, setMaterialDetailOpen] = useState(false);

  const handleCardClick = (hinban) => {
    const found = data.find(i => i.hinban === hinban);
    if (found && found.materialInfo && found.materialInfo.rawMaster) {
      setModalData(found.materialInfo.rawMaster);
      setMaterialDetailOpen(false);
    }
  };
  
  // Whenever selected day or saved schedules change, reset our local schedule order
  useEffect(() => {
    setScheduleOrder(currentSavedSchedule.scheduleOrder || []);
    setStartTime(currentSavedSchedule.startTime || '09:00');
  }, [currentSavedSchedule]);

  const hasUnsavedChanges = useMemo(() => {
    const original = currentSavedSchedule.scheduleOrder || [];
    if (original.length !== scheduleOrder.length) return true;
    for (let i = 0; i < original.length; i++) {
      if (original[i].id !== scheduleOrder[i].id) return true;
    }
    if ((currentSavedSchedule.startTime || '09:00') !== startTime) return true;
    return false;
  }, [currentSavedSchedule, scheduleOrder, startTime]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = ''; // Required for some browsers
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    if (hasUnsavedChanges) {
      if (!window.confirm(t('unsavedChangesWarning') || "You have unsaved changes! Are you sure you want to change the date? Unsaved progress will be lost.")) {
        return;
      }
    }
    setSelectedDateStr(newDate);
  };

  const handleTabChange = (tab) => {
    if (activeTab === 'scheduling' && tab !== 'scheduling' && hasUnsavedChanges) {
      if (!window.confirm(t('unsavedChangesWarning') || "You have unsaved changes! Are you sure you want to switch tabs? Unsaved progress will be lost.")) {
        return;
      }
    }
    setActiveTab(tab);
  };

  // Items that have production > 0 for this day
  const dailyProductionItems = useMemo(() => {
    return data.filter(item => {
      const prod = item.production[selectedDay - 1] || 0;
      return prod > 0;
    });
  }, [data, selectedDay]);

  // Split into Pool and Scheduled
  const scheduledItems = scheduleOrder;

  const [poolSearch, setPoolSearch] = useState('');
  const [showNoAdhesive, setShowNoAdhesive] = useState(false);
  
  const poolItems = useMemo(() => {
    const scheduledIds = new Set(scheduleOrder.map(s => s.poolItemId).filter(Boolean));
    return dailyProductionItems.filter(item => {
      if (scheduledIds.has(item.id)) return false;
      if (poolSearch && !item.hinban.toLowerCase().includes(poolSearch.toLowerCase())) return false;
      
      if (!showNoAdhesive) {
        const segments = item.materialInfo?.rawMaster?.['品番構造']?.segments || [];
        const adhesiveSegment = segments.find(s => s.segment === '粘着コード');
        if (adhesiveSegment && adhesiveSegment.name === '粘着無し') {
          return false;
        }
      }
      
      return true;
    });
  }, [scheduleOrder, dailyProductionItems, poolSearch, showNoAdhesive]);

  const poolTotalMins = useMemo(() => {
    return poolItems.reduce((acc, item) => {
      const qty = item.production[selectedDay - 1] || 0;
      const qtyCm = qty * 100;
      const workTime = item.materialInfo?.workTime || 0.075;
      return acc + Math.round((workTime * qtyCm) / 60);
    }, 0);
  }, [poolItems, selectedDay]);

  const scheduledTotalMins = useMemo(() => {
    return scheduledItems.reduce((acc, item) => acc + (item.duration || 0), 0);
  }, [scheduledItems]);

  const formatTime = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const handleSaveSchedule = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/production/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          scheduleOrder,
          startTime, 
          month: selectedMonth, 
          date: selectedDay 
        })
      });
      const json = await res.json();
      if (json.success) {
        alert('Schedule order saved successfully for ' + selectedDateStr);
        fetchSchedule(selectedMonth); // Refresh
      }
    } catch (err) {
      console.error('Error saving order:', err);
    }
  };

  // HTML5 Drag and Drop for Scheduling
  const onDragStartSchedule = (e, dragData, source) => {
    e.dataTransfer.setData('dragData', JSON.stringify(dragData));
    e.dataTransfer.setData('source', source); // 'pool' or 'scheduled'
  };

  const onDropPool = (e) => {
    e.preventDefault();
    const source = e.dataTransfer.getData('source');
    if (source === 'scheduled') {
      const dragData = JSON.parse(e.dataTransfer.getData('dragData'));
      // Remove from scheduled
      setScheduleOrder(prev => {
        if (dragData.type === 'hinban') {
           // Remove all rolls for this hinban
           return prev.filter(i => i.hinban !== dragData.hinban);
        } else {
           // Remove specific setup item
           return prev.filter(i => i.id !== dragData.id);
        }
      });
    }
  };

  const onDropScheduled = (e, targetIndex = -1) => {
    e.preventDefault();
    const source = e.dataTransfer.getData('source');
    if (!source) return;
    
    const dragData = JSON.parse(e.dataTransfer.getData('dragData'));
    
    setScheduleOrder(prev => {
      const newOrder = [...prev];
      
      if (source === 'scheduled') {
        const currentIndex = newOrder.findIndex(i => i.id === dragData.id);
        if (currentIndex !== -1) {
          const [removed] = newOrder.splice(currentIndex, 1);
          if (targetIndex === -1) {
            newOrder.push(removed);
          } else {
            // Adjust target index if we removed from earlier in the array
            const adjustedTarget = targetIndex > currentIndex ? targetIndex - 1 : targetIndex;
            newOrder.splice(adjustedTarget, 0, removed);
          }
        }
      } else if (source === 'pool') {
        let itemsToInsert = [];
        
        if (dragData.type === 'setup') {
          itemsToInsert.push({
            id: Date.now() + Math.random().toString(),
            type: 'setup',
            name: dragData.name,
            duration: 15
          });
        } else if (dragData.type === 'pool-hinban') {
          const found = data.find(i => i.id === dragData.id);
          if (found) {
             const qty = found.production[selectedDay - 1] || 0;
             const qtyCm = qty * 100;
             const packCountCm = found.materialInfo?.packCount || 4000;
             const workTime = found.materialInfo?.workTime || 0.075;
             
             if (qtyCm > 0) {
               const numRolls = Math.ceil(qtyCm / packCountCm);
               for (let i = 0; i < numRolls; i++) {
                 let lengthCm = packCountCm;
                 if (i === numRolls - 1 && (qtyCm % packCountCm !== 0)) {
                   lengthCm = qtyCm % packCountCm;
                 }
                 const durationMins = (workTime * lengthCm) / 60;
                 itemsToInsert.push({
                   id: Date.now() + String(i) + Math.random().toString(),
                   type: 'hinban',
                   hinban: dragData.hinban,
                   poolItemId: dragData.id,
                   rollIndex: i + 1,
                   totalRolls: numRolls,
                   meters: lengthCm / 100,
                   duration: Math.round(durationMins)
                 });
               }
             }
          }
        }
        
        if (targetIndex === -1) {
          newOrder.push(...itemsToInsert);
        } else {
          newOrder.splice(targetIndex, 0, ...itemsToInsert);
        }
      }
      return newOrder;
    });
  };

  const handleAddToSchedule = (dragData) => {
    setScheduleOrder(prev => {
      const newOrder = [...prev];
      let itemsToInsert = [];
      
      if (dragData.type === 'setup') {
        itemsToInsert.push({
          id: Date.now() + Math.random().toString(),
          type: 'setup',
          name: dragData.name,
          duration: 15
        });
      } else if (dragData.type === 'pool-hinban') {
        const found = data.find(i => i.id === dragData.id);
        console.log("handleAddToSchedule for:", dragData.hinban, "found:", !!found);
        if (found) {
           const qty = found.production[selectedDay - 1] || 0;
           const qtyCm = qty * 100;
           const packCountCm = found.materialInfo?.packCount || 4000;
           const workTime = found.materialInfo?.workTime || 0.075;
           
           console.log("Metrics:", { qty, qtyCm, packCountCm, workTime });
           
           if (qtyCm > 0) {
             const numRolls = Math.ceil(qtyCm / packCountCm);
             console.log("numRolls:", numRolls);
             for (let i = 0; i < numRolls; i++) {
               let lengthCm = packCountCm;
               if (i === numRolls - 1 && (qtyCm % packCountCm !== 0)) {
                 lengthCm = qtyCm % packCountCm;
               }
               const durationMins = (workTime * lengthCm) / 60;
               itemsToInsert.push({
                 id: Date.now() + String(i) + Math.random().toString(),
                 type: 'hinban',
                 hinban: dragData.hinban,
                 poolItemId: dragData.id,
                 rollIndex: i + 1,
                 totalRolls: numRolls,
                 meters: lengthCm / 100,
                 duration: Math.round(durationMins)
               });
             }
             console.log("itemsToInsert count:", itemsToInsert.length);
           } else {
             console.log("qtyCm is 0 or less, not adding.");
           }
        }
      }
      
      newOrder.push(...itemsToInsert);
      return newOrder;
    });
  };

  const handleRemoveFromSchedule = (dragData) => {
      setScheduleOrder(prev => {
        if (dragData.type === 'hinban') {
           return prev.filter(i => i.hinban !== dragData.hinban);
        } else {
           return prev.filter(i => i.id !== dragData.id);
        }
      });
  };

  const computeTimeSchedule = (items, startTimeStr) => {
     let current = new Date(`2000-01-01T${startTimeStr}:00`);
     if (isNaN(current.getTime())) current = new Date(`2000-01-01T09:00:00`);
     
     return items.map(item => {
        const start = current.toTimeString().substring(0, 5);
        current = new Date(current.getTime() + item.duration * 60000);
        const end = current.toTimeString().substring(0, 5);
        return { ...item, startTime: start, endTime: end };
     });
  };
  
  const scheduleWithTimes = computeTimeSchedule(scheduledItems, startTime);

  return (
    <div className="p-6 pt-24 pb-24 overflow-y-auto h-screen">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">{t('firstFactory')}</h1>
          <p className="mt-1 text-sm text-outline">Manage schedule and priorities</p>
        </div>
        <div className="flex items-center gap-4">
          {lastSynced && (
            <div className="text-xs text-outline text-right">
              <span className="block font-medium">Last Synced:</span>
              <span>{lastSynced}</span>
            </div>
          )}
          <button 
            onClick={() => {
              setSyncTargetMonth(selectedMonth);
              setIsSyncModalOpen(true);
            }}
            disabled={syncing}
            className="flex items-center gap-2 rounded-xl border border-primary/30 px-4 py-2 text-sm font-semibold text-primary transition-all hover:bg-primary/5 disabled:opacity-50"
          >
            <span className={`material-symbols-outlined ${syncing ? 'animate-spin' : ''}`} style={{ fontSize: 20 }}>sync</span>
            {syncing ? 'Syncing...' : 'Sync Excel'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <MasterTabNav 
        tabs={[
          { key: 'fetching', label: 'Data Fetching', ready: true },
          { key: 'scheduling', label: 'Scheduling', ready: true }
        ]}
        activeTab={activeTab}
        onSelect={(tab) => handleTabChange(tab.key)}
      />

      {activeTab === 'fetching' && (
        <>
          <div className="mb-6 rounded-2xl border border-outline-variant/30 bg-surface/50 p-4 backdrop-blur-xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-outline" style={{ fontSize: 20 }}>calendar_month</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={handleMonthChange}
                  className="rounded-xl border border-outline-variant/50 bg-background/50 px-3 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                  title="Select month to view"
                />
              </div>
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
                <input
                  type="text"
                  placeholder={t('search')}
                  className="w-full rounded-xl border border-outline-variant/50 bg-background/50 py-2.5 pl-10 pr-4 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  value={filter}
                  onChange={handleFilterChange}
                />
              </div>
              <button className="flex items-center gap-2 rounded-xl border border-outline-variant/50 px-4 py-2.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-variant/50">
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>filter_list</span>
                {t('filter')}
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-on-surface">
                <thead className="bg-surface-variant/30 text-xs uppercase text-outline">
                  <tr>
                    <th className="sticky left-0 z-10 bg-surface px-4 py-3 min-w-[200px]">Hinban</th>
                    <th className="sticky left-[200px] z-10 bg-surface px-4 py-3 min-w-[80px]">Type</th>
                    {days.map(day => (
                      <th key={day} className="px-2 py-3 text-center min-w-[40px]">{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={33} className="px-4 py-8 text-center text-outline">{t('loading')}</td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={33} className="px-4 py-8 text-center text-outline">
                        {filter ? t('noData') : `No data fetched yet for ${selectedMonth}. Please sync from Excel.`}
                      </td>
                    </tr>
                  ) : (
                    currentData.map((item) => (
                      <React.Fragment key={item.id}>
                        {/* Orders Row */}
                        <tr className="border-t border-outline-variant/20 hover:bg-surface-variant/20">
                          <td className="sticky left-0 bg-surface px-4 py-2 font-medium" rowSpan={2}>
                            {item.hinban}
                          </td>
                          <td className="sticky left-[200px] bg-surface px-4 py-2 text-primary font-semibold text-xs border-r border-outline-variant/20">
                            受注
                          </td>
                          {item.orders.map((val, i) => (
                            <td key={i} className="px-2 py-2 text-center text-xs border-r border-outline-variant/20">{val}</td>
                          ))}
                        </tr>
                        {/* Production Row */}
                        <tr className="border-b border-outline-variant/20 hover:bg-surface-variant/20">
                          <td className="sticky left-[200px] bg-surface px-4 py-2 text-[#006064] dark:text-[#4dd0e1] font-semibold text-xs border-r border-outline-variant/20">
                            生産
                          </td>
                          {item.production.map((val, i) => (
                            <td key={i} className="px-2 py-2 text-center text-xs border-r border-outline-variant/20">{val}</td>
                          ))}
                        </tr>
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between px-2">
              <div className="text-sm text-outline">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length)} of {filteredData.length} entries
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center justify-center rounded-lg border border-outline-variant/50 p-2 text-on-surface hover:bg-surface-variant/50 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chevron_left</span>
                </button>
                <span className="text-sm font-medium text-on-surface px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center justify-center rounded-lg border border-outline-variant/50 p-2 text-on-surface hover:bg-surface-variant/50 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'scheduling' && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between rounded-2xl border border-outline-variant/30 bg-surface/50 p-4 backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-on-surface">Select Date:</span>
              <input 
                type="date" 
                value={selectedDateStr}
                onChange={handleDateChange}
                className="rounded-xl border border-outline-variant/50 bg-background/50 px-4 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <button 
              onClick={handleSaveSchedule}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>save</span>
              Save Daily Schedule
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pool Column */}
            <div 
              className="flex flex-col rounded-2xl border border-outline-variant/30 bg-surface p-4 min-h-[500px]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDropPool}
            >
              <div className="mb-4">
                <h3 className="mb-2 text-lg font-bold text-on-surface flex items-center justify-between">
                  Available to Schedule
                  <div className="flex items-center gap-3">
                    <span className="rounded bg-primary/10 px-2 py-1 text-xs font-bold text-primary shadow-sm border border-primary/20">
                      {formatTime(poolTotalMins)}
                    </span>
                    <button 
                      onClick={() => setShowNoAdhesive(!showNoAdhesive)}
                      className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border transition-colors ${showNoAdhesive ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant/50 text-outline hover:bg-surface-variant/50'}`}
                      title={showNoAdhesive ? "Hide raw materials (粘着無し)" : "Show raw materials (粘着無し)"}
                    >
                      <span className="material-symbols-outlined" style={{fontSize: 16}}>
                        {showNoAdhesive ? 'visibility' : 'visibility_off'}
                      </span>
                      {showNoAdhesive ? 'Hide 粘着無し' : 'Show 粘着無し'}
                    </button>
                    <span className="text-sm font-normal text-outline">{poolItems.length} items</span>
                  </div>
                </h3>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" style={{ fontSize: 18 }}>search</span>
                  <input
                    type="text"
                    placeholder="Search available..."
                    className="w-full rounded-xl border border-outline-variant/50 bg-background/50 py-2 pl-9 pr-3 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    value={poolSearch}
                    onChange={(e) => setPoolSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
                {/* Static setup items */}
                <div className="flex gap-2 mb-4 pb-4 border-b border-outline-variant/30">
                   <div 
                     draggable
                     onDragStart={(e) => onDragStartSchedule(e, { type: 'setup', name: '段取り' }, 'pool')}
                     className="cursor-grab flex-1 rounded-xl border border-dashed border-primary/50 bg-primary/5 p-3 flex items-center justify-between hover:border-primary transition-colors text-primary font-bold text-sm"
                   >
                     <span>段取り (15m)</span>
                     <button 
                       onClick={() => handleAddToSchedule({ type: 'setup', name: '段取り' })}
                       className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-primary/20 text-primary transition-colors"
                     >
                       <span className="material-symbols-outlined" style={{fontSize: 16}}>arrow_forward</span>
                     </button>
                   </div>
                   <div 
                     draggable
                     onDragStart={(e) => onDragStartSchedule(e, { type: 'setup', name: '段替え' }, 'pool')}
                     className="cursor-grab flex-1 rounded-xl border border-dashed border-primary/50 bg-primary/5 p-3 flex items-center justify-between hover:border-primary transition-colors text-primary font-bold text-sm"
                   >
                     <span>段替え (15m)</span>
                     <button 
                       onClick={() => handleAddToSchedule({ type: 'setup', name: '段替え' })}
                       className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-primary/20 text-primary transition-colors"
                     >
                       <span className="material-symbols-outlined" style={{fontSize: 16}}>arrow_forward</span>
                     </button>
                   </div>
                </div>

                {poolItems.length === 0 ? (
                  <div className="text-center text-sm text-outline mt-10">No items available for this date.</div>
                ) : (
                  poolItems.map(item => {
                    const qty = item.production[selectedDay - 1] || 0;
                    const qtyCm = qty * 100;
                    const packCountCm = item.materialInfo?.packCount || 4000;
                    const workTime = item.materialInfo?.workTime || 0.075;
                    const numRolls = qtyCm > 0 ? Math.ceil(qtyCm / packCountCm) : 0;
                    const durationMins = Math.round((workTime * qtyCm) / 60);
                    const segments = item.materialInfo?.rawMaster?.['品番構造']?.segments || [];
                    const adhesiveSegment = segments.find(s => s.segment === '粘着コード');
                    const isRawMaterial = adhesiveSegment && adhesiveSegment.name === '粘着無し';

                    return (
                    <div 
                      key={item.id}
                      draggable
                      onDragStart={(e) => onDragStartSchedule(e, { type: 'pool-hinban', hinban: item.hinban, id: item.id }, 'pool')}
                      className={`cursor-grab active:cursor-grabbing rounded-xl border p-3 flex items-center gap-3 transition-colors ${
                        isRawMaterial 
                          ? 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/60' 
                          : 'border-outline-variant/30 bg-background hover:border-primary/50'
                      }`}
                    >
                      <div className="flex-1 flex flex-col cursor-pointer" onClick={() => handleCardClick(item.hinban)}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-on-surface">{item.hinban}</span>
                          {isRawMaterial && (
                            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 uppercase tracking-wider">
                              Raw Material
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-outline">
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 font-bold text-primary">
                            Qty: {qty}m
                          </span>
                          <span>{numRolls} rolls</span>
                          <span>{durationMins} mins</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleAddToSchedule({ type: 'pool-hinban', hinban: item.hinban, id: item.id })}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-primary/10 text-primary transition-colors"
                      >
                        <span className="material-symbols-outlined" style={{fontSize: 20}}>arrow_forward</span>
                      </button>
                    </div>
                  )})
                )}
              </div>
            </div>

            {/* Scheduled Column */}
            <div 
              className="flex flex-col rounded-2xl border border-primary/30 bg-primary/5 p-4 min-h-[500px]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDropScheduled(e)}
            >
              <h3 className="mb-4 text-lg font-bold text-primary flex items-center justify-between">
                <div className="flex items-center gap-4">
                  Priority Order
                  <div className="flex items-center gap-2 text-sm font-normal text-on-surface">
                    <span className="material-symbols-outlined text-outline" style={{fontSize:18}}>schedule</span>
                    Start: 
                    <input 
                      type="time" 
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                      className="rounded bg-background/50 border border-outline-variant/50 px-2 py-0.5 text-xs focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded bg-primary/10 px-2 py-1 text-xs font-bold text-primary shadow-sm border border-primary/20">
                    {formatTime(scheduledTotalMins)}
                  </span>
                  {scheduledItems.length > 0 && (
                    <button 
                      onClick={() => {
                        if (window.confirm("Are you sure you want to reset the schedule? All items will be moved back to the pool.")) {
                          setScheduleOrder([]);
                        }
                      }}
                      className="flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-500/20"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>restart_alt</span>
                      Reset
                    </button>
                  )}
                  <span className="text-sm font-normal text-primary/70">{scheduledItems.length} scheduled</span>
                </div>
              </h3>
              <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
                {scheduleWithTimes.length === 0 ? (
                  <div className="text-center text-sm text-primary/50 mt-10 border-2 border-dashed border-primary/20 rounded-xl p-8">
                    Drag items here to set priority order
                  </div>
                ) : (
                  scheduleWithTimes.map((item, index) => (
                    <div 
                      key={item.id}
                      draggable
                      onDragStart={(e) => onDragStartSchedule(e, item, 'scheduled')}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.stopPropagation(); // Prevent column drop
                        onDropScheduled(e, index);
                      }}
                      className={`cursor-grab active:cursor-grabbing rounded-xl border p-3 flex items-center gap-3 shadow-sm transition-colors ${item.type === 'setup' ? 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/60' : 'border-primary/20 bg-surface hover:border-primary/60'}`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {index + 1}
                      </span>
                      <span className="flex flex-col items-center justify-center rounded bg-surface-variant/30 px-2 py-1 text-xs font-medium text-outline min-w-[50px]">
                        <span>{item.startTime}</span>
                        <span className="text-[10px] opacity-70">to {item.endTime}</span>
                      </span>
                      
                      {item.type === 'setup' ? (
                        <>
                          <span className="font-bold text-sm text-amber-600 flex-1">{item.name}</span>
                          <span className="text-xs font-medium text-amber-600/70">{item.duration} mins</span>
                        </>
                      ) : (
                        <>
                          <div className="flex-1 flex flex-col cursor-pointer" onClick={() => handleCardClick(item.hinban)}>
                            <span className="font-medium text-sm text-on-surface hover:text-primary transition-colors">{item.hinban}</span>
                            <span className="text-xs text-outline flex items-center gap-2 mt-1">
                               <span className="bg-primary/10 text-primary px-1.5 rounded-sm">Roll {item.rollIndex}/{item.totalRolls}</span>
                               <span>{item.meters}m</span>
                            </span>
                          </div>
                          <span className="text-xs font-bold text-primary whitespace-nowrap">{item.duration} mins</span>
                        </>
                      )}
                      <button 
                        onClick={() => handleRemoveFromSchedule(item)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-red-500/10 text-red-500 transition-colors ml-2"
                      >
                        <span className="material-symbols-outlined" style={{fontSize: 20}}>arrow_back</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalData && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-outline-variant/30 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/30 bg-surface-variant/20">
              <div>
                <h2 className="text-xl font-bold text-on-surface">{modalData['品番']}</h2>
                <p className="text-sm text-outline mt-1">{modalData['品目マスタ']?.['品名']}</p>
              </div>
              <button 
                onClick={() => setModalData(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-variant/50 text-outline transition-colors"
              >
                <span className="material-symbols-outlined" style={{fontSize: 24}}>close</span>
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
              
              {/* Bom Info - clickable to open material sub-modal */}
              {(() => {
                const bomEntry = modalData['BOM']?.find(b => b['工程コード'] === 1010);
                const materialHinban = bomEntry?.['構成品番'] || 'N/A';
                const hasMaterialDetail = !!bomEntry?.['構成品_詳細'];
                return (
                  <button 
                    onClick={() => hasMaterialDetail && setMaterialDetailOpen(true)}
                    className={`w-full rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between text-left transition-colors ${hasMaterialDetail ? 'hover:bg-primary/10 cursor-pointer' : 'cursor-default'}`}
                  >
                    <div>
                      <div className="text-xs font-bold text-primary mb-1 uppercase tracking-wider">構成品番 (Material)</div>
                      <div className="font-medium text-on-surface">{materialHinban}</div>
                    </div>
                    {hasMaterialDetail && (
                      <div className="flex items-center gap-2 text-primary">
                        <span className="text-[10px] font-medium bg-primary/10 px-2 py-0.5 rounded-full">View details</span>
                        <span className="material-symbols-outlined" style={{fontSize: 20}}>open_in_new</span>
                      </div>
                    )}
                  </button>
                );
              })()}

              {/* Segments Info */}
              <div>
                <div className="text-xs font-bold text-outline mb-3 uppercase tracking-wider">品番構造 (Structure)</div>
                <div className="flex flex-wrap gap-2">
                  {modalData['品番構造']?.segments?.map((s, i) => {
                     const name = s.name || s['得意先'] || s['入出荷先'];
                     if (!name) return null;
                     return (
                       <div key={i} className="flex flex-col bg-surface-variant/30 border border-outline-variant/50 rounded-lg px-3 py-2 text-sm">
                         <span className="text-[10px] text-outline">{s.segment}</span>
                         <span className="font-medium text-on-surface">{name}</span>
                       </div>
                     );
                  })}
                </div>
              </div>

              {/* Process Data */}
              {(() => {
                const process2010 = modalData['BOM']?.find(b => b['工程コード'] === 2010);
                if (!process2010) return null;
                return (
                  <div>
                    <div className="text-xs font-bold text-outline mb-3 uppercase tracking-wider">工程データ (Process Data - 2010)</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="flex flex-col bg-surface-variant/20 border border-outline-variant/30 rounded-lg p-3">
                        <span className="text-[10px] text-outline">作業時間 (Work Time)</span>
                        <span className="font-medium text-sm text-primary">{process2010['作業時間'] ?? 'N/A'}</span>
                      </div>
                      <div className="flex flex-col bg-surface-variant/20 border border-outline-variant/30 rounded-lg p-3">
                        <span className="text-[10px] text-outline">段取時間 (Setup Time)</span>
                        <span className="font-medium text-sm text-primary">{process2010['段取時間'] ?? 'N/A'}</span>
                      </div>
                      <div className="flex flex-col bg-surface-variant/20 border border-outline-variant/30 rounded-lg p-3">
                        <span className="text-[10px] text-outline">型番 (Model)</span>
                        <span className="font-medium text-sm text-primary">{process2010['型番'] ?? 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Master Data Grid */}
              <div>
                <div className="text-xs font-bold text-outline mb-3 uppercase tracking-wider">Master Data</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">梱包数 (Pack Qty)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['梱包数'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">生産単位数 (Prod Unit)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['生産単位数'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">発注ロット数 (Order Lot)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['発注ロット数'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">品目区分 (Category)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['品目区分'] || 'N/A'}</span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">出荷先名 (Shipping Dest)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['出荷先名'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">受注先コード (Customer Code)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['受注先コード'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">図番 (Drawing No.)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['図番'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">仕様 (Specs)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['仕様'] || 'N/A'}</span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">型番 (Model)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['型番'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">速度 (Speed)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['速度'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">ライン形態 (Line Form)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['ライン形態'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">繰出機 (Unwinder)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['繰出機'] || 'N/A'}</span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">接着剤有無 (Adhesive)</span>
                    <span className="font-medium text-sm text-on-surface">
                      {modalData['品目マスタ']?.['接着剤有無'] === 1 ? '有 (Yes)' : modalData['品目マスタ']?.['接着剤有無'] === 2 ? '無 (No)' : modalData['品目マスタ']?.['接着剤有無'] ?? 'N/A'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">クリーン度 (Cleanliness)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['クリーン度'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">乾燥温度 (Dry Temp)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['乾燥温度'] || 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">ロール温度 (Roll Temp)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['ロール温度'] || 'N/A'}</span>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">基材厚 (Base Thick)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['基材厚'] ?? 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">基材幅 (Base Width)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['基材幅'] ?? 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">基材長 (Base Length)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['基材長'] ?? 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">粘着剤厚 (Adhesive Thick)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['粘着剤厚'] ?? 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">粘着剤幅 (Adhesive Width)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['粘着剤幅'] ?? 'N/A'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-outline">粘着剤長 (Adhesive Length)</span>
                    <span className="font-medium text-sm text-on-surface">{modalData['品目マスタ']?.['粘着剤長'] ?? 'N/A'}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Material Sub-Modal (on top of main modal) */}
      {materialDetailOpen && modalData && (() => {
        const bomEntry = modalData['BOM']?.find(b => b['工程コード'] === 1010);
        const materialDetail = bomEntry?.['構成品_詳細'];
        if (!materialDetail) return null;
        return createPortal(
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4" onClick={() => setMaterialDetailOpen(false)}>
            <div className="bg-surface border border-outline-variant/30 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh] animate-[fadeIn_0.15s_ease-out]" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-outline-variant/30 bg-primary/5">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary" style={{fontSize: 24}}>inventory_2</span>
                  <div>
                    <h3 className="text-xl font-bold text-on-surface">{materialDetail['品番']}</h3>
                    <p className="text-sm text-outline mt-1">{materialDetail['品目マスタ']?.['品名']} — {materialDetail['品目マスタ']?.['仕様']}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setMaterialDetailOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-variant/50 text-outline transition-colors"
                >
                  <span className="material-symbols-outlined" style={{fontSize: 24}}>close</span>
                </button>
              </div>
              
              {/* Body */}
              <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-5">
                {/* Material Structure */}
                {materialDetail['品番構造']?.segments && (
                  <div>
                    <div className="text-xs font-bold text-outline mb-3 uppercase tracking-wider">材料品番構造 (Material Structure)</div>
                    <div className="flex flex-wrap gap-2">
                      {materialDetail['品番構造'].segments.map((s, i) => {
                        const name = s.name || s['得意先'] || s['入出荷先'];
                        if (!name) return null;
                        return (
                          <div key={i} className="flex flex-col bg-surface-variant/30 border border-outline-variant/50 rounded-lg px-3 py-2 text-sm">
                            <span className="text-[10px] text-outline">{s.segment}</span>
                            <span className="font-medium text-on-surface">{name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Material Master Data */}
                <div>
                  <div className="text-xs font-bold text-outline mb-3 uppercase tracking-wider">材料マスタ (Material Master)</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">品目区分 (Category)</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['品目区分'] || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">手配先コード (Supplier)</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['手配先コード'] || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">生産単位数 (Prod Unit)</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['生産単位数'] || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">発注ロット数 (Order Lot)</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['発注ロット数'] || 'N/A'}</span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">出荷先名 (Shipping Dest)</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['出荷先名'] || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">仕様 (Specs)</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['仕様'] || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">型番 (Model)</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['型番'] || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">接着剤有無 (Adhesive)</span>
                      <span className="font-medium text-sm text-on-surface">
                        {materialDetail['品目マスタ']?.['接着剤有無'] === 1 ? '有 (Yes)' : materialDetail['品目マスタ']?.['接着剤有無'] === 2 ? '無 (No)' : materialDetail['品目マスタ']?.['接着剤有無'] ?? 'N/A'}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">基材厚 (Base Thick)</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['基材厚'] ?? 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">基材幅 (Base Width)</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['基材幅'] ?? 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">基材長 (Base Length)</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['基材長'] ?? 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">粘着剤厚 (Adhesive Thick)</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['粘着剤厚'] ?? 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">粘着剤幅 (Adhesive Width)</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['粘着剤幅'] ?? 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">粘着剤長 (Adhesive Length)</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['粘着剤長'] ?? 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">粘着倍率 (Adhesive Ratio)</span>
                      <span className="font-medium text-sm text-on-surface">{materialDetail['品目マスタ']?.['粘着倍率'] || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* BOM Process Info */}
                <div className="bg-surface-variant/20 border border-outline-variant/30 rounded-lg p-3">
                  <div className="text-xs font-bold text-outline mb-3 uppercase tracking-wider">工程情報 (Process Info — 1010)</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">工程名</span>
                      <span className="font-medium text-sm text-on-surface">{bomEntry?.['工程名'] || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">段取時間</span>
                      <span className="font-medium text-sm text-on-surface">{bomEntry?.['段取時間'] || 0} min</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">作業時間</span>
                      <span className="font-medium text-sm text-on-surface">{bomEntry?.['作業時間'] || 0} sec/cm</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-outline">原単位</span>
                      <span className="font-medium text-sm text-on-surface">{bomEntry?.['原単位'] || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* Sync Excel Modal */}
      {isSyncModalOpen && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-outline-variant/30 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-[fadeIn_0.15s_ease-out]">
            <div className="flex items-center justify-between p-5 border-b border-outline-variant/30 bg-surface-variant/20">
              <h2 className="text-lg font-bold text-on-surface">Sync Excel Data</h2>
              <button 
                onClick={() => setIsSyncModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-variant/50 text-outline transition-colors"
              >
                <span className="material-symbols-outlined" style={{fontSize: 20}}>close</span>
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-on-surface mb-2">Select Year and Month</label>
              <input
                type="month"
                value={syncTargetMonth}
                onChange={(e) => setSyncTargetMonth(e.target.value)}
                className="w-full rounded-xl border border-outline-variant/50 bg-background/50 px-4 py-3 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="text-xs text-outline mt-3">
                This will fetch data from the <strong>{syncTargetMonth ? `${syncTargetMonth.split('-')[0]}年${parseInt(syncTargetMonth.split('-')[1], 10)}月` : '...'}</strong> tab in the Google Sheet.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 p-5 border-t border-outline-variant/30 bg-surface-variant/10">
              <button 
                onClick={() => setIsSyncModalOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-outline hover:bg-surface-variant/50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleSyncExcel(syncTargetMonth)}
                className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
              >
                Fetch Data
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
