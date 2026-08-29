import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff', 100: '#d9ebff', 500: '#2563eb',
          600: '#1d4ed8', 700: '#1e40af',
        },
      },
    },
  },
  plugins: [],
};
export default config;
