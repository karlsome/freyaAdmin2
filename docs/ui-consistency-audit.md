# UI Consistency Audit & Design System Reference

**Last updated:** 2026-05-28  
**Branch:** claude/freya-admin-light-mode-KQgcx  
**Scope:** Full codebase — light mode neutralization + complete spacing and modal UI audit applied.

---

## How to use this document

This is the single source of truth for all visual decisions. Before creating a new component:

1. Find the element type in the sections below.
2. Copy the exact class string — do not guess.
3. Do not introduce fractional Tailwind values (`gap-2.5`, `py-3.5`, `px-3.5`, `mb-1.5`) anywhere except where explicitly listed as allowed.

---

## 1. Spacing System

All spacing follows an **8px grid**. Only these values are permitted:

| Token | px | Use |
|---|---|---|
| `gap-1` / `space-y-1` | 4px | Minimum separation between tightly-related items (table rows) |
| `gap-2` / `space-y-2` | 8px | Tags, inline badges, tight lists |
| `gap-3` / `space-y-3` | 12px | Card field grids, compact item lists |
| `gap-4` / `space-y-4` | 16px | Standard grid gaps, section inner spacing |
| `gap-5` / `space-y-5` | 20px | Major section gaps |
| `gap-6` / `space-y-6` | 24px | Between top-level page sections |

**Forbidden fractional values:** `gap-0.5`, `gap-1.5`, `gap-2.5`, `gap-3.5`, `space-y-0.5`, `space-y-1.5`, `space-y-2.5`, `space-y-3.5`

**Asymmetric gaps are forbidden.** Never use `gap-x-N gap-y-M` where N ≠ M. Use a single `gap-N` instead.

---

## 2. Padding Reference

### Modal chrome

| Zone | Class |
|---|---|
| Header | `px-6 py-5` |
| Body / scroll area | `px-6 py-5` |
| Footer / action bar | `px-6 py-4` |
| Sidebar panel | `px-6 py-5` |

> No conditional responsive overrides inside modals (`sm:px-6`, `lg:px-6`). Modals use `px-6` unconditionally.

### Cards

| Type | Class | Use when |
|---|---|---|
| Major section card | `p-5` | Top-level dashboard sections, large standalone cards |
| Standard card | `p-4` | KPI stat cards, general content cards |
| Compact field card | `px-4 py-3` | Label + value pairs, detail fields, list item cards |
| Inline item row | `px-3 py-3` | Table cells, form inputs inside cards |

### Buttons

| Type | Class |
|---|---|
| Standard action button | `px-4 py-2` |
| Sized button (with icon) | `h-10 px-4` |
| Ghost / icon-only | `p-2` |
| Small badge-button (`text-xs`) | `px-3 py-1` (tags, rounded-full) |

> Never use `px-3.5`, `py-2.5`, or `py-3.5` on buttons.

### Table cells (DataTable and all embedded tables)

| Zone | Class |
|---|---|
| Header `<th>` | `px-3 py-3` |
| Body `<td>` | `px-3 py-3` |

> Applies to both the main `DataTable` component and any ad-hoc tables inside modals.

### Dashboard row items

| Component | Row padding | List spacing | Notes |
|---|---|---|---|
| Issues feed items | `p-3` | `space-y-2.5` | Tag row gap: `gap-2`; item header mb: `mb-2` |
| Recent submissions rows | `px-3 py-3` | `space-y-2` | Row header gap: `gap-2` |
| Factory table header | `px-3 py-3` | — | Header-to-rows margin: `mb-2` |
| Factory table rows | `px-3 py-3` | `space-y-1` | — |
| Factory mobile cards | `p-4` | `space-y-3` | Inner stat grid: `gap-3` |
| KPI strip section label | — | — | `mb-3` above each grid; section gap: `gap-2` |
| StatSummaryCard | `p-4` | — | Icon-to-content gap: `gap-3` |

---

## 3. Border Radius Scale

| Value | Use |
|---|---|
| `rounded-full` | Status dots, pill badges, avatar circles |
| `rounded-md` | Tiny inline chips, process label badges |
| `rounded-lg` | Section header icon badges (`w-8 h-8`) |
| `rounded-xl` | Buttons, input fields, table rows, loading skeletons, small cards |
| `rounded-2xl` | Cards, modals, panels, stat cards, field containers |

> **Rule of thumb:** If it contains data, use `rounded-2xl`. If it's a control (button, input), use `rounded-xl`. If it's a pill/tag, use `rounded-full`.

---

## 4. Typography Scale

