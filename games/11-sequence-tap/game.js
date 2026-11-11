// 넘버 러시: 규칙이 바뀐다
// 흩어진 숫자를 눈으로 훑어 찾아 누르는 속도 게임. 스테이지마다 "누르는 순서의 규칙"이 바뀐다.
(function () {
  'use strict';

  const { h, rand, pick, shuffle, clamp, sfx, fx } = Arcade;
  const GAME_ID = 'game11';

  // ----- 설정 (관리자 페이지와 같은 키. 기본값 표는 admin.js 와 같아야 한다)
  // totalNumbers 는 1스테이지, count2·count3 은 2·3스테이지의 숫자 수
  const PRESETS = [
    { totalNumbers: 12, count2: 12, count3: 10, timeLimit: 26, penalty: 2, comboWindow: 1.8, hideCount: 0, hintDelay: 2.5 },
    { totalNumbers: 16, count2: 16, count3: 13, timeLimit: 24, penalty: 3, comboWindow: 1.4, hideCount: 2, hintDelay: 0 },
    { totalNumbers: 20, count2: 20, count3: 16, timeLimit: 22, penalty: 3, comboWindow: 1.1, hideCount: 4, hintDelay: 0 },
  ];
  const LIMITS = {
    totalNumbers: [5, 30],
    count2: [5, 30],
    count3: [4, 24],
    timeLimit: [5, 120],
    penalty: [0, 10],
    comboWindow: [0.5, 5],
    hideCount: [0, 8],
    hintDelay: [0, 10],
  };
  const saved = Arcade.loadSettings('sequence_tap_settings', {});
  const level = clamp(parseInt(saved.difficulty, 10) || 0, 0, 2);
  const S = Object.assign({}, PRESETS[level]);
  // 옛 게임이 저장한 totalNumbers, timeLimit 은 같은 뜻으로 이어 쓴다. spawnRadius 는 더 쓰지 않는다
  const has = (key) => Number.isFinite(parseFloat(saved[key]));
  Object.keys(LIMITS).forEach((key) => {
    if (has(key)) S[key] = clamp(parseFloat(saved[key]), LIMITS[key][0], LIMITS[key][1]);
  });
  // 옛 저장값에는 1스테이지 수만 있다. 그때는 예전처럼 거기에 맞춘다 (2스테이지 같은 수, 3스테이지 80%)
  if (has('totalNumbers') && !has('count2')) S.count2 = S.totalNumbers;
  if (has('totalNumbers') && !has('count3')) S.count3 = clamp(Math.round(S.totalNumbers * 0.8), LIMITS.count3[0], LIMITS.count3[1]);
  ['totalNumbers', 'count2', 'count3', 'hideCount'].forEach((key) => (S[key] = Math.round(S[key])));

  const STAGES = 3;
  const STAGE_TIME = [1, 1, 1.1]; // 스테이지별 시간 배율
  const RETRY_BONUS = 4; // 재도전 한 번에 늘어나는 시간(초). 세 번까지 쌓인다
  const FREEZE_MS = 400; // 실수하면 판이 어는 시간
  const SIMUL_MS = 70; // 두 손가락이 거의 동시에 닿았다고 보는 간격
  const HIDE_AFTER = 4; // 3스테이지에서 숫자가 "?"로 바뀌기까지(초)
  const PEEK_SEC = 1.2; // 실수하면 가려진 숫자가 다시 보이는 시간
  const MIN_BTN = 52;
  const MAX_BTN = 72;
  const MIN_CELL = 58; // 버튼 하나가 차지하는 격자 칸의 최소 크기
  const DENSITY = 0.32; // 떠다니는 판에서 숫자가 차지해도 되는 넓이 비율
  const DRIFT = [16, 22, 28][level]; // 떠다니는 속도(px/초)

  const TINT = {
    blue: { name: '파랑', burst: ['#8fc4ff', '#3b82f6', '#ffffff'] },
    red: { name: '빨강', burst: ['#ffa3ae', '#f0455f', '#ffffff'] },
  };
  const DIR = { asc: '작은 수부터', desc: '큰 수부터' };

  const range = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));
  const multOf = (combo) => 1 + Math.min(3, Math.floor(combo / 5));
  // 떠다니는 숫자끼리 지켜야 할 반지름. 모서리가 둥근 네모(빨강)의 대각선까지 덮는다
  const radiusOf = (size) => size * 0.57 + 3;

  // ----- 규칙. deal(n) 은 버튼 n 개 안에서 { order: 누를 순서, traps: 함정 } 을 만든다

  /** "step 의 배수만 작은 것부터". 나머지 수는 함정이 된다 */
  function dealMultiples(step, n) {
    const t = Math.max(3, Math.round(n * 0.6));
    const pool = range(t * step + step - 1, (i) => i + 1).filter((v) => v % step !== 0);
    return { order: range(t, (i) => (i + 1) * step), traps: shuffle(pool).slice(0, Math.max(1, n - t)) };
  }

  // 2스테이지의 변칙 순서. 판마다 하나를 뽑는다
  const TWISTS = {
    desc: {
      sub: '큰 수부터 거꾸로!',
      goal: '<b>큰 수부터</b> 거꾸로 눌러라',
      deal(n) {
        const c = Math.max(4, Math.round(n * 0.8));
        return { order: range(c, (i) => c - i), traps: [] };
      },
    },
    even: {
      sub: '짝수만 작은 수부터!<br>홀수는 함정',
      goal: '<b>짝수만</b> 작은 수부터. 홀수는 함정!',
      deal: (n) => dealMultiples(2, n),
    },
    mul3: {
      sub: '3의 배수만 작은 수부터!<br>나머지는 함정',
      goal: '<b>3의 배수만</b> 차례로. 나머지는 함정!',
      deal: (n) => dealMultiples(3, n),
    },
    skip5: {
      sub: '5씩 뛰어 세기!<br>5, 10, 15… 나머지는 함정',
      goal: '<b>5, 10, 15…</b> 5씩 뛰어 세기. 함정 조심!',
      deal: (n) => dealMultiples(5, n),
    },
  };

  /** 스테이지의 규칙을 정한다. 숫자는 판 크기를 잰 뒤 deal 로 만든다 */
  function makeRule(stage, twistKey) {
    if (stage === 0) {
      return {
        name: 'asc',
        title: '스테이지 1',
        sub: '1부터 차례로!',
        goal: '<b>1부터</b> 작은 수에서 큰 수로',
        ms: 1400,
        deal: (n) => ({ order: range(n, (i) => i + 1), traps: [] }),
      };
    }
    if (stage === 1) return Object.assign({ name: twistKey, title: '규칙이 바뀐다!', ms: 2000 }, TWISTS[twistKey]);

    // 3스테이지: 색마다 방향이 다르다. 쉬움에서는 늘 작은 수부터 시작한다
    const first = pick(['blue', 'red']);
    const second = first === 'blue' ? 'red' : 'blue';
    const dirs = level === 0 || Math.random() < 0.5 ? ['asc', 'desc'] : ['desc', 'asc'];
    const sorted = (list, dir) => list.sort((a, b) => (dir === 'asc' ? a - b : b - a));
    return {
      name: 'color',
      moving: true,
      phases: [
        { color: first, dir: dirs[0] },
        { color: second, dir: dirs[1] },
      ],
      title: '움직이는 판!',
      sub: `${TINT[first].name}은 ${DIR[dirs[0]]}<br>그다음 ${TINT[second].name}은 ${DIR[dirs[1]]}`,
      ms: 2400,
      deal(n) {
        const nums = shuffle(range(n, (i) => i + 1));
        const cut = Math.ceil(n / 2);
        const a = sorted(nums.slice(0, cut), dirs[0]);
        const b = sorted(nums.slice(cut), dirs[1]);
        const colors = {};
        a.forEach((v) => (colors[v] = first));
        b.forEach((v) => (colors[v] = second));
        return { order: a.concat(b), traps: [], colors, cut };
      },
    };
  }

  /** 버튼 count 개가 넉넉히 들어가는 가장 큰 격자를 고른다. 칸 하나에 버튼 하나라서 겹칠 수 없다 */
  function gridFor(count, W, H) {
    let cell = 100;
    for (; cell > MIN_CELL; cell -= 2) {
      if (Math.floor(W / cell) * Math.floor(H / cell) >= Math.ceil(count * 1.35)) break;
    }
    return { cols: Math.max(1, Math.floor(W / cell)), rows: Math.max(1, Math.floor(H / cell)) };
  }

  function start(game) {
    const forced = game.debug && (/[?&]twist=(\w+)/.exec(location.search) || [])[1]; // 검증용
    const twistKey = TWISTS[forced] ? forced : pick(Object.keys(TWISTS));

    let stageIdx = game.checkpoint;
    let rule = null;
    let items = []; // 판 위의 숫자들
    let order = []; // 눌러야 하는 숫자를 순서대로
    let idx = 0; // order 에서 다음에 누를 자리
    let cut = 0; // 3스테이지에서 색이 바뀌는 자리
    let phase = 0;
    let ready = false; // 입력을 받는가
    let frozenUntil = 0;
    let comboUntil = 0;
    let lastHit = 0;
    let hintItem = null;
    let pending = null; // 동시 터치 보정: 한발 먼저 닿은 "다음다음 숫자"
    let hideAt = 0;
    let peekUntil = 0;
    let timer = null;
    let mistakes = 0;
    let leftSum = 0; // 스테이지를 깰 때마다 남은 시간
    let timeSum = 0; // 스테이지에 주어진 시간
    let W = 0;
    let H = 0;
    let size = MIN_BTN;
    let grid = null;

    // ----- 화면
    const leftEl = h('b', { text: '준비' });
    const multEl = h('span', { class: 'nr-mult', text: 'x1' });
    const gaugeFill = h('i');
    const gauge = h('div', { class: 'nr-gauge' }, [multEl, h('div', { class: 'nr-gbar' }, gaugeFill)]);
    const field = h('div', { class: 'nr-field' }); // 숫자가 놓이는 자리. 판 테두리에서 조금 들여 놓는다
    const board = h('div', { class: 'nr-board' }, field);
    game.root.append(h('div', { class: 'nr-status' }, [h('div', { class: 'ar-chip nr-left' }, ['🎯 ', leftEl]), gauge]), board);

    const find = (n) => items.find((it) => !it.gone && it.n === n);
    const frozen = () => game.time < frozenUntil;
    const paintPos = (it) => (it.el.style.transform = `translate3d(${it.x.toFixed(1)}px, ${it.y.toFixed(1)}px, 0)`);

    function paintStatus() {
      leftEl.textContent = order.length ? `${idx} / ${order.length}` : '준비';
      const m = multOf(game.combo);
      multEl.textContent = 'x' + m;
      multEl.classList.toggle('up', m > 1);
    }

    function paintGoal() {
      if (!rule.phases) return game.setGoal(rule.goal);
      const part = (p, i) =>
        `<span class="nr-ph ${p.color}${i === phase ? ' on' : i < phase ? ' done' : ''}">${TINT[p.color].name} ${DIR[p.dir]}</span>`;
      game.setGoal(rule.phases.map(part).join('<span class="nr-arrow">▶</span>'));
    }

    // ----- 배치
    /** 격자 칸 안에서만 흔들어 놓는다. 화면 크기가 바뀌면 같은 칸으로 다시 계산한다 */
    function layout() {
      W = field.clientWidth;
      H = field.clientHeight;
      if (!grid || !items.length || rule.moving) return; // 떠다니는 판은 벽만 새로 잡으면 된다
      const cw = W / grid.cols;
      const ch = H / grid.rows;
      const s = Math.min(size, Math.floor(Math.min(cw, ch)) - 4);
      field.style.setProperty('--s', s + 'px');
      items.forEach((it) => {
        it.x = (it.col + 0.5) * cw + it.jx * Math.max(0, (cw - s) / 2 - 2);
        it.y = (it.row + 0.5) * ch + it.jy * Math.max(0, (ch - s) / 2 - 2);
        paintPos(it);
      });
    }

    function deal() {
      W = field.clientWidth;
      H = field.clientHeight;
      // 화면이 작으면 들어가는 만큼만 낸다
      const want = [S.totalNumbers, S.count2, S.count3][stageIdx];
      let n = Math.min(want, Math.max(4, Math.floor(W / MIN_CELL) * Math.floor(H / MIN_CELL)));
      if (rule.moving) {
        // 떠다닐 틈이 남는 만큼만
        const room = Math.floor((W * H * DENSITY) / (Math.PI * Math.pow(radiusOf(MIN_BTN), 2)));
        n = clamp(n, 4, Math.max(4, room));
      }
      const dealt = rule.deal(n);
      order = dealt.order;
      cut = dealt.cut || 0;
      const list = order.map((v) => ({ n: v, trap: false })).concat(dealt.traps.map((v) => ({ n: v, trap: true })));

      grid = gridFor(list.length, W, H);
      const cw = W / grid.cols;
      const ch = H / grid.rows;
      size = clamp(Math.floor(Math.min(cw, ch) * 0.8), MIN_BTN, MAX_BTN);
      if (rule.moving) {
        // 떠다닐 틈이 남도록 크기를 한 번 더 줄인다
        const fit = Math.floor((Math.sqrt((W * H * DENSITY) / (Math.PI * list.length)) - 3) / 0.57);
        size = clamp(fit, MIN_BTN, size);
      }
      field.style.setProperty('--s', size + 'px');

      const cells = shuffle(range(grid.cols * grid.rows, (i) => i));
      const slow = 1 - Math.min(game.retry, 2) * 0.15;
      items = list.map((it, i) => {
        const cell = cells[i % cells.length];
        const ang = rand(0, Math.PI * 2);
        const speed = DRIFT * rand(0.7, 1.3) * slow;
        Object.assign(it, {
          color: dealt.colors ? dealt.colors[it.n] : null,
          col: cell % grid.cols,
          row: Math.floor(cell / grid.cols),
          jx: rand(-1, 1),
          jy: rand(-1, 1),
          speed,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed,
          gone: false,
          masked: false,
        });
        it.x = (it.col + 0.5) * cw + it.jx * Math.max(0, (cw - size) / 2 - 2);
        it.y = (it.row + 0.5) * ch + it.jy * Math.max(0, (ch - size) / 2 - 2);
        it.face = h('span', { class: 'nr-face', text: String(it.n) });
        it.el = h(
          'button',
          {
            class: 'nr-num in' + (it.color ? ' ' + it.color : ''),
            'aria-label': String(it.n),
            style: { '--rot': rand(-8, 8).toFixed(1) + 'deg', '--d': i * 14 + 'ms' },
          },
          it.face
        );
        it.el.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          tap(it);
        });
        return it;
      });
      if (rule.moving) for (let i = 0; i < 8; i++) separate(items); // 첫 화면부터 서로 떨어져 있게
      items.forEach((it) => {
        paintPos(it);
        field.appendChild(it.el);
      });
      // 등장 움직임이 끝나면 클래스를 떼어, 뒤의 다른 움직임이 끝날 때 다시 재생되지 않게 한다
      const mine = items;
      game.after(700, () => mine.forEach((it) => it.el.classList.remove('in')));
    }

    // ----- 떠다니기 (3스테이지)
    /** 겹친 쌍을 밀어내고 벽 안으로 넣는다. 부딪친 쌍은 서로 튕긴다 */
    function separate(live) {
      const R = radiusOf(size);
      const wall = R - 1;
      for (let i = 0; i < live.length; i++) {
        for (let j = i + 1; j < live.length; j++) {
          const a = live[i];
          const b = live[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let d = Math.hypot(dx, dy);
          if (d >= R * 2) continue;
          if (d < 0.01) {
            dx = 1;
            dy = 0;
            d = 1;
          }
          const nx = dx / d;
          const ny = dy / d;
          const push = (R * 2 - d) / 2;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel < 0) {
            a.vx += rel * nx;
            a.vy += rel * ny;
            b.vx -= rel * nx;
            b.vy -= rel * ny;
          }
        }
      }
      live.forEach((it) => {
        if (it.x < wall) {
          it.x = wall;
          it.vx = Math.abs(it.vx);
        } else if (it.x > W - wall) {
          it.x = W - wall;
          it.vx = -Math.abs(it.vx);
        }
        if (it.y < wall) {
          it.y = wall;
          it.vy = Math.abs(it.vy);
        } else if (it.y > H - wall) {
          it.y = H - wall;
          it.vy = -Math.abs(it.vy);
        }
      });
    }

    function drift(dt) {
      const live = items.filter((it) => !it.gone);
      live.forEach((it) => {
        it.x += it.vx * dt;
        it.y += it.vy * dt;
      });
      for (let pass = 0; pass < 3; pass++) separate(live);
      live.forEach((it) => {
        // 부딪쳐도 느려지거나 빨라지지 않게 제 속도로 되돌린다
        const v = Math.hypot(it.vx, it.vy);
        if (v < 0.5) {
          const ang = rand(0, Math.PI * 2);
          it.vx = Math.cos(ang) * it.speed;
          it.vy = Math.sin(ang) * it.speed;
        } else {
          it.vx *= it.speed / v;
          it.vy *= it.speed / v;
        }
        paintPos(it);
      });
    }

    // ----- 가려지는 숫자 (3스테이지, 난이도가 높을 때)
    function paintMasks() {
      const peek = game.time < peekUntil;
      items.forEach((it) => {
        if (it.gone || !it.masked) return;
        it.face.textContent = peek ? String(it.n) : '?';
        it.el.classList.toggle('masked', !peek);
      });
    }

    function maskSome() {
      const count = Math.max(0, S.hideCount - game.retry);
      // 바로 눌러야 할 두 개는 가리지 않는다
      const pool = shuffle(items.filter((it) => !it.gone && it.n !== order[idx] && it.n !== order[idx + 1]));
      const picked = pool.slice(0, count);
      if (!picked.length) return;
      picked.forEach((it) => (it.masked = true));
      paintMasks();
      sfx('flip');
      fx.toast('숫자가 숨었다! 자리를 기억해', { ms: 1100 });
    }

    // ----- 길잡이
    function clearHint() {
      if (hintItem) hintItem.el.classList.remove('hint');
      hintItem = null;
    }

    function showHint() {
      hintItem = find(order[idx]) || null;
      if (hintItem) hintItem.el.classList.add('hint');
    }

    function dropPending() {
      if (pending) pending.cancel();
      pending = null;
    }

    // ----- 입력
    function tap(it) {
      if (!ready || !game.playing || it.gone || frozen()) return;
      if (!it.trap && it.n === order[idx]) {
        hit(it);
        // 한발 먼저 닿았던 다음 숫자를 이어서 인정한다
        if (pending && ready && pending.it.n === order[idx]) {
          const next = pending.it;
          dropPending();
          hit(next);
        }
        return;
      }
      if (pending) {
        if (pending.it === it) return;
      } else if (!it.trap && it.n === order[idx + 1]) {
        // 두 손가락으로 동시에 누르면 순서가 뒤바뀌어 들어올 수 있다. 아주 잠깐 기다려 본다
        pending = { it, cancel: game.after(SIMUL_MS, () => { pending = null; miss(it); }) };
        return;
      }
      miss(it);
    }

    function hit(it) {
      const now = game.time;
      if (now > comboUntil) game.resetCombo();
      const combo = game.addCombo(); // 콤보가 이어질수록 음이 올라간다
      comboUntil = now + S.comboWindow;
      lastHit = now;
      idx++;

      const mult = multOf(combo);
      game.addScore(100 * mult, mult > 1 ? it.el : null);
      if (combo % 5 === 0) {
        timer.add(1); // 5콤보마다 시간 보너스
        sfx('bonus');
      }

      it.gone = true;
      it.face.textContent = String(it.n);
      it.el.classList.remove('masked', 'hint', 'in');
      it.el.classList.add('gone');
      fx.burst(it.el, { count: 9, spread: 70, size: 7, colors: it.color ? TINT[it.color].burst : ['#ffffff', '#36d6ff', '#b8a6ff'] });
      Arcade.audio.noise({ dur: 0.06, freq: 2200, to: 700, vol: 0.09 });
      Arcade.vibrate(12);
      const el = it.el;
      game.after(260, () => el.remove());
      if (hintItem === it) hintItem = null;
      clearHint();
      paintStatus();

      if (idx >= order.length) return stageClear();
      if (rule.phases && idx === cut) {
        // 색이 바뀐다: 여기서 머리를 다시 써야 한다
        phase = 1;
        const p = rule.phases[1];
        paintGoal();
        sfx('whoosh');
        fx.toast(`이제 <b>${TINT[p.color].name}</b>! ${DIR[p.dir]}`, { kind: 'gold', ms: 1100 });
      }
    }

    function miss(it) {
      dropPending();
      mistakes++;
      game.resetCombo();
      comboUntil = 0;
      frozenUntil = game.time + FREEZE_MS / 1000;
      board.classList.add('frozen');
      it.el.classList.add('wrong');
      if (it.trap) it.el.classList.add('marked');
      game.after(FREEZE_MS, () => {
        board.classList.remove('frozen');
        it.el.classList.remove('wrong');
      });
      fx.floatText(it.el, it.trap ? '함정!' : '순서 틀림!', { color: '#ff5d73', size: 20 });
      fx.shake(board, 8);
      fx.flash('rgba(140, 210, 255, .22)');
      sfx('bad');
      Arcade.vibrate(120);
      if (S.penalty > 0) timer.add(-S.penalty);
      if (items.some((v) => v.masked && !v.gone)) {
        peekUntil = game.time + FREEZE_MS / 1000 + PEEK_SEC; // 대가를 치른 대신 잠깐 다시 보여 준다
        paintMasks();
      }
      paintStatus();
    }

    // ----- 스테이지 진행
    async function runStage() {
      ready = false;
      dropPending();
      clearHint();
      items = [];
      order = [];
      idx = 0;
      phase = 0;
      hideAt = 0;
      peekUntil = 0;
      frozenUntil = 0;
      comboUntil = 0;
      field.innerHTML = '';
      board.classList.remove('frozen');
      board.dataset.stage = String(stageIdx + 1);
      rule = makeRule(stageIdx, twistKey);
      game.resetCombo();
      game.setStage(stageIdx, STAGES);
      paintGoal();
      paintStatus();

      const bonus = Math.min(game.retry, 3) * RETRY_BONUS;
      const total = Math.round(S.timeLimit * STAGE_TIME[stageIdx]) + bonus;
      timeSum += total;
      timer = game.startTimer(total, { onEnd: timeUp, intensity: 0.15 + stageIdx * 0.2 });
      timer.pause(); // 규칙 카드를 읽는 동안에는 시간이 흐르지 않는다
      await game.banner(rule.title, rule.sub, { ms: rule.ms });

      deal();
      paintStatus();
      timer.resume();
      lastHit = game.time;
      if (rule.moving && S.hideCount > 0) hideAt = game.time + HIDE_AFTER;
      ready = true;
      sfx('whoosh');
      if (bonus > 0 && stageIdx === game.checkpoint) fx.toast(`재도전 보너스 +${bonus}초`, { kind: 'good', ms: 1200 });
    }

    async function stageClear() {
      ready = false;
      dropPending();
      const left = timer.left();
      game.stopTimer();
      leftSum += left;
      // 남은 함정은 한꺼번에 터뜨린다
      items.forEach((it) => {
        if (it.gone) return;
        it.gone = true;
        it.el.classList.add('gone');
        fx.burst(it.el, { count: 5, spread: 46, size: 6, colors: ['#8892c8', '#565f96'] });
      });
      const prize = 200 + Math.round(left) * 20;
      game.addScore(prize);
      sfx('great');
      fx.confetti(24);
      fx.toast(`남은 시간 보너스 +${prize}`, { kind: 'gold', ms: 900 });
      await game.wait(800);
      if (stageIdx >= STAGES - 1) return finish();
      stageIdx++;
      runStage();
    }

    function timeUp() {
      ready = false;
      game.lose({
        title: '시간 초과!',
        message: `스테이지 ${stageIdx + 1}에서 숫자 <b>${Math.max(1, order.length - idx)}개</b>가 남았어요.`,
        checkpoint: stageIdx,
      });
    }

    function finish() {
      const spare = leftSum / Math.max(1, timeSum);
      let stars = mistakes === 0 && spare >= 0.2 ? 3 : mistakes <= 3 ? 2 : 1;
      if (game.retry > 0) stars = Math.min(stars, 2);
      game.win({
        stars,
        message:
          stars === 3
            ? '실수 하나 없이 번개처럼 끝냈어요!'
            : mistakes === 0
              ? '실수 없이 통과! 조금만 더 빠르면 별 3개예요.'
              : '바뀌는 규칙을 모두 통과했어요!',
        stats: [
          ['실수', `${mistakes}번`],
          ['최대 콤보', `${game.maxCombo}`],
          ['남긴 시간', `${leftSum.toFixed(1)}초`],
        ],
      });
    }

    game.loop((dt) => {
      const now = game.time;
      // 콤보가 끊기기까지 남은 시간
      const k = ready && game.combo > 0 ? clamp((comboUntil - now) / S.comboWindow, 0, 1) : 0;
      gaugeFill.style.transform = `scaleX(${k})`;
      gauge.classList.toggle('low', k > 0 && k < 0.35);
      if (!ready) return;
      if (game.combo > 0 && now > comboUntil) {
        game.resetCombo();
        paintStatus();
      }
      // 한참 못 찾으면 다음 숫자가 깜빡인다. 두 번 넘게 실패한 판에서는 난이도와 상관없이 켠다
      const hintDelay = S.hintDelay > 0 ? S.hintDelay : game.retry >= 2 ? 3 : 0;
      if (hintDelay > 0 && !hintItem && now - lastHit > hintDelay) showHint();
      if (frozen() || !rule.moving) return; // 얼어 있는 동안에는 판도 멈춘다
      drift(dt);
      if (hideAt && now >= hideAt) {
        hideAt = 0;
        maskSome();
      }
      if (peekUntil && now >= peekUntil) {
        peekUntil = 0;
        paintMasks();
      }
    });

    if (window.ResizeObserver) {
      const ro = new ResizeObserver(layout);
      ro.observe(field);
      game.onCleanup(() => ro.disconnect());
    } else {
      game.on(window, 'resize', layout);
    }

    if (game.debug) {
      // 검증용 창구
      window.__game = {
        ready: () => ready && !frozen() && !pending,
        state: () => ({
          stage: stageIdx,
          rule: rule ? rule.name : null,
          phases: rule && rule.phases ? rule.phases : null,
          phase,
          count: items.length,
          total: order.length,
          done: idx,
          next: order[idx],
          order: order.slice(),
          mistakes,
          frozen: frozen(),
          size,
          timeLeft: timer ? timer.left() : 0,
          comboLeft: Math.max(0, comboUntil - game.time),
          hint: hintItem ? hintItem.n : null,
          settings: Object.assign({ level }, S),
        }),
        items: () =>
          items
            .filter((it) => !it.gone)
            .map((it) => {
              const r = it.el.getBoundingClientRect();
              return {
                n: it.n,
                trap: it.trap,
                color: it.color,
                text: it.face.textContent,
                x: r.left + r.width / 2,
                y: r.top + r.height / 2,
                w: r.width,
                h: r.height,
              };
            }),
        board: () => {
          const r = field.getBoundingClientRect();
          return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
        },
        tapNext: () => {
          const it = find(order[idx]);
          if (it) tap(it);
          return !!it;
        },
        tapWrong: () => {
          const live = items.filter((it) => !it.gone && it.n !== order[idx]);
          const it = live.find((v) => v.trap) || live.find((v) => v.n !== order[idx + 1]) || live[0];
          if (it) tap(it);
          return !!it;
        },
      };
    }

    runStage();
  }

  Arcade.createGame({
    id: GAME_ID,
    title: '넘버 러시',
    icon: '🔢',
    accent: '#36d6ff',
    accent2: '#7c5cff',
    tagline: '눈으로 훑고 손으로 쏜다. 그런데 규칙이 자꾸 바뀐다!',
    howTo: [
      '규칙에 맞는 숫자를 <b>순서대로</b> 빠르게 터치',
      '스테이지마다 <b>순서의 규칙</b>이 바뀌어요. 틀리면 시간이 깎여요',
      '끊기지 않고 누르면 <b>콤보</b>: 점수 배수와 보너스 시간',
    ],
    stages: STAGES,
    start,
  });
})();
