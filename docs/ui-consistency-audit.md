# UI Visual Consistency Audit

**Date:** 2026-05-19  
**Branch:** setsubi  
**Scope:** Spacing, padding, border-radius, color/opacity, background treatment across all pages. Focus on newly created pages (Maintenance, MasterDB > 設備) vs established conventions.

---

## Established Conventions (Baseline)

Derived from `PlannerModalShell.jsx`, `MasterRecordModal.jsx`, `EquipmentEventModal.jsx`, `FactoryRecordModal.jsx`, and `InventoryPage.jsx`.

| Property | Standard Value |
|---|---|
| Modal outer border-radius | `rounded-2xl` (16px) |
| Modal background | `glass-card` utility class |
| Modal backdrop | `bg-black/40 backdrop-blur-sm` |
| Modal header padding | `px-6 py-5` |
| Modal content padding | `px-6 py-5` or `px-6 py-6` |
| Modal footer padding | `px-6 py-4` |
| Modal border | `border border-outline-variant/20` |
| Close button | `flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-container text-on-surface-variant transition hover:bg-surface-container-high` |
| Primary button | `rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-on-primary transition hover:opacity-90` |
| Secondary button | `rounded-2xl border border-outline-variant/20 px-4 py-2 text-xs font-bold text-on-surface transition hover:bg-surface-container` |
| Form inputs | `rounded-2xl border border-outline-variant/30 bg-surface px-3 py-3 text-sm text-on-surface outline-none transition focus:border-primary/40` |
| Card containers | `rounded-2xl border border-outline-variant/20` |
| Badges / tags | `rounded-full` |

---

## Issues & Proposals

### Issue 1 — Modal Outer Border-Radius ⚠️ HIGH

**Problem:** The user specifically reported this. Maintenance modal windows use `rounded-3xl` (24px), while all established modals use `rounded-2xl` (16px).

| File | Line | Current | Proposed |
|---|---|---|---|
| `src/components/CheckFormBuilderModal.jsx` | 169 | `rounded-3xl` | `rounded-2xl` |
| `src/components/CheckFormPreviewModal.jsx` | 238 | `rounded-3xl` | `rounded-2xl` |
| `src/components/InspectionHistoryModal.jsx` | 151 | `rounded-3xl` | `rounded-2xl` |

> Also verify `CheckFormSimulatorModal.jsx` — it shares structure with Preview modal.

---

### Issue 2 — Modal Background Treatment ⚠️ HIGH

**Problem:** Maintenance modals use a plain `bg-surface shadow-2xl` instead of the `glass-card` utility. This means they render as a flat, opaque surface instead of the frosted-glass appearance used on all other modals.

| File | Line | Current | Proposed |
|---|---|---|---|
| `src/components/CheckFormBuilderModal.jsx` | 169 | `bg-surface shadow-2xl` | `glass-card` (drop `shadow-2xl`) |
| `src/components/CheckFormPreviewModal.jsx` | 238 | `bg-surface shadow-2xl` | `glass-card` |
| `src/components/InspectionHistoryModal.jsx` | 151 | `bg-surface shadow-2xl` | `glass-card` |

> `glass-card` already defines its own `box-shadow` — the `shadow-2xl` override is redundant and should be removed.

---

### Issue 3 — Close Button Style ⚠️ MEDIUM

**Problem:** Maintenance modals use a smaller, background-less close button (`h-9 w-9 rounded-xl`, no `bg-surface-container`). All other modals use a padded, surface-toned icon button (`h-10 w-10 rounded-2xl bg-surface-container`).

| File | Line | Current | Proposed |
|---|---|---|---|
| `src/components/CheckFormBuilderModal.jsx` | 179 | `flex h-9 w-9 items-center justify-center rounded-xl text-outline hover:bg-primary/5 hover:text-primary transition` | `flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-container text-on-surface-variant transition hover:bg-surface-container-high` |
| `src/components/InspectionHistoryModal.jsx` | 163 | same deviation | same fix |

---

### Issue 4 — SetsubiDBWorkspace Internal Radius Inconsistency ⚠️ MEDIUM

**Problem:** Two sibling card containers within the same component use different border-radius values with no apparent reason for the difference.

| Section | Line | Current | Proposed |
|---|---|---|---|
| Equipment detail panel | 454 | `rounded-3xl border border-outline-variant/25 bg-surface-container` | `rounded-2xl border border-outline-variant/20 bg-surface-container` |
| Factory section | 582 | `rounded-2xl border border-outline-variant/25 bg-surface-container` | `rounded-2xl border border-outline-variant/20 bg-surface-container` |

