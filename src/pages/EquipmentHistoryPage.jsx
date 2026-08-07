import { useEffect, useMemo, useRef, useState, startTransition } from "react";
import { createPortal } from "react-dom";
import {
  createSetsubiHistoryRecord,
  updateSetsubiHistoryRecord,
  fetchFactoryDBRecords,
  fetchSetsubiDBRecords,
  fetchSetsubiHistoryRecords,
  fetchWorkerNames,
  uploadEquipmentEventImage,
  deleteEquipmentEventImage,
} from "../services/api";
import { getAuthUser } from "../utils/masterDB";
import PageHeader from "../components/PageHeader";
import SensorDevicePhotoPreviewModal from "../components/SensorDevicePhotoPreviewModal";

const inputCls =
  "w-full rounded-xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition-all duration-150 focus:border-primary/40 disabled:opacity-50 font-body";

function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/") || file.type === "image/gif") {
      resolve({ file });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1280;
        const MAX_HEIGHT = 1280;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve({ base64: canvas.toDataURL("image/jpeg", 0.7) });
      };
      img.onerror = () => reject(new Error("Failed to load image for compression"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function isVideoUrl(url) {
  return /\.(mp4|mov)$/i.test(url.split("?")[0]);
}

function isImageUrl(url) {
  return /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(url.split("?")[0]);
}

function isPdfUrl(url) {
  return /\.pdf$/i.test(url.split("?")[0]);
}

// ── Searchable Select ──────────────────────────────────────────────────────────

function SearchableSelect({ value, options, onChange, placeholder, className, disabled, isMulti }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);
  const [dropdownStyles, setDropdownStyles] = useState({});

  const updatePosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownStyles({
        position: 'fixed',
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 99999
      });
    }
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        // We also need to check if they clicked inside the portal dropdown.
        // It's easier to just attach an ID or class to the portal and check that,
        // but since we only have one open at a time usually, we can just check if event.target is inside a .searchable-select-dropdown
        if (!event.target.closest('.searchable-select-dropdown')) {
          setIsOpen(false);
        }
      }
    }
    
    function handleScroll() {
      if (isOpen) updatePosition();
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true); // true for capturing phase to catch inner scrolls
    window.addEventListener("resize", handleScroll);
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleScroll);
    };
  }, [isOpen]);

  const normalizedOptions = useMemo(() => {
    return options.map(opt => {
      if (typeof opt === 'string') return { label: opt, value: opt };
      return opt;
    });
  }, [options]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalizedOptions;
    return normalizedOptions.filter((o) => o.label.toLowerCase().includes(q));
  }, [normalizedOptions, query]);

  const toggleOption = (option, e) => {
    e.preventDefault();
    if (isMulti) {
      const currentValues = Array.isArray(value) ? value : [];
      if (option.value === "") {
        onChange([]);
        setIsOpen(false);
      } else {
        if (currentValues.includes(option.value)) {
          onChange(currentValues.filter(v => v !== option.value));
        } else {
          onChange([...currentValues, option.value]);
        }
      }
    } else {
      onChange(option.value);
      setIsOpen(false);
      setQuery("");
    }
  };

  const displayText = useMemo(() => {
    if (isMulti) {
      const currentValues = Array.isArray(value) ? value : [];
      if (currentValues.length === 0) return placeholder;
      const labels = currentValues.map(v => {
        const found = normalizedOptions.find(o => o.value === v);
        return found ? found.label : v;
      });
      return labels.join(", ");
    }
    const selectedOption = normalizedOptions.find(o => o.value === value);
    return selectedOption ? selectedOption.label : placeholder;
  }, [value, isMulti, normalizedOptions, placeholder]);

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          updatePosition();
          setIsOpen(!isOpen);
        }}
        className={`${className} flex items-center justify-between text-left px-3 ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${isMulti && Array.isArray(value) && value.length > 0 ? 'py-1.5' : ''}`}
      >
        <div className="flex-1 flex flex-wrap gap-1.5 items-center overflow-hidden pr-2">
          {isMulti && Array.isArray(value) && value.length > 0 ? (
            value.map((v) => {
              const opt = normalizedOptions.find((o) => o.value === v);
              const label = opt ? opt.label : v;
              return (
                <span key={v} className="inline-flex items-center gap-1 bg-surface-container-high border border-outline-variant/30 px-2 py-1 rounded-md text-[11px] font-medium text-on-surface">
                  <span className="truncate max-w-[120px]">{label}</span>
                  <div 
                    role="button"
                    tabIndex={0}
                    className="hover:text-error hover:bg-error/10 rounded-full p-0.5 -mr-1 transition-colors flex items-center justify-center cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(value.filter((item) => item !== v));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        onChange(value.filter((item) => item !== v));
                      }
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
                  </div>
                </span>
              );
            })
          ) : (
            <span className="truncate">{displayText}</span>
          )}
        </div>
        <span className="material-symbols-outlined shrink-0 opacity-50" style={{ fontSize: 18 }}>expand_more</span>
      </button>

      {isOpen && !disabled && createPortal(
        <div 
          className="searchable-select-dropdown max-h-72 overflow-y-auto rounded-xl border border-separator/40 bg-white shadow-xl dark:bg-surface-container py-1 flex flex-col font-body"
          style={dropdownStyles}
        >
          <div className="px-2 pb-1 sticky top-0 bg-white dark:bg-surface-container z-10 pt-1">
            <input
              type="text"
              autoFocus
              className="w-full h-8 px-3 rounded-lg border border-separator/40 bg-surface-container-low text-xs outline-none focus:border-primary/40 font-body"
              placeholder="Search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          {/* Option to clear selection */}
          <button
            type="button"
            onClick={(e) => toggleOption({ value: "", label: placeholder }, e)}
            className={`flex w-full items-center px-4 py-2 text-sm text-left transition-colors ${!value ? "bg-primary/10 text-primary font-medium" : "text-on-surface hover:bg-surface-container-highest"}`}
          >
            <span className="truncate italic opacity-70">{placeholder}</span>
          </button>
          {filteredOptions.length === 0 ? (
            <div className="px-4 py-2 text-xs text-on-surface-variant text-center">No results found</div>
          ) : (
            filteredOptions.map((option) => {
              const isSelected = isMulti 
                ? (Array.isArray(value) && value.includes(option.value))
                : (value === option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={(e) => toggleOption(option, e)}
                  className={`flex w-full items-center px-4 py-2 text-sm text-left transition-colors
                    ${isSelected ? "bg-primary/10 text-primary font-medium" : "text-on-surface hover:bg-surface-container-highest"}`}
                >
                  <span className="truncate flex-1">{option.label}</span>
                  {isSelected && isMulti && (
                    <span className="material-symbols-outlined text-primary ml-2" style={{ fontSize: 16 }}>check</span>
                  )}
                </button>
              );
            })
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Event Modal (Add / Edit) ──────────────────────────────────────────────────

function EventModal({ event, history, factories, allEquipment, workerNames, username, submitting, onClose, onSubmit }) {
  const isEdit = Boolean(event);
  const draftKey = "equipment_event_draft";

  const initialDraft = useMemo(() => {
    if (!isEdit) {
      try {
        const stored = localStorage.getItem(draftKey);
        if (stored) return JSON.parse(stored);
      } catch (e) {}
    }
    return null;
  }, [isEdit]);

  const [factory, setFactory] = useState(initialDraft?.factory || event?.["工場"] || "");
  const [equipmentId, setEquipmentId] = useState(initialDraft?.equipmentId || event?.equipmentId || "");
  const [reportedBy, setReportedBy] = useState(initialDraft?.reportedBy || event?.["名前"] || username || "");
  const [date, setDate] = useState(initialDraft?.date || event?.date || new Date().toISOString().split("T")[0]);
  
  const [title, setTitle] = useState(initialDraft?.title || event?.title || "");
  const [status, setStatus] = useState(initialDraft?.status || event?.status || "Open");
  const [details, setDetails] = useState(initialDraft?.details || event?.details || "");
  const [imageURLs, setImageURLs] = useState(initialDraft?.imageURLs || event?.imageURLs || []);
  const [resolutionTime, setResolutionTime] = useState(initialDraft?.resolutionTime || event?.resolutionTime || "");

  const [attempts, setAttempts] = useState(initialDraft?.attempts || event?.attempts || []);

  useEffect(() => {
    if (!isEdit && !submitting) {
      const draft = { factory, equipmentId, reportedBy, date, title, status, details, imageURLs, resolutionTime, attempts };
      localStorage.setItem(draftKey, JSON.stringify(draft));
    }
  }, [factory, equipmentId, reportedBy, date, title, status, details, imageURLs, resolutionTime, attempts, isEdit, submitting]);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);
  const attemptFileInputRef = useRef(null);
  const [activeAttemptIndexForUpload, setActiveAttemptIndexForUpload] = useState(null);

  const [previewState, setPreviewState] = useState(null);
  const [expandedAttemptIndex, setExpandedAttemptIndex] = useState(0);

  const factoryEquipment = useMemo(
    () => allEquipment.filter((eq) => eq["工場"] === factory),
    [allEquipment, factory]
  );

  const selectedEquipment = factoryEquipment.find(
    (eq) => (eq._id?.$oid ?? String(eq._id)) === equipmentId
  );

  // Insights calculation based on selected equipment
  const insights = useMemo(() => {
    if (!equipmentId) return null;
    const eqHistory = history.filter(h => h.equipmentId === equipmentId);
    if (eqHistory.length === 0) return null;

    const totalOccurrences = eqHistory.length;
    const resolved = eqHistory.filter(h => h.status === "Resolved");
    
    // Average resolution time
    let totalTime = 0;
    let countWithTime = 0;
    resolved.forEach(r => {
      if (r.resolutionTime) {
        totalTime += Number(r.resolutionTime);
        countWithTime++;
      }
    });
    const avgTime = countWithTime > 0 ? Math.round(totalTime / countWithTime) : 0;

    // Successful vs Failed fixes from attempts
    let successFixes = 0;
    let failedFixes = 0;
    eqHistory.forEach(h => {
      (h.attempts || []).forEach(a => {
        if (a.status === "Success") successFixes++;
        if (a.status === "Failed") failedFixes++;
      });
    });

    // Last fixed by
    let lastFixedBy = "—";
    let lastFixedDate = "—";
    const sortedResolved = [...resolved].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    if (sortedResolved.length > 0) {
      const last = sortedResolved[0];
      const lastSuccessfulAttempt = (last.attempts || []).slice().reverse().find(a => a.status === "Success");
      lastFixedBy = lastSuccessfulAttempt?.fixedBy || last["名前"] || "Unknown";
      lastFixedDate = last.date;
    }

    return { totalOccurrences, avgTime, successFixes, failedFixes, lastFixedBy, lastFixedDate };
  }, [equipmentId, history]);

  function handleFactoryChange(e) {
    setFactory(e.target.value);
    setEquipmentId("");
  }

  async function handleFileChange(e, attemptIndex = null) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = "";
    setUploading(true);
    setUploadError("");
    const results = await Promise.allSettled(
      files.map(async (fileObj) => {
        const { base64, file: rawFile } = await compressImage(fileObj);
        if (base64) {
          console.log(`Starting upload for ${fileObj.name}, compressed size: ${Math.round(base64.length / 1024)}KB`);
        } else {
          console.log(`Starting upload for ${fileObj.name}, raw file size: ${Math.round(rawFile.size / 1024)}KB`);
        }
        
        const result = await uploadEquipmentEventImage({
          file: rawFile,
          base64,
          factoryName: factory,
          equipmentName: selectedEquipment?.name || "",
          username,
        });
        return result.imageURL;
      })
    );
    const urls = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
    const failedCount = results.filter((r) => r.status === "rejected").length;
    
    if (urls.length) {
      if (attemptIndex !== null) {
        setAttempts(prev => {
          const newAtt = [...prev];
          newAtt[attemptIndex] = {
            ...newAtt[attemptIndex],
            imageURLs: [...(newAtt[attemptIndex].imageURLs || []), ...urls]
          };
          return newAtt;
        });
      } else {
        setImageURLs((prev) => [...prev, ...urls]);
      }
    }

    if (failedCount) {
      const raw = results.find((r) => r.status === "rejected")?.reason?.message || "";
      setUploadError(
        raw.startsWith("<") ? "Upload failed — server error." : raw || `${failedCount} file(s) failed.`
      );
    }
    setUploading(false);
    setActiveAttemptIndexForUpload(null);
  }

  function removeImage(url, attemptIndex = null) {
    // Delete from Firebase asynchronously
    deleteEquipmentEventImage(url).catch((err) => console.error("Failed to delete image:", err));

    if (attemptIndex !== null) {
      setAttempts(prev => {
        const newAtt = [...prev];
        newAtt[attemptIndex] = {
          ...newAtt[attemptIndex],
          imageURLs: (newAtt[attemptIndex].imageURLs || []).filter((u) => u !== url)
        };
        return newAtt;
      });
    } else {
      setImageURLs((prev) => prev.filter((u) => u !== url));
    }
  }

  function addAttempt() {
    setAttempts(prev => {
      setExpandedAttemptIndex(prev.length);
      return [
        ...prev,
        {
          attemptNumber: prev.length + 1,
          title: "",
          fixDescription: "",
          result: "",
          fixedBy: [],
          status: "Success",
          date: new Date().toISOString().split("T")[0],
          timeToResolve: "",
          imageURLs: []
        }
      ];
    });
  }

  function updateAttempt(index, field, value) {
    setAttempts(prev => {
      const newAtt = [...prev];
      newAtt[index] = { ...newAtt[index], [field]: value };
      return newAtt;
    });
  }

  function removeAttempt(index) {
    setAttempts(prev => prev.filter((_, i) => i !== index).map((att, i) => ({ ...att, attemptNumber: i + 1 })));
  }

  async function discardDraft() {
    // Delete all files in the draft from Firebase Storage asynchronously
    imageURLs.forEach(url => {
      deleteEquipmentEventImage(url).catch(() => {});
    });
    attempts.forEach(att => {
      (att.imageURLs || []).forEach(url => {
        deleteEquipmentEventImage(url).catch(() => {});
      });
    });

    localStorage.removeItem(draftKey);
    setFactory("");
    setEquipmentId("");
    setReportedBy(username || "");
    setDate(new Date().toISOString().split("T")[0]);
    setTitle("");
    setStatus("Open");
    setDetails("");
    setImageURLs([]);
    setResolutionTime("");
    setAttempts([]);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!factory || !equipmentId || !date) return;
    
    const payload = {
      工場: factory,
      equipmentId,
      equipmentName: selectedEquipment?.name || event?.equipmentName || "",
      名前: reportedBy,
      date,
      title,
      status,
      details,
      imageURLs,
      attempts,
      resolutionTime: Number(resolutionTime) || null,
    };

    onSubmit(payload);
  }

  const canSubmit = Boolean(factory && equipmentId && date) && !submitting && !uploading;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div
        className="dashboard-section rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl font-body"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-20 px-6 py-4 flex items-center justify-between border-b border-separator/40 bg-surface/90 backdrop-blur-md">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">
              {isEdit ? "Edit Record" : "Add Record"}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-on-surface">
              {isEdit ? (event.title || "Equipment Event") : "Report Equipment Event"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-surface-container text-outline hover:text-on-surface transition-all duration-150"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-surface-container-low/30 relative flex flex-col lg:flex-row">
          
          <form
            id="event-form"
            onSubmit={handleSubmit}
            className="flex-1 px-6 py-6 space-y-6"
          >
            {/* Top row: Factory, Machine, Date, Reported By */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-30">
              <div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">工場 *</div>
                <SearchableSelect
                  value={factory}
                  onChange={(val) => {
                    setFactory(val);
                    setEquipmentId("");
                  }}
                  options={factories}
                  placeholder="— Select factory —"
                  className={inputCls}
                />
              </div>
              <div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">設備 *</div>
                <SearchableSelect
                  value={equipmentId}
                  onChange={(val) => setEquipmentId(val)}
                  options={factoryEquipment.map(eq => ({ label: eq.name, value: eq._id?.$oid ?? String(eq._id) }))}
                  placeholder={!factory ? "— Select factory first —" : "— Select machine —"}
                  className={inputCls}
                  disabled={!factory}
                />
              </div>
              <div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Reported By</div>
                <SearchableSelect
                  value={reportedBy}
                  onChange={(val) => setReportedBy(val)}
                  options={workerNames}
                  placeholder="— Select name —"
                  className={inputCls}
                />
              </div>
              <div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Date *</div>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} required />
              </div>
            </div>

            <hr className="border-separator/20" />

            {/* Core Issue */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Issue Title</div>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Conveyor Belt Jam at Station 2"
                    className={`${inputCls} font-medium text-base`}
                  />
                </div>
                <div>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Symptom Details</div>
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    rows={3}
                    placeholder="Describe exactly what happened or what was observed..."
                    className={`${inputCls} resize-none`}
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Overall Status</div>
                  <select 
                    value={status} 
                    onChange={(e) => setStatus(e.target.value)} 
                    className={`${inputCls} font-semibold ${
                      status === "Resolved" ? "text-primary border-primary/40 bg-primary/5" :
                      status === "Failed" ? "text-error border-error/40 bg-error/5" : ""
                    }`}
                  >
                    <option value="Open">🔴 Open / Unresolved</option>
                    <option value="Resolved">✅ Resolved</option>
                    <option value="Failed">❌ Failed to Fix</option>
                  </select>
                </div>
                <div>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Total Time (hours)</div>
                  <input
                    type="number"
                    step="0.01"
                    value={resolutionTime}
                    onChange={(e) => setResolutionTime(e.target.value)}
                    placeholder="e.g. 1.5"
                    className={inputCls}
                    min="0"
                  />
                </div>
              </div>
            </div>

            {/* General Files */}
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Symptom Files</div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFileChange(e, null)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container active:scale-95 transition-all duration-150 disabled:opacity-50"
              >
                {uploading && activeAttemptIndexForUpload === null ? (
                  <><span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span> Uploading...</>
                ) : (
                  <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>attach_file</span> Attach Files</>
                )}
              </button>
              {imageURLs.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {imageURLs.map((url) => (
                    <div key={url} className="group relative">
                      <button 
                        type="button" 
                        onClick={() => {
                          if (isVideoUrl(url) || isImageUrl(url) || isPdfUrl(url)) {
                            setPreviewState({
                              images: imageURLs.map((u) => ({ url: u, label: "Event File" })),
                              activeIndex: imageURLs.indexOf(url),
                              displayName: "Report Attachments",
                              eyebrow: title || "Event",
                            });
                          } else {
                            window.open(url, "_blank");
                          }
                        }}
                        className="h-16 w-16 rounded-xl border border-separator/40 overflow-hidden flex items-center justify-center bg-surface-container hover:bg-surface-container-high transition-colors"
                      >
                        {isVideoUrl(url) ? (
                          <video src={url} className="h-full w-full object-cover bg-black" muted />
                        ) : isImageUrl(url) ? (
                          <img src={url} alt="attached" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                        ) : (
                          <span className="material-symbols-outlined text-outline" style={{ fontSize: 24 }}>insert_drive_file</span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeImage(url, null)}
                        className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-error text-white group-hover:flex"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 11 }}>close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <hr className="border-separator/20" />

            {/* Fix Attempts */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>build</span>
                  Fix Attempts
                </div>
              </div>

              {attempts.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-outline-variant/40 rounded-2xl">
                  <p className="text-sm text-on-surface-variant">No fix attempts recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {attempts.map((attempt, index) => {
                    const isExpanded = expandedAttemptIndex === index;
                    return (
                      <div key={index} className="p-4 bg-surface rounded-2xl border border-outline-variant/20 shadow-sm relative group transition-all" style={{ zIndex: 50 - index }}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeAttempt(index); }}
                          className="absolute top-3 right-3 text-outline hover:text-error opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                        </button>
                        
                        <div 
                          className={`flex items-center gap-2 cursor-pointer ${isExpanded ? 'mb-3' : ''}`}
                          onClick={() => startTransition(() => setExpandedAttemptIndex(isExpanded ? null : index))}
                        >
                          <span className="bg-surface-container-high text-on-surface text-[10px] font-bold px-2 py-0.5 rounded-md">
                            #{attempt.attemptNumber}
                          </span>
                          {!isExpanded && (
                            <span className="text-sm font-semibold text-on-surface flex-1 truncate">
                              {attempt.title || `Attempt ${attempt.attemptNumber}`}
                            </span>
                          )}
                          
                          {/* Render Thumbnails always so they don't remount on expand */}
                          {!isExpanded && (attempt.imageURLs?.length > 0) && (
                            <div className="flex gap-1 ml-2 mr-2">
                              {attempt.imageURLs.slice(0, 3).map((url, i) => (
                                <div key={i} className="h-6 w-6 rounded border border-separator/40 overflow-hidden flex items-center justify-center bg-surface-container shrink-0">
                                  {isVideoUrl(url) ? (
                                    <span className="material-symbols-outlined text-[12px] text-outline">movie</span>
                                  ) : isPdfUrl(url) ? (
                                    <span className="material-symbols-outlined text-[12px] text-outline">description</span>
                                  ) : (
                                    <img src={url} alt="attached" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                                  )}
                                </div>
                              ))}
                              {attempt.imageURLs.length > 3 && (
                                <div className="h-6 w-6 rounded border border-separator/40 bg-surface-container-high flex items-center justify-center text-[9px] font-bold text-on-surface">
                                  +{attempt.imageURLs.length - 3}
                                </div>
                              )}
                            </div>
                          )}

                          {!isExpanded && (
                            <span className="material-symbols-outlined text-outline" style={{ fontSize: 18 }}>expand_more</span>
                          )}
                          {isExpanded && (
                            <span className="text-sm font-semibold text-primary ml-auto mr-8">
                              Editing
                            </span>
                          )}
                        </div>

                        {isExpanded && (
                          <>
                            <div className="flex flex-col gap-3 mb-4">
                              <input
                                type="text"
                                value={attempt.title || ""}
                                onChange={(e) => updateAttempt(index, "title", e.target.value)}
                                placeholder="Attempt Title (e.g. Belt Realignment)"
                                className={`${inputCls} font-medium`}
                              />
                              <textarea
                                value={attempt.fixDescription || ""}
                                onChange={(e) => updateAttempt(index, "fixDescription", e.target.value)}
                                placeholder="What did you do?"
                                className={`${inputCls} resize-none`}
                                rows={2}
                              />
                              <textarea
                                value={attempt.result || ""}
                                onChange={(e) => updateAttempt(index, "result", e.target.value)}
                                placeholder="What was the result?"
                                className={`${inputCls} resize-none`}
                                rows={2}
                              />
                            </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                        <div>
                          <select 
                            value={attempt.status} 
                            onChange={(e) => updateAttempt(index, "status", e.target.value)}
                            className={inputCls}
                          >
                            <option value="Success">✅ Success</option>
                            <option value="Failed">❌ Failed</option>
                          </select>
                        </div>
                        <div>
                          <SearchableSelect
                            value={Array.isArray(attempt.fixedBy) ? attempt.fixedBy : (attempt.fixedBy ? [attempt.fixedBy] : [])}
                            onChange={(val) => updateAttempt(index, "fixedBy", val)}
                            options={workerNames}
                            placeholder="— Worker(s) —"
                            className={inputCls}
                            isMulti
                          />
                        </div>
                        <div>
                          <input
                            type="date"
                            value={attempt.date || ""}
                            onChange={(e) => updateAttempt(index, "date", e.target.value)}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <input
                            type="number"
                            step="0.01"
                            value={attempt.timeToResolve}
                            onChange={(e) => updateAttempt(index, "timeToResolve", e.target.value)}
                            placeholder="hours"
                            className={inputCls}
                            min="0"
                          />
                        </div>
                      </div>

                      {/* Attempt Files */}
                      <div className="mt-2 flex items-center gap-3">
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            setActiveAttemptIndexForUpload(index);
                            handleFileChange(e, index);
                          }}
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.currentTarget.previousElementSibling?.click();
                          }}
                          disabled={uploading}
                          className="text-xs font-semibold text-outline hover:text-on-surface flex items-center gap-1 transition-colors disabled:opacity-50"
                        >
                          {uploading && activeAttemptIndexForUpload === index ? (
                            <><span className="material-symbols-outlined animate-spin" style={{ fontSize: 14 }}>progress_activity</span> Uploading...</>
                          ) : (
                            <><span className="material-symbols-outlined" style={{ fontSize: 14 }}>attach_file</span> File(s)</>
                          )}
                        </button>
                        <div className="flex gap-2">
                          {(attempt.imageURLs || []).map((url) => (
                            <div key={url} className="relative group/img">
                              <button 
                                type="button" 
                                onClick={() => {
                                  if (isVideoUrl(url) || isImageUrl(url) || isPdfUrl(url)) {
                                    setPreviewState({
                                      images: attempt.imageURLs.map((u) => ({ url: u, label: "Attempt File" })),
                                      activeIndex: attempt.imageURLs.indexOf(url),
                                      displayName: attempt.title || `Attempt ${index + 1}`,
                                      eyebrow: "Fix Attempt",
                                    });
                                  } else {
                                    window.open(url, "_blank");
                                  }
                                }}
                                className="h-8 w-8 rounded-lg border border-separator/40 overflow-hidden flex items-center justify-center bg-surface-container hover:bg-surface-container-high transition-colors"
                              >
                                {isVideoUrl(url) ? (
                                  <video src={url} className="h-full w-full object-cover bg-black" muted />
                                ) : isImageUrl(url) ? (
                                  <img src={url} alt="attached" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                                ) : (
                                  <span className="material-symbols-outlined text-outline" style={{ fontSize: 16 }}>insert_drive_file</span>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => removeImage(url, index)}
                                className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-error text-white group-hover/img:flex"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 10 }}>close</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={addAttempt}
                  className="text-sm font-semibold text-primary hover:bg-primary/10 px-4 py-2 rounded-xl border border-primary/20 transition-all flex items-center gap-2"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> Add Attempt
                </button>
              </div>
            </div>
            
            {uploadError && <p className="text-xs text-error">{uploadError}</p>}
          </form>

          {/* Sidebar Insights */}
          <div className="w-full lg:w-72 bg-surface border-t lg:border-t-0 lg:border-l border-separator/30 p-6 flex flex-col shrink-0">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline mb-4">
              History & Insights
            </h3>
            
            {!equipmentId ? (
              <p className="text-sm text-on-surface-variant text-center mt-4 italic">Select a machine to view insights</p>
            ) : !insights ? (
              <p className="text-sm text-on-surface-variant text-center mt-4 italic">No previous history for this machine.</p>
            ) : (
              <div className="space-y-4">
                <div className="bg-surface-container-low rounded-xl p-4">
                  <p className="text-[10px] font-semibold uppercase text-outline mb-1">Total Occurrences</p>
                  <p className="text-lg font-bold text-on-surface flex items-center gap-2">
                    {insights.totalOccurrences > 3 ? "🔴" : "🔵"} {insights.totalOccurrences} times
                  </p>
                </div>
                
                <div className="bg-surface-container-low rounded-xl p-4">
                  <p className="text-[10px] font-semibold uppercase text-outline mb-1">Fix Success Rate</p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm font-medium text-primary flex items-center gap-1">
                      ✅ {insights.successFixes}
                    </span>
                    <span className="text-sm font-medium text-error flex items-center gap-1">
                      ❌ {insights.failedFixes}
                    </span>
                  </div>
                </div>

                <div className="bg-surface-container-low rounded-xl p-4">
                  <p className="text-[10px] font-semibold uppercase text-outline mb-1">Last Fixed By</p>
                  <p className="text-sm font-medium text-on-surface">👷 {insights.lastFixedBy}</p>
                  <p className="text-xs text-outline mt-1">{insights.lastFixedDate}</p>
                </div>

                <div className="bg-surface-container-low rounded-xl p-4">
                  <p className="text-[10px] font-semibold uppercase text-outline mb-1">Avg. Resolution Time</p>
                  <p className="text-sm font-medium text-on-surface flex items-center gap-2">
                    ⏱️ {insights.avgTime > 0 ? `${insights.avgTime} mins` : "Unknown"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-outline-variant/20 px-6 py-4 bg-surface flex items-center justify-between gap-3 z-20">
          {!isEdit ? (
            <button
              type="button"
              onClick={discardDraft}
              className="rounded-xl border border-error/20 text-error hover:bg-error/10 px-5 py-2.5 text-sm font-semibold active:scale-95 transition-all"
            >
              Discard Draft
            </button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-separator/40 px-5 py-2.5 text-sm font-semibold text-on-surface-variant hover:bg-surface-container hover:text-primary hover:border-primary/30 active:scale-95 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="event-form"
              disabled={!canSubmit}
              className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-on-primary hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Saving..." : isEdit ? "Save Changes" : "Submit Report"}
            </button>
          </div>
        </div>
      </div>
      <SensorDevicePhotoPreviewModal 
        preview={previewState} 
        onClose={() => setPreviewState(null)} 
        onNavigate={(dir) => {
          setPreviewState(prev => prev ? { ...prev, activeIndex: prev.activeIndex + dir } : null);
        }} 
      />
    </div>,
    document.body
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function EquipmentHistoryPage() {
  const authUser = getAuthUser();
  const username = authUser?.username || "unknown";

  const [factories, setFactories] = useState([]);
  const [allEquipment, setAllEquipment] = useState([]);
  const [workerNames, setWorkerNames] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");

  const [filterFactory, setFilterFactory] = useState("");
  const [filterEquipmentId, setFilterEquipmentId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortDir, setSortDir] = useState("desc");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Load factories, equipment, worker names
  useEffect(() => {
    let active = true;
    async function load() {
      setDataLoading(true);
      setDataError("");
      try {
        const [factoryRecords, equipmentRecords, names] = await Promise.all([
          fetchFactoryDBRecords(),
          fetchSetsubiDBRecords(),
          fetchWorkerNames(),
        ]);
        if (!active) return;
        setFactories(
          Array.isArray(factoryRecords)
            ? factoryRecords.map((f) => f["工場"]).filter(Boolean)
            : []
        );
        setAllEquipment(Array.isArray(equipmentRecords) ? equipmentRecords : []);
        setWorkerNames(Array.isArray(names) ? names : []);
      } catch (err) {
        if (active) setDataError(err?.message || "Failed to load data.");
      } finally {
        if (active) setDataLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  // Load history when filter changes
  useEffect(() => {
    if (!filterFactory) {
      setHistory([]);
      return;
    }
    let active = true;
    setHistoryLoading(true);
    setHistoryError("");
    fetchSetsubiHistoryRecords({
      factory: filterFactory,
      equipmentId: filterEquipmentId || undefined,
    })
      .then((rows) => { if (active) setHistory(Array.isArray(rows) ? rows : []); })
      .catch((err) => { if (active) setHistoryError(err?.message || "Failed to load history."); })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [filterFactory, filterEquipmentId, historyRefresh]);

  const factoryEquipment = useMemo(
    () => allEquipment.filter((eq) => eq["工場"] === filterFactory),
    [allEquipment, filterFactory]
  );

  const selectedEquipmentName = useMemo(() => {
    if (!filterEquipmentId) return "";
    const eq = allEquipment.find(
      (e) => (e._id?.$oid ?? String(e._id)) === filterEquipmentId
    );
    return eq?.name || "";
  }, [allEquipment, filterEquipmentId]);

  function handleFilterFactoryChange(val) {
    setFilterFactory(val);
    setFilterEquipmentId("");
  }

  function openCreate() {
    setEditingEvent(null);
    setModalOpen(true);
  }

  function openEdit(event) {
    setEditingEvent(event);
    setModalOpen(true);
  }

  async function handleModalSubmit(data) {
    setSubmitting(true);
    try {
      if (editingEvent) {
        await updateSetsubiHistoryRecord(editingEvent._id.$oid ?? editingEvent._id, { ...data, updatedBy: username });
      } else {
        await createSetsubiHistoryRecord({ ...data, submittedBy: username });
        localStorage.removeItem("equipment_event_draft");
      }
      setModalOpen(false);
      setEditingEvent(null);
      setHistoryRefresh((n) => n + 1);
    } catch (err) {
      alert(err?.message || "Failed to save record.");
    } finally {
      setSubmitting(false);
    }
  }

  const displayedHistory = useMemo(() => {
    let rows = history;
    if (dateFrom) rows = rows.filter((r) => (r.date || "") >= dateFrom);
    if (dateTo) rows = rows.filter((r) => (r.date || "") <= dateTo);
    if (filterStatus) rows = rows.filter((r) => r.status === filterStatus);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r => 
        (r.title && r.title.toLowerCase().includes(q)) || 
        (r.details && r.details.toLowerCase().includes(q))
      );
    }
    return [...rows].sort((a, b) => {
      const da = a.date || "";
      const db = b.date || "";
      return sortDir === "asc" ? da.localeCompare(db) : db.localeCompare(da);
    });
  }, [history, dateFrom, dateTo, sortDir, filterStatus, searchQuery]);

  const tableTitle = filterEquipmentId
    ? selectedEquipmentName
    : filterFactory
    ? filterFactory
    : "Equipment History";

  return (
    <section className="pt-24 pb-16 px-8 overflow-y-auto h-screen scrollbar-hide font-body">
      <PageHeader
        eyebrow="設備履歴"
        title="Equipment History"
        className="mb-6"
      />

      {/* Filter bar */}
      <div className="dashboard-section mb-6 rounded-2xl p-5 relative z-20">
        {dataError && (
          <div className="mb-4 rounded-2xl border border-error/20 bg-error/10 px-4 py-4 flex gap-3">
            <span className="material-symbols-outlined text-error flex-shrink-0" style={{ fontSize: 18 }}>report</span>
            <p className="text-sm font-semibold text-on-surface">{dataError}</p>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Factory</div>
            <SearchableSelect
              value={filterFactory}
              onChange={handleFilterFactoryChange}
              options={factories}
              placeholder="— Select factory —"
              className={inputCls}
              disabled={dataLoading}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Machine</div>
            <SearchableSelect
              value={filterEquipmentId}
              onChange={(val) => setFilterEquipmentId(val)}
              options={factoryEquipment.map(eq => ({ label: eq.name, value: eq._id?.$oid ?? String(eq._id) }))}
              placeholder={!filterFactory ? "— Select factory first —" : "All machines"}
              className={inputCls}
              disabled={!filterFactory || dataLoading}
            />
          </div>
          <div className="flex-[2] min-w-[250px]">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">Search & Filter</div>
            <div className="flex items-center gap-2">
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={inputCls}>
                <option value="">All Statuses</option>
                <option value="Open">Open</option>
                <option value="Resolved">Resolved</option>
                <option value="Failed">Failed</option>
              </select>
              <input
                type="text"
                placeholder="Search titles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex items-end gap-3 ml-auto">
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary hover:opacity-90 active:scale-95 transition-all shadow-md"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
              Report Issue
            </button>
          </div>
        </div>
      </div>

      {/* History table */}
      <div className="dashboard-section rounded-2xl overflow-hidden shadow-sm">
        {/* Section header */}
        <div className="px-5 py-4 border-b border-separator/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>build_circle</span>
            </span>
            <div>
              <h3 className="text-base font-semibold text-on-surface">{tableTitle}</h3>
              {!historyLoading && history.length > 0 && (
                <p className="text-xs text-outline mt-0.5">
                  {displayedHistory.length !== history.length
                    ? `Showing ${displayedHistory.length} of ${history.length} records`
                    : `${history.length} total records`}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Loading */}
        {historyLoading && (
          <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin text-primary" style={{ fontSize: 24 }}>progress_activity</span>
            Loading history...
          </div>
        )}

        {/* Empty States */}
        {!historyLoading && !filterFactory && (
          <div className="px-5 py-20 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 32 }}>factory</span>
            </div>
            <p className="text-base font-semibold text-on-surface">Select a factory</p>
            <p className="mt-1 text-sm text-outline">Choose a factory to view its equipment history.</p>
          </div>
        )}

        {!historyLoading && filterFactory && displayedHistory.length === 0 && (
          <div className="px-5 py-20 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-container">
              <span className="material-symbols-outlined text-outline" style={{ fontSize: 32 }}>search_off</span>
            </div>
            <p className="text-base font-semibold text-on-surface">No records found</p>
            <p className="mt-1 text-sm text-outline">Try adjusting your filters or report a new issue.</p>
          </div>
        )}

        {/* Table */}
        {!historyLoading && displayedHistory.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-separator/40 bg-surface-container-low">
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-outline whitespace-nowrap">
                    Date
                  </th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-outline w-1/3">
                    Issue Title
                  </th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-outline">
                    Status
                  </th>
                  {!filterEquipmentId && (
                    <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-outline">
                      Machine
                    </th>
                  )}
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-outline">
                    Reported By
                  </th>
                  <th className="px-4 py-3.5 text-center text-[11px] font-semibold uppercase tracking-wider text-outline">
                    Attempts
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-separator/20">
                {displayedHistory.map((event, i) => {
                  const key = event._id?.$oid ?? event._id ?? i;
                  const attemptCount = Array.isArray(event.attempts) ? event.attempts.length : 0;
                  const status = event.status || "Open";
                  
                  return (
                    <tr
                      key={key}
                      onClick={() => openEdit(event)}
                      className="cursor-pointer hover:bg-surface-container/50 transition-colors group"
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-on-surface-variant group-hover:text-primary transition-colors">
                          {event.date || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm font-bold text-on-surface line-clamp-1">
                          {event.title || <span className="italic font-normal text-on-surface-variant truncate block max-w-sm">{event.details}</span> || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                          status === "Resolved" ? "bg-primary/10 text-primary" :
                          status === "Failed" ? "bg-error/10 text-error" :
                          "bg-surface-container-high text-on-surface-variant"
                        }`}>
                          {status === "Resolved" ? "✅" : status === "Failed" ? "❌" : "🔴"} {status}
                        </span>
                      </td>
                      {!filterEquipmentId && (
                        <td className="px-4 py-4 whitespace-nowrap">
                          <p className="text-sm font-medium text-on-surface">
                            {event.equipmentName || "—"}
                          </p>
                        </td>
                      )}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm text-on-surface-variant">{event["名前"] || "—"}</span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {attemptCount > 0 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                            {attemptCount}
                          </span>
                        ) : (
                          <span className="text-outline text-sm">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <EventModal
          event={editingEvent}
          history={history}
          factories={factories}
          allEquipment={allEquipment}
          workerNames={workerNames}
          username={username}
          submitting={submitting}
          onClose={() => setModalOpen(false)}
          onSubmit={handleModalSubmit}
        />
      )}
    </section>
  );
}
