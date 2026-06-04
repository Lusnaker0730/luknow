#!/usr/bin/env node
/*
 * luknow static-site builder
 * --------------------------------------------------
 * Single source of truth: data/articles.json
 *   (bootstrapped on first run from the articles{} object in index.html)
 *
 * What it does:
 *   1. Load the 22 article records (id, title, body, tag, subtitle, meta, date)
 *   2. Generate posts/<slug>.html for each — full <head> SEO + MedicalWebPage JSON-LD
 *   3. Regenerate sitemap.xml (8 base pages + every post)
 *   4. Migrate the 4 list pages (index/trials/guidelines/meetings):
 *        - card  <div onclick="openModal('id')">  →  <a href="posts/slug.html">
 *        - drop the duplicated articles{} <script> and the modal markup
 *      (idempotent — safe to re-run)
 *
 * Usage:  node scripts/build.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASE_URL = 'https://lusnaker0730.github.io/luknow';
const OG_IMAGE = BASE_URL + '/og-image.png';
const TODAY = '2026-06-04';
const LIST_PAGES = ['index.html', 'trials.html', 'guidelines.html', 'meetings.html'];
const BASE_PAGES = [
  { f: 'index.html',      changefreq: 'weekly',  priority: '1.0' },
  { f: 'trials.html',     changefreq: 'weekly',  priority: '0.9' },
  { f: 'guidelines.html', changefreq: 'monthly', priority: '0.8' },
  { f: 'meetings.html',   changefreq: 'weekly',  priority: '0.9' },
  { f: 'cath.html',       changefreq: 'monthly', priority: '0.8' },
  { f: 'cad.html',        changefreq: 'monthly', priority: '0.8' },
  { f: 'hf.html',         changefreq: 'monthly', priority: '0.8' },
  { f: 'htn.html',        changefreq: 'monthly', priority: '0.8' },
  { f: 'chol.html',       changefreq: 'monthly', priority: '0.8' },
  { f: 'stroke.html',     changefreq: 'monthly', priority: '0.8' },
  { f: 'afib.html',       changefreq: 'monthly', priority: '0.8' },
];

const slug = id => id.replace(/^article-/, '');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const write = (f, c) => fs.writeFileSync(path.join(ROOT, f), c);

const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = s => escHtml(s).replace(/"/g, '&quot;');
const decodeEnt = s => String(s)
  .replace(/&rarr;/g, '→').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>').replace(/&middot;/g, '·').replace(/&le;/g, '≤').replace(/&ge;/g, '≥');
const toDesc = s => decodeEnt(String(s).replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim().slice(0, 150);

// ---------------------------------------------------------------------------
// 1. Load articles (bootstrap from index.html on first run)
// ---------------------------------------------------------------------------
function extractFromIndex() {
  const html = read('index.html');
  const start = html.indexOf('const articles = {};');
  const end = html.indexOf('function openModal');
  if (start < 0 || end < 0) throw new Error('Cannot locate articles{} block in index.html');
  const code = html.slice(start, end);
  const articles = new Function(code + '\nreturn articles;')();

  // card metadata (tag / subtitle / meta spans) per id
  const meta = {};
  const cardRe = /<div class="card" onclick="openModal\('([^']+)'\)">([\s\S]*?)<div class="card-footer">/g;
  let m;
  while ((m = cardRe.exec(html)) !== null) {
    const id = m[1], inner = m[2];
    const tag = inner.match(/<span class="card-tag (\w+)">([^<]*)<\/span>/);
    const sub = inner.match(/<div class="card-subtitle">([\s\S]*?)<\/div>/);
    const metaBlock = inner.match(/<div class="card-meta">([\s\S]*?)<\/div>/);
    const spans = metaBlock ? [...metaBlock[1].matchAll(/<span>([^<]*)<\/span>/g)].map(x => x[1].trim()) : [];
    meta[id] = {
      tagCls: tag ? tag[1] : 'trial',
      tagLabel: tag ? tag[2] : '文章',
      subtitle: sub ? sub[1].trim() : '',
      metaSpans: spans,
    };
  }

  const records = Object.keys(articles).map(id => {
    const md = meta[id] || { tagCls: 'trial', tagLabel: '文章', subtitle: '', metaSpans: [] };
    const date = (md.metaSpans.find(s => /^\d{4}-\d{2}-\d{2}$/.test(s))) || null;
    return {
      id, slug: slug(id),
      title: articles[id].title,
      body: articles[id].body,
      tagCls: md.tagCls,
      tagLabel: md.tagLabel,
      subtitle: md.subtitle,
      meta: md.metaSpans,
      date,
    };
  });
  return records;
}

function loadArticles() {
  const dataPath = path.join(ROOT, 'data', 'articles.json');
  if (fs.existsSync(dataPath)) {
    return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  }
  const records = extractFromIndex();
  fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  fs.writeFileSync(dataPath, JSON.stringify(records, null, 2));
  console.log(`  bootstrapped data/articles.json (${records.length} records)`);
  return records;
}

// ---------------------------------------------------------------------------
// 2. Post page template
// ---------------------------------------------------------------------------
const NAV = `<nav>
<a href="../index.html">全部</a>
<a href="../trials.html">臨床試驗</a>
<a href="../guidelines.html">臨床指南</a>
<a href="../meetings.html">會議重點</a>
<a href="../cath.html">心導管介紹</a>
<a href="../cad.html">冠狀動脈疾病</a>
<a href="../hf.html">心臟衰竭</a>
<a href="../htn.html">高血壓</a>
<a href="../chol.html">膽固醇</a>
<a href="../stroke.html">中風</a>
<a href="../afib.html">心房顫動</a>
</nav>`;

const STYLE = `*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#f5f5f7;--card:#fff;--text:#1d1d1f;--sub:#86868b;--accent:#0071e3;--border:#d2d2d7;--shadow:0 2px 12px rgba(0,0,0,.08)}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC",sans-serif;background:var(--bg);color:var(--text);line-height:1.7;min-height:100vh}
header{background:rgba(255,255,255,.72);backdrop-filter:saturate(180%) blur(20px);-webkit-backdrop-filter:saturate(180%) blur(20px);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:100}
.header-inner{max-width:980px;margin:0 auto;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
.site-title{font-size:1.25rem;font-weight:700;letter-spacing:-.02em}
.site-title span{color:var(--accent)}
.site-title a{color:inherit;text-decoration:none}
nav{display:flex;gap:4px;flex-wrap:wrap}
nav a{padding:6px 16px;border-radius:20px;font-size:.85rem;font-weight:500;color:var(--sub);text-decoration:none;transition:all .2s}
nav a:hover{background:rgba(0,113,227,.08);color:var(--accent)}
.content-wrap{max-width:760px;margin:0 auto;padding:28px 24px 60px}
.back-link{display:inline-block;color:var(--accent);text-decoration:none;font-size:.85rem;font-weight:500;margin-bottom:18px}
.back-link:hover{text-decoration:underline}
.article-head{margin-bottom:18px}
.card-tag{display:inline-block;font-size:.72rem;font-weight:600;padding:3px 12px;border-radius:20px;margin-bottom:12px}
.card-tag.guideline{background:#fef3e2;color:#e67700}
.card-tag.trial{background:#e8f0fe;color:#1a73e8}
.card-tag.podcast{background:#e8f5e9;color:#2e7d32}
.card-tag.meeting{background:#f0e8fe;color:#6f42c1}
.article-head h1{font-size:1.7rem;font-weight:700;letter-spacing:-.02em;line-height:1.35}
.article-meta{margin-top:10px;font-size:.82rem;color:var(--sub);display:flex;gap:14px;flex-wrap:wrap}
.content-card{background:var(--card);border-radius:20px;box-shadow:var(--shadow);border:1px solid var(--border);overflow:hidden}
.article-body{padding:32px 30px;white-space:pre-wrap;font-size:.94rem;line-height:1.9;font-family:"Noto Sans TC",-apple-system,sans-serif;color:#222}
@media(max-width:520px){.article-body{padding:24px 18px}.article-head h1{font-size:1.4rem}}
footer{text-align:center;padding:40px 24px;color:var(--sub);font-size:.78rem;border-top:1px solid var(--border);margin-top:40px}`;

function renderPost(a) {
  const url = `${BASE_URL}/posts/${a.slug}.html`;
  const desc = toDesc(a.subtitle || a.body);
  const metaHtml = a.meta.map(s => `<span>${escHtml(s)}</span>`).join('\n');
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'MedicalWebPage',
    headline: a.title,
    name: a.title,
    description: desc,
    url,
    inLanguage: 'zh-TW',
    image: OG_IMAGE,
    author: { '@type': 'Person', name: '呂侑穎', jobTitle: '醫師' },
    publisher: { '@type': 'Organization', name: '呂侑穎醫師的臨床筆記' },
    dateModified: TODAY,
    mainEntityOfPage: url,
  };
  if (a.date) jsonld.datePublished = a.date;

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(a.title)} — 呂侑穎醫師的臨床筆記</title>
<meta name="description" content="${escAttr(desc)}">
<meta name="author" content="呂侑穎醫師">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${escAttr(a.title)}">
<meta property="og:description" content="${escAttr(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="zh_TW">
<meta property="og:site_name" content="呂侑穎醫師的臨床筆記">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${OG_IMAGE}">
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
<script type="application/ld+json">
${JSON.stringify(jsonld)}
</script>
<style>
${STYLE}
</style>
</head>
<body>

<header>
<div class="header-inner">
<div>
<div class="site-title"><a href="../index.html">呂侑穎醫師的<span>臨床筆記</span></a></div>
</div>
${NAV}
</div>
</header>

<div class="content-wrap">
<a class="back-link" href="../index.html">&larr; 回到全部文章</a>
<div class="article-head">
<span class="card-tag ${a.tagCls}">${escHtml(a.tagLabel)}</span>
<h1>${escHtml(a.title)}</h1>
<div class="article-meta">
${metaHtml}
</div>
</div>
<div class="content-card">
<div class="article-body">${escHtml(a.body)}</div>
</div>
</div>

<footer>
&copy; 2026 呂侑穎醫師的臨床筆記 &middot; 內容依據公開資料整理，不包含額外推論
</footer>

</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// 3. sitemap
// ---------------------------------------------------------------------------
function renderSitemap(articles) {
  const urls = [];
  for (const p of BASE_PAGES) {
    urls.push(`  <url>
    <loc>${BASE_URL}/${p.f}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`);
  }
  for (const a of articles) {
    urls.push(`  <url>
    <loc>${BASE_URL}/posts/${a.slug}.html</loc>
    <lastmod>${a.date || TODAY}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
}

// ---------------------------------------------------------------------------
// 4. Migrate list pages (idempotent)
// ---------------------------------------------------------------------------
function migrateListPage(file) {
  let html = read(file);
  const before = html;
  let cards = 0;

  // card opening: div+onclick -> anchor+href
  html = html.replace(/<div class="card" onclick="openModal\('([^']+)'\)">/g, (mm, id) => {
    cards++;
    return `<a class="card" href="posts/${slug(id)}.html">`;
  });

  // card closing: the </div> right after the read-btn footer -> </a>
  html = html.replace(
    /(<div class="card-footer">\s*<span class="read-btn">閱讀全文 &rarr;<\/span>\s*<\/div>\s*)<\/div>/g,
    '$1</a>'
  );

  // .card CSS: make the anchor behave like the old block + reset link styling
  html = html.replace(
    'overflow:hidden;cursor:pointer;transition:transform .2s,box-shadow .2s;border:1px solid var(--border)}',
    'overflow:hidden;cursor:pointer;transition:transform .2s,box-shadow .2s;border:1px solid var(--border);text-decoration:none;color:inherit;display:block}'
  );

  // remove modal markup
  html = html.replace(
    /\s*<div class="modal-overlay" id="modalOverlay"[\s\S]*?<div class="modal-body" id="modalBody"><\/div>\s*<\/div>\s*<\/div>/,
    ''
  );

  // remove the duplicated articles{} + modal-function <script> block
  html = html.replace(/\s*<script>\s*const articles = \{\};[\s\S]*?<\/script>/, '');

  write(file, html);
  return { cards, changed: before !== html };
}

// ---------------------------------------------------------------------------
// 4b. Ensure hand-written root pages carry the full nav (idempotent)
// ---------------------------------------------------------------------------
const ROOT_HTML = ['index.html', 'trials.html', 'guidelines.html', 'meetings.html', 'cath.html', 'cad.html', 'hf.html', 'htn.html', 'chol.html', 'stroke.html', 'afib.html'];
// topic-page nav links in order; each missing one is inserted right after the previous link
const NAV_CHAIN = [
  { href: 'htn.html',    label: '高血壓' },
  { href: 'chol.html',   label: '膽固醇' },
  { href: 'stroke.html', label: '中風' },
  { href: 'afib.html',   label: '心房顫動' },
];
function ensureNav() {
  let changed = 0;
  for (const f of ROOT_HTML) {
    let html = read(f);
    const before = html;
    for (let i = 1; i < NAV_CHAIN.length; i++) {
      const cur = NAV_CHAIN[i], prev = NAV_CHAIN[i - 1];
      if (html.includes(`href="${cur.href}"`)) continue;
      const re = new RegExp(`(<a href="${prev.href.replace(/\./g, '\\.')}"[^>]*>${prev.label}</a>)`);
      html = html.replace(re, `$1\n<a href="${cur.href}">${cur.label}</a>`);
    }
    if (html !== before) { write(f, html); changed++; }
  }
  console.log(`  ensureNav: updated ${changed} page(s)`);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
function main() {
  console.log('luknow build');
  const articles = loadArticles();
  console.log(`  ${articles.length} articles loaded`);

  fs.mkdirSync(path.join(ROOT, 'posts'), { recursive: true });
  for (const a of articles) write(`posts/${a.slug}.html`, renderPost(a));
  console.log(`  generated ${articles.length} pages in posts/`);

  write('sitemap.xml', renderSitemap(articles));
  console.log(`  sitemap.xml: ${BASE_PAGES.length} base + ${articles.length} posts = ${BASE_PAGES.length + articles.length} urls`);

  for (const f of LIST_PAGES) {
    const r = migrateListPage(f);
    console.log(`  migrated ${f}: ${r.cards} cards -> links${r.changed ? '' : ' (no change)'}`);
  }
  ensureNav();
  console.log('done.');
}

main();