| Role | Class |
|---|---|
| Page title | `text-2xl sm:text-3xl font-black tracking-tight text-on-surface` |
| Modal title | `text-xl font-black text-on-surface` |
| Section heading | `text-sm font-bold text-on-surface` |
| KPI / big number | `text-2xl font-black text-on-surface leading-none tracking-tight` |
| Body / cell value | `text-sm font-semibold text-on-surface` |
| Secondary body | `text-sm font-medium text-on-surface-variant` |
| Small label (field name) | `text-[10px] font-bold uppercase tracking-[0.18em] text-outline` |
| Section eyebrow | `text-[10px] font-bold uppercase tracking-[0.22em] text-outline` |
| Caption / hint | `text-[11px] text-outline` |
| Timestamp / meta | `text-[10px] text-outline` |
| Monospace value | `font-mono text-xs text-on-surface-variant` |

**Font weight usage:**
- `font-black` — numbers the user needs to read instantly (KPIs, totals)
- `font-bold` — headings, labels, status values
- `font-semibold` — body data values, names
- `font-medium` — secondary body, descriptions
- No `font-normal` or `font-light` in data contexts

**Do not create intermediate sizes between `text-[10px]` and `text-xs` (12px).** The 11px tier exists only for captions/hints, not for data values.

---

## 5. Color Tokens

### Light mode surfaces (neutral — no purple tint)

```css
--c-background:               255 255 255;   /* page background */
--c-surface:                  255 255 255;   /* base card surface */
--c-surface-container:        248 249 250;   /* subtle container */
--c-surface-container-lowest: 255 255 255;   /* deepest white layer */
--c-surface-container-low:    246 247 248;   /* field card backgrounds */
--c-surface-container-high:   237 238 240;   /* elevated panels, table headers */
--c-surface-container-highest:228 229 232;   /* highest elevation */
```

> These were neutralized from their original lavender-tinted values. Do not reintroduce purple-biased RGB values (`244 243 249`, `236 233 244`, `228 225 233`) for light mode surfaces.

### Text hierarchy

| Token | Light mode RGB | Use |
|---|---|---|
| `text-on-surface` | `17 17 22` | Primary text, values |
| `text-on-surface-variant` | `54 54 66` | Secondary text |
| `text-outline` | `96 96 110` | Labels, hints, captions |
| `text-outline-variant` | `205 207 216` | Decorative borders only |

### Semantic / status colors

| State | Text | Background | Border |
|---|---|---|---|
| Error / NG | `text-error` | `bg-error/10` | `border-error/25` |
| Warning / Trouble | `text-amber-500` | `bg-amber-500/10` | `border-amber-500/25` |
| Success / OK | `text-emerald-500` | `bg-emerald-500/10` | `border-emerald-500/25` |
| Info / primary | `text-primary` | `bg-primary/10` | `border-primary/25` |

### Borders and separators

| Usage | Class |
|---|---|
| Structural section dividers | `border-separator/30` |
| Card / container outlines | `border-separator/40` to `border-separator/50` |
| Subtle field borders | `border-outline-variant/15` |
| Hover accent | `hover:border-primary/30` |
| Error border | `border-error/25` |
| Warning border | `border-amber-500/25` |

> **Never use `border-white/5`, `border-white/10`, `border-white/20`** for structural borders — they are invisible on light backgrounds.

---

## 6. Card / Panel Hierarchy

Two CSS classes define the elevation system. Choosing the wrong one is the most common mistake.

| Level | Class | Use when |
|---|---|---|
| **Top-level section** | `.dashboard-section rounded-2xl` | Page sections, modal containers, primary workspace panels (sits directly on page background or modal backdrop) |
| **Nested card** | `.glass-card rounded-2xl` | Cards *inside* a section — stat cards, NodaModalFrame, inner panels |

`.dashboard-section` in **light mode:**
```css
background: rgba(252, 253, 253, 0.94);   /* neutral white — no purple tint */
backdrop-filter: blur(14px) saturate(1.4);
border: 1px solid rgba(198, 200, 214, 0.70);
```

`.glass-card` in **light mode:**
```css
background: rgba(252, 253, 253, 0.90);   /* neutral white — no purple tint */
backdrop-filter: blur(14px) saturate(1.4);
border: 1px solid rgba(205, 207, 216, 0.60);
```

> Dark mode values for both classes are unchanged — do not touch them.

---

## 7. Modal Structure Template

```jsx
{/* Backdrop */}
<div className="fixed inset-0 z-50 flex items-center justify-center p-4
                bg-black/40 backdrop-blur-sm">

  {/* Container */}
  <div className="dashboard-section rounded-2xl w-full max-w-2xl
                  max-h-[92vh] flex flex-col overflow-hidden"
       onClick={e => e.stopPropagation()}>

    {/* Header — always sticky */}
    <div className="sticky top-0 z-10 rounded-t-2xl px-6 py-5
                    flex items-center justify-between
                    border-b border-separator/40 bg-surface/90 backdrop-blur-md">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-outline">Eyebrow</p>
        <h2 className="mt-1 text-xl font-black text-on-surface">Modal Title</h2>
      </div>
      <button className="p-2 rounded-xl hover:bg-surface-container text-outline
                         hover:text-on-surface transition-all duration-150">
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
      </button>
    </div>

    {/* Scrollable body */}
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-4">
      ...
    </div>

    {/* Footer (optional) */}
    <div className="border-t border-outline-variant/20 px-6 py-4
                    bg-surface-container-low/50 flex items-center justify-end gap-3">
      ...
    </div>

  </div>
</div>
```

