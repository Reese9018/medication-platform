import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    // dev 模式下让 axios 用相对路径 /api/v1 时，vite 自动转发到 FastAPI 8000 端口
    // 好处：① 不用硬编码 http://localhost:8000 ② 跨域由代理托管，无 CORS 配置负担
    // ③ 后端偶尔挂掉也不会被 CORS 错误误导，错误更直观
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        proxyTimeout: 30000,
        // 当后端没跑（ECONNREFUSED）时，vite 默认抛 500 烂码，
        // 我们拦截并改写成 503 + 结构化 detail，让前端 toast 给出精准指引
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            const msg = String((err as NodeJS.ErrnoException)?.code || err?.message || 'unknown');
            const body = JSON.stringify({
              detail: `后端服务不可达（${msg}）。请运行 npm run dev:all 启动后端`,
            });
            (res as any).writeHead?.(503, { 'Content-Type': 'application/json; charset=utf-8' });
            (res as any).end?.(body);
          });
        },
      },
    },
  },
  build: {
    // 关掉 Vite 默认的 prepareOutDir 清空逻辑，避免触发宿主环境的 safe-delete 钩子
    // 旧产物通过 `npm run build` 前手动运行 `npm run clean` 清理（见 package.json）
    emptyOutDir: false,
  },
});
