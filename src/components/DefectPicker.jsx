import { DEFECT_OTHER_ID } from "../utils/furyoKanri";

const inputClass =
  "w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--freya-blue)] placeholder:text-[var(--text-muted)]";

// Dropdown of master items that can still be added (not deleted, not already listed, not その他)
export default function DefectPicker({ catalog, excludeIds, onPick, isJa }) {
  const exclude = new Set(excludeIds);
  const options = catalog
    .filter((item) => !item.deleted && item.id !== DEFECT_OTHER_ID && !exclude.has(item.id))
    .sort((a, b) => a.jp.localeCompare(b.jp, "ja"));

  return (
    <select
      value=""
      onChange={(event) => {
        if (event.target.value) onPick(event.target.value);
      }}
      disabled={!options.length}
      className={`${inputClass} max-w-xs cursor-pointer`}
    >
      <option value="">
        {options.length
          ? (isJa ? "＋ マスタから不良を追加..." : "+ Add defect from master...")
          : (isJa ? "追加できる不良がありません" : "No more defects in master")}
      </option>
      {options.map((item) => (
        <option key={item.id} value={item.id}>
          {item.jp}{item.en ? ` / ${item.en}` : ""}
        </option>
      ))}
    </select>
  );
}

