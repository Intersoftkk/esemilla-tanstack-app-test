import { defineConfig, loadEnv } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { paraglideVitePlugin } from '@inlang/paraglide-js'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig(({ mode }) => {
  // Make non-VITE_ vars from .env available to server code via process.env
  // during development (in production, set real environment variables).
  const loaded = loadEnv(mode, process.cwd(), '')
  for (const [key, value] of Object.entries(loaded)) {
    process.env[key] ??= value
  }

  return {
    resolve: { tsconfigPaths: true },
    server: {
      host: '0.0.0.0',
      // Tenants are served from arbitrary sub-domains and custom domains.
      allowedHosts: true,
    },
    preview: { host: '0.0.0.0', allowedHosts: true },
    plugins: [
      devtools(),
      paraglideVitePlugin({
        project: './project.inlang',
        outdir: './src/paraglide',
        strategy: ['url', 'baseLocale'],
      }),
      nitro({ rollupConfig: { external: [/^@sentry\//] } }),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
    ],
  }
})

export default config
