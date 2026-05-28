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
        headline: ["DM Sans", "sans-serif"],
        body: ["DM Sans", "sans-serif"],
        label: ["DM Sans", "sans-serif"],
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
