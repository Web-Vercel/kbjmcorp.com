/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 50: '#f1f5f9', 700: '#234e7b', 800: '#1e4268', 900: '#172f4d', 950: '#0f2238' },
        gold: { 400: '#f5b82e', 500: '#e99a16', 600: '#c8790d' },
        ink: '#101b2e',
        mist: '#f4f6f8'
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui']
      },
      boxShadow: { soft: '0 24px 70px -35px rgba(15,34,56,.38)' }
    }
  },
  plugins: []
}