---

## 8. Modal Size Variants

Choose the modal width based on content complexity, not preference. Never pick a larger size just to "have more room."

| Tailwind class | ~Width | When to use |
|---|---|---|
| `max-w-md` | 448 px | Destructive confirms, single-input prompts, simple warnings |
| `max-w-2xl` | 672 px | Quick-edit forms (2–4 fields), compact detail views |
| `max-w-3xl` | 768 px | Standard detail modals (4–8 fields, no sidebar) |
| `max-w-5xl` | 1024 px | Full record detail with image or embedded table |
| `max-w-6xl` | 1152 px | Workspace modals with a sidebar (NodaDetailModal, CheckFormBuilderModal) |
| `max-w-7xl` | 1280 px | Bulk-edit, PDF tools, or full data-entry workspaces |

**Max height:** Always `max-h-[92vh]` — never set a fixed pixel height on a modal.

**Width responsiveness:** Modals always have `w-full` so they collapse correctly on small screens. Never add horizontal padding to the backdrop below `p-4`.

---

## 9. Modal Typography Rules

Modal typography is more constrained than page-level typography. Follow this table exactly.

| Role | Class | Notes |
|---|---|---|
| Eyebrow (above title) | `text-[10px] font-bold uppercase tracking-[0.22em] text-outline` | One line only; identifies module/record type |
| Modal title | `text-xl font-black text-on-surface` | Standard for `max-w-3xl` and up |
| Modal title (extra-large) | `text-2xl font-black text-on-surface` | Only for `max-w-6xl` / `max-w-7xl` workspace modals |
| Subtitle / supporting line | `text-sm text-on-surface-variant` | Immediately below title; concise summary |
| Section heading (inside body) | `text-[10px] font-bold uppercase tracking-[0.18em] text-outline` | Marks a logical group of fields |
| Field label | `text-[10px] font-bold uppercase tracking-[0.18em] text-outline` | Same class as section heading — do not invent alternatives |
| Field value (primary) | `text-sm font-semibold text-on-surface` | The main readable datum |
| Field value (secondary) | `text-sm font-medium text-on-surface-variant` | Supporting or contextual data |
| Caption / hint | `text-[11px] text-outline` | Usage tips, metadata under a value |
| Timestamp / ID | `text-xs font-mono text-on-surface-variant` | Raw IDs, timestamps, record numbers |
| Paragraph body | `text-sm text-on-surface-variant leading-relaxed` | Multi-sentence descriptions, instructions |
| Stats strip value | `text-xl sm:text-2xl font-black leading-none text-on-surface` | Large KPI numbers in header strip |
| Stats strip label | `text-[10px] font-bold uppercase tracking-[0.18em] text-outline` | Below the KPI number |
| Stats strip sub-label | `text-[10px] text-outline` | Optional third line (unit, qualifier) |

**Tracking rule:** `tracking-[0.22em]` is reserved for eyebrows only. All other ALL CAPS labels use `tracking-[0.18em]`. Do not use `tracking-wider` or `tracking-widest` inside modals.

**Weight rule:** `font-black` appears only on modal titles and KPI numbers — nowhere else inside the modal body.

---

## 10. Modal Internal Spacing

### Vertical rhythm

| Gap | Value | Where |
|---|---|---|
| Eyebrow → Title | `mt-1` | In the header block |
| Title → Subtitle | `mt-1` | In the header block |
| Between field label and value | `mt-1` | Inside a field card |
| Between sibling field cards | `gap-3` | In a `grid` layout |
| Between fields in a `space-y` list | `space-y-4` | Standard section body |
| Between major sections | `mb-5` or `space-y-5` | Separating thematic blocks |
| After a section heading (label row) | `mb-3` | Before the field grid |
| List of compact items | `space-y-3` | Goal lists, step lists |
| Tightly-related items (table rows) | `space-y-1` or `space-y-2` | Dense data rows |

### Section container sizing

| Content type | Padding |
|---|---|
| Section container (holds fields) | `px-4 py-4` |
| Single field card (label + value) | `px-4 py-3` |
| Inline row inside a container | `px-3 py-3` |
| Warning / alert box | `px-4 py-4` |

**No fractional spacing inside modals.** Every padding and gap value must be a whole number on the Tailwind scale: `1`, `2`, `3`, `4`, `5`, `6`.

