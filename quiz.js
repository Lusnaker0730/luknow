/* 衛教快速測驗 — 共用互動邏輯，讀取各頁的 window.QUIZ_DATA */
(function () {
  var QUIZ = window.QUIZ_DATA || [];
  var quizEl = document.getElementById('quiz');
  var scoreEl = document.getElementById('score');
  if (!quizEl) return;
  var answered = 0, correct = 0;

  function render() {
    answered = 0; correct = 0;
    scoreEl.className = 'quiz-score';
    quizEl.innerHTML = '';
    QUIZ.forEach(function (item, qi) {
      var box = document.createElement('div');
      box.className = 'quiz-q';
      var opts = item.opts.map(function (o, oi) {
        return '<button class="quiz-opt" data-q="' + qi + '" data-o="' + oi + '">' + o + '</button>';
      }).join('');
      box.innerHTML = '<div class="qnum">第 ' + (qi + 1) + ' 題 / 共 ' + QUIZ.length + ' 題</div>' +
        '<h3>' + item.q + '</h3>' + opts +
        '<div class="quiz-exp" id="exp-' + qi + '"><b>說明：</b>' + item.exp + '</div>';
      quizEl.appendChild(box);
    });
    Array.prototype.forEach.call(quizEl.querySelectorAll('.quiz-opt'), function (btn) {
      btn.addEventListener('click', onPick);
    });
  }

  function onPick(e) {
    var qi = +e.target.dataset.q, oi = +e.target.dataset.o;
    var item = QUIZ[qi];
    var btns = quizEl.querySelectorAll('.quiz-opt[data-q="' + qi + '"]');
    Array.prototype.forEach.call(btns, function (b) { b.disabled = true; });
    btns[item.ans].classList.add('correct');
    btns[item.ans].innerHTML += '<span class="tick">✓</span>';
    if (oi === item.ans) correct++;
    else { e.target.classList.add('wrong'); e.target.innerHTML += '<span class="tick">✗</span>'; }
    document.getElementById('exp-' + qi).classList.add('show');
    answered++;
    if (answered === QUIZ.length) showScore();
  }

  function showScore() {
    scoreEl.innerHTML = '你答對了 <b>' + correct + ' / ' + QUIZ.length + '</b> 題！<br>' +
      '<button class="quiz-again" id="quiz-again">↺ 再測一次</button>';
    scoreEl.className = 'quiz-score show';
    document.getElementById('quiz-again').addEventListener('click', render);
    scoreEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  render();
})();
