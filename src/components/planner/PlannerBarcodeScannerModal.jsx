import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import PlannerModalShell from "./PlannerModalShell";
import { useLanguage } from "../../contexts/LanguageContext";

const SCAN_COOLDOWN_MS = 2000;
const VIDEO_ELEMENT_ID = "planner-barcode-scanner-video";

// Camera / keyboard (handheld scanner) entry of 背番号. Each scan adds one box (収容数).
// Mount only while open: the camera starts on mount and stops on unmount.
export default function PlannerBarcodeScannerModal({
  products = [],
  title,
  subtitle,
  confirmLabel,
  busy = false,
  onConfirm,
  onClose,
}) {
  const { language } = useLanguage();
  const isJa = language === "ja";
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState({ text: "", tone: "muted" });
  const [flash, setFlash] = useState(null); // "success" | "error"
  const [manualValue, setManualValue] = useState("");
  const lastScanRef = useRef(0);
  const scannerRef = useRef(null);
  const productsRef = useRef(products);

  useEffect(() => { productsRef.current = products; }, [products]);

  const showFlash = useCallback((type) => {
    setFlash(type);
    window.setTimeout(() => setFlash(null), 300);
  }, []);

  const processCode = useCallback((rawValue, { skipCooldown = false } = {}) => {
    const now = Date.now();
    if (!skipCooldown && now - lastScanRef.current < SCAN_COOLDOWN_MS) return;
    if (!rawValue || typeof rawValue !== "string") return;

    const code = rawValue.trim().toUpperCase();
    const reject = (message) => {
      lastScanRef.current = now;
      showFlash("error");
      setStatus({ text: message, tone: "error" });
    };

    // 背番号 looks like "1GL" / "2TL": short, alphanumeric, at least one letter.
    if (code.length < 2 || code.length > 10) return reject(isJa ? `バーコード形式が不正です: "${code}"` : `Invalid barcode format: "${code}"`);
    if (!/^[A-Z0-9]+$/.test(code) || !/[A-Z]/.test(code)) return reject(isJa ? `背番号の形式が不正です: "${code}"` : `Invalid 背番号 format: "${code}"`);

    lastScanRef.current = now;
    const product = productsRef.current.find((p) => String(p.背番号 || "").trim().toUpperCase() === code);
    if (!product) return reject(isJa ? `背番号 "${code}" が見つかりません` : `背番号 "${code}" not found`);

    const boxQuantity = parseInt(product["収容数"], 10) || 1;
    setItems((current) => {
      const index = current.findIndex((item) => item.seiban === code);
      if (index >= 0) {
        return current.map((item, i) => (i === index ? { ...item, quantity: item.quantity + boxQuantity } : item));
      }
      return [...current, { seiban: code, hinban: product.品番 || "", quantity: boxQuantity, boxQuantity, product }];
    });
    showFlash("success");
    setStatus({ text: isJa ? `${code} を追加しました (+${boxQuantity})` : `${code} added (+${boxQuantity})`, tone: "success" });
  }, [isJa, showFlash]);

  const processCodeRef = useRef(processCode);
  useEffect(() => { processCodeRef.current = processCode; }, [processCode]);

  // Camera lifecycle
  useEffect(() => {
    let cancelled = false;
    let scanner = null;

    async function start() {
      try {
        setStatus({ text: isJa ? "カメラを起動中…" : "Starting camera…", tone: "muted" });
        const devices = await Html5Qrcode.getCameras();
        if (cancelled) return;
        if (!devices.length) throw new Error("No camera found");

        const back = devices.find((d) => /back|rear|environment/i.test(d.label || ""));
        scanner = new Html5Qrcode(VIDEO_ELEMENT_ID);
        scannerRef.current = scanner;
        await scanner.start(
          (back || devices[0]).id,
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => processCodeRef.current(decodedText),
          () => {},
        );
        if (cancelled) {
          await scanner.stop().catch(() => {});
          return;
        }
        setStatus({ text: isJa ? "スキャン可能です" : "Ready to scan", tone: "muted" });
      } catch (error) {
        console.error("Failed to initialize barcode scanner:", error);
        if (!cancelled) {
          setStatus({
            text: isJa ? "カメラを使用できません。権限を確認するか、下の入力欄をご利用ください。" : "Camera unavailable. Check permissions, or type the code below.",
            tone: "error",
          });
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      const active = scannerRef.current;
      scannerRef.current = null;
      if (active) {
        Promise.resolve(active.isScanning ? active.stop() : null)
          .catch(() => {})
          .finally(() => { try { active.clear(); } catch { /* already cleared */ } });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function removeItem(seiban) {
    setItems((current) => current.filter((item) => item.seiban !== seiban));
  }

  function setQuantity(seiban, value) {
    const quantity = Math.max(1, parseInt(value, 10) || 1);
    setItems((current) => current.map((item) => (item.seiban === seiban ? { ...item, quantity } : item)));
  }

  function submitManual(event) {
    event.preventDefault();
    processCode(manualValue, { skipCooldown: true });
    setManualValue("");
  }

  const statusClass = status.tone === "error"
    ? "text-[var(--status-danger)]"
    : status.tone === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--text-secondary)]";

  return (
    <PlannerModalShell
      open
      onClose={busy ? undefined : onClose}
      maxWidthClassName="max-w-3xl"
      title={title || (isJa ? "バーコードスキャナー" : "Barcode Scanner")}
      subtitle={subtitle || (isJa ? "背番号をスキャンすると、1回につき1箱 (収容数) 追加されます。" : "Each scan of a 背番号 adds one box (収容数).")}
      footer={(
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-4 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:opacity-50">
            {isJa ? "スキャン終了" : "Stop Scanning"}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(items)}
            disabled={busy || items.length === 0}
            className="flex items-center gap-1.5 rounded-[6px] bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>check_circle</span>
            {busy ? (isJa ? "処理中…" : "Working…") : (confirmLabel || (isJa ? "確定してすべて追加" : "Confirm & Add All"))}
          </button>
        </div>
      )}
    >
      <div className="relative overflow-hidden rounded-[8px] bg-black" style={{ minHeight: 280 }}>
        <div id={VIDEO_ELEMENT_ID} className="w-full" />
        <div className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${flash === "success" ? "bg-emerald-500/70 opacity-100" : flash === "error" ? "bg-red-500/70 opacity-100" : "opacity-0"}`}>
          <span className="material-symbols-outlined text-white" style={{ fontSize: 64 }}>{flash === "error" ? "cancel" : "check_circle"}</span>
        </div>
      </div>
      <p className={`mt-2 text-center text-xs ${statusClass}`} role="status">{status.text}</p>

      <form onSubmit={submitManual} className="mt-3 flex gap-2">
        <input
          value={manualValue}
          onChange={(event) => setManualValue(event.target.value)}
          placeholder={isJa ? "背番号を入力 / ハンディスキャナー入力 (Enter)" : "Type 背番号 or use a handheld scanner (Enter)"}
          className="h-9 flex-1 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 font-mono text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)] focus:ring-1 focus:ring-[var(--freya-blue)]"
        />
        <button type="submit" className="rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)]">
          {isJa ? "追加" : "Add"}
        </button>
      </form>

      <div className="mt-4 rounded-[8px] border border-[var(--border)]">
        <div className="border-b border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]">
          {isJa ? "スキャン済み" : "Scanned Items"} <span className="text-[var(--text-muted)]">({items.length})</span>
        </div>
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-[var(--text-muted)]">{isJa ? "まだスキャンされていません" : "No items scanned yet"}</div>
        ) : (
          <div className="max-h-60 divide-y divide-[var(--border)] overflow-y-auto">
            {items.map((item) => (
              <div key={item.seiban} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-semibold text-[var(--freya-blue)]">{item.seiban}</span>
                  <span className="text-xs text-[var(--text-secondary)]">{item.hinban}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(event) => setQuantity(item.seiban, event.target.value)}
                    className="h-8 w-24 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-2 text-right font-mono text-xs text-[var(--text-primary)] outline-none focus:border-[var(--freya-blue)]"
                    aria-label={isJa ? "数量" : "Quantity"}
                  />
                  <span className="text-xs text-[var(--text-muted)]">{isJa ? "個" : "pcs"}</span>
                  <button type="button" onClick={() => removeItem(item.seiban)} className="text-[var(--status-danger)] hover:opacity-80" aria-label={isJa ? "削除" : "Remove"}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PlannerModalShell>
  );
}