---

## 11. Modal Divider Hierarchy

Three opacity tiers — use the lighter tier for finer distinctions.

| Divider position | Class |
|---|---|
| Header bottom border | `border-b border-separator/40` |
| Section-to-section divider (inside body) | `border-b border-separator/35` |
| Item-to-item divider (inside a list) | `border-b border-separator/30` |
| Footer top border | `border-t border-outline-variant/20` |

Never use `border-separator/50` or higher inside a modal body — that weight belongs on page-level containers.

---

## 12. Modal Stats Strip

A row of at-a-glance KPIs shown just below the modal header (before the scrollable body). Used in record detail modals.

```jsx
<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-4
                border-b border-separator/35 bg-surface-container-low/40">
  <div className="rounded-xl px-3 py-3 text-center border border-separator/30 bg-surface-container/50">
    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline mb-1">Processed</p>
    <p className="text-xl sm:text-2xl font-black leading-none text-on-surface">1,240</p>
    <p className="text-[10px] text-outline mt-1">units</p>
  </div>
  {/* ... more cells */}
</div>
```

Rules:
- Grid is `grid-cols-2 sm:grid-cols-4` — never single-column or 3-column
- Each cell: `rounded-xl px-3 py-3 text-center border border-separator/30`
- Value: `text-xl sm:text-2xl font-black leading-none`
- Status-colored values: use `text-error`, `text-amber-500`, `text-emerald-500` — not custom colors
- The strip sits *outside* the scrollable body — it stays pinned below the header

---

## 13. Field Cards (label + value pairs)

Standard pattern for displaying a named data field. Used in detail modals, drawers, and sidebar panels.

```jsx
{/* Single field card */}
<div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
  <div className="flex items-center gap-2 text-outline">
    <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>icon_name</span>
    <span className="text-[10px] font-bold uppercase tracking-[0.18em]">Label</span>
  </div>
  <p className="mt-2 text-sm font-semibold text-on-surface">Value</p>
</div>

{/* Section container card (wraps multiple fields) */}
<div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-4">
  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline mb-3">Section Name</p>
  <div className="grid grid-cols-2 gap-3">
    {/* ...field cards... */}
  </div>
</div>
```

Rules:
- Field card always uses `rounded-2xl` — never `rounded-xl`
- Label row uses `gap-2` between icon and text — never `gap-1` or `gap-3`
- Icon inside field card label: `style={{ fontSize: 16 }}` — not 18 or 20
- `mt-2` between label row and value (not `mt-1`) when an icon is present
- `mt-1` between label text only (no icon) and value

---

## 14. Semantic Alert Boxes

Used for warnings, errors, confirmations, and info inside modal bodies.

```jsx
{/* Error / destructive */}
<div className="rounded-2xl border border-error/20 bg-error/10 px-4 py-4 flex gap-3">
  <span className="material-symbols-outlined text-error flex-shrink-0" style={{ fontSize: 18 }}>report</span>
  <div>
    <p className="text-sm font-bold text-on-surface">Heading</p>
    <p className="text-xs text-on-surface-variant mt-1">Detail message explaining the issue.</p>
  </div>
</div>

{/* Warning */}
<div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4 flex gap-3">
  <span className="material-symbols-outlined text-amber-500 flex-shrink-0" style={{ fontSize: 18 }}>warning</span>
  ...
</div>

{/* Success */}
<div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 flex gap-3">
  <span className="material-symbols-outlined text-emerald-500 flex-shrink-0" style={{ fontSize: 18 }}>check_circle</span>
  ...
</div>

{/* Info */}
<div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-4 flex gap-3">
  <span className="material-symbols-outlined text-primary flex-shrink-0" style={{ fontSize: 18 }}>info</span>
  ...
</div>
```

Rules:
- Always `rounded-2xl` — never `rounded-xl` for alert boxes
- Icon and text column layout: `flex gap-3`, icon `flex-shrink-0`
- Heading: `text-sm font-bold text-on-surface`
- Body: `text-xs text-on-surface-variant mt-1`
- Never use `font-black` or `text-base` in alert boxes

---

## 15. Modal Image Display

Images displayed inside modals (e.g., product photos, PDF previews, QR codes).

```jsx
{/* Standard image container */}
<div className="rounded-2xl overflow-hidden border border-separator/30 bg-surface-container">
  <img src={url} alt={altText} className="w-full object-contain" />
</div>

{/* With caption */}
<div className="rounded-2xl overflow-hidden border border-separator/30 bg-surface-container">
  <img src={url} alt={altText} className="w-full object-contain" />
  <p className="text-[11px] text-outline text-center px-3 py-2 border-t border-separator/20">{caption}</p>
</div>

{/* Thumbnail grid (multiple images) */}
<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
  {images.map(img => (
    <div key={img.id} className="rounded-xl overflow-hidden border border-separator/30 aspect-square bg-surface-container">
      <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
    </div>
  ))}
</div>
```

