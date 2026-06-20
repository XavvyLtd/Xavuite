import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Appends an absolute epoch timestamp hash to every compiled script/style asset
        entryFileNames: `assets/[name]-clean-${Date.now()}.js`,
        chunkFileNames: `assets/[name]-clean-${Date.now()}.js`,
        assetFileNames: `assets/[name]-clean-${Date.now()}.[ext]`
      }
    }
  }
});