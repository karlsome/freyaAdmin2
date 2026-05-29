import { useEffect, useRef } from "react";

const ADD_CATEGORIES = [
  { id: "text", label: "Text", icon: "text_fields" },
  { id: "shapes", label: "Shapes", icon: "select_all" },
  { id: "media", label: "Media", icon: "video_library" },
  { id: "animation", label: "Anim", icon: "show_chart" },
  { id: "background", label: "Background", icon: "palette" },
  { id: "advanced", label: "Advanced", icon: "settings" },
];

const BACKGROUND_COLORS = ["#FFFFFF", "#111827", "#F3F4F6", "#E0F2FE", "#DCFCE7", "#FEF3C7", "#FCE7F3", "#EDE9FE"];
const OUTPUT_PRESETS = [
  { label: "1920 x 1080", meta: "16:9", width: 1920, height: 1080 },
  { label: "1280 x 720", meta: "HD", width: 1280, height: 720 },
  { label: "1080 x 1920", meta: "Vertical", width: 1080, height: 1920 },
  { label: "1080 x 1080", meta: "Square", width: 1080, height: 1080 },
];
const FPS_OPTIONS = [24, 25, 30, 60];

function Icon({ children, className = "text-[24px]" }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function SectionTitle({ children, action }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <p className="text-xs font-black text-slate-500 dark:text-slate-400">{children}</p>
      {action}
    </div>
  );
}

function WideButton({ children, onClick, icon, trailingIcon = "arrow_forward", disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-between rounded-xl bg-slate-100 px-4 py-4 text-sm font-black text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
    >
      <span className="inline-flex min-w-0 items-center gap-2">
        {icon ? <Icon className="text-[18px]">{icon}</Icon> : null}
        <span className="truncate">{children}</span>
      </span>
      <Icon className="text-[18px] text-slate-400">{trailingIcon}</Icon>
    </button>
  );
}

function TileButton({ children, onClick, icon, preview }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-24 flex-col items-center justify-center gap-3 rounded-xl bg-slate-100 px-3 py-4 text-sm font-black text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
    >
      {preview || (icon ? <Icon className="text-[32px]">{icon}</Icon> : null)}
      <span className="text-center leading-tight">{children}</span>
    </button>
  );
}