Rules:
- Single image container: `rounded-2xl`
- Thumbnail: `rounded-xl` (smaller context, `aspect-square` for consistency)
- Background behind the image: always `bg-surface-container` (not transparent)
- No drop shadow on images — only the border distinguishes them

---

## 16. Modal Sidebar Layout

Large modals (`max-w-6xl` / `max-w-7xl`) may have a fixed right sidebar for metadata, controls, or navigation.

```jsx
<div className="flex flex-1 min-h-0 overflow-hidden">

  {/* Main scrollable content */}
  <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
    ...
  </div>

  {/* Right sidebar */}
  <div className="w-72 flex-shrink-0 border-l border-separator/30
                  overflow-y-auto px-6 py-5 space-y-4
                  bg-surface-container-low/30">
    ...
  </div>

</div>
```

Rules:
- Sidebar width: `w-72` (288 px). Never use `w-64` or `w-80` unless there is a clear layout reason.
- Sidebar uses its own `overflow-y-auto` — it scrolls independently from the main content.
- Separator: `border-l border-separator/30` — same lighter tier as item dividers.
- Sidebar padding is identical to main body: `px-6 py-5`.
- On small screens (`< lg`) the sidebar collapses or stacks below — implement with `hidden lg:flex` on the sidebar, or a tab pattern.

---

## 17. Modal Action Buttons

Action buttons live in the modal footer. Footer layout and button conventions:

```jsx
{/* Footer */}
<div className="border-t border-outline-variant/20 px-6 py-4
                bg-surface-container-low/50 flex items-center justify-end gap-3">

  {/* Cancel / Close — always leftmost of the pair */}
  <button className="rounded-xl border border-separator/50 px-4 py-2
                     text-xs font-bold text-on-surface-variant
                     hover:bg-surface-container hover:text-primary hover:border-primary/30
                     active:scale-95 transition-all duration-150">
    Cancel
  </button>

  {/* Primary action */}
  <button className="rounded-xl bg-primary px-4 py-2
                     text-xs font-bold text-on-primary
                     hover:opacity-90 active:scale-95 transition-all duration-150">
    Save
  </button>

  {/* Destructive action */}
  <button className="rounded-xl bg-error px-4 py-2
                     text-xs font-bold text-on-error
                     hover:opacity-90 active:scale-95 transition-all duration-150">
    Delete
  </button>

</div>
```

Rules:
- Button padding: `px-4 py-2` always — never `px-5`, `py-3`, `px-6`
- Font size: `text-xs font-bold` — never `text-sm` in footer buttons
- Gap between buttons: `gap-3` — never `gap-2` or `gap-4`
- Order (left to right): Cancel → Secondary → Primary / Destructive
- `active:scale-95` is required on all footer buttons
- For prominent CTA inside the *body* (not footer), use `py-2.5` and `text-sm` — this is the only sanctioned exception to the `py-2` rule

---

## 18. Status / Property Chips Inside Fields

Inline tags and chips that appear as values within field cards or record rows.

```jsx
{/* Status tag (inside IssuesFeed, field cards, etc.) */}
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                 text-[10px] font-bold
                 bg-error/12 text-error border border-error/20">
  <span className="material-symbols-outlined" style={{ fontSize: 11 }}>report</span>
  2.5% NG
</span>

{/* Process label chip */}
<span className="text-[10px] text-outline bg-surface-container px-1.5 py-0.5 rounded-md">
  Kensa
</span>

{/* Approval status chip */}
<span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full
                 text-[10px] font-bold
                 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
  <span className="material-symbols-outlined" style={{ fontSize: 11 }}>check_circle</span>
  Approved
</span>
```

Rules:
- Icon inside a chip: `style={{ fontSize: 11 }}` — always 11 px, never larger
- Chip gap: `gap-1` between icon and text
- Pill shape: `rounded-full` — never `rounded-xl` for inline tags
- Small process labels that are not interactive: `rounded-md` (no border, no icon)
- Opacity tiers: background `/{10 or 12}`, border `/{20}` — keep them paired

---

## 19. Section Header Pattern

Use this pattern for every panel/section title — dashboard pages, modals, and drawers.

```jsx
<div className="flex items-center gap-2 mb-1">
  <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
    <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>icon_name</span>
  </span>
  <h3 className="text-sm font-bold text-on-surface">Section Title</h3>
  {/* Optional right-side count */}
  <span className="ml-auto text-[10px] text-outline">N items</span>
</div>
<p className="text-[11px] text-outline mb-4 ml-10">Supporting description indented under icon</p>
```

