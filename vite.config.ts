import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Pinned so the origin matches BETTER_AUTH_URL and auth's trustedOrigins;
    // strictPort fails loudly instead of silently hopping to a different port.
    port: 5199,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
