import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendDevProxyTarget =
    env.VITE_BACKEND_DEV_PROXY_TARGET || 'http://localhost:3000';

  return {
    plugins: [vue(), tailwindcss()],
    server: {
      proxy: {
        '/graphql': {
          target: backendDevProxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
