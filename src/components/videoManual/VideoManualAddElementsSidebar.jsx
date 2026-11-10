import { useLanguage } from "../../contexts/LanguageContext";
import { useEffect, useRef } from "react";
import VideoManualClipPropertiesPanel from "./VideoManualClipPropertiesPanel";
import VideoManualKeyframePanel from "./VideoManualKeyframePanel";
import { getClipCategory } from "./videoManualEditorUtils";

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

function Icon({ children, className = "text-[20px]" }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function useTx() {
  const { t } = useLanguage();
  return (node) => (typeof node === "string" ? t(node) : node);
}

function SectionTitle({ children, action }) {
  const tx = useTx();

  return (
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <p className="text-[11px] font-bold text-on-surface-variant">{tx(children)}</p>
      {action}
    </div>
  );
}

export const ELEMENT_DRAG_MIME = "application/x-vm-element";

function startElementDrag(event, payload) {
  event.dataTransfer.setData(ELEMENT_DRAG_MIME, JSON.stringify(payload));
  event.dataTransfer.effectAllowed = "copy";
}

function WideButton({ children, onClick, icon, trailingIcon = "arrow_forward", disabled = false }) {
  const tx = useTx();

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-between rounded-lg bg-surface-container px-3 py-2.5 text-xs font-bold text-on-surface transition hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="inline-flex min-w-0 items-center gap-2">
        {icon ? <Icon className="text-[16px]">{icon}</Icon> : null}
        <span className="truncate">{tx(children)}</span>
      </span>
      <Icon className="text-[16px] text-outline">{trailingIcon}</Icon>
    </button>
  );
}

function TileButton({ children, onClick, icon, preview, dragPayload }) {
  const tx = useTx();

  return (
    <button
      type="button"
      onClick={onClick}
      draggable={Boolean(dragPayload)}
      onDragStart={dragPayload ? (event) => startElementDrag(event, dragPayload) : undefined}
      className="flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-lg bg-surface-container px-2 py-3 text-xs font-bold text-on-surface transition hover:bg-surface-container-high"
    >
      {preview || (icon ? <Icon className="text-[26px]">{icon}</Icon> : null)}
      <span className="text-center leading-tight">{tx(children)}</span>
    </button>
  );
}

