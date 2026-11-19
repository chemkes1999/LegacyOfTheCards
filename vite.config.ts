import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(import.meta.dirname, 'dist');
          const srcAssets = path.resolve(import.meta.dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
      {
        name: 'ygoprodeck-image-proxy',
        configureServer(server) {
          server.middlewares.use('/api/ygo-img', async (req, res, next) => {
            try {
              const reqUrl = new URL(req.url ?? '', 'http://localhost');
              const target = reqUrl.searchParams.get('url');
              if (!target || !target.startsWith('https://images.ygoprodeck.com/')) {
                res.statusCode = 400;
                res.end('Invalid image URL');
                return;
              }
              const upstream = await fetch(target);
              if (!upstream.ok) {
                res.statusCode = upstream.status;
                res.end('Upstream error');
                return;
              }
              const contentType = upstream.headers.get('content-type') || 'image/jpeg';
              const buf = Buffer.from(await upstream.arrayBuffer());
              res.setHeader('Content-Type', contentType);
              res.setHeader('Cache-Control', 'public, max-age=86400');
              res.end(buf);
            } catch {
              next();
            }
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: 'vendor-three', test: /[\\/]node_modules[\\/]three[\\/]/ },
              { name: 'vendor-react', test: /[\\/]node_modules[\\/](react|react-dom|lucide-react)[\\/]/ },
            ],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
