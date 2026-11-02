import { defineConfig } from 'vitest/config'
// Pipeline worktrees need no generated Nuxt types to run domain/network tests.
export default defineConfig({ esbuild: { tsconfigRaw: JSON.stringify({ compilerOptions: { target: 'ES2022', useDefineForClassFields: true } }) }, test: { include: ['tests/**/*.test.ts'], environment: 'node' } })
