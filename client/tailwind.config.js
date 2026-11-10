/** Every colour is a CSS variable filled at runtime from the gym's logo-derived theme. */
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        surface2: v('surface2'),
        line: v('border'),
        ink: v('text'),
        muted: v('muted'),
        primary: v('primary'),
        'on-primary': v('onPrimary'),
        secondary: v('secondary'),
        'on-secondary': v('onSecondary'),
        accent: v('accent'),
        'on-accent': v('onAccent'),
        link: v('link'),
      },
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-body)', 'system-ui', 'sans-serif'],
      },
      borderRadius: { brand: 'var(--radius)' },
      boxShadow: { soft: '0 1px 2px rgb(0 0 0 / .05), 0 8px 24px -12px rgb(0 0 0 / .18)' },
    },
  },
  plugins: [],
};
