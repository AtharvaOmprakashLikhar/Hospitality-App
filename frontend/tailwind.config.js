/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: 'hsl(var(--color-primary) / <alpha-value>)',
        secondary: 'hsl(var(--color-secondary) / <alpha-value>)',
        bg: 'hsl(var(--color-bg) / <alpha-value>)',
        surface: 'hsl(var(--color-surface) / <alpha-value>)',
        text: 'hsl(var(--color-text) / <alpha-value>)',
        btn: {
          DEFAULT: 'hsl(var(--color-btn) / <alpha-value>)',
          hover: 'hsl(var(--color-btn-hover) / <alpha-value>)',
          active: 'hsl(var(--color-btn-active) / <alpha-value>)',
          disabled: 'hsl(var(--color-btn-disabled) / <alpha-value>)',
        },
        border: 'hsl(var(--color-border) / <alpha-value>)',
      }
    },
  },
  plugins: [],
}
