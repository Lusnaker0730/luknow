#!/usr/bin/env node
/**
 * gen-og.js — 產生每一頁專屬的社群分享卡（1200×630）到 img/og/<name>.png
 *
 * 作法：用本機的 headless google-chrome 對一份品牌卡 HTML 截圖。
 * 衛教頁的標題／分類／插圖直接從 health.html 的卡片解析（單一事實來源）；
 * 其他靜態頁（分類頁、門診、關於、測驗、精選）用下方 OTHER 清單。
 *
 * 字型：Noto Serif TC（標題，含全形標點）+ Noto Sans TC（內文），
 * 放在 scripts/ogfonts/，若不存在會自動下載（需網路）。
 *
 * 用法：node scripts/gen-og.js          # 全部重產
 *       node scripts/gen-og.js coffee    # 只產指定 name（可多個）
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'img', 'og');
const FONTS = path.join(__dirname, 'ogfonts');
const TMP = path.join(require('os').tmpdir(), 'og-cards');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

// ── 字型：不存在就抓 ───────────────────────────────
const FONT_FILES = {
  'serif-black.otf': 'https://github.com/notofonts/noto-cjk/raw/main/Serif/SubsetOTF/TC/NotoSerifTC-Black.otf',
  'sans-700.woff2': 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-tc/files/noto-sans-tc-chinese-traditional-700-normal.woff2',
};
fs.mkdirSync(FONTS, { recursive: true });
for (const [name, url] of Object.entries(FONT_FILES)) {
  const p = path.join(FONTS, name);
  if (!fs.existsSync(p) || fs.statSync(p).size < 1000) {
    console.log(`  下載字型 ${name} …`);
    execFileSync('curl', ['-fsSL', '-o', p, url]);
  }
}
const SERIF = 'file://' + path.join(FONTS, 'serif-black.otf');
const SANS = 'file://' + path.join(FONTS, 'sans-700.woff2');

// ── 分類色調（沿用站上 .card-tag 配色）────────────────
const TONE = {
  teal:   ['rgba(15,122,130,.12)', '#0f7a82'],
  gold:   ['#f6ecd9', '#a9762a'],
  blue:   ['rgba(58,90,156,.12)', '#3a5a9c'],
  red:    ['rgba(196,61,52,.10)', '#c43d34'],
  green:  ['#eef3ef', '#4a6b60'],
  violet: ['#efe2f3', '#7a4a8c'],
  orange: ['#fbe6da', '#c05a2a'],
  ink:    ['rgba(20,50,58,.08)', '#14323a'],
};
const CAT_TONE = { prevent: 'teal', risk: 'gold', treatment: 'blue', exam: 'teal', disease: 'red', symptom: 'green' };

// ── 從 health.html 解析 28 篇衛教 ───────────────────
function eduPages() {
  const html = fs.readFileSync(path.join(ROOT, 'health.html'), 'utf8');
  const re = /<a class="card" href="([^"]+)\.html" data-cat="([a-z]+)">\s*<img class="card-illo" src="([^"]+)"[^>]*>\s*<div class="card-header">\s*<span class="card-tag [a-z]+">([^<]+)<\/span>\s*<div class="card-title">([^<]+)<\/div>/g;
  const out = [];
  let m;
  while ((m = re.exec(html))) {
    const [, slug, cat, illo, label, title] = m;
    out.push({ name: slug, title, label, tone: CAT_TONE[cat] || 'ink', illo });
  }
  return out;
}

// ── 其他靜態頁（手寫清單）──────────────────────────
const OTHER = [
  { name: 'index',      title: '心臟醫學的臨床筆記與實證衛教', label: '臨床筆記',   tone: 'red',    illo: 'img/illo/_brand.svg' },
  { name: 'posts',      title: '臨床筆記',           label: '全部文章',   tone: 'red',    illo: 'img/illo/_brand.svg' },
  { name: 'trials',     title: '重點臨床試驗',        label: '臨床試驗',   tone: 'teal',   illo: 'img/illo/_brand.svg' },
  { name: 'guidelines', title: '臨床指南',           label: '臨床指南',   tone: 'gold',   illo: 'img/illo/_brand.svg' },
  { name: 'meetings',   title: '會議重點',           label: '會議重點',   tone: 'violet', illo: 'img/illo/_brand.svg' },
  { name: 'news',       title: '醫療新知',           label: '醫療新知',   tone: 'orange', illo: 'img/illo/_brand.svg' },
  { name: 'health',     title: '心血管衛教專區',      label: '衛教專區',   tone: 'red',    illo: 'img/illo/_brand.svg' },
  { name: 'about',      title: '呂侑穎 醫師',        label: '醫師介紹',   tone: 'ink',    illo: 'img/illo/_brand.svg' },
  { name: 'clinic',     title: '門診時刻表',         label: '門診資訊',   tone: 'gold',   illo: 'img/illo/_brand.svg' },
  { name: 'risk',       title: '心血管風險計算器',    label: '風險計算',   tone: 'teal',   illo: 'img/illo/_brand.svg' },
  { name: 'quizzes',    title: '衛教知識測驗',        label: '知識測驗',   tone: 'teal',   illo: 'img/illo/_brand.svg' },
  { name: 'featured',   title: '每周精選閱讀',        label: '精選閱讀',   tone: 'ink',    illo: 'img/illo/_brand.svg' },
  { name: 'quiz-fish-oil',      title: '魚油快速測驗',     label: '知識測驗', tone: 'teal', illo: 'img/illo/fish-oil.svg' },
  { name: 'quiz-heart-stent',   title: '心臟支架快速測驗',  label: '知識測驗', tone: 'teal', illo: 'img/illo/stent.jpg' },
  { name: 'quiz-lipoprotein-a', title: '脂蛋白(a) 快速測驗', label: '知識測驗', tone: 'teal', illo: 'img/illo/lipoprotein-a.svg' },
  { name: 'quiz-vitamin-d',     title: '維生素D 快速測驗',  label: '知識測驗', tone: 'teal', illo: 'img/illo/vitamin-d.svg' },
  { name: 'coffee-and-heart',   title: '咖啡與心臟',       label: '精選閱讀', tone: 'ink',  illo: 'img/illo/coffee.svg' },
  { name: 'resorbable-stent',   title: '可吸收支架',       label: '精選閱讀', tone: 'ink',  illo: 'img/illo/stent.jpg' },
  { name: 'aha-cholesterol-guideline-top10', title: 'AHA 膽固醇指南十大重點', label: '精選閱讀', tone: 'ink', illo: 'img/illo/chol.jpg' },
  { name: 'dcb-bifurcation', title: '分岔病灶與藥物塗層氣球', label: '醫療新知', tone: 'orange', illo: 'img/illo/stent.jpg' },
  { name: 'glp1-dementia', title: '瘦瘦針能預防失智嗎？', label: '醫療新知', tone: 'orange', illo: 'img/illo/stroke.jpg' },
  { name: 'fish-oil-evidence', title: '魚油能顧心臟嗎？', label: '醫療新知', tone: 'orange', illo: 'img/illo/fish-oil.svg' },
];

// ── 卡片 HTML ─────────────────────────────────────
function titleSize(t) {
  const n = [...t.replace(/\s/g, '')].length;
  if (n <= 8) return 74;
  if (n <= 12) return 64;
  if (n <= 18) return 56;
  return 48;
}
function cardHtml({ title, label, tone, illo }) {
  const [bg, fg] = TONE[tone] || TONE.ink;
  const illoAbs = 'file://' + path.join(ROOT, illo);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'NSerif';src:url('${SERIF}') format('opentype');font-weight:900}
@font-face{font-family:'NSans';src:url('${SANS}') format('woff2');font-weight:700}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1200px;height:630px}
body{display:flex;flex-direction:column;justify-content:space-between;background:#fffdf9;
font-family:'NSans',sans-serif;padding:64px 72px}
.tagline{color:#c43d34;font-size:24px;font-weight:700;letter-spacing:.12em}
.row{display:flex;align-items:center;gap:52px;flex:1;margin-top:8px}
.txt{flex:1;min-width:0}
.cat{display:inline-block;background:${bg};color:${fg};font-size:26px;font-weight:700;
padding:8px 24px;border-radius:999px;margin-bottom:26px}
h1{font-family:'NSerif';font-size:${titleSize(title)}px;line-height:1.28;color:#14323a;font-weight:900}
.illo{width:320px;height:320px;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.illo img{width:100%;height:100%;object-fit:contain;border-radius:24px}
.foot{display:flex;align-items:center;gap:16px;border-top:2px solid #ece5d8;padding-top:28px}
.brand{font-size:32px;font-weight:700;color:#14323a}
.url{margin-left:auto;color:#9c2f28;font-size:30px;font-weight:700}
</style></head><body>
<div class="tagline">CARDIOLOGY · 心臟內科</div>
<div class="row">
<div class="txt"><span class="cat">${label}</span><h1>${title}</h1></div>
<div class="illo"><img src="${illoAbs}"></div>
</div>
<div class="foot"><span class="brand">呂侑穎醫師的臨床筆記</span><span class="url">drluyy.com</span></div>
</body></html>`;
}

// ── 產圖 ──────────────────────────────────────────
function render(entry) {
  const htmlPath = path.join(TMP, entry.name + '.html');
  const outPath = path.join(OUT, entry.name + '.png');
  fs.writeFileSync(htmlPath, cardHtml(entry));
  execFileSync('google-chrome', [
    '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--user-data-dir=' + path.join(TMP, '_chrome'),
    '--virtual-time-budget=3000', '--force-device-scale-factor=1',
    '--window-size=1200,630', '--screenshot=' + outPath, 'file://' + htmlPath,
  ], { stdio: 'ignore' });
  return outPath;
}

const only = process.argv.slice(2);
let all = [...eduPages(), ...OTHER];
if (only.length) all = all.filter(e => only.includes(e.name));
console.log(`產生 ${all.length} 張分享卡 …`);
let ok = 0;
for (const e of all) {
  try {
    render(e);
    ok++;
    process.stdout.write(`  ✓ ${e.name}.png\n`);
  } catch (err) {
    process.stdout.write(`  ✗ ${e.name} — ${err.message}\n`);
  }
}
console.log(`完成：${ok}/${all.length}`);
