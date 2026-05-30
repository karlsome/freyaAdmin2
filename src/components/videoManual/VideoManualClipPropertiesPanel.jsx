import { createShapeSvg, extractShapeStyle, getClipCategory, normalizeHexColor } from "./videoManualEditorUtils";

const FONT_OPTIONS = ["Work Sans", "Montserrat", "Open Sans", "Roboto", "Lato", "Merriweather", "Playfair Display", "Oswald"];
const FONT_WEIGHTS = [300, 400, 500, 600, 700, 800];
const TRANSITION_OPTIONS = ["", "fade", "zoom", "slideLeft", "slideRight", "slideUp", "slideDown", "carouselLeft", "carouselRight", "carouselUp", "carouselDown", "reveal", "wipeRight", "wipeLeft"];
const EFFECT_OPTIONS = ["", "zoomIn", "zoomOut", "slideLeft", "slideRight", "slideUp", "slideDown"];

function Icon({ children, className = "text-[16px]" }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>;
}

function staticNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function readScale(value) {
  return Array.isArray(value) ? staticNumber(value[0]?.from ?? value[0]?.to, 1) : staticNumber(value, 1);
}

function readOpacity(value) {
  return Array.isArray(value) ? staticNumber(value[0]?.from ?? value[0]?.to, 1) : staticNumber(value, 1);
}

function formatInputNumber(value, fallback = 0, decimals = 4) {
  const numericValue = staticNumber(value, fallback);
  return Number(numericValue.toFixed(decimals));
}

function Section({ title, children, action }) {
  return (
    <section className="border-t border-slate-200 pt-3 dark:border-slate-800">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-xs font-bold text-slate-950 dark:text-white">{title}</h4>
        {action}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="block space-y-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
      <span>{label}</span>
      {children}
    </label>
  );
}

const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
const colorInputClass = "h-9 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900";

function NumberField({ label, value, min, max, step = "0.1", onChange }) {
  return (
    <Field label={label}>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      />
    </Field>
  );
}

function SelectField({ label, value, options, onChange, emptyLabel = "None" }) {
  return (
    <Field label={label}>
      <select value={value || ""} onChange={(event) => onChange(event.target.value)} className={inputClass}>
        {options.map((option) => (
          <option key={option || "none"} value={option}>{option || emptyLabel}</option>
        ))}
      </select>
    </Field>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <Field label={label}>
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className={colorInputClass} />
    </Field>
  );
}

