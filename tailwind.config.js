/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          primary: '#0F1923',
          secondary: '#1E2D3D',
          elevated: '#243447',
        },
        accent: {
          blue: '#3B8BEB',
          light: '#63B3ED',
        },
        text: {
          primary: '#F7FAFC',
          secondary: '#A0AEC0',
          muted: '#4A5568',
        },
        danger: '#E53E3E',
        warning: '#DD6B20',
        safe: '#38A169',
        border: '#2D3748',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