function OptionButton({ children, meta, active, onClick }) {
  const tx = useTx();

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-xs font-bold transition ${
        active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-transparent bg-surface-container text-on-surface hover:bg-surface-container-high"
      }`}
    >
      <span>{tx(children)}</span>
      {meta ? <span className="text-[11px] font-semibold text-outline">{tx(meta)}</span> : null}
    </button>
  );
}

function renderCategoryIcon(category) {
  if (category.id !== "animation") return <Icon>{category.icon}</Icon>;

  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5">
      <path d="M3.5 13.5h3.3l2.1-3.5 2.4 2.2 3.7-7.1h1.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function VideoManualAddElementsSidebar({
  isOpen,
  activeCategory,
  selectedClip,
  playbackTime,
  activeKeyframe,
  keyframeDraft,
  isKeyframeEditMode,
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
  onUpdateSelectedClip,
  onAddKeyframe,
  onEnterKeyframeEditMode,
  onRecordKeyframeEditMode,
  onCancelKeyframeEditMode,
  onDeleteKeyframe,
  onChangeKeyframeDraftValue,
  onApplyAnimationPreset,
  onComingSoon,
}) {
  const { t } = useLanguage();
  const shellRef = useRef(null);
  const activeMeta = ADD_CATEGORIES.find((category) => category.id === activeCategory) || ADD_CATEGORIES[0];
  const selectedCategory = getClipCategory(selectedClip?.clip);
  const showingProperties = !!selectedClip && !!selectedCategory && selectedCategory === activeCategory;
  const drawerTitle = showingProperties ? t("{name} Properties", { name: t(activeMeta.label) }) : t(activeMeta.label);

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
    if (showingProperties) {
      return (
        <VideoManualClipPropertiesPanel
          selectedClip={selectedClip}
          playbackTime={playbackTime}
          onUpdateClip={onUpdateSelectedClip}
          onOpenAnimationPanel={() => onSelectCategory("animation")}
          onAddKeyframe={onAddKeyframe}
        />
      );
    }

    if (activeCategory === "text") {
      return (
        <div className="space-y-4">
          <div>
            <SectionTitle>Text Presets</SectionTitle>
            <div className="grid gap-2">
              <button type="button" onClick={() => onAddText({ text: t("Title"), fontSize: 72, fontWeight: 600 })} draggable onDragStart={(event) => startElementDrag(event, { kind: "text", options: { text: t("Title"), fontSize: 72, fontWeight: 600 } })} className="rounded-lg bg-surface-container px-4 py-3 text-left text-sm font-bold text-on-surface transition hover:bg-surface-container-high">{t("Headline Title")}</button>
              <button type="button" onClick={() => onAddText({ text: t("Subtitle"), fontSize: 44, fontWeight: 500 })} draggable onDragStart={(event) => startElementDrag(event, { kind: "text", options: { text: t("Subtitle"), fontSize: 44, fontWeight: 500 } })} className="rounded-lg bg-surface-container px-4 py-3 text-left text-sm font-bold text-on-surface transition hover:bg-surface-container-high">{t("Subtitle")}</button>
              <button type="button" onClick={() => onAddText({ text: t("Body text"), fontSize: 36, fontWeight: 400 })} draggable onDragStart={(event) => startElementDrag(event, { kind: "text", options: { text: t("Body text"), fontSize: 36, fontWeight: 400 } })} className="rounded-lg bg-surface-container px-4 py-3 text-left text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container-high">{t("Paragraph")}</button>
            </div>
          </div>

          <div>
            <SectionTitle action={<button type="button" onClick={() => onComingSoon(t("Custom fonts"))} className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-on-primary transition hover:bg-primary/90">{t("Upload")}</button>}>
              Fonts
            </SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => onAddText({ text: "Work Sans", fontFamily: "Work Sans", fontSize: 36, fontWeight: 500 })} draggable onDragStart={(event) => startElementDrag(event, { kind: "text", options: { text: "Work Sans", fontFamily: "Work Sans", fontSize: 36, fontWeight: 500 } })} className="rounded-lg bg-surface-container px-3 py-4 text-center text-xs font-bold text-on-surface transition hover:bg-surface-container-high">Work Sans</button>
              <button type="button" onClick={() => onComingSoon(t("More fonts"))} className="rounded-lg bg-surface-container px-3 py-4 text-center text-xs font-bold text-on-surface transition hover:bg-surface-container-high">{t("More Fonts")}</button>
            </div>
          </div>
        </div>
      );
    }

    if (activeCategory === "shapes") {
      return (
        <div>
          <SectionTitle>Shape Tools</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <TileButton dragPayload={{ kind: "shape", shapeType: "rect" }} onClick={() => onAddShape("rect")} preview={<div className="h-9 w-12 rounded border-2 border-slate-800" />}>Rectangle</TileButton>
            <TileButton dragPayload={{ kind: "shape", shapeType: "circle" }} onClick={() => onAddShape("circle")} preview={<div className="h-11 w-11 rounded-full border-2 border-slate-800" />}>Circle</TileButton>
            <TileButton dragPayload={{ kind: "shape", shapeType: "arrow" }} onClick={() => onAddShape("arrow")} icon="call_made">Arrow</TileButton>
            <TileButton dragPayload={{ kind: "shape", shapeType: "line" }} onClick={() => onAddShape("line")} preview={<div className="h-1 w-12 bg-slate-800" />}>Line</TileButton>
          </div>
        </div>
      );
    }

    if (activeCategory === "media") {
      return (
        <div>
          <SectionTitle>Playlist Media Library</SectionTitle>
          <div className="grid gap-2">
            <WideButton icon="image" onClick={() => onOpenAssetLibrary("image")}>Photos</WideButton>
            <WideButton icon="smart_display" onClick={() => onOpenAssetLibrary("video")}>Videos</WideButton>
            <WideButton icon="volume_up" onClick={() => onOpenAssetLibrary("audio")}>Audio</WideButton>
          </div>
        </div>
      );
    }

    if (activeCategory === "animation") {
      return (
        <VideoManualKeyframePanel
          selectedClip={selectedClip}
          playbackTime={playbackTime}
          activeKeyframe={activeKeyframe}
          keyframeDraft={keyframeDraft}
          isKeyframeEditMode={isKeyframeEditMode}
          onAddKeyframe={onAddKeyframe}
          onEnterEditMode={onEnterKeyframeEditMode}
          onRecordEditMode={onRecordKeyframeEditMode}
          onCancelEditMode={onCancelKeyframeEditMode}
          onDeleteKeyframe={onDeleteKeyframe}
          onChangeDraftValue={onChangeKeyframeDraftValue}
          onApplyAnimationPreset={onApplyAnimationPreset}
        />
      );
    }

    if (activeCategory === "background") {
      return (
        <div className="space-y-4">
          <div>
            <SectionTitle>Canvas Background</SectionTitle>
            <input
              type="color"
              value={backgroundColor || "#ffffff"}
              onChange={(event) => onSetBackgroundColor(event.target.value)}
              className="mb-2 h-9 w-full cursor-pointer rounded-lg border border-separator bg-surface p-1"
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
                    className={`flex h-8 items-center justify-center rounded-full border transition ${active ? "border-primary/30 ring-2 ring-primary/30" : "border-separator"}`}
                    style={{ backgroundColor: color }}
                  >
                    {active ? <Icon className={`text-[18px] ${color === "#111827" ? "text-white" : "text-primary"}`}>check</Icon> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div>
          <SectionTitle>Resolution</SectionTitle>
          <div className="grid gap-2">
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
          <div className="grid grid-cols-2 gap-2">
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
    <aside ref={shellRef} className="relative z-30 flex h-full flex-shrink-0 border-l border-separator bg-surface">
      <div
        className={`absolute right-full top-0 z-40 mr-2 flex h-full flex-col overflow-hidden border border-separator bg-surface shadow-[0_20px_55px_-35px_rgba(15,23,42,0.55)] transition-all duration-200 ${
          isOpen ? "pointer-events-auto translate-x-0 opacity-100" : "pointer-events-none translate-x-3 opacity-0"
        }`}
        style={{ width: "min(300px, calc(100vw - 96px))" }}
      >
        <div className="flex items-center justify-between border-b border-separator px-3 py-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">{drawerTitle}</span>
          <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-outline transition hover:bg-surface-container-high hover:text-on-surface">
            <Icon className="text-[16px]">close</Icon>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">{renderPanel()}</div>
      </div>

      <div className="flex w-[72px] flex-col items-center border-l border-separator bg-surface-container-low p-1.5">
        <div className="w-full px-1 py-1.5 text-center text-[9px] font-bold uppercase tracking-[0.22em] text-on-surface-variant">{t("Add")}</div>
        <div className="flex w-full flex-1 flex-col gap-1.5 overflow-y-auto pb-1.5">
          {ADD_CATEGORIES.map((category) => {
            const active = isOpen && activeCategory === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => onSelectCategory(category.id)}
                className={`flex min-h-[58px] w-full flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-center transition ${
                  active
                    ? "bg-primary text-on-primary shadow-sm"
                    : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                }`}
              >
                {renderCategoryIcon(category)}
                <span className="max-w-full break-words text-[10px] font-bold leading-[1.05]">{t(category.label)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}