# FREYA Systems Design Language v1.0

**Brand direction:** Industrial · Powerful · Precise · Minimal

> **Core responsive principle:** On larger screens, increase information
> density. On smaller screens, decrease information density --- not
> usability.

## 1. FREYA Color System

  ------------------------------------------------------------------------
  Token              Light Mode        Dark Mode         Purpose
  ------------------ ----------------- ----------------- -----------------
  `brand-primary`    `#2563EB`         `#3B82F6`         Primary actions,
                                                         selected states

  `text-primary`     `#0F172A`         `#F8FAFC`         Main text

  `text-secondary`   `#334155`         `#CBD5E1`         Supporting
                                                         information

  `text-tertiary`    `#64748B`         `#94A3B8`         Metadata

  `page-bg`          `#F8FAFC`         `#07090D`         Main application
                                                         background

  `surface`          `#FFFFFF`         `#0F172A`         Cards and tables

  `surface-raised`   `#FFFFFF`         `#111827`         Dialogs and menus

  `border`           `#E5E7EB`         `#1E293B`         Separators

  `border-strong`    `#CBD5E1`         `#334155`         Inputs / strong
                                                         borders
  ------------------------------------------------------------------------

Semantic colors: Complete `#16A34A`; Warning `#D97706`; Defect
`#DC2626`; Critical `#B91C1C`; Information `#2563EB`; Disabled
`#94A3B8`; Unknown `#64748B`.

Never communicate state by color alone. Pair color with icons/text such
as `● Complete`, `▲ Warning`, `✕ Defect`, `— Not checked`.

## 2. FREYA Typography

Use the custom futuristic lettering for the FREYA wordmark, not
application body copy.

``` css
font-family:
  Inter,
  "Noto Sans JP",
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

## 3. Font Weight System

  Weight   Usage
  -------- -----------------------------------
  400      Descriptions/supporting content
  500      Labels/table content
  600      Headings/buttons/important values
  700      KPI numbers only

Avoid routine 800/900 weights.

## 4. FREYA Type Scale

  UI Element           Desktop   Weight   Line Height
  ------------------ --------- -------- -------------
  Hero/Login title        40px      600          48px
  Page title              32px      600          40px
  Large KPI               32px      600          38px
  Section title           20px      600          28px
  Card title              16px      600          24px
  Dialog title            18px      600          26px
  Body                    14px      400          22px
  Description             14px      400          21px
  Table data              14px      500          20px
  Table header            12px      600          18px
  Input                   14px      400          20px
  Input label             13px      500          18px
  Button                  14px      600          20px
  Metadata                12px      400          18px
  Badge                   12px      600          16px

## 5. Responsive Type Scale

  Element           Desktop   Tablet   iPhone   Desktop→iPhone
  --------------- --------- -------- -------- ----------------
  Page title             32       28       26             −19%
  Section title          20       20       18             −10%
  Card title             16       16       16               0%
  Body                   14       15       16             +14%
  Description            14       14       15              +7%
  Table data             14       14       15              +7%
  Table header           12       12       12               0%
  Button                 14       15       16             +14%
  Input                  14       15       16             +14%
  Metadata               12       12       12               0%
  KPI                    32       30       28           −12.5%

Headings compress; functional text stays constant or grows.

## 6. Responsive Breakpoints

Large monitor ≥1920px; Desktop 1440--1919px; Laptop 1024--1439px; Tablet
768--1023px; Mobile \<768px; Small iPhone \<390px.

## 7. Large Factory Monitor Scaling

Page title 36px; section title 22px; body/table 15px; KPI 40px; button
44px; card padding 28px; main gap 28px. Important information grows
instead of simply adding more data.

## 8. FREYA 4px Spacing System

`4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80px`

Avoid arbitrary spacing values.

## 9. Page Spacing

Desktop: content padding 32px; title→description 8px; title
block→actions 24px; header→section 32px; section title→content 16px;
section→section 32px; card gap 16px; card padding 24px; table→pagination
16px; field gap 20px; label→input 8px; description→field 12px.

## 10. Tablet Spacing

Page padding 24px (−25%); section gap 28px (−12.5%); card padding 20px
(−17%); grid gap 16px; title→description 8px; header→content 24px
(−25%). Touch controls grow despite tighter layout spacing.

## 11. iPhone Spacing

Page padding 16px (−50%); card padding 16px (−33%); section gap 24px
(−25%); card gap 12px (−25%); form gap 16px (−20%); header gap 24px;
title→description 8px.

## 12. Card Design

Radius 8px; desktop padding 24px; 1px border; minimal shadow; surface
background; title→KPI 16px; KPI→metadata 6px. 6px radius is suitable for
highly industrial screens.

## 13. Primary Buttons

Desktop: 40px height, 0 16px padding, 14px/600, 6px radius. Tablet:
44px, 0 18px, 15px. iPhone: 48px, 0 20px, 16px. Desktop→mobile height
grows 20%.

## 14. Button Hierarchy

Primary = blue filled; Secondary = border; Tertiary = text; Danger =
red. Prefer one primary blue action per logical area.

## 15. Form Inputs

Desktop 40px/14px; tablet 44px/15px; phone 48px/16px. Use 52px for
repetitive/glove-friendly factory workflows.

## 16. Persistent Input Labels

Never rely on placeholder text as the only label. Keep field labels
visible after data entry.

## 17. Tables

Desktop header 40px; standard row 44px; comfortable 48px; dense 36px;
horizontal padding 12--16px; header 12px/600; body 14px/500. Tablet rows
48px. Interactive phone rows \~52px.

## 18. Table Header Treatment

Use quiet 12px semibold headers, often uppercase, `#64748B`,
letter-spacing `0.04em`. Data should visually dominate labels.

