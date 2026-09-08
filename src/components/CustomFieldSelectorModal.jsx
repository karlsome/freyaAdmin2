import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { fetchCustomFields } from "../services/api";
import { useLanguage } from "../contexts/LanguageContext";

const IGNORED_KEYS = ["_id", "createdAt", "updatedAt", "__v", "id"];

export default function CustomFieldSelectorModal({ onClose, onSelectField }) {
  const { language } = useLanguage();
  const isJa = language === "ja";

  const dbOptions = useMemo(() => [
    { value: "kensaDB", label: isJa ? "検査 (kensaDB)" : "Kensa (検査)" },
    { value: "pressDB", label: isJa ? "プレス (pressDB)" : "Press (プレス)" },
    { value: "slitDB", label: isJa ? "スリット (slitDB)" : "Slit (スリット)" },
    { value: "setsubiHistory", label: isJa ? "設備履歴 (setsubiHistory)" : "Equipment Maintenance (設備履歴)" },
  ], [isJa]);

  const [selectedDB, setSelectedDB] = useState("kensaDB");
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [search, setSearch] = useState("");
  const [selectedField, setSelectedField] = useState(null);
  const [selectedType, setSelectedType] = useState("text");

  // Simple in-memory session cache
  const cache = useRef({});

  useEffect(() => {
    async function loadFields() {
      if (cache.current[selectedDB]) {
        setFields(cache.current[selectedDB]);
        return;
      }

      setLoading(true);
      setError(null);
      setFields([]);
      setSelectedField(null);
      
      try {
        const response = await fetchCustomFields("submittedDB", selectedDB);
        setFields(response.fields || []);
        cache.current[selectedDB] = response.fields || [];
      } catch (err) {
        console.error(err);
        setError(isJa ? "データベースからスキーマの読み込みに失敗しました。" : "Failed to load schema from database.");
      } finally {
        setLoading(false);
      }
    }
    loadFields();
  }, [selectedDB, isJa]);

  const filteredFields = fields.filter(f => f.toLowerCase().includes(search.toLowerCase()));

  const handleConfirm = () => {
    if (!selectedField) return;
    onSelectField(selectedField, selectedType);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-surface rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        
        <div className="px-6 py-4 border-b border-separator/40 flex items-center justify-between bg-surface-container-lowest shrink-0">
          <div>
            <h2 className="text-lg font-bold text-on-surface">
              {isJa ? "カスタムフィールドを選択" : "Select Custom Field"}
            </h2>
            <p className="text-sm text-on-surface-variant mt-0.5">
              {isJa ? "プロセスDBを選択してネストされたフィールドを抽出します。" : "Pick a process database to extract unique nested fields."}
            </p>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 rounded-full hover:bg-on-surface/5 text-on-surface-variant transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
          
          <div className="grid gap-1.5">
            <label className="text-sm font-medium text-on-surface">
              {isJa ? "ソースデータベース" : "Source Database"}
            </label>
            <select 
              value={selectedDB}
              onChange={(e) => setSelectedDB(e.target.value)}
              className="px-3 py-2 rounded-lg border border-separator/40 bg-surface-container text-sm outline-none focus:border-primary/50"
            >
              {dbOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5 mt-2">
            <label className="text-sm font-medium text-on-surface">
              {isJa ? "フィールドを検索" : "Search Fields"}
            </label>
            <input 
              type="text" 
              placeholder="e.g. Counters.counter-1"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-2 rounded-lg border border-separator/40 bg-surface-container text-sm outline-none focus:border-primary/50"
            />
          </div>

          <div className="mt-2 flex-1 flex flex-col min-h-[200px]">
            <label className="text-sm font-medium text-on-surface mb-2">
              {isJa ? "利用可能なフィールド" : "Available Fields"}
            </label>
            <div className="flex-1 border border-separator/40 rounded-lg overflow-y-auto bg-surface-container-lowest p-2 space-y-1 max-h-[250px]">
              {loading && (
                <div className="p-4 text-center text-sm text-on-surface-variant">
                  {isJa ? "データベースをスキャン中..." : "Scanning database..."}
                </div>
              )}
              {error && <div className="p-4 text-center text-sm text-error">{error}</div>}
              
              {!loading && !error && filteredFields.length === 0 && (
                <div className="p-4 text-center text-sm text-on-surface-variant">
                  {isJa ? "フィールドが見つかりません。" : "No fields found."}
                </div>
              )}

              {!loading && !error && filteredFields.map(f => (
                <button
                  key={f}
                  onClick={() => setSelectedField(f)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedField === f ? 'bg-primary/20 text-primary font-semibold' : 'hover:bg-surface-container text-on-surface'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {selectedField && (
            <div className="grid gap-1.5 mt-2 p-4 rounded-lg border border-primary/20 bg-primary/5">
              <label className="text-sm font-semibold text-primary">
                {isJa ? `\`${selectedField}\` のデータ型` : `Data Type for \`${selectedField}\``}
              </label>
              <select 
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-2 rounded-lg border border-separator/40 bg-surface text-sm outline-none focus:border-primary/50"
              >
                <option value="text">{isJa ? "テキスト (文字列)" : "Text (String)"}</option>
                <option value="number">{isJa ? "数値 (整数 / 小数)" : "Number (Integer / Float)"}</option>
                <option value="date">{isJa ? "日付" : "Date"}</option>
                <option value="time">{isJa ? "時刻" : "Time"}</option>
              </select>
            </div>
          )}

        </div>

        <div className="px-6 py-4 border-t border-separator/40 bg-surface-container-lowest flex items-center justify-end gap-3 shrink-0">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:bg-on-surface/5 transition-colors"
          >
            {isJa ? "キャンセル" : "Cancel"}
          </button>
          <button 
            onClick={handleConfirm}
            disabled={!selectedField}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-on-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isJa ? "フィールドを使用" : "Use Field"}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
