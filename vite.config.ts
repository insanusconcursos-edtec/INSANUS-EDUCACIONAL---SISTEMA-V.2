import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173
    },
    // Define 'process.env' para evitar erro "process is not defined" no navegador
    // E injeta a API_KEY se disponível
    define: {
      'process.env': {
        API_KEY: JSON.stringify(env.API_KEY || ''),
        NODE_ENV: JSON.stringify(mode)
      }
    },
    build: {
      chunkSizeWarningLimit: 1600,
    }
  };
});