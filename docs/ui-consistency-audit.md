# UI Consistency Audit & Design System Reference

**Last updated:** 2026-05-28
**Branch:** claude/ui-improvements-dashboard-rtS5x
**Scope:** Full codebase — dashboard refactor applied; audit of all remaining pages/components.

---

## Design System Specification (Current)

This section is the canonical reference. All new components and edits should follow these rules.

---

### 1. Panel / Card Hierarchy

Two distinct card levels exist. Choosing the wrong one is the most common mistake.

| Level | Class | Use When |
|---|---|---|
| **Major section** | `.dashboard-section rounded-2xl` | Top-level page sections, modal containers, primary workspace panels |
| **Nested card** | `.glass-card rounded-2xl` | Cards *inside* a section, stat cards, list items with card style |

> **Rule:** If the card sits directly on the page background (or on the modal backdrop), use `.dashboard-section`. If it's nested inside another panel, use `.glass-card`.

---

### 2. Modal Shells

```jsx
{/* Backdrop */}
<div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4
                bg-black/50 backdrop-blur-md" onClick={onClose}>

  {/* Container */}
  <div className="dashboard-section rounded-2xl w-full max-w-2xl max-h-[92vh]
                  overflow-y-auto scrollbar-hide shadow-[0_0_80px_rgba(99,102,241,0.18),0_24px_48px_rgba(0,0,0,0.22)]"
       onClick={e => e.stopPropagation()}>

    {/* Sticky header */}
    <div className="sticky top-0 z-10 rounded-t-2xl px-5 sm:px-6 py-4 flex items-center justify-between
                    border-b border-separator/40 bg-surface/90 backdrop-blur-md">
      ...header content...
    </div>

    {/* Sections divided by */}
    <div className="border-b border-separator/30">...</div>
  </div>
</div>
```

| Property | Value |
|---|---|
| Backdrop | `bg-black/50 backdrop-blur-md` |
| Container | `dashboard-section rounded-2xl` |
| Max height | `max-h-[92vh]` |
| Header padding | `px-5 sm:px-6 py-4` |
| Content padding | `px-5 sm:px-6 py-4` or `px-5 sm:px-6 py-5` |
| Section dividers | `border-b border-separator/30` to `border-separator/40` |
| Scroll | `overflow-y-auto scrollbar-hide` |

---

### 3. Section Headers (inside panels/modals)

Use the icon-badge pattern consistently for all panel/section titles.

```jsx
{/* Icon badge + title */}
<div className="flex items-center gap-2 mb-1">
  <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
    <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>icon_name</span>
  </span>
  <h3 className="text-sm font-bold text-on-surface">Section Title</h3>
  {/* Optional right-side count/badge */}
  <span className="ml-auto text-[10px] text-outline">N items</span>
</div>
{/* Subtitle indented to align under icon */}
<p className="text-[11px] text-outline mb-4 ml-10">Supporting description</p>
```

For error-state sections, swap `bg-primary/10 text-primary` → `bg-error/10 text-error`.

---

### 4. Borders & Separators

**Never use `border-white/5`, `border-white/10`, or `border-white/20` for structural borders.**
These are invisible on light backgrounds. Use the semantic separator token instead.

| Usage | Class |
|---|---|
| Structural dividers | `border-separator/30` |
| Card / container outlines | `border-separator/40` to `border-separator/50` |
| Hover accent border | `hover:border-primary/30` |
| Error-state border | `border-error/25` |
| Amber/warning border | `border-amber-500/25` |

`border-white/*` and `border-outline-variant/*` are still acceptable **only** inside the glass/inset box-shadow definitions in CSS, or for very specific dark-mode-only accent glows.

---

### 5. Interactive Rows & Clickable Cards

```jsx
<button className="w-full text-left px-3 py-2.5 rounded-xl
                   bg-surface-container/45 border border-separator/35
                   hover:bg-surface-container hover:border-primary/30 hover:shadow-sm
                   transition-all duration-150 group">
```

For warning rows (maintenance/high NG), add left-border accent via shadow:
```jsx
className="... hover:shadow-[inset_3px_0_0_rgb(var(--c-primary))]"
// or for error rows:
className="... shadow-[inset_3px_0_0_rgb(var(--c-error))]"
```

---

### 6. Buttons

**Primary:**
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

