import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#0B1F3B',
          emerald: '#16A34A',
          background: '#f8fafc',
          text: '#0f172a',
          border: '#e2e8f0',
        },
      },
      boxShadow: {
        panel: '0 4px 20px -2px rgba(11, 31, 59, 0.05)',
        glow: '0 0 20px rgba(22, 163, 74, 0.15)',
      },
      borderRadius: {
        xl2: '1rem',
      },
    },
  },
  plugins: [],
};

export default config;
