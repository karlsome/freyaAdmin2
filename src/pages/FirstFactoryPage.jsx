import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import MasterTabNav from '../components/MasterTabNav';
import PageHeader from '../components/PageHeader';
import MaterialDetailModal from '../components/MaterialDetailModal';
import DataTable from '../components/DataTable';
import { BASE_URL } from '../services/api';
import { readStoredAuthUser, getAuthDisplayName } from '../utils/auth';
import { openFirstFactorySchedulePrintWindow } from '../utils/firstFactoryPdfExport';
import * as xlsx from 'xlsx';

export default function FirstFactoryPage() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { tab: routeTab } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  
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

  const isValidDateStr = (str) => typeof str === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(str);
  const dateFromUrl = searchParams.get('date');
  
  const [selectedDateStr, setSelectedDateStr] = useState(() => {
    if (dateFromUrl && isValidDateStr(dateFromUrl)) {
      return dateFromUrl;
    }
    return getLocalYYYYMMDD();
  });

  const updateSelectedDate = (newDate) => {
    setSelectedDateStr(newDate);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('date', newDate);
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    const urlDate = searchParams.get('date');
    if (urlDate && isValidDateStr(urlDate) && urlDate !== selectedDateStr) {
      setSelectedDateStr(urlDate);
    } else if (!urlDate && activeTab === 'scheduling') {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('date', selectedDateStr);
        return next;
      }, { replace: true });
    }
  }, [searchParams, activeTab, selectedDateStr]);
  
  // Extract month (YYYY-MM) and day (1-31) from selectedDateStr
  const selectedMonth = selectedDateStr.substring(0, 7);
  const selectedDay = parseInt(selectedDateStr.substring(8, 10), 10);

  const selectedDayOfWeekInfo = useMemo(() => {
    if (!selectedDateStr) return { day: 0, ja: '—', en: '—', isSunday: false, isSaturday: false };
    const [y, m, d] = selectedDateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const day = dateObj.getDay();
    const ja = ['日', '月', '火', '水', '木', '金', '土'][day];
    const en = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day];
    return {
      day,
      ja,
      en,
      isSunday: day === 0,
      isSaturday: day === 6
    };
  }, [selectedDateStr]);

  const handleMonthChange = (e) => {
    const newMonth = e.target.value;
    if (!newMonth) return;
    const parts = selectedDateStr.split('-');
    let day = parts[2];
    if (parseInt(day, 10) > 28) day = '01'; // Safe fallback for shortest month
    updateSelectedDate(`${newMonth}-${day}`);
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
  const [syncImpactReport, setSyncImpactReport] = useState([]);
  const [isImpactModalOpen, setIsImpactModalOpen] = useState(false);
  const [isDiscrepancyModalOpen, setIsDiscrepancyModalOpen] = useState(false);
  const [setupComments, setSetupComments] = useState({});
  const [commentModalItem, setCommentModalItem] = useState(null);
  const [tempCommentText, setTempCommentText] = useState('');

  // Helper to extract Kataban (型番) from material/BOM master
  const extractKataban = (item) => {
    if (!item) return '';
    if (item.materialInfo?.kataban) return item.materialInfo.kataban;
    const rawMaster = item.materialInfo?.rawMaster || {};
    const hinmoku = rawMaster['品目マスタ'] || {};
    if (hinmoku['型番'] && hinmoku['型番'] !== '*' && String(hinmoku['型番']).trim() !== '') {
      return String(hinmoku['型番']).trim();
    }
    if (rawMaster['型番'] && rawMaster['型番'] !== '*' && String(rawMaster['型番']).trim() !== '') {
      return String(rawMaster['型番']).trim();
    }
    if (item['型番'] && item['型番'] !== '*' && String(item['型番']).trim() !== '') {
      return String(item['型番']).trim();
    }
    const bom = Array.isArray(rawMaster.BOM) ? rawMaster.BOM : [];
    const p2010 = bom.find(b => Number(b['工程コード']) === 2010 || b['工程名'] === '粘着工程' || b['工程略名'] === '粘着');
    if (p2010 && p2010['型番'] && p2010['型番'] !== '*' && String(p2010['型番']).trim() !== '') {
      return String(p2010['型番']).trim();
    }
    for (const b of bom) {
      if (b['型番'] && b['型番'] !== '*' && String(b['型番']).trim() !== '') {
        return String(b['型番']).trim();
      }
    }
    return '';
  };

  // Helper to extract Time Option (時間オプション) from BOM process 2010
  const extractTimeOption = (item) => {
    if (!item) return '';
    if (item.materialInfo?.timeOption) return item.materialInfo.timeOption;
    const rawMaster = item.materialInfo?.rawMaster || {};
    const bom = Array.isArray(rawMaster.BOM) ? rawMaster.BOM : [];
    const p2010 = bom.find(b => Number(b['工程コード']) === 2010 || b['工程名'] === '粘着工程' || b['工程略名'] === '粘着');
    if (p2010 && p2010['時間オプション'] && p2010['時間オプション'] !== '*' && String(p2010['時間オプション']).trim() !== '') {
      return String(p2010['時間オプション']).trim();
    }
    return '';
  };

  // Helper to extract production unit string ('cm'/'㎝', 'm', '枚', etc.) from process 2010
  const extractProdUnitName = (item) => {
    if (!item) return 'm';
    const rawUnit = item.materialInfo?.rawUnit;
    if (rawUnit) {
      const name = typeof rawUnit === 'object' ? (rawUnit.name || '') : String(rawUnit);
      if (name) return name.trim();
    }
    const rawMaster = item.materialInfo?.rawMaster || {};
    const bom = Array.isArray(rawMaster.BOM) ? rawMaster.BOM : [];
    const p2010 = bom.find(b => Number(b['工程コード']) === 2010 || b['工程名'] === '粘着工程' || b['工程略名'] === '粘着');
    if (p2010 && p2010['生産単位']) {
      const name = typeof p2010['生産単位'] === 'object' ? (p2010['生産単位'].name || '') : String(p2010['生産単位']);
      if (name) return name.trim();
    }
    return item.materialInfo?.unit || 'm';
  };

  // Helper to extract unit (m vs 枚) from BOM process 2010
  const extractUnit = (item) => {
    if (!item) return 'm';
    const prodUnitName = extractProdUnitName(item);
    if (prodUnitName === '枚') return '枚';
    return 'm';
  };

  // Helper to get packCount converted to centimeters based on 生産単位.name
  const getPackCountCm = (item, defaultCm = 4000) => {
    const rawPackCount = Number(item?.materialInfo?.packCount);
    if (!rawPackCount || rawPackCount <= 0) return defaultCm;

    const prodUnitName = extractProdUnitName(item);
    
    // If unit is explicitly cm / ㎝ / センチ
    if (prodUnitName === '㎝' || prodUnitName.toLowerCase() === 'cm' || prodUnitName === 'センチ') {
      return rawPackCount; // already in cm (e.g. 4000 cm = 40m)
    }
    
    // If unit is explicitly meters (m / ｍ / メートル)
    if (prodUnitName === 'm' || prodUnitName === 'M' || prodUnitName === 'ｍ' || prodUnitName === 'メートル') {
      return rawPackCount * 100; // convert meters to cm (e.g. 40m -> 4000 cm)
    }

    // Heuristic fallback if unit is unknown: >= 500 is almost certainly in cm (e.g. 4000, 2500), otherwise meters (e.g. 40, 50)
    return rawPackCount >= 500 ? rawPackCount : rawPackCount * 100;
  };

  // Helper to compute duration in minutes based on workTime, quantity, and 生産単位.name
  const computeDurationMins = (item, qty, unit) => {
    const workTime = item?.materialInfo?.workTime || 0.075;
    if (!qty || qty <= 0) return 0;

    const prodUnitName = extractProdUnitName(item);

    // If unit is sheets (枚)
    if (unit === '枚' || prodUnitName === '枚') {
      return (workTime * qty) / 60;
    }

    // If unit is meters and 生産単位 is explicitly meters (m / M / ｍ / メートル)
    if (prodUnitName === 'm' || prodUnitName === 'M' || prodUnitName === 'ｍ' || prodUnitName === 'メートル') {
      return (workTime * qty) / 60;
    }

    // Otherwise, for meter products with 生産単位 in cm (㎝ / cm / センチ) or default:
    // qty (in meters) converted to cm is qty * 100
    const qtyCm = qty * 100;
    return (workTime * qtyCm) / 60;
  };

  // Helper to split a hinban production quantity into roll / pack items
  const createRollItemsForHinban = (foundItem, dayIndex) => {
    if (!foundItem) return [];
    const qty = foundItem.production[dayIndex] || 0;
    const unit = extractUnit(foundItem);
    
    if (qty <= 0) return [];

    if (unit === '枚') {
      const packCount = Number(foundItem.materialInfo?.packCount) > 0 ? Number(foundItem.materialInfo.packCount) : 100;
      const numRolls = Math.ceil(qty / packCount);
      const items = [];
      for (let i = 0; i < numRolls; i++) {
        let sheetCount = packCount;
        if (i === numRolls - 1 && (qty % packCount !== 0)) {
          sheetCount = qty % packCount;
        }
        const durationMins = computeDurationMins(foundItem, sheetCount, '枚');
        items.push({
          id: Date.now() + String(i) + Math.random().toString(36).substring(2, 7),
          type: 'hinban',
          hinban: foundItem.hinban,
          poolItemId: foundItem.id,
          rollIndex: i + 1,
          totalRolls: numRolls,
          meters: sheetCount,
          unit: '枚',
          duration: Math.round(durationMins)
        });
      }
      return items;
    } else {
      const qtyCm = qty * 100;
      const packCountCm = getPackCountCm(foundItem, 4000);
      const numRolls = Math.ceil(qtyCm / packCountCm);
      const items = [];
      for (let i = 0; i < numRolls; i++) {
        let lengthCm = packCountCm;
        if (i === numRolls - 1 && (qtyCm % packCountCm !== 0)) {
          lengthCm = qtyCm % packCountCm;
        }
        const rollMeters = lengthCm / 100;
        const durationMins = computeDurationMins(foundItem, rollMeters, 'm');
        items.push({
          id: Date.now() + String(i) + Math.random().toString(36).substring(2, 7),
          type: 'hinban',
          hinban: foundItem.hinban,
          poolItemId: foundItem.id,
          rollIndex: i + 1,
          totalRolls: numRolls,
          meters: rollMeters,
          unit: 'm',
          duration: Math.round(durationMins)
        });
      }
      return items;
    }
  };

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
      let hasFoundOrders = false;
      let hasFoundProd = false;
      
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        const valB = String(row[1] || '').trim();
        const isHinbanRow = valB.length === 20 && /^[A-Z0-9\/\*\-\.]+$/.test(valB);

        if (isHinbanRow) {
          if (currentBlock) parsedData.push(currentBlock);
          currentBlock = {
            id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
            month: monthToSync,
            hinban: valB,
            orders: Array(31).fill(0),
            production: Array(31).fill(0)
          };
          hasFoundOrders = false;
          hasFoundProd = false;
          continue;
        }

        if (currentBlock) {
          let rowLabel = '';
          for (let c = 0; c < 6; c++) if (row[c]) rowLabel += String(row[c]);

          const isOrderRow = rowLabel.includes('受注') || rowLabel.includes('出荷');
          const isProdRow = rowLabel.includes('生産');

          if (isOrderRow && !hasFoundOrders) {
            for (let i = 0; i < 31; i++) {
              currentBlock.orders[i] = Number(Number(row[5 + i] || 0).toFixed(1));
            }
            hasFoundOrders = true;
          } else if (isProdRow && !hasFoundProd) {
            for (let i = 0; i < 31; i++) {
              currentBlock.production[i] = Number(Number(row[5 + i] || 0).toFixed(1));
            }
            hasFoundProd = true;
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
        // Detect impact across existing saved schedules
        const impact = [];
        savedSchedules.forEach(sched => {
          const dayNum = Number(sched.date);
          if (!dayNum || !Array.isArray(sched.scheduleOrder) || sched.scheduleOrder.length === 0) return;

          const dayIssues = [];
          const uniqueHinbans = [...new Set(sched.scheduleOrder.filter(i => i.type === 'hinban' && i.hinban).map(i => i.hinban))];

          uniqueHinbans.forEach(hinban => {
            const scheduledRolls = sched.scheduleOrder.filter(i => i.hinban === hinban);
            const scheduledMeters = scheduledRolls.reduce((sum, r) => sum + (Number(r.meters) || 0), 0);
            const found = parsedData.find(i => i.hinban === hinban);

            if (!found) {
              dayIssues.push({
                hinban,
                type: 'missing',
                text: 'Not found in Excel dataset for this month'
              });
            } else {
              const prodQty = found.production[dayNum - 1] || 0;
              if (prodQty === 0) {
                const otherDays = [];
                for (let d = 1; d <= 31; d++) {
                  if ((found.production[d - 1] || 0) > 0) {
                    otherDays.push(`${d}th (${found.production[d - 1]}m)`);
                  }
                }
                dayIssues.push({
                  hinban,
                  type: 'moved_or_zero',
                  text: otherDays.length > 0 ? `Moved in Excel to: Day ${otherDays.join(', ')} (0m on Day ${dayNum})` : `Excel production reduced to 0m`
                });
              } else if (Number(prodQty.toFixed(1)) !== Number(scheduledMeters.toFixed(1))) {
                dayIssues.push({
                  hinban,
                  type: 'qty_mismatch',
                  text: `Quantity changed: Scheduled ${scheduledMeters}m → Excel ${prodQty}m`
                });
              }
            }
          });

          if (dayIssues.length > 0) {
            impact.push({
              date: dayNum,
              dateKey: `${monthToSync}-${String(dayNum).padStart(2, '0')}`,
              issues: dayIssues
            });
          }
        });

        if (impact.length > 0) {
          setSyncImpactReport(impact);
          setIsImpactModalOpen(true);
        } else {
          alert(saveJson.message);
        }

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
  const [collapsedGroups, setCollapsedGroups] = useState({});
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
    if (!newDate) return;
    if (hasUnsavedChanges) {
      if (!window.confirm(t('unsavedChangesWarning') || "You have unsaved changes! Are you sure you want to change the date? Unsaved progress will be lost.")) {
        return;
      }
    }
    updateSelectedDate(newDate);
  };

  const handleStepDate = (offset) => {
    if (hasUnsavedChanges) {
      if (!window.confirm(t('unsavedChangesWarning') || "You have unsaved changes! Are you sure you want to change the date? Unsaved progress will be lost.")) {
        return;
      }
    }
    const [y, m, d] = selectedDateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + offset);
    
    const nextY = dateObj.getFullYear();
    const nextM = String(dateObj.getMonth() + 1).padStart(2, '0');
    const nextD = String(dateObj.getDate()).padStart(2, '0');
    updateSelectedDate(`${nextY}-${nextM}-${nextD}`);
  };

  const handleGoToToday = () => {
    const today = getLocalYYYYMMDD();
    if (selectedDateStr === today) return;
    if (hasUnsavedChanges) {
      if (!window.confirm(t('unsavedChangesWarning') || "You have unsaved changes! Are you sure you want to change the date? Unsaved progress will be lost.")) {
        return;
      }
    }
    updateSelectedDate(today);
  };

  const handleTabChange = (nextTab) => {
    if (activeTab === 'scheduling' && nextTab !== 'scheduling' && hasUnsavedChanges) {
      if (!window.confirm(t('unsavedChangesWarning') || "You have unsaved changes! Are you sure you want to switch tabs? Unsaved progress will be lost.")) {
        return;
      }
    }
    navigate(`/firstFactory/${nextTab}?date=${selectedDateStr}`);
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
  const [poolSortBy, setPoolSortBy] = useState('timeOption-asc');
  const [poolBatchFilter, setPoolBatchFilter] = useState('all'); // 'all' | 'large' (>=500m) | 'small' (<200m)
  const [poolWidthFilter, setPoolWidthFilter] = useState('all');
  
  const poolItems = useMemo(() => {
    const scheduledIds = new Set(scheduleOrder.map(s => s.poolItemId).filter(Boolean));
    return dailyProductionItems.filter(item => {
      if (scheduledIds.has(item.id)) return false;
      if (poolSearch) {
        const q = poolSearch.toLowerCase();
        const kataban = extractKataban(item).toLowerCase();
        const timeOpt = extractTimeOption(item).toLowerCase();
        const matchesHinban = item.hinban.toLowerCase().includes(q);
        const matchesKataban = kataban.includes(q);
        const matchesTimeOpt = timeOpt.includes(q);
        if (!matchesHinban && !matchesKataban && !matchesTimeOpt) return false;
      }
      
      // First Factory page focuses ONLY on products that have Process 2010 (粘着工程) in BOM or Master
      const bomItems = item.materialInfo?.rawMaster?.['BOM'] || [];
      const hasProcess2010 = Boolean(
        item.materialInfo?.hasProcess2010 ||
        bomItems.some(b => Number(b['工程コード']) === 2010 || String(b['工程コード'] || '').startsWith('2010') || b['工程名'] === '粘着工程' || b['工程略名'] === '粘着') ||
        String(item.materialInfo?.rawMaster?.['品目マスタ']?.['工程コード'] || '').startsWith('2010') ||
        Number(item.materialInfo?.rawMaster?.['resolved']?.['工程コード']?.code) === 2010 ||
        item.materialInfo?.rawMaster?.['resolved']?.['工程コード']?.name === '粘着工程'
      );
      if (!hasProcess2010) {
        return false;
      }

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

  // Compute available widths from poolItems
  const availableWidths = useMemo(() => {
    const set = new Set();
    poolItems.forEach(item => {
      const match = item.hinban?.match(/W\d+/i);
      if (match) set.add(match[0].toUpperCase());
    });
    return Array.from(set).sort();
  }, [poolItems]);

  const processedPoolItems = useMemo(() => {
    let items = poolItems.map(item => {
      const qty = item.production[selectedDay - 1] || 0;
      const unit = extractUnit(item);
      const kataban = extractKataban(item);
      const timeOption = extractTimeOption(item);
      const workTime = item.materialInfo?.workTime || 0.075;
      const width = item.hinban?.match(/W\d+/i)?.[0]?.toUpperCase() || '';

      let numRolls = 0;
      const durationMins = Math.round(computeDurationMins(item, qty, unit));

      if (unit === '枚') {
        const packCount = Number(item.materialInfo?.packCount) > 0 ? Number(item.materialInfo.packCount) : 100;
        numRolls = qty > 0 ? Math.ceil(qty / packCount) : 0;
      } else {
        const qtyCm = qty * 100;
        const packCountCm = getPackCountCm(item, 4000);
        numRolls = qtyCm > 0 ? Math.ceil(qtyCm / packCountCm) : 0;
      }

      return {
        ...item,
        _qty: qty,
        _unit: unit,
        _numRolls: numRolls,
        _durationMins: durationMins,
        _width: width,
        _kataban: kataban,
        _timeOption: timeOption
      };
    });

    // Apply batch size filter
    if (poolBatchFilter === 'large') {
      items = items.filter(i => i._qty >= 500 || i._numRolls >= 5);
    } else if (poolBatchFilter === 'small') {
      items = items.filter(i => i._qty < 200);
    }

    // Apply width filter
    if (poolWidthFilter !== 'all') {
      items = items.filter(i => i._width === poolWidthFilter);
    }

    // Apply sorting
    if (poolSortBy === 'kataban-asc') {
      items.sort((a, b) => (a._kataban || '').localeCompare(b._kataban || '') || (a._timeOption || '').localeCompare(b._timeOption || '') || a.hinban.localeCompare(b.hinban));
    } else if (poolSortBy === 'kataban-desc') {
      items.sort((a, b) => (b._kataban || '').localeCompare(a._kataban || '') || (b._timeOption || '').localeCompare(a._timeOption || '') || a.hinban.localeCompare(b.hinban));
    } else if (poolSortBy === 'timeOption-asc') {
      items.sort((a, b) => (a._timeOption || '').localeCompare(b._timeOption || '') || (a._kataban || '').localeCompare(b._kataban || '') || a.hinban.localeCompare(b.hinban));
    } else if (poolSortBy === 'timeOption-desc') {
      items.sort((a, b) => (b._timeOption || '').localeCompare(a._timeOption || '') || (b._kataban || '').localeCompare(a._kataban || '') || a.hinban.localeCompare(b.hinban));
    } else if (poolSortBy === 'duration-desc') {
      items.sort((a, b) => b._durationMins - a._durationMins || b._qty - a._qty);
    } else if (poolSortBy === 'duration-asc') {
      items.sort((a, b) => a._durationMins - b._durationMins || a._qty - b._qty);
    } else if (poolSortBy === 'qty-desc') {
      items.sort((a, b) => b._qty - a._qty);
    } else if (poolSortBy === 'qty-asc') {
      items.sort((a, b) => a._qty - b._qty);
    } else if (poolSortBy === 'rolls-desc') {
      items.sort((a, b) => b._numRolls - a._numRolls || b._qty - a._qty);
    } else if (poolSortBy === 'hinban-asc') {
      items.sort((a, b) => a.hinban.localeCompare(b.hinban));
    }

    return items;
  }, [poolItems, selectedDay, poolBatchFilter, poolWidthFilter, poolSortBy]);

  const poolTotalMins = useMemo(() => {
    return processedPoolItems.reduce((acc, item) => acc + (item._durationMins || 0), 0);
  }, [processedPoolItems]);

  const scheduledTotalMins = useMemo(() => {
    return scheduledItems.reduce((acc, item) => acc + (item.duration || 0), 0);
  }, [scheduledItems]);

  const formatTime = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  };

  // --- DISCREPANCY DETECTION FOR THE SELECTED DATE ---
  const currentDayDiscrepancies = useMemo(() => {
    if (!scheduleOrder || scheduleOrder.length === 0) {
      return { map: {}, list: [], count: 0 };
    }

    const hinbanGroups = {};
    scheduleOrder.forEach(item => {
      if (item.type === 'hinban' && item.hinban) {
        if (!hinbanGroups[item.hinban]) {
          hinbanGroups[item.hinban] = [];
        }
        hinbanGroups[item.hinban].push(item);
      }
    });

    const map = {};
    const list = [];

    Object.entries(hinbanGroups).forEach(([hinban, rolls]) => {
      const scheduledMeters = Number(rolls.reduce((sum, r) => sum + (Number(r.meters) || 0), 0).toFixed(1));
      const foundRow = data.find(i => i.hinban === hinban);

      if (!foundRow) {
        const disc = {
          hinban,
          type: 'missing_in_excel',
          excelQty: 0,
          scheduledMeters,
          message: '品番が今月のエクセルデータに存在しません (Not in Excel)',
          rollsCount: rolls.length
        };
        map[hinban] = disc;
        list.push(disc);
      } else {
        const excelQty = Number((foundRow.production[selectedDay - 1] || 0).toFixed(1));
        if (excelQty === 0) {
          const otherDays = [];
          for (let d = 1; d <= 31; d++) {
            const q = foundRow.production[d - 1] || 0;
            if (q > 0) {
              otherDays.push(`${d}日 (${q}m)`);
            }
          }
          const movedText = otherDays.length > 0 
            ? `エクセルで他日程に移動: ${otherDays.join(', ')}` 
            : 'エクセル生産数: 0m';
          
          const disc = {
            hinban,
            type: 'moved_or_zero',
            excelQty: 0,
            scheduledMeters,
            movedText,
            message: movedText,
            rollsCount: rolls.length,
            foundRow
          };
          map[hinban] = disc;
          list.push(disc);
        } else if (excelQty !== scheduledMeters) {
          const disc = {
            hinban,
            type: 'qty_mismatch',
            excelQty,
            scheduledMeters,
            message: `エクセル数量不一致: スケジュール ${scheduledMeters}m → エクセル ${excelQty}m`,
            rollsCount: rolls.length,
            foundRow
          };
          map[hinban] = disc;
          list.push(disc);
        }
      }
    });

    return {
      map,
      list,
      count: list.length
    };
  }, [scheduleOrder, data, selectedDay]);

  // Auto-align ONLY for the currently selected date (does not touch any other dates)
  const handleAutoAlignCurrentDate = () => {
    if (currentDayDiscrepancies.count === 0) return;

    setScheduleOrder(prevOrder => {
      let newOrder = [];
      const processedHinbans = new Set();

      for (let i = 0; i < prevOrder.length; i++) {
        const item = prevOrder[i];
        if (item.type === 'setup') {
          newOrder.push(item);
          continue;
        }

        const hinban = item.hinban;
        const disc = currentDayDiscrepancies.map[hinban];

        if (!disc) {
          // No discrepancy, retain item
          newOrder.push(item);
        } else if (disc.type === 'moved_or_zero' || disc.type === 'missing_in_excel') {
          // 0m or missing in Excel: remove from this day's schedule
          continue;
        } else if (disc.type === 'qty_mismatch') {
          // Replace rolls with updated roll breakdown at this position
          if (!processedHinbans.has(hinban)) {
            processedHinbans.add(hinban);
            const updatedRolls = createRollItemsForHinban(disc.foundRow, selectedDay - 1);
            newOrder.push(...updatedRolls);
          }
        }
      }

      return newOrder;
    });

    setIsDiscrepancyModalOpen(false);
  };

  const handleUpdateHinbanQty = (hinban) => {
    const disc = currentDayDiscrepancies.map[hinban];
    if (!disc || !disc.foundRow) return;

    setScheduleOrder(prevOrder => {
      const newOrder = [];
      let replaced = false;

      for (let i = 0; i < prevOrder.length; i++) {
        const item = prevOrder[i];
        if (item.type === 'hinban' && item.hinban === hinban) {
          if (!replaced) {
            replaced = true;
            const updatedRolls = createRollItemsForHinban(disc.foundRow, selectedDay - 1);
            newOrder.push(...updatedRolls);
          }
        } else {
          newOrder.push(item);
        }
      }

      return newOrder;
    });
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
        alert(t('ff_scheduleSavedSuccess') + ` (${selectedDateStr})`);
        fetchSchedule(selectedMonth); // Refresh
      }
    } catch (err) {
      console.error('Error saving order:', err);
      alert(t('ff_scheduleSaveError'));
    }
  };

  // --- MONTHLY SUMMARY COMPUTATION ---
  const daysInSelectedMonth = useMemo(() => {
    if (!selectedMonth) return 31;
    const [y, m] = selectedMonth.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  }, [selectedMonth]);

  const [summaryViewMode, setSummaryViewMode] = useState(() => {
    try {
      return localStorage.getItem('firstFactory_summaryViewMode') || 'priority';
    } catch {
      return 'priority';
    }
  });

  const handleSummaryViewModeChange = (mode) => {
    setSummaryViewMode(mode);
    try {
      localStorage.setItem('firstFactory_summaryViewMode', mode);
    } catch (err) {
      console.warn('Failed to save summaryViewMode to localStorage:', err);
    }
  };

  const monthSummaryData = useMemo(() => {
    let totalMins = 0;
    let daysWithWorkCount = 0;
    let totalItemsCount = 0;
    let totalSetupCount = 0;
    let totalMetersMonth = 0;
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

      if (summaryViewMode === 'priority') {
        let dayTotalMins = 0;
        let startTime = saved?.startTime || '09:00';
        let endTime = '—';
        let scheduledBy = saved?.scheduledBy || '—';
        let updatedAtStr = saved?.updatedAt ? new Date(saved.updatedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
        let itemCount = 0;
        let setupCount = 0;
        let hinbanCount = 0;
        const dayUniqueHinbans = new Set();
        let mismatchCount = 0;

        if (isScheduled) {
          daysWithWorkCount++;
          itemCount = saved.scheduleOrder.length;
          totalItemsCount += itemCount;

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

          // Compute mismatch count against current Excel data
          if (data.length > 0) {
            dayUniqueHinbans.forEach(h => {
              const found = data.find(item => item.hinban === h);
              if (!found) {
                mismatchCount++;
              } else {
                const q = Number((found.production[day - 1] || 0).toFixed(1));
                const scheduledMeters = Number(saved.scheduleOrder
                  .filter(i => i.hinban === h)
                  .reduce((sum, r) => sum + (Number(r.meters) || 0), 0).toFixed(1));
                if (q === 0 || q !== scheduledMeters) {
                  mismatchCount++;
                }
              }
            });
          }

          totalMins += dayTotalMins;
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
          hasWork: isScheduled,
          dayTotalMins,
          dayTotalHours: (dayTotalMins / 60).toFixed(1),
          startTime,
          endTime,
          timeRange: isScheduled ? `${startTime} ～ ${endTime}` : '—',
          itemCount,
          setupCount,
          hinbanCount,
          uniqueHinbanCount: dayUniqueHinbans.size,
          mismatchCount,
          hasMismatch: mismatchCount > 0,
          scheduledBy,
          updatedAtStr
        });
      } else {
        // 'raw' Excel demand mode: calculates full demand regardless of schedule
        let dayTotalMins = 0;
        let dayTotalMeters = 0;
        let dayRollsCount = 0;
        const dayUniqueHinbans = new Set();

        const dayRawItems = data.filter(item => {
          const q = item.production[day - 1] || 0;
          if (q <= 0) return false;

          const bomItems = item.materialInfo?.rawMaster?.['BOM'] || [];
          const hasProcess2010 = Boolean(
            item.materialInfo?.hasProcess2010 ||
            bomItems.some(b => Number(b['工程コード']) === 2010 || String(b['工程コード'] || '').startsWith('2010') || b['工程名'] === '粘着工程' || b['工程略名'] === '粘着') ||
            String(item.materialInfo?.rawMaster?.['品目マスタ']?.['工程コード'] || '').startsWith('2010') ||
            Number(item.materialInfo?.rawMaster?.['resolved']?.['工程コード']?.code) === 2010 ||
            item.materialInfo?.rawMaster?.['resolved']?.['工程コード']?.name === '粘着工程'
          );
          return hasProcess2010;
        });

        dayRawItems.forEach(item => {
          const qty = item.production[day - 1] || 0;
          const unit = extractUnit(item);
          const workTime = item.materialInfo?.workTime || 0.075;
          let numRolls = 0;
          const durationMins = Math.round(computeDurationMins(item, qty, unit));

          if (unit === '枚') {
            const packCount = Number(item.materialInfo?.packCount) > 0 ? Number(item.materialInfo.packCount) : 100;
            numRolls = qty > 0 ? Math.ceil(qty / packCount) : 0;
          } else {
            const qtyCm = qty * 100;
            const packCountCm = getPackCountCm(item, 4000);
            numRolls = qtyCm > 0 ? Math.ceil(qtyCm / packCountCm) : 0;
          }

          dayTotalMins += durationMins;
          dayTotalMeters += qty;
          dayRollsCount += numRolls;
          dayUniqueHinbans.add(item.hinban);
          monthUniqueHinbans.add(item.hinban);
        });

        const hasDemand = dayTotalMins > 0;
        if (hasDemand) {
          daysWithWorkCount++;
          totalMins += dayTotalMins;
          totalItemsCount += dayRollsCount;
          totalMetersMonth += dayTotalMeters;
        }

        if (dayTotalMins > maxDayMins) maxDayMins = dayTotalMins;

        const startTime = '09:00';
        let endTime = '—';
        if (hasDemand) {
          const endTotal = (9 * 60) + dayTotalMins;
          const eh = Math.floor((endTotal / 60) % 24);
          const em = endTotal % 60;
          endTime = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
        }

        let mismatchCount = 0;
        if (isScheduled && data.length > 0) {
          const scheduledHinbans = new Set(saved.scheduleOrder.map(i => i.hinban).filter(Boolean));
          scheduledHinbans.forEach(h => {
            const found = data.find(item => item.hinban === h);
            if (!found) {
              mismatchCount++;
            } else {
              const q = Number((found.production[day - 1] || 0).toFixed(1));
              const scheduledMeters = Number(saved.scheduleOrder
                .filter(i => i.hinban === h)
                .reduce((sum, r) => sum + (Number(r.meters) || 0), 0).toFixed(1));
              if (q === 0 || q !== scheduledMeters) {
                mismatchCount++;
              }
            }
          });
        }

        dayRows.push({
          day,
          dateKey,
          dayOfWeek,
          dayOfWeekStr,
          isScheduled,
          hasWork: hasDemand,
          hasDemand,
          dayTotalMins,
          dayTotalHours: (dayTotalMins / 60).toFixed(1),
          dayTotalMeters,
          startTime,
          endTime,
          timeRange: hasDemand ? `${startTime} ～ ${endTime}` : '—',
          itemCount: dayRollsCount,
          setupCount: 0,
          hinbanCount: dayRollsCount,
          uniqueHinbanCount: dayUniqueHinbans.size,
          mismatchCount,
          hasMismatch: mismatchCount > 0,
          scheduledBy: saved?.scheduledBy || '—',
          updatedAtStr: saved?.updatedAt ? new Date(saved.updatedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
        });
      }
    }

    const totalHours = (totalMins / 60).toFixed(1);
    const avgHoursPerDay = daysWithWorkCount > 0 ? (totalMins / daysWithWorkCount / 60).toFixed(1) : '0.0';

    return {
      totalMins,
      totalHours,
      daysWithWorkCount,
      totalItemsCount,
      totalSetupCount,
      totalMetersMonth,
      totalMonthUniqueHinbansCount: monthUniqueHinbans.size,
      avgHoursPerDay,
      maxDayMins: maxDayMins || 480,
      dayRows
    };
  }, [selectedMonth, daysInSelectedMonth, savedSchedules, data, summaryViewMode]);

  const [summarySort, setSummarySort] = useState({ column: 'day', direction: 1 });

  const handleSummarySort = (colKey) => {
    setSummarySort(prev => {
      const currentKey = prev?.column || prev?.key || 'day';
      const currentDir = prev?.direction === -1 || prev?.direction === 'desc' ? -1 : 1;
      if (currentKey === colKey) {
        return { column: colKey, direction: currentDir === 1 ? -1 : 1 };
      }
      return { column: colKey, direction: 1 };
    });
  };

  const sortedSummaryRows = useMemo(() => {
    const rows = [...monthSummaryData.dayRows];
    const key = summarySort?.column || summarySort?.key || 'day';
    const direction = summarySort?.direction === -1 || summarySort?.direction === 'desc' ? -1 : 1;

    rows.sort((a, b) => {
      let valA = a[key];
      let valB = b[key];

      // Custom key extraction for composite fields
      if (key === 'status') {
        valA = a.isScheduled ? (a.itemCount || 0) : (a.hasDemand ? 0.5 : 0);
        valB = b.isScheduled ? (b.itemCount || 0) : (b.hasDemand ? 0.5 : 0);
      } else if (key === 'syncStatus') {
        valA = a.hasMismatch ? -(a.mismatchCount || 1) : (a.isScheduled ? 1 : 0);
        valB = b.hasMismatch ? -(b.mismatchCount || 1) : (b.isScheduled ? 1 : 0);
      }

      if (typeof valA === 'boolean') {
        valA = valA ? 1 : 0;
        valB = valB ? 1 : 0;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return direction * valA.localeCompare(valB, 'ja');
      }

      const numA = Number(valA) || 0;
      const numB = Number(valB) || 0;
      return direction * (numA - numB);
    });
    return rows;
  }, [monthSummaryData.dayRows, summarySort]);

  const summaryColumns = useMemo(() => [
    {
      key: 'day',
      label: t('ff_colDate'),
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
      key: 'status',
      label: summaryViewMode === 'priority' ? t('ff_colStatusPriority') : t('ff_colStatusRaw'),
      sortable: true,
      minWidth: 160,
      renderCell: (row) => {
        if (summaryViewMode === 'priority') {
          return row.isScheduled ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              {t('ff_scheduledBadge').replace('{count}', row.itemCount)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-outline font-medium">
              {t('ff_noScheduleBadge')}
            </span>
          );
        } else {
          if (!row.hasDemand) {
            return (
              <span className="text-outline text-xs font-medium">{t('ff_noExcelDemandBadge')}</span>
            );
          }
          return row.isScheduled ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              {t('ff_plannedAndScheduledBadge')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-700 border border-amber-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
              {t('ff_rawDemandUnscheduledBadge')}
            </span>
          );
        }
      }
    },
    {
      key: 'timeRange',
      label: summaryViewMode === 'priority' ? t('ff_colTimeRangePriority') : t('ff_colTimeRangeRaw'),
      sortable: true,
      minWidth: 150,
      renderCell: (row) => {
        return row.hasWork ? (
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
      label: summaryViewMode === 'priority' ? t('ff_colDurationPriority') : t('ff_colDurationRaw'),
      sortable: true,
      minWidth: 160,
      renderCell: (row) => {
        return row.hasWork ? (
          <span className="text-xs font-bold text-on-surface font-mono">
            {formatTime(row.dayTotalMins)} - {row.dayTotalHours}{language === 'ja' ? '時間' : 'hrs'}
          </span>
        ) : (
          <span className="text-xs text-outline">—</span>
        );
      }
    },
    {
      key: 'itemCount',
      label: summaryViewMode === 'priority' ? t('ff_colBreakdownPriority') : t('ff_colBreakdownRaw'),
      sortable: true,
      minWidth: 220,
      renderCell: (row) => {
        if (!row.hasWork) return <span className="text-outline text-xs">—</span>;
        return (
          <div className="flex items-center gap-1.5 text-xs flex-wrap">
            <span className="rounded bg-indigo-500/10 px-2 py-0.5 font-bold text-indigo-600 border border-indigo-500/20" title={`${row.uniqueHinbanCount} Unique Hinban`}>
              {row.uniqueHinbanCount} {language === 'ja' ? '品番' : 'Hinban'}
            </span>
            <span className="rounded bg-primary/10 px-2 py-0.5 font-bold text-primary" title={`${row.hinbanCount} Total Rolls`}>
              {row.hinbanCount} {language === 'ja' ? '巻' : 'rolls'}
            </span>
            {summaryViewMode === 'raw' && row.dayTotalMeters > 0 && (
              <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-bold text-emerald-700 border border-emerald-500/20">
                {row.dayTotalMeters}m
              </span>
            )}
            {summaryViewMode === 'priority' && row.setupCount > 0 && (
              <span className="rounded bg-amber-500/10 px-2 py-0.5 font-bold text-amber-700" title={`${row.setupCount} Setup Events`}>
                {row.setupCount} {language === 'ja' ? '段替' : 'setups'}
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: 'scheduledBy',
      label: t('ff_colScheduledBy'),
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
      label: t('ff_colLastSaved'),
      sortable: true,
      minWidth: 130,
      renderCell: (row) => (
        <span className="text-xs text-outline font-mono">{row.updatedAtStr}</span>
      )
    },
    {
      key: 'syncStatus',
      label: t('ff_colExcelSync'),
      sortable: true,
      minWidth: 140,
      renderCell: (row) => {
        if (!row.isScheduled) {
          if (summaryViewMode === 'raw' && row.hasDemand) {
            return (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-variant/40 px-2.5 py-1 text-xs font-semibold text-outline">
                {t('ff_unscheduledBadge')}
              </span>
            );
          }
          return <span className="text-outline text-xs">—</span>;
        }
        if (row.hasMismatch) {
          return (
            <span 
              className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-600 border border-amber-500/30"
              title={`${row.mismatchCount} scheduled hinban(s) differ from the latest Excel on this date`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>sync_problem</span>
              {language === 'ja' ? `${row.mismatchCount} 件の差異あり` : `${row.mismatchCount} Discrepanc${row.mismatchCount === 1 ? 'y' : 'ies'}`}
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 border border-emerald-500/20">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
            {t('ff_syncedBadge')}
          </span>
        );
      }
    },
    {
      key: 'actions',
      label: t('ff_colAction'),
      sortable: false,
      minWidth: 100,
      renderCell: (row) => (
        <button
          onClick={() => {
            updateSelectedDate(row.dateKey);
            navigate(`/firstFactory/scheduling?date=${row.dateKey}`);
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary hover:text-on-primary transition-colors shadow-sm cursor-pointer"
          title={t('ff_openScheduleBtn')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit_calendar</span>
          {row.isScheduled ? t('ff_openAction') : t('ff_scheduleAction')}
        </button>
      )
    }
  ], [selectedMonth, summaryViewMode, language, navigate, t]);

  // -------------------------------------------------------------
  // Production Tab State & Fetching (Realtime Tracking)
  // -------------------------------------------------------------
  const [productionDateStr, setProductionDateStr] = useState(getLocalYYYYMMDD());
  const [productionSchedule, setProductionSchedule] = useState(null);
  const [productionStatuses, setProductionStatuses] = useState([]);
  const [loadingProduction, setLoadingProduction] = useState(false);
  const [productionFilter, setProductionFilter] = useState('all');
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  const fetchProductionData = async (dateStr, isBackground = false) => {
    if (!isBackground) setLoadingProduction(true);
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
      if (!isBackground) setLoadingProduction(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'production') return;

    fetchProductionData(productionDateStr);

    // -------------------------------------------------------------
    // Realtime EventSource (SSE) Connection
    // -------------------------------------------------------------
    let eventSource = null;
    try {
      const sseUrl = `${BASE_URL}api/production/events?date=${encodeURIComponent(productionDateStr)}`;
      eventSource = new EventSource(sseUrl);

      eventSource.onopen = () => {
        setIsLiveConnected(true);
      };

      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'status_update') {
            if (data.date === productionDateStr && data.record) {
              setProductionStatuses((prev) => {
                const idx = prev.findIndex(r => r.groupId === data.groupId);
                if (idx !== -1) {
                  const updated = [...prev];
                  updated[idx] = { ...updated[idx], ...data.record };
                  return updated;
                } else {
                  return [...prev, data.record];
                }
              });
            }
          } else if (data.type === 'print_log') {
            if (data.date === productionDateStr && data.printEntry) {
              setProductionStatuses((prev) => {
                const idx = prev.findIndex(r => r.groupId === data.groupId);
                if (idx !== -1) {
                  const updated = [...prev];
                  const existingHistory = Array.isArray(updated[idx].printHistory) ? updated[idx].printHistory : [];
                  updated[idx] = {
                    ...updated[idx],
                    printHistory: [...existingHistory, data.printEntry]
                  };
                  return updated;
                } else {
                  return [...prev, { groupId: data.groupId, hinban: data.hinban, date: data.date, printHistory: [data.printEntry] }];
                }
              });
            }
          } else if (data.type === 'schedule_update') {
            fetchProductionData(productionDateStr, true);
          }
        } catch (err) {
          console.error("Error processing SSE event:", err);
        }
      };

      eventSource.onerror = () => {
        setIsLiveConnected(false);
      };
    } catch (err) {
      console.warn("Could not connect to SSE stream:", err);
    }

    // 5-second resilient polling fallback
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchProductionData(productionDateStr, true);
      }
    }, 5000);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      clearInterval(interval);
      setIsLiveConnected(false);
    };
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
        if (dragData.type === 'hinban' || dragData.type === 'hinban-group') {
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
        if (dragData.type === 'hinban-group') {
          const groupIds = new Set(dragData.ids || []);
          const movedItems = newOrder.filter(i => groupIds.has(i.id));
          const remaining = newOrder.filter(i => !groupIds.has(i.id));
          
          if (targetIndex === -1 || targetIndex >= remaining.length) {
            return [...remaining, ...movedItems];
          } else {
            const result = [...remaining];
            result.splice(targetIndex, 0, ...movedItems);
            return result;
          }
        } else {
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
        }
      } else if (source === 'pool') {
        let itemsToInsert = [];
        
        if (dragData.type === 'setup') {
          itemsToInsert.push({
            id: Date.now() + Math.random().toString(),
            type: 'setup',
            name: dragData.name,
            comment: dragData.comment || '',
            duration: dragData.duration || 15
          });
        } else if (dragData.type === 'pool-hinban') {
          const found = data.find(i => i.id === dragData.id);
          if (found) {
            itemsToInsert = createRollItemsForHinban(found, selectedDay - 1);
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
          comment: dragData.comment || '',
          duration: dragData.duration || 15
        });
      } else if (dragData.type === 'pool-hinban') {
        const found = data.find(i => i.id === dragData.id);
        if (found) {
          itemsToInsert = createRollItemsForHinban(found, selectedDay - 1);
        }
      }
      
      newOrder.push(...itemsToInsert);
      return newOrder;
    });
  };

  const handleRemoveFromSchedule = (dragData) => {
      setScheduleOrder(prev => {
        if (dragData.type === 'hinban' || dragData.type === 'hinban-group') {
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

  // Group consecutive items in scheduleWithTimes by Hinban for collapse/expand
  const scheduledGroups = useMemo(() => {
    if (!scheduleWithTimes || scheduleWithTimes.length === 0) return [];

    const groups = [];
    let currentGroup = null;

    scheduleWithTimes.forEach((item, index) => {
      if (item.type === 'setup') {
        if (currentGroup) {
          groups.push(currentGroup);
          currentGroup = null;
        }
        groups.push({
          type: 'setup',
          id: item.id,
          item,
          index,
        });
      } else {
        // Hinban item
        if (currentGroup && currentGroup.hinban === item.hinban) {
          // Append to current group
          currentGroup.items.push({ item, index });
          currentGroup.endIndex = index;
          currentGroup.endTime = item.endTime;
          currentGroup.totalDuration += (item.duration || 0);
          currentGroup.totalMeters += (Number(item.meters) || 0);
        } else {
          if (currentGroup) {
            groups.push(currentGroup);
          }
          currentGroup = {
            type: 'hinban',
            id: `group_${item.hinban}_${index}`,
            hinban: item.hinban,
            unit: item.unit || 'm',
            totalRolls: item.totalRolls || 1,
            startIndex: index,
            endIndex: index,
            startTime: item.startTime,
            endTime: item.endTime,
            totalDuration: item.duration || 0,
            totalMeters: Number(item.meters) || 0,
            items: [{ item, index }],
            representativeItem: item,
          };
        }
      }
    });

    if (currentGroup) {
      groups.push(currentGroup);
    }

    return groups;
  }, [scheduleWithTimes]);

  const multiRollGroups = useMemo(() => {
    return scheduledGroups.filter(g => g.type === 'hinban' && g.items.length > 1);
  }, [scheduledGroups]);

  const allMultiRollGroupsCollapsed = useMemo(() => {
    if (multiRollGroups.length === 0) return false;
    return multiRollGroups.every(g => (collapsedGroups[g.id] ?? true) === true);
  }, [multiRollGroups, collapsedGroups]);

  const toggleGroupCollapse = (groupId) => {
    setCollapsedGroups(prev => {
      const current = prev[groupId] ?? true;
      return { ...prev, [groupId]: !current };
    });
  };

  const handleToggleAllGroups = () => {
    const shouldCollapse = !allMultiRollGroupsCollapsed;
    setCollapsedGroups(prev => {
      const next = { ...prev };
      multiRollGroups.forEach(g => {
        next[g.id] = shouldCollapse;
      });
      return next;
    });
  };

  const scheduledEndTime = useMemo(() => {
    if (!scheduleWithTimes || scheduleWithTimes.length === 0) return null;
    return scheduleWithTimes[scheduleWithTimes.length - 1]?.endTime || null;
  }, [scheduleWithTimes]);

  const handlePrintSchedulePDF = () => {
    const authUser = readStoredAuthUser() || {};
    const fullName = getAuthDisplayName(authUser);
    openFirstFactorySchedulePrintWindow({
      dateStr: selectedDateStr,
      startTime,
      scheduleWithTimes,
      data,
      scheduledBy: fullName
    });
  };

  return (
    <div className="w-full h-screen overflow-y-auto space-y-6 pt-20 px-4 sm:px-6 md:px-8 pb-16 text-[var(--text-primary)]">
      <PageHeader
        eyebrow="First Factory"
        title={t('ff_title')}
        subtitle={t('ff_subtitle')}
        actions={
          <div className="flex items-center gap-3">
            {lastSynced && (
              <div className="text-xs text-[var(--text-muted)] text-right freya-tabular">
                <span className="block font-medium">{language === 'ja' ? '最終同期:' : 'Last Synced:'}</span>
                <span>{lastSynced}</span>
              </div>
            )}
            <button 
              onClick={() => {
                setSyncTargetMonth(selectedMonth);
                setIsSyncModalOpen(true);
              }}
              disabled={syncing}
              className="flex items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-raised)] hover:border-[var(--border-strong)] disabled:opacity-50 cursor-pointer"
              title={t('ff_syncFromExcel')}
            >
              <span className={`material-symbols-outlined ${syncing ? 'animate-spin' : ''}`} style={{ fontSize: 16 }}>sync</span>
              {syncing ? t('ff_syncing') : t('ff_syncFromExcel')}
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <MasterTabNav 
        tabs={[
          { key: 'fetching', label: t('ff_tab_fetching'), icon: 'cloud_download', ready: true },
          { key: 'scheduling', label: t('ff_tab_scheduling'), icon: 'calendar_month', ready: true },
          { key: 'summary', label: t('ff_tab_summary'), icon: 'analytics', ready: true },
          { key: 'production', label: t('ff_tab_production'), icon: 'precision_manufacturing', ready: true }
        ]}
        activeTab={activeTab}
        onSelect={(tab) => handleTabChange(tab.key)}
      />

      {activeTab === 'fetching' && (
        <>
          <div className="freya-card p-4 mb-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 18 }}>calendar_month</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={handleMonthChange}
                  className="h-9 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs text-[var(--text-primary)] font-medium outline-none focus:border-[var(--freya-blue)]"
                  title={language === 'ja' ? '表示する月を選択' : 'Select month to view'}
                />
              </div>
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" style={{ fontSize: 18 }}>search</span>
                <input
                  type="text"
                  placeholder={t('ff_searchPlaceholder')}
                  className="h-9 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-4 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--freya-blue)]"
                  value={filter}
                  onChange={handleFilterChange}
                />
              </div>
              <button className="flex h-9 items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3.5 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-raised)] hover:border-[var(--border-strong)]">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>filter_list</span>
                {t('filter')}
              </button>
            </div>
          </div>

          <div className="freya-card overflow-hidden mb-6">
            <div className="overflow-x-auto">
              <table className="ui-table-data w-full text-left text-sm text-[var(--text-primary)]">
                <thead className="bg-[var(--surface-raised)] border-b border-[var(--border)] text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">
                  <tr className="h-9">
                    <th className="sticky left-0 z-10 bg-[var(--surface-raised)] px-4 py-2 min-w-[200px] border-b border-[var(--border)]">{language === 'ja' ? '品番' : 'Hinban'}</th>
                    <th className="sticky left-[200px] z-10 bg-[var(--surface-raised)] px-4 py-2 min-w-[80px] border-b border-[var(--border)]">{language === 'ja' ? '区分' : 'Type'}</th>
                    {days.map(day => (
                      <th key={day} className="px-2 py-2 text-center min-w-[40px] freya-tabular">{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {loading ? (
                    <tr>
                      <td colSpan={33} className="px-4 py-8 text-center text-[var(--text-muted)] text-xs">{t('loading')}</td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={33} className="px-4 py-8 text-center text-[var(--text-muted)] text-xs">
                        {filter ? t('noData') : (language === 'ja' ? `${selectedMonth} のデータはまだ同期されていません。Excelから同期してください。` : `No data fetched yet for ${selectedMonth}. Please sync from Excel.`)}
                      </td>
                    </tr>
                  ) : (
                    currentData.map((item) => (
                      <React.Fragment key={item.id}>
                        {/* Orders Row */}
                        <tr className="hover:bg-[var(--surface-raised)] transition-colors">
                          <td className="sticky left-0 bg-[var(--surface)] px-4 py-2 font-medium text-xs border-r border-[var(--border)]" rowSpan={2}>
                            <span 
                              className="cursor-pointer text-[var(--freya-blue)] hover:underline font-semibold"
                              onClick={() => handleCardClick(item.hinban)}
                            >
                              {item.hinban}
                            </span>
                          </td>
                          <td className="sticky left-[200px] bg-[var(--surface)] px-4 py-2 text-[var(--freya-blue)] font-semibold text-xs border-r border-[var(--border)]">
                            {language === 'ja' ? '受注' : 'Orders'}
                          </td>
                          {item.orders.map((val, i) => (
                            <td key={i} className="px-2 py-2 text-center text-xs freya-tabular border-r border-[var(--border)] text-[var(--text-primary)]">{val}</td>
                          ))}
                        </tr>
                        {/* Production Row */}
                        <tr className="hover:bg-[var(--surface-raised)] transition-colors">
                          <td className="sticky left-[200px] bg-[var(--surface)] px-4 py-2 text-[var(--semantic-success)] font-semibold text-xs border-r border-[var(--border)]">
                            {language === 'ja' ? '生産' : 'Prod'}
                          </td>
                          {item.production.map((val, i) => (
                            <td key={i} className="px-2 py-2 text-center text-xs freya-tabular border-r border-[var(--border)] text-[var(--text-primary)]">{val}</td>
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
              <div className="text-xs text-[var(--text-muted)] freya-tabular">
                {language === 'ja' 
                  ? `${filteredData.length} 件中 ${((currentPage - 1) * ITEMS_PER_PAGE) + 1} ～ ${Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length)} 件を表示`
                  : `Showing ${((currentPage - 1) * ITEMS_PER_PAGE) + 1} to ${Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length)} of ${filteredData.length} entries`}
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] disabled:opacity-50 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
                </button>
                <span className="text-xs font-semibold text-[var(--text-primary)] px-2 freya-tabular">
                  {language === 'ja' ? `ページ ${currentPage} / ${totalPages}` : `Page ${currentPage} of ${totalPages}`}
                </span>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] disabled:opacity-50 cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'scheduling' && (
        <div className="flex flex-col gap-6">
          {/* Discrepancy Notice Banner for the Current Date */}
          {currentDayDiscrepancies.count > 0 && (
            <div className="freya-card rounded-[8px] border border-amber-500/30 bg-amber-500/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-amber-500" style={{ fontSize: 22 }}>sync_problem</span>
                <div>
                  <h4 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                    {language === 'ja' ? `${parseInt(selectedMonth.split('-')[1], 10)}/${selectedDay} にExcelとの差異を検知` : `Excel Discrepancy on ${parseInt(selectedMonth.split('-')[1], 10)}/${selectedDay}`}
                    <span className="rounded-[4px] bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-xs font-mono font-bold text-amber-700 dark:text-amber-300 freya-tabular shadow-2xs">
                      {language === 'ja' ? `${currentDayDiscrepancies.count} 件の差異品番` : `${currentDayDiscrepancies.count} affected hinban${currentDayDiscrepancies.count === 1 ? '' : 's'}`}
                    </span>
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-medium">
                    {language === 'ja' 
                      ? `一部の設定済品番が最新Excelで0mまたは数量変更されています。「自動反映」を実行するとこの日付 (${selectedDateStr}) のみ更新されます。` 
                      : `Some scheduled hinbans have 0m in Excel or changed quantities. Auto-aligning will only update this specific date (${selectedDateStr}) without affecting other dates.`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setIsDiscrepancyModalOpen(true)}
                  className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition-colors shadow-2xs cursor-pointer"
                >
                  {language === 'ja' ? '詳細を確認' : 'Review Details'}
                </button>
                <button
                  type="button"
                  onClick={handleAutoAlignCurrentDate}
                  className="flex items-center gap-1.5 rounded-[6px] bg-amber-600 hover:bg-amber-700 px-3.5 py-1.5 text-xs font-bold text-white transition-all shadow-2xs cursor-pointer"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_fix_high</span>
                  {language === 'ja' ? `${parseInt(selectedMonth.split('-')[1], 10)}/${selectedDay} をExcelに自動反映` : `Auto-Align ${parseInt(selectedMonth.split('-')[1], 10)}/${selectedDay} with Excel`}
                </button>
              </div>
            </div>
          )}

          <div className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] font-mono">{t('ff_targetDate')}</span>
              <div className="flex items-center gap-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleStepDate(-1)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                  title={t('ff_prevDay')}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
                </button>
                <input 
                  type="date" 
                  value={selectedDateStr}
                  onChange={handleDateChange}
                  className="w-[135px] shrink-0 border-0 bg-transparent px-2 py-0.5 text-xs font-bold font-mono freya-tabular text-[var(--text-primary)] focus:outline-none cursor-pointer"
                />
                <span className={`inline-flex items-center justify-center rounded-[4px] w-[58px] py-0.5 text-[11px] font-bold shrink-0 text-center ${
                  selectedDayOfWeekInfo.isSunday 
                    ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/25' 
                    : selectedDayOfWeekInfo.isSaturday 
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25' 
                      : 'bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)]'
                }`}>
                  <span>{language === 'ja' ? `${selectedDayOfWeekInfo.ja}曜日` : selectedDayOfWeekInfo.en}</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleStepDate(1)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                  title={t('ff_nextDay')}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
                </button>
              </div>

              {/* Today button if date is not current date */}
              {selectedDateStr !== getLocalYYYYMMDD() && (
                <button
                  type="button"
                  onClick={handleGoToToday}
                  className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)] transition-colors shadow-2xs cursor-pointer"
                  title={language === 'ja' ? '今日の日付に戻る' : 'Go to today'}
                >
                  <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 16 }}>today</span>
                  {t('ff_today')}
                </button>
              )}
            </div>
            <button 
              onClick={handleSaveSchedule}
              className="inline-flex items-center justify-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--freya-blue-hover)] shadow-xs cursor-pointer"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>
              {t('ff_saveDailySchedule')}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pool Column */}
            <div 
              className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3.5 shadow-sm min-h-[550px]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDropPool}
            >
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 20 }}>inventory_2</span>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    {t('ff_availableToSchedule')}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-[4px] bg-[var(--surface)] px-2.5 py-1 text-xs font-mono font-bold text-[var(--text-primary)] border border-[var(--border)] freya-tabular" title={t('ff_totalEstimatedFilteredTime')}>
                    ⏱️ {formatTime(poolTotalMins)}
                  </span>
                  <button 
                    onClick={() => setShowNoAdhesive(!showNoAdhesive)}
                    className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-[6px] border transition-colors cursor-pointer shadow-2xs font-semibold ${
                      showNoAdhesive 
                        ? 'border-[var(--freya-blue)]/30 bg-[var(--freya-blue-subtle)] text-[var(--freya-blue)]' 
                        : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                    }`}
                    title={showNoAdhesive ? t('ff_hideNoAdhesive') : t('ff_showNoAdhesive')}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                      {showNoAdhesive ? 'visibility' : 'visibility_off'}
                    </span>
                    {showNoAdhesive ? t('ff_hideNoAdhesive') : t('ff_showNoAdhesive')}
                  </button>
                  <span className="text-xs font-mono font-semibold text-[var(--text-muted)] bg-[var(--surface)] border border-[var(--border)] rounded-[4px] px-2 py-0.5 freya-tabular">
                    {processedPoolItems.length !== poolItems.length 
                      ? (language === 'ja' ? `${processedPoolItems.length} / ${poolItems.length} 件` : `${processedPoolItems.length} / ${poolItems.length} items`)
                      : (language === 'ja' ? `${poolItems.length} 件` : `${poolItems.length} items`)}
                  </span>
                </div>
              </div>

              {/* Search & Filter Toolbar */}
              <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-2.5 flex flex-col gap-2">
                {/* Search input */}
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" style={{ fontSize: 16 }}>search</span>
                  <input
                    type="text"
                    placeholder={t('ff_searchHinban')}
                    className="h-8 w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] py-1.5 pl-8 pr-7 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--freya-blue)] transition-colors"
                    value={poolSearch}
                    onChange={(e) => setPoolSearch(e.target.value)}
                  />
                  {poolSearch && (
                    <button
                      type="button"
                      onClick={() => setPoolSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                    </button>
                  )}
                </div>

                {/* Filter Controls Row */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Sort */}
                  <div className="flex items-center gap-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs">
                    <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 15 }}>sort</span>
                    <select
                      value={poolSortBy}
                      onChange={(e) => setPoolSortBy(e.target.value)}
                      className="bg-transparent font-medium text-xs text-[var(--text-primary)] focus:outline-none cursor-pointer"
                    >
                      <option value="timeOption-asc">{t('ff_sort_timeOptionAsc')}</option>
                      <option value="timeOption-desc">{t('ff_sort_timeOptionDesc')}</option>
                      <option value="kataban-asc">{t('ff_sort_katabanAsc')}</option>
                      <option value="kataban-desc">{t('ff_sort_katabanDesc')}</option>
                      <option value="default">{t('ff_sort_default')}</option>
                      <option value="duration-desc">{t('ff_sort_durationDesc')}</option>
                      <option value="duration-asc">{t('ff_sort_durationAsc')}</option>
                      <option value="qty-desc">{t('ff_sort_qtyDesc')}</option>
                      <option value="qty-asc">{t('ff_sort_qtyAsc')}</option>
                      <option value="rolls-desc">{t('ff_sort_rollsDesc')}</option>
                      <option value="hinban-asc">{t('ff_sort_hinbanAsc')}</option>
                    </select>
                  </div>

                  {/* Batch size filter */}
                  <div className="flex items-center rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-0.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setPoolBatchFilter('all')}
                      className={`px-2 py-0.5 rounded-[4px] transition-colors cursor-pointer ${poolBatchFilter === 'all' ? 'bg-[var(--freya-blue)] text-white shadow-xs font-bold' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                    >
                      {t('ff_allSizes')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPoolBatchFilter('large')}
                      className={`px-2 py-0.5 rounded-[4px] transition-colors cursor-pointer ${poolBatchFilter === 'large' ? 'bg-[var(--freya-blue)] text-white shadow-xs font-bold' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                      title={language === 'ja' ? '500m以上または5巻以上の大ロット' : 'Items >= 500m or >= 5 rolls'}
                    >
                      <span>{t('ff_largeBatch')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPoolBatchFilter('small')}
                      className={`px-2 py-0.5 rounded-[4px] transition-colors cursor-pointer ${poolBatchFilter === 'small' ? 'bg-[var(--freya-blue)] text-white shadow-xs font-bold' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                      title={language === 'ja' ? '200m未満の小ロット' : 'Items < 200m'}
                    >
                      <span>{t('ff_smallBatch')}</span>
                    </button>
                  </div>

                  {/* Width Filter */}
                  {availableWidths.length > 1 && (
                    <div className="flex items-center gap-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs">
                      <span className="text-[var(--text-muted)] font-medium">{t('ff_width')}</span>
                      <select
                        value={poolWidthFilter}
                        onChange={(e) => setPoolWidthFilter(e.target.value)}
                        className="bg-transparent font-medium text-xs text-[var(--text-primary)] focus:outline-none cursor-pointer"
                      >
                        <option value="all">{language === 'ja' ? `全幅 (${availableWidths.length})` : `All Widths (${availableWidths.length})`}</option>
                        {availableWidths.map(w => (
                          <option key={w} value={w}>{w}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Reset Filters button if any filter active */}
                  {(poolBatchFilter !== 'all' || poolWidthFilter !== 'all' || poolSortBy !== 'timeOption-asc' || poolSearch) && (
                    <button
                      type="button"
                      onClick={() => {
                        setPoolBatchFilter('all');
                        setPoolWidthFilter('all');
                        setPoolSortBy('timeOption-asc');
                        setPoolSearch('');
                      }}
                      className="ml-auto text-xs font-semibold text-[var(--freya-blue)] hover:underline cursor-pointer"
                    >
                      {t('ff_resetFilters')}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
                {/* Setup & Task Items */}
                <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-2.5 mb-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {PRESET_SETUP_ITEMS.map(preset => {
                      const duration = setupTimes[preset.name] !== undefined ? setupTimes[preset.name] : preset.defaultTime;
                      const comment = setupComments[preset.name] || '';
                      const presetDisplayName = preset.name === '段取り' ? t('ff_dandori') : (preset.name === '試作' ? t('ff_trial') : preset.name);
                      return (
                        <div 
                          key={preset.name}
                          draggable
                          onDragStart={(e) => {
                            if (e.target.tagName && (e.target.tagName.toLowerCase() === 'input' || e.target.tagName.toLowerCase() === 'button')) {
                              e.preventDefault();
                              return;
                            }
                            onDragStartSchedule(e, { type: 'setup', name: preset.name, comment, duration }, 'pool');
                          }}
                          className="cursor-grab rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-2 flex flex-col justify-between hover:border-[var(--freya-blue)] hover:bg-[var(--surface-hover)] transition-all text-xs font-medium text-[var(--text-primary)] shadow-2xs"
                        >
                          <div className="flex items-center justify-between gap-1 w-full">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span className="truncate font-bold text-xs text-[var(--text-primary)]" title={comment ? `${presetDisplayName} ${comment}` : presetDisplayName}>
                                {comment ? `${presetDisplayName} ${comment}` : presetDisplayName}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCommentModalItem({ name: preset.name, displayName: presetDisplayName, isPreset: true, comment });
                                  setTempCommentText(comment);
                                }}
                                className={`p-0.5 rounded-[4px] hover:bg-[var(--surface-hover)] transition-colors shrink-0 cursor-pointer ${comment ? 'text-[var(--freya-blue)] font-semibold' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                                title={comment ? `Title: ${presetDisplayName} ${comment}` : t('ff_editTitleNote')}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                                  edit_note
                                </span>
                              </button>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <input 
                                type="number" 
                                value={duration} 
                                onChange={e => handleUpdateSetupTime(preset.name, e.target.value)}
                                className="w-12 h-7 rounded-[4px] bg-[var(--surface)] border border-[var(--border)] px-1 py-0.5 text-center text-xs font-mono font-bold freya-tabular text-[var(--text-primary)] focus:outline-none focus:border-[var(--freya-blue)]"
                                min="0"
                              />
                              <span className="text-[11px] text-[var(--text-muted)] font-medium">{t('ff_minutesShort')}</span>
                              <button 
                                type="button" 
                                onClick={() => handleAddToSchedule({ type: 'setup', name: preset.name, comment, duration })}
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] hover:border-[var(--freya-blue)] hover:text-[var(--freya-blue)] text-[var(--text-muted)] transition-colors shadow-2xs ml-0.5 cursor-pointer"
                                title={t('ff_addToSchedule')}
                              >
                                <span className="material-symbols-outlined" style={{fontSize: 15}}>arrow_forward</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Dynamic Custom Setup Item */}
                    <div 
                      draggable
                      onDragStart={(e) => {
                        if (e.target.tagName && (e.target.tagName.toLowerCase() === 'input' || e.target.tagName.toLowerCase() === 'button')) {
                          e.preventDefault();
                          return;
                        }
                        onDragStartSchedule(e, { 
                          type: 'setup', 
                          name: customSetupName.trim() || t('ff_customSetup'), 
                          comment: setupComments['custom'] || '',
                          duration: Number(customSetupDuration) || 0 
                        }, 'pool');
                      }}
                      className="cursor-grab rounded-[6px] border border-dashed border-[var(--border)] bg-[var(--surface)] p-2 flex flex-col justify-between hover:border-[var(--freya-blue)] hover:shadow-xs transition-all text-xs font-medium shadow-2xs"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <input 
                          type="text" 
                          value={customSetupName} 
                          placeholder={t('ff_enterCustomName')}
                          onChange={e => handleUpdateCustomName(e.target.value)}
                          className="w-full min-w-0 rounded-[4px] bg-[var(--surface)] border border-[var(--border)] px-2 py-1 text-xs font-medium text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--freya-blue)]"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCommentModalItem({ name: customSetupName.trim() || t('ff_customSetup'), isPreset: true, isCustom: true, comment: setupComments['custom'] || '' });
                            setTempCommentText(setupComments['custom'] || '');
                          }}
                          className={`p-1 rounded-[4px] hover:bg-[var(--surface-hover)] transition-colors shrink-0 cursor-pointer ${setupComments['custom'] ? 'text-[var(--freya-blue)] font-semibold' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                          title={setupComments['custom'] ? `Note: ${setupComments['custom']}` : t('ff_editTitleNote')}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                            {setupComments['custom'] ? 'chat' : 'add_comment'}
                          </span>
                        </button>
                        <input 
                          type="number" 
                          value={customSetupDuration} 
                          placeholder={t('ff_minutesShort')}
                          onChange={e => handleUpdateCustomDuration(e.target.value)}
                          className="w-12 h-7 rounded-[4px] bg-[var(--surface)] border border-[var(--border)] px-1 py-0.5 text-center text-xs font-mono font-bold freya-tabular text-[var(--text-primary)] focus:outline-none focus:border-[var(--freya-blue)] shrink-0"
                          min="0"
                        />
                        <span className="text-[11px] text-[var(--text-muted)] font-medium shrink-0">{t('ff_minutesShort')}</span>
                        <button 
                          type="button" 
                          onClick={() => handleAddToSchedule({ 
                            type: 'setup', 
                            name: customSetupName.trim() || t('ff_customSetup'), 
                            comment: setupComments['custom'] || '',
                            duration: Number(customSetupDuration) || 0 
                          })}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] hover:border-[var(--freya-blue)] hover:text-[var(--freya-blue)] text-[var(--text-muted)] transition-colors shadow-2xs ml-0.5 cursor-pointer"
                          title={t('ff_addToSchedule')}
                        >
                          <span className="material-symbols-outlined" style={{fontSize: 15}}>arrow_forward</span>
                        </button>
                      </div>
                      {setupComments['custom'] && (
                        <div className="text-[10px] text-[var(--text-muted)] font-medium truncate mt-1 pt-1 border-t border-[var(--border)] flex items-center gap-1">
                          <span className="text-[var(--freya-blue)]">💬</span>
                          <span className="truncate">{setupComments['custom']}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Column Headers for Available Hinbans */}
                {processedPoolItems.length > 0 && (
                  <div className="flex items-center gap-3 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)] mb-1 select-none">
                    <div className="flex-1 flex items-center gap-4 min-w-0 pr-1">
                      <div className="w-[220px] shrink-0 text-left font-mono">
                        {language === 'ja' ? '品番' : 'Hinban'}
                      </div>
                      <div className="w-[85px] shrink-0 text-left font-mono">
                        {language === 'ja' ? '型番' : 'Kataban'}
                      </div>
                      <div className="w-[80px] shrink-0 text-left font-mono">
                        {language === 'ja' ? '時間オプション' : 'Time Option'}
                      </div>
                    </div>
                    <div className="w-8 shrink-0 ml-1 text-center font-mono">
                      {language === 'ja' ? '追加' : 'Add'}
                    </div>
                  </div>
                )}

                {processedPoolItems.length === 0 ? (
                  <div className="text-center text-xs text-[var(--text-muted)] mt-10 border border-dashed border-[var(--border)] rounded-[8px] p-8 flex flex-col items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 28 }}>inbox</span>
                    <p className="font-medium">{poolItems.length === 0 ? t('ff_noItemsForDate') : t('ff_noItemsMatchFilter')}</p>
                  </div>
                ) : (
                  processedPoolItems.map(item => {
                    const qty = item._qty;
                    const numRolls = item._numRolls;
                    const durationMins = item._durationMins;
                    const segments = item.materialInfo?.rawMaster?.['品番構造']?.segments || [];
                    const adhesiveSegment = segments.find(s => s.segment === '粘着コード');
                    const isRawMaterial = adhesiveSegment && adhesiveSegment.name === '粘着無し';

                    return (
                    <div 
                      key={item.id}
                      draggable
                      onDragStart={(e) => onDragStartSchedule(e, { type: 'pool-hinban', hinban: item.hinban, id: item.id }, 'pool')}
                      className={`group cursor-grab active:cursor-grabbing rounded-[6px] border p-2.5 flex items-center gap-3 transition-all shadow-2xs hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] ${
                        isRawMaterial 
                          ? 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50' 
                          : 'border-[var(--border)] bg-[var(--surface)]'
                      }`}
                    >
                      <div className="flex-1 flex flex-col cursor-pointer min-w-0 pr-1" onClick={() => handleCardClick(item.hinban)}>
                        <div className="flex items-center gap-4 w-full">
                          {/* Column 1: Hinban */}
                          <div className="w-[220px] shrink-0 flex items-center gap-1.5 min-w-0">
                            <span className="font-mono font-bold text-xs text-[var(--text-primary)] group-hover:text-[var(--freya-blue)] transition-colors truncate" title={item.hinban}>
                              {item.hinban}
                            </span>
                            {isRawMaterial && (
                              <span className="shrink-0 rounded-[4px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold font-mono uppercase tracking-wider">
                                {language === 'ja' ? '原材料 (粘着無)' : 'Raw Material'}
                              </span>
                            )}
                          </div>

                          {/* Column 2: Kataban */}
                          <div className="w-[85px] shrink-0 text-left">
                            {item._kataban ? (
                              <span className="inline-block truncate text-xs font-mono font-medium text-[var(--text-secondary)]" title={`型番: ${item._kataban}`}>
                                {item._kataban}
                              </span>
                            ) : (
                              <span className="text-[var(--text-muted)] text-xs font-mono">—</span>
                            )}
                          </div>

                          {/* Column 3: Time Option */}
                          <div className="w-[80px] shrink-0 text-left">
                            {item._timeOption ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[var(--freya-blue-subtle)] border border-[var(--freya-blue)]/20 text-[11px] font-mono font-semibold text-[var(--freya-blue)] freya-tabular" title={`時間オプション: ${item._timeOption}`}>
                                {item._timeOption}
                              </span>
                            ) : (
                              <span className="text-[var(--text-muted)] text-xs font-mono">—</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-1.5 text-xs text-[var(--text-muted)] flex-wrap">
                          <span className="rounded-[4px] bg-[var(--surface)] border border-[var(--border)] px-1.5 py-0.5 text-[11px] font-mono font-bold text-[var(--text-primary)] freya-tabular">
                            {language === 'ja' ? `数量: ${qty}${item._unit}` : `Qty: ${qty}${item._unit}`}
                          </span>
                          <span className="rounded-[4px] bg-[var(--surface)] border border-[var(--border)] px-1.5 py-0.5 text-[11px] font-mono text-[var(--text-secondary)] freya-tabular">
                            {numRolls} {item._unit === '枚' ? (language === 'ja' ? '束' : 'packs') : (language === 'ja' ? '巻' : 'rolls')}
                          </span>
                          <span className="rounded-[4px] bg-[var(--surface)] border border-[var(--border)] px-1.5 py-0.5 text-[11px] font-mono text-[var(--text-secondary)] freya-tabular">
                            ⏱️ {durationMins} {t('ff_minutesShort')}
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleAddToSchedule({ type: 'pool-hinban', hinban: item.hinban, id: item.id })}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] hover:border-[var(--freya-blue)] hover:text-[var(--freya-blue)] text-[var(--text-muted)] transition-colors shadow-2xs ml-1 cursor-pointer"
                        title={t('ff_addToSchedule')}
                      >
                        <span className="material-symbols-outlined" style={{fontSize: 16}}>arrow_forward</span>
                      </button>
                    </div>
                  )})
                )}
              </div>
            </div>

            {/* Scheduled Column */}
            <div 
              className="freya-card rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3.5 shadow-sm min-h-[550px]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDropScheduled(e)}
            >
              <div className="flex flex-col gap-3 pb-3 border-b border-[var(--border)]">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 20 }}>format_list_numbered</span>
                    <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-tight">
                      {t('ff_priorityOrder')}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {multiRollGroups.length > 0 && (
                      <button
                        type="button"
                        onClick={handleToggleAllGroups}
                        className="flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)] active:scale-95 transition-all cursor-pointer shadow-2xs"
                        title={allMultiRollGroupsCollapsed ? (language === 'ja' ? 'すべての品番を展開' : 'Expand all hinbans') : (language === 'ja' ? 'すべての品番を折りたたむ' : 'Collapse all hinbans')}
                      >
                        <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 16 }}>
                          {allMultiRollGroupsCollapsed ? 'unfold_more' : 'unfold_less'}
                        </span>
                        <span>{allMultiRollGroupsCollapsed ? t('ff_expandAll') : t('ff_collapseAll')}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handlePrintSchedulePDF}
                      disabled={scheduledItems.length === 0}
                      className="flex items-center gap-1.5 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                      title={language === 'ja' ? '優先順位スケジュール表 (A3) を印刷' : 'Print A3 Priority Production Schedule'}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>print</span>
                      <span>{language === 'ja' ? '印刷 (A3)' : 'Print (A3)'}</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        if (window.confirm(t('ff_resetScheduleConfirm'))) {
                          setScheduleOrder([]);
                          setCollapsedGroups({});
                        }
                      }}
                      className="flex items-center gap-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-medium text-[var(--text-secondary)] hover:text-red-600 hover:border-red-500/30 hover:bg-red-500/10 transition-colors shadow-2xs cursor-pointer"
                    >
                      <span className="material-symbols-outlined" style={{fontSize: 16}}>restart_alt</span>
                      {t('ff_reset')}
                    </button>
                  </div>
                </div>

                {/* Schedule Time Range & Duration Toolbar */}
                <div className="flex items-center justify-between flex-wrap gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
                    <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{fontSize: 16}}>schedule</span>
                    <span>{t('ff_start')}</span> 
                    <input 
                      type="time" 
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                      className="rounded-[4px] bg-[var(--surface)] border border-[var(--border)] px-1.5 py-0.5 text-xs font-mono font-bold freya-tabular text-[var(--text-primary)] focus:outline-none focus:border-[var(--freya-blue)] cursor-pointer"
                    />
                    {scheduledEndTime && (
                      <>
                        <span className="text-[var(--text-muted)] px-0.5 font-bold">～</span>
                        <span>{t('ff_end')}</span>
                        <span className="rounded-[4px] bg-[var(--surface)] border border-[var(--border)] px-1.5 py-0.5 text-xs font-mono freya-tabular font-bold text-[var(--text-primary)]" title={language === 'ja' ? '終了予定時刻' : 'Scheduled end time'}>
                          {scheduledEndTime}
                        </span>
                      </>
                    )}
                  </div>

                  {scheduledEndTime ? (
                    <span 
                      className="rounded-[4px] bg-[var(--surface)] px-2.5 py-1 text-xs font-bold text-[var(--text-primary)] border border-[var(--border)] freya-tabular flex items-center gap-1.5 shadow-2xs"
                      title={language === 'ja' ? `スケジュール時間帯: ${startTime} ～ ${scheduledEndTime} (${formatTime(scheduledTotalMins)})` : `Schedule span: ${startTime} ～ ${scheduledEndTime} (${formatTime(scheduledTotalMins)})`}
                    >
                      <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 16 }}>timelapse</span>
                      <span className="font-mono">{startTime} ～ {scheduledEndTime}</span>
                      <span className="text-[var(--text-muted)] font-mono font-medium">({formatTime(scheduledTotalMins)})</span>
                    </span>
                  ) : (
                    <span className="rounded-[4px] bg-[var(--surface)] px-2 py-0.5 text-xs font-mono font-bold text-[var(--text-primary)] border border-[var(--border)] shadow-2xs freya-tabular">
                      ⏱️ {formatTime(scheduledTotalMins)}
                    </span>
                  )}
                </div>
              </div>

              {/* Column Headers for Priority Order Schedule */}
              {scheduledGroups.length > 0 && (
                <div className="flex items-center gap-3 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)] mb-1 select-none">
                  <div className="w-7 shrink-0 text-center font-mono">#</div>
                  <div className="w-[62px] shrink-0 text-center font-mono">{language === 'ja' ? '時間帯' : 'Time'}</div>
                  <div className="flex-1 flex items-center gap-4 min-w-0 pr-1">
                    <div className="w-[210px] shrink-0 text-left font-mono">{language === 'ja' ? '工程 / 品番' : 'Process / Hinban'}</div>
                    <div className="w-[85px] shrink-0 text-left font-mono">{language === 'ja' ? '型番' : 'Kataban'}</div>
                    <div className="w-[80px] shrink-0 text-left font-mono">{language === 'ja' ? '時間オプション' : 'Time Option'}</div>
                  </div>
                  <div className="w-[62px] shrink-0 text-right font-mono">{language === 'ja' ? '所要' : 'Duration'}</div>
                  <div className="w-7 shrink-0 ml-1" />
                </div>
              )}

              <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
                {scheduleWithTimes.length === 0 ? (
                  <div className="text-center text-xs text-[var(--text-muted)] mt-10 border border-dashed border-[var(--border)] rounded-[8px] p-8 flex flex-col items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 28 }}>drag_indicator</span>
                    <p className="font-medium">{t('ff_dragToSetPriority')}</p>
                  </div>
                ) : (
                  scheduledGroups.map((group) => {
                    if (group.type === 'setup') {
                      const item = group.item;
                      const setupDisplayName = item.name === '段取り' ? t('ff_dandori') : (item.name === '試作' ? t('ff_trial') : item.name);
                      return (
                        <div 
                          key={item.id}
                          draggable
                          onDragStart={(e) => onDragStartSchedule(e, item, 'scheduled')}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.stopPropagation(); // Prevent column drop
                            onDropScheduled(e, group.index);
                          }}
                          className="cursor-grab active:cursor-grabbing rounded-[6px] border border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50 p-2.5 flex items-center gap-3 transition-all shadow-2xs"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] bg-amber-500 text-white font-mono font-bold text-xs shadow-2xs">
                            {group.index + 1}
                          </span>
                          <span className="flex flex-col items-center justify-center rounded-[4px] bg-[var(--surface)] border border-amber-500/30 px-2 py-0.5 text-xs font-mono freya-tabular min-w-[62px] shadow-2xs">
                            <span className="font-bold text-[var(--text-primary)]">{item.startTime}</span>
                            <span className="text-[10px] text-[var(--text-muted)] font-medium">～ {item.endTime}</span>
                          </span>
                          
                          <div className="flex-1 flex items-center justify-between min-w-0 pr-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="shrink-0 rounded-[4px] bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                {item.name === '段取り' ? 'SETUP' : (item.name === '試作' ? 'TRIAL' : 'TASK')}
                              </span>
                              <span className="font-bold text-xs text-[var(--text-primary)] truncate" title={item.comment ? `${setupDisplayName} ${item.comment}` : setupDisplayName}>
                                {item.comment ? `${setupDisplayName} ${item.comment}` : setupDisplayName}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCommentModalItem(item);
                                  setTempCommentText(item.comment || '');
                                }}
                                className={`p-1 rounded-[4px] hover:bg-[var(--surface-hover)] transition-colors shrink-0 cursor-pointer ${item.comment ? 'text-[var(--freya-blue)] font-semibold' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                                title={t('ff_editTitleNote')}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                                  edit_note
                                </span>
                              </button>
                            </div>
                            <span className="text-xs font-mono font-bold freya-tabular text-amber-700 dark:text-amber-400 whitespace-nowrap ml-2 bg-amber-500/10 border border-amber-500/20 rounded-[4px] px-2 py-0.5">
                              {item.duration} {t('ff_minutesShort')}
                            </span>
                          </div>
                          <button 
                            onClick={() => handleRemoveFromSchedule(item)}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] hover:border-red-500/30 hover:text-red-600 text-[var(--text-muted)] transition-all shadow-2xs ml-1 cursor-pointer"
                            title={t('ff_removeFromSchedule')}
                          >
                            <span className="material-symbols-outlined" style={{fontSize: 16}}>arrow_back</span>
                          </button>
                        </div>
                      );
                    }

                    // Helper to render an individual roll card
                    const renderRollCard = (item, rollItemIndex) => {
                      const disc = currentDayDiscrepancies.map[item.hinban];
                      const isZeroOrMissing = disc && (disc.type === 'moved_or_zero' || disc.type === 'missing_in_excel');
                      const isQtyMismatch = disc && disc.type === 'qty_mismatch';

                      const matchedPool = data.find(d => d.hinban === item.hinban);
                      const itemKataban = item._kataban || extractKataban(matchedPool || item);
                      const itemTimeOption = item._timeOption || extractTimeOption(matchedPool || item);

                      return (
                        <div 
                          key={item.id}
                          draggable
                          onDragStart={(e) => onDragStartSchedule(e, item, 'scheduled')}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.stopPropagation(); // Prevent column drop
                            onDropScheduled(e, rollItemIndex);
                          }}
                          className={`group cursor-grab active:cursor-grabbing rounded-[6px] border p-2.5 flex items-center gap-3 transition-all shadow-2xs hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] ${
                            isZeroOrMissing 
                              ? 'border-red-500/40 bg-red-500/5' 
                              : isQtyMismatch 
                              ? 'border-amber-500/40 bg-amber-500/5' 
                              : 'border-[var(--border)] bg-[var(--surface)]'
                          }`}
                        >
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] text-xs font-mono font-bold shadow-2xs ${
                            isZeroOrMissing 
                              ? 'bg-red-600 text-white' 
                              : isQtyMismatch 
                              ? 'bg-amber-600 text-white' 
                              : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)]'
                          }`}>
                            {rollItemIndex + 1}
                          </span>
                          <span className="flex flex-col items-center justify-center rounded-[4px] bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 text-xs font-mono freya-tabular text-[var(--text-primary)] min-w-[62px] shadow-2xs">
                            <span className="font-bold text-[var(--text-primary)]">{item.startTime}</span>
                            <span className="text-[10px] text-[var(--text-muted)] font-medium">～ {item.endTime}</span>
                          </span>

                          <div className="flex-1 flex flex-col cursor-pointer min-w-0 pr-1" onClick={() => handleCardClick(item.hinban)}>
                            <div className="flex items-center gap-4 w-full">
                              {/* Column 1: Hinban + Discrepancy Warnings */}
                              <div className="w-[210px] shrink-0 flex items-center gap-1.5 min-w-0">
                                <span className="font-mono font-bold text-xs text-[var(--text-primary)] group-hover:text-[var(--freya-blue)] transition-colors truncate" title={item.hinban}>
                                  {item.hinban}
                                </span>
                                {isZeroOrMissing && (
                                  <span className="shrink-0 inline-flex items-center gap-0.5 rounded-[4px] bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold text-red-600 dark:text-red-400 border border-red-500/30">
                                    <span className="material-symbols-outlined" style={{ fontSize: 11 }}>warning</span>
                                    <span className="truncate max-w-[65px]">{disc.type === 'missing_in_excel' ? t('ff_notInExcel') : (disc.movedText || t('ff_zeroMetersToday'))}</span>
                                  </span>
                                )}
                                {isQtyMismatch && (
                                  <span className="shrink-0 inline-flex items-center gap-0.5 rounded-[4px] bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                    <span className="material-symbols-outlined" style={{ fontSize: 11 }}>difference</span>
                                    <span>{disc.excelQty}{item.unit || 'm'}</span>
                                  </span>
                                )}
                              </div>

                              {/* Column 2: Kataban */}
                              <div className="w-[85px] shrink-0 text-left">
                                {itemKataban ? (
                                  <span className="inline-block truncate text-xs font-mono font-medium text-[var(--text-secondary)]" title={`型番: ${itemKataban}`}>
                                    {itemKataban}
                                  </span>
                                ) : (
                                  <span className="text-[var(--text-muted)] text-xs font-mono">—</span>
                                )}
                              </div>

                              {/* Column 3: Time Option */}
                              <div className="w-[80px] shrink-0 text-left">
                                {itemTimeOption ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[var(--freya-blue-subtle)] border border-[var(--freya-blue)]/20 text-[11px] font-semibold font-mono freya-tabular text-[var(--freya-blue)] shadow-2xs" title={`時間オプション: ${itemTimeOption}`}>
                                    {itemTimeOption}
                                  </span>
                                ) : (
                                  <span className="text-[var(--text-muted)] text-xs font-mono">—</span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 mt-1.5 text-xs text-[var(--text-secondary)] flex-wrap">
                              <span className="rounded-[4px] bg-[var(--surface)] border border-[var(--border)] px-1.5 py-0.5 text-[11px] font-mono text-[var(--text-secondary)]">
                                {item.unit === '枚'
                                  ? (language === 'ja' ? `束 ${item.rollIndex}/${item.totalRolls}` : `Pack ${item.rollIndex}/${item.totalRolls}`)
                                  : (language === 'ja' ? `巻 ${item.rollIndex}/${item.totalRolls}` : `Roll ${item.rollIndex}/${item.totalRolls}`)
                                }
                              </span>
                              <span className="rounded-[4px] bg-[var(--surface)] border border-[var(--border)] px-1.5 py-0.5 text-[11px] font-mono font-bold text-[var(--text-primary)] freya-tabular">
                                {item.meters}{item.unit || 'm'}
                              </span>
                              {isQtyMismatch && item.rollIndex === 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateHinbanQty(item.hinban);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-[4px] border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-colors ml-1 cursor-pointer shadow-2xs"
                                  title={language === 'ja' ? '最新Excelデータに合わせて巻数・所要時間を更新' : 'Update rolls and duration to match Excel'}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>sync</span>
                                  {t('ff_updateQtyPrompt').replace('{qty}', `${disc.excelQty}${item.unit || 'm'}`)}
                                </button>
                              )}
                            </div>
                          </div>

                          <span className="text-xs font-mono font-bold freya-tabular text-[var(--text-primary)] whitespace-nowrap bg-[var(--surface)] border border-[var(--border)] rounded-[4px] px-2 py-0.5">
                            {item.duration} {t('ff_minutesShort')}
                          </span>
                          <button 
                            onClick={() => handleRemoveFromSchedule(item)}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] hover:border-red-500/30 hover:text-red-600 text-[var(--text-muted)] transition-all shadow-2xs ml-1 cursor-pointer"
                            title={t('ff_removeFromSchedule')}
                          >
                            <span className="material-symbols-outlined" style={{fontSize: 16}}>arrow_back</span>
                          </button>
                        </div>
                      );
                    };

                    // Single roll Hinban
                    if (group.items.length === 1) {
                      return renderRollCard(group.items[0].item, group.items[0].index);
                    }

                    // Multi-roll Hinban group
                    const isCollapsed = collapsedGroups[group.id] ?? true;

                    // If Collapsed: Render obvious stacked card with full start-to-end time
                    if (isCollapsed) {
                      const disc = currentDayDiscrepancies.map[group.hinban];
                      const groupIsZeroOrMissing = disc && (disc.type === 'moved_or_zero' || disc.type === 'missing_in_excel');
                      const groupIsQtyMismatch = disc && disc.type === 'qty_mismatch';
                      const matchedPool = data.find(d => d.hinban === group.hinban);
                      const itemKataban = group.representativeItem?._kataban || extractKataban(matchedPool || group.representativeItem);
                      const itemTimeOption = group.representativeItem?._timeOption || extractTimeOption(matchedPool || group.representativeItem);

                      return (
                        <div
                          key={group.id}
                          draggable
                          onDragStart={(e) => onDragStartSchedule(e, {
                            type: 'hinban-group',
                            hinban: group.hinban,
                            ids: group.items.map(i => i.item.id)
                          }, 'scheduled')}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.stopPropagation();
                            onDropScheduled(e, group.startIndex);
                          }}
                          className={`group relative cursor-grab active:cursor-grabbing rounded-[6px] border border-l-4 border-l-[var(--freya-blue)] p-2.5 flex items-center gap-3 transition-all shadow-xs hover:border-[var(--border-strong)] hover:border-l-[var(--freya-blue)] hover:bg-[var(--surface-hover)] before:absolute before:-bottom-1.5 before:left-3 before:right-3 before:h-1.5 before:rounded-b-[4px] before:border-b before:border-x before:border-[var(--border)] before:bg-[var(--surface-hover)] mb-2 ${
                            groupIsZeroOrMissing
                              ? 'border-red-500/40 bg-red-500/5'
                              : groupIsQtyMismatch
                              ? 'border-amber-500/40 bg-amber-500/5'
                              : 'border-[var(--border)] bg-[var(--surface)]'
                          }`}
                        >
                          {/* Sequence Range Badge */}
                          <span 
                            className={`flex h-7 px-2 shrink-0 items-center justify-center rounded-[4px] text-xs font-mono font-bold shadow-2xs ${
                              groupIsZeroOrMissing
                                ? 'bg-red-600 text-white'
                                : groupIsQtyMismatch
                                ? 'bg-amber-600 text-white'
                                : 'bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)]'
                            }`}
                            title={language === 'ja' ? `工程順: #${group.startIndex + 1} ～ #${group.endIndex + 1}` : `Order: #${group.startIndex + 1} ～ #${group.endIndex + 1}`}
                          >
                            #{group.startIndex + 1}～#{group.endIndex + 1}
                          </span>

                          {/* Group Start to End Time Badge */}
                          <span className="flex flex-col items-center justify-center rounded-[4px] bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 text-xs font-mono freya-tabular text-[var(--text-primary)] min-w-[62px] shadow-2xs">
                            <span className="font-bold text-[var(--text-primary)]">{group.startTime}</span>
                            <span className="text-[10px] text-[var(--text-muted)] font-medium">～ {group.endTime}</span>
                          </span>

                          {/* Main Group Info */}
                          <div className="flex-1 flex flex-col cursor-pointer min-w-0 pr-1" onClick={() => handleCardClick(group.hinban)}>
                            <div className="flex items-center gap-4 w-full">
                              {/* Column 1: Hinban + Discrepancy Warnings */}
                              <div className="w-[210px] shrink-0 flex items-center gap-1.5 min-w-0">
                                <span className="font-mono font-bold text-xs text-[var(--text-primary)] group-hover:text-[var(--freya-blue)] transition-colors truncate" title={group.hinban}>
                                  {group.hinban}
                                </span>
                                {groupIsZeroOrMissing && (
                                  <span className="shrink-0 inline-flex items-center gap-0.5 rounded-[4px] bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold text-red-600 dark:text-red-400 border border-red-500/30">
                                    <span className="material-symbols-outlined" style={{ fontSize: 11 }}>warning</span>
                                    <span className="truncate max-w-[65px]">{disc.type === 'missing_in_excel' ? t('ff_notInExcel') : (disc.movedText || t('ff_zeroMetersToday'))}</span>
                                  </span>
                                )}
                                {groupIsQtyMismatch && (
                                  <span className="shrink-0 inline-flex items-center gap-0.5 rounded-[4px] bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                    <span className="material-symbols-outlined" style={{ fontSize: 11 }}>difference</span>
                                    <span>{disc.excelQty}{group.unit || 'm'}</span>
                                  </span>
                                )}
                              </div>

                              {/* Column 2: Kataban */}
                              <div className="w-[85px] shrink-0 text-left">
                                {itemKataban ? (
                                  <span className="inline-block truncate text-xs font-mono font-medium text-[var(--text-secondary)]" title={`型番: ${itemKataban}`}>
                                    {itemKataban}
                                  </span>
                                ) : (
                                  <span className="text-[var(--text-muted)] text-xs font-mono">—</span>
                                )}
                              </div>

                              {/* Column 3: Time Option */}
                              <div className="w-[80px] shrink-0 text-left">
                                {itemTimeOption ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-[var(--freya-blue-subtle)] border border-[var(--freya-blue)]/20 text-[11px] font-semibold font-mono freya-tabular text-[var(--freya-blue)] shadow-2xs" title={`時間オプション: ${itemTimeOption}`}>
                                    {itemTimeOption}
                                  </span>
                                ) : (
                                  <span className="text-[var(--text-muted)] text-xs font-mono">—</span>
                                )}
                              </div>
                            </div>

                            {/* Row 2: Obvious Collapsed Badges and Expand Trigger */}
                            <div className="flex items-center gap-2 mt-1.5 text-xs text-[var(--text-secondary)] flex-wrap">
                              {/* Obvious Collapsed Indicator Badge */}
                              <span className="inline-flex items-center gap-1 rounded-[4px] bg-[var(--freya-blue-subtle)] border border-[var(--freya-blue)]/30 px-2 py-0.5 text-[11px] font-bold text-[var(--freya-blue)] shadow-2xs">
                                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>layers</span>
                                <span>{t('ff_collapsedRolls').replace('{count}', group.items.length)}</span>
                              </span>

                              {/* Total Quantity */}
                              <span className="rounded-[4px] bg-[var(--surface)] border border-[var(--border)] px-1.5 py-0.5 text-[11px] font-mono font-bold text-[var(--text-primary)] freya-tabular">
                                {language === 'ja'
                                  ? `全${group.items.length}${group.unit === '枚' ? '束' : '巻'} • ${group.totalMeters.toLocaleString()}${group.unit || 'm'}`
                                  : `All ${group.items.length} ${group.unit === '枚' ? 'packs' : 'rolls'} • ${group.totalMeters.toLocaleString()}${group.unit || 'm'}`}
                              </span>

                              {/* Expand Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleGroupCollapse(group.id);
                                }}
                                className="inline-flex items-center gap-1 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] hover:border-[var(--freya-blue)] hover:text-[var(--freya-blue)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)] transition-all cursor-pointer shadow-2xs"
                                title={language === 'ja' ? '展開して各巻を表示' : 'Expand to view individual rolls'}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>unfold_more</span>
                                <span>{t('ff_expand')}</span>
                              </button>

                              {groupIsQtyMismatch && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateHinbanQty(group.hinban);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-[4px] border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-colors ml-1 cursor-pointer shadow-2xs"
                                  title={language === 'ja' ? '最新Excelデータに合わせて巻数・所要時間を更新' : 'Update rolls and duration to match Excel'}
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>sync</span>
                                  {t('ff_updateQtyPrompt').replace('{qty}', `${disc.excelQty}${group.unit || 'm'}`)}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Total Duration of Group */}
                          <span className="text-xs font-mono font-bold freya-tabular text-[var(--text-primary)] whitespace-nowrap bg-[var(--surface)] border border-[var(--border)] rounded-[4px] px-2 py-0.5" title={language === 'ja' ? `合計所要時間: ${formatTime(group.totalDuration)}` : `Total duration: ${formatTime(group.totalDuration)}`}>
                            {formatTime(group.totalDuration)}
                          </span>

                          {/* Remove all rolls from schedule */}
                          <button 
                            onClick={() => handleRemoveFromSchedule({ type: 'hinban', hinban: group.hinban })}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] hover:border-red-500/30 hover:text-red-600 text-[var(--text-muted)] transition-all shadow-2xs ml-1 cursor-pointer"
                            title={t('ff_removeFromSchedule')}
                          >
                            <span className="material-symbols-outlined" style={{fontSize: 16}}>arrow_back</span>
                          </button>
                        </div>
                      );
                    }

                    // If Expanded: Render group header bar with collapse toggle followed by each roll
                    return (
                      <div key={group.id} className="flex flex-col gap-2 rounded-[6px] border border-[var(--freya-blue)]/30 bg-[var(--surface)] p-2 shadow-2xs">
                        {/* Expanded Group Header Bar */}
                        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-[4px] bg-[var(--surface-hover)] border border-[var(--border)] text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 16 }}>layers</span>
                            <span className="font-mono font-bold text-[var(--text-primary)] truncate">{group.hinban}</span>
                            <span className="text-[11px] font-mono text-[var(--text-muted)]">
                              (#{group.startIndex + 1}～#{group.endIndex + 1} • {group.startTime}～{group.endTime} • {formatTime(group.totalDuration)})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleGroupCollapse(group.id)}
                            className="inline-flex items-center gap-1 rounded-[4px] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] hover:border-[var(--freya-blue)] hover:text-[var(--freya-blue)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)] transition-all cursor-pointer shadow-2xs shrink-0"
                            title={language === 'ja' ? 'この品番の巻を折りたたむ' : 'Collapse rolls for this hinban'}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>unfold_less</span>
                            <span>{t('ff_collapse')}</span>
                          </button>
                        </div>

                        {/* Individual Rolls in Group */}
                        <div className="flex flex-col gap-2">
                          {group.items.map(({ item, index }) => renderRollCard(item, index))}
                        </div>
                      </div>
                    );
                  })
                )}
                {scheduleWithTimes.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-secondary)] freya-tabular shrink-0 bg-[var(--surface)] rounded-[6px] px-3 py-2 border border-[var(--border)] shadow-2xs">
                    <span className="font-bold text-[var(--text-primary)]">
                      {language === 'ja' ? `合計: ${scheduledItems.length} 工程` : `Total: ${scheduledItems.length} items`}
                    </span>
                    <span className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 16 }}>schedule</span>
                      <span className="font-mono">{startTime} ～ {scheduledEndTime}</span>
                      <span className="text-[var(--text-muted)] font-semibold font-mono">({formatTime(scheduledTotalMins)})</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <div className="flex flex-col gap-6">
          {/* Header Controls, Month Selector & View Mode Switcher */}
          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 20 }}>calendar_month</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{t('ff_targetMonth')}</span>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={handleMonthChange}
                    className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-xs font-mono font-semibold text-[var(--text-primary)] focus:border-[var(--freya-blue)] focus:outline-none"
                    title={language === 'ja' ? '表示する月を選択' : 'Select month for summary'}
                  />
                </div>
              </div>

              {/* View Mode Switcher */}
              <div className="flex items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-1 text-xs">
                <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 16 }}>view_list</span>
                <span className="text-[var(--text-muted)] font-medium">{t('ff_dataSource')}</span>
                <select
                  value={summaryViewMode}
                  onChange={(e) => handleSummaryViewModeChange(e.target.value)}
                  className="bg-transparent font-semibold text-xs text-[var(--text-primary)] focus:outline-none cursor-pointer"
                >
                  <option value="priority">{t('ff_dataSourcePriority')}</option>
                  <option value="raw">{t('ff_dataSourceRaw')}</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>info</span>
              <span>
                {summaryViewMode === 'priority' 
                  ? t('ff_summaryInfoPriority').replace('{month}', selectedMonth)
                  : t('ff_summaryInfoRaw').replace('{month}', selectedMonth)}
              </span>
            </div>
          </div>

          {/* Daily Breakdown Table */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 20 }}>calendar_view_month</span>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  {summaryViewMode === 'priority' ? t('ff_dailyScheduleTableTitlePriority') : t('ff_dailyScheduleTableTitleRaw')}
                </h3>
              </div>
              <span className="text-xs font-mono freya-tabular text-[var(--text-muted)]">
                {language === 'ja' ? `${selectedMonth} 1日 ～ ${daysInSelectedMonth}日` : `1st ～ ${daysInSelectedMonth}th of ${selectedMonth}`}
              </span>
            </div>

            <DataTable
              columns={summaryColumns}
              rows={sortedSummaryRows}
              enableColumnResize={true}
              enableColumnReorder={true}
              layoutStorageKey="firstFactory_monthly_summary_table_layout"
              sort={summarySort}
              onSort={handleSummarySort}
              pageSize={35}
              filteredCount={sortedSummaryRows.length}
              totalPages={1}
              stickyHeader={true}
              stickyHeaderOffset={0}
              stickyHeaderCellClassName="bg-[var(--surface-raised)] border-b border-[var(--border)]"
              tableViewportClassName="overflow-x-auto"
              className="freya-card overflow-hidden"
              rowKey={(row) => row.dateKey}
              emptyTitle={t('ff_noScheduleData')}
              emptyMessage={t('ff_noSchedulesFoundMonth')}
            />
          </div>
        </div>
      )}

      {/* Production Tab (Live Production Tracking) */}
      {activeTab === 'production' && (
        <div className="flex flex-col gap-6">
          {/* Header Controls & Date Navigation */}
          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 20 }}>event</span>
                <input
                  type="date"
                  value={productionDateStr}
                  onChange={(e) => {
                    if (e.target.value) setProductionDateStr(e.target.value);
                  }}
                  className="rounded-[6px] border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-xs font-mono font-semibold text-[var(--text-primary)] focus:border-[var(--freya-blue)] focus:outline-none cursor-pointer"
                  title={language === 'ja' ? '生産実績日を選択' : 'Select production date'}
                />
              </div>

              {/* Quick Date Switchers */}
              <div className="flex items-center rounded-[6px] border border-[var(--border)] bg-[var(--surface-raised)] p-0.5">
                <button
                  type="button"
                  onClick={() => stepProductionDate(-1)}
                  className="flex h-6 w-6 items-center justify-center rounded-[4px] hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  title={t('ff_prevDay')}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProductionDateStr(getLocalYYYYMMDD())}
                  className={`px-2.5 py-0.5 text-xs font-medium rounded-[4px] transition-colors cursor-pointer ${productionDateStr === getLocalYYYYMMDD() ? 'bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                >
                  {t('ff_today')}
                </button>
                <button
                  type="button"
                  onClick={() => stepProductionDate(1)}
                  className="flex h-6 w-6 items-center justify-center rounded-[4px] hover:bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  title={t('ff_nextDay')}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
                </button>
              </div>

              {/* Machine Badge */}
              <span className="inline-flex items-center gap-1.5 rounded-[6px] bg-[var(--surface-raised)] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)] border border-[var(--border)]">
                <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 15 }}>precision_manufacturing</span>
                <span>{t('ff_machine')}</span>
              </span>

              {/* Realtime Live Connection Indicator */}
              <span 
                className={`inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-xs font-medium transition-colors ${
                  isLiveConnected 
                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' 
                    : 'bg-[var(--surface-raised)] text-[var(--text-muted)] border border-[var(--border)]'
                }`}
                title={isLiveConnected ? t('ff_liveTooltipConnected') : t('ff_liveTooltipConnecting')}
              >
                <span className={`h-2 w-2 rounded-full ${isLiveConnected ? 'bg-emerald-500 animate-pulse' : 'bg-[var(--text-muted)]'}`}></span>
                <span>{isLiveConnected ? t('ff_liveRealtime') : t('ff_liveSyncing')}</span>
              </span>
            </div>

            {/* Refresh Button */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--text-muted)] font-mono freya-tabular hidden sm:inline">
                {t('ff_processesScheduled').replace('{count}', productionGroups.length)}
              </span>
              <button
                type="button"
                onClick={() => fetchProductionData(productionDateStr)}
                disabled={loadingProduction}
                className="flex items-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors disabled:opacity-50 cursor-pointer"
                title={language === 'ja' ? 'リアルタイム生産状況を更新' : 'Refresh live production tracking data'}
              >
                <span className={`material-symbols-outlined ${loadingProduction ? 'animate-spin' : ''}`} style={{ fontSize: 16 }}>
                  refresh
                </span>
                <span>{loadingProduction ? t('ff_refreshing') : t('ff_refresh')}</span>
              </button>
            </div>
          </div>

          {/* Progress Overview Bar */}
          {productionGroups.length > 0 && (
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--text-primary)] text-sm">
                    {parseInt(productionDateStr.split('-')[1], 10)}/{parseInt(productionDateStr.split('-')[2], 10)} {t('ff_productionProgress')}
                  </span>
                  <span className="rounded-[4px] bg-[var(--surface-raised)] border border-[var(--border)] px-2 py-0.5 font-mono freya-tabular text-xs font-semibold text-[var(--text-primary)]">
                    {t('ff_completedCount')
                      .replace('{completed}', productionStats.completed)
                      .replace('{total}', productionStats.total)
                      .replace('{percent}', productionStats.progressPercent)}
                  </span>
                </div>
                {productionStats.inProgress > 0 && (
                  <span className="inline-flex items-center gap-1.5 font-medium text-purple-600 dark:text-purple-400">
                    <span className="h-2 w-2 rounded-full bg-purple-600 animate-pulse"></span>
                    {t('ff_inProgressNow').replace('{count}', productionStats.inProgress)}
                  </span>
                )}
              </div>

              {/* Progress bar visual */}
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-raised)] border border-[var(--border)] flex">
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
              className={`flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${productionFilter === 'all' ? 'bg-[var(--text-primary)] text-[var(--surface)]' : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            >
              <span>{t('ff_filterAll')}</span>
              <span className="rounded-[4px] bg-[var(--surface-raised)] px-1.5 py-0.2 text-[11px] font-mono freya-tabular">
                {productionStats.total}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setProductionFilter('in-progress')}
              className={`flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${productionFilter === 'in-progress' ? 'bg-purple-600 text-white' : 'bg-[var(--surface)] border border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10'}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full bg-purple-500 ${productionStats.inProgress > 0 ? 'animate-ping' : ''}`}></span>
              <span>{t('ff_filterInProgress')}</span>
              <span className="rounded-[4px] bg-purple-500/20 px-1.5 py-0.2 text-[11px] font-mono freya-tabular">
                {productionStats.inProgress}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setProductionFilter('completed')}
              className={`flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${productionFilter === 'completed' ? 'bg-emerald-600 text-white' : 'bg-[var(--surface)] border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'}`}
            >
              <span>{t('ff_filterCompleted')}</span>
              <span className="rounded-[4px] bg-emerald-500/20 px-1.5 py-0.2 text-[11px] font-mono freya-tabular">
                {productionStats.completed}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setProductionFilter('pending')}
              className={`flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${productionFilter === 'pending' ? 'bg-[var(--text-secondary)] text-[var(--surface)]' : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            >
              <span>{t('ff_filterPending')}</span>
              <span className="rounded-[4px] bg-[var(--surface-raised)] px-1.5 py-0.2 text-[11px] font-mono freya-tabular">
                {productionStats.pending}
              </span>
            </button>

            {productionStats.canceled > 0 && (
              <button
                type="button"
                onClick={() => setProductionFilter('canceled')}
                className={`flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${productionFilter === 'canceled' ? 'bg-rose-600 text-white' : 'bg-[var(--surface)] border border-rose-500/30 text-rose-600 hover:bg-rose-500/10'}`}
              >
                <span>{t('ff_filterCanceled')}</span>
                <span className="rounded-[4px] bg-rose-500/20 px-1.5 py-0.2 text-[11px] font-mono freya-tabular">
                  {productionStats.canceled}
                </span>
              </button>
            )}
          </div>

          {/* Processes List */}
          {loadingProduction ? (
            <div className="flex flex-col items-center justify-center p-12 rounded-[8px] border border-[var(--border)] bg-[var(--surface)]">
              <span className="material-symbols-outlined text-[var(--freya-blue)] animate-spin" style={{ fontSize: 32 }}>sync</span>
              <p className="mt-3 text-xs font-medium text-[var(--text-muted)]">{t('ff_loadingProductionStatus')}</p>
            </div>
          ) : filteredProductionGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] text-center">
              <span className="material-symbols-outlined text-[var(--text-muted)] mb-2" style={{ fontSize: 40 }}>event_busy</span>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                {productionGroups.length === 0 
                  ? t('ff_noScheduleFoundDate').replace('{date}', productionDateStr)
                  : t('ff_noProcessesMatchFilter').replace('{filter}', productionFilter)}
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 max-w-md">
                {productionGroups.length === 0 
                  ? t('ff_noScheduleHint')
                  : t('ff_tryDifferentFilterHint')}
              </p>
              {productionGroups.length === 0 && (
                <button
                  type="button"
                  onClick={() => {
                    updateSelectedDate(productionDateStr);
                    navigate(`/firstFactory/scheduling?date=${productionDateStr}`);
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit_calendar</span>
                  {t('ff_createScheduleForDate')}
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
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
                      className="rounded-[8px] border border-amber-500/30 bg-amber-500/5 p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="inline-flex min-h-[30px] min-w-[48px] px-2.5 py-1 shrink-0 items-center justify-center rounded-[4px] bg-amber-500/20 text-xs font-mono font-bold text-amber-700 dark:text-amber-300 whitespace-nowrap">
                          {group.orderRange}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded-[4px] bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                              {t('ff_setupBadge')}
                            </span>
                            <h4 className="font-semibold text-sm text-[var(--text-primary)]">
                              {setupItem?.comment ? `${group.name} ${setupItem.comment}` : group.name}
                            </h4>
                          </div>
                          <p className="text-xs text-[var(--text-muted)] font-mono freya-tabular mt-0.5">
                            🕒 {t('ff_scheduledTime')}: {group.startTime} ～ {group.endTime} ({group.totalDuration} {t('ff_minutesShort')})
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="rounded-[4px] bg-amber-500/10 px-2.5 py-1 text-xs font-mono font-semibold text-amber-700 dark:text-amber-400 border border-amber-500/20">
                          ⚙️ {group.totalDuration} {t('ff_minutesShort')}
                        </span>
                      </div>
                    </div>
                  );
                }

                // Hinban Group Card
                return (
                  <div
                    key={group.groupId}
                    className={`rounded-[8px] border p-4 flex flex-col gap-3 transition-colors ${
                      isInProgress
                        ? 'border-purple-500/50 bg-purple-500/5 dark:bg-purple-950/20'
                        : isCompleted
                        ? 'border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/10'
                        : isCanceled
                        ? 'border-rose-500/30 bg-rose-500/5'
                        : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    {/* Card Top Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 border-b border-[var(--border)]">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex min-h-[30px] min-w-[48px] px-2.5 py-1 shrink-0 items-center justify-center rounded-[4px] text-xs font-mono font-bold whitespace-nowrap ${
                          isInProgress
                            ? 'bg-purple-600 text-white animate-pulse'
                            : isCompleted
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-primary)]'
                        }`}>
                          {group.orderRange}
                        </span>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <button 
                              type="button"
                              onClick={() => handleCardClick(group.hinban)}
                              className="text-base font-semibold text-[var(--text-primary)] hover:text-[var(--freya-blue)] transition-colors cursor-pointer inline-flex items-center gap-1.5 group text-left"
                              title={t('ff_viewDetails')}
                            >
                              <span>{group.hinban}</span>
                              <span className="material-symbols-outlined text-[var(--text-muted)] group-hover:text-[var(--freya-blue)] transition-colors" style={{ fontSize: 16 }}>
                                open_in_new
                              </span>
                            </button>
                            {group.labelHinban && group.labelHinban !== group.hinban && (
                              <span className="rounded-[4px] bg-[var(--surface-raised)] border border-[var(--border)] px-1.5 py-0.5 text-[11px] font-mono text-[var(--text-muted)]">
                                Label: {group.labelHinban}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--text-muted)] font-normal mt-0.5">
                            {group.hinmei || '—'}
                          </p>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="flex items-center gap-2">
                        {isInProgress && (
                          <div className="inline-flex items-center gap-1.5 rounded-[4px] bg-purple-600 px-2.5 py-1 text-xs font-semibold text-white">
                            <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping"></span>
                            <span>{language === 'ja' ? '生産中' : 'In-Progress'}</span>
                            {group.actualStartTime && (
                              <span className="font-mono opacity-90">({group.actualStartTime}〜)</span>
                            )}
                          </div>
                        )}

                        {isCompleted && (
                          <div className="inline-flex items-center gap-1.5 rounded-[4px] bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>check_circle</span>
                            <span>{language === 'ja' ? '完了' : 'Completed'}</span>
                            {group.actualDurationMins && (
                              <span className="font-mono">({group.actualDurationMins}{t('ff_minutesShort')})</span>
                            )}
                          </div>
                        )}

                        {isPending && (
                          <div className="inline-flex items-center gap-1.5 rounded-[4px] bg-[var(--surface-raised)] px-2.5 py-1 text-xs font-medium text-[var(--text-muted)] border border-[var(--border)]">
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>hourglass_empty</span>
                            <span>{language === 'ja' ? '待機中' : 'Pending'}</span>
                          </div>
                        )}

                        {isCanceled && (
                          <div className="inline-flex items-center gap-1.5 rounded-[4px] bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-600 border border-rose-500/20">
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>cancel</span>
                            <span>{language === 'ja' ? '中止' : 'Canceled'}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Metadata Specs Strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 text-xs">
                      <div className="rounded-[6px] bg-[var(--surface-raised)] border border-[var(--border)] p-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block">{t('ff_scheduledTime')}</span>
                        <span className="font-mono freya-tabular font-medium text-[var(--text-primary)] mt-0.5 block truncate">
                          🕒 {group.startTime} ～ {group.endTime}
                        </span>
                      </div>

                      <div className="rounded-[6px] bg-[var(--surface-raised)] border border-[var(--border)] p-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block">{t('ff_actualTime')}</span>
                        <span className="font-mono freya-tabular font-medium mt-0.5 block truncate">
                          {isCompleted && group.actualStartTime ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              ⏱️ {group.actualStartTime} ～ {group.actualEndTime || ''}
                            </span>
                          ) : isInProgress && (group.actualStartTime || group.startTime) ? (
                            <span className="text-purple-600 dark:text-purple-400 animate-pulse">
                              ⏱️ {group.actualStartTime || group.startTime}〜
                            </span>
                          ) : (
                            <span className="text-[var(--text-muted)]">—</span>
                          )}
                        </span>
                      </div>

                      <div className="rounded-[6px] bg-[var(--surface-raised)] border border-[var(--border)] p-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block">{t('ff_totalVolume')}</span>
                        <span className="font-mono freya-tabular font-semibold text-[var(--text-primary)] mt-0.5 block">
                          {group.items.length} {language === 'ja' ? '巻' : 'rolls'} ({group.totalMeters}m)
                        </span>
                      </div>

                      <div className="rounded-[6px] bg-[var(--surface-raised)] border border-[var(--border)] p-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block">{t('ff_kizaiColor')}</span>
                        <span className="font-medium text-[var(--text-secondary)] mt-0.5 block truncate">
                          {group.kizai || '—'} {group.color ? `• ${group.color}` : ''}
                        </span>
                      </div>

                      <div className="rounded-[6px] bg-[var(--surface-raised)] border border-[var(--border)] p-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block">{t('ff_destination')}</span>
                        <span className="font-medium text-[var(--text-secondary)] mt-0.5 block truncate">
                          {group.shippingDest || '—'}
                        </span>
                      </div>

                      <div className="rounded-[6px] bg-[var(--surface-raised)] border border-[var(--border)] p-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block">{t('ff_operator')}</span>
                        <span className="font-medium text-[var(--text-primary)] mt-0.5 block truncate">
                          👤 {group.worker || '—'}
                        </span>
                      </div>

                      <div className="rounded-[6px] bg-[var(--surface-raised)] border border-[var(--border)] p-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] block">{t('ff_machineLabel')}</span>
                        <span className="font-mono freya-tabular font-medium text-[var(--text-primary)] mt-0.5 block truncate">
                          🏭 {group.machine || 'PSA-2'}
                        </span>
                      </div>
                    </div>

                    {/* Print Status Sub-list */}
                    {(() => {
                      const printedRollIndices = new Set(
                        Array.isArray(group.statusRecord?.printHistory)
                          ? group.statusRecord.printHistory.map(p => Number(p.rollIndex))
                          : []
                      );
                      const printedCount = printedRollIndices.size;
                      const totalRolls = group.items.length;
                      const allDone = totalRolls > 0 && printedCount >= totalRolls;

                      return (
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border)] mt-1">
                          <div className="flex items-center gap-1.5 mr-1">
                            <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 16 }}>print</span>
                            <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)]">{t('ff_printStatus')}</span>
                            <span className={`rounded-[4px] px-1.5 py-0.2 text-[10px] font-mono freya-tabular font-semibold ${allDone ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20' : 'bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-muted)]'}`}>
                              {language === 'ja' ? `${printedCount} / ${totalRolls} 枚 印刷済` : `${printedCount} / ${totalRolls} Printed`}
                            </span>
                          </div>

                          {group.items.map((roll, rIdx) => {
                            const rollNum = Number(roll.rollIndex) || (rIdx + 1);
                            const isPrinted = printedRollIndices.has(rollNum);

                            return (
                              <div
                                key={roll.id || rIdx}
                                className={`inline-flex items-center gap-1.5 rounded-[4px] px-2 py-0.5 text-xs transition-colors ${
                                  isPrinted
                                    ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold'
                                    : 'border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-muted)]'
                                }`}
                                title={isPrinted ? t('ff_rollPrintedTooltip').replace('{roll}', rollNum).replace('{total}', totalRolls) : t('ff_rollWaitingPrintTooltip').replace('{roll}', rollNum).replace('{total}', totalRolls)}
                              >
                                <span className={`material-symbols-outlined ${isPrinted ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--text-muted)]'}`} style={{ fontSize: 14 }}>
                                  {isPrinted ? 'check_circle' : 'radio_button_unchecked'}
                                </span>
                                <span className="font-mono freya-tabular">
                                  {rollNum}/{totalRolls}
                                </span>
                                <span className="opacity-75 font-mono freya-tabular text-[11px]">({roll.meters}m)</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
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
          <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-[12px] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-[fadeIn_0.15s_ease-out]">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--surface)]">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t('ff_modalSyncTitle')}</h2>
              <button 
                onClick={() => setIsSyncModalOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-[6px] hover:bg-[var(--surface-raised)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                title={t('ff_close')}
              >
                <span className="material-symbols-outlined" style={{fontSize: 18}}>close</span>
              </button>
            </div>
            <div className="p-5">
              <label className="block text-xs font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] mb-1.5">{t('ff_modalSelectYearMonth')}</label>
              <input
                type="month"
                value={syncTargetMonth}
                onChange={(e) => setSyncTargetMonth(e.target.value)}
                className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-mono font-semibold text-[var(--text-primary)] focus:border-[var(--freya-blue)] focus:outline-none"
              />
              <p className="text-xs text-[var(--text-muted)] mt-2.5 leading-relaxed">
                {language === 'ja' 
                  ? `Googleスプレッドシートの ${syncTargetMonth ? `${syncTargetMonth.split('-')[0]}年${parseInt(syncTargetMonth.split('-')[1], 10)}月` : '...'} タブからデータを取得します。`
                  : `This will fetch data from the ${syncTargetMonth ? `${syncTargetMonth.split('-')[0]}年${parseInt(syncTargetMonth.split('-')[1], 10)}月` : '...'} tab in the Google Sheet.`}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 p-3 border-t border-[var(--border)] bg-[var(--surface)]">
              <button 
                onClick={() => setIsSyncModalOpen(false)}
                className="rounded-[6px] border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] transition-colors cursor-pointer"
              >
                {t('ff_cancel')}
              </button>
              <button 
                onClick={() => handleSyncExcel(syncTargetMonth)}
                className="rounded-[6px] bg-[var(--freya-blue)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors cursor-pointer"
              >
                {t('ff_fetchData')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Discrepancy Review Modal for Selected Date */}
      {isDiscrepancyModalOpen && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-[12px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-[fadeIn_0.15s_ease-out]">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--surface)]">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-amber-600" style={{ fontSize: 22 }}>sync_problem</span>
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                    {language === 'ja' ? `${selectedDateStr} のExcel同期差異` : `Excel Discrepancies on ${selectedDateStr}`}
                  </h2>
                  <p className="text-xs text-[var(--text-muted)] font-mono freya-tabular">
                    {language === 'ja' ? `${currentDayDiscrepancies.count} 件の差異品番を検知` : `${currentDayDiscrepancies.count} affected hinban(s) detected`}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsDiscrepancyModalOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-[6px] hover:bg-[var(--surface-raised)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                title={t('ff_close')}
              >
                <span className="material-symbols-outlined" style={{fontSize: 18}}>close</span>
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-2.5">
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                {language === 'ja'
                  ? `以下の項目は作成済スケジュールと最新のExcelデータで差異があります。個別に反映するか、「すべて自動反映」をクリックして更新できます (${selectedDateStr})。`
                  : `The items below are currently in this date's priority schedule, but differ from the latest synced Excel data. You can resolve them individually or click Auto-Align All to update this date (${selectedDateStr}).`}
              </p>

              {currentDayDiscrepancies.list.map(disc => {
                const isZeroOrMissing = disc.type === 'moved_or_zero' || disc.type === 'missing_in_excel';
                return (
                  <div 
                    key={disc.hinban} 
                    className={`rounded-[6px] border p-3 flex flex-col gap-2 ${
                      isZeroOrMissing ? 'border-red-500/30 bg-red-500/5' : 'border-amber-500/30 bg-amber-500/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-[var(--text-primary)]">{disc.hinban}</span>
                      <span className="text-xs text-[var(--text-muted)] font-mono freya-tabular">
                        {language === 'ja' 
                          ? `設定済: ${disc.scheduledMeters}m (${disc.rollsCount} 巻)` 
                          : `Scheduled: ${disc.scheduledMeters}m (${disc.rollsCount} roll${disc.rollsCount === 1 ? '' : 's'})`}
                      </span>
                    </div>

                    <div className="text-xs">
                      {isZeroOrMissing ? (
                        <div className="flex items-center gap-1.5 text-red-600 font-medium">
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>cancel</span>
                          <span>{disc.type === 'missing_in_excel' ? t('ff_notInExcelThisMonth') : (disc.movedText || t('ff_zeroMetersToday'))}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>difference</span>
                          <span className="font-mono freya-tabular">{language === 'ja' ? `Excel数量: ${disc.excelQty}m (差分: ${(disc.excelQty - disc.scheduledMeters).toFixed(1)}m)` : `Excel Quantity: ${disc.excelQty}m (Difference: ${(disc.excelQty - disc.scheduledMeters).toFixed(1)}m)`}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end pt-1">
                      {isZeroOrMissing ? (
                        <button
                          type="button"
                          onClick={() => {
                            setScheduleOrder(prev => prev.filter(i => i.hinban !== disc.hinban));
                          }}
                          className="inline-flex items-center gap-1 rounded-[6px] border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-500/20 transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                          {language === 'ja' ? `${parseInt(selectedMonth.split('-')[1], 10)}/${selectedDay} から削除` : `Remove from ${parseInt(selectedMonth.split('-')[1], 10)}/${selectedDay}`}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUpdateHinbanQty(disc.hinban)}
                          className="inline-flex items-center gap-1 rounded-[6px] border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>sync</span>
                          {language === 'ja' ? `数量・巻数を ${disc.excelQty}m に更新` : `Update Qty & Rolls to ${disc.excelQty}m`}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between p-3 border-t border-[var(--border)] bg-[var(--surface)]">
              <button 
                onClick={() => setIsDiscrepancyModalOpen(false)}
                className="rounded-[6px] border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] transition-colors cursor-pointer"
              >
                {t('ff_close')}
              </button>
              <button 
                onClick={handleAutoAlignCurrentDate}
                className="flex items-center gap-1.5 rounded-[6px] bg-[var(--freya-blue)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>auto_fix_high</span>
                {language === 'ja' ? `${parseInt(selectedMonth.split('-')[1], 10)}/${selectedDay} の差異をすべて自動反映` : `Auto-Align All on ${parseInt(selectedMonth.split('-')[1], 10)}/${selectedDay}`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Post-Sync Schedule Impact Summary Modal */}
      {isImpactModalOpen && createPortal(
        <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-[12px] shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh] animate-[fadeIn_0.15s_ease-out]">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--surface)]">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[var(--freya-blue)]" style={{ fontSize: 22 }}>assessment</span>
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">{t('ff_syncImpactTitle')}</h2>
                  <p className="text-xs text-[var(--text-muted)] font-mono freya-tabular">
                    {language === 'ja' ? `${selectedMonth} の既存優先順位スケジュールに差異が検出されました` : `New Excel data affects existing priority schedules in ${selectedMonth}`}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsImpactModalOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-[6px] hover:bg-[var(--surface-raised)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                title={t('ff_close')}
              >
                <span className="material-symbols-outlined" style={{fontSize: 18}}>close</span>
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-3">
              <div className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--text-secondary)] leading-relaxed">
                {t('ff_syncImpactDesc')}
              </div>

              <div className="flex flex-col gap-2.5">
                {syncImpactReport.map(report => (
                  <div key={report.dateKey} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold text-xs text-[var(--text-primary)]">
                        <span className="material-symbols-outlined text-[var(--text-muted)]" style={{ fontSize: 16 }}>calendar_today</span>
                        <span className="font-mono freya-tabular">{parseInt(selectedMonth.split('-')[1], 10)}/{report.date}</span>
                        <span className="rounded-[4px] bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                          {language === 'ja' ? `${report.issues.length} 件の変更` : `${report.issues.length} issue${report.issues.length === 1 ? '' : 's'}`}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          updateSelectedDate(report.dateKey);
                          setIsImpactModalOpen(false);
                          if (activeTab !== 'scheduling') {
                            navigate(`/firstFactory/scheduling?date=${report.dateKey}`);
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--freya-blue)] hover:text-[var(--freya-blue)] transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
                        {t('ff_openScheduleBtn')}
                      </button>
                    </div>

                    <div className="flex flex-col gap-1.5 pl-5 border-l-2 border-[var(--border)]">
                      {report.issues.map((iss, i) => (
                        <div key={i} className="text-xs flex items-start gap-1.5">
                          <span className="font-semibold text-[var(--text-primary)] shrink-0">{iss.hinban}:</span>
                          <span className={iss.type === 'moved_or_zero' || iss.type === 'missing' ? 'text-red-600 font-medium' : 'text-amber-700 dark:text-amber-400 font-medium'}>
                            {iss.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end p-3 border-t border-[var(--border)] bg-[var(--surface)]">
              <button 
                onClick={() => setIsImpactModalOpen(false)}
                className="rounded-[6px] bg-[var(--freya-blue)] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors cursor-pointer"
              >
                {t('ff_closeAndReview')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Setup Comment / Custom Title Modal */}
      {commentModalItem && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-[fadeIn_0.15s_ease-out]">
          <div className="w-full max-w-md rounded-[12px] border border-[var(--border)] bg-[var(--surface-raised)] p-5 shadow-2xl flex flex-col gap-3.5">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600" style={{ fontSize: 20 }}>edit_note</span>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  {language === 'ja' 
                    ? `${commentModalItem.displayName || commentModalItem.name} の追加タイトル・指示` 
                    : `Custom Title for ${commentModalItem.displayName || commentModalItem.name}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCommentModalItem(null)}
                className="rounded-[6px] p-1 text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                title={t('ff_close')}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>

            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              {t('ff_setupCardDesc')}
            </p>

            <div className="rounded-[6px] bg-[var(--surface)] border border-[var(--border)] p-2.5 text-xs text-[var(--text-primary)] font-semibold flex items-center gap-2">
              <span className="text-[var(--text-muted)] text-[11px] font-normal shrink-0">{t('ff_titlePreview')}</span>
              <span className="font-semibold text-[var(--freya-blue)]">{commentModalItem.displayName || commentModalItem.name} {tempCommentText.trim()}</span>
            </div>

            <input
              type="text"
              value={tempCommentText}
              onChange={(e) => setTempCommentText(e.target.value)}
              placeholder={t('ff_placeholderCustomText')}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] p-2.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--freya-blue)] focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const text = tempCommentText.trim();
                  if (commentModalItem.isPreset) {
                    const key = commentModalItem.isCustom ? 'custom' : commentModalItem.name;
                    setSetupComments(prev => ({ ...prev, [key]: text }));
                  } else if (commentModalItem.id) {
                    setScheduleOrder(prev => prev.map(item => {
                      if (item.id === commentModalItem.id) {
                        return { ...item, comment: text };
                      }
                      return item;
                    }));
                    setHasUnsavedChanges(true);
                  }
                  setCommentModalItem(null);
                }
              }}
            />

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--border)]">
              {tempCommentText ? (
                <button
                  type="button"
                  onClick={() => setTempCommentText('')}
                  className="text-xs font-medium text-red-500 hover:underline cursor-pointer"
                >
                  {t('ff_clearSuffix')}
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCommentModalItem(null)}
                  className="rounded-[6px] border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
                >
                  {t('ff_cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const text = tempCommentText.trim();
                    if (commentModalItem.isPreset) {
                      const key = commentModalItem.isCustom ? 'custom' : commentModalItem.name;
                      setSetupComments(prev => ({ ...prev, [key]: text }));
                    } else if (commentModalItem.id) {
                      setScheduleOrder(prev => prev.map(item => {
                        if (item.id === commentModalItem.id) {
                          return { ...item, comment: text };
                        }
                        return item;
                      }));
                      setHasUnsavedChanges(true);
                    }
                    setCommentModalItem(null);
                  }}
                  className="rounded-[6px] bg-[var(--freya-blue)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--freya-blue-hover)] transition-colors cursor-pointer"
                >
                  {t('ff_saveTitle')}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}

