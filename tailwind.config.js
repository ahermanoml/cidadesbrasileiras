/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: '#EDE6D3',
          warm: '#E5DCC2',
          deep: '#D8CDB0',
          fold: '#C9BD9C',
        },
        ink: {
          DEFAULT: '#15140F',
          70: '#3A382F',
          50: '#6B6655',
          30: '#9A937D',
          15: '#C5BEA6',
        },
        verde: {
          DEFAULT: '#1F3D2E',
          deep: '#11261C',
          mid: '#2E5A45',
        },
        terra: {
          DEFAULT: '#A0432A',
          deep: '#7A3220',
          light: '#C66A4F',
        },
        ocre: {
          DEFAULT: '#C9933E',
          deep: '#9A6E2A',
          light: '#E2B265',
        },
        atlantic: '#3D5A6C',
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        sans: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.04em',
        editorial: '-0.02em',
      },
      boxShadow: {
        card: '0 1px 0 #C9BD9C, 0 12px 30px -18px rgba(21,20,15,0.45)',
      },
    },
  },
  plugins: [],
}