Rules:
- Icon badge: `w-8 h-8 rounded-lg` — not `rounded-xl` or `rounded-2xl`
- Icon size: `style={{ fontSize: 18 }}` — always 18 px for section header icons
- Heading: `text-sm font-bold` — not `text-base` or `text-xs`
- `mb-1` after the header row, then `mb-4` after the subtitle — these keep spacing even
- For error-state sections: swap `bg-primary/10 text-primary` → `bg-error/10 text-error`
- Count badge (right): `ml-auto text-[10px] text-outline` (plain text) or `ml-auto px-2.5 py-1 rounded-full bg-error/12 text-error text-[11px] font-black border border-error/20` (colored pill for issue counts)

---

## 20. Icon Containers

| Context | Size | Shape | Background |
|---|---|---|---|
| KPI / stat card icon | `w-10 h-10 rounded-xl` | Rounded square | `bg-{accent}/10` |
| Section header icon badge | `w-8 h-8 rounded-lg` | Square | `bg-primary/10` or status color |
| Status dot / process dot | `w-2 h-2 rounded-full` (or `w-2.5 h-2.5`) | Circle | Solid accent |
| Empty state icon | `w-14 h-14 rounded-2xl` | Large card | `bg-{color}/8` |

---

## 21. Button Standards

**Primary action:**
```jsx
<button className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary
                   hover:opacity-90 active:scale-95 transition-all duration-150">
```

**Secondary / outlined:**
```jsx
<button className="rounded-xl border border-separator/50 px-4 py-2 text-xs font-bold
                   text-on-surface-variant hover:bg-surface-container hover:text-primary
                   hover:border-primary/30 active:scale-95 transition-all duration-150">
```

**Sized button with icon (`h-10`):**
```jsx
<button className="inline-flex h-10 items-center gap-2 rounded-2xl border
                   border-outline-variant/30 px-4 text-sm font-bold text-on-surface
                   transition hover:bg-surface-container">
```

**Ghost / icon-only:**
```jsx
<button className="p-2 rounded-xl text-outline hover:bg-surface-container
                   hover:text-on-surface transition-all duration-150">
```

Rules:
- `active:scale-95` is required on all primary and secondary buttons
- `transition-all duration-150` is the standard transition — not `transition-colors`, not `duration-200`
- Never `px-3.5`, `py-2.5`, or `py-3.5`

---

## 22. Interactive Rows (clickable list items)

```jsx
{/* Standard list row */}
<button className="w-full text-left px-3 py-3 rounded-xl
                   bg-surface-container/45 border border-separator/35
                   hover:bg-surface-container hover:border-primary/30 hover:shadow-sm
                   transition-all duration-150 group">

{/* Row with left-border status accent */}
<button className="w-full text-left p-3 rounded-xl border
                   bg-surface-container/50 hover:bg-surface-container
                   border-error/25 shadow-[inset_3px_0_0_rgb(var(--c-error))]
                   transition-all duration-150">

{/* Table-style row (desktop factory table) */}
<button className="w-full grid ... gap-3 items-center px-3 py-3 rounded-xl
                   border border-transparent text-left
                   hover:bg-primary/8 hover:border-primary/15
                   hover:shadow-[inset_3px_0_0_rgb(var(--c-primary))]
                   transition-all duration-150 group">
```

---

## 23. Field Cards — Page Context (label + value pairs)

> For field cards inside modals (with icon in label row), see Section 13. These patterns apply to drawers, sidebars, and non-modal page panels.

```jsx
{/* Standard field card */}
<div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-3">
  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">Label</div>
  <div className="mt-1 text-sm font-semibold text-on-surface">Value</div>
</div>

{/* Section container card (holds multiple fields) */}
<div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-4">
  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-outline mb-3">Section Name</div>
  <div className="grid grid-cols-2 gap-3">
    ...field cards...
  </div>
</div>
```

---

## 24. Status Badges / Tags

```jsx
{/* Pill badge */}
<span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full
                 text-[10px] font-bold bg-error/10 text-error border border-error/20">
  <span className="material-symbols-outlined" style={{ fontSize: 11 }}>report</span>
  2.5% NG
</span>

{/* Count badge (section header) */}
<span className="ml-auto px-2.5 py-1 rounded-full bg-error/12 text-error
                 text-[11px] font-black border border-error/20">
  {count}
</span>

{/* Process label chip */}
<span className="text-[10px] text-outline bg-surface-container px-1.5 py-0.5 rounded-md">
  {processName}
</span>
```

---

## 25. Loading Skeletons

```jsx
{/* Block skeleton (card/row placeholder) */}
<div className="h-10 rounded-xl bg-surface-container/70 animate-pulse" />

{/* Inline value skeleton */}
<span className="inline-block w-16 h-6 rounded-lg bg-surface-container-high animate-pulse" />

{/* Large card skeleton */}
<div className="h-[72px] rounded-xl bg-surface-container/70 animate-pulse" />
```

