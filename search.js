/* 站內搜尋 — 讀 search-index.json，即時篩選 title/description/keywords */
(function () {
  var input = document.getElementById('search-input');
  var out = document.getElementById('search-results');
  if (!input || !out) return;
  var idx = [];

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function run(q) {
    q = (q || '').trim().toLowerCase();
    if (!q) { out.innerHTML = ''; return; }
    var hits = idx.filter(function (it) {
      return (it.t + ' ' + it.d + ' ' + it.k).toLowerCase().indexOf(q) !== -1;
    });
    if (!hits.length) {
      out.innerHTML = '<p class="search-empty">找不到「' + esc(q) + '」相關內容，換個關鍵字試試。</p>';
      return;
    }
    out.innerHTML = '<p class="search-count">找到 ' + hits.length + ' 筆</p>' + hits.map(function (it) {
      return '<a class="search-result" href="' + it.u + '">' +
        '<span class="sr-cat">' + esc(it.c) + '</span>' +
        '<span class="sr-title">' + esc(it.t) + '</span>' +
        '<span class="sr-desc">' + esc(it.d) + '</span></a>';
    }).join('');
  }

  fetch('search-index.json').then(function (r) { return r.json(); }).then(function (data) {
    idx = data;
    var q = new URLSearchParams(location.search).get('q');
    if (q) { input.value = q; run(q); }
  }).catch(function () {
    out.innerHTML = '<p class="search-empty">搜尋索引載入失敗，請稍後再試。</p>';
  });

  input.addEventListener('input', function () { run(input.value); });
})();
