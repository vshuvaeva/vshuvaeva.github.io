// Забирает посты из публичного Telegram-канала через его веб-версию
// (https://t.me/s/<канал>) и сохраняет их в content/posts/<id>.json.
// Картинки скачиваются в public/media/.
//
// Запуск: npm run fetch          — докачать новые посты (и обновить последние)
//         npm run fetch -- --all — перекачать весь канал заново

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import config from '../site.config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POSTS_DIR = path.join(ROOT, 'content', 'posts');
const MEDIA_DIR = path.join(ROOT, 'public', 'media');
const CHANNEL_FILE = path.join(ROOT, 'content', 'channel.json');
const BASE = `https://t.me/s/${config.channel}`;
const UA = 'Mozilla/5.0 (compatible; blog-sync/1.0)';
const FULL = process.argv.includes('--all');
const HIDDEN = new Set(config.hiddenPosts || []);
const REFRESH_PAGES = 2; // сколько свежих страниц перечитывать всегда (правки, просмотры)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, asBuffer = false) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return asBuffer ? Buffer.from(await res.arrayBuffer()) : await res.text();
    } catch (err) {
      if (attempt === 3) throw new Error(`${url}: ${err.message}`);
      await sleep(2000 * attempt);
    }
  }
}

const bgUrl = (style = '') => {
  const m = style.match(/background-image:url\('([^']+)'\)/);
  if (!m) return null;
  return m[1].startsWith('//') ? 'https:' + m[1] : m[1];
};

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function download(url, name) {
  const file = path.join(MEDIA_DIR, name);
  if (!(await exists(file))) {
    await fs.writeFile(file, await get(url, true));
  }
  return `/media/${name}`;
}

const extOf = (url) => (url.match(/\.(jpe?g|png|webp|gif)(?:$|\?)/i)?.[1] || 'jpg').toLowerCase();

// Приводим HTML текста поста к чистому виду: только разметка, без стилей Telegram
function cleanHtml($, el) {
  const $el = $(el).clone();
  $el.find('i.emoji').each((_, e) => $(e).replaceWith($(e).text()));
  $el.find('tg-emoji').each((_, e) => $(e).replaceWith($(e).html() ?? ''));
  $el.find('tg-spoiler').each((_, e) => $(e).replaceWith(`<span class="spoiler">${$(e).html() ?? ''}</span>`));
  $el.find('*').each((_, e) => {
    const keep = e.tagName === 'a' ? $(e).attr('href') : null;
    for (const name of Object.keys(e.attribs || {})) $(e).removeAttr(name);
    if (keep) {
      $(e).attr('href', keep.startsWith('//') ? 'https:' + keep : keep);
      $(e).attr('target', '_blank').attr('rel', 'noopener');
    }
  });
  return ($el.html() || '').trim();
}

async function parsePost($, wrap) {
  const msg = $(wrap).find('.tgme_widget_message').first();
  const dataPost = msg.attr('data-post');
  if (!dataPost || msg.hasClass('service_message')) return null;
  const id = Number(dataPost.split('/')[1]);
  if (HIDDEN.has(id)) return { id, hidden: true };

  const textEl = msg.find('.tgme_widget_message_text').first();
  const html = textEl.length ? cleanHtml($, textEl) : '';
  const text = textEl.length ? textEl.text().trim() : '';

  const images = [];
  let n = 0;
  for (const a of msg.find('.tgme_widget_message_photo_wrap').toArray()) {
    const url = bgUrl($(a).attr('style'));
    if (url) images.push(await download(url, `${id}-${++n}.${extOf(url)}`));
  }

  const videos = [];
  for (const v of msg.find('.tgme_widget_message_video_player').toArray()) {
    const thumbUrl = bgUrl($(v).find('.tgme_widget_message_video_thumb').attr('style'));
    videos.push({
      thumb: thumbUrl ? await download(thumbUrl, `${id}-v${++n}.${extOf(thumbUrl)}`) : null,
      href: $(v).attr('href') || `https://t.me/${config.channel}/${id}`,
    });
  }

  const docs = msg
    .find('.tgme_widget_message_document_title')
    .toArray()
    .map((d) => $(d).text().trim());

  let linkPreview = null;
  const lp = msg.find('.tgme_widget_message_link_preview').first();
  if (lp.length) {
    linkPreview = {
      url: lp.attr('href') || '',
      site: lp.find('.link_preview_site_name').text().trim(),
      title: lp.find('.link_preview_title').text().trim(),
      description: lp.find('.link_preview_description').text().trim(),
    };
  }


  return {
    id,
    date: msg.find('.tgme_widget_message_date time').attr('datetime') || null,
    url: `https://t.me/${config.channel}/${id}`,
    views: msg.find('.tgme_widget_message_views').first().text().trim() || null,
    forwardedFrom: msg.find('.tgme_widget_message_forwarded_from_name').first().text().trim() || null,

    html,
    text,
    images,
    videos,
    docs,
    linkPreview,
  };
}

