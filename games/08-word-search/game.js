// 단어 탐정: 남은 글자의 비밀
// 숨은 단어를 모두 찾으면, 남은 칸에 흩어져 있던 글자가 빛나며 수수께끼의 답(암호)이 된다.
// 격자 만들기와 판정은 puzzle.js(WordPuzzle)의 순수 함수가 맡고, 여기서는 화면과 진행만 다룬다.
(function () {
  'use strict';

  const { h, clamp, pick, sfx, fx } = Arcade;
  const P = window.WordPuzzle;
  const GAME_ID = 'game08';

  // ----- 설정 (관리자 페이지와 같은 키, 같은 기본값)
  const PRESETS = [
    { stageTime: 60, wrongPenalty: 2, comboWindow: 10, hints: 3 },
    { stageTime: 50, wrongPenalty: 3, comboWindow: 8, hints: 2 },
    { stageTime: 40, wrongPenalty: 4, comboWindow: 6, hints: 1 },
  ];
  const LIMITS = { stageTime: [20, 180], wrongPenalty: [0, 10], comboWindow: [3, 20], hints: [0, 5] };
  const OLD_LEVEL = { easy: 0, normal: 1, hard: 2, custom: 1 }; // 옛 관리자 페이지가 쓰던 난이도 글자
  const num = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));
  const saved = Arcade.loadSettings('word_search_settings', {});
  const level =
    OLD_LEVEL[saved.difficulty] !== undefined ? OLD_LEVEL[saved.difficulty] : clamp(parseInt(saved.difficulty, 10) || 0, 0, 2);
  const S = Object.assign({}, PRESETS[level]);
  // 옛 형식({ timeLimit: 한 판 전체 초 })만 있으면 세 사건에 나눠 1사건 시간으로 옮긴다
  if (saved.stageTime === undefined && num(saved.timeLimit) > 0) {
    S.stageTime = Math.round(clamp(num(saved.timeLimit) / 3, 30, 120));
  }
  Object.keys(LIMITS).forEach((key) => {
    const v = num(saved[key]);
    if (Number.isFinite(v)) S[key] = v;
    S[key] = clamp(S[key], LIMITS[key][0], LIMITS[key][1]);
  });
  S.hints = Math.round(S.hints);

  // 부모가 정한 마지막 사건의 암호. 비었거나 알맞지 않으면 내장 수수께끼를 쓴다
  const customLetters = P.normalizeCode(saved.customCode);
  const CUSTOM = customLetters
    ? {
        letters: customLetters,
        text: customLetters.join(''),
        riddle: String(saved.customRiddle || '').trim().slice(0, 40) || '다음 단서는 어디에 있을까?',
      }
    : null;

  // 격자 규칙(크기, 단어 수, 방향, 가짜 단어)은 puzzle.js 의 STAGES. time 은 1사건 시간에 곱하는 배수
  const STAGES = [
    { time: 1, tiles: 1, goal: '숨은 단어를 <b>끌어서</b> 찾아라! → ↓', sub: '가로·세로로 숨었다' },
    { time: 1.25, tiles: 1, goal: '<b>거꾸로</b> 쓰인 단어도 숨어 있다! ← ↑', sub: '거꾸로 쓰인 단어 조심!' },
    { time: 1.6, tiles: 2, goal: '<b>대각선</b>도 있다! <b>가짜 단어</b> 조심', sub: '대각선과 가짜 단어!' },
  ].map((s, i) => Object.assign({}, P.STAGES[i], s));

  const COLORS = ['#2fd17a', '#4dc3ff', '#ff7ab6', '#ffa94d', '#b38cff', '#ffd43b'];
  const HINT_MS = 1800;
  const EARLY_BONUS = 300; // 암호를 먼저 맞히면 + 못 찾은 단어마다 EARLY_PER_WORD
  const EARLY_PER_WORD = 150;
  const EARLY_SEC = 5;
  const FINAL_BONUS = 200;
  const STAR3_WRONG = 2;
  const STAR2_WRONG = 6;
  const STAR3_TIME = 0.3; // 사건마다 남긴 시간 비율의 평균
  const STAR2_TIME = 0.1;

  function start(game) {
    const ease = Math.min(game.retry, 3); // 재도전할수록 시간을 조금 더 준다
    let stageIdx = game.checkpoint;
    let stage = STAGES[stageIdx];
    let cs = null; // 사건: 주제, 수수께끼, 암호, 찾을 단어
    let pz = null; // 격자
    let phase = 'intro'; // intro | search | code | judging | reveal | final | clear
    let found = new Set();
    let drag = null;
    let entry = []; // 암호 입력. code 단계는 칸 번호, final 단계는 타일 번호
    let entryKind = 'cell';
    let tiles = [];
    let earlyTried = false;
    let earlySolved = false;
    let finalSolved = false;
    let lastFindAt = 0;
    let timer = null;
    let stageSec = 0;
    let themeWords = [];
    let geo = { s: 40, g: 3, pad: 6, p: 43 };
    let cells = [];
    let chips = [];
    let slots = [];
    let tileEls = [];
    const usedThemes = [];
    // 판 전체 기록
    let wrong = 0;
    let hintsLeft = S.hints;
    let hintsUsed = 0;
    let earlyCount = 0;
    const ratios = [];
    const codes = [];

    // ----- 화면
    const wordsEl = h('div', { class: 'ws-words' });
    const bandsEl = h('div', { class: 'ws-bands' });
    const gridEl = h('div', { class: 'ws-grid' });
    const board = h('div', { class: 'ws-board veil' }, [bandsEl, gridEl]);
    const box = h('div', { class: 'ws-box' }, board);
    const tagEl = h('div', { class: 'ws-tag' });
    // 콤보: 엔진의 콤보 띠 대신 사건 카드 안에 작게 띄우고, 다음 단어까지 남은 시간이 줄어든다
    const comboText = h('span');
    const comboFill = h('i');
    const comboEl = h('div', { class: 'ws-combo' }, [comboText, h('b', null, comboFill)]);
    const riddleEl = h('div', { class: 'ws-riddle' });
    const slotsEl = h('div', { class: 'ws-slots' });
    const tagRow = h('div', { class: 'ws-tagrow' }, [tagEl, comboEl]);
    const slotRow = h('div', { class: 'ws-slotrow' }, slotsEl);
    const caseEl = h('div', { class: 'ws-case' }, [h('div', { class: 'ws-q' }, [tagRow, riddleEl]), slotRow]);
    const wrap = h('div', { class: 'ws-wrap' }, [wordsEl, box, caseEl]);
    game.root.append(wrap);
    // 날아가는 글자는 판 위에 따로 띄운다(일시 정지 화면보다는 아래)
    const flyLayer = h('div', { class: 'ws-fly-layer' });
    document.body.appendChild(flyLayer);
    game.onCleanup(() => flyLayer.remove());

    const hintBtn = h('button', { class: 'ar-btn ghost ws-btn', onclick: useHint });
    const earlyBtn = h('button', { class: 'ar-btn ws-btn', onclick: enterCode });
    const eraseBtn = h('button', { class: 'ar-btn ghost ws-btn', html: '<span>⌫ 지우기</span>', onclick: eraseOne });
    const cancelBtn = h('button', { class: 'ar-btn ghost ws-btn', html: '<span>✕ 그만</span><small>벌칙 없음</small>', onclick: leaveCode });
    const trayEl = h('div', { class: 'ws-tray' });

    /** 아래 버튼 줄. 비우면 줄이 사라져 격자 크기가 바뀌므로 언제나 무언가를 둔다 */
    function setFooter(mode) {
      game.footer.innerHTML = '';
      if (mode === 'code') game.footer.append(eraseBtn, cancelBtn);
      else if (mode === 'final') game.footer.append(trayEl);
      else game.footer.append(hintBtn, earlyBtn);
      paintButtons();
    }

    function paintButtons() {
      const can = phase === 'search';
      hintBtn.innerHTML =
        S.hints > 0 ? `<span>🔍 돋보기 <b>${hintsLeft}</b></span><small>쓰면 별 최대 2개</small>` : '<span>🔍 돋보기 없음</span>';
      hintBtn.disabled = !can || hintsLeft <= 0;
      earlyBtn.innerHTML = earlySolved
        ? '<span>🔓 해독 완료</span><small>남은 단어를 찾아라</small>'
        : earlyTried
          ? '<span>🔒 기회 끝</span><small>단어를 다 찾아라</small>'
          : '<span>🔐 암호 먼저</span><small>맞히면 큰 보너스</small>';
      earlyBtn.disabled = !can || earlyTried;
    }

    // ----- 격자 크기: 남은 공간에 맞춘다. 360×640 에서도 8×8 칸이 36px 이상
    function layout() {
      if (!pz) return;
      const n = pz.size;
      const gap = parseFloat(getComputedStyle(wrap).rowGap) || 8;
      const W = wrap.clientWidth;
      const H = wrap.clientHeight - wordsEl.offsetHeight - caseEl.offsetHeight - gap * 2;
      if (!W || H <= 0) return;
      const g = n >= 8 ? 2 : 3;
      const pad = n >= 8 ? 4 : 6;
      const s = Math.max(24, Math.floor(Math.min((W - pad * 2 - g * (n - 1)) / n, (H - pad * 2 - g * (n - 1)) / n, 56)));
      geo = { s, g, pad, p: s + g };
      board.style.setProperty('--n', n);
      board.style.setProperty('--s', s + 'px');
      board.style.setProperty('--g', g + 'px');
      board.style.setProperty('--pad', pad + 'px');
      board.style.setProperty('--p', s + g + 'px');
    }

    function render() {
      gridEl.innerHTML = '';
      bandsEl.innerHTML = '';
      gridEl.className = 'ws-grid';
      board.className = 'ws-board veil';
      cells = pz.letters.map((ch, i) => {
        const el = h('div', { class: 'ws-cell', text: ch, style: { '--i': i } });
        gridEl.appendChild(el);
        return el;
      });
      wordsEl.innerHTML = '';
      chips = pz.words.map((w, i) => {
        const el = h('span', { class: 'ws-word', text: w.text, style: { '--c': COLORS[i % COLORS.length] } });
        wordsEl.appendChild(el);
        return el;
      });
      tagEl.textContent = cs.custom ? '🔐 특별 사건' : `${cs.theme.icon} ${cs.theme.name}`;
      riddleEl.textContent = cs.riddle;
      // 암호가 길면 암호 칸을 아래 줄로 내리고, 높이를 아끼려고 사건 이름 대신 콤보를 그 줄에 둔다
      const stack = pz.code.length > 4;
      caseEl.classList.toggle('stack', stack);
      if (stack) slotRow.prepend(comboEl);
      else tagRow.append(comboEl);
      slotsEl.className = 'ws-slots';
      slotsEl.innerHTML = '';
      slots = pz.code.map((_, k) => {
        const el = h('div', { class: 'ws-slot' });
        el.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          slotTap(k);
        });
        slotsEl.appendChild(el);
        return el;
      });
      paintSlots();
      layout();
    }

    function paintSlots() {
      const typing = phase === 'code' || phase === 'final';
      slots.forEach((el, k) => {
        let ch = '';
        if (earlySolved || finalSolved) ch = pz.code[k];
        else if (entry[k] !== undefined) ch = entryKind === 'cell' ? pz.letters[entry[k]] : tiles[entry[k]].ch;
        el.textContent = ch;
        el.classList.toggle('on', !!ch);
        el.classList.toggle('next', typing && k === entry.length);
      });
    }

    // ----- 색 띠: 첫 칸 가운데를 축으로 돌린 알약 모양
    function setBand(el, list) {
      const n = pz.size;
      const a = list[0];
      const b = list[list.length - 1];
      const dr = Math.floor(b / n) - Math.floor(a / n);
      const dc = (b % n) - (a % n);
      el.style.setProperty('--r0', Math.floor(a / n));
      el.style.setProperty('--c0', a % n);
      el.style.setProperty('--len', Math.hypot(dr, dc).toFixed(4));
      el.style.setProperty('--ang', ((Math.atan2(dr, dc) * 180) / Math.PI).toFixed(1) + 'deg');
    }

    function makeBand(list, cls) {
      const el = h('div', { class: 'ws-band ' + cls });
      setBand(el, list);
      bandsEl.appendChild(el);
      return el;
    }

    // ----- 끌어서 고르기 (포인터 이벤트, 8방향 직선으로 맞춰 준다)
    function pointCell(e) {
      const rect = gridEl.getBoundingClientRect();
      const n = pz.size;
      const c = clamp(Math.floor((e.clientX - rect.left + geo.g / 2) / geo.p), 0, n - 1);
      const r = clamp(Math.floor((e.clientY - rect.top + geo.g / 2) / geo.p), 0, n - 1);
      return { r, c };
    }

    function cancelDrag() {
      if (drag) drag.band.remove();
      drag = null;
    }

    board.addEventListener('pointerdown', (e) => {
      if (!game.playing || !pz) return;
      e.preventDefault();
      const { r, c } = pointCell(e);
      const i = r * pz.size + c;
      if (phase === 'code') return codeTap(i);
      if (phase !== 'search' || drag) return;
      try {
        board.setPointerCapture(e.pointerId);
      } catch (err) {
        /* 손가락이 판 밖으로 나가도 pointerup 은 온다 */
      }
      drag = { id: e.pointerId, r0: r, c0: c, path: [i], band: makeBand([i], 'sel') };
      sfx('tap');
    });

    board.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (phase !== 'search' || !game.playing) return cancelDrag();
      const rect = gridEl.getBoundingClientRect();
      const dx = (e.clientX - (rect.left + drag.c0 * geo.p + geo.s / 2)) / geo.p;
      const dy = (e.clientY - (rect.top + drag.r0 * geo.p + geo.s / 2)) / geo.p;
      const path = P.linePath(pz.size, drag.r0, drag.c0, dx, dy);
      if (path.join() === drag.path.join()) return;
      drag.path = path;
      setBand(drag.band, path);
      Arcade.audio.tone({ freq: 460 + path.length * 70, type: 'triangle', dur: 0.04, vol: 0.07 });
    });

    board.addEventListener('pointerup', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      drag = null;
      if (phase !== 'search' || !game.playing) return d.band.remove();
      submit(d.path, d.band);
    });

    board.addEventListener('pointercancel', (e) => {
      if (drag && e.pointerId === drag.id) cancelDrag();
    });

    // ----- 판정
    function submit(path, band) {
      if (phase !== 'search') return;
      band = band || makeBand(path, 'sel');
      if (path.length < 2) return band.remove();
      const text = path.map((i) => pz.letters[i]).join('');
      const res = P.judge(pz, text);
      if (res.word !== undefined) {
        if (found.has(res.word)) return miss(band, '이미 찾은 단어예요', false);
        return hit(res.word, band);
      }
      if (res.decoy !== undefined) return miss(band, '🕵️ 가짜 단어! 한 글자가 달라요', true);
      if (path.length <= 2) return miss(band, '', false); // 짧은 헛손질은 봐준다
      if (themeWords.includes(text) || themeWords.includes(P.reverse(text))) return miss(band, '목록에 없는 단어예요', false);
      return miss(band, '단어가 아니에요', true);
    }

    function hit(idx, band) {
      const w = pz.words[idx];
      const color = COLORS[idx % COLORS.length];
      found.add(idx);
      band.classList.remove('sel');
      band.classList.add('done');
      band.style.setProperty('--c', color);
      setBand(band, w.cells);
      w.cells.forEach((i) => cells[i].classList.add('used'));
      chips[idx].classList.add('found');
      fx.pop(chips[idx]);
      // 앞 단어를 찾고 몇 초 안에 또 찾으면 콤보. 콤보는 점수 배수와 보너스 시간
      if (game.time - lastFindAt > S.comboWindow) game.resetCombo();
      lastFindAt = game.time;
      const combo = game.addCombo();
      const mult = comboMult(combo);
      fx.pop(comboEl);
      const mid = cells[w.cells[w.cells.length >> 1]];
      game.addScore(Math.round((50 + 50 * P.chars(w.text).length) * mult), mid);
      if (combo >= 2) timer.add(combo >= 4 ? 2 : 1);
      Arcade.vibrate(30);
      fx.burst(mid, { count: 10, spread: 70, colors: [color, '#ffffff', '#ffd166'] });
      if (found.size === pz.words.length) reveal();
    }

    function miss(band, msg, penalize) {
      band.classList.add('miss');
      game.after(450, () => band.remove());
      if (!penalize) {
        sfx('miss');
        if (msg) fx.toast(msg, { ms: 900 });
        return;
      }
      wrong++;
      game.resetCombo();
      if (S.wrongPenalty > 0) timer.add(-S.wrongPenalty);
      sfx('bad');
      Arcade.vibrate(70);
      fx.shake(board, 6);
      fx.toast(S.wrongPenalty > 0 ? `${msg} <b>-${S.wrongPenalty}초</b>` : msg, { kind: 'bad', ms: 1100 });
    }

    // ----- 돋보기: 못 찾은 단어 하나의 첫 글자 칸을 잠깐 비춘다
    function useHint() {
      if (phase !== 'search' || hintsLeft <= 0) return;
      const left = pz.words.map((w, i) => i).filter((i) => !found.has(i));
      if (!left.length) return;
      hintsLeft--;
      hintsUsed++;
      const el = cells[pz.words[pick(left)].cells[0]];
      el.classList.add('hint');
      game.after(HINT_MS, () => el.classList.remove('hint'));
      sfx('power');
      fx.toast('🔍 이 글자에서 시작해요', { ms: 1200 });
      paintButtons();
    }

    // ----- 암호 먼저 맞히기: 답의 글자를 격자에서 한 칸씩 누른다. 사건마다 한 번
    function enterCode() {
      if (phase !== 'search' || earlyTried) return;
      cancelDrag();
      phase = 'code';
      entryKind = 'cell';
      entry = [];
      board.classList.add('code');
      game.setGoal('🔐 답의 글자를 <b>차례로</b> 눌러요 · 기회 <b>1번</b>');
      setFooter('code');
      paintSlots();
      sfx('lock');
    }

    function clearPicks() {
      entry.forEach((i) => {
        cells[i].classList.remove('pick');
        delete cells[i].dataset.n;
      });
      entry = [];
    }

    function leaveCode() {
      if (phase !== 'code' && phase !== 'judging') return;
      clearPicks();
      board.classList.remove('code');
      phase = 'search';
      game.setGoal(earlySolved ? '🔓 암호 해독! 남은 단어를 모두 찾아라' : stage.goal);
      setFooter('search');
      paintSlots();
    }

    function codeTap(i) {
      if (phase !== 'code') return;
      const at = entry.indexOf(i);
      if (at >= 0) {
        if (at === entry.length - 1) eraseOne(); // 마지막에 고른 칸을 다시 누르면 지운다
        return;
      }
      entry.push(i);
      cells[i].classList.add('pick');
      cells[i].dataset.n = entry.length;
      sfx('pick');
      paintSlots();
      if (entry.length === pz.code.length) {
        phase = 'judging';
        game.after(300, judgeEarly);
      }
    }

    function eraseOne() {
      if (phase === 'code' && entry.length) {
        const i = entry.pop();
        cells[i].classList.remove('pick');
        delete cells[i].dataset.n;
      } else if (phase === 'final' && entry.length) {
        tileEls[entry.pop()].classList.remove('used');
      } else return;
      sfx('tap');
      paintSlots();
    }

    function slotTap(k) {
      if ((phase !== 'code' && phase !== 'final') || k >= entry.length) return;
      // 누른 칸부터 뒤를 모두 비운다
      while (entry.length > k) eraseOne();
    }

    function shakeSlots() {
      slotsEl.classList.remove('bad');
      void slotsEl.offsetWidth;
      slotsEl.classList.add('bad');
      fx.shake(caseEl, 8);
    }

    function judgeEarly() {
      const right = entry.map((i) => pz.letters[i]).join('') === pz.code.join('');
      earlyTried = true;
      if (right) earlySolved = true;
      leaveCode();
      if (right) {
        earlyCount++;
        const bonus = EARLY_BONUS + EARLY_PER_WORD * (pz.words.length - found.size);
        slotsEl.classList.add('solved');
        pz.codeCells.forEach((i) => cells[i].classList.add('cracked'));
        timer.add(EARLY_SEC);
        game.addScore(bonus, slotsEl);
        sfx('unlock');
        game.after(220, () => sfx('bonus'));
        Arcade.vibrate([40, 40, 80]);
        fx.burst(slotsEl, { count: 18, spread: 110, colors: ['#ffd166', '#b6f36a', '#ffffff'] });
        fx.toast('🕵️ 명탐정! 암호를 먼저 풀었다', { kind: 'gold', ms: 1600 });
      } else {
        wrong++;
        game.resetCombo();
        const pen = S.wrongPenalty * 2;
        if (pen > 0) timer.add(-pen);
        shakeSlots();
        sfx('bad');
        Arcade.vibrate([60, 40, 60]);
        fx.toast(pen > 0 ? `암호가 아니에요! <b>-${pen}초</b>` : '암호가 아니에요!', { kind: 'bad', ms: 1300 });
      }
      paintButtons();
    }

    // ----- 다 찾으면: 찾은 칸이 어두워지고, 남은 암호 칸이 차례로 빛나며 아래로 날아간다
    async function reveal() {
      phase = 'reveal';
      timer.pause();
      paintButtons();
      await game.wait(450);
      board.classList.add('reveal');
      game.setGoal('🔎 남은 글자에 <b>비밀</b>이 숨어 있다…');
      sfx('whoosh');
      await game.wait(650);
      for (let k = 0; k < pz.codeCells.length; k++) {
        const el = cells[pz.codeCells[k]];
        el.classList.add('glow');
        Arcade.audio.tone({ freq: 660 * Math.pow(2, (k * 3) / 12), type: 'triangle', dur: 0.24, vol: 0.2 });
        fx.burst(el, { count: 6, spread: 40, colors: ['#ffd166', '#fff3c4'] });
        await game.wait(380);
      }
      board.classList.add('only-code');
      await game.wait(400);
      if (earlySolved) {
        fx.toast('🔓 먼저 푼 암호가 맞았다!', { kind: 'gold', ms: 1200 });
        return stageClear();
      }
      tiles = P.makeTiles(pz.code, stage.tiles);
      tileEls = tiles.map((t, ti) => {
        const el = h('button', { class: 'ws-tile wait', text: t.ch });
        el.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          tileTap(ti);
        });
        return el;
      });
      trayEl.innerHTML = '';
      tileEls.forEach((el) => trayEl.appendChild(el));
      phase = 'reveal';
      setFooter('final');
      await flyLetters();
      phase = 'final';
      entryKind = 'tile';
      entry = [];
      paintSlots();
      game.setGoal('빛나는 글자를 <b>읽는 순서대로</b> 눌러 암호 완성!');
      timer.resume();
    }

    function flyLetters() {
      const jobs = tiles.map((t, ti) => {
        const tile = tileEls[ti];
        if (t.k < 0) return null;
        const from = cells[pz.codeCells[t.k]].getBoundingClientRect();
        const to = tile.getBoundingClientRect();
        const el = h('div', { class: 'ws-fly', text: t.ch });
        const place = (k) => {
          const x = from.left + (to.left - from.left) * k;
          const y = from.top + (to.top - from.top) * k - Math.sin(Math.PI * k) * 40;
          el.style.width = from.width + (to.width - from.width) * k + 'px';
          el.style.height = from.height + (to.height - from.height) * k + 'px';
          el.style.fontSize = (from.height + (to.height - from.height) * k) * 0.52 + 'px';
          el.style.transform = `translate(${x}px, ${y}px)`;
        };
        place(0);
        el.style.visibility = 'hidden';
        flyLayer.appendChild(el);
        return game
          .wait(t.k * 140)
          .then(() => {
            el.style.visibility = '';
            Arcade.audio.tone({ freq: 520 + t.k * 90, to: 900 + t.k * 90, type: 'triangle', dur: 0.2, vol: 0.12 });
            return game.tween(560, place);
          })
          .then(() => {
            el.remove();
            tile.classList.remove('wait');
            fx.pop(tile);
          });
      });
      return Promise.all(jobs.filter(Boolean)).then(() => {
        tileEls.forEach((el) => el.classList.remove('wait')); // 섞어 둔 글자도 나타난다
        sfx('pop');
      });
    }

    // ----- 마지막 단계: 타일을 읽는 순서대로 눌러 암호를 완성한다
    function tileTap(ti) {
      if (phase !== 'final' || entry.includes(ti) || entry.length >= pz.code.length) return;
      entry.push(ti);
      tileEls[ti].classList.add('used');
      sfx('pick');
      paintSlots();
      if (entry.length === pz.code.length) {
        phase = 'judging';
        game.after(300, judgeFinal);
      }
    }

    function judgeFinal() {
      if (entry.map((ti) => tiles[ti].ch).join('') === pz.code.join('')) {
        finalSolved = true;
        phase = 'clear';
        slotsEl.classList.add('solved');
        paintSlots();
        game.addScore(FINAL_BONUS, slotsEl);
        sfx('unlock');
        fx.burst(slotsEl, { count: 16, spread: 100, colors: ['#ffd166', '#b6f36a', '#ffffff'] });
        stageClear();
        return;
      }
      wrong++;
      game.resetCombo();
      if (S.wrongPenalty > 0) timer.add(-S.wrongPenalty);
      shakeSlots();
      sfx('bad');
      Arcade.vibrate([60, 40, 60]);
      fx.toast(`암호가 아니에요! 빛나는 글자를 다시 읽어 봐${S.wrongPenalty > 0 ? ` <b>-${S.wrongPenalty}초</b>` : ''}`, { kind: 'bad', ms: 1400 });
      entry.forEach((ti) => tileEls[ti].classList.remove('used'));
      entry = [];
      phase = 'final';
      paintSlots();
    }

    // ----- 스테이지(사건) 진행
    function timeUp() {
      cancelDrag();
      game.lose({
        icon: '⏰',
        title: '시간 초과!',
        message: `사건 ${stageIdx + 1}에서 시간이 다 됐어요.<br>다시 도전하면 <b>새 격자</b>에 시간을 더 줘요.`,
        checkpoint: stageIdx,
      });
    }

    async function runStage() {
      stage = STAGES[stageIdx];
      phase = 'intro';
      found = new Set();
      entry = [];
      tiles = [];
      tileEls = [];
      drag = null;
      earlyTried = false;
      earlySolved = false;
      finalSolved = false;
      cs = P.makeCase({ stage, avoid: usedThemes, custom: stageIdx === STAGES.length - 1 ? CUSTOM : null });
      usedThemes.push(cs.theme.id);
      pz = P.makePuzzle({ size: stage.size, plan: stage.plan, decoys: stage.decoys, words: cs.words, code: cs.code, forbid: cs.forbid });
      themeWords = P.themeWords(cs.theme.id);
      render();
      setFooter('search');
      game.setStage(stageIdx, STAGES.length);
      game.setGoal(stage.goal);
      game.resetCombo();
      stageSec = Math.round(S.stageTime * stage.time * (1 + ease * 0.15));
      timer = game.startTimer(stageSec, { onEnd: timeUp, intensity: 0.1 + stageIdx * 0.2 });
      timer.pause(); // 안내 띠가 떠 있는 동안에는 시간이 가지 않고, 격자도 가려 둔다
      if (ease > 0 && stageIdx === game.checkpoint) fx.toast('⏱️ 새 격자에 시간을 더 줄게요', { kind: 'good', ms: 1600 });
      const who = cs.custom ? '🔐 특별 사건' : `${cs.theme.icon} ${cs.theme.name}`;
      await game.banner(`사건 ${stageIdx + 1}`, `${who} · ${stage.sub}`, { ms: 1500 });
      board.classList.remove('veil');
      sfx('flip');
      phase = 'search';
      paintButtons();
      lastFindAt = game.time;
      timer.resume();
    }

    async function stageClear() {
      phase = 'clear';
      paintButtons();
      timer.pause();
      const left = timer.left();
      ratios.push(clamp(left / stageSec, 0, 1));
      codes.push(pz.code.join(''));
      const bonus = 200 + Math.round(left) * 10;
      await game.wait(600);
      game.addScore(bonus);
      fx.confetti(40);
      await game.banner('사건 해결!', `암호 <b>${pz.code.join('')}</b> · 남은 시간 보너스 +${bonus}`, { ms: 1500, kind: 'good' });
      if (stageIdx >= STAGES.length - 1) return finish();
      stageIdx++;
      runStage();
    }

    function finish() {
      const avg = ratios.reduce((a, b) => a + b, 0) / Math.max(1, ratios.length);
      let stars = wrong <= STAR3_WRONG && avg >= STAR3_TIME ? 3 : wrong <= STAR2_WRONG && avg >= STAR2_TIME ? 2 : 1;
      if (hintsUsed > 0 || game.retry > 0) stars = Math.min(stars, 2);
      // 별 3개를 놓친 이유를 하나만 짧게 알려 준다
      let tip = '실수 없이 빠르게, 완벽한 수사였어요!';
      if (stars < 3) {
        if (game.retry > 0) tip = '다음엔 한 번에 풀어서 별 3개를 노려 봐요!';
        else if (hintsUsed > 0) tip = '돋보기 없이 풀면 별 3개!';
        else if (wrong > STAR3_WRONG) tip = `틀린 선택을 ${STAR3_WRONG}번 이하로 줄이면 별 3개!`;
        else tip = '조금 더 빨리 풀면 별 3개!';
      }
      const head = CUSTOM ? `🔐 마지막 암호는 <b>${CUSTOM.text}</b>!<br>` : '';
      game.win({
        stars,
        title: '사건 해결!',
        message: head + tip,
        stats: [
          ['풀어 낸 암호', codes.join(' · ')],
          ['틀린 선택', `${wrong}번`],
          ['먼저 맞힌 암호', `${earlyCount}개`],
          ['돋보기', hintsUsed ? `${hintsUsed}번 씀` : '안 씀'],
        ],
      });
    }

    function comboMult(combo) {
      return combo >= 4 ? 2 : combo >= 2 ? 1.5 : 1;
    }

    // 콤보 표시: 콤보 인정 시간이 지나면 콤보가 끊긴다
    game.loop(() => {
      const live = (phase === 'search' || phase === 'code' || phase === 'judging') && game.combo >= 1;
      const k = live ? 1 - (game.time - lastFindAt) / S.comboWindow : 0;
      if (live && k <= 0) game.resetCombo();
      const show = live && k > 0 && game.combo >= 1 && found.size < pz.words.length;
      comboEl.classList.toggle('on', show);
      if (!show) return;
      const c = game.combo;
      comboText.textContent = c >= 2 ? `🔥 ${c}콤보 ×${comboMult(c)}` : '🔥 콤보 준비';
      comboEl.classList.toggle('hot', c >= 4);
      comboFill.style.transform = `scaleX(${clamp(k, 0, 1)})`;
    });

    // 판 크기가 바뀌면(화면 회전, 버튼 줄 변화) 칸 크기를 다시 맞춘다
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(layout);
      [wrap, wordsEl, caseEl].forEach((el) => ro.observe(el));
      game.onCleanup(() => ro.disconnect());
    } else {
      game.on(window, 'resize', layout);
    }

    if (game.debug) {
      // 검증용 창구: 상태를 보고, 실제 입력과 같은 길로 단어·암호를 대신 고른다
      const center = (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
      };
      const unfound = () => pz.words.map((w, i) => i).filter((i) => !found.has(i));
      window.__game = {
        settings: S,
        custom: CUSTOM,
        ready: () => game.playing && phase === 'search',
        state: () => ({
          stage: stageIdx, phase, found: found.size, total: pz ? pz.words.length : 0, wrong, hintsLeft, hintsUsed,
          earlyTried, earlySolved, earlyCount, entry: entry.slice(), code: pz ? pz.code.join('') : '',
          custom: cs ? cs.custom : false, riddle: cs ? cs.riddle : '', theme: cs ? cs.theme.id : '', size: pz ? pz.size : 0,
          stageSec, left: timer ? timer.left() : 0, ratios: ratios.slice(), codes: codes.slice(), cell: geo.s,
        }),
        puzzle: () =>
          pz && {
            size: pz.size, letters: pz.letters.slice(), code: pz.code.slice(), codeCells: pz.codeCells.slice(),
            words: pz.words.map((w, i) => ({ text: w.text, kind: w.kind, cells: w.cells.slice(), found: found.has(i) })),
            decoys: pz.decoys.map((d) => ({ text: d.text, cells: d.cells.slice() })),
          },
        cell: (i) => center(cells[i]),
        tiles: () => tiles.map((t, i) => Object.assign({ ch: t.ch, k: t.k, used: entry.includes(i) }, center(tileEls[i]))),
        select: (list) => submit(list.slice()),
        /** 못 찾은 단어 하나를 찾는다(back 이면 끝에서부터 끈다) */
        findOne(back) {
          const left = unfound();
          if (!left.length || phase !== 'search') return false;
          const list = pz.words[left[0]].cells.slice();
          submit(back ? list.reverse() : list);
          return true;
        },
        /** 단어도 가짜도 아닌 세 칸짜리 직선을 고른다 */
        wrongOne() {
          const n = pz.size;
          for (let r = 0; r < n; r++) {
            for (let c = 0; c + 2 < n; c++) {
              const list = [0, 1, 2].map((k) => r * n + c + k);
              const text = list.map((i) => pz.letters[i]).join('');
              const res = P.judge(pz, text);
              if (res.word === undefined && res.decoy === undefined && !themeWords.includes(text) && !themeWords.includes(P.reverse(text))) {
                submit(list);
                return true;
              }
            }
          }
          return false;
        },
        decoyOne() {
          if (!pz.decoys.length || phase !== 'search') return false;
          submit(pz.decoys[0].cells.slice());
          return true;
        },
        hint: useHint,
        enterCode,
        codeTap,
        tileTap,
        /** 암호 먼저 맞히기: right 면 암호 칸을, 아니면 엉뚱한 칸을 차례로 누른다 */
        early(right) {
          enterCode();
          if (phase !== 'code') return false;
          const other = pz.letters.findIndex((ch, i) => !pz.codeCells.includes(i) && ch !== pz.code[0]);
          const list = right ? pz.codeCells.slice() : [other].concat(pz.codeCells.slice(1));
          list.forEach(codeTap);
          return true;
        },
        /** 마지막 단계: 타일을 맞는 순서(또는 틀린 순서)로 누른다 */
        solveFinal(right) {
          if (phase !== 'final') return false;
          const order = pz.code.map((_, k) => tiles.findIndex((t) => t.k === k));
          if (!right) {
            const fake = tiles.findIndex((t) => t.k < 0);
            if (fake >= 0) order[0] = fake;
            else order.reverse();
          }
          order.forEach(tileTap);
          return true;
        },
        drain: (sec) => timer && timer.add(-sec),
      };
    }

    runStage();
  }

  if (Arcade.debug) window.__game = { settings: S, custom: CUSTOM };

  Arcade.createGame({
    id: GAME_ID,
    title: '단어 탐정',
    icon: '🕵️',
    accent: '#2fd17a',
    accent2: '#b6f36a',
    tagline: '단어를 다 찾으면, 남은 글자가 암호가 된다!',
    howTo: [
      '<b>끌어서</b> 숨은 단어를 찾아요. 헛손질과 가짜 단어는 <b>시간이 깎여요</b>',
      '다 찾으면 <b>남은 글자</b>가 빛나며 수수께끼의 답, 암호가 돼요',
      '답을 알 것 같으면 <b>🔐 암호 먼저</b>! 맞히면 큰 보너스',
    ],
    stages: STAGES.length,
    start,
  });
})();
