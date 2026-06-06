import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/src-tauri/target/**'],
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
