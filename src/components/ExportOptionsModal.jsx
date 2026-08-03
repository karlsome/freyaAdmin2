import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fetchExportTemplates, saveExportTemplate } from "../services/api";

function flattenObject(obj, prefix = '') {
  const flattened = {};
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    
    // Ignore internal or unhelpful keys
    if (key === '_id' || key === 'editHistory') continue;

    if (obj[key] === null || obj[key] === undefined) {
      flattened[prefix + key] = '';
    } else if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      const nested = flattenObject(obj[key], prefix + key + '.');
      Object.assign(flattened, nested);
    } else if (Array.isArray(obj[key])) {
      if (obj[key].length > 0 && typeof obj[key][0] === 'object') {
        obj[key].forEach((item, index) => {
          const nested = flattenObject(item, prefix + key + `[${index}].`);
          Object.assign(flattened, nested);
        });
      } else {
        flattened[prefix + key] = obj[key].join(', ');
      }
    } else {
      flattened[prefix + key] = obj[key];
    }
  }
  return flattened;
}

export default function ExportOptionsModal({ data, onClose, processName = "Export" }) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [headersState, setHeadersState] = useState({});

  // Flatten data to find all unique headers
  const allUniqueHeaders = useMemo(() => {
    const headerSet = new Set();
    data.forEach(item => {
      const flat = flattenObject(item);
      Object.keys(flat).forEach(k => headerSet.add(k));
    });
    return Array.from(headerSet).sort();
  }, [data]);

  // Load templates on mount
  useEffect(() => {
    async function load() {
      try {
        const response = await fetchExportTemplates(processName);
        if (Array.isArray(response)) {
          // Map DB schema to UI schema
          const mapped = response.map(t => ({
            id: t._id?.$oid ?? String(t._id),
            name: t.templateName,
            columns: t.selectedHeaders || []
          }));
          setTemplates(mapped);
        }
      } catch (e) {
        console.error("Failed to load templates from DB", e);
      }
    }
    load();
  }, [processName]);

  // Initialize header states
  useEffect(() => {
    if (selectedTemplateId) return; // Prevent overwriting if a template is active
    
    const initial = {};
    allUniqueHeaders.forEach((h, i) => {
      // Select all fields by default if no template is active
      initial[h] = {
        checked: true,
        order: String(i + 1)
      };
    });
    setHeadersState(initial);
  }, [allUniqueHeaders, selectedTemplateId]);

  const handleCheck = (header) => {
    setHeadersState(prev => {
      const isChecked = prev[header]?.checked;
      if (isChecked) {
        return { ...prev, [header]: { checked: false, order: "" } };
      } else {
        let maxOrder = 0;
        Object.values(prev).forEach(v => {
          if (v.checked && v.order && !isNaN(parseInt(v.order))) {
            maxOrder = Math.max(maxOrder, parseInt(v.order));
          }
        });
        return { ...prev, [header]: { checked: true, order: String(maxOrder + 1) } };
      }
    });
  };

  const handleOrderChange = (header, val) => {
    setHeadersState(prev => ({
      ...prev,
      [header]: { ...prev[header], order: val }
    }));
  };

  const selectAll = () => {
    const next = { ...headersState };
    let order = 1;
    allUniqueHeaders.filter(h => h.toLowerCase().includes(searchQuery.toLowerCase())).forEach(h => {
      next[h] = { checked: true, order: String(order++) };
    });
    setHeadersState(next);
  };

  const deselectAll = () => {
    const next = { ...headersState };
    allUniqueHeaders.filter(h => h.toLowerCase().includes(searchQuery.toLowerCase())).forEach(h => {
      next[h] = { checked: false, order: "" };
    });
    setHeadersState(next);
  };

  const clearOrder = () => {
    const next = { ...headersState };
    Object.keys(next).forEach(h => {
      next[h] = { ...next[h], order: "" };
    });
    setHeadersState(next);
  };

  const handleTemplateChange = (e) => {
    const tid = e.target.value;
    setSelectedTemplateId(tid);
    if (!tid) return;

    const t = templates.find(x => x.id === tid);
    if (t) {
      const next = {};
      allUniqueHeaders.forEach(h => {
        const found = t.columns.find(c => c.name === h);
        if (found) {
          next[h] = { checked: true, order: String(found.order) };
        } else {
          next[h] = { checked: false, order: "" };
        }
      });
      setHeadersState(next);
    }
  };

  const handleSaveTemplate = async () => {
    const name = window.prompt("Enter template name:");
    if (!name) return;

    const columnsToSave = getOrderedColumns();
    const headers = columnsToSave.map((c, i) => ({ name: c, order: i + 1 }));
    
    const dbPayload = {
      templateName: name,
      processType: processName,
      selectedHeaders: headers,
      createdBy: "freyaAdmin2",
    };

    try {
      await saveExportTemplate(dbPayload);
      
      // Reload templates to get the real ID from DB
      const response = await fetchExportTemplates(processName);
      if (Array.isArray(response)) {
        const mapped = response.map(t => ({
          id: t._id?.$oid ?? String(t._id),
          name: t.templateName,
          columns: t.selectedHeaders || []
        }));
        setTemplates(mapped);
        
        // Auto-select the newly created template (matching by name and newest)
        const newest = mapped.filter(t => t.name === name).pop();
        if (newest) setSelectedTemplateId(newest.id);
      }
    } catch (error) {
      console.error("Failed to save template", error);
      alert("Failed to save template to database.");
    }
  };

  const getOrderedColumns = () => {
    const selected = Object.entries(headersState)
      .filter(([_, v]) => v.checked)
      .map(([k, v]) => ({ name: k, order: parseInt(v.order) || 9999 }));
    
    selected.sort((a, b) => a.order - b.order);
    return selected.map(s => s.name);
  };

  const executeExportCSV = () => {
    const cols = getOrderedColumns();
    if (cols.length === 0) return alert("Please select at least one column.");

    const flatData = data.map(row => flattenObject(row));
    const csvData = flatData.map(row => {
      const newRow = {};
      cols.forEach(c => {
        newRow[c] = row[c] ?? "";
      });
      return newRow;
    });

    const csv = Papa.unparse(csvData, { columns: cols });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${processName}_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  const executeExportPDF = () => {
    const cols = getOrderedColumns();
    if (cols.length === 0) return alert("Please select at least one column.");

    const flatData = data.map(row => flattenObject(row));
    const tableBody = flatData.map(row => cols.map(c => String(row[c] ?? "")));

    // Initialize jsPDF in landscape
    const doc = new jsPDF({ orientation: "landscape" });
    
    // Auto-table with auto-scaling to fit the page
    autoTable(doc, {
      head: [cols],
      body: tableBody,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 133, 244] },
      margin: { top: 15 },
      horizontalPageBreak: true, 
      didDrawPage: function (data) {
        doc.text(`${processName} Report`, data.settings.margin.left, 10);
      }
    });

    doc.save(`${processName}_export_${new Date().toISOString().split('T')[0]}.pdf`);
    onClose();
  };

  const filteredHeaders = allUniqueHeaders.filter(h => h.toLowerCase().includes(searchQuery.toLowerCase()));
  const selectedCount = Object.values(headersState).filter(v => v.checked).length;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-separator/40 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-separator/40 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-on-surface">Export Options</h3>
            <p className="text-sm text-on-surface-variant mt-0.5">Select columns to export and set their order</p>
          </div>
          <button onClick={onClose} className="p-2 text-outline hover:text-on-surface hover:bg-surface-container rounded-full transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          
          {/* Templates Section */}
          <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-xl">
            <div className="flex flex-wrap items-center gap-4">
              <label className="text-sm font-semibold text-primary flex-shrink-0">Templates</label>
              <select
                value={selectedTemplateId}
                onChange={handleTemplateChange}
                className="flex-1 min-w-[200px] h-9 px-3 text-sm bg-white border border-primary/20 rounded-lg outline-none focus:border-primary transition-colors"
              >
                <option value="">-- Select Template --</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <button
                onClick={handleSaveTemplate}
                className="flex items-center gap-1.5 px-4 h-9 bg-primary text-on-primary text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>
                Save Template
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="mb-4 relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" style={{ fontSize: 18 }}>search</span>
            <input
              type="text"
              placeholder="Search headers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-xl border border-separator/40 bg-surface-container text-sm text-on-surface outline-none focus:border-primary/40 transition-colors"
            />
          </div>

          {/* Controls */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={selectAll} className="text-sm font-semibold text-primary hover:underline">Select All</button>
              <span className="text-separator/60">|</span>
              <button onClick={deselectAll} className="text-sm font-semibold text-primary hover:underline">Deselect All</button>
              <span className="text-separator/60">|</span>
              <button onClick={clearOrder} className="text-sm font-semibold text-primary hover:underline">Clear Order</button>
            </div>
            <span className="text-xs text-on-surface-variant font-medium">
              {selectedCount} / {allUniqueHeaders.length} selected
            </span>
          </div>
          <p className="text-xs text-outline mb-3">Enter order numbers. Only checked items will be exported.</p>

          {/* Headers List */}
          <div className="border border-separator/40 rounded-xl overflow-hidden bg-surface-container/50">
            {filteredHeaders.map(header => {
              const state = headersState[header] || { checked: false, order: "" };
              return (
                <div key={header} className="flex items-center justify-between p-3 border-b border-separator/20 last:border-0 hover:bg-surface-container transition-colors">
                  <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0 mr-4">
                    <input
                      type="checkbox"
                      checked={state.checked}
                      onChange={() => handleCheck(header)}
                      className="w-4 h-4 rounded border-outline text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-on-surface font-medium truncate" title={header}>{header}</span>
                  </label>
                  <input
                    type="text"
                    value={state.order}
                    onChange={(e) => handleOrderChange(header, e.target.value)}
                    placeholder="-"
                    className="w-14 h-8 text-center text-sm border border-separator/40 rounded-lg outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
                    disabled={!state.checked}
                  />
                </div>
              );
            })}
            {filteredHeaders.length === 0 && (
              <div className="p-6 text-center text-sm text-outline">No headers match your search.</div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-separator/40 flex justify-end gap-3 bg-surface-container/30">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-separator/60 text-on-surface text-sm font-semibold hover:bg-surface-container transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={executeExportCSV}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 text-sm font-semibold hover:bg-primary/15 transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>csv</span>
            Export CSV
          </button>
          <button
            onClick={executeExportPDF}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>picture_as_pdf</span>
            Export PDF
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
