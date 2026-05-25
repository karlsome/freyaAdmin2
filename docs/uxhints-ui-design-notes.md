# UX Hints Study Notes

**Date:** 2026-05-23  
**Status:** Research only. No Freya Admin 2 UI changes are proposed or applied in this document.

## What UX Hints Is

UX Hints is a library of short UX/UI cheat sheets. The site is built around compact concept pages with:

- a short explanation of a design principle or framework
- a small set of practical tips
- a downloadable PDF cheat sheet
- source references for deeper reading

The format is intentionally concise. It is more useful as a design review checklist and reminder system than as a deep theory resource.

## What I Learned

### 1. Good UI should be evaluated as a composition, not just as separate components

From the "Design Principles in UI" page, the strongest takeaway is that a screen should be judged by how multiple principles work together, not by whether one component looks polished in isolation.

The page emphasizes these principles:

- balance
- contrast
- emphasis
- hierarchy
- similarity
- unity

What that means in practice:

- balance keeps layouts from feeling visually lopsided or unstable
- contrast helps users distinguish primary from secondary information and active from inactive states
- emphasis clarifies what deserves attention first
- hierarchy shapes scan order and reading flow
- similarity reinforces consistency and makes repeated patterns easier to learn
- unity makes the whole product feel like one system instead of many disconnected screens

The useful mindset here is that strong UI usually comes from a good combination of principles rather than maximizing a single one.

### 2. Grouping reduces cognitive load faster than adding explanation text

From the "6 Gestalt Principles in UX Design" page, the core lesson is that people naturally read interfaces as organized patterns. When grouping is clear, the UI feels easier before the user reads much of anything.

The clearest practical tips highlighted on the page are:

- organize UI and content using grouping principles to reduce cognitive load
- use proximity to place related things together
- use similarity to make repeated patterns feel consistent

This matters because layout itself can communicate relationships without adding extra labels or instructions.

### 3. Simplicity is not aesthetic minimalism only; it is fewer assumptions, fewer steps, fewer decisions

From the "Occam's Razor Law in UX Design" page, the most useful interpretation is that the simplest workable path is usually the best one.

Practical guidance called out on the page:

- streamline menus and group similar items for easier navigation
- break complex tasks into smaller steps with clear instructions
- use autofill where possible and keep only essential form fields
- keep visual language, typography, and color use consistent
- remove features that do not support user goals
- test with users and refine continuously

This is especially relevant for dense products because complexity often arrives through accumulated exceptions, options, and edge-case controls.

### 4. Interaction cost matters: important targets should be easier to hit and closer to the next action

From the "Fitts's Law in UX Design" page, the key lesson is that the time and effort required to hit a target depends on its size and distance.

Practical tips from the page:

- reduce the distance between one action and the next
- make important interactive targets large enough to hit reliably
- make checkbox or radio labels part of the clickable area
- leave enough space between nearby controls for error prevention
- do not over-compress layouts just to fit more on screen

The important nuance is that bigger is not always better. Target size, spacing, and hierarchy have to work together.

### 5. Accessibility should be treated as a structural quality, not a final polish pass

From the "Web Accessibility Principles (POUR)" page and the "WCAG 2.1 Map" page, accessibility is framed as a baseline operating standard for web products.

The four POUR principles are:

- Perceivable
- Operable
- Understandable
- Robust

Practical implications called out by UX Hints:

- text alternatives should describe semantic purpose, not just appearance
- avoid flashing content and provide a way to switch off animations
- provide multiple ways to find content, such as navigation plus search
- ensure motion-based actions also have standard UI alternatives
- make buttons and links large enough for touch and easy activation
- define the page language
- keep navigation consistent
- do not make major changes without user consent
- provide descriptive instructions and clear error messages
- review each page against WCAG success criteria rather than relying only on automation

This is a strong reminder that accessibility is tied to content structure, control design, state changes, and messaging, not just color contrast.

### 6. Typography is part of usability, especially in dense interfaces

From the "Typography Anatomy" page, the main lesson is that typography choices affect legibility and scan speed more than many teams expect.

The practical tips surfaced on the page are simple but useful:

- adjust leading to preserve legibility
- adjust tracking carefully to support readable text blocks
- keep spacing between letters balanced

The page is mostly a terminology reference, but the bigger takeaway is that typography is a functional system, not decoration.

## What Stands Out About The Site Itself

The site is a useful example of knowledge packaging for designers:

- each page is short and highly scannable
- the advice is framed as checklists and practical tips rather than essays
- the same structure repeats across topics, which makes the library easy to browse
- the downloadable PDFs suggest a workflow where designers keep lightweight review sheets nearby

That packaging style is part of the lesson. The site does a good job of turning abstract design ideas into compact review criteria.

## Most Useful Themes To Carry Forward Later

Without applying anything yet, the ideas that seem most relevant for a future Freya Admin 2 design pass are:

- visual hierarchy
- grouping and proximity
- simplicity in navigation and forms
- target size and spacing for actions
- accessibility as a page-by-page review discipline
- typography as a readability system for dense screens

For now, these are only study notes and not a design recommendation set.

## Source Pages Reviewed

- https://uxhints.com/
- https://uxhints.com/visual-ui-design/design-principles-in-ui/
- https://uxhints.com/visual-ui-design/gestalt-principles/
- https://uxhints.com/ux-laws/occams-razor-law-in-ux-design/
- https://uxhints.com/ux-laws/fitts-law-ux-design/
- https://uxhints.com/accessibility/accessibility-principles/
- https://uxhints.com/accessibility/wcag-2-1-map/
- https://uxhints.com/typography/typography-anatomy/