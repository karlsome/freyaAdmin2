/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // All colors defined as CSS variables so they switch between light/dark automatically.
        // The <alpha-value> placeholder enables Tailwind opacity modifiers (e.g. bg-primary/10).
        "background":               "rgb(var(--c-background) / <alpha-value>)",
        "surface":                  "rgb(var(--c-surface) / <alpha-value>)",
        "surface-container":        "rgb(var(--c-surface-container) / <alpha-value>)",
        "surface-container-lowest": "rgb(var(--c-surface-container-lowest) / <alpha-value>)",
        "surface-container-low":    "rgb(var(--c-surface-container-low) / <alpha-value>)",
        "surface-container-high":   "rgb(var(--c-surface-container-high) / <alpha-value>)",
        "surface-container-highest":"rgb(var(--c-surface-container-highest) / <alpha-value>)",
        "on-surface":               "rgb(var(--c-on-surface) / <alpha-value>)",
        "on-surface-variant":       "rgb(var(--c-on-surface-variant) / <alpha-value>)",
        "on-background":            "rgb(var(--c-on-background) / <alpha-value>)",
        "primary":                  "rgb(var(--c-primary) / <alpha-value>)",
        "primary-container":        "rgb(var(--c-primary-container) / <alpha-value>)",
        "on-primary":               "rgb(var(--c-on-primary) / <alpha-value>)",
        "on-primary-container":     "rgb(var(--c-on-primary-container) / <alpha-value>)",
        "secondary":                "rgb(var(--c-secondary) / <alpha-value>)",
        "secondary-container":      "rgb(var(--c-secondary-container) / <alpha-value>)",
        "tertiary":                 "rgb(var(--c-tertiary) / <alpha-value>)",
        "error":                    "rgb(var(--c-error) / <alpha-value>)",
        "error-container":          "rgb(var(--c-error-container) / <alpha-value>)",
        "on-error":                 "rgb(var(--c-on-error) / <alpha-value>)",
        "on-error-container":       "rgb(var(--c-on-error-container) / <alpha-value>)",
        "outline":                  "rgb(var(--c-outline) / <alpha-value>)",
        "outline-variant":          "rgb(var(--c-outline-variant) / <alpha-value>)",
        "lavender":                 "rgb(var(--c-lavender) / <alpha-value>)",
        "separator":                "rgb(var(--c-separator) / <alpha-value>)",
      },
      fontFamily: {
        headline: ["Inter", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        label: ["Inter", "system-ui", "sans-serif"],
      },
      // ─── Snow-style type scale ──────────────────────────────────────────────
      // Named steps replace ad-hoc text-[10px]/[11px] literals. Inter reads
      // "thin and precise" with negative tracking on the larger sizes.
      fontSize: {
        display:  ["1.875rem", { lineHeight: "2.25rem", letterSpacing: "-0.02em",  fontWeight: "600" }], // 30px
        h1:       ["1.5rem",   { lineHeight: "2rem",     letterSpacing: "-0.015em", fontWeight: "600" }], // 24px
        h2:       ["1.125rem", { lineHeight: "1.625rem", letterSpacing: "-0.01em",  fontWeight: "600" }], // 18px
        h3:       ["1rem",     { lineHeight: "1.5rem",   letterSpacing: "-0.01em",  fontWeight: "600" }], // 16px
        caption:  ["0.75rem",  { lineHeight: "1rem" }],                                                   // 12px
        overline: ["0.6875rem",{ lineHeight: "0.875rem", letterSpacing: "0.18em",  fontWeight: "600" }], // 11px
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px",
      },
    },
  },
  plugins: [],
};
