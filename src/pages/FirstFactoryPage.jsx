import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

export default function FirstFactoryPage() {
  const { t } = useLanguage();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 30;
  const fetchSchedule = async () => {
    setLoading(true);
    try {
      // Fetch from Kurachi backend
      const res = await fetch('http://localhost:3000/api/production/schedule');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Error fetching schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, []);

  const handleSyncExcel = async () => {
    setSyncing(true);
    try {
      const res = await fetch('http://localhost:3000/api/production/sync-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: '2026-07' }) // Hardcoded to July 2026 for now
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        fetchSchedule();
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

  const handleSaveOrder = async () => {
    try {
      const scheduleOrder = data.map(item => item.hinban);
      const res = await fetch('http://localhost:3000/api/production/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleOrder })
      });
      const json = await res.json();
      if (json.success) {
        alert('Schedule order saved successfully!');
      }
    } catch (err) {
      console.error('Error saving order:', err);
    }
  };

  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('dragIndex', index);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, dropIndex) => {
    const dragIndex = Number(e.dataTransfer.getData('dragIndex'));
    const newData = [...data];
    const [draggedItem] = newData.splice(dragIndex, 1);
    newData.splice(dropIndex, 0, draggedItem);
    setData(newData);
  };

  const filteredData = data.filter(item => item.hinban.toLowerCase().includes(filter.toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filteredData.length / ITEMS_PER_PAGE));
  const currentData = filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleFilterChange = (e) => {
    setFilter(e.target.value);
    setCurrentPage(1);
  };

  // Generate days 1-31
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="p-6 pt-24 pb-24 overflow-y-auto h-screen">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">{t('firstFactory')}</h1>
          <p className="mt-1 text-sm text-outline">Manage schedule and priorities</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleSyncExcel}
            disabled={syncing}
            className="flex items-center gap-2 rounded-xl border border-primary/30 px-4 py-2 text-sm font-semibold text-primary transition-all hover:bg-primary/5 disabled:opacity-50"
          >
            <span className={`material-symbols-outlined ${syncing ? 'animate-spin' : ''}`} style={{ fontSize: 20 }}>sync</span>
            {syncing ? 'Syncing...' : 'Sync Excel'}
          </button>
          <button 
            onClick={handleSaveOrder}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>save</span>
            {t('save')}
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-outline-variant/30 bg-surface/50 p-4 backdrop-blur-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
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
                  <td colSpan={33} className="px-4 py-8 text-center text-outline">{t('noData')}</td>
                </tr>
              ) : (
                currentData.map((item, index) => (
                  <React.Fragment key={item.id}>
                    {/* Orders Row (Draggable by Hinban block) */}
                    <tr
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, index)}
                      className="border-t border-outline-variant/20 hover:bg-surface-variant/20 cursor-grab active:cursor-grabbing"
                    >
                      <td className="sticky left-0 bg-surface px-4 py-2 font-medium" rowSpan={2}>
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-outline cursor-move">drag_indicator</span>
                          {item.hinban}
                        </div>
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

      {/* Pagination Controls */}
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
    </div>
  );
}
