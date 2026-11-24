import config from '../../site.config.mjs';
import channel from '../../content/channel.json';

const raw = import.meta.glob('../../content/posts/*.json', { eager: true, import: 'default' });

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const url = (p = '/') => (/^https?:/.test(p) ? p : BASE + (p.startsWith('/') ? p : '/' + p));

// Строки, которыми рубрика помечается в самом посте (первая строка)
const RUBRIC_MARKERS = [/^задачка с собеседования/i, /^вне выборки/i];

const AD_RE = [/реклама\.?\s*(ооо|ип|ао|пао|зао)\b/i, /\berid\s*[:=]/i, /#реклама/i];
export const isAd = (text) => AD_RE.some((re) => re.test(text));

const stripTags = (s) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#33;/g, '!')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

const stripEmoji = (s) => s.replace(/^[\p{Extended_Pictographic}\p{Emoji_Component}️‍\s]+/u, '').trim();

const openPre = (seg) => (seg.match(/<pre/g) || []).length > (seg.match(/<\/pre>/g) || []).length;

function splitTitle(html) {
  const segs = html.split(/<br\s*\/?>/);
  let marker = null;
  let i = 0;
  const next = () => {
    while (i < segs.length && !stripTags(segs[i])) i++;
    return i < segs.length && !openPre(segs[i]) ? stripTags(segs[i]) : null;
  };

  let first = next();
  if (first && RUBRIC_MARKERS.some((re) => re.test(stripEmoji(first))) && stripEmoji(first).length < 40) {
    marker = stripEmoji(first).replace(/[:.!]+$/, '');
    i++;
    first = next();
  }

  if (first && first.length <= 140) {
    return { title: stripEmoji(first) || first, marker, body: segs.slice(i + 1).join('<br/>') };
  }
  // Первая строка слишком длинная — берём первое предложение как заголовок, текст не режем
  const plain = stripTags(html);
  const sentence = (plain.match(/^.{20,110}?[.!?…](\s|$)/) || [])[0] || plain.slice(0, 90) + '…';
  return { title: stripEmoji(sentence.trim()), marker, body: segs.slice(i).join('<br/>') };
}

// Сначала ищем рубрику по пометке в посте, потом по заголовку, и только потом по всему тексту
function rubricOf(marker, title, text, html) {
  if (marker && /вне выборки/i.test(marker)) return config.defaultRubric;
  // В пометке и заголовке побеждает рубрика, чьё слово стоит раньше всех
  // («Pandas: … groupby + join» — это Python, а не SQL)
  for (const haystack of [marker, title]) {
    if (!haystack) continue;
    const h = haystack.toLowerCase();
    let first = null;
    let firstPos = Infinity;
    for (const r of config.rubrics) {
      for (const k of r.keywords) {
        const pos = h.indexOf(k.toLowerCase());
        if (pos !== -1 && pos < firstPos) {
          first = r;
          firstPos = pos;
        }
      }
    }
    if (first) return first;
  }
  // Если в посте есть код — рубрику определяет язык кода
  const code = [...(html || '').matchAll(/<pre>([\s\S]*?)<\/pre>/g)].map((m) => m[1].toLowerCase()).join('\n');
  if (code) {
    const sqlScore = (code.match(/\b(select|from|where|join|group by|order by|over\s*\(|with\s+\w+\s+as)\b/g) || []).length;
    const pyScore = (code.match(/\b(import|def|print\(|pd\.|np\.|df\[|df\.|lambda|for \w+ in)\b/g) || []).length;
    const slug = sqlScore >= pyScore ? 'sql' : 'python';
    const r = config.rubrics.find((r) => r.slug === slug);
    if (r && (sqlScore || pyScore)) return r;
  }
  // По всему тексту: побеждает рубрика с наибольшим числом совпадений,
  // но только если совпадений достаточно (иначе это пост «вне выборки»)
  const MIN_HITS = 3;
  const h = (text || '').toLowerCase();
  const count = (k) => h.split(k.toLowerCase()).length - 1;
  let best = null;
  let bestScore = 0;
  for (const r of config.rubrics) {
    const score = r.keywords.reduce((s, k) => s + count(k), 0);
    if (score > bestScore) {
      best = r;
      bestScore = score;
    }
  }
  return bestScore >= MIN_HITS ? best : config.defaultRubric;
}

const tidyCode = (html) =>
  html
    .replace(/<pre>(\s|<br\s*\/?>)+/g, '<pre>')
    .replace(/(\s|<br\s*\/?>)+<\/pre>/g, '</pre>')
    .replace(/<\/pre>(\s*<br\s*\/?>){1,2}/g, '</pre>');

function normalize(p) {
  const { title, marker, body } = splitTitle(p.html);
  const bodyHtml = tidyCode(body.replace(/^(\s*<br\s*\/?>)+/, '').trim());
  const bodyText = stripTags(bodyHtml.replace(/<br\s*\/?>/g, ' '));
  const words = (p.text || '').split(/\s+/).filter(Boolean).length;
  const rubric = rubricOf(marker, title, p.text, p.html);
  return {
    ...p,
    title,
    bodyHtml,
    excerpt: bodyText.length > 220 ? bodyText.slice(0, 220).replace(/\s\S*$/, '') + '…' : bodyText,
    rubric,
    readMinutes: Math.max(1, Math.round(words / 180)),
    hasCode: p.html.includes('<pre'),
    images: p.images.map(url),
    videos: p.videos.map((v) => ({ ...v, thumb: v.thumb ? url(v.thumb) : null })),
  };
}

export const posts = Object.values(raw)
  .filter((p) => p.text && !(config.skipAds && isAd(p.text)) && !(config.hiddenPosts || []).includes(p.id))
  .map(normalize)
  .sort((a, b) => b.id - a.id);

export const allRubrics = [...config.rubrics, config.defaultRubric]
  .map((r) => ({ ...r, count: posts.filter((p) => p.rubric.slug === r.slug).length }))
  .filter((r) => r.count > 0);

export const formatDate = (iso) =>
  iso
    ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
        .format(new Date(iso))
        .replace(/\s*г\.$/, '')
    : '';

export const plural = (n, [one, few, many]) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} ${one}`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
};

export const statValue = (v) => {
  if (v === 'auto:subscribers') return channel.subscribers || '—';
  if (v === 'auto:posts') return String(posts.length);
  return v;
};

export { channel, config };