**Ghost / icon-only:**
```jsx
<button className="p-2 rounded-xl text-outline hover:bg-surface-container
                   hover:text-on-surface transition-all duration-150">
```

**Close (modal):**
```jsx
<button className="p-2 rounded-xl hover:bg-surface-container text-outline
                   hover:text-on-surface transition-all duration-150">
  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
</button>
```

> `active:scale-95` is required on all primary/secondary action buttons.

---

### 7. Icon Containers

| Context | Size | Shape | Background |
|---|---|---|---|
| KPI / stat card icon | `w-10 h-10 rounded-xl` | Square | accent color at `/10` opacity |
| Section header icon | `w-8 h-8 rounded-lg` | Square | `bg-primary/10` (or status color) |
| Badge / status dot | `w-2.5 h-2.5 rounded-full` | Circle | solid color |

---

### 8. Typography Scale

| Role | Class |
|---|---|
| Page title | `text-2xl sm:text-3xl font-black tracking-tight text-on-surface` |
| Section heading | `text-sm font-bold text-on-surface` |
| Sub-label | `text-[10px] font-bold uppercase tracking-wider text-outline` |
| Body / cell text | `text-sm font-semibold text-on-surface` |
| Secondary body | `text-[11px] text-on-surface-variant` |
| Hint / caption | `text-[11px] text-outline` or `text-[10px] text-outline` |
| KPI value | `text-2xl font-black text-on-surface leading-none tracking-tight` |
| Monospace field | `text-xs font-mono text-on-surface-variant` |

---

### 9. Process Color Accents

| Process | Dot / Icon | Background |
|---|---|---|
| Kensa | `text-amber-400` / `bg-amber-400` | `bg-amber-400/10` |
| Press | `text-emerald-400` / `bg-emerald-400` | `bg-emerald-400/10` |
| SRS | `text-slate-400` / `bg-slate-400` | `bg-slate-400/10` |
| Slit | `text-sky-400` / `bg-sky-400` | `bg-sky-400/10` |
| (KPI strip) Kensa | `text-violet-500` | `bg-violet-500/10` |
| (KPI strip) Press | `text-sky-500` | `bg-sky-500/10` |
| (KPI strip) SRS | `text-amber-500` | `bg-amber-500/10` |
| (KPI strip) Slit | `text-emerald-500` | `bg-emerald-500/10` |

---

### 10. Status / Semantic Colors

| State | Text | Background | Border |
|---|---|---|---|
| Error / NG | `text-error` | `bg-error/10` to `bg-error/12` | `border-error/25` |
| Warning / Trouble | `text-amber-500` | `bg-amber-500/10` | `border-amber-500/25` |
| Success / OK | `text-emerald-500` | `bg-emerald-500/10` | `border-emerald-500/25` |
| Info / neutral | `text-primary` | `bg-primary/10` | `border-primary/25` |

---

### 11. Loading Skeletons

```jsx
<div className="h-10 rounded-xl bg-surface-container/70 animate-pulse" />
// Inline value skeleton:
<span className="inline-block w-16 h-6 rounded-lg bg-surface-container-high animate-pulse" />
```

Use `rounded-xl` for most skeletons, `rounded-full` only for avatar/dot placeholders.

---

### 12. CSS Variables & Tailwind Tokens (Current)

```css
/* Light mode (contrast-optimised) */
--c-on-surface:              17 17 22;        /* near-black text */
--c-on-surface-variant:      54 54 66;        /* secondary text */
--c-outline:                 96 96 110;       /* muted labels, hints */
--c-outline-variant:         205 207 216;     /* subtle lines */
--c-separator:               214 216 226;     /* structural separators */
--c-lavender:                138 120 255;     /* secondary purple accent */

/* Dark mode */
--c-on-surface:              232 233 242;
--c-on-surface-variant:      192 190 210;
--c-outline:                 155 154 172;
--c-outline-variant:         76 75 92;
--c-separator:               60 60 76;
--c-lavender:                172 158 255;
```

Available as Tailwind tokens: `text-separator`, `bg-separator`, `border-separator`, `text-lavender`, `bg-lavender`, `border-lavender`.

---

## Consistency Audit Results (2026-05-28)

### Already Fixed

**Dashboard Refactor (2026-05-28):**

