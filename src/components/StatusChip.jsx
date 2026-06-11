export default function StatusChip({ icon, label, className, iconFilled = false }) {
  return (
    <span className={[
      "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
      icon ? "gap-1" : null,
      className,
    ].filter(Boolean).join(" ")}>
      {icon ? (
        <span
          className="material-symbols-outlined"
          style={iconFilled ? { fontSize: 14, fontVariationSettings: "'FILL' 1" } : { fontSize: 14 }}
        >
          {icon}
        </span>
      ) : null}
      {label}
    </span>
  );
}
