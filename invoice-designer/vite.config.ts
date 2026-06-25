import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'InvoiceDesignerModule',
      formats: ['iife'],
      fileName: () => 'invoice-designer.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: 'invoice-designer.[ext]',
        inlineDynamicImports: true,
      },
    },
    outDir: '../dist/invoice-designer',
    emptyOutDir: true,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
});
