import { defineConfig } from 'vitest/config'

// The drawing and the rules are the mod's own files, one folder up.
export default defineConfig({
  clearScreen: false,
  // The mod's own tsconfig extends a file Claude Code writes when it loads the plugin; it is not there in a build.
  tsconfig: './tsconfig.json',
  server: { port: 1420, strictPort: true, fs: { allow: ['..'] } },
  build: { target: ['chrome105', 'safari15'], outDir: 'dist', emptyOutDir: true },
  test: { include: ['src/**/*.spec.ts'] },
})