async function saveChannelInfo($) {
  const counters = {};
  $('.tgme_channel_info_counter').each((_, c) => {
    counters[$(c).find('.counter_type').text().trim()] = $(c).find('.counter_value').text().trim();
  });
  let avatar = null;
  const img = $('.tgme_channel_info_header .tgme_page_photo_image img').attr('src');
  if (img) avatar = await download(img.startsWith('//') ? 'https:' + img : img, `avatar.${extOf(img)}`);
  const info = {
    title: $('.tgme_channel_info_header_title').text().trim(),
    description: $('.tgme_channel_info_description').text().trim(),
    subscribers: counters.subscribers || counters.subscriber || null,
    avatar,
  };
  await fs.writeFile(CHANNEL_FILE, JSON.stringify(info, null, 2) + '\n');
  return info;
}

async function main() {
  await fs.mkdir(POSTS_DIR, { recursive: true });
  await fs.mkdir(MEDIA_DIR, { recursive: true });

  const known = new Set(
    (await fs.readdir(POSTS_DIR)).filter((f) => f.endsWith('.json')).map((f) => Number(f.replace('.json', ''))),
  );
  const fullRun = FULL || known.size === 0;
  console.log(fullRun ? 'Полная загрузка канала…' : `Уже сохранено постов: ${known.size}. Ищу новые…`);

  let url = BASE;
  let page = 0;
  let added = 0;
  let updated = 0;

  while (url) {
    page++;
    const $ = cheerio.load(await get(url));
    if (page === 1) {
      const info = await saveChannelInfo($);
      console.log(`Канал «${info.title}», подписчиков: ${info.subscribers}`);
    }

    const wraps = $('.tgme_widget_message_wrap').toArray();
    if (wraps.length === 0) break;

    let allKnown = true;
    let minId = Infinity;
    for (const w of wraps) {
      const post = await parsePost($, w);
      if (!post) continue;
      minId = Math.min(minId, post.id);
      if (post.hidden) continue;
      if (!known.has(post.id)) allKnown = false;

      const file = path.join(POSTS_DIR, `${post.id}.json`);
      const json = JSON.stringify(post, null, 2) + '\n';
      const prev = (await exists(file)) ? await fs.readFile(file, 'utf8') : null;
      if (prev === null) added++;
      else if (prev !== json) updated++;
      if (prev !== json) await fs.writeFile(file, json);
    }

    console.log(`Страница ${page}: постов ${wraps.length}, самый старый #${minId}`);

    const prevLink = $('link[rel="prev"]').attr('href');
    const stop = !fullRun && allKnown && page >= REFRESH_PAGES;
    url = !stop && prevLink && Number.isFinite(minId) ? new URL(prevLink, 'https://t.me').href : null;
    if (url) await sleep(1200);
  }

  console.log(`Готово: новых постов ${added}, обновлено ${updated}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
