#!/usr/bin/env node
/*
 * luknow static-site builder  (visual system v2 — site.css)
 * --------------------------------------------------------------
 * Single source of truth for articles: data/articles.json
 * Single source of truth for styling : site.css
 *
 * What it does:
 *   1. Load article records from data/articles.json
 *   2. Generate index.html (branded homepage incl. full article grid)
 *   3. Generate posts/<slug>.html (article pages, shared shell)
 *   4. Apply the shared shell (fonts + site.css + canonical header/footer)
 *      to every other root page, replacing their inline <style>/<header>/<footer>
 *   5. Regenerate sitemap.xml
 *
 * Usage:  node scripts/build.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASE_URL = 'https://lusnaker0730.github.io/luknow';
const OG_IMAGE = BASE_URL + '/og-image.png';
const TODAY = '2026-06-05';
const BASE_PAGES = [
  { f: 'index.html',      changefreq: 'weekly',  priority: '1.0' },
  { f: 'trials.html',     changefreq: 'weekly',  priority: '0.9' },
  { f: 'guidelines.html', changefreq: 'monthly', priority: '0.8' },
  { f: 'meetings.html',   changefreq: 'weekly',  priority: '0.9' },
  { f: 'health.html',     changefreq: 'monthly', priority: '0.8' },
  { f: 'cath.html',       changefreq: 'monthly', priority: '0.8' },
  { f: 'cad.html',        changefreq: 'monthly', priority: '0.8' },
  { f: 'hf.html',         changefreq: 'monthly', priority: '0.8' },
  { f: 'htn.html',        changefreq: 'monthly', priority: '0.8' },
  { f: 'chol.html',       changefreq: 'monthly', priority: '0.8' },
  { f: 'stroke.html',     changefreq: 'monthly', priority: '0.8' },
  { f: 'afib.html',       changefreq: 'monthly', priority: '0.8' },
  { f: 'mi.html',         changefreq: 'monthly', priority: '0.8' },
  { f: 'dm.html',         changefreq: 'monthly', priority: '0.8' },
  { f: 'pad.html',        changefreq: 'monthly', priority: '0.8' },
  { f: 'le8.html',        changefreq: 'monthly', priority: '0.8' },
];
const ROOT_HTML = BASE_PAGES.map(p => p.f);
const TOPIC_PAGES = new Set(['cath.html', 'cad.html', 'hf.html', 'htn.html', 'chol.html', 'stroke.html', 'afib.html', 'mi.html', 'dm.html', 'pad.html', 'le8.html']);
const TOPNAV = [
  ['index.html', '全部'],
  ['trials.html', '臨床試驗'],
  ['guidelines.html', '臨床指南'],
  ['meetings.html', '會議重點'],
  ['health.html', '衛教'],
];

const slug = id => id.replace(/^article-/, '');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const write = (f, c) => fs.writeFileSync(path.join(ROOT, f), c);
const escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = s => escHtml(s).replace(/"/g, '&quot;');
const decodeEnt = s => String(s).replace(/&rarr;/g, '→').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&middot;/g, '·').replace(/&le;/g, '≤').replace(/&ge;/g, '≥');
const toDesc = s => decodeEnt(String(s).replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim().slice(0, 150);

function loadArticles() {
  const dataPath = path.join(ROOT, 'data', 'articles.json');
  if (!fs.existsSync(dataPath)) throw new Error('data/articles.json not found');
  return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
}

// ---------------------------------------------------------------------------
// shared shell pieces
// ---------------------------------------------------------------------------
function headLinks(prefix) {
  return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Noto+Serif+TC:wght@500;700;900&family=Noto+Sans+TC:wght@300;400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${prefix}site.css">`;
}
function shellHeader(active, prefix) {
  const links = TOPNAV.map(([href, label]) =>
    `<a href="${prefix}${href}"${active === href ? ' class="active"' : ''}>${label}</a>`).join('\n');
  return `<header>
<div class="wrap nav-row">
<a href="${prefix}index.html" class="brand"><span class="mark">呂侑穎<em>·</em>臨床筆記</span><span class="sub">Cardiology Notes</span></a>
<nav class="top">
${links}
<a href="${prefix}health.html" class="cta">探索衛教 →</a>
</nav>
</div>
</header>`;
}
function shellFooter(prefix) {
  return `<footer>
<div class="foot-grid">
<div>
<div class="fmark">呂侑穎<em>·</em>臨床筆記</div>
<p>心臟醫學的臨床筆記與實證衛教，整理自 ACC／AHA／ESC 等國際會議與指南。內容依公開醫療資源整理，不構成個別診療建議。</p>
</div>
<div class="col">
<h5>內容</h5>
<a href="${prefix}trials.html">臨床試驗</a>
<a href="${prefix}guidelines.html">臨床指南</a>
<a href="${prefix}meetings.html">會議重點</a>
<a href="${prefix}index.html">全部文章</a>
</div>
<div class="col">
<h5>衛教</h5>
<a href="${prefix}health.html">衛教專區</a>
<a href="${prefix}htn.html">高血壓</a>
<a href="${prefix}chol.html">膽固醇</a>
<a href="${prefix}le8.html">保健八要素</a>
</div>
</div>
<div class="foot-bottom">
<span>© 2026 呂侑穎醫師的臨床筆記</span>
<span>內容僅供衛教與學術參考，不構成臨床診療建議</span>
</div>
</footer>`;
}
function navActiveFor(f) {
  if (TOPNAV.some(([h]) => h === f)) return f;
  if (TOPIC_PAGES.has(f)) return 'health.html';
  return null;
}

// ---------------------------------------------------------------------------
// homepage
// ---------------------------------------------------------------------------
function renderHome(articles) {
  const cards = articles.map(a => `<a class="card" href="posts/${a.slug}.html">
<div class="card-header">
<span class="card-tag ${a.tagCls}">${escHtml(a.tagLabel)}</span>
<div class="card-title">${escHtml(a.title)}</div>
<div class="card-subtitle">${escHtml(a.subtitle)}</div>
<div class="card-meta">${(a.meta || []).map(s => `<span>${escHtml(s)}</span>`).join('')}</div>
</div>
<div class="card-footer"><span class="read-btn">閱讀全文 →</span></div>
</a>`).join('\n');

  const jsonld = {
    '@context': 'https://schema.org', '@type': 'WebSite',
    name: '呂侑穎醫師的臨床筆記',
    description: '整理自 ACC、AHA、ESC 等國際會議與指南的心臟醫學重點，以及實證衛教，用準確、好讀的繁體中文呈現。',
    url: BASE_URL + '/', inLanguage: 'zh-TW',
    author: { '@type': 'Person', name: '呂侑穎', jobTitle: '醫師' },
  };

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>呂侑穎醫師的臨床筆記 — 心臟醫學．臨床筆記與衛教</title>
<meta name="description" content="呂侑穎醫師的臨床筆記：整理自 ACC、AHA、ESC 等國際會議與指南的心臟醫學重點，以及實證衛教，用準確、好讀的繁體中文呈現。">
<meta name="keywords" content="呂侑穎,心臟內科,臨床筆記,心臟醫學,臨床試驗,臨床指南,心血管衛教,cardiology,ACC,AHA,ESC">
<meta name="author" content="呂侑穎醫師">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${BASE_URL}/index.html">
<meta property="og:title" content="呂侑穎醫師的臨床筆記 — 心臟醫學．臨床筆記與衛教">
<meta property="og:description" content="整理自 ACC、AHA、ESC 等國際會議與指南的心臟醫學重點，以及實證衛教，用準確、好讀的繁體中文呈現。">
<meta property="og:type" content="website">
<meta property="og:url" content="${BASE_URL}/index.html">
<meta property="og:locale" content="zh_TW">
<meta property="og:site_name" content="呂侑穎醫師的臨床筆記">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${OG_IMAGE}">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<script type="application/ld+json">
${JSON.stringify(jsonld)}
</script>
${headLinks('')}
</head>
<body>

${shellHeader('index.html', '')}

<div class="home-hero">
<svg class="ecg" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true"><path d="M0,60 L380,60 L420,60 L445,20 L475,100 L505,44 L535,60 L900,60 L935,60 L960,30 L988,92 L1015,60 L1440,60"/></svg>
<div class="hero-grid">
<div class="hero-copy">
<div class="eyebrow reveal d1">心臟內科 · 實證整理</div>
<h1 class="reveal d2">心臟的事，<br>值得<span class="hl">好好說清楚</span>。</h1>
<p class="lead reveal d3">把 ACC、AHA、ESC 等國際會議與最新指南的心臟醫學重點，連同實證衛教，整理成<strong>準確、好讀的繁體中文</strong>——給同行，也給每一位想懂自己心臟的人。</p>
<div class="hero-cta reveal d4">
<a href="health.html" class="btn btn-primary">瀏覽衛教專區 →</a>
<a href="#notes" class="btn btn-ghost">看臨床筆記</a>
</div>
<div class="hero-stats reveal d5">
<div class="s"><b>${articles.length}</b><span>篇文章筆記</span></div>
<div class="s"><b>11</b><span>衛教主題</span></div>
<div class="s"><b>ACC·AHA·ESC</b><span>國際實證來源</span></div>
</div>
</div>
<div class="portrait reveal d3">
<div class="blob"></div>
<div class="frame"><img src="img/dr-lu.jpg" alt="呂侑穎醫師 — 心臟內科"></div>
<div class="badge">
<span class="dot"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h4l2-5 4 10 2-5h6"/></svg></span>
<div><b>呂侑穎 醫師</b><span>Cardiology · 心臟內科</span></div>
</div>
</div>
</div>
</div>

<section class="band">
<div class="wrap">
<div class="about">
<div>
<div class="lbl">關於這個站</div>
<h3>讓世界級的心臟醫學，<br>變成你讀得懂的中文。</h3>
<p>從 late-breaking 臨床試驗、最新指南，到日常的心血管衛教——我把專業的內容拆解、翻譯、整理成有條理又準確的筆記。所有數據都標註來源，不加入額外推論。</p>
</div>
<div class="principles">
<div class="pr"><span class="n">01</span><div><b>有憑有據</b><span>每篇都標明 ACC／AHA／ESC 等來源，數據忠於原文。</span></div></div>
<div class="pr"><span class="n">02</span><div><b>深入淺出</b><span>專業術語首次出現附原文，一般人也讀得懂。</span></div></div>
<div class="pr"><span class="n">03</span><div><b>持續更新</b><span>跟著國際會議與指南，定期整理新內容。</span></div></div>
</div>
</div>
</div>
</section>

<section class="band">
<div class="wrap">
<div class="sec-head">
<div><div class="kicker">Patient Education</div><h2>心血管衛教專區</h2></div>
<a href="health.html" class="more">查看全部 11 個主題 →</a>
</div>
<div class="tilegrid">
<a class="tile" href="htn.html"><img class="tile-illo" src="img/illo/htn.jpg" alt=""><span class="tag risk">危險因子</span><h4>高血壓</h4><p>血壓分類、為何是「沉默的殺手」、你能做到的八大生活型態改變。</p><span class="go">閱讀 →</span></a>
<a class="tile" href="chol.html"><img class="tile-illo" src="img/illo/chol.jpg" alt=""><span class="tag risk">危險因子</span><h4>膽固醇</h4><p>LDL／HDL／三酸甘油酯、血脂參考數值，以及如何控制。</p><span class="go">閱讀 →</span></a>
<a class="tile" href="dm.html"><img class="tile-illo" src="img/illo/dm.jpg" alt=""><span class="tag risk">危險因子</span><h4>糖尿病與心血管</h4><p>為何大幅提高心臟病與中風風險，以及 ABC 控制重點。</p><span class="go">閱讀 →</span></a>
<a class="tile" href="stroke.html"><img class="tile-illo" src="img/illo/stroke.jpg" alt=""><span class="tag disease">疾病</span><h4>中風</h4><p>三種類型、F.A.S.T. 辨識、為何分秒必爭、風險與預防。</p><span class="go">閱讀 →</span></a>
<a class="tile" href="afib.html"><img class="tile-illo" src="img/illo/afib.jpg" alt=""><span class="tag disease">疾病</span><h4>心房顫動</h4><p>中風風險約 5 倍、診斷，以及抗凝／心率／節律三方向治療。</p><span class="go">閱讀 →</span></a>
<a class="tile" href="le8.html"><img class="tile-illo" src="img/illo/le8.jpg" alt=""><span class="tag prevent">預防保健</span><h4>保健八要素</h4><p>Life's Essential 8：四項健康行為＋四項健康因子。</p><span class="go">閱讀 →</span></a>
</div>
</div>
</section>

<section class="band" id="notes">
<div class="wrap">
<div class="sec-head">
<div><div class="kicker">Clinical Notes</div><h2>臨床筆記</h2></div>
<span class="more">共 ${articles.length} 篇</span>
</div>
<div class="cards" style="padding-left:0;padding-right:0">
${cards}
</div>
</div>
</section>

<section class="band">
<div class="wrap">
<div class="closing">
<svg viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true"><path d="M0,45 L560,45 L590,12 L620,78 L650,45 L820,45 L855,45 L880,20 L910,70 L935,45 L1440,45" fill="none" stroke="#f0a59d" stroke-width="2.5" stroke-linecap="round"/></svg>
<div class="kicker">From bench to bedside, in 中文</div>
<h2>把最新的心臟醫學，帶到你面前。</h2>
<a href="health.html" class="btn btn-primary">開始閱讀 →</a>
</div>
</div>
</section>

${shellFooter('')}

</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// article post
// ---------------------------------------------------------------------------
function renderPost(a) {
  const url = `${BASE_URL}/posts/${a.slug}.html`;
  const ogImg = `${BASE_URL}/img/og/${a.slug}.png`;
  const desc = toDesc(a.subtitle || a.body);
  const metaHtml = (a.meta || []).map(s => `<span>${escHtml(s)}</span>`).join('\n');
  const jsonld = {
    '@context': 'https://schema.org', '@type': 'MedicalWebPage',
    headline: a.title, name: a.title, description: desc, url, inLanguage: 'zh-TW', image: ogImg,
    author: { '@type': 'Person', name: '呂侑穎', jobTitle: '醫師' },
    publisher: { '@type': 'Organization', name: '呂侑穎醫師的臨床筆記' },
    dateModified: TODAY, mainEntityOfPage: url,
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
<meta property="og:image" content="${ogImg}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${ogImg}">
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
<script type="application/ld+json">
${JSON.stringify(jsonld)}
</script>
${headLinks('../')}
</head>
<body>

${shellHeader(null, '../')}

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

${shellFooter('../')}

</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// apply shared shell to a hand-written root page (swap style/header/footer)
// ---------------------------------------------------------------------------
function applyShell(file, active) {
  let html = read(file);
  const before = html;
  html = html.replace(/<style>[\s\S]*?<\/style>/, headLinks(''));
  html = html.replace(/<header>[\s\S]*?<\/header>/, shellHeader(active, ''));
  html = html.replace(/<footer>[\s\S]*?<\/footer>/, shellFooter(''));
  if (html !== before) write(file, html);
  return html !== before;
}

// ---------------------------------------------------------------------------
// place a topic illustration at the top of each 衛教 page hero (idempotent)
// ---------------------------------------------------------------------------
const TOPIC_ILLO = {
  'cath.html': ['cath', '心導管檢查'], 'cad.html': ['cad', '冠狀動脈疾病'], 'hf.html': ['hf', '心臟衰竭'],
  'htn.html': ['htn', '高血壓'], 'chol.html': ['chol', '膽固醇'], 'stroke.html': ['stroke', '中風'],
  'afib.html': ['afib', '心房顫動'], 'mi.html': ['mi', '心臟病發作'], 'dm.html': ['dm', '糖尿病'],
  'pad.html': ['pad', '周邊動脈疾病'], 'le8.html': ['le8', '心血管保健八要素'],
};
function placeIllos() {
  let n = 0;
  for (const [file, [key, label]] of Object.entries(TOPIC_ILLO)) {
    const html = read(file);
    if (html.includes('class="topic-illo"')) continue;
    const out = html.replace('<div class="hero">', `<div class="hero">\n<img class="topic-illo" src="img/illo/${key}.jpg" alt="${label}插畫" width="168" height="168">`);
    if (out !== html) { write(file, out); n++; }
  }
  console.log(`  placeIllos: ${n} page(s)`);
}
// add a thumbnail illustration to each 衛教 card on health.html (idempotent)
function placeHubIllos() {
  const file = 'health.html';
  let html = read(file);
  if (html.includes('class="card-illo"')) { console.log('  placeHubIllos: already present'); return; }
  html = html.replace(/<a class="card" href="([a-z0-9]+)\.html">\s*\n<div class="card-header">/g,
    (m, key) => `<a class="card" href="${key}.html">\n<img class="card-illo" src="img/illo/${key}.jpg" alt="">\n<div class="card-header">`);
  write(file, html);
  console.log('  placeHubIllos: health.html updated');
}

// ---------------------------------------------------------------------------
// sitemap
// ---------------------------------------------------------------------------
function renderSitemap(articles) {
  const urls = BASE_PAGES.map(p => `  <url>
    <loc>${BASE_URL}/${p.f}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`);
  for (const a of articles) urls.push(`  <url>
    <loc>${BASE_URL}/posts/${a.slug}.html</loc>
    <lastmod>${a.date || TODAY}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
function main() {
  console.log('luknow build (v2)');
  const articles = loadArticles();
  console.log(`  ${articles.length} articles loaded`);

  write('index.html', renderHome(articles));
  console.log('  wrote index.html (branded homepage)');

  fs.mkdirSync(path.join(ROOT, 'posts'), { recursive: true });
  for (const a of articles) write(`posts/${a.slug}.html`, renderPost(a));
  console.log(`  generated ${articles.length} posts/`);

  let n = 0;
  for (const f of ROOT_HTML) {
    if (f === 'index.html') continue;
    if (applyShell(f, navActiveFor(f))) n++;
  }
  console.log(`  applyShell: updated ${n} root page(s)`);

  placeIllos();
  placeHubIllos();

  write('sitemap.xml', renderSitemap(articles));
  console.log(`  sitemap.xml: ${BASE_PAGES.length + articles.length} urls`);
  console.log('done.');
}

main();
