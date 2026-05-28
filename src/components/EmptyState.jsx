export default function EmptyState({ icon, title, children, variant = "dashed", className }) {
  const base = variant === "filled"
    ? "rounded-2xl border border-outline-variant/20 bg-surface-container-low/35 px-6 py-12 text-center text-sm text-on-surface-variant"
    : "rounded-2xl border border-dashed border-outline-variant/20 px-6 py-12 text-center text-sm text-on-surface-variant";

  return (
    <div className={[base, className].filter(Boolean).join(" ")}>
      {icon ? (
        <div className="mb-3 flex justify-center">
          <span className="material-symbols-outlined text-outline" style={{ fontSize: 36 }}>{icon}</span>
        </div>
      ) : null}
      {title ? <p className="mb-1 text-sm font-semibold text-on-surface">{title}</p> : null}
      {children}
    </div>
  );
}