---

## 26. Process Color Accents

| Process | Dot color | Icon color | Background |
|---|---|---|---|
| Kensa | `bg-amber-400` | `text-amber-400` | `bg-amber-400/10` |
| Press | `bg-emerald-400` | `text-emerald-400` | `bg-emerald-400/10` |
| SRS | `bg-slate-400` | `text-slate-400` | `bg-slate-400/10` |
| Slit | `bg-sky-400` | `text-sky-400` | `bg-sky-400/10` |

In the KPI strip (higher contrast variant):

| Process | Color |
|---|---|
| Kensa | `text-violet-500` / `bg-violet-500/10` |
| Press | `text-sky-500` / `bg-sky-500/10` |
| SRS | `text-amber-500` / `bg-amber-500/10` |
| Slit | `text-emerald-500` / `bg-emerald-500/10` |

---

## 27. KPI Strip Layout

```jsx
<div className="space-y-5 mb-8">
  <div>
    <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-3 flex items-center gap-2">
      <span className="w-3 h-px bg-separator inline-block" />
      Row Label
    </p>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      <StatSummaryCard ... />
    </div>
  </div>
</div>
```

`StatSummaryCard` internal layout: `p-4 flex flex-col gap-3` — icon (`w-10 h-10 rounded-xl`) then value block.

---

## 28. Dark Mode

Dark mode is toggled via the `.dark` class on `<html>`. All color tokens have dark overrides in `src/index.css`.

**Do not change dark mode values.** All work in this session was light mode only.

The aurora/lava-lamp background animation (`.aurora-bg`, `.aurora-blob-*`) is dark mode only and should never appear in light mode.

---

## 29. Per-Component Canonical Spacing

This section documents the exact spacing values applied to each specific component. Use it as a ground truth when editing an existing component or creating one that mirrors it.

### Dashboard components

#### `DashboardKPIStrip` + `StatSummaryCard`

| Element | Class |
|---|---|
| KPI strip outer gap between rows | `space-y-5` |
| KPI strip bottom margin | `mb-8` |
| Section label ("Overall", "By Process") | `text-[10px] font-bold uppercase tracking-widest text-outline mb-3` |
| Section label icon/line gap | `gap-2` |
| Grid of stat cards | `grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4` |
| `StatSummaryCard` padding | `p-4` |
| `StatSummaryCard` icon-to-content gap | `gap-3` |
| `StatSummaryCard` icon container | `w-10 h-10 rounded-xl` |

#### `DashboardFactorySummary`

| Element | Class |
|---|---|
| Desktop header row padding | `px-3 py-3` |
| Desktop header row bottom margin | `mb-2` |
| Desktop table row padding | `px-3 py-3` |
| Desktop table row list spacing | `space-y-1` |
| Mobile card list spacing | `space-y-3` |
| Mobile card padding | `p-4` |
| Mobile card inner stat grid gap | `gap-3` |

#### `DashboardRecentSubmissions`

| Element | Class |
|---|---|
| Row padding | `px-3 py-3` |
| Row list spacing | `space-y-2` |
| Row header (factory · equipment) gap | `gap-2` |
| Row detail (part · worker) indent | `pl-5` |

#### `DashboardIssuesFeed`

| Element | Class |
|---|---|
| Item card padding | `p-3` |
| Item list spacing | `space-y-2.5` |
| Item header section bottom margin | `mb-2` |
| Issue tag row gap | `gap-2` |
| Issue tag padding | `px-2 py-0.5` (pill, `rounded-full`) |
| Issue tag icon size | `style={{ fontSize: 11 }}` |

---

### Modal components — applied fixes

All modal headers, bodies, and footers now use these values with **no responsive overrides**:

| Zone | Class |
|---|---|
| Header | `px-6 py-5` |
| Scrollable body | `px-6 py-5` |
| Footer / action bar | `px-6 py-4` |
| Sidebar panel | `px-6 py-5` |

The table below documents the specific change applied to each modal file:

