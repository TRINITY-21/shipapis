import { defineConfig } from 'vitest/config'

// The Worker gracefully falls back to the seed catalog when the D1 binding is absent
// (src/data/catalog.ts), so the whole app — routing, /api/v1, MCP, SSR pages — runs under
// plain Node via `app.fetch(req, { DB: undefined })`. That keeps the suite fast and
// deterministic; the D1 overlay path is covered separately with an in-memory D1 mock.
export default defineConfig({
  // hono/jsx SSR: transform .tsx with the automatic runtime pointing at hono/jsx.
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'hono/jsx',
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    // seed.ts builds ~1000 records at import; give module eval room and run files in a pool.
    testTimeout: 15_000,
    hookTimeout: 15_000,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      // Data blobs, generated types and OG/diagram art are not logic under test.
      exclude: [
        'src/data/seed-imported.ts',
        'src/**/*.d.ts',
        'src/ui/og/**',
        'src/ui/start/**',
        'src/routes/og-card.tsx',
      ],
    },
  },
})
