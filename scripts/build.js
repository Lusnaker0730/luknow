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
const BASE_URL = 'https://drluyy.com';
const OG_IMAGE = BASE_URL + '/og-image.png';
const GA_ID = 'G-BC1Z8X6BQT';
const TODAY = new Date().toISOString().slice(0, 10); // 建置當天日期，供 lastmod / dateModified 使用
const BASE_PAGES = [
  { f: 'index.html',      changefreq: 'weekly',  priority: '1.0' },
  { f: 'posts.html',      changefreq: 'weekly',  priority: '0.9' },
  { f: 'trials.html',     changefreq: 'weekly',  priority: '0.9' },
  { f: 'guidelines.html', changefreq: 'monthly', priority: '0.8' },
  { f: 'meetings.html',   changefreq: 'weekly',  priority: '0.9' },
  { f: 'news.html',       changefreq: 'weekly',  priority: '0.9' },
  { f: 'health.html',     changefreq: 'monthly', priority: '0.8' },
  { f: 'about.html',      changefreq: 'yearly',  priority: '0.7' },
  { f: 'risk.html',       changefreq: 'monthly', priority: '0.8' },
  { f: 'cath.html',       changefreq: 'monthly', priority: '0.8' },
  { f: 'cad.html',        changefreq: 'monthly', priority: '0.8' },
  { f: 'hf.html',         changefreq: 'monthly', priority: '0.8' },
  { f: 'htn.html',        changefreq: 'monthly', priority: '0.8' },
  { f: 'chol.html',       changefreq: 'monthly', priority: '0.8' },
  { f: 'stroke.html',     changefreq: 'monthly', priority: '0.8' },
  { f: 'afib.html',       changefreq: 'monthly', priority: '0.8' },
  { f: 'palpitations.html', changefreq: 'monthly', priority: '0.8' },
  { f: 'mi.html',         changefreq: 'monthly', priority: '0.8' },
  { f: 'dm.html',         changefreq: 'monthly', priority: '0.8' },
  { f: 'pad.html',        changefreq: 'monthly', priority: '0.8' },
  { f: 'dvt.html',        changefreq: 'monthly', priority: '0.8' },
  { f: 'mvp.html',        changefreq: 'monthly', priority: '0.8' },
  { f: 'as.html',         changefreq: 'monthly', priority: '0.8' },
  { f: 'tg.html',         changefreq: 'monthly', priority: '0.8' },
  { f: 'ckd.html',        changefreq: 'monthly', priority: '0.8' },
  { f: 'stent.html',      changefreq: 'monthly', priority: '0.8' },
  { f: 'heart-stent.html', changefreq: 'monthly', priority: '0.9' },
  { f: 'weight-loss-injection.html', changefreq: 'monthly', priority: '0.9' },
  { f: 'le8.html',        changefreq: 'monthly', priority: '0.8' },
  { f: 'coffee.html',     changefreq: 'monthly', priority: '0.8' },
  { f: 'lipoprotein-a.html', changefreq: 'monthly', priority: '0.8' },
  { f: 'vitamin-d.html',  changefreq: 'monthly', priority: '0.8' },
  { f: 'psvt.html',       changefreq: 'monthly', priority: '0.8' },
  { f: 'post-thrombotic.html', changefreq: 'monthly', priority: '0.8' },
  { f: 'fish-oil.html',    changefreq: 'monthly', priority: '0.8' },
  { f: 'metabolic-syndrome.html', changefreq: 'monthly', priority: '0.8' },
  { f: 'coronary-calcium.html', changefreq: 'monthly', priority: '0.8' },
];
const ROOT_HTML = BASE_PAGES.map(p => p.f);
const TOPIC_PAGES = new Set(['cath.html', 'cad.html', 'hf.html', 'htn.html', 'chol.html', 'stroke.html', 'afib.html', 'palpitations.html', 'mi.html', 'dm.html', 'pad.html', 'dvt.html', 'mvp.html', 'as.html', 'tg.html', 'ckd.html', 'stent.html', 'heart-stent.html', 'weight-loss-injection.html', 'le8.html', 'coffee.html', 'lipoprotein-a.html', 'vitamin-d.html', 'psvt.html', 'post-thrombotic.html', 'fish-oil.html', 'metabolic-syndrome.html', 'coronary-calcium.html']);
// 每頁專屬社群分享圖：檔名 → img/og/<name>.png（衛教頁自動用 slug，其餘手列）
const OG_MAP = {};
for (const f of TOPIC_PAGES) OG_MAP[f] = f.replace('.html', '');
Object.assign(OG_MAP, {
  'index.html': 'index', 'posts.html': 'posts', 'trials.html': 'trials',
  'guidelines.html': 'guidelines', 'meetings.html': 'meetings', 'news.html': 'news',
  'health.html': 'health', 'about.html': 'about', 'clinic.html': 'clinic',
  'risk.html': 'risk', 'quizzes.html': 'quizzes', 'featured.html': 'featured',
  'quiz-fish-oil.html': 'quiz-fish-oil', 'quiz-heart-stent.html': 'quiz-heart-stent',
  'quiz-lipoprotein-a.html': 'quiz-lipoprotein-a', 'quiz-vitamin-d.html': 'quiz-vitamin-d',
  'featured/coffee-and-heart.html': 'coffee-and-heart',
  'featured/resorbable-stent.html': 'resorbable-stent',
  'featured/aha-cholesterol-guideline-top10.html': 'aha-cholesterol-guideline-top10',
});
const TOPNAV = [
  ['posts.html', '全部'],
  ['trials.html', '臨床試驗'],
  ['guidelines.html', '臨床指南'],
  ['meetings.html', '會議重點'],
  ['news.html', '醫療新知'],
  ['health.html', '衛教'],
  ['quizzes.html', '測驗'],
  ['clinic.html', '門診時刻表'],
  ['risk.html', '風險計算'],
  ['about.html', '醫師介紹'],
];

// 分類頁 → 對應的文章 tagCls（卡片與計數由 build 依 articles.json 自動生成）
const CATEGORY_PAGES = {
  'trials.html':     ['trial'],
  'guidelines.html': ['guideline'],
  'meetings.html':   ['meeting', 'podcast'],
  'news.html':       ['news'],
};

