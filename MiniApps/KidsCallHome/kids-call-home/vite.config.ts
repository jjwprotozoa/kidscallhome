import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    global: 'globalThis',
    'process.env': '{}',
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    'global.exports': '{}',
    'global.require': 'undefined',
  },
  optimizeDeps: {
    include: ['simple-peer'],
  },
  build: {
    commonjsOptions: {
      include: [/simple-peer/, /node_modules/],
      transformMixedEsModules: true,
      requireReturnsDefault: 'auto',
    },
  },
  resolve: {
    alias: {
      util: path.resolve(__dirname, 'src/utils/util-polyfill.js'),
    },
  },
  server: {
    port: 3000,
    host: true, // This will bind to both IPv4 and IPv6
    hmr: {
      port: 3000,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
