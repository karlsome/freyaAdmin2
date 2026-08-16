import { useEffect, useMemo, useRef, useState, startTransition } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import {
  createSetsubiHistoryRecord,
  updateSetsubiHistoryRecord,
  fetchFactoryDBRecords,
  fetchSetsubiDBRecords,
  fetchSetsubiHistoryRecords,
  fetchWorkerNames,
  uploadEquipmentEventImage,
  deleteEquipmentEventImage,
  translateTextApi
} from "../services/api";
import { getAuthUser } from "../utils/masterDB";
import PageHeader from "../components/PageHeader";
import SensorDevicePhotoPreviewModal from "../components/SensorDevicePhotoPreviewModal";
import EquipmentEventDetailModal from "../components/EquipmentEventDetailModal";
import EquipmentEventPreviewModal from "../components/EquipmentEventPreviewModal";
import { useLanguage } from "../contexts/LanguageContext";
import MasterTabNav from "../components/MasterTabNav";
import DataTable from "../components/DataTable";

const PAGE_SIZE_OPTIONS = [25, 50, 100];

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

function fillTemplate(template, values) {
  return Object.entries(values).reduce(
    (str, [key, value]) => str.replace(`{${key}}`, value),
    template
  );
}

// ── Searchable Select ──────────────────────────────────────────────────────────

