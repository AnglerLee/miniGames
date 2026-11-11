// 숫자 퍼즐: 최소 이동 퍼즐 릴레이
// 눈앞에서 섞이는 짧은 퍼즐 세 개를 가장 적은 이동으로 되돌린다.
// 한 수 둘 때마다 완성에 가까워졌는지(따뜻해) 멀어졌는지(차가워) 바로 알려 준다.
(function () {
  'use strict';

  // ============================================================ 퍼즐 (순수 함수)
  // 화면과 무관해서 Node 에서 require 로 불러 따로 검증한다.
  // 판은 길이 n×n 배열이고 0 이 빈칸이다. 완성 모습은 [1, 2, ..., n×n-1, 0].
  // "한 수"는 빈칸이 한 칸 움직이는 것(그 자리의 타일이 빈칸으로 밀린다)이고 방향 번호로 적는다.
  const DR = [-1, 0, 1, 0]; // 0 위, 1 오른쪽, 2 아래, 3 왼쪽
  const DC = [0, 1, 0, -1];
  const back = (d) => d ^ 2; // 반대 방향

  const goalOf = (n) => Array.from({ length: n * n }, (_, i) => (i + 1) % (n * n));
  const isSolved = (t) => t.every((v, i) => v === (i + 1) % t.length);

  /** b 칸에서 d 방향 옆 칸 번호. 판 밖이면 -1 */
  function nextTo(n, b, d) {
    const r = ((b / n) | 0) + DR[d];
    const c = (b % n) + DC[d];
    return r < 0 || c < 0 || r >= n || c >= n ? -1 : r * n + c;
  }

  /** 빈칸을 d 방향으로 한 칸 옮긴다(판을 직접 고친다). 못 가면 false */
  function shift(t, n, d) {
    const b = t.indexOf(0);
    const j = nextTo(n, b, d);
    if (j < 0) return false;
    t[b] = t[j];
    t[j] = 0;
    return true;
  }

  /** idx 칸의 타일을 누르면 빈칸이 어느 방향으로 몇 칸 가는가. 빈칸과 같은 줄이 아니면 null */
  function slideOf(n, b, idx) {
    if (idx === b || idx < 0) return null;
    const br = (b / n) | 0;
    const bc = b % n;
    const r = (idx / n) | 0;
    const c = idx % n;
    if (r === br) return { d: c > bc ? 1 : 3, k: Math.abs(c - bc) };
    if (c === bc) return { d: r > br ? 2 : 0, k: Math.abs(r - br) };
    return null;
  }

  // ----- 3×3: 모든 판(181,440개)의 최소 수를 표로 만들어 둔다
  const FACT = [1, 1, 2, 6, 24, 120, 720, 5040, 40320];
  const TABLE_SIZE = 362880; // 9!
  const UNKNOWN = 255;

  /** 3×3 판의 순열 번호(0 ~ 9!-1) */
  function rank9(t) {
    let r = 0;
    for (let i = 0; i < 8; i++) {
      let c = 0;
      for (let j = i + 1; j < 9; j++) if (t[j] < t[i]) c++;
      r += c * FACT[8 - i];
    }
    return r;
  }

  function unrank9(r) {
    const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const t = [];
    for (let i = 0; i < 9; i++) {
      const f = FACT[8 - i];
      t.push(pool.splice((r / f) | 0, 1)[0]);
      r %= f;
    }
    return t;
  }

  /**
   * 3×3 거리표를 만드는 일꾼(완성 모습에서 너비 우선으로 퍼져 나간다).
   * work(ms) 를 여러 번 불러 조금씩 채우므로 화면이 멈추지 않는다. 끝나면 true 를 돌려준다.
   */
  function tableJob() {
    const dist = new Uint8Array(TABLE_SIZE).fill(UNKNOWN);
    const queue = new Int32Array(TABLE_SIZE / 2);
    let head = 0;
    let tail = 0;
    const g = rank9(goalOf(3));
    dist[g] = 0;
    queue[tail++] = g;
    return {
      dist,
      work(ms) {
        const until = Date.now() + ms;
        while (head < tail) {
          const r = queue[head++];
          const t = unrank9(r);
          const b = t.indexOf(0);
          for (let d = 0; d < 4; d++) {
            const j = nextTo(3, b, d);
            if (j < 0) continue;
            t[b] = t[j];
            t[j] = 0;
            const r2 = rank9(t);
            if (dist[r2] === UNKNOWN) {
              dist[r2] = dist[r] + 1;
              queue[tail++] = r2;
            }
            t[j] = t[b];
            t[b] = 0;
          }
          if ((head & 255) === 0 && Date.now() >= until) break;
        }
        return head >= tail;
      },
    };
  }

  /** 3×3: 최소 수가 한 수 줄어드는 방향. 이미 완성이면 -1 */
  function downhill(t, table) {
    const b = t.indexOf(0);
    const now = table[rank9(t)];
    for (let d = 0; d < 4; d++) {
      const j = nextTo(3, b, d);
      if (j < 0) continue;
      t[b] = t[j];
      t[j] = 0;
      const next = table[rank9(t)];
      t[j] = t[b];
      t[b] = 0;
      if (next === now - 1) return d;
    }
    return -1;
  }

  /** 3×3: 거리표를 따라 내려가는 최적 풀이 */
  function descend(tiles, table) {
    const t = tiles.slice();
    const path = [];
    for (let d = downhill(t, table); d >= 0; d = downhill(t, table)) {
      shift(t, 3, d);
      path.push(d);
    }
    return path;
  }

  // ----- 4×4: 얕게 섞은 판이라 IDA*(맨해튼 거리)로 최적 풀이를 바로 구한다
  /** 맨해튼 거리: 타일마다 제자리까지 가야 하는 칸 수의 합. 실제 최소 수보다 크지 않고 홀짝이 같다 */
  function manhattan(t, n) {
    let s = 0;
    for (let i = 0; i < t.length; i++) {
      const v = t[i];
      if (!v) continue;
      s += Math.abs(((i / n) | 0) - (((v - 1) / n) | 0)) + Math.abs((i % n) - ((v - 1) % n));
    }
    return s;
  }

  /**
   * limit 수 안에 끝나는 풀이를 깊이 우선으로 찾는다(IDA* 의 한 바퀴).
   * 찾으면 방향 목록, 없으면 null, 살펴본 판이 cap 을 넘으면 undefined(모름).
   */
  function within(tiles, n, limit, cap) {
    const t = tiles.slice();
    const path = [];
    let b = t.indexOf(0);
    let seen = 0;
    let gaveUp = false;
    function dfs(g, hv, banned) {
      if (hv === 0) return true;
      if (++seen > cap) {
        gaveUp = true;
        return false;
      }
      for (let d = 0; d < 4; d++) {
        if (d === banned) continue; // 방금 온 길로 되돌아가지 않는다
        const j = nextTo(n, b, d);
        if (j < 0) continue;
        const v = t[j];
        const hr = ((v - 1) / n) | 0;
        const hc = (v - 1) % n;
        // 타일 v 가 j 칸에서 빈칸 자리로 옮겨 갈 때 맨해튼 거리가 바뀌는 만큼만 다시 센다
        const h2 = hv - Math.abs(((j / n) | 0) - hr) - Math.abs((j % n) - hc) + Math.abs(((b / n) | 0) - hr) + Math.abs((b % n) - hc);
        if (g + 1 + h2 > limit) continue;
        const b0 = b;
        t[b] = v;
        t[j] = 0;
        b = j;
        path.push(d);
        if (dfs(g + 1, h2, back(d))) return true;
        path.pop();
        b = b0;
        t[j] = v;
        t[b] = 0;
        if (gaveUp) return false;
      }
      return false;
    }
    if (dfs(0, manhattan(t, n), -1)) return path;
    return gaveUp ? undefined : null;
  }

  /** 최적 풀이(IDA*). 한도를 맨해튼 거리에서 시작해 2씩 올린다. 너무 깊으면 undefined */
  function solve(tiles, n, cap) {
    for (let limit = manhattan(tiles, n); ; limit += 2) {
      const path = within(tiles, n, limit, cap || 2000000);
      if (path !== null) return path;
    }
  }

  /**
   * 길잡이: 지금 판에서 완성까지의 최소 수와 다음에 둘 가장 좋은 수를 알려 준다.
   * 3×3 은 거리표를 보고, 4×4 는 최적 풀이를 들고 다니며 한 수마다 고친다.
   */
  function makeGuide(n, tiles, table, firstPath) {
    // 한 수 판정에서 살펴볼 판의 한도. 목표보다 15수쯤 더 멀어진 뒤에야 걸리고, 그때는 "무르는 것이 가장 빠르다"로 본다
    const CAP = 100000;
    let path = n === 3 ? null : (firstPath || solve(tiles, n)).slice();
    return {
      dist: (t) => (path ? path.length : table[rank9(t)]),
      next: (t) => (path ? (path.length ? path[0] : -1) : downhill(t, table)),
      /** 빈칸이 d 로 움직인 뒤에 부른다(t 는 움직인 뒤의 판) */
      moved(t, d) {
        if (!path) return;
        if (path[0] === d) {
          path.shift();
          return;
        }
        // 한 수 움직이면 최소 수는 1 줄거나 1 는다. 1 줄어든 풀이가 있으면 그것이 새 풀이이고,
        // 없으면 방금 수를 무르고 원래 풀이를 따르는 것이 가장 빠르다.
        const other = within(t, n, path.length - 1, CAP);
        path = other || [back(d)].concat(path);
      },
      save: () => (path ? path.slice() : null),
      load(p) {
        if (path) path = p.slice();
      },
    };
  }

  /** 완성 모습에서 steps 번 거꾸로 섞는다(방금 온 길로는 돌아가지 않는다) */
  function scramble(n, steps, rng) {
    const t = goalOf(n);
    let banned = -1;
    for (let i = 0; i < steps; ) {
      const d = (rng() * 4) | 0;
      if (d === banned || !shift(t, n, d)) continue;
      banned = back(d);
      i++;
    }
    return t;
  }

  /** 3×3: 최소 수가 딱 want 인 판을 거리표에서 고르게 하나 뽑는다 */
  function pickByDistance(table, want, rng) {
    let seen = 0;
    let chosen = -1;
    for (let r = 0; r < TABLE_SIZE; r++) {
      if (table[r] === want && rng() * ++seen < 1) chosen = r;
    }
    return chosen < 0 ? null : unrank9(chosen);
  }

  /** 최소 수가 lo~hi 인 퍼즐을 만든다. { tiles, target(최소 수), path(최적 풀이) } */
  function makePuzzle(n, lo, hi, rng, table) {
    const want = () => lo + ((rng() * (hi - lo + 1)) | 0);
    if (n === 3) {
      const tiles = pickByDistance(table, want(), rng);
      return { tiles, target: table[rank9(tiles)], path: descend(tiles, table) };
    }
    let best = null;
    for (let i = 0; i < 400; i++) {
      const tiles = scramble(n, want(), rng);
      const path = solve(tiles, n);
      if (!path) continue;
      if (path.length >= lo) return { tiles, target: path.length, path };
      // 섞다가 길이 겹쳐 얕아진 판은 버린다. 끝내 못 찾으면 가장 깊은 것을 쓴다
      if (!best || path.length > best.target) best = { tiles, target: path.length, path };
    }
    return best;
  }

  const Core = {
    back, goalOf, isSolved, nextTo, shift, slideOf, rank9, unrank9, tableJob, downhill, descend,
    manhattan, within, solve, makeGuide, scramble, pickByDistance, makePuzzle,
  };
  if (typeof module === 'object' && module.exports) {
    module.exports = Core;
    return;
  }

  // ============================================================ 게임
  const { h, clamp, pick, sfx, fx } = Arcade;
  const GAME_ID = 'game05';

  // ----- 설정 (관리자 페이지와 같은 키를 쓴다)
  const PRESETS = [
    { stageTime: 30, depth: 1, budget: 2.5 },
    { stageTime: 26, depth: 2, budget: 2.2 },
    { stageTime: 24, depth: 3, budget: 1.8 },
  ];
  const LIMITS = { stageTime: [10, 300], depth: [1, 3], budget: [1.2, 5] };
  const num = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));
  const saved = Arcade.loadSettings('sliding_puzzle_settings', {});
  const level = clamp(parseInt(saved.difficulty, 10) || 0, 0, 2);
  const S = Object.assign({}, PRESETS[level]);
  // 옛 형식({ gridSize, timeLimit, theme }): 한 판 전체 시간이던 timeLimit 을 1스테이지 시간으로 옮긴다.
  // gridSize 와 theme 은 더 쓰지 않는다(판 크기는 스테이지가 정한다).
  if (saved.stageTime === undefined && num(saved.timeLimit) > 0) S.stageTime = Math.round(num(saved.timeLimit) / 4);
  Object.keys(LIMITS).forEach((key) => {
    const v = num(saved[key]);
    if (Number.isFinite(v)) S[key] = v;
    S[key] = clamp(S[key], LIMITS[key][0], LIMITS[key][1]);
  });
  S.depth = Math.round(S.depth);
  S.showNumbers = saved.showNumbers === true;

  // 섞기 깊이(1~3)에 따른 스테이지별 최소 수 범위
  const DEPTHS = [
    [[6, 8], [12, 14], [12, 16]],
    [[8, 10], [14, 16], [16, 20]],
    [[10, 12], [16, 18], [20, 24]],
  ];
  // time 은 설정값(1스테이지 시간)에 곱하는 배수, shuffle 은 섞을 때 한 수에 걸리는 시간(ms)
  const STAGES = [
    {
      n: 3, time: 1, shuffle: 150,
      goal: (t) => `<b>1부터 순서대로!</b> 목표 <b>${t}번</b>`,
      banner: ['퍼즐 1', '섞이는 걸 잘 봐! 거꾸로 하면 풀린다'],
    },
    {
      n: 3, time: 2, shuffle: 115, picture: true,
      goal: (t) => `<b>그림</b>을 완성해라! 목표 <b>${t}번</b>`,
      banner: ['퍼즐 2', '이번엔 숫자 대신 그림 조각!'],
    },
    {
      n: 4, time: 1.8, shuffle: 85,
      goal: (t) => `<b>4×4</b> 도전! 목표 <b>${t}번</b>`,
      banner: ['마지막 퍼즐', '4×4! 시간이 빠듯하다'],
    },
  ];
  // 그림 퍼즐: 큰 이모지 하나와 네 귀퉁이 장식, 가로로 변하는 바탕색
  const PICTURES = [
    { big: '🦁', deco: ['☀️', '🌴', '🌿', '🦋'], colors: ['#ffd166', '#ff9f43', '#ff6b6b'] },
    { big: '🚀', deco: ['⭐', '🌙', '🌍', '☄️'], colors: ['#5f6bff', '#8e5bff', '#d15bff'] },
    { big: '🐳', deco: ['☁️', '⛵', '🐚', '🐠'], colors: ['#36d6ff', '#4d8dff', '#6b6bff'] },
    { big: '🦖', deco: ['🌋', '🌴', '🥚', '🌿'], colors: ['#b5e86a', '#2fd17a', '#1fa3a3'] },
  ];

  const UNDOS = 3; // 퍼즐마다 되돌리기 횟수
  const HINTS = 1; // 퍼즐마다 힌트 횟수
  const STAR3_EXTRA = 4; // 세 퍼즐에서 목표보다 더 움직인 수의 합이 이만큼까지면 별 3개
  const STAR2_EXTRA = 16;
  const PAD = 6; // 판 테두리와 타일 사이(px)
  const SWIPE = 24; // 이만큼 끌면 밀기로 본다(px)

  // 3×3 거리표는 페이지가 뜨자마자 8ms 씩 끊어서 만든다. 시작 버튼은 이것이 끝난 뒤에 넘어간다
  const job = Core.tableJob();
  let table = null;
  const tableReady = (async () => {
    while (!job.work(8)) await Arcade.wait(0);
    table = job.dist;
  })();

  function start(game) {
    const ease = Math.min(game.retry, 3); // 재도전할수록 시간과 이동 한도를 조금 더 준다
    const first = game.checkpoint;
    let stageIdx = first;
    let P = null; // 지금 퍼즐
    let accepting = false;
    let hintUsed = false;
    let tileEls = [];
    let lastEl = null; // 그림의 마지막 조각(완성하면 채워진다)
    let hintEl = null;
    let pitch = 0; // 타일 한 칸의 간격(px)
    let swipe = null;
    const results = [];
    if (!table) {
      // 시작 화면을 거치지 않은 경우의 안전장치
      while (!job.work(50));
      table = job.dist;
    }

    // ----- 화면
    const movesEl = h('div', { class: 'ar-chip sp-moves' });
    const leftEl = h('div', { class: 'ar-chip sp-left' });
    const distEl = h('b');
    const feelEl = h('span', { class: 'sp-feel' });
    const heatBar = h('div', { class: 'sp-heat-bar' });
    const heat = h('div', { class: 'sp-heat' }, [
      h('div', { class: 'sp-heat-text' }, [h('span', null, ['완성까지 ', distEl, '번']), feelEl]),
      heatBar,
    ]);
    const preview = h('div', { class: 'sp-preview' });
    const board = h('div', { class: 'sp-board' });
    const box = h('div', { class: 'sp-box' }, board);
    game.root.append(
      h('div', { class: 'sp-wrap' }, [
        h('div', { class: 'sp-status' }, [movesEl, leftEl]),
        h('div', { class: 'sp-info' }, [heat, h('div', { class: 'sp-goalpic' }, [h('span', { text: '완성 모습' }), preview])]),
        box,
      ])
    );
    // 도움 버튼은 누르는 순간 듣는다(pointerdown). 판을 빠르게 민 직후의 첫 탭은 브라우저가 click 을 삼킬 때가 있다.
    // 키보드로 누른 click(detail 0)도 받는다.
    const helpBtn = (fn) =>
      h('button', {
        class: 'ar-btn ghost sp-btn',
        onpointerdown: (e) => {
          e.preventDefault();
          fn();
        },
        onclick: (e) => {
          if (e.detail === 0) fn();
        },
      });
    const undoBtn = helpBtn(() => undo());
    const hintBtn = helpBtn(() => hint());
    game.footer.append(undoBtn, hintBtn);

    /** 그림 한 장. 타일마다 같은 그림을 넣고 자기 칸만큼만 보이게 잘라 쓴다 */
    function scene(pic) {
      return h('div', { class: 'sp-scene', style: { '--p1': pic.colors[0], '--p2': pic.colors[1], '--p3': pic.colors[2] } }, [
        h('span', { class: 'big', text: pic.big }),
        ...pic.deco.map((e, i) => h('span', { class: 'deco d' + i, text: e })),
      ]);
    }

    function makeTile(v) {
      const n = P.n;
      const row = ((v - 1) / n) | 0;
      const el = h('div', { class: 'sp-tile', dataset: { v: String(v), row: String(row) }, style: { '--tr': row, '--tc': (v - 1) % n } });
      if (P.pic) {
        el.append(scene(P.pic));
        if (S.showNumbers && v < n * n) el.append(h('i', { class: 'sp-num', text: String(v) }));
      } else {
        el.textContent = String(v);
      }
      return el;
    }

    /** 상자 크기에 맞춰 판과 타일 크기를 정한다. 360×640 에서도 4×4 가 한 화면에 들어온다 */
    function measure() {
      const W = box.clientWidth;
      const H = box.clientHeight;
      if (!W || !H) return;
      const n = P.n;
      const gap = n === 4 ? 5 : 6;
      const s = Math.floor((Math.min(W, H, 440) - PAD * 2 - gap * (n - 1)) / n);
      const size = s * n + gap * (n - 1) + PAD * 2;
      pitch = s + gap;
      board.style.width = board.style.height = size + 'px';
      board.style.left = Math.round((W - size) / 2) + 'px';
      board.style.top = Math.round((H - size) / 2) + 'px';
      board.style.setProperty('--sp-s', s + 'px');
      preview.style.setProperty('--sp-s', preview.clientWidth / n + 'px');
    }

    const spot = (i) => `translate(${PAD + (i % P.n) * pitch}px, ${PAD + ((i / P.n) | 0) * pitch}px)`;

    /** 타일을 지금 판의 자리로 옮긴다(움직임은 CSS 가 부드럽게 이어 준다) */
    function place() {
      P.tiles.forEach((v, i) => {
        if (!v) return;
        tileEls[v].style.transform = spot(i);
        tileEls[v].classList.toggle('home', v === i + 1);
      });
      if (lastEl) lastEl.style.transform = spot(P.tiles.length - 1);
    }

    /** 새 퍼즐의 판, 미리보기, 온도 막대를 만든다 */
    function build() {
      const n = P.n;
      board.className = 'sp-board n' + n + (P.pic ? ' pic' : '');
      board.innerHTML = '';
      measure();
      tileEls = [null];
      for (let v = 1; v < n * n; v++) tileEls.push(makeTile(v));
      lastEl = null;
      if (P.pic) {
        lastEl = makeTile(n * n);
        lastEl.classList.add('last', 'show');
      }
      place();
      board.append(...tileEls.slice(1));
      if (lastEl) board.append(lastEl);

      preview.className = 'sp-preview' + (P.pic ? '' : ' nums n' + n);
      preview.innerHTML = '';
      if (P.pic) preview.append(scene(P.pic));
      else Core.goalOf(n).forEach((v) => preview.append(h('i', { text: v ? String(v) : '' })));

      heatBar.innerHTML = '';
      for (let i = 0; i < P.target; i++) heatBar.append(h('i'));
    }

    function restart(el, cls) {
      el.classList.remove('good', 'bad', 'soft', 'no');
      void el.offsetWidth;
      el.classList.add(cls);
    }

    function setFeel(kind, text) {
      feelEl.className = 'sp-feel ' + kind;
      feelEl.textContent = text;
      if (kind) restart(heat, kind);
    }

    function paint() {
      const left = P.budget - P.moves;
      movesEl.innerHTML = `이동 <b>${P.moves}</b> <small>/ 목표 ${P.target}</small>`;
      movesEl.classList.toggle('over', P.moves + P.dist > P.target); // 목표 그대로는 이미 놓쳤다
      leftEl.innerHTML = `남은 이동 <b>${left}</b>`;
      leftEl.classList.toggle('danger', accepting && left <= P.dist + 1); // 한 번만 더 헛걸음하면 끝
      distEl.textContent = String(P.dist);
      const lit = clamp(P.target - P.dist, 0, P.target);
      Array.from(heatBar.children).forEach((seg, i) => seg.classList.toggle('on', i < lit));
      heat.classList.toggle('far', P.dist > P.target);
      undoBtn.disabled = !accepting || P.undos <= 0 || !P.history.length;
      undoBtn.innerHTML = `↩ 되돌리기 <b>${P.undos}</b>`;
      hintBtn.disabled = !accepting || P.hints <= 0;
      hintBtn.innerHTML = P.hints > 0 ? '💡 힌트 <small>쓰면 별 2개까지</small>' : '💡 힌트 끝';
    }

    function clearHint() {
      if (hintEl) hintEl.classList.remove('hint');
      hintEl = null;
    }

    // ----- 한 수
    /** 빈칸을 d 방향으로 k 칸 옮긴다(타일 k 개가 한꺼번에 밀린다). 이동 수도 k 만큼 는다 */
    function move(d, k) {
      const { n, tiles, guide } = P;
      const before = P.dist;
      P.history.push({ tiles: tiles.slice(), moves: P.moves, score: game.score, path: guide.save() });
      let movedEl = null;
      for (let i = 0; i < k; i++) {
        movedEl = tileEls[tiles[nextToBlank(d)]];
        Core.shift(tiles, n, d);
        guide.moved(tiles, d);
      }
      P.moves += k;
      P.dist = guide.dist(tiles);
      clearHint();
      place();

      const delta = P.dist - before;
      if (delta === -k) {
        // 좋은 수: 밀린 칸 모두가 최소 수를 줄였다
        const combo = game.addCombo();
        game.addScore(20 * k * (combo >= 10 ? 3 : combo >= 5 ? 2 : 1), movedEl);
        setFeel('good', '🔥 따뜻해');
        restart(board, 'good');
      } else if (delta < 0) {
        // 가까워지긴 했지만 헛걸음이 섞였다
        sfx('tap');
        setFeel('soft', '🙂 조금 돌아갔어');
      } else {
        game.resetCombo();
        sfx('miss');
        setFeel('bad', '❄️ 차가워');
        restart(board, 'bad');
        Arcade.vibrate(30);
      }
      paint();

      if (P.dist === 0 && Core.isSolved(tiles)) return void solved();
      if (P.moves >= P.budget) {
        accepting = false;
        paint();
        game.after(500, () =>
          game.lose({
            icon: '🧩',
            title: '이동 수 끝!',
            message: `남은 이동을 다 썼어요. 완성까지 <b>${P.dist}번</b> 남았었어요.`,
            checkpoint: stageIdx,
          })
        );
      }
    }

    const nextToBlank = (d) => Core.nextTo(P.n, P.tiles.indexOf(0), d);
    const ready = () => accepting && game.playing;

    /** 타일 한 칸 밀기(밀어서 조작, 방향키). 그쪽에 타일이 없으면 판이 살짝 거부한다 */
    function step(d) {
      if (!ready()) return;
      if (nextToBlank(d) < 0) return void restart(board, 'no');
      move(d, 1);
    }

    /** idx 칸의 타일을 누른다. 빈칸과 같은 줄이면 사이의 타일까지 함께 밀린다 */
    function press(idx) {
      if (!ready()) return false;
      const s = Core.slideOf(P.n, P.tiles.indexOf(0), idx);
      if (s) move(s.d, s.k);
      return !!s;
    }

    board.addEventListener('pointerdown', (e) => {
      if (!ready()) return;
      e.preventDefault();
      const el = e.target.closest('.sp-tile');
      const idx = el ? P.tiles.indexOf(Number(el.dataset.v)) : -1;
      swipe = null;
      if (idx >= 0 && press(idx)) return;
      // 밀릴 수 없는 타일이나 빈칸에서 시작한 손가락은 밀기 동작인지 지켜본다
      swipe = { x: e.clientX, y: e.clientY, id: e.pointerId, el: idx >= 0 ? el : null };
      try {
        board.setPointerCapture(e.pointerId);
      } catch (err) {
        /* 포인터 잡기를 지원하지 않는 브라우저 */
      }
    });
    board.addEventListener('pointermove', (e) => {
      if (!swipe || e.pointerId !== swipe.id) return;
      const dx = e.clientX - swipe.x;
      const dy = e.clientY - swipe.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE) return;
      swipe = null;
      // 타일이 손가락 방향으로 밀리므로 빈칸은 반대쪽으로 간다
      step(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 1) : dy > 0 ? 0 : 2);
    });
    const endSwipe = () => {
      if (swipe && swipe.el && ready()) {
        // 움직일 수 없는 타일을 그냥 눌렀다
        restart(swipe.el, 'no');
        sfx('lock');
      }
      swipe = null;
    };
    board.addEventListener('pointerup', endSwipe);
    board.addEventListener('pointercancel', () => (swipe = null));
    game.on(window, 'keydown', (e) => {
      const d = { ArrowUp: 2, ArrowRight: 3, ArrowDown: 0, ArrowLeft: 1 }[e.key];
      if (d === undefined) return;
      e.preventDefault();
      step(d);
    });
    game.on(window, 'resize', () => {
      if (!P) return;
      measure();
      place();
    });

    // ----- 도움: 되돌리기와 힌트
    function undo() {
      if (!ready() || P.undos <= 0 || !P.history.length) return;
      const last = P.history.pop();
      P.tiles = last.tiles;
      P.moves = last.moves;
      P.guide.load(last.path);
      P.dist = P.guide.dist(P.tiles);
      P.undos--;
      game.setScore(last.score); // 무른 수로 얻은 점수도 함께 무른다
      game.resetCombo();
      clearHint();
      place();
      sfx('whoosh');
      setFeel('soft', '↩ 되돌렸어');
      paint();
    }

    function hint() {
      if (!ready() || P.hints <= 0) return;
      const d = P.guide.next(P.tiles);
      if (d < 0) return;
      P.hints--;
      hintUsed = true;
      clearHint();
      hintEl = tileEls[P.tiles[nextToBlank(d)]];
      hintEl.classList.add('hint');
      sfx('pick');
      paint();
    }

    // ----- 스테이지 진행
    function newPuzzle(stage) {
      const [lo, hi] = DEPTHS[S.depth - 1][stageIdx];
      const made = Core.makePuzzle(stage.n, lo, hi, Math.random, table);
      return {
        n: stage.n,
        pic: stage.picture ? pick(PICTURES) : null,
        tiles: Core.goalOf(stage.n), // 완성 모습에서 시작해 눈앞에서 섞는다
        path: made.path,
        guide: Core.makeGuide(stage.n, made.tiles, table, made.path),
        target: made.target,
        budget: Math.max(made.target + 2, Math.ceil(made.target * (S.budget + ease * 0.3))),
        dist: 0,
        moves: 0,
        undos: UNDOS,
        hints: HINTS,
        history: [],
      };
    }

    /** 최적 풀이를 거꾸로 밟아 완성 모습을 문제 판으로 섞는다. 잘 봐 두면 그대로 되짚어 풀 수 있다 */
    async function shuffleIn(ms) {
      await game.wait(400); // 완성 모습을 잠깐 보여 준다
      if (lastEl) lastEl.classList.remove('show');
      setFeel('soft', '섞는 중…');
      const steps = P.path.slice().reverse().map(Core.back);
      for (let i = 0; i < steps.length; i++) {
        Core.shift(P.tiles, P.n, steps[i]);
        P.dist = i + 1;
        place();
        paint();
        sfx('tick');
        await game.wait(ms);
      }
    }

    async function runStage() {
      const stage = STAGES[stageIdx];
      accepting = false;
      P = newPuzzle(stage);
      game.setStage(stageIdx, STAGES.length);
      game.setGoal(stage.goal(P.target));
      const timer = game.startTimer(Math.round(S.stageTime * stage.time * (1 + ease * 0.2)), { onEnd: timeUp });
      timer.pause(); // 섞는 동안에는 시간이 가지 않는다
      build();
      setFeel('', '');
      paint();
      await game.banner(stage.banner[0], stage.banner[1], { ms: 1400 });
      await shuffleIn(stage.shuffle);
      timer.resume();
      accepting = true;
      setFeel('soft', '출발!');
      sfx('go');
      paint();
    }

    function timeUp() {
      if (!accepting) return;
      accepting = false;
      game.lose({
        title: '시간 끝!',
        message: `완성까지 <b>${P.dist}번</b> 남았었어요.`,
        checkpoint: stageIdx,
      });
    }

    async function solved() {
      accepting = false;
      game.stopTimer();
      paint();
      const extra = P.moves - P.target;
      results.push({ target: P.target, moves: P.moves });
      await game.wait(170); // 마지막 타일이 들어가는 동안
      board.classList.add('done');
      if (lastEl) lastEl.classList.add('show');
      fx.confetti(24);
      fx.burst(board, { count: 16, spread: 140 });
      let bonus = 200 + Math.floor(game.timeLeft()) * 10;
      if (extra === 0) {
        bonus += 500;
        sfx('perfect');
        fx.toast(`✨ 완벽! 목표 ${P.target}번 그대로`, { kind: 'gold' });
      } else {
        if (extra <= 2) bonus += 200;
        sfx('stage');
        fx.toast(`${extra <= 2 ? '훌륭해!' : '완성!'} 목표보다 ${extra}번 더`, { kind: extra <= 2 ? 'good' : '' });
      }
      game.addScore(bonus, board);
      await game.wait(1300);
      if (stageIdx >= STAGES.length - 1) return finish();
      stageIdx++;
      runStage();
    }

    function finish() {
      const extra = results.reduce((sum, r) => sum + r.moves - r.target, 0);
      let stars = extra <= STAR3_EXTRA ? 3 : extra <= STAR2_EXTRA ? 2 : 1;
      let message = '세 퍼즐을 거의 최소 이동으로 풀었어요. 대단해요!';
      if (stars === 3 && hintUsed) {
        stars = 2;
        message = '힌트 없이 풀면 별 3개에 도전할 수 있어요.';
      } else if (stars === 3 && game.retry > 0) {
        stars = 2;
        message = '재도전 없이 한 번에 깨면 별 3개!';
      } else if (stars < 3) {
        message = `목표보다 모두 <b>${extra}번</b> 더 움직였어요. ${STAR3_EXTRA}번 이하면 별 3개!`;
      }
      game.win({
        stars,
        message,
        stats: [
          ...results.map((r, i) => [
            `퍼즐 ${first + i + 1}`,
            `${r.moves}번 <small>/ 목표 ${r.target}</small>${r.moves === r.target ? ' ✨' : ''}`,
          ]),
          ['최대 콤보', String(game.maxCombo)],
        ],
      });
    }

    if (game.debug) {
      // 검증용 창구: 상태 보기, 좋은 수와 나쁜 수 대신 두기, 칸의 화면 좌표
      const distAfter = (d) => {
        const t = P.tiles.slice();
        if (!Core.shift(t, P.n, d)) return Infinity;
        return P.n === 3 ? table[Core.rank9(t)] : Core.solve(t, P.n).length;
      };
      const cell = (i) => {
        const r = board.getBoundingClientRect();
        const s = pitch - (P.n === 4 ? 5 : 6);
        return { x: r.left + PAD + (i % P.n) * pitch + s / 2, y: r.top + PAD + ((i / P.n) | 0) * pitch + s / 2, size: s };
      };
      window.__game = {
        settings: S,
        core: Core,
        ready,
        state: () =>
          P && {
            stage: stageIdx, n: P.n, tiles: P.tiles.slice(), blank: P.tiles.indexOf(0), dist: P.dist, target: P.target,
            budget: P.budget, moves: P.moves, undos: P.undos, hints: P.hints, picture: !!P.pic, accepting, hintUsed,
            history: P.history.length, results: results.slice(),
          },
        cell,
        /** 가장 좋은 수: 빈칸 방향과 눌러야 할 칸 */
        best() {
          const d = P.guide.next(P.tiles);
          return d < 0 ? null : Object.assign({ d, idx: nextToBlank(d) }, cell(nextToBlank(d)));
        },
        /** 최소 수가 늘어나는 수 */
        worst() {
          const d = [0, 1, 2, 3].find((x) => nextToBlank(x) >= 0 && distAfter(x) > P.dist);
          return d === undefined ? null : Object.assign({ d, idx: nextToBlank(d) }, cell(nextToBlank(d)));
        },
        press,
        step,
        playBest: () => step(P.guide.next(P.tiles)),
        /** 나쁜 수를 둔다. 모든 수가 가까워지는 판이면 아무 수나 */
        playWorst() {
          const w = window.__game.worst();
          step(w ? w.d : [0, 1, 2, 3].find((x) => nextToBlank(x) >= 0));
        },
        undo,
        hint,
      };
    }

    runStage();
  }

  if (Arcade.debug) window.__game = { settings: S };

  Arcade.createGame({
    id: GAME_ID,
    title: '숫자 퍼즐',
    icon: '🧩',
    accent: '#4d8dff',
    accent2: '#36d6ff',
    tagline: '몇 번 만에 풀 수 있을까? 가장 적은 이동에 도전!',
    howTo: [
      '타일을 눌러 <b>빈칸</b>으로 밀어요. 같은 줄은 <b>한꺼번에</b> 밀려요',
      '한 수마다 <b>🔥&nbsp;따뜻해</b>(가까워짐), <b>❄️&nbsp;차가워</b>(멀어짐)를 알려 줘요',
      '<b>목표 수</b>에 가깝게 풀수록 별이 많아요. 이동 수에는 한도가 있어요',
    ],
    stages: STAGES.length,
    prepare: () => tableReady,
    start,
  });
})();
