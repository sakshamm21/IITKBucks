import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The node runs on port 3000 by default. Keeping it configurable avoids hardcoding a
// port the developer may have changed for local testing.
const nodePort = process.env.VITE_DEV_NODE_PORT ?? '3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
      // On Windows and newer Node releases Vite's default host resolves to ::1 only,
      // so http://127.0.0.1:5173 fails with ECONNREFUSED even though the server is
      // running. Pinning 127.0.0.1 makes the printed URL actually work.
      host: '127.0.0.1',
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${nodePort}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
