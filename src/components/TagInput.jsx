import { useState } from "react";

export default function TagInput({
  tags,
  onAdd,
  onRemove,
  placeholder = "",
  tagClassName = "bg-primary/15 text-primary",
  uppercase = false,
}) {
  const [value, setValue] = useState("");

  function commit() {
    const next = uppercase ? value.trim().toUpperCase() : value.trim();
    if (!next || tags.includes(next)) return;
    onAdd(next);
    setValue("");
  }

  return (
    <div
      className="ui-control-surface min-h-10 cursor-text rounded-xl border border-outline-variant/20 px-3 py-1.5 transition-colors focus-within:border-primary/40"
      onClick={(e) => e.currentTarget.querySelector("input")?.focus()}
    >
      <div className="flex flex-wrap items-center gap-1">
        {tags.map((tag) => (
          <span key={tag} className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${tagClassName}`}>
            {tag}
            <button type="button" onClick={() => onRemove(tag)} className="leading-none hover:text-error">×</button>
          </span>
        ))}
        <input
          type="text"
          value={value}
          placeholder={tags.length ? "" : placeholder}
          className="min-w-24 flex-1 bg-transparent text-xs text-on-surface outline-none placeholder:text-outline"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(); }
            if (e.key === "Backspace" && !value && tags.length) onRemove(tags[tags.length - 1]);
          }}
          onBlur={commit}
        />
      </div>
    </div>
  );
}
