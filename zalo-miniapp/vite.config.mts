import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import zaloMiniApp from 'zmp-vite-plugin';

// zmp-vite-plugin đóng gói theo cấu trúc Zalo yêu cầu khi chạy `zmp deploy`
export default defineConfig({
  root: '.',
  base: '',
  plugins: [zaloMiniApp(), react()],
  server: { port: 3000 },
  build: { target: 'es2020', assetsInlineLimit: 0 },
});
