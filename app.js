(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const ARABIC_LETTERS = ['أ', 'ب', 'ج', 'د'];
  const STORAGE_KEY = 'wahid_quiz_history_v1';

  const state = {
    categoryId: null,
    settings: {
      questionCount: 10,
      timePerQuestion: 30,
      questionOrder: 'random',
      showExplanation: 'yes',
      difficulties: [1,2,3,4,5],
      sourceFilter: 'any',
      playMode: 'single',
      playerCount: 2,
    },
    questions: [],
    currentIndex: 0,
    score: 0,
    answers: [],
    timer: null,
    timerLeft: 0,
    locked: false,
    players: [],       // [{ name, score, correct, wrong, skipped }]
    currentPlayer: 0,  // index into players
  };

  const DIFF_LABELS = {1:'سهل جداً', 2:'سهل', 3:'متوسط', 4:'صعب', 5:'صعب جداً'};

  /* ---------------- PhD-level "Deep Dive" academic link ----------------
     Resolves a quiz item to a pre-generated scholarly concept page that is
     stored IN THE SITE (concepts.js + concept.html). The 10-section analysis
     is authored ahead of time, so the link opens an in-site page — no
     redirect to any external assistant. The link only appears when a stored
     entry exists for the concept (matched by alias against question+answer). */
  function normAr(s) {
    return (s || '')
      .replace(/[ً-ْٰـ]/g, '') // tashkeel + tatweel
      .replace(/[إأآا]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function conceptSlugFor(question, answer) {
    const C = window.CONCEPTS || {};
    const hay = normAr(answer) + ' | ' + normAr(question);
    for (const slug in C) {
      const aliases = C[slug].aliases || [C[slug].title_ar];
      for (const al of aliases) {
        if (al && hay.includes(normAr(al))) return slug;
      }
    }
    return null;
  }

  function deepDiveLinkHTML(question, answer) {
    const slug = conceptSlugFor(question, answer);
    if (!slug) return '';
    const title = (window.CONCEPTS[slug].title_ar) || 'تحليل أكاديمي';
    return `<a class="deep-dive-link" href="concept.html?c=${encodeURIComponent(slug)}" target="_blank" rel="noopener" title="تحليل أكاديمي شامل (١٠ أقسام) محفوظ داخل الموقع">🎓 تعمّق أكاديمي · ${title} ↗</a>`;
  }

  /* ---------------- Arabic-Indic numerals helper ---------------- */
  function toArabicNum(n) {
    const map = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
    return String(n).split('').map(c => /[0-9]/.test(c) ? map[+c] : c).join('');
  }

  /* ---------------- Screens routing ---------------- */
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    $(id).classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------- Home: categories ---------------- */
  function renderCategories() {
    const wrap = $('categories');
    wrap.innerHTML = '';
    for (const cat of CATEGORIES) {
      const qs = QUESTIONS[cat.id] || [];
      const count = qs.length;
      const byD = {1:0,2:0,3:0,4:0,5:0};
      let srcCount = 0;
      for (const q of qs) { byD[q.d || 3]++; if (q.src) srcCount++; }
      const dots = [1,2,3,4,5].map(d =>
        `<span class="d-dot d${d}" title="${DIFF_LABELS[d]}: ${byD[d]}">${toArabicNum(byD[d])}</span>`
      ).join('');
      const volTag = cat.vol ? `<span class="vol-tag">${cat.vol}</span>` : '';
      const card = document.createElement('div');
      card.className = 'cat-card';
      card.tabIndex = 0;
      card.innerHTML = `
        <div class="cat-header">
          <div class="cat-icon">${cat.icon}</div>
          ${volTag}
        </div>
        <div class="cat-title">${cat.title}</div>
        <div class="cat-desc">${cat.desc}</div>
        <div class="cat-diff-row">${dots}</div>
        <div class="cat-meta">
          <span><strong>${toArabicNum(count)}</strong> سؤالاً ${srcCount ? ` · <strong>${toArabicNum(srcCount)}</strong> من الكتاب` : ''}</span>
          <span>اضغط للبدء ←</span>
        </div>
      `;
      const open = () => openSettings(cat.id);
      card.addEventListener('click', open);
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') open(); });
      wrap.appendChild(card);
    }
  }

  /* ---------------- Settings screen ---------------- */
  function openSettings(catId) {
    state.categoryId = catId;
    const cat = catId === '__all__'
      ? { title: 'المسابقة الشاملة' }
      : catId === '__random__'
        ? { title: 'أسئلة عشوائية سريعة' }
        : CAT_BY_ID[catId];
    $('settingsTitle').textContent = 'إعدادات المسابقة — ' + cat.title;

    if (catId === '__random__') {
      $('questionCount').value = '15';
      $('timePerQuestion').value = '15';
      $('questionOrder').value = 'random';
    }

    renderPlayerNameInputs();
    showScreen('settingsScreen');
  }

  /* ---------------- Players setup ---------------- */
  function renderPlayerNameInputs() {
    const wrap = $('playerNames');
    if (!wrap) return;
    const count = parseInt($('playerCount').value, 10) || 2;
    // preserve already-typed names
    const existing = Array.from(wrap.querySelectorAll('input')).map(i => i.value);
    wrap.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const row = document.createElement('div');
      row.className = 'player-name-row';
      row.innerHTML = `<span class="pnum">${toArabicNum(i + 1)}</span>`;
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 20;
      input.placeholder = `لاعب ${toArabicNum(i + 1)}`;
      input.value = existing[i] || '';
      row.appendChild(input);
      wrap.appendChild(row);
    }
  }

  function togglePlayersSetup() {
    const isMulti = $('playMode').value === 'multi';
    $('playersSetup').classList.toggle('hidden', !isMulti);
    if (isMulti) renderPlayerNameInputs();
  }

  /* ---------------- Build question pool ---------------- */
  function buildPool() {
    let pool;
    if (state.categoryId === '__all__' || state.categoryId === '__random__') {
      pool = getAllQuestions();
    } else {
      pool = (QUESTIONS[state.categoryId] || []).map(q => ({ ...q, cat: state.categoryId }));
    }

    // Filter by difficulty
    const allowedDiff = new Set(state.settings.difficulties);
    pool = pool.filter(q => allowedDiff.has(q.d || 3));

    // Filter by source
    if (state.settings.sourceFilter === 'book')    pool = pool.filter(q => !!q.src);
    if (state.settings.sourceFilter === 'general') pool = pool.filter(q => !q.src);

    if (state.settings.questionOrder === 'random') {
      pool = shuffle(pool);
    }
    if (state.settings.questionCount !== 'all') {
      pool = pool.slice(0, Math.min(state.settings.questionCount, pool.length));
    }
    return pool;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---------------- Quiz lifecycle ---------------- */
  function beginQuiz() {
    state.settings.questionCount = $('questionCount').value === 'all' ? 'all' : parseInt($('questionCount').value, 10);
    state.settings.timePerQuestion = parseInt($('timePerQuestion').value, 10);
    state.settings.questionOrder = $('questionOrder').value;
    state.settings.showExplanation = $('showExplanation').value;
    state.settings.sourceFilter = $('sourceFilter').value;
    state.settings.playMode = $('playMode').value;
    state.settings.playerCount = parseInt($('playerCount').value, 10) || 2;

    const checked = Array.from(document.querySelectorAll('#difficultyChecks input:checked'))
      .map(cb => parseInt(cb.value, 10));
    state.settings.difficulties = checked.length ? checked : [1,2,3,4,5];

    // Initialize players for multiplayer mode
    if (state.settings.playMode === 'multi') {
      const inputs = Array.from(document.querySelectorAll('#playerNames input'));
      state.players = inputs.map((inp, i) => ({
        name: (inp.value || '').trim() || `لاعب ${toArabicNum(i + 1)}`,
        score: 0, correct: 0, wrong: 0, skipped: 0,
      }));
      state.currentPlayer = 0;
    } else {
      state.players = [];
    }

    state.questions = buildPool();
    if (!state.questions.length) {
      alert('لا توجد أسئلة مطابقة لهذه الفلاتر. جرّب توسيع نطاق الصعوبة أو المصدر.');
      return;
    }

    // In multiplayer, trim questions to a multiple of player count so everyone gets equal turns
    if (state.settings.playMode === 'multi' && state.players.length) {
      const n = state.players.length;
      const usable = Math.floor(state.questions.length / n) * n;
      if (usable >= n) state.questions = state.questions.slice(0, usable);
    }

    state.currentIndex = 0;
    state.score = 0;
    state.answers = [];

    const catTitle = state.categoryId === '__all__'
      ? 'الشاملة'
      : state.categoryId === '__random__'
        ? 'عشوائية'
        : CAT_BY_ID[state.categoryId].title;
    $('categoryBadge').textContent = catTitle;
    $('qTotal').textContent = toArabicNum(state.questions.length);

    showScreen('quizScreen');
    renderQuestion();
  }

  function renderQuestion() {
    const q = state.questions[state.currentIndex];
    if (!q) { return finishQuiz(); }

    state.locked = false;
    $('explanationBox').classList.add('hidden');
    $('nextBtn').disabled = true;
    $('skipBtn').disabled = false;

    const num = state.currentIndex + 1;
    $('qIndex').textContent = toArabicNum(num);

    // Player turn banner (multiplayer) vs single live score
    const banner = $('turnBanner');
    if (state.settings.playMode === 'multi' && state.players.length) {
      state.currentPlayer = state.currentIndex % state.players.length;
      const p = state.players[state.currentPlayer];
      $('turnName').textContent = p.name;
      $('turnScore').textContent = toArabicNum(p.score) + ' نقطة';
      banner.classList.remove('hidden');
      $('liveScore').textContent = toArabicNum(p.score);
    } else {
      banner.classList.add('hidden');
      $('liveScore').textContent = toArabicNum(state.score);
    }

    const diff = q.d || 3;
    const numEl = $('questionNumber');
    numEl.innerHTML = `<span class="diff-badge d${diff}">${DIFF_LABELS[diff]}</span>السؤال ${toArabicNum(num)}`;
    $('questionText').textContent = q.q;

    $('progressFill').style.width = ((state.currentIndex) / state.questions.length * 100) + '%';

    const optsWrap = $('options');
    optsWrap.innerHTML = '';
    const indices = q.o.map((_, i) => i);
    const shuffledIndices = state.settings.questionOrder === 'random' ? shuffle(indices) : indices;
    q._shuffled = shuffledIndices;

    shuffledIndices.forEach((origIdx, displayIdx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option';
      btn.innerHTML = `<span class="option-letter">${ARABIC_LETTERS[displayIdx]}</span><span class="option-text">${q.o[origIdx]}</span>`;
      btn.addEventListener('click', () => handleAnswer(origIdx, btn));
      optsWrap.appendChild(btn);
    });

    setupTimer();
  }

  function setupTimer() {
    clearInterval(state.timer);
    const sec = state.settings.timePerQuestion;
    if (!sec || sec <= 0) {
      $('timerWrap').classList.add('hidden');
      return;
    }
    $('timerWrap').classList.remove('hidden');
    state.timerLeft = sec;
    updateTimerUI();
    state.timer = setInterval(() => {
      state.timerLeft--;
      if (state.timerLeft <= 0) {
        clearInterval(state.timer);
        if (!state.locked) handleAnswer(-1, null); // timeout
      }
      updateTimerUI();
    }, 1000);
  }

  function updateTimerUI() {
    $('timerText').textContent = toArabicNum(Math.max(0, state.timerLeft));
    const ring = document.querySelector('.timer-ring');
    if (ring) {
      const pct = (state.timerLeft / state.settings.timePerQuestion) * 100;
      ring.style.setProperty('--p', pct + '%');
    }
  }

  function handleAnswer(chosenIdx, btn) {
    if (state.locked) return;
    state.locked = true;
    clearInterval(state.timer);

    const q = state.questions[state.currentIndex];
    const isCorrect = chosenIdx === q.a;
    const skippedByTimer = chosenIdx === -1;

    if (isCorrect) state.score++;

    // Credit the current player in multiplayer mode
    if (state.settings.playMode === 'multi' && state.players.length) {
      const p = state.players[state.currentPlayer];
      if (isCorrect) { p.score++; p.correct++; }
      else if (skippedByTimer) p.skipped++;
      else p.wrong++;
      $('turnScore').textContent = toArabicNum(p.score) + ' نقطة';
    }

    state.answers.push({
      question: q.q,
      options: q.o,
      chosen: chosenIdx,
      correct: q.a,
      isCorrect,
      skipped: skippedByTimer,
      explanation: q.e,
      wrongs: q.w,
      src: q.src,
      date: q.date,
      d: q.d || 3,
      cat: q.cat || state.categoryId,
    });

    // mark visual state on all option buttons
    const optButtons = document.querySelectorAll('#options .option');
    optButtons.forEach((b) => {
      b.disabled = true;
      const letterEl = b.querySelector('.option-letter');
      const displayIdx = Array.from(b.parentNode.children).indexOf(b);
      const origIdx = q._shuffled[displayIdx];
      if (origIdx === q.a) b.classList.add('correct');
      if (origIdx === chosenIdx && !isCorrect) b.classList.add('wrong');
    });

    if (state.settings.showExplanation === 'yes') {
      $('explanationText').textContent = q.e || '';
      const meta = $('explanationMeta');
      if (meta) {
        const dateChip = q.date ? `<span class="meta-chip date-chip" title="تاريخ الحدث">📅 ${q.date}</span>` : '';
        const srcChip  = q.src  ? `<span class="meta-chip src-chip"  title="المصدر في الكتاب">📖 ${q.src}</span>`  : '';
        meta.innerHTML = dateChip + srcChip;
      }
      const dd = $('deepDive');
      if (dd) {
        const h = deepDiveLinkHTML(q.q, q.o[q.a]);
        dd.innerHTML = h;
        dd.style.display = h ? '' : 'none';
      }
      // Wrong-option explanations
      const wrongsBox = $('wrongsBox');
      if (wrongsBox) {
        if (q.w && q.w.length === q.o.length) {
          let html = '<div class="wrongs-label">لماذا الخيارات الأخرى خاطئة؟</div><ul class="wrongs-list">';
          for (let i = 0; i < q.o.length; i++) {
            if (i === q.a || !q.w[i]) continue;
            html += `<li><strong>${q.o[i]}:</strong> ${q.w[i]}</li>`;
          }
          html += '</ul>';
          wrongsBox.innerHTML = html;
          wrongsBox.classList.remove('hidden');
        } else {
          wrongsBox.innerHTML = '';
          wrongsBox.classList.add('hidden');
        }
      }
      $('explanationBox').classList.remove('hidden');
    }

    if (state.settings.playMode === 'multi' && state.players.length) {
      $('liveScore').textContent = toArabicNum(state.players[state.currentPlayer].score);
    } else {
      $('liveScore').textContent = toArabicNum(state.score);
    }
    $('nextBtn').disabled = false;
    $('skipBtn').disabled = true;
  }

  function skipQuestion() {
    if (state.locked) return;
    handleAnswer(-1, null);
  }

  function nextQuestion() {
    state.currentIndex++;
    if (state.currentIndex >= state.questions.length) finishQuiz();
    else renderQuestion();
  }

  /* ---------------- Result ---------------- */
  function finishQuiz() {
    clearInterval(state.timer);

    // Multiplayer: show leaderboard
    if (state.settings.playMode === 'multi' && state.players.length) {
      renderLeaderboard();
      $('leaderboardCard').classList.remove('hidden');
      $('singleResultCard').classList.add('hidden');
      $('reviewList').classList.add('hidden');
      showScreen('resultScreen');
      return;
    }
    $('leaderboardCard').classList.add('hidden');
    $('singleResultCard').classList.remove('hidden');

    const total = state.questions.length;
    const correct = state.answers.filter(a => a.isCorrect).length;
    const wrong = state.answers.filter(a => !a.isCorrect && !a.skipped).length;
    const skipped = state.answers.filter(a => a.skipped).length;
    const pct = total ? Math.round((correct / total) * 100) : 0;

    $('finalScore').textContent = toArabicNum(correct);
    $('finalTotal').textContent = toArabicNum(total);
    $('statCorrect').textContent = toArabicNum(correct);
    $('statWrong').textContent = toArabicNum(wrong);
    $('statSkipped').textContent = toArabicNum(skipped);
    $('statPercent').textContent = toArabicNum(pct) + '٪';

    let title, icon, summary;
    if (pct >= 90)      { title = 'أداء استثنائي!';     icon = '★'; summary = 'إتقان رفيع لتاريخ الأمة، يستحق الإشادة.'; }
    else if (pct >= 70) { title = 'ممتاز ما شاء الله';   icon = '✦'; summary = 'إلمام جيد جداً ببنية الأحداث والأسماء.'; }
    else if (pct >= 50) { title = 'أداء جيد';            icon = '◈'; summary = 'أنت على الطريق الصحيح، راجع الفصول التي أخطأت فيها.'; }
    else if (pct >= 30) { title = 'بداية معقولة';        icon = '◆'; summary = 'هناك مجال للتحسن — جرّب مراجعة الإجابات.'; }
    else                { title = 'تحتاج إلى مراجعة';    icon = '○'; summary = 'لا بأس، التاريخ يُبنى بالتكرار، أعد المحاولة.'; }

    $('resultTitle').textContent = title;
    $('resultIcon').textContent = icon;
    $('resultSummary').textContent = summary;
    $('reviewList').classList.add('hidden');

    saveHistoryEntry({ correct, total, pct, catId: state.categoryId, date: Date.now() });
    showScreen('resultScreen');
  }

  function renderLeaderboard() {
    const perPlayer = state.players.length ? state.questions.length / state.players.length : 0;
    // rank by score desc; ties keep order
    const ranked = state.players
      .map((p, i) => ({ ...p, idx: i }))
      .sort((a, b) => b.score - a.score || a.idx - b.idx);

    const top = ranked[0];
    const tiedTop = ranked.filter(p => p.score === top.score);
    $('leaderboardSummary').textContent = tiedTop.length > 1
      ? `تعادل في الصدارة بين ${toArabicNum(tiedTop.length)} متسابقين بـ ${toArabicNum(top.score)} نقطة`
      : `الفائز: ${top.name} بـ ${toArabicNum(top.score)} من ${toArabicNum(perPlayer)} نقطة`;

    const medals = ['🥇','🥈','🥉'];
    const ol = $('leaderboard');
    ol.innerHTML = '';
    let lastScore = null, lastRank = 0;
    ranked.forEach((p, i) => {
      // dense ranking: same score → same rank
      const rank = (p.score === lastScore) ? lastRank : i + 1;
      lastScore = p.score; lastRank = rank;
      const li = document.createElement('li');
      li.className = `lb-row rank-${rank}`;
      const medal = rank <= 3 ? `<span class="lb-medal">${medals[rank - 1]}</span>` : `<span class="lb-rank">${toArabicNum(rank)}</span>`;
      li.innerHTML = `
        ${medal}
        <div class="lb-name">${escHtml(p.name)}
          <div class="lb-detail">✓ ${toArabicNum(p.correct)} صحيحة · ✗ ${toArabicNum(p.wrong)} خاطئة${p.skipped ? ` · ⏭ ${toArabicNum(p.skipped)}` : ''}</div>
        </div>
        <span class="lb-points">${toArabicNum(p.score)}</span>
      `;
      ol.appendChild(li);
    });
  }

  function renderReview() {
    const wrap = $('reviewList');
    wrap.innerHTML = '';
    state.answers.forEach((a, i) => {
      const item = document.createElement('div');
      item.className = 'review-item ' + (a.isCorrect ? 'r-correct' : (a.skipped ? 'r-skipped' : 'r-wrong'));
      const chosenText = a.skipped ? '(لم تجب)' : a.options[a.chosen];
      const d = a.d || 3;
      const dateChip = a.date ? `<span class="meta-chip date-chip">📅 ${a.date}</span>` : '';
      const srcChip  = a.src  ? `<span class="meta-chip src-chip">📖 ${a.src}</span>`  : '';
      let wrongsHtml = '';
      if (a.wrongs && a.wrongs.length === a.options.length) {
        wrongsHtml = '<div class="wrongs-label">لماذا الخيارات الأخرى خاطئة؟</div><ul class="wrongs-list">';
        for (let k = 0; k < a.options.length; k++) {
          if (k === a.correct || !a.wrongs[k]) continue;
          wrongsHtml += `<li><strong>${a.options[k]}:</strong> ${a.wrongs[k]}</li>`;
        }
        wrongsHtml += '</ul>';
      }
      const ddLink = deepDiveLinkHTML(a.question, a.options[a.correct]);
      item.innerHTML = `
        <div class="review-q">
          <span class="diff-badge d${d}">${DIFF_LABELS[d]}</span>
          ${toArabicNum(i+1)}. ${a.question}
        </div>
        <div class="review-meta">${dateChip}${srcChip}</div>
        <div class="review-a">إجابتك: <strong class="${a.isCorrect ? 'green' : 'red'}">${chosenText}</strong></div>
        ${!a.isCorrect ? `<div class="review-a">الصحيح: <strong class="green">${a.options[a.correct]}</strong></div>` : ''}
        ${a.explanation ? `<div class="review-exp">${a.explanation}</div>` : ''}
        ${wrongsHtml}
        ${ddLink ? `<div class="deep-dive">${ddLink}</div>` : ''}
      `;
      wrap.appendChild(item);
    });
    wrap.classList.remove('hidden');
    wrap.scrollIntoView({ behavior: 'smooth' });
  }

  /* ---------------- History (localStorage) ---------------- */
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  }

  function saveHistoryEntry(entry) {
    const list = loadHistory();
    list.unshift(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 30)));
  }

  function renderStats() {
    const list = loadHistory();
    const ov = $('statsOverview');
    const totalRuns = list.length;
    const avgPct = totalRuns ? Math.round(list.reduce((s, e) => s + e.pct, 0) / totalRuns) : 0;
    const best = totalRuns ? Math.max(...list.map(e => e.pct)) : 0;
    const totalQ = list.reduce((s, e) => s + e.total, 0);

    ov.innerHTML = '';
    const cards = [
      { num: toArabicNum(totalRuns), label: 'محاولة' },
      { num: toArabicNum(avgPct) + '٪', label: 'المتوسط' },
      { num: toArabicNum(best) + '٪', label: 'أعلى نتيجة' },
      { num: toArabicNum(totalQ), label: 'مجموع الأسئلة' },
    ];
    cards.forEach(c => {
      const d = document.createElement('div');
      d.className = 'overview-card';
      d.innerHTML = `<div class="overview-num">${c.num}</div><div class="overview-label">${c.label}</div>`;
      ov.appendChild(d);
    });

    const hist = $('historyList');
    hist.innerHTML = '';
    if (!list.length) {
      hist.innerHTML = '<p class="muted">لا توجد محاولات سابقة بعد.</p>';
      return;
    }
    list.forEach(e => {
      const catTitle = e.catId === '__all__'
        ? 'الشاملة'
        : e.catId === '__random__'
          ? 'عشوائية'
          : (CAT_BY_ID[e.catId]?.title || '—');
      const date = new Date(e.date);
      const dateStr = date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) +
                      ' • ' + date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
      const item = document.createElement('div');
      item.className = 'history-item';
      item.innerHTML = `
        <div>
          <div class="h-cat">${catTitle}</div>
          <div class="h-date">${dateStr}</div>
        </div>
        <div class="h-score">${toArabicNum(e.correct)}/${toArabicNum(e.total)} • ${toArabicNum(e.pct)}٪</div>
      `;
      hist.appendChild(item);
    });
  }

  /* ---------------- Wire up events ---------------- */
  function init() {
    renderCategories();

    $('startAllBtn').addEventListener('click', () => openSettings('__all__'));
    $('startRandomBtn').addEventListener('click', () => openSettings('__random__'));
    $('backFromSettings').addEventListener('click', () => goHome());
    $('beginQuizBtn').addEventListener('click', beginQuiz);

    $('playMode').addEventListener('change', togglePlayersSetup);
    $('playerCount').addEventListener('change', renderPlayerNameInputs);

    $('nextBtn').addEventListener('click', nextQuestion);
    $('skipBtn').addEventListener('click', skipQuestion);

    $('reviewBtn').addEventListener('click', renderReview);
    $('retryBtn').addEventListener('click', () => beginQuiz());
    $('homeBtn').addEventListener('click', goHome);
    $('lbRetryBtn').addEventListener('click', () => beginQuiz());
    $('lbHomeBtn').addEventListener('click', goHome);

    $('navHome').addEventListener('click', goHome);
    $('navSearch').addEventListener('click', () => {
      setActiveNav('navSearch');
      showScreen('searchScreen');
      lazyLoadSearchIndex().then(() => initSearch());
    });
    $('navStats').addEventListener('click', () => { renderStats(); setActiveNav('navStats'); showScreen('statsScreen'); });
    $('navAbout').addEventListener('click', () => { setActiveNav('navAbout'); showScreen('aboutScreen'); });

    $('clearHistoryBtn').addEventListener('click', () => {
      if (confirm('سيتم مسح كل سجل المحاولات. هل أنت متأكد؟')) {
        localStorage.removeItem(STORAGE_KEY);
        renderStats();
      }
    });

    document.addEventListener('keydown', (e) => {
      const quizActive = !$('quizScreen').classList.contains('hidden');
      if (!quizActive) return;
      if (e.key >= '1' && e.key <= '4' && !state.locked) {
        const idx = parseInt(e.key, 10) - 1;
        const btn = document.querySelectorAll('#options .option')[idx];
        if (btn) btn.click();
      } else if (e.key === 'Enter' && !$('nextBtn').disabled) {
        nextQuestion();
      } else if (e.key === 's' || e.key === 'S') {
        if (!$('skipBtn').disabled) skipQuestion();
      }
    });

    setActiveNav('navHome');
  }

  function setActiveNav(id) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    $(id).classList.add('active');
  }

  function goHome() {
    setActiveNav('navHome');
    showScreen('homeScreen');
  }

  /* ---------------- Book search + page reader ---------------- */
  const searchState = {
    initialized: false,
    indexLoaded: false,
    indexLoading: null,    // Promise while loading
    selectedVols: new Set(),
    allVols: [],
    byVol: {},
    currentReader: null,
  };

  function lazyLoadSearchIndex() {
    if (searchState.indexLoaded) return Promise.resolve();
    if (searchState.indexLoading) return searchState.indexLoading;

    const summary = $('searchSummary');
    summary.innerHTML = '<span class="loading">⏳ يتم تحميل فهرس الكتاب (~٢١ ميجا)، يستغرق ثوانٍ معدودة...</span>';

    searchState.indexLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'search_index.js';
      s.onload = () => {
        searchState.indexLoaded = true;
        summary.innerHTML = '';
        resolve();
      };
      s.onerror = () => {
        summary.innerHTML = '<span class="error">تعذّر تحميل الفهرس. تأكّد من وجود search_index.js بجانب الصفحة.</span>';
        reject(new Error('failed to load search_index.js'));
      };
      document.head.appendChild(s);
    });
    return searchState.indexLoading;
  }

  // Normalize Arabic text for search: strip diacritics, unify alef/yeh/teh-marbuta
  function normalizeArabic(s) {
    if (!s) return '';
    return s
      .replace(/[ً-ْٰ]/g, '')   // tashkeel
      .replace(/[إأآا]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .toLowerCase();
  }

  function initSearch() {
    if (searchState.initialized) return;
    searchState.initialized = true;

    if (typeof SEARCH_INDEX === 'undefined' || !Array.isArray(SEARCH_INDEX)) {
      $('searchSummary').textContent = 'تعذر تحميل فهرس الكتاب.';
      return;
    }

    // Pre-compute normalized text for every entry, attach global index for nav
    SEARCH_INDEX.forEach((e, i) => { e._n = normalizeArabic(e.text); e._i = i; });
    $('searchTotalPages').textContent = toArabicNum(SEARCH_INDEX.length);

    // List unique volumes + per-volume entries sorted by page
    const seen = new Set();
    for (const e of SEARCH_INDEX) {
      if (!seen.has(e.vol)) {
        seen.add(e.vol);
        searchState.allVols.push({ vol: e.vol, title: e.title });
        searchState.byVol[e.vol] = [];
      }
      searchState.byVol[e.vol].push(e);
    }
    for (const v of Object.keys(searchState.byVol)) {
      searchState.byVol[v].sort((a, b) => a.page - b.page);
    }
    renderVolFilters();

    $('searchBtn').addEventListener('click', runSearch);
    $('searchInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') runSearch();
    });
    // Debounced live search
    let timer = null;
    $('searchInput').addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(runSearch, 250);
    });

    // Wire up reader modal once
    $('pageClose').addEventListener('click', closeReader);
    $('pageOverlay').addEventListener('click', (e) => {
      if (e.target === $('pageOverlay')) closeReader();
    });
    $('pagePrev').addEventListener('click', () => navigateReader(-1));
    $('pageNext').addEventListener('click', () => navigateReader(+1));
    document.addEventListener('keydown', (e) => {
      if (!searchState.currentReader) return;
      if (e.key === 'Escape')      closeReader();
      else if (e.key === 'ArrowLeft')  navigateReader(+1);  // RTL: left arrow = next
      else if (e.key === 'ArrowRight') navigateReader(-1);  // RTL: right arrow = prev
    });
  }

  function renderVolFilters() {
    const wrap = $('volFilters');
    wrap.innerHTML = '';
    // "All" pseudo button
    const allBtn = document.createElement('button');
    allBtn.className = 'vol-chip active';
    allBtn.textContent = 'كل المجلدات';
    allBtn.dataset.vol = '__all__';
    allBtn.addEventListener('click', () => {
      searchState.selectedVols.clear();
      wrap.querySelectorAll('.vol-chip').forEach(b => {
        b.classList.toggle('active', b.dataset.vol === '__all__');
      });
      runSearch();
    });
    wrap.appendChild(allBtn);

    for (const v of searchState.allVols) {
      const btn = document.createElement('button');
      btn.className = 'vol-chip';
      btn.textContent = v.vol;
      btn.title = v.title;
      btn.dataset.vol = v.vol;
      btn.addEventListener('click', () => {
        // toggle this vol; if any individual selected, "all" turns off
        if (searchState.selectedVols.has(v.vol)) {
          searchState.selectedVols.delete(v.vol);
          btn.classList.remove('active');
        } else {
          searchState.selectedVols.add(v.vol);
          btn.classList.add('active');
        }
        const allActive = searchState.selectedVols.size === 0;
        wrap.querySelector('[data-vol="__all__"]').classList.toggle('active', allActive);
        runSearch();
      });
      wrap.appendChild(btn);
    }
  }

  function runSearch() {
    const query = $('searchInput').value.trim();
    const results = $('searchResults');
    const summary = $('searchSummary');
    if (!query) {
      results.innerHTML = '';
      summary.textContent = '';
      return;
    }
    const nq = normalizeArabic(query);
    if (nq.length < 2) {
      summary.textContent = 'أدخل حرفين على الأقل.';
      results.innerHTML = '';
      return;
    }

    const t0 = performance.now();
    const matches = [];
    for (const e of SEARCH_INDEX) {
      if (searchState.selectedVols.size && !searchState.selectedVols.has(e.vol)) continue;
      const idx = e._n.indexOf(nq);
      if (idx >= 0) {
        // Count occurrences for ranking
        let count = 0, i = 0;
        while ((i = e._n.indexOf(nq, i)) >= 0) { count++; i += nq.length; }
        matches.push({ entry: e, firstIdx: idx, count });
      }
    }
    // Sort: by occurrence count desc, then by vol order
    matches.sort((a, b) => b.count - a.count);
    const elapsed = (performance.now() - t0).toFixed(0);

    if (!matches.length) {
      summary.textContent = `لا نتائج لـ «${query}» (${elapsed} مللي ثانية).`;
      results.innerHTML = '';
      return;
    }

    const totalHits = matches.reduce((s, m) => s + m.count, 0);
    summary.innerHTML = `وُجد <strong>${toArabicNum(totalHits)}</strong> مطابقة في <strong>${toArabicNum(matches.length)}</strong> صفحة (${toArabicNum(elapsed)} مللي ثانية).`;

    // Render up to 50 results
    const maxResults = 50;
    const slice = matches.slice(0, maxResults);
    const fragments = slice.map(m => renderResult(m, query, nq));
    results.innerHTML = fragments.join('');
    if (matches.length > maxResults) {
      results.innerHTML += `<div class="more-results">… وأكثر من ${toArabicNum(matches.length - maxResults)} نتيجة أخرى. ضيّق البحث لرؤيتها.</div>`;
    }

    // Wire up click-to-open on each result card
    results.querySelectorAll('.result-card').forEach((card) => {
      const vol = card.dataset.vol;
      const page = parseInt(card.dataset.page, 10);
      card.addEventListener('click', () => openReader(vol, page, query));
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openReader(vol, page, query);
        }
      });
    });
  }

  function renderResult(match, query, nq) {
    const { entry, firstIdx, count } = match;
    // Build snippet around first occurrence in original (non-normalized) text
    // Approximate position in original text by ratio (normalize doesn't change length much)
    const text = entry.text;
    const approxPos = Math.min(firstIdx, text.length - 1);
    const window = 180;
    let start = Math.max(0, approxPos - window);
    let end = Math.min(text.length, approxPos + nq.length + window);
    // Try to align to word boundaries
    if (start > 0) {
      const sp = text.indexOf(' ', start);
      if (sp > -1 && sp - start < 40) start = sp + 1;
    }
    if (end < text.length) {
      const sp = text.lastIndexOf(' ', end);
      if (sp > -1 && end - sp < 40) end = sp;
    }
    let snippet = text.slice(start, end);
    if (start > 0) snippet = '… ' + snippet;
    if (end < text.length) snippet = snippet + ' …';

    // Highlight all occurrences (case/diacritics-insensitive)
    const highlighted = highlightAll(snippet, query);

    return `
      <article class="result-card" data-vol="${escHtml(entry.vol)}" data-page="${entry.page}">
        <div class="result-header">
          <span class="result-vol">${entry.vol}</span>
          <span class="result-title">${entry.title}</span>
          <span class="result-page">صفحة ${toArabicNum(entry.page)}</span>
          ${count > 1 ? `<span class="result-count">${toArabicNum(count)} مطابقة</span>` : ''}
          <span class="open-hint">📖 افتح الصفحة ←</span>
        </div>
        <p class="result-snippet">${highlighted}</p>
      </article>
    `;
  }

  /* ---------------- Reader modal ---------------- */
  function openReader(vol, page, query) {
    const pages = searchState.byVol[vol];
    if (!pages) return;
    const pageIdx = pages.findIndex(p => p.page === page);
    if (pageIdx < 0) return;
    searchState.currentReader = { vol, pageIdx, query: query || '' };
    renderReader();
    $('pageOverlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function navigateReader(delta) {
    if (!searchState.currentReader) return;
    const { vol, pageIdx } = searchState.currentReader;
    const pages = searchState.byVol[vol];
    const newIdx = pageIdx + delta;
    if (newIdx < 0 || newIdx >= pages.length) return;
    searchState.currentReader.pageIdx = newIdx;
    renderReader();
    $('pageBody').scrollTop = 0;
  }

  function renderReader() {
    const { vol, pageIdx, query } = searchState.currentReader;
    const pages = searchState.byVol[vol];
    const entry = pages[pageIdx];
    $('pageVol').textContent = entry.vol;
    $('pageTitle').textContent = entry.title;
    $('pagePage').textContent = 'صفحة ' + toArabicNum(entry.page);
    $('pageBody').innerHTML = query ? highlightAll(entry.text, query) : escHtml(entry.text);
    $('pageCounter').textContent = `${toArabicNum(pageIdx + 1)} / ${toArabicNum(pages.length)} من ${entry.vol}`;
    $('pagePrev').disabled = pageIdx === 0;
    $('pageNext').disabled = pageIdx === pages.length - 1;
  }

  function closeReader() {
    $('pageOverlay').classList.add('hidden');
    searchState.currentReader = null;
    document.body.style.overflow = '';
  }

  function escHtml(s) {
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function highlightAll(text, query) {
    const nq = normalizeArabic(query);
    if (!nq) return escHtml(text);
    // Walk original text, normalizing each char's contribution and finding matches
    const nText = normalizeArabic(text);
    const parts = [];
    let i = 0;
    while (i < text.length) {
      const idx = nText.indexOf(nq, i);
      if (idx < 0) { parts.push(escHtml(text.slice(i))); break; }
      parts.push(escHtml(text.slice(i, idx)));
      parts.push('<mark>' + escHtml(text.slice(idx, idx + nq.length)) + '</mark>');
      i = idx + nq.length;
    }
    return parts.join('');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