// 門診時刻表 — single source of truth (drives clinic.html + homepage band)
const CLINIC = {
  hospital: '台北台安醫院',
  dept: '心臟內科',
  doctor: '呂侑穎 醫師',
  amTime: '09:00–12:00',
  pmTime: '14:00–17:00',
  // weekly recurring sessions
  sessions: [
    { day: '週一', period: '下午', time: '14:00–17:00' },
    { day: '週二', period: '上午', time: '09:00–12:00', note: '8月起' },
    { day: '週三', period: '下午', time: '14:00–17:00' },
    { day: '週四', period: '下午', time: '14:00–17:00' },
    { day: '週日', period: '上午', time: '09:00–12:00', note: '每月單週' },
  ],
  // Sunday clinics on the 1st / 3rd / 5th Sunday of each month (單週)
  sundayDates: ['2026-07-05', '2026-07-19', '2026-08-02', '2026-08-16', '2026-08-30',
    '2026-09-06', '2026-09-20', '2026-10-04', '2026-10-18', '2026-11-01',
    '2026-11-15', '2026-11-29', '2026-12-06', '2026-12-20'],
  sundayPeriodLabel: '2026 下半年',
};

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

// Weekly featured reading — curated external reads (Chinese 導讀 + link to source)
function loadFeatured() {
  const dataPath = path.join(ROOT, 'data', 'featured.json');
  if (!fs.existsSync(dataPath)) return [];
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
<a href="${prefix}index.html" class="brand"><span class="mark">台安醫院<span class="dept">心臟內科</span><em>。</em>呂侑穎醫師<em>。</em>臨床筆記</span><span class="sub">Cardiology Notes</span></a>
<input type="checkbox" id="nav-check" class="nav-check" aria-hidden="true">
<label for="nav-check" class="nav-burger" aria-label="開關選單"><span></span><span></span><span></span></label>
<nav class="top" id="topnav">
${links}
<a href="${prefix}search.html" class="nav-search" aria-label="站內搜尋">🔍 搜尋</a>
<a href="${prefix}health.html" class="cta">探索衛教 →</a>
</nav>
</div>
</header>`;
}
function shellFooter(prefix) {
  return `<footer>
<div class="foot-grid">
<div>
<div class="fmark">台安醫院<span class="dept">心臟內科</span><em>。</em>呂侑穎醫師<em>。</em>臨床筆記</div>
<p>心臟醫學的臨床筆記與實證衛教，整理自 ACC／AHA／ESC 等國際會議與指南。內容依公開醫療資源整理，不構成個別診療建議。</p>
</div>
<div class="col">
<h5>內容</h5>
<a href="${prefix}trials.html">臨床試驗</a>
<a href="${prefix}guidelines.html">臨床指南</a>
<a href="${prefix}meetings.html">會議重點</a>
<a href="${prefix}news.html">醫療新知</a>
<a href="${prefix}featured.html">每周精選閱讀</a>
<a href="${prefix}clinic.html">門診時刻表</a>
<a href="${prefix}risk.html">風險計算器</a>
<a href="${prefix}about.html">醫師介紹</a>
<a href="${prefix}posts.html">全部文章</a>
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
<span>© 2026 台安醫院心臟內科。呂侑穎醫師。臨床筆記</span>
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
function renderFeaturedBand(featured) {
  if (!featured || !featured.length) return '';
  const f = featured[0];
  return `<section class="band">
<div class="wrap">
<div class="sec-head">
<div><div class="kicker">Weekly Reading</div><h2>每周精選閱讀</h2></div>
<a href="featured.html" class="more">看全部精選 →</a>
</div>
<a class="weekly-card" href="featured/${f.slug}.html">
<div class="weekly-badge"><span class="wk">本周</span><span class="lbl">精選</span></div>
<div class="weekly-body">
<span class="card-tag reading">${escHtml(f.tagLabel || '精選閱讀')}</span>
<h3 class="weekly-title">${escHtml(f.title)}</h3>
<p class="weekly-lead">${escHtml(f.lead || '')}</p>
<div class="weekly-meta"><span>來源 ${escHtml(f.sourceLabel || f.source || '')}</span><span>${escHtml(f.date || '')}</span></div>
<span class="read-btn">讀重點導讀 →</span>
</div>
</a>
</div>
</section>`;
}

function renderHome(articles, featured) {
  const cards = articles.slice(0, 4).map(a => `<a class="card" href="posts/${a.slug}.html">
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
    name: '台安醫院心臟內科。呂侑穎醫師。臨床筆記',
    alternateName: ['呂侑穎醫師', '呂侑穎醫師 臨床筆記', '呂侑穎'],
    description: '整理自 ACC、AHA、ESC 等國際會議與指南的心臟醫學重點，以及實證衛教，用準確、好讀的繁體中文呈現。',
    url: BASE_URL + '/', inLanguage: 'zh-TW',
    author: { '@type': 'Person', name: '呂侑穎', jobTitle: '心臟內科醫師', url: `${BASE_URL}/about.html`, sameAs: ['https://www.tahsda.org.tw/doctors/doctorcard.php?doctorid=058', 'https://www.threads.com/@aluminum001'] },
    publisher: { '@type': 'Person', name: '呂侑穎', jobTitle: '心臟內科醫師', url: `${BASE_URL}/about.html`, sameAs: ['https://www.tahsda.org.tw/doctors/doctorcard.php?doctorid=058', 'https://www.threads.com/@aluminum001'] },
  };

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>台安醫院心臟內科。呂侑穎醫師。臨床筆記 — 心臟醫學．臨床筆記與衛教</title>
<meta name="description" content="台安醫院心臟內科。呂侑穎醫師。臨床筆記：整理自 ACC、AHA、ESC 等國際會議與指南的心臟醫學重點，以及實證衛教，用準確、好讀的繁體中文呈現。">
<meta name="keywords" content="呂侑穎,心臟內科,臨床筆記,心臟醫學,臨床試驗,臨床指南,心血管衛教,cardiology,ACC,AHA,ESC">
<meta name="author" content="呂侑穎醫師">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${BASE_URL}/">
<meta property="og:title" content="台安醫院心臟內科。呂侑穎醫師。臨床筆記 — 心臟醫學．臨床筆記與衛教">
<meta property="og:description" content="整理自 ACC、AHA、ESC 等國際會議與指南的心臟醫學重點，以及實證衛教，用準確、好讀的繁體中文呈現。">
<meta property="og:type" content="website">
<meta property="og:url" content="${BASE_URL}/">
<meta property="og:locale" content="zh_TW">
<meta property="og:site_name" content="台安醫院心臟內科。呂侑穎醫師。臨床筆記">
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
<div class="lbl">關於醫師</div>
<h3>呂侑穎 醫師</h3>
<p>台北台安醫院心臟內科主治醫師。長期把 ACC／AHA／ESC 等國際會議與最新指南的心臟醫學重點，拆解、翻譯、整理成準確又好讀的繁體中文——給同行，也給每一位想懂自己心臟的人。</p>
<p style="margin-top:14px"><a href="about.html" style="color:var(--accent);font-weight:600">看完整醫師簡介 →</a></p>
</div>
<div class="principles">
<div class="pr"><span class="n">✓</span><div><b>內科專科</b><span>Internal Medicine</span></div></div>
<div class="pr"><span class="n">✓</span><div><b>心臟內科專科</b><span>Cardiology</span></div></div>
<div class="pr"><span class="n">✓</span><div><b>介入性心臟血管專科</b><span>Interventional Cardiology</span></div></div>
<div class="pr"><span class="n">✓</span><div><b>重症專科</b><span>Critical Care</span></div></div>
</div>
</div>
</div>
</section>

${renderClinicBand(CLINIC)}

${renderFeaturedBand(featured)}

<section class="band">
<div class="wrap">
<div class="sec-head">
<div><div class="kicker">Patient Education</div><h2>心血管衛教專區</h2></div>
<a href="health.html" class="more">查看全部 28 個主題 →</a>
</div>
<div class="tilegrid">
<a class="tile" href="cath.html"><img class="tile-illo" src="img/illo/cath.jpg" alt=""><span class="tag exam">檢查介紹</span><h4>心導管檢查</h4><p>適應症、流程、住院幾天、傷口大小、風險與術後照護。</p><span class="go">閱讀 →</span></a>
<a class="tile" href="heart-stent.html"><img class="tile-illo" src="img/illo/stent.jpg" alt=""><span class="tag exam">治療介紹</span><h4>心臟支架</h4><p>為什麼放支架、裸金屬／塗藥／可吸收怎麼選、術後吃藥與照護。</p><span class="go">閱讀 →</span></a>
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
<a href="posts.html" class="more">查看全部 ${articles.length} 篇 →</a>
</div>
<div class="cards" style="padding-left:0;padding-right:0">
${cards}
</div>
</div>
</section>

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
    author: { '@type': 'Person', name: '呂侑穎', jobTitle: '心臟內科醫師', url: `${BASE_URL}/about.html`, sameAs: ['https://www.tahsda.org.tw/doctors/doctorcard.php?doctorid=058', 'https://www.threads.com/@aluminum001'] },
    publisher: { '@type': 'Organization', name: '台安醫院心臟內科。呂侑穎醫師。臨床筆記' },
    dateModified: TODAY, mainEntityOfPage: url,
  };
  if (a.date) jsonld.datePublished = a.date;

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(a.title)} — 台安醫院心臟內科。呂侑穎醫師。臨床筆記</title>
<meta name="description" content="${escAttr(desc)}">
<meta name="author" content="呂侑穎醫師">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${escAttr(a.title)}">
<meta property="og:description" content="${escAttr(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="zh_TW">
<meta property="og:site_name" content="台安醫院心臟內科。呂侑穎醫師。臨床筆記">
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
${a.hero ? `<img class="article-hero" src="../img/og/${a.slug}.png" alt="${escAttr(a.title)}" loading="eager">\n` : ''}<div class="article-body">${escHtml(a.body)}</div>
</div>
</div>

${shellFooter('../')}

</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// weekly featured reading — 導讀 page (featured/<slug>.html)
// ---------------------------------------------------------------------------
function renderFeaturedTables(f) {
  if (!Array.isArray(f.tables) || !f.tables.length) return '';
  return f.tables.map(t => {
    const head = (t.headers || []).map(h => `<th>${escHtml(String(h))}</th>`).join('');
    const rows = (t.rows || []).map(r =>
      `<tr>${(r || []).map(c => `<td>${escHtml(String(c))}</td>`).join('')}</tr>`).join('\n');
    const notes = Array.isArray(t.notes) && t.notes.length
      ? `<div class="table-notes">${t.notes.map(n => `<p>${escHtml(String(n))}</p>`).join('')}</div>` : '';
    return `<div class="featured-table">
${t.title ? `<h3 class="table-title">${escHtml(t.title)}</h3>` : ''}
${t.caption ? `<p class="table-caption">${escHtml(t.caption)}</p>` : ''}
<div class="table-wrap"><table class="stage-table">
<thead><tr>${head}</tr></thead>
<tbody>
${rows}
</tbody>
</table></div>
${notes}
</div>`;
  }).join('\n');
}
function renderFeaturedPost(f) {
  const url = `${BASE_URL}/featured/${f.slug}.html`;
  const desc = toDesc(f.lead || f.body);
  const srcLabel = f.sourceLabel || f.source || '原文';
  const ogImg = f.image ? `${BASE_URL}/${f.image}` : OG_IMAGE;
  const ogW = f.image ? (f.imageW || 1200) : 1200;
  const ogH = f.image ? (f.imageH || 630) : 630;
  const jsonld = {
    '@context': 'https://schema.org', '@type': 'MedicalWebPage',
    headline: f.title, name: f.title, description: desc, url, inLanguage: 'zh-TW', image: ogImg,
    author: { '@type': 'Person', name: '呂侑穎', jobTitle: '心臟內科醫師', url: `${BASE_URL}/about.html`, sameAs: ['https://www.tahsda.org.tw/doctors/doctorcard.php?doctorid=058', 'https://www.threads.com/@aluminum001'] },
    publisher: { '@type': 'Organization', name: '台安醫院心臟內科。呂侑穎醫師。臨床筆記' },
    dateModified: TODAY, mainEntityOfPage: url,
    citation: f.sourceUrl ? { '@type': 'CreativeWork', name: f.source, url: f.sourceUrl } : undefined,
  };
  if (f.date) jsonld.datePublished = f.date;

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(f.title)} — 每周精選閱讀 — 台安醫院心臟內科。呂侑穎醫師。臨床筆記</title>
<meta name="description" content="${escAttr(desc)}">
<meta name="author" content="呂侑穎醫師">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${escAttr(f.title)}">
<meta property="og:description" content="${escAttr(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="zh_TW">
<meta property="og:site_name" content="台安醫院心臟內科。呂侑穎醫師。臨床筆記">
<meta property="og:image" content="${ogImg}">
<meta property="og:image:width" content="${ogW}">
<meta property="og:image:height" content="${ogH}">
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
<a class="back-link" href="../featured.html">&larr; 回到每周精選閱讀</a>
<div class="article-head">
<span class="card-tag reading">${escHtml(f.tagLabel || '精選閱讀')}</span>
<h1>${escHtml(f.title)}</h1>
<div class="article-meta">
<span>來源 ${escHtml(srcLabel)}</span>
<span>${escHtml(f.date || '')}</span>
</div>
</div>
${f.image ? `<figure class="article-figure"><img src="../${escAttr(f.image)}" alt="${escAttr(f.title)}" width="${ogW}" height="${ogH}" loading="lazy">${f.imageCaption ? `<figcaption>${escHtml(f.imageCaption)}</figcaption>` : ''}</figure>` : ''}
<div class="content-card">
<div class="article-body">${escHtml(f.body)}</div>
${renderFeaturedTables(f)}
</div>
<div class="source-cta">
<a class="btn btn-primary" href="${escAttr(f.sourceUrl)}" target="_blank" rel="noopener noreferrer">閱讀原文（${escHtml(srcLabel)}）→</a>
<p class="source-note">原文出處：${escHtml(f.source || srcLabel)}。本頁為中文重點導讀，著作權屬原作者所有；完整與最新內容請以原文為準。</p>
</div>
</div>

${shellFooter('../')}

</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// weekly featured reading — archive list (featured.html)
// ---------------------------------------------------------------------------
function renderFeaturedArchive(featured) {
  const cards = featured.map(f => `<a class="card" href="featured/${f.slug}.html">
<div class="card-header">
<span class="card-tag reading">${escHtml(f.tagLabel || '精選閱讀')}</span>
<div class="card-title">${escHtml(f.title)}</div>
<div class="card-subtitle">${escHtml(f.lead || '')}</div>
<div class="card-meta"><span>來源 ${escHtml(f.sourceLabel || f.source || '')}</span><span>${escHtml(f.date || '')}</span></div>
</div>
<div class="card-footer"><span class="read-btn">讀重點導讀 →</span></div>
</a>`).join('\n');

  const jsonld = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: '每周精選閱讀', url: BASE_URL + '/featured.html', inLanguage: 'zh-TW',
    description: '每周精選一篇值得一讀的心血管好文，附中文重點導讀並連回原文。',
  };

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>每周精選閱讀 — 台安醫院心臟內科。呂侑穎醫師。臨床筆記</title>
<meta name="description" content="每周精選一篇值得一讀的心血管好文，附中文重點導讀並連回原文，整理自 AHA／ACC／ESC 等權威來源。">
<meta name="keywords" content="心血管,精選閱讀,衛教,膽固醇,AHA,ACC,ESC,呂侑穎">
<meta name="author" content="呂侑穎醫師">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${BASE_URL}/featured.html">
<meta property="og:title" content="每周精選閱讀 — 台安醫院心臟內科。呂侑穎醫師。臨床筆記">
<meta property="og:description" content="每周精選一篇值得一讀的心血管好文，附中文重點導讀並連回原文。">
<meta property="og:type" content="website">
<meta property="og:url" content="${BASE_URL}/featured.html">
<meta property="og:locale" content="zh_TW">
<meta property="og:site_name" content="台安醫院心臟內科。呂侑穎醫師。臨床筆記">
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

${shellHeader(null, '')}

<div class="hero">
<h1>每周精選閱讀</h1>
<p>每周精選一篇值得一讀的心血管好文，附上中文重點導讀，並連回原文出處。</p>
</div>
<div class="article-count">${featured.length} 篇精選</div>

<div class="cards">
${cards}
</div>

${shellFooter('')}

</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// all clinical notes listing — posts.html
// ---------------------------------------------------------------------------
function renderNotesPage(articles) {
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
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: '全部臨床筆記', url: BASE_URL + '/posts.html', inLanguage: 'zh-TW',
    description: '呂侑穎醫師的心臟醫學臨床筆記全部文章，整理自 ACC、AHA、ESC 等國際會議與最新指南。',
  };

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>全部臨床筆記 — 台安醫院心臟內科。呂侑穎醫師。臨床筆記</title>
<meta name="description" content="呂侑穎醫師的心臟醫學臨床筆記全部文章：臨床試驗、臨床指南、會議重點、醫療新知與 Podcast 整理，來源為 ACC、AHA、ESC 等國際會議與最新指南。">
<meta name="keywords" content="臨床筆記,心臟醫學,臨床試驗,臨床指南,會議重點,醫療新知,呂侑穎">
<meta name="author" content="呂侑穎醫師">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${BASE_URL}/posts.html">
<meta property="og:title" content="全部臨床筆記 — 台安醫院心臟內科。呂侑穎醫師。臨床筆記">
<meta property="og:description" content="呂侑穎醫師的心臟醫學臨床筆記全部文章，整理自 ACC、AHA、ESC 等國際會議與最新指南。">
<meta property="og:type" content="website">
<meta property="og:url" content="${BASE_URL}/posts.html">
<meta property="og:locale" content="zh_TW">
<meta property="og:site_name" content="台安醫院心臟內科。呂侑穎醫師。臨床筆記">
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

${shellHeader('posts.html', '')}

<div class="hero">
<h1>臨床筆記</h1>
<p>心臟醫學的臨床筆記與實證整理，涵蓋臨床試驗、指南、會議重點與醫療新知，來源為 ACC／AHA／ESC 等國際會議與最新指南。</p>
</div>
<div class="article-count">${articles.length} 篇文章</div>

<div class="cards">
${cards}
</div>

${shellFooter('')}

</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// clinic schedule (門診時刻表) — clinic.html
// ---------------------------------------------------------------------------
const fmtMD = iso => { const [, m, d] = iso.split('-'); return `${+m}/${+d}`; };

function renderClinicGrid(c) {
  const days = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
  const periods = [['上午', c.amTime], ['下午', c.pmTime]];
  const find = (day, period) => c.sessions.find(s => s.day === day && s.period === period);
  const head = `<tr><th>時段</th>${days.map(d => `<th>${d}</th>`).join('')}</tr>`;
  const rows = periods.map(([p, t]) => {
    const cells = days.map(d => {
      const s = find(d, p);
      if (!s) return '<td class="off">—</td>';
      const alt = s.note ? ' alt' : '';
      const note = s.note ? `<small>${escHtml(s.note)}</small>` : '';
      return `<td class="on${alt}"><span class="dot"></span>看診${note}</td>`;
    }).join('');
    return `<tr><th>${p}<small>${escHtml(t)}</small></th>${cells}</tr>`;
  }).join('\n');
  return `<div class="sched-scroll"><table class="sched-table"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
}

function renderClinic(c) {
  const url = `${BASE_URL}/clinic.html`;
  const desc = `${c.hospital}${c.dept}${c.doctor.replace(/\s/g, '')}門診時刻表：週一、三、四下午 ${c.pmTime}，週二上午 ${c.amTime}（2026 年 8 月起新增），週日上午 ${c.amTime}（每月單週，即第一、三、五週）。實際門診請以醫院官方掛號系統公告為準。`;
  const sessionBoxes = c.sessions.map(s =>
    `<div class="session-box"><div class="d">${escHtml(s.day)}<span> ${escHtml(s.period)}診</span></div><div class="t">${escHtml(s.time)}</div>${s.note ? `<div class="p">${escHtml(s.note)}看診</div>` : ''}</div>`).join('\n');
  const datePills = c.sundayDates.map(d => `<span class="date-pill">${fmtMD(d)}（日）</span>`).join('\n');

  const jsonld = {
    '@context': 'https://schema.org', '@type': 'MedicalWebPage',
    name: `${c.doctor.replace(/\s/g, '')}門診時刻表`, description: desc, url, inLanguage: 'zh-TW', image: OG_IMAGE,
    dateModified: TODAY, mainEntityOfPage: url,
    about: {
      '@type': 'Physician', name: c.doctor.replace(/\s*醫師$/, ''), medicalSpecialty: 'Cardiovascular',
      worksFor: { '@type': 'Hospital', name: c.hospital },
    },
    publisher: { '@type': 'Organization', name: '台安醫院心臟內科。呂侑穎醫師。臨床筆記' },
  };

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>門診時刻表 — ${escHtml(c.hospital)}${escHtml(c.dept)} ${escHtml(c.doctor)}</title>
<meta name="description" content="${escAttr(desc)}">
<meta name="keywords" content="呂侑穎,門診時刻表,門診時間,台北台安醫院,心臟內科,看診時間,掛號">
<meta name="author" content="呂侑穎醫師">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">
<meta property="og:title" content="門診時刻表 — ${escAttr(c.hospital)}${escAttr(c.dept)} ${escAttr(c.doctor)}">
<meta property="og:description" content="${escAttr(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="zh_TW">
<meta property="og:site_name" content="台安醫院心臟內科。呂侑穎醫師。臨床筆記">
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

${shellHeader('clinic.html', '')}

<div class="hero">
<h1>門診時刻表</h1>
<p>${escHtml(c.hospital)} · ${escHtml(c.dept)} · ${escHtml(c.doctor)}</p>
<div class="hero-cta" style="justify-content:center;margin-top:20px">
<a href="https://www.tahsda.org.tw/Register/add_dr.php?doc=058" target="_blank" rel="noopener" class="btn btn-primary">前往台安醫院線上掛號 →</a>
</div>
</div>

<div class="clinic-wrap">

<div class="session-grid">
${sessionBoxes}
</div>

<div class="clinic-card">
<div class="ch">每週門診表</div>
<div class="cb">
${renderClinicGrid(c)}
<div class="clinic-legend">
<span><i style="background:var(--accent)"></i>固定每週看診</span>
<span><i style="background:var(--teal)"></i>週日上午每月單週／週二上午 8 月起新增</span>
<span><i style="background:var(--line)"></i>無門診</span>
</div>
</div>
</div>

<div class="clinic-card">
<div class="ch">單週週日門診日期（${escHtml(c.sundayPeriodLabel)}）</div>
<div class="cb">
<div class="date-pills">
${datePills}
</div>
</div>
</div>

<div class="clinic-note">
<strong>新增門診：</strong>自 <strong>2026 年 8 月</strong>起，新增 <strong>週二上午（09:00–12:00）</strong>門診。<br>
<strong>掛號提醒：</strong>實際門診時間、診號與停診／代診資訊，請以<strong>台北台安醫院官方網站與<a href="https://www.tahsda.org.tw/Register/add_dr.php?doc=058" target="_blank" rel="noopener" style="color:var(--accent);font-weight:700">線上掛號系統</a>公告為準</strong>。單週週日門診日期可能因假期或醫院安排調整，前往就診前請先確認。本表僅供參考，不構成預約掛號。
</div>

</div>

${shellFooter('')}

</body>
</html>
`;
}

function renderClinicBand(c) {
  const pills = c.sessions.map(s =>
    `<span class="pill">${escHtml(s.day)}${escHtml(s.period)} <b>${escHtml(s.time)}</b>${s.note ? `（${escHtml(s.note)}）` : ''}</span>`).join('');
  return `<section class="band">
<div class="wrap">
<div class="sec-head">
<div><div class="kicker">Clinic Hours</div><h2>門診時刻表</h2></div>
<a href="clinic.html" class="more">完整門診資訊 →</a>
</div>
<a class="clinic-home" href="clinic.html">
<h3>${escHtml(c.hospital)} · ${escHtml(c.dept)}</h3>
<p>${escHtml(c.doctor)}</p>
<div class="sessions">${pills}</div>
<span class="read-btn">查看完整門診時刻表 →</span>
</a>
</div>
</section>`;
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
  'ckd.html': ['ckd', '慢性腎臟病'], 'stent.html': ['stent', '可吸收支架'],
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
// social share bar (LINE / Facebook / X) — injected before <footer> on article pages (idempotent)
function shareBar(url) {
  const u = encodeURIComponent(url);
  return `<div class="share-bar">
<span class="share-label">分享這篇：</span>
<a class="share-btn line" href="https://social-plugins.line.me/lineit/share?url=${u}" target="_blank" rel="noopener" aria-label="分享到 LINE">LINE</a>
<a class="share-btn fb" href="https://www.facebook.com/sharer/sharer.php?u=${u}" target="_blank" rel="noopener" aria-label="分享到 Facebook">Facebook</a>
<a class="share-btn x" href="https://twitter.com/intent/tweet?url=${u}" target="_blank" rel="noopener" aria-label="分享到 X">X</a>
</div>`;
}
function placeShare() {
  const files = [...TOPIC_PAGES];
  for (const d of ['posts', 'featured']) {
    const dir = path.join(ROOT, d);
    if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (f.endsWith('.html')) files.push(`${d}/${f}`);
  }
  let n = 0;
  for (const f of files) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    let html = fs.readFileSync(p, 'utf8');
    if (html.includes('class="share-bar"')) continue;
    const m = html.match(/<link rel="canonical" href="([^"]+)">/);
    if (!m) continue;
    const i = html.indexOf('<footer>');
    if (i < 0) continue;
    html = html.slice(0, i) + shareBar(m[1]) + '\n\n' + html.slice(i);
    fs.writeFileSync(p, html);
    n++;
  }
  console.log(`  placeShare: ${n} page(s)`);
}

// 留言區（Cusdis）— 注入衛教頁與文章底部（先審後顯示為 Cusdis 預設；idempotent）
const CUSDIS_HOST = 'https://cusdis.com';
const CUSDIS_APP_ID = '0587d292-27ab-4082-bc76-15c0cd50293d';
function placeComments() {
  if (!CUSDIS_APP_ID) return;
  const files = [...TOPIC_PAGES];
  for (const d of ['posts', 'featured']) {
    const dir = path.join(ROOT, d);
    if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (f.endsWith('.html')) files.push(`${d}/${f}`);
  }
  let n = 0;
  for (const f of files) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    let html = fs.readFileSync(p, 'utf8');
    if (html.includes('id="cusdis_thread"')) continue;
    const cm = html.match(/<link rel="canonical" href="([^"]+)">/);
    if (!cm) continue;
    const url = cm[1];
    const tm = html.match(/<title>([^<]*)<\/title>/);
    const title = (tm ? tm[1] : '').split(' — ')[0].trim();
    const block = `<section class="comments-wrap">
<h2 class="comments-title">留言與回饋</h2>
<p class="comments-note">歡迎在下方留下你的想法或問題，留言經審核後才會公開顯示。<strong>提醒：本區不提供個別診療，個人病情請就醫或掛號諮詢。</strong></p>
<div id="cusdis_thread" data-host="${CUSDIS_HOST}" data-app-id="${CUSDIS_APP_ID}" data-page-id="${url}" data-page-url="${url}" data-page-title="${escAttr(title)}"></div>
<script async defer src="${CUSDIS_HOST}/js/cusdis.es.js"></script>
</section>`;
    const i = html.indexOf('<footer>');
    if (i < 0) continue;
    html = html.slice(0, i) + block + '\n\n' + html.slice(i);
    fs.writeFileSync(p, html);
    n++;
  }
  console.log(`  placeComments: ${n} page(s)`);
}
// inject Google Analytics (gtag.js) before </head> on every page (idempotent)
function placeAnalytics() {
  const tag = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');
</script>
`;
  const dirs = ['.', 'posts', 'featured'];
  let n = 0;
  for (const d of dirs) {
    const dir = path.join(ROOT, d);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.html')) continue;
      const p = path.join(dir, f);
      let html = fs.readFileSync(p, 'utf8');
      if (html.includes(GA_ID) || !html.includes('</head>')) continue;
      html = html.replace('</head>', tag + '</head>');
      fs.writeFileSync(p, html); n++;
    }
  }
  console.log(`  placeAnalytics: ${n} page(s)`);
}
// 每頁專屬社群分享圖：把 og:image / twitter:image 指到 img/og/<name>.png（若已產生）
function placeOgImages() {
  let n = 0;
  for (const [file, name] of Object.entries(OG_MAP)) {
    const p = path.join(ROOT, file);
    if (!fs.existsSync(p)) continue;
    if (!fs.existsSync(path.join(ROOT, 'img', 'og', `${name}.png`))) continue;
    let html = fs.readFileSync(p, 'utf8');
    const url = `${BASE_URL}/img/og/${name}.png`;
    const before = html;
    html = html.replace(/(<meta property="og:image" content=")[^"]*(">)/, `$1${url}$2`);
    html = html.replace(/(<meta name="twitter:image" content=")[^"]*(">)/, `$1${url}$2`);
    if (html !== before) { fs.writeFileSync(p, html); n++; }
  }
  console.log(`  placeOgImages: ${n} page(s)`);
}

// ---------------------------------------------------------------------------
// sitemap
// ---------------------------------------------------------------------------
function renderSitemap(articles, featured, quizzes) {
  const urls = BASE_PAGES.map(p => `  <url>
    <loc>${BASE_URL}/${p.f === 'index.html' ? '' : p.f}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`);
  urls.push(`  <url>
    <loc>${BASE_URL}/featured.html</loc>
    <lastmod>${(featured[0] && featured[0].date) || TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`);
  urls.push(`  <url>
    <loc>${BASE_URL}/clinic.html</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`);
  for (const a of articles) urls.push(`  <url>
    <loc>${BASE_URL}/posts/${a.slug}.html</loc>
    <lastmod>${a.date || TODAY}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`);
  for (const f of featured) urls.push(`  <url>
    <loc>${BASE_URL}/featured/${f.slug}.html</loc>
    <lastmod>${f.date || TODAY}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`);
  urls.push(`  <url>
    <loc>${BASE_URL}/quizzes.html</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`);
  for (const q of (quizzes || [])) urls.push(`  <url>
    <loc>${BASE_URL}/quiz-${q.slug}.html</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
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
// replace the inner content of a <div> block, matching the correct closing tag
function replaceDivBlock(html, openTag, newInner) {
  const start = html.indexOf(openTag);
  if (start < 0) return html;
  const innerStart = start + openTag.length;
  const re = /<div[\s>]|<\/div>/g;
  re.lastIndex = innerStart;
  let depth = 1, m;
  while ((m = re.exec(html))) {
    if (m[0] === '</div>') {
      depth--;
      if (depth === 0) return html.slice(0, innerStart) + '\n' + newInner + '\n' + html.slice(m.index);
    } else depth++;
  }
  return html;
}

function categoryCard(a) {
  return `<a class="card" href="posts/${a.slug}.html">
<div class="card-header">
<span class="card-tag ${a.tagCls}">${escHtml(a.tagLabel)}</span>
<div class="card-title">${escHtml(a.title)}</div>
<div class="card-subtitle">${escHtml(a.subtitle)}</div>
<div class="card-meta">
${(a.meta || []).map(s => `<span>${escHtml(s)}</span>`).join('\n')}
</div>
</div>
<div class="card-footer">
<span class="read-btn">閱讀全文 &rarr;</span>
</div>
</a>`;
}

// auto-fill category listing pages (news/trials/guidelines/meetings) from articles.json
function buildCategoryPages(articles) {
  for (const [file, tags] of Object.entries(CATEGORY_PAGES)) {
    const list = articles.filter(a => tags.includes(a.tagCls));
    const cards = list.map(categoryCard).join('\n\n');
    let html = read(file);
    html = replaceDivBlock(html, '<div class="cards">', cards);
    html = html.replace(/<div class="article-count">[^<]*<\/div>/, `<div class="article-count">${list.length} 篇文章</div>`);
    write(file, html);
    console.log(`  category ${file}: ${list.length} card(s)`);
  }
}

// ---------------------------------------------------------------------------
// 衛教知識測驗 — data/quizzes.json → quiz-<slug>.html + quizzes.html
// ---------------------------------------------------------------------------
function loadQuizzes() {
  const p = path.join(ROOT, 'data', 'quizzes.json');
  if (!fs.existsSync(p)) return [];
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function gaSnippet() {
  return `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');
</script>`;
}

function renderQuizPage(quiz) {
  const url = `${BASE_URL}/quiz-${quiz.slug}.html`;
  const desc = quiz.metaDesc || quiz.subtitle;
  const jsonld = {
    '@context': 'https://schema.org', '@type': 'MedicalWebPage',
    name: quiz.title, description: desc, url, inLanguage: 'zh-TW',
    author: { '@type': 'Person', name: '呂侑穎', jobTitle: '心臟內科醫師', url: `${BASE_URL}/about.html` },
    publisher: { '@type': 'Organization', name: '台安醫院心臟內科。呂侑穎醫師。臨床筆記' },
    dateModified: TODAY, mainEntityOfPage: url,
  };
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(quiz.title)} — 台安醫院心臟內科。呂侑穎醫師。臨床筆記</title>
<meta name="description" content="${escAttr(desc)}">
<meta name="keywords" content="${escAttr(quiz.keywords || '衛教測驗,呂侑穎')}">
<meta name="author" content="呂侑穎醫師">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${escAttr(quiz.title)}">
<meta property="og:description" content="${escAttr(quiz.subtitle)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="zh_TW">
<meta property="og:site_name" content="台安醫院心臟內科。呂侑穎醫師。臨床筆記">
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
${gaSnippet()}
</head>
<body>

${shellHeader('quizzes.html', '')}

<nav class="crumb" aria-label="breadcrumb"><a href="index.html">首頁</a><span class="sep">›</span><a href="quizzes.html">知識測驗</a><span class="sep">›</span><span class="cur">${escHtml(quiz.shortTitle || quiz.title)}</span></nav>

<div class="hero">
<h1>${escHtml(quiz.title)}</h1>
<p>${escHtml(quiz.subtitle)}</p>
</div>

<div class="quiz-intro"><p>${quiz.intro}</p></div>

<div class="quiz-wrap">
<div id="quiz"></div>
<div class="quiz-score" id="score"></div>
</div>

<div class="quiz-wrap" style="padding-top:0">
<div class="source">
${quiz.source}${quiz.related ? `｜想看完整說明請見 <a href="${quiz.related}">${escHtml(quiz.relatedLabel || '衛教全文')}</a>` : ''}
</div>
</div>

${shellFooter('')}

<script>window.QUIZ_DATA = ${JSON.stringify(quiz.questions)};</script>
<script src="quiz.js"></script>

</body>
</html>
`;
}

function renderQuizzesIndex(quizzes) {
  const cards = quizzes.map(q => `<a class="card" href="quiz-${q.slug}.html">
<div class="card-header">
<span class="card-tag exam">知識測驗</span>
<div class="card-title">${escHtml(q.title)}</div>
<div class="card-subtitle">${escHtml(q.subtitle)}</div>
<div class="card-meta"><span>${q.questions.length} 題</span></div>
</div>
<div class="card-footer"><span class="read-btn">開始測驗 &rarr;</span></div>
</a>`).join('\n');
  const jsonld = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: '衛教知識測驗', url: BASE_URL + '/quizzes.html', inLanguage: 'zh-TW',
    description: '心血管與健康衛教的互動小測驗，測完即時看正解與依據。',
  };
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>衛教知識測驗 — 台安醫院心臟內科。呂侑穎醫師。臨床筆記</title>
<meta name="description" content="心血管與健康衛教的互動小測驗：測完即時看正解與依據，整理自國際指南與臨床試驗。台安醫院心臟內科呂侑穎醫師。">
<meta name="keywords" content="衛教測驗,健康知識測驗,心臟衛教,維生素D 測驗,呂侑穎">
<meta name="author" content="呂侑穎醫師">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${BASE_URL}/quizzes.html">
<meta property="og:title" content="衛教知識測驗 — 台安醫院心臟內科。呂侑穎醫師。臨床筆記">
<meta property="og:description" content="心血管與健康衛教的互動小測驗：測完即時看正解與依據。">
<meta property="og:type" content="website">
<meta property="og:url" content="${BASE_URL}/quizzes.html">
<meta property="og:locale" content="zh_TW">
<meta property="og:site_name" content="台安醫院心臟內科。呂侑穎醫師。臨床筆記">
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
${gaSnippet()}
</head>
<body>

${shellHeader('quizzes.html', '')}

<div class="hero">
<h1>衛教知識測驗</h1>
<p>用互動小測驗，測測你的健康觀念——測完立刻看正解與依據</p>
</div>
<div class="article-count">${quizzes.length} 個測驗</div>

<div class="cards">
${cards}
</div>

${shellFooter('')}

</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// 站內搜尋 — build 掃描各頁 title/description/keywords → search-index.json
// ---------------------------------------------------------------------------
function buildSearchIndex(articles, quizzes) {
  const items = [];
  const grab = (file, url, cat) => {
    if (!fs.existsSync(path.join(ROOT, file))) return;
    const html = read(file);
    const pick = re => { const m = html.match(re); return m ? m[1] : ''; };
    const title = pick(/<title>([^<]*)<\/title>/).split(' — ')[0].trim();
    const desc = pick(/name="description" content="([^"]*)"/);
    const kw = pick(/name="keywords" content="([^"]*)"/);
    if (title) items.push({ t: title, d: desc, k: kw, u: url, c: cat });
  };
  for (const f of TOPIC_PAGES) grab(f, f, '衛教');
  [['health.html', '衛教專區'], ['about.html', '醫師介紹'], ['clinic.html', '門診時刻表'], ['risk.html', '風險計算'], ['featured.html', '精選閱讀']].forEach(([f, c]) => grab(f, f, c));
  for (const a of articles) grab(`posts/${a.slug}.html`, `posts/${a.slug}.html`, a.tagLabel || '文章');
  for (const q of quizzes) grab(`quiz-${q.slug}.html`, `quiz-${q.slug}.html`, '測驗');
  write('search-index.json', JSON.stringify(items));
  console.log(`  search-index.json: ${items.length} entries`);
}

function renderSearchPage() {
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>站內搜尋 — 台安醫院心臟內科。呂侑穎醫師。臨床筆記</title>
<meta name="description" content="搜尋台安醫院心臟內科呂侑穎醫師臨床筆記站內的衛教主題、文章與知識測驗。">
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="${BASE_URL}/search.html">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
${headLinks('')}
${gaSnippet()}
</head>
<body>

${shellHeader('search.html', '')}

<div class="hero">
<h1>站內搜尋</h1>
<p>輸入關鍵字，搜尋衛教主題、文章與知識測驗</p>
</div>

<div class="search-box">
<input type="search" id="search-input" placeholder="例如：心悸、膽固醇、腳腫、支架、魚油…" autocomplete="off" autofocus aria-label="站內搜尋">
</div>
<div class="search-results" id="search-results"></div>

${shellFooter('')}

<script src="search.js"></script>

</body>
</html>
`;
}

function main() {
  console.log('luknow build (v2)');
  const articles = loadArticles();
  console.log(`  ${articles.length} articles loaded`);
  const featured = loadFeatured();
  const quizzes = loadQuizzes();
  console.log(`  ${featured.length} featured reads loaded`);

  write('index.html', renderHome(articles, featured));
  console.log('  wrote index.html (branded homepage)');

  write('posts.html', renderNotesPage(articles));
  console.log('  wrote posts.html (全部臨床筆記)');

  write('clinic.html', renderClinic(CLINIC));
  console.log('  wrote clinic.html (門診時刻表)');

  fs.mkdirSync(path.join(ROOT, 'posts'), { recursive: true });
  for (const a of articles) write(`posts/${a.slug}.html`, renderPost(a));
  console.log(`  generated ${articles.length} posts/`);

  if (featured.length) {
    write('featured.html', renderFeaturedArchive(featured));
    fs.mkdirSync(path.join(ROOT, 'featured'), { recursive: true });
    for (const f of featured) write(`featured/${f.slug}.html`, renderFeaturedPost(f));
    console.log(`  generated featured.html + ${featured.length} featured/`);
  }

  if (quizzes.length) {
    for (const q of quizzes) write(`quiz-${q.slug}.html`, renderQuizPage(q));
    write('quizzes.html', renderQuizzesIndex(quizzes));
    console.log(`  generated quizzes.html + ${quizzes.length} quiz page(s)`);
  }

  write('search.html', renderSearchPage());
  buildSearchIndex(articles, quizzes);
  console.log('  wrote search.html + search-index.json');

  let n = 0;
  for (const f of ROOT_HTML) {
    if (f === 'index.html') continue;
    if (applyShell(f, navActiveFor(f))) n++;
  }
  console.log(`  applyShell: updated ${n} root page(s)`);

  buildCategoryPages(articles);

  placeIllos();
  placeHubIllos();
  placeShare();
  placeComments();
  placeAnalytics();
  placeOgImages();

  write('sitemap.xml', renderSitemap(articles, featured, quizzes));
  console.log(`  sitemap.xml: ${BASE_PAGES.length + 2 + articles.length + featured.length} urls`);
  console.log('done.');
}

main();