## 19. Table Responsive Behavior

Desktop shows full tables. Tablet removes low-priority columns and uses
row expansion. Phone converts wide rows into structured cards/details
rather than squeezing many columns.

## 20. Responsive Column Priority

Priority 1: Machine, Status, Result. Priority 2: Operator, Time, Defect
count. Priority 3: Factory, Line, Metadata, IDs. Hide lower priorities
progressively.

## 21. Desktop Navigation

Sidebar 240px; logo 140--160px; nav row 40--44px; icons 18--20px; group
spacing 20--24px.

## 22. Laptop Navigation

Below \~1280px sidebar may collapse to 72px. Keep icons accessible and
expose labels through an accessible expansion mechanism.

## 23. Tablet Navigation

Use a collapsible 240--280px drawer instead of permanently occupying
tablet width.

## 24. Phone Navigation

Remove desktop sidebar. Use bottom navigation for 3--5 primary
destinations and/or a More/admin drawer.

## 25. Sidebar Hierarchy

Section labels 11px uppercase; nav items 14px medium. Selected item gets
blue icon/text and subtle blue background rather than a giant blue
block.

## 26. Page Header

Desktop keeps page title, description, and actions efficiently grouped.
Mobile stacks description/actions and may use full-width primary
actions.

## 27. Mobile Button Behavior

Stack primary/secondary actions when necessary. Do not pack four small
buttons into one narrow row.

## 28. KPI Cards

Label 12px; value 32px; unit 14px; comparison 13px. Large monitor value
40px. Phone value 28px.

## 29. Desktop Dashboard Grid

Use a 12-column grid. Typical KPI = 3 columns; medium analytics = 6;
major chart/table = 12.

## 30. Tablet Dashboard

Usually 2 KPI cards per row. Information-heavy charts become full width.

## 31. Phone Dashboard

Use one main column. Two tiny statistics may occasionally share a row;
charts/data-heavy cards stay full width.

## 32. Content Width

Dashboard/table pages may use all available width. Forms/settings should
generally max at 720--900px.

## 33. Page Padding Formula

``` css
padding-inline: clamp(16px, 2vw, 32px);
gap: clamp(24px, 2vw, 32px);
```

## 34. Typography Formula

``` css
.page-title { font-size: clamp(26px, 2vw, 32px); }
.section-title { font-size: clamp(18px, 1.5vw, 20px); }
```

Do not make every functional text size fluid.

## 35. Radius System

Small 4px; standard 6px; card 8px; large 12px; pill 999px.
Inputs/buttons 6px, cards 8px, dialogs 10--12px.

## 36. Border System

Light `1px #E5E7EB`; dark `1px #1E293B`; focus `2px #2563EB`.

## 37. Shadow System

Level 0 none; Level 1 `0 1px 2px rgba(0,0,0,.05)`; Level 2
`0 8px 24px rgba(0,0,0,.10)`. Cards 0--1; menus/modals 2.

## 38. Icons

Use one family such as Lucide. Inline 16px; navigation 18px; button
16px; feature 20px; status 16px; tablet/mobile nav 20--22px.

## 39. Icon + Text Gap

Default 8px; tiny inline relationships 4px.

## 40. Badges

24px height; 4px 8px padding; 12px/600. Always combine status color with
readable text/icon.

## 41. Dialogs / Modals

Desktop widths: small 400px, medium 560px, large 720px. Padding 24px;
title→description 8px; description→content 24px; content→actions 24px.

## 42. Mobile Modal

Use bottom sheets for simple workflows and full-screen mobile panels for
complex ones.

## 43. Toast Notifications

Desktop width 320--400px, padding 12px 16px. Phone uses 16px left/right.
State exactly what happened rather than only "Success".

## 44. Empty States

Use calm text and a small icon. Example: "No defects found --- No
defects have been reported for this machine today." Avoid giant
illustrations.

## 45. Loading States

Use skeletons for data. Buttons should say what they are doing, such as
`Saving…`, rather than generic `Loading…`.

## 46. Interactive States

