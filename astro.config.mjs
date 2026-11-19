import { defineConfig } from 'astro/config';
import config from './site.config.mjs';

export default defineConfig({
  site: config.site,
  // Если репозиторий называется не <логин>.github.io, а, например, blog,
  // укажите здесь base: '/blog'
  base: '/',
});