export default function VideoManualClipPropertiesPanel({
  selectedClip,
  onUpdateClip,
  onTrimClip,
  onDeleteClip,
  onOpenAnimationPanel,
}) {
  const clip = selectedClip?.clip || {};
  const asset = clip.asset || {};
  const category = getClipCategory(clip);
  const assetType = asset.type || "clip";
  const isText = category === "text";
  const isMedia = category === "media";
  const isShape = category === "shapes";
  const mediaKind = assetType === "audio" ? "Audio" : assetType === "image" ? "Image" : "Video";
  const title = isText ? "Selected Text" : isShape ? "Selected Shape" : `Selected ${mediaKind}`;
  const pill = isText ? "Text" : isShape ? "Shapes" : "Media";
  const canTrim = assetType === "video";

  const update = (updates, message) => onUpdateClip(updates, message);
  const updateNumber = (value, buildUpdate, message) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return;
    update(buildUpdate(numericValue), message);
  };

  const width = Math.max(1, Math.round(staticNumber(clip.width, assetType === "image" ? 400 : 600)));
  const height = Math.max(1, Math.round(staticNumber(clip.height, isText ? 150 : 300)));
  const start = formatInputNumber(clip.start, 0, 3);
  const length = Math.max(0.1, formatInputNumber(clip.length, 5, 3));
  const scale = formatInputNumber(readScale(clip.scale), 1, 3);
  const opacity = formatInputNumber(readOpacity(clip.opacity), 1, 2);
  const offset = clip.offset || {};
  const rotate = clip.transform?.rotate?.angle;
  const rotation = formatInputNumber(Array.isArray(rotate) ? rotate[0]?.from ?? rotate[0]?.to : rotate, 0, 2);
  const transitionIn = clip.transition?.in || "";
  const transitionOut = clip.transition?.out || "";
  const effect = clip.effect || "";

  const font = asset.font || {};
  const fontFamily = font.family || "Work Sans";
  const fontSize = Math.max(8, Math.round(staticNumber(font.size, 48)));
  const fontWeight = Math.max(100, Math.round(staticNumber(font.weight, 400)));
  const textColor = normalizeHexColor(font.color) || "#111111";
  const align = asset.align || asset.alignment || {};
  const background = asset.background || {};
  const stroke = asset.stroke || {};
  const textBackgroundColor = normalizeHexColor(background.color) || "#ffffff";
  const textBackgroundOpacity = formatInputNumber(background.opacity, 0, 2);
  const strokeColor = normalizeHexColor(stroke.color) || "#000000";
  const strokeWidth = Math.max(0, Math.round(staticNumber(stroke.width, 0)));

  const mediaVolume = Math.max(0, Math.min(1, formatInputNumber(asset.volume, 1, 2)));
  const mediaTrim = Math.max(0, formatInputNumber(asset.trim, 0, 3));
  const mediaCrop = asset.crop || {};

  const shapeStyle = extractShapeStyle(asset.src);
  const shapeFill = normalizeHexColor(shapeStyle.fill) || "#fecaca";
  const shapeStroke = normalizeHexColor(shapeStyle.stroke) || "#ef4444";
  const shapeStrokeWidth = Math.max(1, Math.round(staticNumber(shapeStyle.strokeWidth, 3)));

  const updateAsset = (assetUpdates, message) => {
    update({ asset: { ...asset, ...assetUpdates } }, message);
  };

  const updateTextFont = (fontUpdates, message) => {
    updateAsset({ font: { ...font, ...fontUpdates } }, message);
  };

  const updateTextBackground = (backgroundUpdates, message) => {
    updateAsset({ background: { ...background, ...backgroundUpdates } }, message);
  };

  const updateTextStroke = (strokeUpdates, message) => {
    updateAsset({ stroke: { ...stroke, ...strokeUpdates } }, message);
  };

  const updateShapeStyle = (styleUpdates) => {
    const nextStyle = { ...shapeStyle, ...styleUpdates };
    updateAsset({ src: createShapeSvg(nextStyle.shapeType || "rect", width, height, nextStyle) }, "Shape updated.");
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-3 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-950 dark:text-white">{title}</p>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Track {Number(selectedClip?.trackIndex ?? 0) + 1}</p>
          </div>
          <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {pill}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onTrimClip}
            disabled={!canTrim}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-slate-100 text-xs font-bold text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            title={canTrim ? "Split the selected video at the playhead" : "Trim is available for video clips"}
          >
            <Icon>content_cut</Icon>
            Trim
          </button>
          <button
            type="button"
            onClick={onDeleteClip}
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-red-50 text-xs font-bold text-red-600 transition hover:bg-red-100 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
          >
            <Icon>delete</Icon>
            Delete
          </button>
        </div>

        {isText ? (
          <>
            <Section title="Style">
              <Field label="Text">
                <textarea
                  rows={3}
                  value={asset.text || ""}
                  onChange={(event) => updateAsset({ text: event.target.value }, "Text updated.")}
                  className={`${inputClass} min-h-[74px] resize-y`}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <SelectField label="Font" value={fontFamily} options={FONT_OPTIONS} onChange={(value) => updateTextFont({ family: value }, "Font family updated.")} />
                <NumberField label="Font Size" min="8" step="1" value={fontSize} onChange={(value) => updateNumber(value, (number) => ({ asset: { ...asset, font: { ...font, size: Math.max(8, Math.round(number)) } } }), "Font size updated.")} />
                <SelectField label="Weight" value={String(fontWeight)} options={FONT_WEIGHTS.map(String)} onChange={(value) => updateTextFont({ weight: Number(value) }, "Font weight updated.")} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <SelectField label="Horizontal Align" value={align.horizontal || "center"} options={["left", "center", "right"]} onChange={(value) => updateAsset({ align: { ...align, horizontal: value } }, "Alignment updated.")} />
                <SelectField label="Vertical Align" value={align.vertical || "middle"} options={["top", "middle", "bottom"]} onChange={(value) => updateAsset({ align: { ...align, vertical: value } }, "Alignment updated.")} />
              </div>
              <NumberField label="Line Height" min="0.5" step="0.1" value={formatInputNumber(font.lineHeight, 1, 2)} onChange={(value) => updateNumber(value, (number) => ({ asset: { ...asset, font: { ...font, lineHeight: Math.max(0.5, Number(number.toFixed(2))) } } }), "Line height updated.")} />
            </Section>

            <Section title="Color">
              <ColorField label="Text Color" value={textColor} onChange={(value) => updateTextFont({ color: value }, "Text color updated.")} />
              <div className="grid grid-cols-2 gap-2">
                <ColorField label="Background" value={textBackgroundColor} onChange={(value) => updateTextBackground({ color: value }, "Background color updated.")} />
                <NumberField label="BG Opacity" min="0" max="1" step="0.05" value={textBackgroundOpacity} onChange={(value) => updateNumber(value, (number) => ({ asset: { ...asset, background: { ...background, opacity: Math.max(0, Math.min(1, Number(number.toFixed(2)))) } } }), "Background opacity updated.")} />
                <ColorField label="Stroke Color" value={strokeColor} onChange={(value) => updateTextStroke({ color: value }, "Stroke color updated.")} />
                <NumberField label="Stroke Width" min="0" step="1" value={strokeWidth} onChange={(value) => updateNumber(value, (number) => ({ asset: { ...asset, stroke: { ...stroke, width: Math.max(0, Math.round(number)) } } }), "Stroke width updated.")} />
              </div>
            </Section>
          </>
        ) : null}

        {isMedia ? (
          <Section title={mediaKind}>
            <div className="grid grid-cols-2 gap-2">
              {assetType === "video" ? (
                <NumberField label="Trim" min="0" step="0.1" value={mediaTrim} onChange={(value) => updateNumber(value, (number) => ({ asset: { ...asset, trim: Math.max(0, Number(number.toFixed(3))) } }), "Trim updated.")} />
              ) : null}
              {assetType === "video" || assetType === "audio" ? (
                <NumberField label="Volume" min="0" max="1" step="0.05" value={mediaVolume} onChange={(value) => updateNumber(value, (number) => ({ asset: { ...asset, volume: Math.max(0, Math.min(1, Number(number.toFixed(2)))) } }), "Volume updated.")} />
              ) : null}
            </div>
            {assetType === "video" || assetType === "audio" ? (
              <button
                type="button"
                onClick={() => updateAsset({ volume: mediaVolume > 0 ? 0 : 1 }, mediaVolume > 0 ? "Muted." : "Unmuted.")}
                className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold transition ${mediaVolume <= 0 ? "bg-cyan-500 text-white hover:bg-cyan-600" : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"}`}
              >
                <Icon className="text-[15px]">{mediaVolume <= 0 ? "volume_off" : "volume_up"}</Icon>
                {mediaVolume <= 0 ? "Unmute" : "Mute"}
              </button>
            ) : null}
          </Section>
        ) : null}

        {assetType === "video" ? (
          <Section title="Crop">
            <div className="grid grid-cols-2 gap-2">
              {["top", "right", "bottom", "left"].map((field) => (
                <NumberField
                  key={field}
                  label={field[0].toUpperCase() + field.slice(1)}
                  min="0"
                  max="1"
                  step="0.01"
                  value={formatInputNumber(mediaCrop[field], 0, 3)}
                  onChange={(value) => updateNumber(value, (number) => ({ asset: { ...asset, crop: { ...mediaCrop, [field]: Math.max(0, Math.min(1, Number(number.toFixed(3)))) } } }), "Crop updated.")}
                />
              ))}
            </div>
          </Section>
        ) : null}

        {isShape ? (
          <Section title="Shape">
            <div className="grid grid-cols-2 gap-2">
              <ColorField label="Fill" value={shapeFill} onChange={(value) => updateShapeStyle({ fill: value })} />
              <ColorField label="Stroke" value={shapeStroke} onChange={(value) => updateShapeStyle({ stroke: value })} />
            </div>
            <NumberField label="Stroke Width" min="1" step="1" value={shapeStrokeWidth} onChange={(value) => updateNumber(value, (number) => ({ asset: { ...asset, src: createShapeSvg(shapeStyle.shapeType || "rect", width, height, { ...shapeStyle, strokeWidth: Math.max(1, Math.round(number)) }) } }), "Shape updated.")} />
          </Section>
        ) : null}

        <Section title="Transform">
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Scale" min="0.05" step="0.05" value={scale} onChange={(value) => updateNumber(value, (number) => ({ scale: Math.max(0.05, Number(number.toFixed(3))) }), "Scale updated.")} />
            <NumberField label="Opacity" min="0" max="1" step="0.05" value={opacity} onChange={(value) => updateNumber(value, (number) => ({ opacity: Math.max(0, Math.min(1, Number(number.toFixed(2)))) }), "Opacity updated.")} />
            <NumberField label="X Position" min="-1" max="1" step="0.05" value={formatInputNumber(offset.x, 0, 4)} onChange={(value) => updateNumber(value, (number) => ({ offset: { ...offset, x: Number(number.toFixed(4)) } }), "X position updated.")} />
            <NumberField label="Y Position" min="-1" max="1" step="0.05" value={formatInputNumber(offset.y, 0, 4)} onChange={(value) => updateNumber(value, (number) => ({ offset: { ...offset, y: Number(number.toFixed(4)) } }), "Y position updated.")} />
          </div>
          <NumberField label="Rotation" min="-360" max="360" step="1" value={rotation} onChange={(value) => updateNumber(value, (number) => ({ transform: { ...(clip.transform || {}), rotate: { ...(clip.transform?.rotate || {}), angle: Number(number.toFixed(2)) } } }), "Rotation updated.")} />
        </Section>

        <Section title="Timing">
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Start" min="0" step="0.1" value={start} onChange={(value) => updateNumber(value, (number) => ({ start: Math.max(0, Number(number.toFixed(3))) }), "Start updated.")} />
            <NumberField label="Length" min="0.1" step="0.1" value={length} onChange={(value) => updateNumber(value, (number) => ({ length: Math.max(0.1, Number(number.toFixed(3))) }), "Length updated.")} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SelectField label="Transition In" value={transitionIn} options={TRANSITION_OPTIONS} onChange={(value) => update({ transition: value || transitionOut ? { ...(clip.transition || {}), in: value || undefined } : undefined }, "Transition updated.")} />
            <SelectField label="Transition Out" value={transitionOut} options={TRANSITION_OPTIONS} onChange={(value) => update({ transition: transitionIn || value ? { ...(clip.transition || {}), out: value || undefined } : undefined }, "Transition updated.")} />
          </div>
          <SelectField label="Effect" value={effect} options={EFFECT_OPTIONS} onChange={(value) => update({ effect: value || undefined }, "Effect updated.")} />
        </Section>

        <Section title="Size & Position">
          <div className="grid grid-cols-2 gap-2">
            <NumberField label="Width" min="1" step="1" value={width} onChange={(value) => updateNumber(value, (number) => ({ width: Math.max(1, Math.round(number)) }), "Width updated.")} />
            <NumberField label="Height" min="1" step="1" value={height} onChange={(value) => updateNumber(value, (number) => ({ height: Math.max(1, Math.round(number)) }), "Height updated.")} />
          </div>
        </Section>

        <Section
          title="Animation"
          action={(
            <button type="button" onClick={onOpenAnimationPanel} className="inline-flex h-7 items-center gap-1 rounded-full border border-slate-200 px-2.5 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              <Icon className="text-[14px]">show_chart</Icon>
              Animation
            </button>
          )}
        >
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            Use the Animation tab for presets and keyframe motion controls.
          </p>
        </Section>
      </div>
    </div>
  );
}