function SearchableSelect({ value, options, onChange, placeholder, className, disabled, isMulti }) {
  const { t } = useLanguage();
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
              placeholder={t("searchPlaceholder")}
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
            <div className="px-4 py-2 text-xs text-on-surface-variant text-center">{t("noResultsFound")}</div>
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
  const [title_en, setTitle_en] = useState(initialDraft?.title_en || event?.title_en || "");
  const [title_ja, setTitle_ja] = useState(initialDraft?.title_ja || event?.title_ja || "");
  
  const [status, setStatus] = useState(initialDraft?.status || event?.status || "Open");
  const [details, setDetails] = useState(initialDraft?.details || event?.details || "");
  const [details_en, setDetails_en] = useState(initialDraft?.details_en || event?.details_en || "");
  const [details_ja, setDetails_ja] = useState(initialDraft?.details_ja || event?.details_ja || "");
  
  const [titleTranslated, setTitleTranslated] = useState(false);
  const [detailsTranslated, setDetailsTranslated] = useState(false);
  
  const [imageURLs, setImageURLs] = useState(initialDraft?.imageURLs || event?.imageURLs || []);
  const [resolutionTime, setResolutionTime] = useState(initialDraft?.resolutionTime || event?.resolutionTime || "");

  const [attempts, setAttempts] = useState(initialDraft?.attempts || event?.attempts || []);
  
  const { language, t } = useLanguage();
  const [activeAttemptTabs, setActiveAttemptTabs] = useState({});
  const attemptSnapshotsRef = useRef({});
  const attemptsRef = useRef(attempts);
  const titleSnapshotRef = useRef(title);
  const detailsSnapshotRef = useRef(details);

  useEffect(() => {
    attemptsRef.current = attempts;
  }, [attempts]);

  async function handleTitleBlur() {
    const currentVal = language === "ja" ? (title_ja || title) : (title_en || title);
    const targetLang = language === "ja" ? "en" : "ja";
    const needsForceTranslation = targetLang === "ja" ? !title_ja : !title_en;

    console.log("[handleTitleBlur] currentVal:", currentVal, "snapshot:", titleSnapshotRef.current, "needsForce:", needsForceTranslation);

    if (!currentVal || (!needsForceTranslation && currentVal === titleSnapshotRef.current)) return;
    titleSnapshotRef.current = currentVal;
    
    console.log("[handleTitleBlur] Translating to:", targetLang);
    
    const langpair = language === "ja" ? "ja|en" : "en|ja";
    
    try {
      const translated = await translateTextApi(currentVal, langpair);
      if (translated && typeof translated === "string") {
        if (targetLang === "ja") {
          setTitle_ja(translated);
        } else {
          setTitle_en(translated);
        }
        setTitleTranslated(true);
      }
    } catch (err) {
      console.error("Auto-translate title failed", err);
    }
  }

  async function handleDetailsBlur() {
    const currentVal = language === "ja" ? (details_ja || details) : (details_en || details);
    const targetLang = language === "ja" ? "en" : "ja";
    const needsForceTranslation = targetLang === "ja" ? !details_ja : !details_en;

    console.log("[handleDetailsBlur] currentVal:", currentVal, "snapshot:", detailsSnapshotRef.current, "needsForce:", needsForceTranslation);

    if (!currentVal || (!needsForceTranslation && currentVal === detailsSnapshotRef.current)) return;
    detailsSnapshotRef.current = currentVal;
    
    console.log("[handleDetailsBlur] Translating to:", targetLang);
    
    const langpair = language === "ja" ? "ja|en" : "en|ja";
    
    try {
      const translated = await translateTextApi(currentVal, langpair);
      if (translated && typeof translated === "string") {
        if (targetLang === "ja") {
          setDetails_ja(translated);
        } else {
          setDetails_en(translated);
        }
        setDetailsTranslated(true);
      }
    } catch (err) {
      console.error("Auto-translate details failed", err);
    }
  }

  async function performSmartTranslation(index, oldAtt, newAtt) {
    const activeTab = activeAttemptTabs[index] || (language === "ja" ? "ja" : "en");
    const targetTab = activeTab === "en" ? "ja" : "en";
    const langpair = activeTab === "ja" ? "ja|en" : "en|ja";

    let updatedFields = {};

    const checkAndTranslate = async (fieldBase) => {
      const srcField = `${fieldBase}_${activeTab}`;
      const targetField = `${fieldBase}_${targetTab}`;
      
      const fallbackOld = activeTab === "en" ? (oldAtt[fieldBase] || "") : "";
      const fallbackNew = activeTab === "en" ? (newAtt[fieldBase] || "") : "";
      
      const oldVal = oldAtt[srcField] ?? fallbackOld;
      const newVal = newAtt[srcField] ?? fallbackNew;
      
      if (newVal && newVal.trim() !== "" && newVal !== oldVal) {
        try {
          const translated = await translateTextApi(newVal, langpair);
          updatedFields[targetField] = translated;
          if (targetTab === "en") updatedFields[fieldBase] = translated;
        } catch (e) {
          console.error(`Translation failed for ${fieldBase}:`, e);
        }
      }
    };

    await Promise.all([
      checkAndTranslate("title"),
      checkAndTranslate("fixDescription"),
      checkAndTranslate("result")
    ]);

    if (Object.keys(updatedFields).length > 0) {
      setAttempts(prev => {
        const newAtt = [...prev];
        newAtt[index] = { ...newAtt[index], ...updatedFields };
        return newAtt;
      });
    }
  }

  function changeExpandedAttempt(newIndex, latestAttempts = attemptsRef.current) {
    startTransition(() => {
      if (expandedAttemptIndex !== null && expandedAttemptIndex !== newIndex) {
        const oldAtt = attemptSnapshotsRef.current[expandedAttemptIndex];
        const newAtt = latestAttempts[expandedAttemptIndex];
        if (oldAtt && newAtt) {
          performSmartTranslation(expandedAttemptIndex, oldAtt, newAtt);
        }
      }

      if (newIndex !== null) {
        attemptSnapshotsRef.current[newIndex] = { ...latestAttempts[newIndex] };
      }

      setExpandedAttemptIndex(newIndex);
    });
  }

  function handleToggleCollapse(index, isExpanded) {
    changeExpandedAttempt(isExpanded ? null : index);
  }

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
      lastFixedBy = lastSuccessfulAttempt?.fixedBy || last["名前"] || t("statusUnknown");
      lastFixedDate = last.date;
    }

    return { totalOccurrences, avgTime, successFixes, failedFixes, lastFixedBy, lastFixedDate };
  }, [equipmentId, history, t]);

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
        raw.startsWith("<")
          ? t("uploadFailedServerError")
          : raw || fillTemplate(t("filesFailedTemplate"), { count: failedCount })
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
      const newAttempt = {
        attemptNumber: prev.length + 1,
        title: "",
        title_en: "",
        title_ja: "",
        fixDescription: "",
        fixDescription_en: "",
        fixDescription_ja: "",
        result: "",
        result_en: "",
        result_ja: "",
        fixedBy: [],
        status: "Success",
        date: new Date().toISOString().split("T")[0],
        timeToResolve: "",
        imageURLs: []
      };
      const newAttemptsList = [...prev, newAttempt];
      changeExpandedAttempt(prev.length, newAttemptsList);
      return newAttemptsList;
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
    setTitle_en("");
    setTitle_ja("");
    setStatus("Open");
    setDetails("");
    setDetails_en("");
    setDetails_ja("");
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
      title_en,
      title_ja,
      status,
      details,
      details_en,
      details_ja,
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
              {isEdit ? t("editRecordEyebrow") : t("addRecordEyebrow")}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-on-surface">
              {isEdit ? (event.title || t("equipmentEventFallback")) : t("reportEquipmentEvent")}
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
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{t("factory")} *</div>
                <SearchableSelect
                  value={factory}
                  onChange={(val) => {
                    setFactory(val);
                    setEquipmentId("");
                  }}
                  options={factories}
                  placeholder={t("selectFactoryOption")}
                  className={inputCls}
                />
              </div>
              <div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{t("machine")} *</div>
                <SearchableSelect
                  value={equipmentId}
                  onChange={(val) => setEquipmentId(val)}
                  options={factoryEquipment.map(eq => ({ label: eq.name, value: eq._id?.$oid ?? String(eq._id) }))}
                  placeholder={!factory ? t("selectFactoryFirstOption") : t("selectMachineOption")}
                  className={inputCls}
                  disabled={!factory}
                />
              </div>
              <div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{t("reportedBy")}</div>
                <SearchableSelect
                  value={reportedBy}
                  onChange={(val) => setReportedBy(val)}
                  options={workerNames}
                  placeholder={t("selectNameOption")}
                  className={inputCls}
                />
              </div>
              <div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{t("date")} *</div>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} required />
              </div>
            </div>

            <hr className="border-separator/20" />

            {/* Core Issue */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="md:col-span-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{t("issueTitle")}</div>
                    {titleTranslated && (
                      <div className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" title={t("autoTranslated")} />
                    )}
                  </div>
                  <input
                    type="text"
                    value={language === "ja" ? (title_ja || title) : (title_en || title)}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (language === "ja") setTitle_ja(val);
                      else setTitle_en(val);
                      setTitle(val);
                      setTitleTranslated(false);
                    }}
                    onBlur={handleTitleBlur}
                    placeholder={language === "ja" ? "タイトル" : "E.g. Belt Realignment, Motor Replacement..."}
                    className={`${inputCls} font-medium text-base`}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{t("symptomDetails")}</div>
                    {detailsTranslated && (
                      <div className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" title={t("autoTranslated")} />
                    )}
                  </div>
                  <textarea
                    value={language === "ja" ? (details_ja || details) : (details_en || details)}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (language === "ja") setDetails_ja(val);
                      else setDetails_en(val);
                      setDetails(val);
                      setDetailsTranslated(false);
                    }}
                    onBlur={handleDetailsBlur}
                    rows={3}
                    placeholder={language === "ja" ? "何が起こったのか、何が観察されたのかを正確に記述してください..." : "Describe exactly what happened or what was observed..."}
                    className={`${inputCls} resize-none`}
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{t("overallStatus")}</div>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className={`${inputCls} font-semibold ${
                      status === "Resolved" ? "text-primary border-primary/40 bg-primary/5" :
                      status === "Failed" ? "text-error border-error/40 bg-error/5" : ""
                    }`}
                  >
                    <option value="Open">{t("statusOpenOption")}</option>
                    <option value="Resolved">{t("statusResolvedOption")}</option>
                    <option value="Failed">{t("statusFailedOption")}</option>
                  </select>
                </div>
                <div>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{t("totalTimeHours")}</div>
                  <input
                    type="number"
                    step="0.01"
                    value={resolutionTime}
                    onChange={(e) => setResolutionTime(e.target.value)}
                    placeholder={t("hoursExample")}
                    className={inputCls}
                    min="0"
                  />
                </div>
              </div>
            </div>

            {/* General Files */}
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{t("symptomFiles")}</div>
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
                  <><span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>progress_activity</span> {t("uploadingFiles")}</>
                ) : (
                  <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>attach_file</span> {t("attachFiles")}</>
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
                              images: imageURLs.map((u) => ({ url: u, label: t("eventFileLabel") })),
                              activeIndex: imageURLs.indexOf(url),
                              displayName: t("reportAttachments"),
                              eyebrow: title || t("eventFallback"),
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
                  {t("fixAttempts")}
                </div>
              </div>

              {attempts.length === 0 ? (
                <div className="text-center py-6 border border-dashed border-outline-variant/40 rounded-2xl">
                  <p className="text-sm text-on-surface-variant">{t("noFixAttempts")}</p>
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
                          onClick={() => handleToggleCollapse(index, isExpanded)}
                        >
                          <span className="bg-surface-container-high text-on-surface text-[10px] font-bold px-2 py-0.5 rounded-md">
                            #{attempt.attemptNumber}
                          </span>
                          {!isExpanded && (
                            <span className="text-sm font-semibold text-on-surface flex-1 truncate">
                              {attempt.title || fillTemplate(t("attemptNumberTemplate"), { number: attempt.attemptNumber })}
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
                              {t("editingLabel")}
                            </span>
                          )}
                        </div>

                        {isExpanded && (() => {
                          const activeTab = activeAttemptTabs[index] || (language === "ja" ? "ja" : "en");
                          const isEn = activeTab === "en";

                          return (
                            <>
                              <div className="mb-4">
                                <MasterTabNav
                                  tabs={[
                                    { key: "en", label: "English 🇺🇸" },
                                    { key: "ja", label: "日本語 🇯🇵" }
                                  ]}
                                  activeTab={activeTab}
                                  onSelect={(tab) => setActiveAttemptTabs(prev => ({ ...prev, [index]: tab.key }))}
                                />
                              </div>

                              <div className="flex flex-col gap-3 mb-4">
                                <input
                                  type="text"
                                  value={isEn ? (attempt.title_en ?? attempt.title ?? "") : (attempt.title_ja ?? "")}
                                  onChange={(e) => {
                                    updateAttempt(index, isEn ? "title_en" : "title_ja", e.target.value);
                                    if (isEn) updateAttempt(index, "title", e.target.value);
                                  }}
                                  placeholder={isEn ? "Attempt Title (e.g. Belt Realignment)" : "タイトル"}
                                  className={`${inputCls} font-medium`}
                                />
                                <textarea
                                  value={isEn ? (attempt.fixDescription_en ?? attempt.fixDescription ?? "") : (attempt.fixDescription_ja ?? "")}
                                  onChange={(e) => {
                                    updateAttempt(index, isEn ? "fixDescription_en" : "fixDescription_ja", e.target.value);
                                    if (isEn) updateAttempt(index, "fixDescription", e.target.value);
                                  }}
                                  placeholder={isEn ? "What did you do?" : "何をしましたか？"}
                                  className={`${inputCls} resize-none`}
                                  rows={2}
                                />
                                <textarea
                                  value={isEn ? (attempt.result_en ?? attempt.result ?? "") : (attempt.result_ja ?? "")}
                                  onChange={(e) => {
                                    updateAttempt(index, isEn ? "result_en" : "result_ja", e.target.value);
                                    if (isEn) updateAttempt(index, "result", e.target.value);
                                  }}
                                  placeholder={isEn ? "What was the result?" : "結果はどうでしたか？"}
                                  className={`${inputCls} resize-none`}
                                  rows={2}
                                />
                              </div>
                            </>
                          );
                        })()}

                        {isExpanded && (
                          <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                        <div>
                          <select 
                            value={attempt.status} 
                            onChange={(e) => updateAttempt(index, "status", e.target.value)}
                            className={inputCls}
                          >
                            <option value="Success">{t("attemptStatusSuccessOption")}</option>
                            <option value="Failed">{t("attemptStatusFailedOption")}</option>
                          </select>
                        </div>
                        <div>
                          <SearchableSelect
                            value={Array.isArray(attempt.fixedBy) ? attempt.fixedBy : (attempt.fixedBy ? [attempt.fixedBy] : [])}
                            onChange={(val) => updateAttempt(index, "fixedBy", val)}
                            options={workerNames}
                            placeholder={t("selectWorkersOption")}
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
                            placeholder={t("hoursPlaceholder")}
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
                            <><span className="material-symbols-outlined animate-spin" style={{ fontSize: 14 }}>progress_activity</span> {t("uploadingFiles")}</>
                          ) : (
                            <><span className="material-symbols-outlined" style={{ fontSize: 14 }}>attach_file</span> {t("filesButtonLabel")}</>
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
                                      images: attempt.imageURLs.map((u) => ({ url: u, label: t("attemptFileLabel") })),
                                      activeIndex: attempt.imageURLs.indexOf(url),
                                      displayName: attempt.title || fillTemplate(t("attemptNumberTemplate"), { number: index + 1 }),
                                      eyebrow: t("fixAttemptLabel"),
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
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> {t("addAttempt")}
                </button>
              </div>
            </div>
            
            {uploadError && <p className="text-xs text-error">{uploadError}</p>}
          </form>

          {/* Sidebar Insights */}
          <div className="w-full lg:w-72 bg-surface border-t lg:border-t-0 lg:border-l border-separator/30 p-6 flex flex-col shrink-0">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-outline mb-4">
              {t("historyAndInsights")}
            </h3>

            {!equipmentId ? (
              <p className="text-sm text-on-surface-variant text-center mt-4 italic">{t("selectMachineForInsights")}</p>
            ) : !insights ? (
              <p className="text-sm text-on-surface-variant text-center mt-4 italic">{t("noPreviousHistory")}</p>
            ) : (
              <div className="space-y-4">
                <div className="bg-surface-container-low rounded-xl p-4">
                  <p className="text-[10px] font-semibold uppercase text-outline mb-1">{t("totalOccurrences")}</p>
                  <p className="text-lg font-bold text-on-surface flex items-center gap-2">
                    {insights.totalOccurrences > 3 ? "🔴" : "🔵"} {insights.totalOccurrences} {t("timesSuffix")}
                  </p>
                </div>

                <div className="bg-surface-container-low rounded-xl p-4">
                  <p className="text-[10px] font-semibold uppercase text-outline mb-1">{t("fixSuccessRate")}</p>
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
                  <p className="text-[10px] font-semibold uppercase text-outline mb-1">{t("lastFixedBy")}</p>
                  <p className="text-sm font-medium text-on-surface">👷 {insights.lastFixedBy}</p>
                  <p className="text-xs text-outline mt-1">{insights.lastFixedDate}</p>
                </div>

                <div className="bg-surface-container-low rounded-xl p-4">
                  <p className="text-[10px] font-semibold uppercase text-outline mb-1">{t("avgResolutionTime")}</p>
                  <p className="text-sm font-medium text-on-surface flex items-center gap-2">
                    ⏱️ {insights.avgTime > 0 ? `${insights.avgTime} ${t("minsSuffix")}` : t("statusUnknown")}
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
              {t("discardDraft")}
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
              {t("cancel")}
            </button>
            <button
              type="submit"
              form="event-form"
              disabled={!canSubmit}
              className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-on-primary hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? t("savingEllipsis") : isEdit ? t("saveChanges") : t("submitReport")}
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
  const { language, t } = useLanguage();

  const [factories, setFactories] = useState([]);
  const [allEquipment, setAllEquipment] = useState([]);
  const [workerNames, setWorkerNames] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");

  const [filterFactories, setFilterFactories] = useState([]);
  const [filterEquipmentId, setFilterEquipmentId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [history, setHistory] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState({ column: "date", direction: -1 });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [viewingEvent, setViewingEvent] = useState(null);
  const [previewEvent, setPreviewEvent] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();

  // Load the viewing event from URL if it exists
  useEffect(() => {
    const urlEventId = searchParams.get("eventId");
    if (urlEventId && history.length > 0) {
      if (!viewingEvent || (viewingEvent._id?.$oid ?? viewingEvent._id) !== urlEventId) {
        const found = history.find(h => (h._id?.$oid ?? h._id) === urlEventId);
        if (found) {
          setViewingEvent(found);
        }
      }
    } else if (!urlEventId && viewingEvent) {
      setViewingEvent(null);
    }
  }, [searchParams, history, viewingEvent]);

  function handleSetViewingEvent(evt) {
    if (evt) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set("eventId", evt._id?.$oid ?? evt._id);
      setSearchParams(newParams);
    } else {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("eventId");
      setSearchParams(newParams);
    }
  }

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
        if (active) setDataError(err?.message || t("failedToLoadData"));
      } finally {
        if (active) setDataLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1); // Reset to page 1 on new search
    }, 400);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Load history when filters/page change.
  // 0 or 1 selected factories: standard server-side pagination.
  // 2+ selected factories: fetch each factory in parallel and merge/paginate client-side,
  // since the backend only filters by a single factory at a time.
  const sortDir = sort.direction === 1 ? "asc" : "desc";
  const sortColumn = sort.column || "date";

  useEffect(() => {
    let active = true;
    setHistoryLoading(true);
    setHistoryError("");

    async function load() {
      try {
        if (filterFactories.length <= 1) {
          const res = await fetchSetsubiHistoryRecords({
            factory: filterFactories[0] || undefined,
            equipmentId: filterEquipmentId || undefined,
            status: filterStatus || undefined,
            search: debouncedSearch || undefined,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            page,
            limit: pageSize,
            sortColumn,
            sortDir
          });
          if (!active) return;
          setHistory(Array.isArray(res.items) ? res.items : []);
          setTotalPages(res.totalPages || 1);
          setTotalCount(res.totalCount || 0);
        } else {
          const results = await Promise.all(
            filterFactories.map((factory) =>
              fetchSetsubiHistoryRecords({
                factory,
                status: filterStatus || undefined,
                search: debouncedSearch || undefined,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
                page: 1,
                limit: 500,
                sortColumn,
                sortDir
              })
            )
          );
          if (!active) return;
          const merged = results.flatMap((res) => (Array.isArray(res.items) ? res.items : []));
          
          const direction = sort.direction === -1 ? -1 : 1;
          const getVal = (item) => {
            switch (sort.column) {
              case "machine":
                return (item.equipmentName || "").toLowerCase();
              case "factory":
                return (item["工場"] || "").toLowerCase();
              case "date":
                return item.date || "";
              case "issueTitle":
                return (
                  language === "ja"
                    ? (item.title_ja || item.title || item.details_ja || item.details || "")
                    : (item.title_en || item.title || item.details_en || item.details || "")
                ).toLowerCase();
              case "status":
                return (item.status || "Open").toLowerCase();
              case "reportedBy":
                return (item["名前"] || item.submittedBy || "").toLowerCase();
              case "attempts":
                return Array.isArray(item.attempts) ? item.attempts.length : 0;
              default:
                return "";
            }
          };

          merged.sort((a, b) => {
            const va = getVal(a);
            const vb = getVal(b);
            if (typeof va === "number" && typeof vb === "number") {
              return (va - vb) * direction;
            }
            if (va < vb) return -1 * direction;
            if (va > vb) return 1 * direction;
            return 0;
          });

          const pages = Math.max(1, Math.ceil(merged.length / pageSize));
          const clampedPage = Math.min(page, pages);
          setHistory(merged.slice((clampedPage - 1) * pageSize, clampedPage * pageSize));
          setTotalPages(pages);
          setTotalCount(merged.length);
          if (clampedPage !== page) setPage(clampedPage);
        }
      } catch (err) {
        if (active) setHistoryError(err?.message || t("failedToLoadHistory"));
      } finally {
        if (active) setHistoryLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [filterFactories, filterEquipmentId, filterStatus, debouncedSearch, dateFrom, dateTo, page, pageSize, sortColumn, sortDir, historyRefresh, language]);

  const factoryEquipment = useMemo(
    () => filterFactories.length === 1 ? allEquipment.filter((eq) => eq["工場"] === filterFactories[0]) : [],
    [allEquipment, filterFactories]
  );

  const selectedEquipmentName = useMemo(() => {
    if (!filterEquipmentId) return "";
    const eq = allEquipment.find(
      (e) => (e._id?.$oid ?? String(e._id)) === filterEquipmentId
    );
    return eq?.name || "";
  }, [allEquipment, filterEquipmentId]);

  const tableColumns = useMemo(() => [
    {
      key: "machine",
      sortKey: "machine",
      label: t("machine"),
      width: 180,
      renderCell: (row) => (
        <span className="text-sm font-bold text-on-surface">
          {row.equipmentName || "—"}
        </span>
      ),
      disableCellWrapper: true,
    },
    {
      key: "factory",
      sortKey: "factory",
      label: t("factory"),
      width: 130,
      renderCell: (row) => (
        <span className="text-sm font-medium text-on-surface">
          {row["工場"] || "—"}
        </span>
      ),
      disableCellWrapper: true,
    },
    {
      key: "date",
      sortKey: "date",
      label: t("date"),
      width: 130,
      renderCell: (row) => (
        <span className="text-sm font-semibold text-on-surface-variant group-hover:text-primary transition-colors whitespace-nowrap">
          {row.date || "—"}
        </span>
      ),
      disableCellWrapper: true,
    },
    {
      key: "issueTitle",
      sortKey: "issueTitle",
      label: t("issueTitle"),
      width: 320,
      renderCell: (row) => {
        const title = language === "ja"
          ? (row.title_ja || row.title)
          : (row.title_en || row.title);
        const fallback = language === "ja"
          ? (row.details_ja || row.details)
          : (row.details_en || row.details);
        return (
          <p className="text-sm font-bold text-on-surface line-clamp-1">
            {title || (
              fallback ? (
                <span className="italic font-normal text-on-surface-variant truncate block max-w-sm">
                  {fallback}
                </span>
              ) : "—"
            )}
          </p>
        );
      },
      disableCellWrapper: true,
    },
    {
      key: "status",
      sortKey: "status",
      label: t("status"),
      width: 130,
      renderCell: (row) => {
        const status = row.status || "Open";
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
            status === "Resolved" ? "bg-primary/10 text-primary" :
            status === "Failed" ? "bg-error/10 text-error" :
            "bg-surface-container-high text-on-surface-variant"
          }`}>
            {status === "Resolved" ? "✅" : status === "Failed" ? "❌" : "🔴"}{" "}
            {status === "Resolved" ? t("statusResolved") : status === "Failed" ? t("statusFailed") : t("statusOpen")}
          </span>
        );
      },
      disableCellWrapper: true,
    },
    {
      key: "reportedBy",
      sortKey: "reportedBy",
      label: t("reportedBy"),
      width: 140,
      renderCell: (row) => (
        <span className="text-sm text-on-surface-variant whitespace-nowrap">
          {row["名前"] || row.submittedBy || "—"}
        </span>
      ),
      disableCellWrapper: true,
    },
    {
      key: "attempts",
      sortKey: "attempts",
      label: t("attempts"),
      align: "center",
      width: 110,
      renderCell: (row) => {
        const attemptCount = Array.isArray(row.attempts) ? row.attempts.length : 0;
        return attemptCount > 0 ? (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
            {attemptCount}
          </span>
        ) : (
          <span className="text-outline text-sm">—</span>
        );
      },
      disableCellWrapper: true,
    },
  ], [language, t]);

  function handleSort(columnKey) {
    setSort((prev) => {
      const nextDir = prev?.column === columnKey ? (prev.direction === 1 ? -1 : 1) : (columnKey === "date" ? -1 : 1);
      return { column: columnKey, direction: nextDir };
    });
    setPage(1);
  }

  function handleFilterFactoriesChange(vals) {
    setFilterFactories(vals);
    setFilterEquipmentId("");
    setPage(1);
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
      alert(err?.message || t("failedToSaveRecord"));
    } finally {
      setSubmitting(false);
    }
  }


  const tableTitle = filterEquipmentId
    ? selectedEquipmentName
    : filterFactories.length === 1
    ? filterFactories[0]
    : filterFactories.length > 1
    ? fillTemplate(t("factoriesSelectedTemplate"), { count: filterFactories.length })
    : t("equipmentHistoryTitle");

  return (
    <section className="pt-24 pb-16 px-8 overflow-y-auto h-screen scrollbar-hide font-body">
      <PageHeader
        eyebrow={t("equipmentHistoryTitle")}
        title={t("equipmentHistoryTitle")}
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
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{t("factory")}</div>
            <SearchableSelect
              value={filterFactories}
              onChange={handleFilterFactoriesChange}
              options={factories}
              placeholder={t("allFactoriesOption")}
              className={inputCls}
              disabled={dataLoading}
              isMulti
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{t("machine")}</div>
            <SearchableSelect
              value={filterEquipmentId}
              onChange={(val) => setFilterEquipmentId(val)}
              options={factoryEquipment.map(eq => ({ label: eq.name, value: eq._id?.$oid ?? String(eq._id) }))}
              placeholder={filterFactories.length !== 1 ? t("selectOneFactoryOption") : t("allMachinesOption")}
              className={inputCls}
              disabled={filterFactories.length !== 1 || dataLoading}
            />
          </div>
          <div className="flex-[2] min-w-[250px]">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-outline">{t("searchAndFilter")}</div>
            <div className="flex items-center gap-2">
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={inputCls}>
                <option value="">{t("allStatuses")}</option>
                <option value="Open">{t("statusOpen")}</option>
                <option value="Resolved">{t("statusResolved")}</option>
                <option value="Failed">{t("statusFailed")}</option>
              </select>
              <input
                type="text"
                placeholder={t("searchTitlesPlaceholder")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
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
              {t("reportIssue")}
            </button>
          </div>
        </div>
      </div>

      {/* Pop-up Preview Modal */}
      <EquipmentEventPreviewModal
        event={previewEvent}
        onClose={() => setPreviewEvent(null)}
        onEdit={(evt) => {
          setPreviewEvent(null);
          openEdit(evt);
        }}
        onExpand={(evt) => {
          setPreviewEvent(null);
          handleSetViewingEvent(evt);
        }}
      />

      {/* History table or Detail View */}
      {viewingEvent ? (
        <EquipmentEventDetailModal
          event={viewingEvent}
          onClose={() => handleSetViewingEvent(null)}
          onEdit={(evt) => {
            handleSetViewingEvent(null);
            openEdit(evt);
          }}
        />
      ) : (
        <div className="dashboard-section rounded-2xl overflow-hidden shadow-sm">
          {/* Section header */}
          <div className="px-5 py-4 border-b border-separator/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>build_circle</span>
              </span>
              <div>
                <h3 className="text-base font-semibold text-on-surface">{tableTitle}</h3>
                {!historyLoading && totalCount > 0 && (
                  <p className="text-xs text-outline mt-0.5">
                    {fillTemplate(t("totalRecordsTemplate"), { count: totalCount })}
                  </p>
                )}
              </div>
            </div>
          </div>

          <DataTable
            columns={tableColumns}
            rows={history}
            loading={historyLoading}
            error={historyError}
            sort={sort}
            page={page}
            pageSize={pageSize}
            filteredCount={totalCount}
            totalPages={totalPages}
            onSort={handleSort}
            onPageChange={(nextPage) => setPage(nextPage)}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setPage(1);
            }}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
            pageSizeLabel={t("rows") || "Rows"}
            previousLabel={t("previous") || "Previous"}
            nextLabel={t("next") || "Next"}
            resetColumnsLabel={t("resetColumns") || "Reset columns"}
            enableColumnResize={true}
            enableColumnReorder={true}
            layoutStorageKey="equipment_history_table_layout"
            rowKey={(row) => row._id?.$oid ?? row._id}
            onRowClick={(row) => setPreviewEvent(row)}
            clickableRowClassName="cursor-pointer"
            className="overflow-hidden"
            emptyTitle={t("noRecordsFoundTitle")}
            emptyMessage={t("adjustFiltersPrompt")}
            loadingMessage={t("loadingHistory")}
          />
        </div>
      )}

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
