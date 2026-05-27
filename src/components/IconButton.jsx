const SIZE = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-10 w-10",
  xl: "h-11 w-11",
};

const ROUNDED = {
  "2xl": "rounded-2xl",
  xl: "rounded-xl",
  full: "rounded-full",
};

const VARIANT = {
  default:  "bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
  outlined: "border border-outline-variant/20 bg-white/80 text-on-surface hover:bg-surface-container dark:bg-surface-container",
  ghost:    "text-outline hover:bg-primary/10 hover:text-primary",
  light:    "bg-white/10 text-white hover:bg-white/20",
  danger:   "bg-error/10 text-error hover:bg-error/15",
};

export default function IconButton({
  icon,
  onClick,
  variant = "default",
  size = "lg",
  rounded = "2xl",
  disabled = false,
  type = "button",
  ariaLabel,
  title,
  iconSize,
  className,
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
      className={[
        "flex items-center justify-center transition",
        SIZE[size] ?? SIZE.lg,
        ROUNDED[rounded] ?? ROUNDED["2xl"],
        VARIANT[variant] ?? VARIANT.default,
        disabled && "cursor-not-allowed opacity-50",
        className,
      ].filter(Boolean).join(" ")}
    >
      <span
        className="material-symbols-outlined"
        style={iconSize ? { fontSize: iconSize } : undefined}
      >
        {icon}
      </span>
    </button>
  );
}