| Component | Issues Fixed |
|---|---|
| `DashboardPage.jsx` | Header hierarchy, refresh button, error banner |
| `DashboardKPIStrip.jsx` | Row labels, spacing, card sizing |
| `DashboardIssuesFeed.jsx` | `dashboard-section`, icon-badge header, left-border accents |
| `DashboardRecentSubmissions.jsx` | `dashboard-section`, icon-badge header, process dot size |
| `DashboardFactorySummary.jsx` | `dashboard-section`, icon-badge header, table header bg, mini-bar |
| `StatSummaryCard.jsx` | Icon size, value size, `card-hover-lift` |
| `RecordDetailModal.jsx` | `dashboard-section`, `backdrop-blur-md`, separator borders, stats strip |
| `index.css` | Contrast vars, `.dashboard-section`, `.card-hover-lift`, `.animate-fade-in-up` |

**Global Consistency Pass (2026-05-28):**

| Fix | Scope |
|---|---|
| `ModalShell.jsx` | `dashboard-section`, `backdrop-blur-md` default, `border-separator` dividers |
| `CollapsibleSection.jsx` | `border-separator/30` (was `border-white/10`) |
| `IconButton.jsx` | `active:scale-95`, `transition-all duration-150`, separator outlined border |
| Issue A (backdrop) | `bg-black/50 backdrop-blur-md` in 8 files: `InspectionHistoryModal`, `EquipmentHistoryBinWorkspace`, `FactoryDBWorkspace`, `SetsubiDBWorkspace` (×3), `SetsubiArchiveWorkspace` (×2), `CheckFormBuilderModal`, `CheckFormDetailModal`, `ApprovalsDetailModal`, `TicketSubmissionsPage` (×2), `ChecklistSubmissionsPage` (×2) |
| Issue B/C (modal containers) | `dashboard-section` on 14 modal/page containers; removed redundant `border-outline-variant/20` |
| Issue D/E (separator borders) | `border-separator/*` replaces `border-white/*` and `border-outline-variant/*` in all modal, workspace, filter panel, and page files |
| Issue F (transition duration) | `transition-all duration-150` standardised in interactive rows |
| Issue H (close buttons) | `p-2 rounded-xl` + `active:scale-95` in `InspectionHistoryModal`, `CheckFormDetailModal` |
| Issue I (active:scale-95) | Added to all `bg-primary` action buttons + `rounded-2xl→rounded-xl` across all files |
| Top-level panels | `dashboard-section rounded-2xl` on outer panels in `FactoryStatusPage`, `FactoryStatusLogsPage`, `InventoryPage`, `MaintenancePage`, `ApprovalsPage`, `SetsubiDBWorkspace`, `SetsubiArchiveWorkspace`, `FactoryDBWorkspace`, `MasterDBPage`, `FactoryDetailPage` |

---

### Remaining Open Issues

#### Issue G — Section headers still use bare icon (no icon-badge container) ℹ️ LOW

Most older modals/pages use `<span className="material-symbols-outlined text-primary">` directly
as the section title icon, without the `w-8 h-8 rounded-lg bg-primary/10` badge wrapper.

Apply opportunistically during future edits. Does not affect layout — purely a polish detail.

---

#### Issue H (partial) — Close buttons in `PlannerModalShell` and `TicketSubmissionsPage`/`ChecklistSubmissionsPage`

`planner/PlannerModalShell.jsx` still uses the old `h-10 w-10 rounded-2xl bg-surface-container` close button.
`TicketSubmissionsPage.jsx` and `ChecklistSubmissionsPage.jsx` inline close buttons need `active:scale-95`.

---

#### `SettingsModal.jsx` backdrop

Uses `absolute inset-0 bg-black/40 backdrop-blur-sm` (positioned absolute, not fixed — intentional for its drawer-style positioning). Leave unchanged unless the modal is refactored to full-screen.

---

#### `LoginPage.jsx`

`border-white/28` used in the login card border — this is intentional glassmorphism on the dark aurora background. Leave unchanged.

---

## Verification Checklist

When checking consistency, open each modal side-by-side with the dashboard and confirm:
- [ ] Frosted-glass appearance (not flat opaque)
- [ ] Backdrop is noticeably blurred (`blur-md`)
- [ ] Section borders are visible on light backgrounds (separator token, not white/opacity)
- [ ] All interactive rows/buttons lift smoothly on hover
- [ ] Primary buttons have `active:scale-95` press response
- [ ] Close buttons are `p-2 rounded-xl` (not oversized)
- [ ] Section headers have icon-badge wrapping
