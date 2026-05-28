# UI Consistency Audit & Design System Reference

**Last updated:** 2026-05-28  
**Branch:** claude/freya-admin-light-mode-KQgcx  
**Scope:** Full codebase — light mode neutralization + complete spacing audit applied.

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

| Component | Row padding | List spacing |
|---|---|---|
| Issues feed items | `p-3` | `space-y-2.5` |
| Recent submissions rows | `px-3 py-3` | `space-y-2` |
| Factory table header | `px-3 py-3` | — |
| Factory table rows | `px-3 py-3` | `space-y-1` |

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

## 8. Section Header Pattern

Use this pattern for every panel/section title — dashboard, modals, and pages.

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

For error-state sections swap `bg-primary/10 text-primary` → `bg-error/10 text-error`.

---

## 9. Icon Containers

| Context | Size | Shape | Background |
|---|---|---|---|
| KPI / stat card icon | `w-10 h-10 rounded-xl` | Rounded square | `bg-{accent}/10` |
| Section header icon badge | `w-8 h-8 rounded-lg` | Square | `bg-primary/10` or status color |
| Status dot / process dot | `w-2 h-2 rounded-full` (or `w-2.5 h-2.5`) | Circle | Solid accent |
| Empty state icon | `w-14 h-14 rounded-2xl` | Large card | `bg-{color}/8` |

---

## 10. Button Standards

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

## 11. Interactive Rows (clickable list items)

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

## 12. Field Cards (label + value pairs)

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

## 13. Status Badges / Tags

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

## 14. Loading Skeletons

```jsx
{/* Block skeleton (card/row placeholder) */}
<div className="h-10 rounded-xl bg-surface-container/70 animate-pulse" />

{/* Inline value skeleton */}
<span className="inline-block w-16 h-6 rounded-lg bg-surface-container-high animate-pulse" />

{/* Large card skeleton */}
<div className="h-[72px] rounded-xl bg-surface-container/70 animate-pulse" />
```

---

## 15. Process Color Accents

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

## 16. KPI Strip Layout

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

## 17. Dark Mode

Dark mode is toggled via the `.dark` class on `<html>`. All color tokens have dark overrides in `src/index.css`.

**Do not change dark mode values.** All work in this session was light mode only.

The aurora/lava-lamp background animation (`.aurora-bg`, `.aurora-blob-*`) is dark mode only and should never appear in light mode.

---

## 18. Known Open Issues (low priority)

| Issue | Location | Notes |
|---|---|---|
| Bare icon in section header (no badge wrapper) | Various older modals/pages | Apply during future edits — cosmetic only |
| Close button in `PlannerModalShell` | `planner/PlannerModalShell.jsx` | Uses oversized `h-10 w-10 rounded-2xl` — should be `p-2 rounded-xl` |
| `SettingsModal` backdrop | `SettingsModal.jsx` | Uses `absolute` not `fixed` (intentional for drawer positioning) — leave unchanged |
| `LoginPage` border | `LoginPage.jsx` | `border-white/28` is intentional glassmorphism on dark aurora — leave unchanged |

---

## 19. Verification Checklist

When reviewing a new component, confirm:

- [ ] All spacing uses 8px-grid values — no `gap-2.5`, `py-2.5`, `px-3.5`, `mb-1.5`, etc.
- [ ] Cards use `px-4 py-3` (field) or `px-4 py-4` / `p-4` (container) — not `px-3 py-2` or `px-3 py-3`
- [ ] Modal header is `px-6 py-5`, body `px-6 py-5`, footer `px-6 py-4` — no responsive overrides inside modals
- [ ] Table cells are `px-3 py-3` in both `<th>` and `<td>`
- [ ] Buttons are `px-4 py-2` — never `px-3.5`, `py-2.5`, `py-3.5`
- [ ] Border radius: data containers `rounded-2xl`, controls `rounded-xl`, pills `rounded-full`
- [ ] Light mode surface containers use neutral grays — no `244 243 249` / `236 233 244` values
- [ ] Glass card and dashboard-section backgrounds are `rgba(252, 253, 253, ...)` — no blue-biased `255` channel
- [ ] Structural borders use `border-separator/*` — never `border-white/*`
- [ ] Frosted-glass appearance on modals (not flat opaque)
- [ ] Interactive rows have `hover:bg-surface-container hover:border-primary/30 transition-all duration-150`
- [ ] Primary buttons have `active:scale-95`
- [ ] Section headers use icon-badge pattern (`w-8 h-8 rounded-lg bg-primary/10`)
- [ ] Dark mode untouched if only doing light mode work
