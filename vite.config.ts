import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const caldavTarget = env.VITE_CALDAV_SERVER_URL || 'http://localhost:5232'
  const caldavUser = env.VITE_CALDAV_USERNAME || 'user'

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/.well-known/caldav': {
          target: caldavTarget,
          changeOrigin: true,
          secure: false,
        },
        [`/${caldavUser}`]: {
          target: caldavTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
