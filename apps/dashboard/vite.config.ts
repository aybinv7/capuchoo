import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import Layouts from 'vite-plugin-vue-layouts'

import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import AutoImport from 'unplugin-auto-import/vite'
import IconsResolver from 'unplugin-icons/resolver'
import Icons from 'unplugin-icons/vite'
import Imagemin from 'unplugin-imagemin/vite'
import TurboConsole from 'unplugin-turbo-console/vite'
import Components from 'unplugin-vue-components/vite'
import { VueRouterAutoImports } from 'unplugin-vue-router'
import VueRouter from 'unplugin-vue-router/vite'

export default defineConfig({
  plugins: [
    VueRouter({
      exclude: ['src/pages/**/components/'],
    }),
    vue(),

    vueDevTools(),
    Layouts({
      layoutsDirs: 'src/layouts',
      defaultLayout: 'Authenticated',
    }),
    tailwindcss(),
    TurboConsole(),
    VueI18nPlugin({
      include: 'src/locales/**',
    }),
    AutoImport({
      include: [/\.[tj]sx?$/, /\.vue$/, /\.vue\?vue/, /\.md$/],
      imports: ['vue', 'pinia', VueRouterAutoImports, '@vueuse/core', 'vue-i18n'],
      dirs: [
        'src/utils/**/**',
        'src/lib/**/**',
        'src/services/**/**',
        'src/types/**/**',
        'src/composables/**/**/**/**',
        'src/stores/**/**',
        'src/components/**/**',
        'src/pages/**/components/**',
        'src/pages/components/**',
        'src/modules/**/**',
      ],
      dts: 'auto-imports.d.ts',
      vueTemplate: true,
      viteOptimizeDeps: true,
      injectAtEnd: true,
      dirsScanOptions: { types: true },
      eslintrc: {
        enabled: true,
        filepath: './.eslintrc-auto-import.json',
      },
    }),
    Components({
      dts: 'components.d.ts',
      dirs: [
        'src/components/**',
        'src/pages/**/components/**',
        'src/pages/components/**',
        'src/modules/**/components/**',
      ],
      extensions: ['vue'],
      deep: true,
      directoryAsNamespace: true,
      resolvers: [IconsResolver({ prefix: 'i' })],
    }),
    Icons({
      autoInstall: true,
      defaultClass: 'icon-global',
    }),
    // Imagemin({
    //   cache: false,
    //   compress: {
    //     jpg: { quality: 80, progressive: true },
    //     jpeg: { quality: 80, progressive: true },
    //     png: { quality: 0.8 },
    //     webp: { quality: 80 },
    //   },
    //   conversion: [
    //     { from: 'png', to: 'webp' },
    //     { from: 'jpg', to: 'webp' },
    //   ],
    // }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@pages': resolve(__dirname, './src/pages'),
      '@assets': resolve(__dirname, './src/assets'),
      '@modules': resolve(__dirname, './src/modules'),
    },
  },

  build: {
    cssCodeSplit: true,
  },

  optimizeDeps: {
    include: ['vue', 'vue-router', 'pinia', '@vueuse/core'],
  },
})
