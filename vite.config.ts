import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000, // Aumenta limite para 1MB (aceitável para Dashboards)
    rollupOptions: {
      output: {
        manualChunks: {
          // Separa bibliotecas pesadas em chunks individuais para melhor cache
          vendor: ['react', 'react-dom', 'lucide-react'],
          charts: ['recharts'],
          excel: ['xlsx'], // XLSX é muito grande, deve ficar isolado
          db: ['@supabase/supabase-js']
        }
      }
    }
  },
  server: {
    port: 3000,
  }
});