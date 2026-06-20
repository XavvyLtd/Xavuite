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
          bg: '#020617',        // Deep obsidian canvas base background
          surface: '#0f172a',   // Dark premium panels layer
          elevated: '#1e293b',  // Highlights hover states
          border: '#334155',    // Muted thin border dividers
          accent: '#3b82f6',    // High-performance Xavvy blue highlight tint
          textMuted: '#64748b'  // Sleek metadata secondary typography color
        }
      },
      boxShadow: {
        premium: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        glow: '0 0 20px rgba(59, 130, 246, 0.15)'
      }
    },
  },
  plugins: [],
}