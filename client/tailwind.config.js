/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        void: '#05050A',
        ink: '#0A0B12',
        surface: '#10121C',
        line: 'rgba(255,255,255,0.08)',
        mint: '#00E5A0',
        coral: '#FF4D6D',
        violet: '#7B61FF',
        sky: '#38BDF8',
        amber: '#FBBF24',
        muted: '#8A8FA3',
        bone: '#EDEFF5',
      },
      fontFamily: {
        display: ['"Clash Display"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 40px -10px rgba(0,229,160,0.55)',
        'glow-coral': '0 0 40px -10px rgba(255,77,109,0.5)',
        card: '0 30px 60px -30px rgba(0,0,0,0.9)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.06)',
      },
      backgroundImage: {
        'radial-fade':
          'radial-gradient(ellipse at top, rgba(123,97,255,0.18), transparent 60%), radial-gradient(ellipse at bottom right, rgba(0,229,160,0.14), transparent 55%)',
        'grid-pattern':
          'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
      },
      animation: {
        'spin-slow': 'spin 24s linear infinite',
        marquee: 'marquee 34s linear infinite',
        float: 'float 7s ease-in-out infinite',
        shimmer: 'shimmer 2.4s linear infinite',
        pulseRing: 'pulseRing 2.6s ease-out infinite',
        aurora: 'aurora 16s ease-in-out infinite alternate',
      },
      keyframes: {
        marquee: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
        float: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-14px)' },
        },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        pulseRing: {
          '0%': { transform: 'scale(0.85)', opacity: '0.9' },
          '100%': { transform: 'scale(1.7)', opacity: '0' },
        },
        aurora: {
          '0%': { transform: 'translate3d(-8%, -4%, 0) scale(1)' },
          '100%': { transform: 'translate3d(8%, 6%, 0) scale(1.25)' },
        },
      },
      perspective: { 1200: '1200px', 1600: '1600px' },
    },
  },
  plugins: [],
};
