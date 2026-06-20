/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        xavvy: {
          bg: '#05070B',        // Deep obsidian background space
          surface: '#0B0F17',   // Slate-structured dark card surface
          elevated: '#121824',  // Lighter gray for popups / input fields
          border: '#1E293B',    // Clean, crisp thin borders
          accent: '#3B82F6',    // Deep vibrant sapphire blue
          neon: '#00F5FF',      // Electric cyan highlight lines
          textMuted: '#94A3B8'  // Soft readable typography gray
        }
      },
      boxShadow: {
        'premium': '0 4px 30px rgba(0, 0, 0, 0.4)',
        'glow': '0 0 20px rgba(59, 130, 246, 0.15)'
      }
    },
  },
  plugins: [],
}