Desktop: Default, Hover, Pressed, Focus, Disabled. Touch: Default,
Pressed, Focus, Disabled. Essential information must never exist only on
hover.

## 47. Desktop → iPhone Interactive Scaling

  Component              Desktop       iPhone       Change
  ----------------- ------------ ------------ ------------
  Primary button              40           48         +20%
  Input                       40           48         +20%
  Interactive row             44           52         +18%
  Checkbox target             32           44         +38%
  Icon button                 36           44         +22%
  Dropdown row                36           48         +33%
  Nav item                    40           48         +20%
  Page title                  32           26         −19%
  Body                        14           16         +14%
  Page padding                32           16         −50%
  Section spacing             32           24         −25%
  Card padding                24           16         −33%
  Grid                12 columns            1   Structural
  Sidebar                    240            0      Removed
  Modal                      560   Full width   Structural

Space shrinks. Decorative hierarchy shrinks. Interaction grows.

## 48. Touch Philosophy

Assume factory users may be standing, moving, working quickly, viewing
from farther away, distracted, or occasionally using gloves. Prefer
\~44×44px or larger important touch targets. FREYA should be less dense
than Excel where operational clarity benefits.

## 49. Desktop Information Density

Comfortable = 48px rows; Standard = 44px; Compact = 36px. Standard is
default. Compact may be an administrator preference on desktop only; do
not use it for touch-first screens.

## 50. Japanese Text

Avoid brittle fixed-width controls. Prefer `min-width` plus horizontal
padding so Japanese translations can grow naturally.

## 51. Numbers

``` css
font-variant-numeric: tabular-nums;
```

Use for production quantity, cycle time, defects, utilization,
dates/times, temperatures, and inventory.

## 52. Data Alignment

Text left; numbers right; status usually left; actions right. Avoid
center-aligning complete industrial tables.

## 53. Destructive Actions

Put low-frequency destructive actions inside an overflow menu and
visually separate Delete from Edit/Duplicate/Archive.

## 54. Focus States

``` css
outline: 2px solid #2563EB;
outline-offset: 2px;
```

Maintain strong keyboard/scanner focus visibility.

## 55. Scanner / QR Workflows

Normal input 40--48px; active scan input 52--56px. Display immediate
match/mismatch results prominently so the operator can understand the
result at a glance.

## 56. Error Design

Use human-readable error messages with Expected, Scanned/Received, and a
clear recovery action. Technical error IDs remain secondary.

## 57. Dashboard Visual Hierarchy

Every dashboard should answer: **Is everything okay? What requires
attention? What should I do?** Operational urgency should outrank
alphabetical/database ordering.

## 58. FREYA Brand Accent Rule

Blue should occupy roughly 5--10% of the interface. Most UI is
white/near-white, navy/near-black, slate, and neutral gray. Blue
represents action, selection, focus, and important information.

## 59. Logo Placement

Desktop sidebar \~145px; login 220--280px; tablet login 190--220px;
phone login 160--190px. Branding establishes identity without dominating
working screens.

## 60. FREYA Login Screen

Keep login extremely minimal: FREYA SYSTEMS logo, Welcome back, Employee
ID, Password, Sign In, and organization identification. Avoid decorative
circuit backgrounds, AI gradients, and unnecessary illustrations.

## 61. FREYA Design Token Foundation

``` css
:root {
  --freya-blue: #2563EB;

  --text-primary: #0F172A;
  --text-secondary: #334155;
  --text-muted: #64748B;

  --page-bg: #F8FAFC;
  --surface: #FFFFFF;
  --border: #E5E7EB;

  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-card: 8px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
}

[data-theme="dark"] {
  --text-primary: #F8FAFC;
  --text-secondary: #CBD5E1;
  --text-muted: #94A3B8;

  --page-bg: #07090D;
  --surface: #0F172A;
  --border: #1E293B;
}
```

Components should consume semantic tokens rather than maintain separate
light/dark implementations.

------------------------------------------------------------------------

# FREYA Responsive Philosophy

**An iPhone interface is not FREYA Desktop × 70%.**

As the viewport contracts:

-   Horizontal padding decreases about 25--50%.
-   Section/card spacing decreases about 20--33%.
-   Large headings decrease about 10--20%.
-   Body/functional text stays constant or grows about 7--14%.
-   Touch controls grow about 18--38%.
-   Low-priority data moves into details/expansion.
-   Multi-column layouts reorganize structurally.
-   Desktop sidebars disappear.
-   Wide tables become cards/details where necessary.

The same identity therefore works across factory monitors, desktop
workstations, tablets, and iPhones.

# FREYA Systems --- Design Character

Every decision should reinforce:

**Industrial · Powerful · Precise · Minimal**

The interface should feel **engineered rather than decorated**. It
exists to make production state obvious, reduce human error, and make
the correct next action clear.

**FREYA SYSTEMS**\
*Precision in every detail.*
