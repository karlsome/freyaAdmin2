import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import MasterTabNav from '../components/MasterTabNav';
import MaterialDetailModal from '../components/MaterialDetailModal';
import DataTable from '../components/DataTable';
import { BASE_URL } from '../services/api';
import { readStoredAuthUser } from '../utils/auth';
import * as xlsx from 'xlsx';

export default function FirstFactoryPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { tab: routeTab } = useParams();
  
  const VALID_TABS = ['fetching', 'scheduling', 'summary', 'production'];
  const activeTab = VALID_TABS.includes(routeTab) ? routeTab : 'fetching';
  
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
      const res = await fetch(`${BASE_URL}api/production/schedule?month=${month}`);
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
      // 1. Fetch the binary Excel file from the proxy
      const res = await fetch(BASE_URL + 'api/production/sync-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: monthToSync })
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch Excel file from backend');
      }
      
      const arrayBuffer = await res.arrayBuffer();
      
      // 2. Parse Excel in browser
      const workbook = xlsx.read(arrayBuffer, { type: 'array' });
      
      const [year, monthNum] = monthToSync.split('-');
      const targetTabName = `${year}年${parseInt(monthNum, 10)}月`;
      
      if (!workbook.Sheets[targetTabName]) {
        alert(`Tab '${targetTabName}' not found in the Excel file.`);
        setSyncing(false);
        return;
      }
      
      const sheet = workbook.Sheets[targetTabName];
      const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      
      let parsedData = [];
      let currentBlock = null;
      
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        const valB = String(row[1] || '').trim();
        const isHinbanRow = valB.length > 5 && /^[A-Z0-9\/\*\-\.]+$/.test(valB);

        if (isHinbanRow) {
          if (currentBlock) parsedData.push(currentBlock);
          currentBlock = null; 
          
          if (valB.length === 20) {
            currentBlock = {
              id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
              month: monthToSync,
              hinban: valB,
              orders: Array(31).fill(0),
              production: Array(31).fill(0)
            };
          }
        }

        if (currentBlock) {
          let rowLabel = '';
          for (let c = 0; c < 6; c++) if (row[c]) rowLabel += String(row[c]);

          if (rowLabel.includes('受注')) {
            for (let i = 0; i < 31; i++) {
              currentBlock.orders[i] = Number(Number(row[5 + i] || 0).toFixed(1));
            }
          } else if (rowLabel.includes('生産')) {
            for (let i = 0; i < 31; i++) {
              currentBlock.production[i] = Number(Number(row[5 + i] || 0).toFixed(1));
            }
          }
        }
      }

      if (currentBlock) parsedData.push(currentBlock);

      // 3. Post the parsed JSON back to backend
      const saveRes = await fetch(BASE_URL + 'api/production/sync-excel-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: monthToSync, data: parsedData })
      });
      
      const saveJson = await saveRes.json();
      if (saveJson.success) {
        alert(saveJson.message);
        if (monthToSync === selectedMonth) {
          fetchSchedule(selectedMonth);
        }
      } else {
        alert('Sync failed: ' + saveJson.message);
      }

    } catch (err) {
      console.error('Error syncing:', err);
      alert('Error connecting to backend or parsing Excel');
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

  const PRESET_SETUP_ITEMS = [
    { name: '段取り', defaultTime: 15 },
    { name: '段替え', defaultTime: 15 },
    { name: '乾燥温度設定', defaultTime: 15 },
    { name: 'ロール温度設定', defaultTime: 15 },
    { name: '試作', defaultTime: 30 },
    { name: '紙替', defaultTime: 15 },
  ];

  const [scheduleOrder, setScheduleOrder] = useState([]);
  const [startTime, setStartTime] = useState('09:00');
  
  const [setupTimes, setSetupTimes] = useState(() => {
    try {
      const saved = localStorage.getItem('firstFactory_setup_times');
      const parsed = saved ? JSON.parse(saved) : {};
      const defaults = {};
      PRESET_SETUP_ITEMS.forEach(p => {
        defaults[p.name] = parsed[p.name] !== undefined ? parsed[p.name] : p.defaultTime;
      });
      return defaults;
    } catch (e) {
      const defaults = {};
      PRESET_SETUP_ITEMS.forEach(p => { defaults[p.name] = p.defaultTime; });
      return defaults;
    }
  });

  const [customSetupName, setCustomSetupName] = useState(() => {
    return localStorage.getItem('firstFactory_custom_setup_name') || '';
  });

  const [customSetupDuration, setCustomSetupDuration] = useState(() => {
    const saved = localStorage.getItem('firstFactory_custom_setup_duration');
    return saved !== null ? saved : '';
  });

  const handleUpdateSetupTime = (name, val) => {
    const num = Math.max(0, Number(val) || 0);
    setSetupTimes(prev => {
      const updated = { ...prev, [name]: num };
      localStorage.setItem('firstFactory_setup_times', JSON.stringify(updated));
      return updated;
    });
  };

  const handleUpdateCustomName = (val) => {
    setCustomSetupName(val);
    localStorage.setItem('firstFactory_custom_setup_name', val);
  };

  const handleUpdateCustomDuration = (val) => {
    setCustomSetupDuration(val);
    localStorage.setItem('firstFactory_custom_setup_duration', val);
  };

  const [modalData, setModalData] = useState(null);

  const handleCardClick = async (hinban) => {
    if (!hinban) return;
    const found = data.find(i => i.hinban === hinban);
    if (found && found.materialInfo && found.materialInfo.rawMaster) {
      setModalData(found.materialInfo.rawMaster);
      return;
    }

    try {
      const res = await fetch(`${BASE_URL}api/production/material-detail?hinban=${encodeURIComponent(hinban)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.product) {
          setModalData(json.product);
          return;
        }
      }
    } catch (err) {
      console.warn("Failed to fetch material detail from server:", err);
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

  const handleTabChange = (nextTab) => {
    if (activeTab === 'scheduling' && nextTab !== 'scheduling' && hasUnsavedChanges) {
      if (!window.confirm(t('unsavedChangesWarning') || "You have unsaved changes! Are you sure you want to switch tabs? Unsaved progress will be lost.")) {
        return;
      }
    }
    navigate(`/firstFactory/${nextTab}`);
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
      const authUser = readStoredAuthUser() || {};
      const scheduledBy = authUser.firstName ? `${authUser.firstName} ${authUser.lastName || ''}`.trim() : (authUser.username || 'Admin');

      const res = await fetch(BASE_URL + 'api/production/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          scheduleOrder,
          startTime, 
          month: selectedMonth, 
          date: selectedDay,
          scheduledBy
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

  // --- MONTHLY SUMMARY COMPUTATION ---
  const daysInSelectedMonth = useMemo(() => {
    if (!selectedMonth) return 31;
    const [y, m] = selectedMonth.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }, [selectedMonth]);

  const monthSummaryData = useMemo(() => {
    let totalScheduledMins = 0;
    let scheduledDaysCount = 0;
    let totalScheduledItemsCount = 0;
    let totalSetupCount = 0;
    const monthUniqueHinbans = new Set();
    const dayRows = [];

    let maxDayMins = 0;

    for (let day = 1; day <= daysInSelectedMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      const dateKey = `${selectedMonth}-${dayStr}`;
      const dateObj = new Date(`${dateKey}T00:00:00`);
      const dayOfWeek = dateObj.getDay(); // 0: Sun, 6: Sat
      const dayOfWeekStr = ['日', '月', '火', '水', '木', '金', '土'][dayOfWeek];

      const saved = savedSchedules.find(s => s.date === day);
      const isScheduled = Boolean(saved && Array.isArray(saved.scheduleOrder) && saved.scheduleOrder.length > 0);

      let dayTotalMins = 0;
      let startTime = saved?.startTime || '09:00';
      let endTime = '—';
      let scheduledBy = saved?.scheduledBy || '—';
      let updatedAtStr = saved?.updatedAt ? new Date(saved.updatedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
      let itemCount = 0;
      let setupCount = 0;
      let hinbanCount = 0;
      const dayUniqueHinbans = new Set();

      if (isScheduled) {
        scheduledDaysCount++;
        itemCount = saved.scheduleOrder.length;
        totalScheduledItemsCount += itemCount;

        saved.scheduleOrder.forEach(item => {
          dayTotalMins += (Number(item.duration) || 0);
          if (item.type === 'setup') {
            setupCount++;
            totalSetupCount++;
          } else {
            hinbanCount++;
            if (item.hinban) {
              dayUniqueHinbans.add(item.hinban);
              monthUniqueHinbans.add(item.hinban);
            }
          }
        });

        totalScheduledMins += dayTotalMins;
        if (dayTotalMins > maxDayMins) maxDayMins = dayTotalMins;

        // Calculate end time
        const [sh, sm] = (startTime || '09:00').split(':').map(Number);
        const endTotal = (sh * 60 + sm) + dayTotalMins;
        const eh = Math.floor((endTotal / 60) % 24);
        const em = endTotal % 60;
        endTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
      }

      dayRows.push({
        day,
        dateKey,
        dayOfWeek,
        dayOfWeekStr,
        isScheduled,
        dayTotalMins,
        dayTotalHours: (dayTotalMins / 60).toFixed(1),
        startTime,
        endTime,
        timeRange: isScheduled ? `${startTime} ～ ${endTime}` : '—',
        itemCount,
        setupCount,
        hinbanCount,
        uniqueHinbanCount: dayUniqueHinbans.size,
        scheduledBy,
        updatedAtStr
      });
    }

    const totalScheduledHours = (totalScheduledMins / 60).toFixed(1);
    const avgHoursPerScheduledDay = scheduledDaysCount > 0 ? (totalScheduledMins / scheduledDaysCount / 60).toFixed(1) : '0.0';

    return {
      totalScheduledMins,
      totalScheduledHours,
      scheduledDaysCount,
      totalScheduledItemsCount,
      totalSetupCount,
      totalMonthUniqueHinbansCount: monthUniqueHinbans.size,
      avgHoursPerScheduledDay,
      maxDayMins: maxDayMins || 480,
      dayRows
    };
  }, [selectedMonth, daysInSelectedMonth, savedSchedules]);

  const [summarySort, setSummarySort] = useState({ key: 'day', direction: 'asc' });

  const sortedSummaryRows = useMemo(() => {
    const rows = [...monthSummaryData.dayRows];
    if (!summarySort?.key) return rows;
    const { key, direction } = summarySort;
    const mult = direction === 'desc' ? -1 : 1;

    rows.sort((a, b) => {
      let valA = a[key];
      let valB = b[key];
      if (typeof valA === 'boolean') {
        valA = valA ? 1 : 0;
        valB = valB ? 1 : 0;
      }
      if (typeof valA === 'string') {
        return mult * valA.localeCompare(valB || '', 'ja');
      }
      return mult * ((valA ?? 0) - (valB ?? 0));
    });
    return rows;
  }, [monthSummaryData.dayRows, summarySort]);

  const summaryColumns = useMemo(() => [
    {
      key: 'day',
      label: 'Date',
      sortable: true,
      minWidth: 110,
      renderCell: (row) => {
        const isSunday = row.dayOfWeek === 0;
        const isSaturday = row.dayOfWeek === 6;
        return (
          <div className="flex items-center gap-1.5 font-bold text-on-surface">
            <span className="text-sm">
              {parseInt(selectedMonth.split('-')[1], 10)}/{row.day}
            </span>
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-extrabold ${isSunday ? 'bg-red-500/10 text-red-600' : (isSaturday ? 'bg-blue-500/10 text-blue-600' : 'bg-surface-variant/50 text-outline')}`}>
              ({row.dayOfWeekStr})
            </span>
          </div>
        );
      }
    },
    {
      key: 'isScheduled',
      label: 'Status',
      sortable: true,
      minWidth: 130,
      renderCell: (row) => {
        return row.isScheduled ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            Scheduled ({row.itemCount})
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-outline font-medium">
            — No schedule
          </span>
        );
      }
    },
    {
      key: 'timeRange',
      label: 'Time Range',
      sortable: true,
      minWidth: 150,
      renderCell: (row) => {
        return row.isScheduled ? (
          <span className="rounded-lg bg-surface-variant/40 px-2.5 py-1 text-xs font-mono font-semibold text-on-surface border border-outline-variant/30">
            🕒 {row.startTime} ～ {row.endTime}
          </span>
        ) : (
          <span className="text-outline text-xs">—</span>
        );
      }
    },
    {
      key: 'dayTotalMins',
      label: 'Total Duration',
      sortable: true,
      minWidth: 150,
      renderCell: (row) => {
        return row.isScheduled ? (
          <span className="text-xs font-bold text-on-surface font-mono">
            {formatTime(row.dayTotalMins)} - {row.dayTotalHours}hrs
          </span>
        ) : (
          <span className="text-xs text-outline">—</span>
        );
      }
    },
    {
      key: 'itemCount',
      label: 'Items Breakdown',
      sortable: true,
      minWidth: 210,
      renderCell: (row) => {
        return row.isScheduled ? (
          <div className="flex items-center gap-1.5 text-xs flex-wrap">
            <span className="rounded bg-indigo-500/10 px-2 py-0.5 font-bold text-indigo-600 border border-indigo-500/20" title={`${row.uniqueHinbanCount} Unique Hinban`}>
              {row.uniqueHinbanCount} 品番
            </span>
            <span className="rounded bg-primary/10 px-2 py-0.5 font-bold text-primary" title={`${row.hinbanCount} Total Rolls`}>
              {row.hinbanCount} rolls
            </span>
            {row.setupCount > 0 && (
              <span className="rounded bg-amber-500/10 px-2 py-0.5 font-bold text-amber-700" title={`${row.setupCount} Setup Events`}>
                {row.setupCount} setups
              </span>
            )}
          </div>
        ) : (
          <span className="text-outline text-xs">—</span>
        );
      }
    },
    {
      key: 'scheduledBy',
      label: 'Scheduled By',
      sortable: true,
      minWidth: 140,
      renderCell: (row) => {
        return row.isScheduled ? (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-on-surface">
            <span className="material-symbols-outlined text-outline" style={{ fontSize: 16 }}>person</span>
            <span>{row.scheduledBy}</span>
          </div>
        ) : (
          <span className="text-outline text-xs">—</span>
        );
      }
    },
    {
      key: 'updatedAtStr',
      label: 'Last Saved',
      sortable: true,
      minWidth: 130,
      renderCell: (row) => (
        <span className="text-xs text-outline font-mono">{row.updatedAtStr}</span>
      )
    },
    {
      key: 'actions',
      label: 'Action',
      sortable: false,
      minWidth: 100,
      renderCell: (row) => (
        <button
          onClick={() => {
            setSelectedDateStr(row.dateKey);
            navigate('/firstFactory/scheduling');
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary hover:text-on-primary transition-colors shadow-sm"
          title="Open in Scheduling Tab"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit_calendar</span>
          Open
        </button>
      )
    }
  ], [selectedMonth]);

  // -------------------------------------------------------------
  // Production Tab State & Fetching (Realtime Tracking)
  // -------------------------------------------------------------
  const [productionDateStr, setProductionDateStr] = useState(getLocalYYYYMMDD());
  const [productionSchedule, setProductionSchedule] = useState(null);
  const [productionStatuses, setProductionStatuses] = useState([]);
  const [loadingProduction, setLoadingProduction] = useState(false);
  const [productionFilter, setProductionFilter] = useState('all');

  const fetchProductionData = async (dateStr) => {
    setLoadingProduction(true);
    try {
      const [year, monthNum, dayNum] = dateStr.split('-');
      const month = `${year}-${monthNum}`;
      const date = Number(dayNum);

      let scheduleDoc = null;
      try {
        const schedRes = await fetch(`${BASE_URL}api/production/schedule/daily?month=${encodeURIComponent(month)}&date=${date}`);
        if (schedRes.ok) {
          const schedJson = await schedRes.json();
          if (schedJson.success && schedJson.schedule) {
            scheduleDoc = schedJson.schedule;
          }
        }
      } catch (e) {
        console.warn("Daily schedule fetch error:", e);
      }

      if (!scheduleDoc) {
        const res = await fetch(`${BASE_URL}api/production/schedule?month=${encodeURIComponent(month)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.schedules)) {
            scheduleDoc = json.schedules.find(s => s.month === month && Number(s.date) === date) || null;
          }
        }
      }
      setProductionSchedule(scheduleDoc);

      try {
        const statusRes = await fetch(`${BASE_URL}api/production/status?date=${encodeURIComponent(dateStr)}`);
        if (statusRes.ok) {
          const statusJson = await statusRes.json();
          if (statusJson.success && Array.isArray(statusJson.records)) {
            setProductionStatuses(statusJson.records);
          } else {
            setProductionStatuses([]);
          }
        }
      } catch (err) {
        console.warn("Status fetch error:", err);
        setProductionStatuses([]);
      }
    } catch (err) {
      console.error("Failed to load production tracking data:", err);
    } finally {
      setLoadingProduction(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'production') {
      fetchProductionData(productionDateStr);
    }
  }, [activeTab, productionDateStr]);

  const productionGroups = useMemo(() => {
    if (!productionSchedule || !Array.isArray(productionSchedule.scheduleOrder) || productionSchedule.scheduleOrder.length === 0) {
      return [];
    }

    const startTime = productionSchedule.startTime || '08:00';
    let current = new Date(`2000-01-01T${startTime}:00`);
    if (isNaN(current.getTime())) current = new Date(`2000-01-01T08:00:00`);

    const timedItems = productionSchedule.scheduleOrder.map((item, idx) => {
      const start = current.toTimeString().substring(0, 5);
      const duration = Number(item.duration) || 0;
      current = new Date(current.getTime() + duration * 60000);
      const end = current.toTimeString().substring(0, 5);
      return {
        ...item,
        orderIndex: idx + 1,
        startTime: start,
        endTime: end,
        duration
      };
    });

    const groups = [];
    let currentGroup = null;

    timedItems.forEach((item, idx) => {
      if (item.type === 'setup') {
        groups.push({
          type: 'setup',
          groupId: `setup_${item.id || idx}`,
          name: item.name || '段取り / 段替',
          items: [item],
          orderRange: `#${item.orderIndex}`,
          totalDuration: Number(item.duration) || 0,
          totalMeters: 0,
          startTime: item.startTime,
          endTime: item.endTime
        });
        currentGroup = null;
        return;
      }

      if (currentGroup && currentGroup.type === 'hinban' && currentGroup.hinban === item.hinban) {
        currentGroup.items.push(item);
        currentGroup.totalDuration += Number(item.duration) || 0;
        currentGroup.totalMeters += Number(item.meters) || 0;
        currentGroup.endTime = item.endTime;
        currentGroup.orderRange = `#${currentGroup.items[0].orderIndex} - #${item.orderIndex}`;
      } else {
        currentGroup = {
          type: 'hinban',
          groupId: `group_${item.hinban}_${idx}`,
          hinban: item.hinban,
          hinmei: item.hinmei || '',
          kizai: item.kizai || '',
          color: item.color || '',
          shori: item.shori || '',
          habanaga: item.habanaga || '',
          shippingDest: item.shippingDest || '',
          labelHinban: item.labelHinban || '',
          zuban: item.zuban || '',
          items: [item],
          orderRange: `#${item.orderIndex}`,
          totalDuration: Number(item.duration) || 0,
          totalMeters: Number(item.meters) || 0,
          startTime: item.startTime,
          endTime: item.endTime
        };
        groups.push(currentGroup);
      }
    });

    return groups.map((grp) => {
      const rec = productionStatuses.find(s => s.groupId === grp.groupId || (s.hinban === grp.hinban && grp.type === 'hinban'));
      let status = rec?.status || 'pending';
      if (status === 'running') status = 'in-progress';

      return {
        ...grp,
        status,
        worker: rec?.worker || '',
        machine: rec?.machine || 'PSA2',
        actualStartTime: rec?.actualStartTime || null,
        actualEndTime: rec?.actualEndTime || null,
        actualDurationMins: rec?.actualDurationMins ?? null,
        statusRecord: rec || null
      };
    });
  }, [productionSchedule, productionStatuses]);

  const productionStats = useMemo(() => {
    // Only account for product hinban batches (exclude setup items since setups are non-production changeovers)
    const hinbanGroups = productionGroups.filter(g => g.type === 'hinban');
    const total = hinbanGroups.length;
    const inProgress = hinbanGroups.filter(g => g.status === 'in-progress').length;
    const completed = hinbanGroups.filter(g => g.status === 'completed').length;
    const pending = hinbanGroups.filter(g => g.status === 'pending').length;
    const canceled = hinbanGroups.filter(g => g.status === 'canceled').length;
    const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, inProgress, completed, pending, canceled, progressPercent };
  }, [productionGroups]);

  const filteredProductionGroups = useMemo(() => {
    if (productionFilter === 'all') return productionGroups;
    if (productionFilter === 'pending') return productionGroups.filter(g => g.type === 'hinban' && g.status === 'pending');
    return productionGroups.filter(g => g.status === productionFilter);
  }, [productionGroups, productionFilter]);

  const stepProductionDate = (days) => {
    const d = new Date(`${productionDateStr}T00:00:00`);
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setProductionDateStr(`${y}-${m}-${day}`);
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
            duration: dragData.duration || 15
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
          duration: dragData.duration || 15
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
          { key: 'scheduling', label: 'Scheduling', ready: true },
          { key: 'summary', label: 'Summary', ready: true },
          { key: 'production', label: 'Production', ready: true }
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
                            <span 
                              className="cursor-pointer hover:text-primary transition-colors"
                              onClick={() => handleCardClick(item.hinban)}
                            >
                              {item.hinban}
                            </span>
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
                {/* Setup & Task Items */}
                <div className="flex flex-col gap-2 mb-4 pb-4 border-b border-outline-variant/30">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {PRESET_SETUP_ITEMS.map(preset => {
                      const duration = setupTimes[preset.name] !== undefined ? setupTimes[preset.name] : preset.defaultTime;
                      return (
                        <div 
                          key={preset.name}
                          draggable
                          onDragStart={(e) => {
                            if (e.target.tagName && e.target.tagName.toLowerCase() === 'input') {
                              e.preventDefault();
                              return;
                            }
                            onDragStartSchedule(e, { type: 'setup', name: preset.name, duration }, 'pool');
                          }}
                          className="cursor-grab rounded-xl border border-dashed border-primary/50 bg-primary/5 p-2.5 flex items-center justify-between hover:border-primary transition-colors text-primary font-bold text-xs"
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <span className="truncate" title={preset.name}>{preset.name}</span>
                            <input 
                              type="number" 
                              value={duration} 
                              onChange={e => handleUpdateSetupTime(preset.name, e.target.value)}
                              className="w-12 rounded bg-background/80 border border-primary/30 px-1 py-0.5 text-center text-xs focus:outline-none focus:border-primary shrink-0"
                              min="0"
                            />
                            <span className="text-[11px] font-medium shrink-0">m</span>
                          </div>
                          <button 
                            type="button"
                            onClick={() => handleAddToSchedule({ type: 'setup', name: preset.name, duration })}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-primary/20 text-primary transition-colors ml-1"
                            title="スケジュールに追加"
                          >
                            <span className="material-symbols-outlined" style={{fontSize: 16}}>arrow_forward</span>
                          </button>
                        </div>
                      );
                    })}

                    {/* Dynamic Custom Setup Item */}
                    <div 
                      draggable
                      onDragStart={(e) => {
                        if (e.target.tagName && e.target.tagName.toLowerCase() === 'input') {
                          e.preventDefault();
                          return;
                        }
                        onDragStartSchedule(e, { 
                          type: 'setup', 
                          name: customSetupName.trim() || 'カスタム設定', 
                          duration: Number(customSetupDuration) || 0 
                        }, 'pool');
                      }}
                      className="cursor-grab rounded-xl border border-dashed border-amber-500/50 bg-amber-500/5 p-2.5 flex items-center justify-between hover:border-amber-500 transition-colors text-amber-700 font-bold text-xs"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <input 
                          type="text" 
                          value={customSetupName} 
                          placeholder="項目名入力..."
                          onChange={e => handleUpdateCustomName(e.target.value)}
                          className="w-full min-w-0 rounded bg-background/80 border border-amber-500/30 px-1.5 py-0.5 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:border-amber-500 font-normal"
                        />
                        <input 
                          type="number" 
                          value={customSetupDuration} 
                          placeholder="分"
                          onChange={e => handleUpdateCustomDuration(e.target.value)}
                          className="w-12 rounded bg-background/80 border border-amber-500/30 px-1 py-0.5 text-center text-xs focus:outline-none focus:border-amber-500 shrink-0 font-normal"
                          min="0"
                        />
                        <span className="text-[11px] font-medium shrink-0">m</span>
                      </div>
                      <button 
                        type="button"
                        onClick={() => handleAddToSchedule({ 
                          type: 'setup', 
                          name: customSetupName.trim() || 'カスタム設定', 
                          duration: Number(customSetupDuration) || 0 
                        })}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-amber-500/20 text-amber-600 transition-colors ml-1"
                        title="スケジュールに追加"
                      >
                        <span className="material-symbols-outlined" style={{fontSize: 16}}>arrow_forward</span>
                      </button>
                    </div>
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

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <div className="flex flex-col gap-6">
          {/* Header Controls & Month Selector */}
          <div className="rounded-2xl border border-outline-variant/30 bg-surface/50 p-4 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-outline" style={{ fontSize: 22 }}>calendar_month</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-on-surface">Target Month:</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={handleMonthChange}
                  className="rounded-xl border border-outline-variant/50 bg-background/50 px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-bold"
                  title="Select month for summary"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-outline">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>info</span>
              <span>Showing daily priority scheduling overview for {selectedMonth}</span>
            </div>
          </div>

          {/* Daily Breakdown Table */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 22 }}>calendar_view_month</span>
                <h3 className="text-lg font-bold text-on-surface">Daily Schedule & Priority Allocation</h3>
              </div>
              <span className="text-xs text-outline font-medium">1st ～ {daysInSelectedMonth}th of {selectedMonth}</span>
            </div>

            <DataTable
              columns={summaryColumns}
              rows={sortedSummaryRows}
              enableColumnResize={true}
              enableColumnReorder={true}
              layoutStorageKey="firstFactory_monthly_summary_table_layout"
              sort={summarySort}
              onSort={setSummarySort}
              pageSize={35}
              filteredCount={sortedSummaryRows.length}
              totalPages={1}
              stickyHeader={true}
              stickyHeaderOffset={0}
              stickyHeaderCellClassName="bg-surface/95 backdrop-blur-md shadow-[inset_0_-1px_0_rgba(148,163,184,0.18)]"
              tableViewportClassName="overflow-x-auto"
              className="glass-card rounded-2xl shadow-sm border border-outline-variant/30"
              rowKey={(row) => row.dateKey}
              emptyTitle="No schedule data"
              emptyMessage="No schedules found for this month."
            />
          </div>
        </div>
      )}

      {/* Production Tab (Live Production Tracking) */}
      {activeTab === 'production' && (
        <div className="flex flex-col gap-6">
          {/* Header Controls & Date Navigation */}
          <div className="rounded-2xl border border-outline-variant/30 bg-surface/50 p-4 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-outline" style={{ fontSize: 22 }}>event</span>
                <input
                  type="date"
                  value={productionDateStr}
                  onChange={(e) => {
                    if (e.target.value) setProductionDateStr(e.target.value);
                  }}
                  className="rounded-xl border border-outline-variant/50 bg-background/50 px-3 py-2 text-sm font-bold text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                  title="Select production date"
                />
              </div>

              {/* Quick Date Switchers */}
              <div className="flex items-center rounded-xl border border-outline-variant/40 bg-surface-variant/20 p-1">
                <button
                  type="button"
                  onClick={() => stepProductionDate(-1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-variant/50 text-outline transition-colors"
                  title="Previous Day"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProductionDateStr(getLocalYYYYMMDD())}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${productionDateStr === getLocalYYYYMMDD() ? 'bg-primary text-on-primary shadow-xs' : 'text-outline hover:text-on-surface'}`}
                >
                  Today (今日)
                </button>
                <button
                  type="button"
                  onClick={() => stepProductionDate(1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-surface-variant/50 text-outline transition-colors"
                  title="Next Day"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
                </button>
              </div>

              {/* Machine Badge */}
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-surface-variant/40 px-3 py-1.5 text-xs font-bold text-on-surface border border-outline-variant/30">
                <span className="material-symbols-outlined text-outline" style={{ fontSize: 16 }}>precision_manufacturing</span>
                <span>PSA-2 (1号機)</span>
              </span>
            </div>

            {/* Refresh Button */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-outline font-medium hidden sm:inline">
                {productionGroups.length} processes scheduled
              </span>
              <button
                type="button"
                onClick={() => fetchProductionData(productionDateStr)}
                disabled={loadingProduction}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary shadow-sm hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
                title="Refresh live production tracking data"
              >
                <span className={`material-symbols-outlined ${loadingProduction ? 'animate-spin' : ''}`} style={{ fontSize: 18 }}>
                  refresh
                </span>
                <span>{loadingProduction ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>

          {/* Progress Overview Bar */}
          {productionGroups.length > 0 && (
            <div className="glass-card rounded-2xl border border-outline-variant/30 p-4 shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-on-surface text-sm">
                    {parseInt(productionDateStr.split('-')[1], 10)}/{parseInt(productionDateStr.split('-')[2], 10)} Production Progress
                  </span>
                  <span className="rounded bg-primary/10 px-2 py-0.5 font-bold text-primary">
                    {productionStats.completed} / {productionStats.total} Completed ({productionStats.progressPercent}%)
                  </span>
                </div>
                {productionStats.inProgress > 0 && (
                  <span className="inline-flex items-center gap-1.5 font-bold text-purple-600 animate-pulse">
                    <span className="h-2 w-2 rounded-full bg-purple-600"></span>
                    {productionStats.inProgress} In-Progress Now
                  </span>
                )}
              </div>

              {/* Progress bar visual */}
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-variant/40 flex">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-500" 
                  style={{ width: `${(productionStats.completed / productionStats.total) * 100}%` }}
                  title={`${productionStats.completed} Completed`}
                />
                <div 
                  className="h-full bg-purple-600 transition-all duration-500 animate-pulse" 
                  style={{ width: `${(productionStats.inProgress / productionStats.total) * 100}%` }}
                  title={`${productionStats.inProgress} In-Progress`}
                />
              </div>
            </div>
          )}

          {/* Status Filter Tabs / Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setProductionFilter('all')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${productionFilter === 'all' ? 'bg-on-surface text-surface shadow-sm' : 'bg-surface border border-outline-variant/40 text-outline hover:text-on-surface'}`}
            >
              <span>All Statuses</span>
              <span className="rounded-full bg-surface-variant/60 px-1.5 py-0.2 text-[10px] font-black">
                {productionStats.total}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setProductionFilter('in-progress')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${productionFilter === 'in-progress' ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-500/30' : 'bg-surface border border-purple-500/30 text-purple-600 hover:bg-purple-500/5'}`}
            >
              <span className={`h-2 w-2 rounded-full bg-purple-500 ${productionStats.inProgress > 0 ? 'animate-ping' : ''}`}></span>
              <span>🟣 In-Progress (生産中)</span>
              <span className="rounded-full bg-purple-500/20 px-1.5 py-0.2 text-[10px] font-black">
                {productionStats.inProgress}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setProductionFilter('completed')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${productionFilter === 'completed' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-surface border border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/5'}`}
            >
              <span>✅ Completed (完了)</span>
              <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-black">
                {productionStats.completed}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setProductionFilter('pending')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${productionFilter === 'pending' ? 'bg-slate-700 text-white shadow-sm' : 'bg-surface border border-outline-variant/40 text-outline hover:text-on-surface'}`}
            >
              <span>⏸️ Pending (待機中)</span>
              <span className="rounded-full bg-surface-variant/60 px-1.5 py-0.2 text-[10px] font-black">
                {productionStats.pending}
              </span>
            </button>

            {productionStats.canceled > 0 && (
              <button
                type="button"
                onClick={() => setProductionFilter('canceled')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${productionFilter === 'canceled' ? 'bg-rose-600 text-white shadow-sm' : 'bg-surface border border-rose-500/30 text-rose-600 hover:bg-rose-500/5'}`}
              >
                <span>❌ Canceled (中止)</span>
                <span className="rounded-full bg-rose-500/20 px-1.5 py-0.2 text-[10px] font-black">
                  {productionStats.canceled}
                </span>
              </button>
            )}
          </div>

          {/* Processes List */}
          {loadingProduction ? (
            <div className="flex flex-col items-center justify-center p-12 glass-card rounded-2xl border border-outline-variant/30">
              <span className="material-symbols-outlined text-primary animate-spin" style={{ fontSize: 36 }}>sync</span>
              <p className="mt-3 text-sm font-semibold text-outline">Loading production status from tablet...</p>
            </div>
          ) : filteredProductionGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 glass-card rounded-2xl border border-outline-variant/30 text-center">
              <span className="material-symbols-outlined text-outline mb-2" style={{ fontSize: 44 }}>event_busy</span>
              <h3 className="text-base font-bold text-on-surface">
                {productionGroups.length === 0 ? `No production schedule found for ${productionDateStr}` : `No processes matching "${productionFilter}" filter`}
              </h3>
              <p className="text-xs text-outline mt-1 max-w-md">
                {productionGroups.length === 0 
                  ? 'There is no priority schedule configured for this day yet. You can create one in the Scheduling tab.' 
                  : 'Try selecting a different status filter above to see scheduled processes.'}
              </p>
              {productionGroups.length === 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDateStr(productionDateStr);
                    navigate('/firstFactory/scheduling');
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary/90 transition-colors shadow-sm"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit_calendar</span>
                  Create Schedule for this Date
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filteredProductionGroups.map((group) => {
                const isInProgress = group.status === 'in-progress';
                const isCompleted = group.status === 'completed';
                const isCanceled = group.status === 'canceled';
                const isPending = group.status === 'pending';

                if (group.type === 'setup') {
                  const setupItem = group.items[0];
                  return (
                    <div 
                      key={group.groupId}
                      className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="inline-flex min-h-[36px] min-w-[54px] px-3 py-1.5 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-xs font-black text-amber-700 whitespace-nowrap shadow-xs">
                          {group.orderRange}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-extrabold text-amber-800">
                              段取り / 段替 (Setup)
                            </span>
                            <h4 className="font-bold text-sm text-on-surface">{group.name}</h4>
                          </div>
                          <p className="text-xs text-outline mt-0.5">
                            🕒 Scheduled: {group.startTime} ～ {group.endTime} ({group.totalDuration} mins)
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-700 border border-amber-500/20">
                          ⚙️ {group.totalDuration} 分
                        </span>
                      </div>
                    </div>
                  );
                }

                // Hinban Group Card
                return (
                  <div
                    key={group.groupId}
                    className={`glass-card rounded-2xl border p-5 flex flex-col gap-4 transition-all shadow-xs ${
                      isInProgress
                        ? 'border-purple-500/60 bg-purple-500/[0.04] ring-2 ring-purple-500/20 dark:bg-purple-950/20'
                        : isCompleted
                        ? 'border-emerald-500/40 bg-emerald-500/[0.03] dark:bg-emerald-950/10'
                        : isCanceled
                        ? 'border-rose-500/40 bg-rose-500/[0.03]'
                        : 'border-outline-variant/30 hover:border-primary/40'
                    }`}
                  >
                    {/* Card Top Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-outline-variant/20">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex min-h-[36px] min-w-[54px] px-3 py-1.5 shrink-0 items-center justify-center rounded-xl text-xs font-black whitespace-nowrap shadow-xs ${
                          isInProgress
                            ? 'bg-purple-600 text-white animate-pulse'
                            : isCompleted
                            ? 'bg-emerald-600 text-white'
                            : 'bg-primary/10 text-primary'
                        }`}>
                          {group.orderRange}
                        </span>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <button 
                              type="button"
                              onClick={() => handleCardClick(group.hinban)}
                              className="text-lg font-black text-on-surface hover:text-primary transition-colors cursor-pointer tracking-tight inline-flex items-center gap-1.5 group text-left"
                              title="Click to view material master details"
                            >
                              <span className="group-hover:underline underline-offset-4 decoration-primary decoration-2">{group.hinban}</span>
                              <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors opacity-60 group-hover:opacity-100" style={{ fontSize: 18 }}>
                                open_in_new
                              </span>
                            </button>
                            {group.labelHinban && group.labelHinban !== group.hinban && (
                              <span className="rounded bg-surface-variant/60 px-2 py-0.5 text-xs font-mono font-medium text-outline">
                                Label: {group.labelHinban}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-outline font-medium mt-0.5">
                            {group.hinmei || '—'}
                          </p>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="flex items-center gap-2">
                        {isInProgress && (
                          <div className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm animate-pulse">
                            <span className="h-2 w-2 rounded-full bg-white animate-ping"></span>
                            <span>🟣 生産中 (In-Progress)</span>
                            {group.actualStartTime && (
                              <span className="font-mono opacity-90">({group.actualStartTime}〜)</span>
                            )}
                          </div>
                        )}

                        {isCompleted && (
                          <div className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600 border border-emerald-500/20">
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
                            <span>完了 (Completed)</span>
                            {group.actualDurationMins && (
                              <span className="font-mono font-semibold">({group.actualDurationMins}分)</span>
                            )}
                          </div>
                        )}

                        {isPending && (
                          <div className="inline-flex items-center gap-1.5 rounded-xl bg-surface-variant/40 px-3 py-1.5 text-xs font-semibold text-outline border border-outline-variant/30">
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>hourglass_empty</span>
                            <span>待機中 (Pending)</span>
                          </div>
                        )}

                        {isCanceled && (
                          <div className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-600 border border-rose-500/20">
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>cancel</span>
                            <span>中止 (Canceled)</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Metadata Specs Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
                      <div className="rounded-xl bg-surface-variant/20 p-2.5">
                        <span className="text-[10px] font-semibold uppercase text-outline block">Scheduled Time</span>
                        <span className="font-mono font-bold text-on-surface mt-0.5 block">
                          🕒 {group.startTime} ～ {group.endTime}
                        </span>
                      </div>

                      <div className="rounded-xl bg-surface-variant/20 p-2.5">
                        <span className="text-[10px] font-semibold uppercase text-outline block">Total Volume</span>
                        <span className="font-bold text-primary mt-0.5 block">
                          {group.items.length} rolls ({group.totalMeters}m)
                        </span>
                      </div>

                      <div className="rounded-xl bg-surface-variant/20 p-2.5">
                        <span className="text-[10px] font-semibold uppercase text-outline block">Kizai / Color</span>
                        <span className="font-medium text-on-surface mt-0.5 block truncate">
                          {group.kizai || '—'} {group.color ? `• ${group.color}` : ''}
                        </span>
                      </div>

                      <div className="rounded-xl bg-surface-variant/20 p-2.5">
                        <span className="text-[10px] font-semibold uppercase text-outline block">Destination</span>
                        <span className="font-medium text-on-surface mt-0.5 block truncate">
                          {group.shippingDest || '—'}
                        </span>
                      </div>

                      <div className="rounded-xl bg-surface-variant/20 p-2.5">
                        <span className="text-[10px] font-semibold uppercase text-outline block">Operator</span>
                        <span className="font-semibold text-on-surface mt-0.5 block truncate">
                          👤 {group.worker || '—'}
                        </span>
                      </div>

                      <div className="rounded-xl bg-surface-variant/20 p-2.5">
                        <span className="text-[10px] font-semibold uppercase text-outline block">Machine</span>
                        <span className="font-mono font-bold text-on-surface mt-0.5 block">
                          🏭 {group.machine || 'PSA2'}
                        </span>
                      </div>
                    </div>

                    {/* Rolls Sub-list */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-[11px] font-bold text-outline uppercase mr-1">Rolls:</span>
                      {group.items.map((roll, rIdx) => (
                        <div
                          key={roll.id || rIdx}
                          className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/30 bg-background/50 px-2.5 py-1 text-xs"
                        >
                          <span className="font-bold text-primary">
                            #{roll.rollIndex || (rIdx + 1)}/{roll.totalRolls || group.items.length}
                          </span>
                          <span className="text-outline font-mono">{roll.meters}m</span>
                          <span className="text-outline text-[11px]">({roll.duration}m)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      <MaterialDetailModal modalData={modalData} onClose={() => setModalData(null)} />


      {/* Sync Excel Modal */}
      {isSyncModalOpen && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
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