function OptionButton({ children, meta, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-black transition ${
        active
          ? "border-cyan-500 bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200"
          : "border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      }`}
    >
      <span>{children}</span>
      {meta ? <span className="text-xs font-bold text-slate-400">{meta}</span> : null}
    </button>
  );
}

function renderCategoryIcon(category) {
  if (category.id !== "animation") return <Icon>{category.icon}</Icon>;

  return (
    <svg width="24" height="24" viewBox="0 0 20 20" aria-hidden="true" className="h-6 w-6">
      <path d="M3.5 13.5h3.3l2.1-3.5 2.4 2.2 3.7-7.1h1.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function VideoManualAddElementsSidebar({
  isOpen,
  activeCategory,
  selectedClip,
  outputSize,
  outputFps,
  backgroundColor,
  onClose,
  onSelectCategory,
  onAddText,
  onAddShape,
  onOpenAssetLibrary,
  onSetBackgroundColor,
  onSetOutputPreset,
  onSetOutputFps,
  onApplyAnimationPreset,
  onComingSoon,
}) {
  const shellRef = useRef(null);
  const activeMeta = ADD_CATEGORIES.find((category) => category.id === activeCategory) || ADD_CATEGORIES[0];

  useEffect(() => {
    if (!isOpen) return undefined;

    function handlePointerDown(event) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (shellRef.current?.contains(target)) return;

      if (target instanceof Element) {
        if (target.closest("[data-shotstack-studio]") || target.closest("[data-shotstack-timeline]")) return;
      }

      onClose();
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen, onClose]);

  const renderPanel = () => {
    if (activeCategory === "text") {
      return (
        <div className="space-y-5">
          <div>
            <SectionTitle>Text Presets</SectionTitle>
            <div className="grid gap-3">
              <button type="button" onClick={() => onAddText({ text: "Title", fontSize: 72, fontWeight: 600 })} className="rounded-xl bg-slate-100 px-5 py-5 text-left text-base font-black text-slate-800 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700">Headline Title</button>
              <button type="button" onClick={() => onAddText({ text: "Subtitle", fontSize: 44, fontWeight: 500 })} className="rounded-xl bg-slate-100 px-5 py-4 text-left text-base font-black text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">Subtitle</button>
              <button type="button" onClick={() => onAddText({ text: "Body text", fontSize: 36, fontWeight: 400 })} className="rounded-xl bg-slate-100 px-5 py-4 text-left text-base font-semibold text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Paragraph</button>
            </div>
          </div>

          <div>
            <SectionTitle action={<button type="button" onClick={() => onComingSoon("Custom fonts")} className="rounded-full bg-cyan-500 px-3 py-1 text-xs font-black text-white transition hover:bg-cyan-600">Upload</button>}>
              Fonts
            </SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => onAddText({ text: "Work Sans", fontFamily: "Work Sans", fontSize: 36, fontWeight: 500 })} className="rounded-xl bg-slate-100 px-3 py-7 text-center text-sm font-black text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">Work Sans</button>
              <button type="button" onClick={() => onComingSoon("More fonts")} className="rounded-xl bg-slate-100 px-3 py-7 text-center text-sm font-black text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">More Fonts</button>
            </div>
          </div>
        </div>
      );
    }

    if (activeCategory === "shapes") {
      return (
        <div>
          <SectionTitle>Shape Tools</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <TileButton onClick={() => onAddShape("rect")} preview={<div className="h-9 w-12 rounded border-2 border-slate-800 dark:border-white" />}>Rectangle</TileButton>
            <TileButton onClick={() => onAddShape("circle")} preview={<div className="h-11 w-11 rounded-full border-2 border-slate-800 dark:border-white" />}>Circle</TileButton>
            <TileButton onClick={() => onAddShape("arrow")} icon="call_made">Arrow</TileButton>
            <TileButton onClick={() => onAddShape("line")} preview={<div className="h-1 w-12 bg-slate-800 dark:bg-white" />}>Line</TileButton>
          </div>
        </div>
      );
    }

    if (activeCategory === "media") {
      return (
        <div>
          <SectionTitle>Playlist Media Library</SectionTitle>
          <div className="grid gap-3">
            <WideButton icon="image" onClick={() => onOpenAssetLibrary("image")}>Photos</WideButton>
            <WideButton icon="smart_display" onClick={() => onOpenAssetLibrary("video")}>Videos</WideButton>
            <WideButton icon="volume_up" onClick={() => onOpenAssetLibrary("audio")}>Audio</WideButton>
          </div>
        </div>
      );
    }

    if (activeCategory === "animation") {
      const disabled = !selectedClip;
      return (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Selected</p>
            <p className="mt-1 truncate text-sm font-black text-slate-700 dark:text-slate-100">{selectedClip?.clip?.asset?.type || "No clip selected"}</p>
          </div>
          <div className="grid gap-3">
            <WideButton icon="opacity" trailingIcon="add" onClick={() => onApplyAnimationPreset("fadeIn")} disabled={disabled}>Fade In</WideButton>
            <WideButton icon="blur_on" trailingIcon="add" onClick={() => onApplyAnimationPreset("fadeOut")} disabled={disabled}>Fade Out</WideButton>
            <WideButton icon="zoom_in_map" trailingIcon="add" onClick={() => onApplyAnimationPreset("zoomIn")} disabled={disabled}>Zoom In</WideButton>
            <WideButton icon="east" trailingIcon="add" onClick={() => onApplyAnimationPreset("slideLeft")} disabled={disabled}>Slide Left</WideButton>
            <WideButton icon="graphic_eq" trailingIcon="add" onClick={() => onApplyAnimationPreset("pulse")} disabled={disabled}>Pulse</WideButton>
          </div>
        </div>
      );
    }

    if (activeCategory === "background") {
      return (
        <div className="space-y-5">
          <div>
            <SectionTitle>Canvas Background</SectionTitle>
            <input
              type="color"
              value={backgroundColor || "#ffffff"}
              onChange={(event) => onSetBackgroundColor(event.target.value)}
              className="mb-3 h-12 w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900"
            />
            <div className="grid grid-cols-4 gap-2">
              {BACKGROUND_COLORS.map((color) => {
                const active = String(backgroundColor || "").toLowerCase() === color.toLowerCase();
                return (
                  <button
                    key={color}
                    type="button"
                    title={color}
                    onClick={() => onSetBackgroundColor(color)}
                    className={`flex h-10 items-center justify-center rounded-full border transition ${active ? "border-cyan-500 ring-2 ring-cyan-500/20" : "border-slate-300"}`}
                    style={{ backgroundColor: color }}
                  >
                    {active ? <Icon className={`text-[18px] ${color === "#111827" ? "text-white" : "text-cyan-600"}`}>check</Icon> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div>
          <SectionTitle>Resolution</SectionTitle>
          <div className="grid gap-3">
            {OUTPUT_PRESETS.map((preset) => (
              <OptionButton
                key={preset.label}
                meta={preset.meta}
                active={Number(outputSize?.width) === preset.width && Number(outputSize?.height) === preset.height}
                onClick={() => onSetOutputPreset(preset)}
              >
                {preset.label}
              </OptionButton>
            ))}
          </div>
        </div>
        <div>
          <SectionTitle>Frame Rate</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {FPS_OPTIONS.map((fps) => (
              <OptionButton key={fps} active={Number(outputFps) === fps} onClick={() => onSetOutputFps(fps)}>
                {fps} FPS
              </OptionButton>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <aside ref={shellRef} className="relative z-30 flex h-full flex-shrink-0 border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div
        className={`absolute right-full top-0 z-40 mr-3 flex h-full flex-col overflow-hidden border border-slate-200 bg-white shadow-[0_20px_60px_-35px_rgba(15,23,42,0.55)] transition-all duration-200 dark:border-slate-800 dark:bg-slate-950 ${
          isOpen ? "pointer-events-auto translate-x-0 opacity-100" : "pointer-events-none translate-x-3 opacity-0"
        }`}
        style={{ width: "min(330px, calc(100vw - 120px))" }}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 dark:border-slate-800">
          <span className="text-xs font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{activeMeta.label}</span>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white">
            <Icon className="text-[18px]">close</Icon>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{renderPanel()}</div>
      </div>

      <div className="flex w-[84px] flex-col items-center border-l border-slate-100 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900/80">
        <div className="w-full px-2 py-2 text-center text-[10px] font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Add</div>
        <div className="flex w-full flex-1 flex-col gap-2 overflow-y-auto pb-2">
          {ADD_CATEGORIES.map((category) => {
            const active = isOpen && activeCategory === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => onSelectCategory(category.id)}
                className={`flex min-h-[74px] w-full flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-center transition ${
                  active
                    ? "bg-cyan-500 text-white shadow-sm"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                }`}
              >
                {renderCategoryIcon(category)}
                <span className="max-w-full break-words text-[11px] font-black leading-tight">{category.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}