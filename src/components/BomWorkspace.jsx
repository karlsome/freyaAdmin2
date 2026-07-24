import React, { useState, useEffect } from 'react';
import { query } from '../services/api';
import BomEditModal from './BomEditModal';

export default function BomWorkspace({ onFlash }) {
  const [boms, setBoms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedBom, setSelectedBom] = useState(null);

  useEffect(() => {
    fetchBoms();
  }, []);

  async function fetchBoms() {
    setLoading(true);
    try {
      const res = await query("Sasaki_Coating_MasterDB", "bomMasterDB", {});
      const data = Array.isArray(res) ? res : res?.data || [];
      setBoms(data);
    } catch (err) {
      console.error(err);
      if (onFlash) onFlash({ type: "error", message: "Failed to load BOMs" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dashboard-section rounded-2xl px-6 py-6 h-full flex flex-col gap-6 animate-[fadeIn_0.15s_ease-out]">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-on-surface">BOM Management</h2>
        <button 
          onClick={() => { setSelectedBom(null); setEditModalOpen(true); }}
          className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-on-primary shadow-sm hover:bg-primary/90 transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>
          Create New BOM
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-surface-variant/20 rounded-xl border border-outline-variant/30 p-4">
        {loading ? (
          <div className="text-sm font-medium text-outline flex items-center gap-2">
            <span className="material-symbols-outlined animate-spin" style={{ fontSize: 18 }}>progress_activity</span>
            Loading BOMs...
          </div>
        ) : boms.length === 0 ? (
          <div className="text-sm text-outline">No BOMs found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {boms.map((bom, idx) => (
              <div 
                key={bom._id?.$oid || idx} 
                onClick={() => { setSelectedBom(bom); setEditModalOpen(true); }}
                className="bg-surface border border-outline-variant/30 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer relative group"
              >
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="material-symbols-outlined text-outline hover:text-primary">edit</span>
                </div>
                <div className="text-xs font-bold text-outline uppercase tracking-wider mb-1">品番 (Target Material)</div>
                <div className="font-bold text-on-surface text-lg mb-4">{bom['品番']}</div>
                
                <div className="text-xs font-bold text-outline uppercase tracking-wider mb-2">Processes</div>
                <div className="space-y-2">
                  {bom.BOM?.map((step, sIdx) => (
                    <div key={sIdx} className="bg-surface-variant/30 rounded border border-outline-variant/30 p-2 text-xs flex justify-between">
                      <span className="font-medium text-on-surface">{step['工程名'] || 'Unknown'}</span>
                      <span className="text-outline truncate ml-2 max-w-[150px]">{step['構成品番'] || 'No material'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editModalOpen && (
        <BomEditModal 
          existingBom={selectedBom}
          onClose={() => setEditModalOpen(false)}
          onSaved={() => {
            setEditModalOpen(false);
            fetchBoms();
          }}
          onFlash={onFlash}
        />
      )}
    </div>
  );
}
