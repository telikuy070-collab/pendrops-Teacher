import { defineConfig, loadEnv } from 'vite';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Vite plugin to inject Supabase configuration into the service worker.
 *
 * The service worker (`sw.js`) is not part of the Vite module graph (it's
 * registered dynamically at runtime), so the `define` option does not apply
 * to it. This plugin copies `sw.js` into the build output directory during
 * `build`, replacing the `__SUPABASE_URL__` and `__SUPABASE_ANON_KEY__`
 * placeholders with the values from the environment.
 */
function swConfigInjector(mode, cwd) {
  return {
    name: 'sw-config-injector',
    apply: 'build',
    closeBundle() {
      const swPath = resolve(cwd, 'sw.js');
      if (!existsSync(swPath)) return;

      let content = readFileSync(swPath, 'utf-8');
      const env = loadEnv(mode, cwd);

      const supabaseUrl = env.VITE_SUPABASE_URL || '';
      const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || '';

      content = content
        .replace(/__SUPABASE_URL__/g, supabaseUrl)
        .replace(/__SUPABASE_ANON_KEY__/g, supabaseAnonKey);

      const outPath = resolve(cwd, 'dist', 'sw.js');
      writeFileSync(outPath, content, 'utf-8');
    },
  };
}

/**
 * Vite config for PenDrops PWA.
 *
 * This app is a vanilla ES module PWA with no framework. Vite provides:
 * - Dev server with HMR
 * - TypeScript transpilation (no type-checking at runtime — that's what
 *   `tsc --noEmit` is for)
 * - Build with Rollup
 * - Environment variable injection via `import.meta.env`
 *
 * The app is deploy-target-agnostic: it builds static files to `dist/`.
 * For GitHub Pages, we set `base` to the repo path.
 */
export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';
  const repoName = 'telikuy070-collab/pendrops';
  const [, repoOnly] = repoName.split('/');

  return {
    // GitHub Pages serves from /<repo-name>/ subdirectory
    base: isProd ? `https://telikuy070-collab.github.io/${repoOnly}/` : '/',
    root: '.',
    publicDir: 'public',
    server: {
      port: 8080,
      open: true,
    },
    plugins: [swConfigInjector(mode, process.cwd())],
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: !isProd,
      rollupOptions: {
        input: {
          main: new URL('./index.html', import.meta.url).pathname,
        },
        output: {
          // Code-split vendor libs separately for better caching
          // Rolldown (Vite 8 default) requires manualChunks as a function
          manualChunks: (id) => {
            if (id.includes('node_modules/xlsx')) return 'xlsx';
            if (id.includes('node_modules/zod')) return 'zod';
          },
          // Hash-based filenames for cache busting
          entryFileNames: 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash][extname]',
        },
      },
    },
    // Environment variables — prefix VITE_ to expose to client
    define: {
      __APP_VERSION__: JSON.stringify('1.7.0'),
    },
    resolve: {
      alias: {
        // Allow cleaner imports in future
      },
    },
  };
});
