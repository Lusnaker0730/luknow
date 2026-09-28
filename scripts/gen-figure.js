#!/usr/bin/env node
/**
 * gen-figure.js — 文章內衛教圖(直式 1080×1350,網站內文與臉書貼文共用)
 *
 * 作法同 gen-og.js:本機 headless google-chrome 對 HTML 模板截圖。
 * 圖的內容寫在 data/figures.json(單一事實來源),每筆 = 一張圖:
 *   { name, template: "checklist", title, subtitle, items:[{head, text, note?}], callout?, sources, }
 * 輸出:img/fig/<name>.png;文章在 articles.json 用 figures:[{name, alt, caption?}] 引用。
 *
 * 用法:node scripts/gen-figure.js            → 全部重產
 *       node scripts/gen-figure.js <name> ...  → 只產指定的
 * 字型沿用 scripts/ogfonts/(先跑過 gen-og.js 會自動下載)。
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const FONTS = path.join(__dirname, 'ogfonts');
const SERIF = 'file://' + path.join(FONTS, 'serif-black.otf');
const SANS = 'file://' + path.join(FONTS, 'sans-700.woff2');
const OUT = path.join(ROOT, 'img', 'fig');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'fig-'));
const W = 1080, H = 1350;

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function checklistHtml(f) {
  const items = f.items.map((it, i) => `
<div class="item">
  <div class="num">${i + 1}</div>
  <div class="itxt">
    <div class="head">${esc(it.head)}</div>
    <div class="text">${esc(it.text)}</div>
    ${it.note ? `<div class="note">${esc(it.note)}</div>` : ''}
  </div>
</div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'NSerif';src:url('${SERIF}') format('opentype');font-weight:900}
@font-face{font-family:'NSans';src:url('${SANS}') format('woff2');font-weight:700}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px}
body{display:flex;flex-direction:column;background:#fffdf9;font-family:'NSans',sans-serif;
padding:48px 64px 36px;color:#14323a}
.tagline{color:#c43d34;font-size:22px;font-weight:700;letter-spacing:.12em}
h1{font-family:'NSerif';font-size:58px;line-height:1.2;font-weight:900;margin-top:10px}
.sub{font-size:27px;color:#3c5158;margin-top:12px;line-height:1.45}
.list{display:flex;flex-direction:column;gap:13px;margin-top:22px}
.item{display:flex;gap:22px;align-items:flex-start;background:#fff;border:2px solid #ece5d8;
border-radius:22px;padding:16px 24px}
.num{flex-shrink:0;width:58px;height:58px;border-radius:50%;background:#0f7a82;color:#fff;
font-family:'NSerif';font-size:34px;display:flex;align-items:center;justify-content:center}
.itxt{flex:1;min-width:0}
.head{font-size:33px;font-weight:700;line-height:1.3}
.text{font-size:24px;color:#3c5158;line-height:1.45;margin-top:5px}
.note{display:inline-block;font-size:22px;color:#9c2f28;background:#fbe9e4;border-radius:10px;
padding:3px 12px;margin-top:7px;line-height:1.4}
.callout{margin-top:auto;background:#14323a;color:#fff;border-radius:20px;padding:18px 26px;
font-size:25px;line-height:1.5}
.callout b{color:#ffd9a8}
.foot{display:flex;align-items:flex-end;gap:16px;border-top:2px solid #ece5d8;padding-top:14px;margin-top:16px}
.src{font-size:17px;color:#7d8a8c;line-height:1.45;flex:1}
.brand{text-align:right;flex-shrink:0}
.brand .n{font-size:24px;font-weight:700}
.brand .u{font-size:24px;font-weight:700;color:#9c2f28}
</style></head><body>
<div class="tagline">CARDIOLOGY · 心臟內科</div>
<h1>${esc(f.title)}</h1>
${f.subtitle ? `<div class="sub">${esc(f.subtitle)}</div>` : ''}
<div class="list">${items}</div>
${f.callout ? `<div class="callout">${f.callout.map(esc).join('<br>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</div>` : ''}
<div class="foot">
  <div class="src">${esc(f.sources)}</div>
  <div class="brand"><div class="n">呂侑穎醫師的臨床筆記</div><div class="u">drluyy.com</div></div>
</div>
</body></html>`;
}

// 證據金字塔:tiers 由上(證據最硬、最窄)到下;bins = 底下並排的「沒效/有害」框
function pyramidHtml(f) {
  const n = f.tiers.length;
  const tiers = f.tiers.map((t, i) => {
    const wTop = 46 + (54 / n) * i, wBot = 46 + (54 / n) * (i + 1); // 寬度百分比
    const inset = (100 - wTop) / 2 - (100 - wBot) / 2;               // 斜邊內縮(相對本層寬度)
    const pct = inset / wBot * 100;
    return `
<div class="tier" style="width:${wBot}%;background:${t.color};clip-path:polygon(${pct}% 0,${100 - pct}% 0,100% 100%,0 100%)">
  <div class="rank">${esc(t.rank)}</div>
  <div class="tlabel">${esc(t.label)}</div>
  <div class="titems">${esc(t.items)}</div>
</div>`;
  }).join('');
  const bins = (f.bins || []).map(b => `
<div class="bin" style="border-color:${b.color}">
  <div class="bhead" style="color:${b.color}">${esc(b.head)}</div>
  <div class="bitems">${esc(b.items)}</div>
</div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'NSerif';src:url('${SERIF}') format('opentype');font-weight:900}
@font-face{font-family:'NSans';src:url('${SANS}') format('woff2');font-weight:700}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px}
body{display:flex;flex-direction:column;background:#fffdf9;font-family:'NSans',sans-serif;
padding:48px 56px 36px;color:#14323a}
.tagline{color:#c43d34;font-size:22px;font-weight:700;letter-spacing:.12em}
h1{font-family:'NSerif';font-size:56px;line-height:1.2;font-weight:900;margin-top:10px}
.sub{font-size:26px;color:#3c5158;margin-top:10px;line-height:1.45}
.pyr{display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:20px}
.tier{color:#fff;text-align:center;padding:16px 0 18px}
.rank{font-size:22px;letter-spacing:.08em;opacity:.85}
.tlabel{font-size:33px;line-height:1.3;margin-top:4px}
.titems{font-size:25px;line-height:1.45;margin:6px auto 0;max-width:90%;color:#fff8ec;white-space:pre-line}
.bins{display:flex;gap:16px;margin-top:18px}
.bin{flex:1;border:3px solid;border-radius:20px;padding:12px 22px;background:#fff}
.bhead{font-size:29px}
.bitems{font-size:23px;color:#3c5158;line-height:1.5;margin-top:4px;white-space:pre-line}
.note{font-size:21px;color:#9c2f28;margin-top:10px;line-height:1.4}
.foot{display:flex;align-items:flex-end;gap:16px;border-top:2px solid #ece5d8;padding-top:14px;margin-top:auto}
.src{font-size:16px;color:#7d8a8c;line-height:1.45;flex:1}
.brand{text-align:right;flex-shrink:0}
.brand .n{font-size:23px;font-weight:700}
.brand .u{font-size:23px;font-weight:700;color:#9c2f28}
</style></head><body>
<div class="tagline">CARDIOLOGY · 心臟內科</div>
<h1>${esc(f.title)}</h1>
${f.subtitle ? `<div class="sub">${esc(f.subtitle)}</div>` : ''}
<div class="pyr">${tiers}</div>
<div class="bins"${f.binsStack ? ' style="flex-direction:column;gap:12px"' : ''}>${bins}</div>
${f.notes ? f.notes.map(x => `<div class="note">${esc(x)}</div>`).join('') : ''}
<div class="foot">
  <div class="src">${esc(f.sources)}</div>
  <div class="brand"><div class="n">呂侑穎醫師的臨床筆記</div><div class="u">drluyy.com</div></div>
</div>
</body></html>`;
}

const TEMPLATES = { checklist: checklistHtml, pyramid: pyramidHtml };

function render(f) {
  const tpl = TEMPLATES[f.template];
  if (!tpl) throw new Error(`unknown template "${f.template}" (${f.name})`);
  const htmlPath = path.join(TMP, f.name + '.html');
  const outPath = path.join(OUT, f.name + '.png');
  fs.writeFileSync(htmlPath, tpl(f));
  execFileSync('google-chrome', [
    '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--user-data-dir=' + path.join(TMP, '_chrome'),
    '--virtual-time-budget=3000', '--force-device-scale-factor=1',
    `--window-size=${W},${H}`, '--screenshot=' + outPath, 'file://' + htmlPath,
  ], { stdio: 'ignore' });
  return outPath;
}

if (!fs.existsSync(path.join(FONTS, 'serif-black.otf'))) {
  console.error('缺字型:先跑一次 node scripts/gen-og.js <任一 slug> 讓它下載 ogfonts/');
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });
const all = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'figures.json'), 'utf8'));
const only = process.argv.slice(2);
const todo = only.length ? all.filter(f => only.includes(f.name)) : all;
console.log(`產生 ${todo.length} 張衛教圖 …`);
for (const f of todo) { render(f); console.log('  ✓ ' + f.name + '.png'); }
fs.rmSync(TMP, { recursive: true, force: true });
