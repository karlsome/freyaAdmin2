export default function FormField({
  label,
  required = false,
  variant = "filter",
  className,
  children,
}) {
  if (variant === "form") {
    return (
      <div className={className}>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-outline">
          {label}
          {required && <span className="ml-1 text-error">*</span>}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className={["flex flex-col gap-1.5", className].filter(Boolean).join(" ")}>
      <label className="text-[10px] font-bold uppercase tracking-wider text-outline">
        {label}
        {required && <span className="ml-1 text-error">*</span>}
      </label>
      {children}
    </div>
  );
}
