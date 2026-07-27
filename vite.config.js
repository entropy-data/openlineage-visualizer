import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  // React's production entry point reads process.env.NODE_ENV. In library mode
  // Vite does not auto-substitute this, so we define it explicitly to avoid a
  // ReferenceError at runtime in browsers without a `process` global.
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: resolve(import.meta.dirname, 'src/main.jsx'),
      formats: ['es'],
      fileName: () => 'assets/index.js',
    },
    cssCodeSplit: false,
    rolldownOptions: {
      output: {
        exports: 'named',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'assets/index.css';
          }
          return 'assets/[name][extname]';
        },
      },
    },
  },
});