| File | What was fixed |
|---|---|
| `RecordEditModal.jsx` | Header/body/footer `px-5 lg:px-6` → `px-6`; 4 field cards `px-3 py-3` → `px-4 py-3` |
| `MasterDetailDrawer.jsx` | Field grid `gap-2` → `gap-3`; field cards `px-3 py-2` → `px-4 py-3` |
| `CheckFormBuilderModal.jsx` | Header/footer `px-4 sm:px-6` → `px-6`; toast `py-3.5` → `py-3` |
| `MasterBatchEditModal.jsx` | Sidebar/body `px-5` → `px-6`; change-list cards `px-3 py-3` → `px-4 py-3` |
| `ProductPDFBulkMatchModal.jsx` | All item cards `px-3 py-2` / `px-3 py-3` → `px-4 py-3` |
| `NodaDetailModal.jsx` | Cancel/Close navigation buttons `py-2.5` → `py-2` |
| `EquipmentEventModal.jsx` | Tag buttons `px-3.5 py-1.5` → `px-3 py-1` |
| `SettingsModal.jsx` | Language option buttons `py-3.5` → `py-3` |
| `ProductPDFTrashModal.jsx` | All action + pagination buttons `px-3 py-2` → `px-4 py-2` |
| `PlannerSlotSchedulingModal.jsx` | Goal list `space-y-2` → `space-y-3` |
| `RecordDetailModal.jsx` | Header `px-5 sm:px-6 py-4` → `px-6 py-5`; body sections `px-5 sm:px-6` → `px-6` |
| `ApprovalsDetailModal.jsx` | Header `px-5 py-4 lg:px-6` → `px-6 py-5`; body/sidebar `px-5` → `px-6` |

> **NodaDetailModal exception:** The large approve/reject/submit CTAs inside the modal body intentionally use `py-2.5 text-sm` for visual prominence. Only the secondary Cancel/Close navigation buttons use `py-2`.

---

## 30. Known Open Issues (low priority)

| Issue | Location | Notes |
|---|---|---|
| Bare icon in section header (no badge wrapper) | Various older modals/pages | Apply during future edits — cosmetic only |
| Close button in `PlannerModalShell` | `planner/PlannerModalShell.jsx` | Uses oversized `h-10 w-10 rounded-2xl` — should be `p-2 rounded-xl` |
| `SettingsModal` backdrop | `SettingsModal.jsx` | Uses `absolute` not `fixed` (intentional for drawer positioning) — leave unchanged |
| `LoginPage` border | `LoginPage.jsx` | `border-white/28` is intentional glassmorphism on dark aurora — leave unchanged |

---

## 31. Verification Checklist

When reviewing a new component, confirm:

**Spacing**
- [ ] All spacing uses 8px-grid values — no `gap-2.5`, `py-2.5`, `px-3.5`, `mb-1.5`, etc.
- [ ] Cards use `px-4 py-3` (field) or `px-4 py-4` / `p-4` (container) — not `px-3 py-2`
- [ ] Table cells are `px-3 py-3` in both `<th>` and `<td>`
- [ ] No asymmetric gap classes (`gap-x-N gap-y-M` where N ≠ M)

**Modal-specific**
- [ ] Modal width chosen from the allowed variants (`max-w-md` → `max-w-7xl`) — never custom pixel widths
- [ ] Modal header `px-6 py-5`, body `px-6 py-5`, footer `px-6 py-4` — no responsive overrides (`sm:px-6`, `lg:px-6`) inside modals
- [ ] Eyebrow uses `tracking-[0.22em]`; all other ALL CAPS labels use `tracking-[0.18em]`
- [ ] Modal title is `text-xl font-black` (or `text-2xl` for `max-w-6xl`+)
- [ ] Field label icon is `style={{ fontSize: 16 }}` — not 18 or 20
- [ ] Dividers follow the three-tier opacity rule: `40` header, `35` section, `30` item
- [ ] Stats strip cells are `rounded-xl px-3 py-3 text-center border border-separator/30`
- [ ] Alert boxes (`rounded-2xl`, correct semantic color, `flex gap-3`, `flex-shrink-0` on icon)
- [ ] Images wrapped in `rounded-2xl overflow-hidden border border-separator/30 bg-surface-container`
- [ ] Sidebar width is `w-72` with `border-l border-separator/30`
- [ ] Footer buttons `px-4 py-2 text-xs font-bold`, gap `gap-3`, `active:scale-95`
- [ ] Status chips use `rounded-full` with icon `style={{ fontSize: 11 }}`

**Buttons**
- [ ] Buttons are `px-4 py-2` — never `px-3.5`, `py-2.5`, `py-3.5`
- [ ] Primary buttons have `active:scale-95`
- [ ] All transitions use `transition-all duration-150`

**Design tokens**
- [ ] Border radius: data containers `rounded-2xl`, controls `rounded-xl`, pills `rounded-full`
- [ ] Light mode surface containers use neutral grays — no `244 243 249` / `236 233 244` values
- [ ] Glass card and dashboard-section backgrounds are `rgba(252, 253, 253, ...)` — not `rgba(252, 251, 255, ...)`
- [ ] Structural borders use `border-separator/*` — never `border-white/*`
- [ ] Interactive rows have `hover:bg-surface-container hover:border-primary/30 transition-all duration-150`
- [ ] Section headers use icon-badge pattern (`w-8 h-8 rounded-lg bg-primary/10`)
- [ ] Dark mode untouched if only doing light mode work
