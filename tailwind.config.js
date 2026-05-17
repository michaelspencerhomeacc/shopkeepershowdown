/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        parchment: {
          50: '#fdf8f0',
          100: '#faefd8',
          200: '#f4dba8',
          300: '#ecc470',
          400: '#e4a83a',
          500: '#d4901e',
          600: '#b87416',
          700: '#925814',
          800: '#764617',
          900: '#623a18',
        },
        tavern: {
          50: '#fdf4f0',
          100: '#fae3d8',
          200: '#f5c4a8',
          300: '#ee9e70',
          400: '#e67340',
          500: '#d4561e',
          600: '#b34018',
          700: '#8f3016',
          800: '#742818',
          900: '#5f2217',
        },
        gold: {
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        ink: {
          900: '#1a1208',
          800: '#2d1f0e',
          700: '#3d2b14',
        },
      },
      fontFamily: {
        display: ['"Cinzel"', 'Georgia', 'serif'],
        body: ['"Crimson Text"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
