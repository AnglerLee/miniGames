// 짝 맞추기: 움직이는 기억력
// 잠깐 보여 주는 카드를 외워 짝을 찾는다. 틀리면 카드가 눈앞에서 자리를 바꾸고,
// 마지막 스테이지에는 뒤집는 순간 도화선이 타는 폭탄 쌍이 숨어 있다.
(function () {
  'use strict';

  const { h, pick, shuffle, clamp, sfx, fx } = Arcade;
  const GAME_ID = 'game03';

  // ----- 설정 (관리자 페이지와 같은 키를 쓴다)
  // 시간 값은 1스테이지 기준이고, 뒤 스테이지는 STAGES 의 배수만큼 늘어난다.
  const PRESETS = [
    { previewTime: 4, stageTime: 50, missPenalty: 1, bombTime: 9, lives: 3 },
    { previewTime: 3, stageTime: 40, missPenalty: 2, bombTime: 7, lives: 3 },
    { previewTime: 2, stageTime: 32, missPenalty: 3, bombTime: 5, lives: 2 },
  ];
  const LIMITS = { previewTime: [0.5, 15], stageTime: [10, 300], missPenalty: [0, 15], bombTime: [2, 30], lives: [1, 5] };
  const num = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));
  const saved = Arcade.loadSettings('card_match_settings', {});
  const level = clamp(parseInt(saved.difficulty, 10) || 0, 0, 2);
  const S = Object.assign({}, PRESETS[level]);
  // 옛 형식({ pairCount, timeLimit })만 저장돼 있으면, 쌍마다 주던 시간을 살려 1스테이지(6쌍) 제한 시간으로 옮긴다
  if (saved.stageTime === undefined && num(saved.timeLimit) > 0) {
    const pairs = clamp(num(saved.pairCount) || 8, 6, 30);
    S.stageTime = Math.round(clamp((num(saved.timeLimit) / pairs) * 6, 25, 120));
  }
  Object.keys(LIMITS).forEach((key) => {
    const v = num(saved[key]);
    if (Number.isFinite(v)) S[key] = v;
    S[key] = clamp(S[key], LIMITS[key][0], LIMITS[key][1]);
  });
  S.lives = Math.round(S.lives);

  const FRUITS = ['🍎', '🍌', '🍇', '🍊', '🍓', '🍉', '🍒', '🍑', '🥝', '🍍'];
  const ANIMALS = ['🐶', '🐱', '🐰', '🦊', '🐼', '🐸', '🐵', '🐷', '🐯', '🐧', '🐙', '🦁'];
  const RIDES = ['🚗', '🚌', '🚑', '🚒', '🚜', '🚲', '🚀', '✈️', '🚁', '⛵', '🚂', '🛵'];
  const BOMB = '💣';

  // time, preview 는 설정값에 곱하는 배수
  const STAGES = [
    {
      cols: 3, rows: 4, theme: FRUITS, time: 1, preview: 1,
      goal: '같은 그림 <b>두 장</b>을 찾아라!',
      banner: ['스테이지 1', '보여 줄 때 잘 외워 둬!'],
    },
    {
      cols: 4, rows: 4, theme: ANIMALS, time: 1.3, preview: 1.25, swap: true,
      goal: '틀리면 카드 두 장이 <b>자리를 바꾼다!</b>',
      banner: ['스테이지 2', '틀리면 카드가 자리를 바꾼다!'],
    },
    {
      cols: 4, rows: 5, theme: RIDES, time: 1.7, preview: 1.5, swap: true, bomb: true,
      goal: '<b>💣 폭탄</b>을 건드리면 도화선이 탄다!',
      banner: ['마지막 스테이지', '💣 폭탄을 뒤집으면 불이 붙는다!'],
    },
  ];

  const PEEKS = 1; // 훔쳐보기 횟수
  const PEEK_MS = 1000;
  const SWAP_MS = 460;
  const STAR3_MISSES = 6; // 이만큼까지 틀려도 별 3개
  const STAR2_MISSES = 14;

  function start(game) {
    const ease = Math.min(game.retry, 3); // 재도전할수록 조금씩 풀어 준다
    let stageIdx = game.checkpoint;
    let stage = STAGES[stageIdx];
    let phase = 'intro'; // intro | preview | play | clear
    let cards = [];
    let first = null; // 먼저 뒤집어 둔 카드
    let busy = false; // 판정·자리 바꾸기·훔쳐보기 중에는 카드를 받지 않는다
    let pairsLeft = 0;
    let misses = 0;
    let swaps = 0;
    let explosions = 0;
    let peeksLeft = PEEKS;
    let lastMatchAt = 0;
    let bomb = null; // { cards, armed, hold, lit, left, total }
    let timer = null;
    let pitch = { x: 0, y: 0 }; // 카드 한 칸의 간격(px)

    // ----- 화면
    const pairsEl = h('div', { class: 'ar-chip' });
    const missEl = h('div', { class: 'ar-chip' });
    const watchFill = h('i');
    const watch = h('div', { class: 'cm-watch' }, watchFill);
    const grid = h('div', { class: 'cm-grid' });
    const board = h('div', { class: 'cm-board' }, grid);
    const peekBtn = h('button', { class: 'ar-btn ghost cm-peek', onclick: peek });
    game.root.classList.remove('cm-paused');
    game.root.append(h('div', { class: 'cm-wrap' }, [h('div', { class: 'cm-status' }, [pairsEl, missEl]), watch, board]));
    game.footer.append(peekBtn);

    function paintStatus() {
      const total = (stage.cols * stage.rows) / 2;
      pairsEl.innerHTML = `짝 <b>${total - pairsLeft}</b> / ${total}`;
      missEl.innerHTML = `실수 <b>${misses}</b>`;
      peekBtn.disabled = peeksLeft <= 0;
      peekBtn.innerHTML = peeksLeft > 0 ? '👀 훔쳐보기 <small>쓰면 별 2개까지</small>' : '👀 훔쳐보기 끝';
    }

    /** 게임 시계로 도는 짧은 움직임. 일시 정지하면 함께 멈춘다 */
    function tween(ms, step) {
      return new Promise((resolve) => {
        let t = 0;
        step(0);
        const stop = game.loop((dt) => {
          t = Math.min(1, t + (dt * 1000) / ms);
          step(t);
          if (t >= 1) {
            stop();
            resolve();
          }
        });
      });
    }

    /** 위쪽 가는 막대가 줄어드는 동안 기다린다 (미리 보기, 훔쳐보기) */
    async function watchFor(ms) {
      let lastSec = -1;
      watch.classList.add('on');
      await tween(ms, (t) => {
        watchFill.style.transform = `scaleX(${1 - t})`;
        const sec = Math.ceil(((1 - t) * ms) / 1000);
        if (sec !== lastSec && sec >= 1 && sec <= 3 && t > 0) sfx('tick');
        lastSec = sec;
      });
      watch.classList.remove('on');
    }

    // ----- 카드
    /** 판 크기에 맞춰 카드 크기를 정한다. 360×640 에서도 4×5 가 한 화면에 들어온다 */
    function layout() {
      const W = board.clientWidth;
      const H = board.clientHeight;
      if (!W || !H) return;
      const gap = W < 350 ? 6 : 8;
      let w = Math.min(104, Math.floor((W - gap * (stage.cols - 1)) / stage.cols));
      const tall = Math.min(Math.round(w * 1.3), Math.floor((H - gap * (stage.rows - 1)) / stage.rows));
      w = Math.min(w, tall); // 옆으로 누운 카드는 만들지 않는다
      grid.style.gridTemplateColumns = `repeat(${stage.cols}, ${w}px)`;
      grid.style.gridTemplateRows = `repeat(${stage.rows}, ${tall}px)`;
      grid.style.gap = gap + 'px';
      grid.style.fontSize = Math.round(w * 0.54) + 'px';
      pitch = { x: w + gap, y: tall + gap };
    }

    const colOf = (slot) => slot % stage.cols;
    const rowOf = (slot) => Math.floor(slot / stage.cols);

    function place(card) {
      card.el.style.gridColumn = String(colOf(card.slot) + 1);
      card.el.style.gridRow = String(rowOf(card.slot) + 1);
    }

    function flip(card, up) {
      card.up = up;
      card.el.classList.toggle('up', up);
    }

    function deal() {
      const pairs = (stage.cols * stage.rows) / 2;
      const icons = shuffle(stage.theme).slice(0, pairs - (stage.bomb ? 1 : 0));
      if (stage.bomb) icons.push(BOMB);
      grid.innerHTML = '';
      cards = shuffle(icons.concat(icons)).map((icon, slot) => {
        const isBomb = icon === BOMB;
        const fuse = isBomb ? h('b') : null;
        const inner = h('div', { class: 'cm-inner' }, [
          h('div', { class: 'cm-face cm-back' }),
          h('div', { class: 'cm-face cm-front', text: icon }),
        ]);
        const el = h('div', { class: 'cm-card' + (isBomb ? ' bomb' : ''), role: 'button' }, [
          inner,
          isBomb ? h('i', { class: 'cm-fuse' }, fuse) : null,
          isBomb ? h('span', { class: 'cm-fire', text: '🔥' }) : null,
        ]);
        el.style.setProperty('--deal', slot * 22 + 'ms'); // 카드가 차례로 깔린다
        const card = { id: slot, icon, bomb: isBomb, slot, up: false, matched: false, el, inner, fuse };
        el.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          choose(card);
        });
        place(card);
        grid.appendChild(el);
        return card;
      });
      pairsLeft = pairs;
      bomb = stage.bomb
        ? { cards: cards.filter((c) => c.bomb), armed: false, hold: false, lit: null, left: 0, total: S.bombTime + ease, shown: '', beat: 0 }
        : null;
      layout();
    }

    /** 두 카드가 눈에 보이게 자리를 바꾼다 */
    function swap(a, b) {
      const dx = (colOf(a.slot) - colOf(b.slot)) * pitch.x;
      const dy = (rowOf(a.slot) - rowOf(b.slot)) * pitch.y;
      [a.slot, b.slot] = [b.slot, a.slot];
      place(a);
      place(b);
      swaps++;
      // 자리는 이미 바뀌었고, 옛 자리에서 새 자리로 미끄러져 온다. 한 장은 위로 떠서, 한 장은 아래로 지나간다
      const len = Math.hypot(dx, dy) || 1;
      const bow = Math.min(10, len * 0.1);
      const nx = (-dy / len) * bow;
      const ny = (dx / len) * bow;
      a.el.classList.add('moving', 'over');
      b.el.classList.add('moving');
      sfx('whoosh');
      return tween(SWAP_MS, (t) => {
        const e = t * t * (3 - 2 * t);
        const k = 1 - e;
        const arc = Math.sin(Math.PI * e);
        a.el.style.transform = `translate(${dx * k + nx * arc}px, ${dy * k + ny * arc}px) scale(${1 + arc * 0.12})`;
        b.el.style.transform = `translate(${-dx * k - nx * arc}px, ${-dy * k - ny * arc}px) scale(${1 - arc * 0.06})`;
      }).then(() => {
        [a, b].forEach((c) => {
          c.el.style.transform = '';
          c.el.classList.remove('moving', 'over');
        });
      });
    }

    /** 틀린 대가: 아직 안 맞춘 카드 두 장이 자리를 바꾼다 */
    function swapRandom() {
      const pool = shuffle(cards.filter((c) => !c.matched && !c.up));
      if (pool.length < 3) return Promise.resolve(); // 두 장만 남았으면 바꿔도 달라지지 않는다
      const a = pool[0];
      return swap(a, pool.find((c) => c !== a && c.icon !== a.icon) || pool[1]);
    }

    // ----- 폭탄
    function light(card) {
      bomb.armed = true;
      bomb.hold = true; // 짝 폭탄이 달아나는 동안에는 도화선이 타지 않는다
      bomb.lit = card;
      bomb.left = bomb.total;
      card.el.classList.add('lit');
      paintFuse();
      sfx('zap');
      Arcade.vibrate(80);
      fx.floatText(card.el, '불 붙었다!', { color: '#ff5d73', size: 22 });
    }

    /** 불이 붙으면 짝 폭탄이 다른 카드와 자리를 바꿔 달아난다. 눈으로 쫓아가야 한다 */
    async function runAway() {
      const mate = bomb.cards.find((c) => c !== bomb.lit);
      const others = cards.filter((c) => !c.matched && !c.up && !c.bomb);
      if (others.length) await swap(mate, pick(others));
      bomb.hold = false;
    }

    function paintFuse() {
      bomb.lit.fuse.style.transform = `scaleX(${clamp(bomb.left / bomb.total, 0, 1)})`;
      const shown = Math.max(0, bomb.left).toFixed(1);
      if (shown === bomb.shown) return;
      bomb.shown = shown;
      game.setGoal(`💣 <b>${shown}초</b> 안에 달아난 짝을 찾아라!`);
      // 1초마다, 막바지 3초는 0.5초마다 째깍
      const beat = bomb.left > 3 ? Math.ceil(bomb.left) : Math.ceil(bomb.left * 2) / 2;
      if (beat !== bomb.beat) {
        if (bomb.beat) sfx('tick');
        bomb.beat = beat;
      }
    }

    function snuff() {
      if (bomb.lit) bomb.lit.el.classList.remove('lit');
      bomb.armed = false;
      bomb.hold = false;
      bomb.lit = null;
      bomb.shown = '';
      bomb.beat = 0;
      game.setGoal(stage.goal);
    }

    function explode() {
      const at = bomb.lit.el;
      explosions++;
      snuff();
      sfx('boom');
      Arcade.vibrate([120, 60, 220]);
      fx.burst(at, { count: 14, spread: 120, emoji: ['💥', '🔥'], size: 13 });
      game.resetCombo();
      if (first) {
        flip(first, false);
        first = null;
      }
      if (game.loseLife(at) <= 0) {
        game.lose({
          icon: '💥',
          title: '펑!',
          message: '폭탄이 터져 하트를 모두 잃었어요.<br>다시 도전하면 도화선이 조금 길어져요.',
          checkpoint: stageIdx,
        });
        return;
      }
      fx.toast('💥 펑! 하트 -1', { kind: 'bad' });
    }

    // ----- 카드 고르기와 판정
    function choose(card) {
      if (!game.playing || phase !== 'play' || busy || card.up || card.matched) return;
      flip(card, true);
      sfx('flip');
      if (!first) {
        first = card;
        if (card.bomb && !bomb.armed) {
          light(card);
          busy = true;
          runAway().then(() => {
            busy = false;
          });
        }
        return;
      }
      const a = first;
      first = null;
      if (a.icon === card.icon) matched(a, card);
      else missed(a, card);
    }

    function matched(a, b) {
      a.matched = b.matched = true;
      pairsLeft--;
      const combo = game.addCombo();
      // 앞선 짝을 맞힌 뒤 빨리 찾을수록 점수가 크다
      const quick = Math.round(50 * clamp(1 - (game.time - lastMatchAt) / 6, 0, 1));
      lastMatchAt = game.time;
      let points = (100 + quick) * Math.min(combo, 4);
      let bonusSec = combo >= 4 ? 2 : combo >= 2 ? 1 : 0;
      if (a.bomb) {
        // 해체 성공: 도화선이 많이 남았을수록 보너스가 크다
        points += 300 + Math.round(300 * clamp(bomb.left / bomb.total, 0, 1));
        bonusSec += 5;
        snuff();
        sfx('perfect');
        fx.flash('rgba(61, 220, 151, 0.3)');
        fx.toast('💣 해체 성공!', { kind: 'good' });
      }
      game.addScore(points, b.el);
      if (bonusSec) timer.add(bonusSec);
      paintStatus();
      game.after(240, () => {
        // 두 번째 카드가 다 뒤집힌 뒤에 반짝이며 사라진다
        [a, b].forEach((c) => {
          c.el.classList.add('gone');
          fx.burst(c.el, { count: 7, spread: 60, size: 8, emoji: a.bomb ? ['💥', '✨'] : ['✨', '⭐'] });
        });
      });
      if (pairsLeft === 0) stageClear();
    }

    async function missed(a, b) {
      busy = true;
      misses++;
      game.resetCombo();
      if (S.missPenalty > 0) timer.add(-S.missPenalty);
      paintStatus();
      // 두 번째로 뒤집은 카드가 폭탄이면 그 자리에서 불이 붙는다
      const lit = b.bomb && !bomb.armed;
      if (lit) light(b);
      await game.wait(300);
      sfx('bad');
      Arcade.vibrate(60);
      a.el.classList.add('miss');
      b.el.classList.add('miss');
      await game.wait(420);
      [a, b].forEach((c) => {
        c.el.classList.remove('miss');
        flip(c, false);
      });
      await game.wait(200);
      if (lit) await runAway();
      else if (stage.swap) await swapRandom();
      busy = false;
    }

    async function peek() {
      if (!game.playing || phase !== 'play' || busy || peeksLeft <= 0) return;
      peeksLeft--;
      busy = true;
      paintStatus();
      sfx('power');
      const shown = cards.filter((c) => !c.matched && !c.up);
      shown.forEach((c) => flip(c, true));
      await watchFor(PEEK_MS + 250);
      shown.forEach((c) => flip(c, false));
      sfx('flip');
      await game.wait(250);
      busy = false;
    }

    // ----- 스테이지 진행
    function timeUp() {
      game.lose({
        icon: '⏰',
        title: '시간 초과!',
        message: `스테이지 ${stageIdx + 1}에서 시간이 다 됐어요.<br>다시 도전하면 시간을 조금 더 줄게요.`,
        checkpoint: stageIdx,
      });
    }

    async function runStage() {
      stage = STAGES[stageIdx];
      phase = 'intro';
      first = null;
      busy = false;
      game.setStage(stageIdx, STAGES.length);
      game.setGoal(stage.goal);
      game.resetCombo();
      if (stage.bomb) game.setLives(S.lives, S.lives); // 하트는 폭탄 스테이지에서만 쓴다
      timer = game.startTimer(Math.round(S.stageTime * stage.time * (1 + ease * 0.15)), {
        intensity: 0.1 + stageIdx * 0.2,
        onEnd: timeUp,
      });
      timer.pause(); // 카드를 외우는 동안에는 시간이 가지 않는다
      deal();
      paintStatus();
      if (ease > 0 && stageIdx === game.checkpoint) fx.toast('⏱️ 시간을 더 줄게요', { kind: 'good', ms: 1600 });
      await game.banner(stage.banner[0], stage.banner[1], { ms: 1400 });

      // 미리 보기: 모든 카드를 잠깐 보여 준 뒤 뒤집는다
      phase = 'preview';
      game.setGoal('👀 <b>지금 외워라!</b> 곧 뒤집힌다');
      sfx('whoosh');
      cards.forEach((c) => {
        c.inner.style.transitionDelay = c.slot * 16 + 'ms';
        flip(c, true);
      });
      await game.wait(400);
      cards.forEach((c) => (c.inner.style.transitionDelay = ''));
      await watchFor((S.previewTime * stage.preview + ease * 0.5) * 1000);
      cards.forEach((c) => flip(c, false));
      sfx('flip');
      game.setGoal(stage.goal);
      await game.wait(350);
      timer.resume();
      lastMatchAt = game.time;
      phase = 'play';
    }

    async function stageClear() {
      phase = 'clear';
      const bonus = 200 + Math.round(timer.left()) * 10;
      timer.pause();
      await game.wait(500);
      fx.confetti(30);
      game.addScore(bonus);
      await game.banner('클리어!', `남은 시간 보너스 <b>+${bonus}</b>`, { ms: 1100, kind: 'good' });
      if (stageIdx >= STAGES.length - 1) return finish();
      stageIdx++;
      await runStage();
    }

    function finish() {
      const peeked = peeksLeft < PEEKS;
      let stars = misses <= STAR3_MISSES ? 3 : misses <= STAR2_MISSES ? 2 : 1;
      if (peeked || explosions > 0 || game.retry > 0) stars = Math.min(stars, 2);
      // 별 3개를 놓친 이유가 하나면 그것만, 여럿이면 조건 전체를 알려 준다
      const why = [];
      if (misses > STAR3_MISSES) why.push(`실수를 ${STAR3_MISSES}번 이하로 줄이면 별 3개!`);
      if (game.retry > 0) why.push('다음엔 한 번에 깨서 별 3개를 노려 봐요!');
      if (explosions > 0) why.push('폭탄만 안 터뜨리면 별 3개!');
      if (peeked) why.push('훔쳐보기 없이 깨면 별 3개!');
      let message = '거의 틀리지 않았어요. 기억력 천재!';
      if (why.length === 1) message = why[0];
      else if (why.length > 1) message = `별 3개: 실수 ${STAR3_MISSES}번 이하, 폭탄·훔쳐보기 없이 한 번에!`;
      const stats = [
        ['틀린 횟수', `${misses}번`],
        ['최대 콤보', `${game.maxCombo}`],
        ['훔쳐보기', peeked ? '썼음' : '안 씀'],
      ];
      if (bomb) stats.push(['폭탄', explosions ? `${explosions}번 터짐` : '해체 성공']);
      game.win({ stars, message, stats });
    }

    // 도화선은 카드를 고를 수 있는 동안 계속 탄다
    game.loop((dt) => {
      if (phase !== 'play' || !bomb || !bomb.armed || bomb.hold) return;
      bomb.left -= dt;
      paintFuse();
      if (bomb.left <= 0 && !busy) explode();
    });

    // 판 크기가 바뀌면(화면 회전, HUD 높이 변화) 카드 크기를 다시 맞춘다
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(layout);
      ro.observe(board);
      game.onCleanup(() => ro.disconnect());
    } else {
      game.on(window, 'resize', layout);
    }

    if (game.debug) {
      // 검증용: 상태를 보고, 맞는 짝이나 틀린 짝을 대신 고른다
      const open = () => cards.filter((c) => !c.matched && c !== first);
      window.__game = {
        settings: S,
        ready: () => game.playing && phase === 'play' && !busy,
        state: () => ({
          stage: stageIdx, phase, busy, misses, swaps, explosions, pairsLeft, peeksLeft,
          first: first ? first.id : null,
          bomb: bomb ? { armed: bomb.armed, left: bomb.left, total: bomb.total, lit: bomb.lit ? bomb.lit.id : null } : null,
        }),
        cards: () =>
          cards.map((c) => {
            const r = c.el.getBoundingClientRect();
            return { id: c.id, icon: c.icon, bomb: c.bomb, slot: c.slot, up: c.up, matched: c.matched, x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
          }),
        choose: (id) => choose(cards[id]),
        /** 맞는 짝을 고른다. 폭탄은 다른 짝이 남아 있는 동안 건드리지 않는다(withBomb 이면 폭탄부터) */
        matchOne(withBomb) {
          let a = first;
          if (!a) {
            const list = open();
            a = list.find((c) => c.bomb === !!withBomb) || list[0];
            choose(a);
          }
          const mate = cards.find((c) => c !== a && c.icon === a.icon);
          choose(mate); // 폭탄에 불이 붙어 잠깐 막혔으면 다음 호출에서 이어 고른다
        },
        /** 틀린 짝을 고른다 (폭탄은 피한다) */
        missOne() {
          let a = first;
          if (!a) {
            a = open().find((c) => !c.bomb);
            choose(a);
          }
          choose(open().find((c) => c.icon !== a.icon && !c.bomb));
        },
        peek,
      };
    }

    runStage();
  }

  if (Arcade.debug) window.__game = { settings: S };

  Arcade.createGame({
    id: GAME_ID,
    title: '짝 맞추기',
    icon: '🃏',
    accent: '#ff7ab6',
    accent2: '#b388ff',
    tagline: '외웠다고 생각한 순간, 카드가 움직인다!',
    howTo: [
      '<b>잠깐 보여 줄 때</b> 카드를 외우고, 같은 그림 두 장을 찾아요',
      '틀리면 <b>시간이 깎이고</b> 카드가 <b>자리를 바꿔요</b>. 눈으로 쫓아가요!',
      '연속으로 맞히면 <b>콤보</b>! 마지막엔 <b>💣&nbsp;폭탄</b>이 숨어 있어요',
    ],
    stages: STAGES.length,
    start,
    // 멈춘 동안 카드를 들여다보며 외우지 못하게 판을 가린다
    onPause: (game) => game.root.classList.add('cm-paused'),
    onResume: (game) => game.root.classList.remove('cm-paused'),
  });
})();
