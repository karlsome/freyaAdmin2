export default function StatusChip({ icon, label, className, iconFilled = false }) {
  return (
    <span className={[
      "inline-flex items-center rounded-[4px] border border-transparent px-2 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider",
      icon ? "gap-1" : null,
      className,
    ].filter(Boolean).join(" ")}>
      {icon ? (
        <span
          className="material-symbols-outlined"
          style={iconFilled ? { fontSize: 13, fontVariationSettings: "'FILL' 1" } : { fontSize: 13 }}
        >
          {icon}
        </span>
      ) : null}
      {label}
    </span>
  );
}