---

### Issue 5 — Border Opacity Drift ℹ️ LOW

**Problem:** Newer components use `/25` for border opacity; the established value is `/20`. Visually close, but unnecessary variation.

| File | Location | Current | Proposed |
|---|---|---|---|
| `src/components/SetsubiDBWorkspace.jsx` | Lines 454, 582 | `border-outline-variant/25` | `border-outline-variant/20` |
| `src/pages/MaintenancePage.jsx` | FormCard (line 16) | `border-outline-variant/25` | `border-outline-variant/20` |

---

### Issue 6 — Backdrop Overlay Opacity ℹ️ LOW

**Problem:** `InspectionHistoryModal` uses a slightly darker backdrop than the standard.

| File | Line | Current | Proposed |
|---|---|---|---|
| `src/components/InspectionHistoryModal.jsx` | 150 | `bg-black/50` | `bg-black/40` |

> `PlannerModalShell.jsx` uses `bg-black/55` — this is likely intentional given its elevated `z-[70]` stacking context. Leave unchanged.

---

### Issue 7 — Footer Button Padding ℹ️ LOW

**Problem:** Maintenance modal footer buttons use `py-2.5` vs the standard `py-2`, making them slightly taller than buttons on all other modals.

| File | Lines | Current | Proposed |
|---|---|---|---|
| `src/components/CheckFormBuilderModal.jsx` | 336–343 | `py-2.5` | `py-2` |
| `src/components/CheckFormPreviewModal.jsx` | 277 | `py-2.5` | `py-2` |

---

### Issue 8 — Page-Level Container Radius 🔍 NEEDS CONFIRMATION

**Problem:** Outer section wrappers on new pages use `rounded-3xl`, while comparable wrappers on Inventory use `rounded-2xl`. However, the Inventory data table itself uses `rounded-[28px]` (28px, larger than 3xl = 24px), suggesting even the Inventory page is not internally consistent at this level.

| File | Line | Current |
|---|---|---|
| `src/pages/MaintenancePage.jsx` | 136 | `glass-card rounded-3xl p-6` |
| `src/components/SetsubiDBWorkspace.jsx` | 860 | `glass-card rounded-3xl p-6` |
| `src/pages/InventoryPage.jsx` (filter card) | 516 | `glass-card mb-6 rounded-2xl p-5` |
| `src/pages/InventoryPage.jsx` (data table) | 694 | `glass-card mb-8 overflow-hidden rounded-[28px]` |

**Action needed:** Decide whether large page-level outer containers should use `rounded-2xl` or whether `rounded-3xl` / `rounded-[28px]` is acceptable for outermost wrappers. Recommend standardising to one value.

---

## Summary by Priority

| # | Issue | Files Affected | Priority |
|---|---|---|---|
| 1 | Modal border-radius (`rounded-3xl` → `rounded-2xl`) | CheckFormBuilderModal, CheckFormPreviewModal, InspectionHistoryModal | HIGH |
| 2 | Modal background (`bg-surface` → `glass-card`) | same 3 files | HIGH |
| 3 | Close button size/style | CheckFormBuilderModal, InspectionHistoryModal | MEDIUM |
| 4 | Setsubi detail panel radius vs factory panel | SetsubiDBWorkspace | MEDIUM |
| 5 | Border opacity `/25` → `/20` | SetsubiDBWorkspace, MaintenancePage | LOW |
| 6 | Backdrop opacity `/50` → `/40` | InspectionHistoryModal | LOW |
| 7 | Footer button `py-2.5` → `py-2` | CheckFormBuilderModal, CheckFormPreviewModal | LOW |
| 8 | Page-level container radius (needs decision) | MaintenancePage, SetsubiDBWorkspace, InventoryPage | CONFIRM |

---

## Verification Checklist

After applying fixes, open the app and trigger each modal side-by-side:

- [ ] Inventory Transactions modal (via InventoryPage)
- [ ] Form Builder modal (via MaintenancePage → New Form)
- [ ] Form Preview modal (via MaintenancePage → View)
- [ ] Form Simulator modal (via MaintenancePage → Simulate)
- [ ] Inspection History modal (via MaintenancePage → View Inspection History)
- [ ] Equipment Event modal (via MasterDB > 設備)
- [ ] Equipment View modal (via MasterDB > 設備)

Confirm visually:
- All modal containers share identical corner radius
- All modal containers show frosted-glass appearance (not flat opaque)
- All close buttons are the same size with surface-container background tint
- All footer buttons are the same height
