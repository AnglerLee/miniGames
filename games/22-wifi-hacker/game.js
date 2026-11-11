// 와이파이 해커: 해커 침투 작전
// 신호를 쫓아 접속하고, 방화벽 회로를 잇고, 불빛 단서로 비밀번호를 추리한다.
// 3스테이지의 정답은 부모가 정한 비밀번호라서, 집 안에서 쪽지를 찾아오면 바로 풀 수 있다.
(function () {
  'use strict';

  // ============================================================ 순수 함수
  // 화면과 무관해서 Node 에서 require 로 불러 따로 검증할 수 있다.
  const DR = [-1, 0, 1, 0]; // 방향: 0 위, 1 오른쪽, 2 아래, 3 왼쪽
  const DC = [0, 1, 0, -1];
  const LINE = 5; // 열린 쪽 비트: 1 위, 2 오른쪽, 4 아래, 8 왼쪽. 직선은 위+아래
  const BEND = 3; // 꺾임: 위+오른쪽
  const TEE = 7; // 세 갈래: 위+오른쪽+아래
  const FULL = 0.8; // 신호 세기가 이 값 이상이면 막대 5칸(가득)

  function mix(list, rng) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const nfkc = (s) => {
    try {
      return String(s).normalize('NFKC');
    } catch (e) {
      return String(s);
    }
  };

  /** 열린 쪽을 시계 방향으로 k번(90°씩) 돌린다 */
  function turn(mask, k) {
    let m = mask & 15;
    for (let i = 0; i < ((k % 4) + 4) % 4; i++) m = ((m << 1) | (m >> 3)) & 15;
    return m;
  }

  /**
   * 워들식 판정. 자리마다 'hit'(숫자와 자리가 맞음), 'near'(숫자는 있지만 자리가 다름), 'miss'(없음).
   * 같은 숫자가 여러 번 나오면 정답에 있는 개수만큼만 hit/near 가 된다. hit 를 먼저 센다.
   */
  function judge(guess, answer) {
    const g = Array.from(String(guess));
    const a = Array.from(String(answer));
    const out = g.map(() => 'miss');
    const left = {};
    a.forEach((ch, i) => {
      if (g[i] === ch) out[i] = 'hit';
      else left[ch] = (left[ch] || 0) + 1;
    });
    g.forEach((ch, i) => {
      if (out[i] === 'hit' || !left[ch]) return;
      out[i] = 'near';
      left[ch]--;
    });
    return out;
  }

  /**
   * 부모의 비밀번호로 3스테이지 정답을 정한다.
   * 숫자 3~6자리면 그대로 정답. 아니면 임의의 숫자 4자리(서로 다름)를 풀고 마지막에 비밀번호를 직접 넣는다(final).
   */
  function codePlan(password, rng) {
    const raw = typeof password === 'string' || typeof password === 'number' ? String(password).trim() : '';
    const pw = raw || '1234';
    const ascii = nfkc(pw).trim(); // 전각 숫자 １２３４ 도 숫자로 본다
    if (/^\d{3,6}$/.test(ascii)) return { answer: ascii, len: ascii.length, final: null };
    const answer = mix(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], rng).slice(0, 4).join('');
    return { answer, len: 4, final: pw };
  }

  /** 최종 비밀번호 비교. 공백과 대소문자는 따지지 않는다 */
  const sameText = (a, b) => {
    const norm = (s) => nfkc(s).replace(/\s+/g, '').toLowerCase();
    return norm(a) !== '' && norm(a) === norm(b);
  };

  // 헷갈리는 글자 짝. 한 글자만 바꿔 "닮은 가짜"를 만든다
  const LOOK = {
    I: 'l1', l: 'I1', i: 'l1', 1: 'lI', O: '0Q', o: '0', 0: 'O', S: '5', s: '5', 5: 'S', B: '8', 8: 'B',
    E: '3', 3: 'E', A: '4', 4: 'A', Z: '2', 2: 'Z', G: '6', 6: 'G', T: '7', 7: 'T', g: '9', 9: 'g',
    _: '-.', '-': '_', '.': '_', ' ': '_', m: 'n', n: 'm', u: 'v', v: 'u', W: 'V', V: 'W',
  };
  const TAILS = ['_5G', '_2G', '2', '_EXT', '-GUEST', '_', '!'];
  const FAKE_NAMES = [
    'HOME_5G', 'CAFE_FREE', '옆집와이파이', 'Hotspot_7A2', 'NET_3F21', '아빠폰', 'GUEST_WIFI', 'PRINTER_01',
    'ROBOT_LAB', 'MOON_BASE', 'pizza_guest', 'TV_LIVING', '학원_WiFi', 'BUS_FREE', 'DRONE_CAM', 'LIBRARY_2F',
    '해적선_5G', 'X-NET', 'tiny_router', 'SPACE_STATION',
  ];

  /** 목표 이름과 닮은 가짜 이름 count 개. 헷갈리는 글자 한 개 바꾸기를 먼저 쓴다 */
  function lookalikes(name, count, rng) {
    const chars = Array.from(name);
    const swaps = [];
    chars.forEach((ch, i) => {
      for (const b of Array.from(LOOK[ch] || '')) swaps.push(chars.slice(0, i).concat(b, chars.slice(i + 1)).join(''));
    });
    const extra = TAILS.map((t) => name + t);
    for (let i = 0; i < chars.length; i++) extra.push(chars.slice(0, i + 1).concat(chars.slice(i)).join(''));
    for (let i = 0; i + 1 < chars.length; i++) {
      if (chars[i] === chars[i + 1]) continue;
      const c = chars.slice();
      [c[i], c[i + 1]] = [c[i + 1], c[i]];
      extra.push(c.join(''));
    }
    if (chars.length > 3) for (let i = 1; i < chars.length; i++) extra.push(chars.slice(0, i).concat(chars.slice(i + 1)).join(''));
    const out = [];
    for (const s of mix(swaps, rng).concat(mix(extra, rng))) {
      if (out.length >= count) break;
      if (s !== name && s.trim() && !out.includes(s)) out.push(s);
    }
    return out;
  }

  /** 와이파이 목록 한 판: 목표 1개 + 가짜 fakes 개(그중 닮은 이름 looks 개). 순서는 섞는다 */
  function makeRoster(target, fakes, looks, rng) {
    const names = lookalikes(target, Math.min(looks, fakes), rng);
    for (const n of mix(FAKE_NAMES, rng)) {
      if (names.length >= fakes) break;
      if (n !== target && !names.includes(n)) names.push(n);
    }
    let k = 1;
    while (names.length < fakes) names.push('NET_' + k++); // 이름 창고가 모자랄 일은 없지만 만약을 위해
    return mix([target].concat(names), rng);
  }

  /** 신호 세기 0~1. period 초마다 한 번 가득 차고, sharp 가 클수록 가득 찬 순간이 짧다 */
  const signalAt = (net, t) => Math.pow((1 + Math.sin((t / net.period) * Math.PI * 2 + net.phase)) / 2, net.sharp);
  const barsOf = (s) => (s >= FULL ? 5 : s >= 0.6 ? 4 : s >= 0.4 ? 3 : s >= 0.2 ? 2 : 1);

  function dirTo(n, i, j) {
    for (let d = 0; d < 4; d++) {
      const r = Math.floor(i / n) + DR[d];
      const c = (i % n) + DC[d];
      if (r >= 0 && r < n && c >= 0 && c < n && r * n + c === j) return d;
    }
    return -1;
  }

  /** from 에서 to 까지 겹치지 않는 무작위 길(칸 번호 목록). 길이는 minLen~maxLen */
  function randomPath(n, from, to, minLen, maxLen, rng) {
    const seen = new Array(n * n).fill(false);
    const path = [from];
    seen[from] = true;
    let budget = 3000;
    function dfs(i) {
      if (i === to) return path.length >= minLen;
      if (path.length >= maxLen || --budget <= 0) return false;
      for (const d of mix([0, 1, 2, 3], rng)) {
        const r = Math.floor(i / n) + DR[d];
        const c = (i % n) + DC[d];
        if (r < 0 || r >= n || c < 0 || c >= n || seen[r * n + c]) continue;
        const j = r * n + c;
        seen[j] = true;
        path.push(j);
        if (dfs(j)) return true;
        seen[j] = false;
        path.pop();
      }
      return false;
    }
    return dfs(from) ? path : null;
  }

  /** 칸을 몇 번 더 돌려야 정답 모양이 되는가 */
  function needTurns(cell) {
    for (let k = 0; k < 4; k++) if (turn(cell.base, cell.turns + k) === cell.mask) return k;
    return 0;
  }

  /**
   * 전기가 흐르는 칸을 찾는다. 전원은 (src, 0) 칸의 왼쪽, 출구는 (exit, n-1) 칸의 오른쪽.
   * 두 칸이 서로 마주 보고 열려 있어야 이어진다. 불이 들어온 칸이 경보 노드 쪽으로 열려 있으면 경보에 닿은 것.
   */
  function flow(b) {
    const { n, cells } = b;
    const lit = new Array(n * n).fill(false);
    const order = [];
    const alarms = new Set();
    let solved = false;
    const maskOf = (i) => (cells[i].alarm ? 0 : turn(cells[i].base, cells[i].turns));
    const first = b.src * n;
    if (!cells[first].alarm && maskOf(first) & 8) {
      lit[first] = true;
      order.push(first);
    }
    for (let q = 0; q < order.length; q++) {
      const i = order[q];
      const m = maskOf(i);
      for (let d = 0; d < 4; d++) {
        if (!(m & (1 << d))) continue;
        const r = Math.floor(i / n) + DR[d];
        const c = (i % n) + DC[d];
        if (r < 0 || r >= n || c < 0 || c >= n) {
          if (d === 1 && i === b.exit * n + n - 1) solved = true;
          continue;
        }
        const j = r * n + c;
        if (cells[j].alarm) alarms.add(j);
        else if (!lit[j] && maskOf(j) & (1 << ((d + 2) % 4))) {
          lit[j] = true;
          order.push(j);
        }
      }
    }
    return { lit, order, solved, alarms: Array.from(alarms) };
  }

  /**
   * 회로판을 만든다. 전원에서 출구까지 이어지는 길을 먼저 그리고, 길이 아닌 칸에 경보 노드와 미끼 회로를 채운 뒤
   * 길 위의 칸을 마구 돌려 놓는다. 길 위의 칸을 정답 모양으로 돌리면 반드시 풀리고, 그때는 경보에 닿지 않는다.
   */
  function makeCircuit(n, alarmCount, rng) {
    for (let attempt = 0; attempt < 400; attempt++) {
      const relax = attempt >= 200; // 혹시 오래 못 찾으면 조건을 푼다
      const src = Math.floor(rng() * n);
      const exit = Math.floor(rng() * n);
      const path = randomPath(n, src * n, exit * n + n - 1, relax ? n : n + 2, Math.floor(n * n * 0.6), rng);
      if (!path) continue;
      const cells = Array.from({ length: n * n }, () => ({ base: 0, turns: 0, mask: 0, alarm: false, onPath: false }));
      path.forEach((i, k) => {
        const a = k === 0 ? 3 : dirTo(n, i, path[k - 1]);
        const b = k === path.length - 1 ? 1 : dirTo(n, i, path[k + 1]);
        const cell = cells[i];
        cell.onPath = true;
        cell.mask = (1 << a) | (1 << b);
        cell.base = (a + 2) % 4 === b ? LINE : BEND;
      });
      const free = [];
      for (let i = 0; i < n * n; i++) if (!cells[i].onPath) free.push(i);
      // 경보 노드는 되도록 길 바로 옆에 둔다. 길 칸을 돌리다 보면 스칠 수 있어야 긴장이 생긴다
      const nearPath = (i) => [0, 1, 2, 3].some((d) => {
        const r = Math.floor(i / n) + DR[d];
        const c = (i % n) + DC[d];
        return r >= 0 && r < n && c >= 0 && c < n && cells[r * n + c].onPath;
      });
      const pool = mix(free.filter(nearPath), rng).concat(mix(free.filter((i) => !nearPath(i)), rng));
      pool.slice(0, relax ? 0 : alarmCount).forEach((i) => (cells[i].alarm = true));
      free.forEach((i) => {
        if (cells[i].alarm) return;
        const p = rng();
        cells[i].base = p < 0.3 ? LINE : p < 0.75 ? BEND : TEE;
        cells[i].turns = Math.floor(rng() * 4);
      });
      const board = { n, src, exit, cells, path, par: 0 };
      for (let s = 0; s < 60; s++) {
        path.forEach((i) => (cells[i].turns = Math.floor(rng() * 4)));
        const f = flow(board);
        const wrong = path.filter((i) => needTurns(cells[i]) > 0).length;
        const par = path.reduce((sum, i) => sum + needTurns(cells[i]), 0);
        // 너무 쉽거나(대부분 맞아 있음) 너무 길면(시간 안에 못 돌림) 다시 섞는다
        if (!f.solved && f.alarms.length === 0 && wrong >= Math.ceil(path.length * 0.6) && par <= n * 4) {
          board.par = par;
          return board;
        }
      }
    }
    return null;
  }

  const Core = { FULL, turn, judge, codePlan, sameText, lookalikes, makeRoster, signalAt, barsOf, flow, needTurns, makeCircuit };
  if (typeof module === 'object' && module.exports) {
    module.exports = Core;
    return;
  }

  // ============================================================ 게임
  const { h, rand, clamp, sfx, fx, audio } = Arcade;
  const GAME_ID = 'game22';
  const TAU = Math.PI * 2;

  // ----- 설정 (관리자 페이지와 같은 키 game22_config. 부모가 정한 세 값도 여기에 있다)
  const PRESETS = [
    { signalTime: 40, fakeCount: 4, lookalikes: 1, firewallTime: 50, gridSize: 4, alarms: 1, decodeTime: 120, attempts: 8 },
    { signalTime: 35, fakeCount: 5, lookalikes: 2, firewallTime: 45, gridSize: 5, alarms: 2, decodeTime: 100, attempts: 7 },
    { signalTime: 30, fakeCount: 6, lookalikes: 3, firewallTime: 40, gridSize: 5, alarms: 3, decodeTime: 80, attempts: 6 },
  ];
  const LIMITS = {
    signalTime: [15, 120], fakeCount: [2, 6], lookalikes: [0, 6], firewallTime: [15, 150],
    gridSize: [4, 5], alarms: [0, 4], decodeTime: [30, 300], attempts: [3, 12],
  };
  const saved = Arcade.loadSettings('game22_config', {});
  const level = clamp(parseInt(saved.difficulty, 10) || 0, 0, 2);
  const S = Object.assign({}, PRESETS[level]);
  Object.keys(LIMITS).forEach((key) => {
    const raw = saved[key];
    if (raw === null || raw === undefined || raw === '' || typeof raw === 'boolean') return;
    const v = Number(raw);
    if (Number.isFinite(v)) S[key] = clamp(Math.round(v), LIMITS[key][0], LIMITS[key][1]);
  });
  const textOf = (v, fallback) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '') || fallback;
  const MISSION = textOf(saved.missionGoal, '🎯 목표: Wi-Fi 비밀번호를 찾아라!');
  const TARGET = Array.from(textOf(saved.targetName, 'SECRET_BASE_WIFI')).slice(0, 28).join('').trim() || 'SECRET_BASE_WIFI';
  const PASSWORD = textOf(saved.password, '1234');
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

  const STAGES = [
    { name: '신호 추적', goal: () => '목표 신호가 <b>가득</b> 찰 때 눌러 접속!', banner: ['1 · 신호 추적', '이름을 잘 보고, 막대가 가득 찰 때!'] },
    { name: '방화벽', goal: () => '회로를 돌려 <b>⚡</b>에서 <b>서버</b>까지 이어라', banner: ['2 · 방화벽', '🚨 경보에 전기가 닿으면 들킨다'] },
    { name: '암호 해독', goal: (len) => `불빛 단서로 <b>비밀번호 ${len}자리</b>를 맞혀라`, banner: ['3 · 암호 해독', '초록은 자리까지, 노랑은 숫자만 맞음'] },
  ];
  const DECAY = 0.04; // 1·2스테이지: 1초에 줄어드는 탐지
  const ALARM_RATE = 0.5; // 경보 노드에 닿아 있는 동안 1초에 오르는 탐지
  const GRACE = 0.12; // 막 가득 찼다가 내려간 직후의 누름도 봐준다(초)
  const GUESS_BONUS = [0, 1500, 1000, 600, 300, 150]; // 해독 시도 횟수별 보너스

  // "딩-동!" 맞혔을 때의 소리
  const ding = () => {
    audio.tone({ freq: 1568, type: 'sine', dur: 0.32, vol: 0.26 });
    audio.tone({ freq: 1175, type: 'sine', dur: 0.7, vol: 0.26, delay: 0.24 });
  };

  // ----- 배경: 흘러내리는 숫자 비. 게임 시계로 그려서 멈추면 함께 멈춘다
  const matrix = (() => {
    const cv = h('canvas', { class: 'wh-matrix', 'aria-hidden': 'true' });
    document.body.insertBefore(cv, document.body.firstChild);
    const ctx = cv.getContext ? cv.getContext('2d') : null;
    const SIZE = 16;
    const GLYPHS = '0123456789ABCDEF#$%<>/';
    let drops = [];
    let acc = 0;
    function fit() {
      cv.width = Math.max(1, window.innerWidth);
      cv.height = Math.max(1, window.innerHeight);
      drops = Array.from({ length: Math.ceil(cv.width / SIZE) }, () => -Math.random() * 40);
    }
    return {
      reset: () => ctx && fit(),
      step(dt, heat) {
        if (!ctx) return;
        if (cv.width !== window.innerWidth || cv.height !== window.innerHeight) fit();
        acc += dt;
        if (acc < 0.055) return;
        acc = 0;
        ctx.globalCompositeOperation = 'destination-out'; // 지난 글자를 조금씩 지워 꼬리를 만든다
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.globalCompositeOperation = 'source-over';
        ctx.font = `bold ${SIZE - 2}px ui-monospace, Menlo, monospace`;
        ctx.fillStyle = heat >= 0.7 ? '#ff5d73' : heat >= 0.4 ? '#ffc93c' : '#2fd17a';
        const rows = cv.height / SIZE;
        for (let i = 0; i < drops.length; i++) {
          const y = drops[i];
          if (y >= 0) ctx.fillText(GLYPHS[Math.floor(Math.random() * GLYPHS.length)], i * SIZE + 2, y * SIZE);
          drops[i] = y > rows && Math.random() > 0.95 ? -Math.random() * 20 : y + 1;
        }
      },
    };
  })();

  /** 회로 칸 그림. 가운데에서 열린 쪽 가장자리까지 선을 긋는다 */
  function tileSvg(mask) {
    const ends = [[50, 0], [100, 50], [50, 100], [0, 50]];
    let d = '';
    for (let k = 0; k < 4; k++) if (mask & (1 << k)) d += `M50 50L${ends[k][0]} ${ends[k][1]}`;
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><path class="c" d="${d}"/><path class="w" d="${d}"/><circle cx="50" cy="50" r="11"/></svg>`;
  }

  function start(game) {
    const rng = Math.random;
    const easy = Math.min(game.retry, 3); // 재도전할수록 조금씩 쉬워진다
    const plan = codePlan(PASSWORD, rng); // 3스테이지 정답(재도전하면 임의 번호는 새로 뽑는다)
    let stageIdx = game.checkpoint;
    let stage = null; // 지금 스테이지의 조작 창구
    let busy = true; // 안내 띠나 연출 중에는 입력을 받지 않는다
    let detect = 0; // 탐지 게이지 0~1
    let timer = null;
    let hintUsed = false;
    let guesses = 0; // 3스테이지에서 해킹을 누른 횟수
    let moves = -1; // 방화벽에서 돌린 횟수. 이번 판에 방화벽을 안 했으면 -1

    // ----- 공통 화면: 탐지 게이지와 스테이지 판
    const detFill = h('i');
    const detText = h('b', { class: 'wh-det-num', text: '0%' });
    const detBox = h('div', { class: 'wh-detect' }, [
      h('span', { class: 'wh-det-icon', text: '👁' }),
      h('span', { class: 'wh-det-label', text: '탐지' }),
      h('div', { class: 'wh-det-bar' }, detFill),
      detText,
    ]);
    const board = h('div', { class: 'wh-board' });
    game.root.append(detBox, board);
    matrix.reset();

    function paintDetect() {
      detFill.style.transform = `scaleX(${detect})`;
      detBox.classList.toggle('mid', detect >= 0.4 && detect < 0.7);
      detBox.classList.toggle('hot', detect >= 0.7);
      detText.textContent = stage && stage.label ? stage.label() : Math.round(detect * 100) + '%';
    }

    function setDetect(v) {
      if (!game.playing) return;
      const before = detect;
      detect = clamp(v, 0, 1);
      if (before < 0.7 && detect >= 0.7 && detect < 1) sfx('warn');
      if (detect >= 1) caught();
      else paintDetect();
    }

    /** 탐지 게이지가 가득 찼다: 하트 -1, 게이지는 비운다 */
    function caught() {
      detect = 0;
      paintDetect();
      sfx('zap');
      if (game.loseLife(detBox) <= 0) {
        busy = true;
        game.lose({ title: '추적당했다!', icon: '🚨', message: `${STAGES[stageIdx].name}에서 정체가 들통났어요.`, checkpoint: stageIdx });
        return;
      }
      fx.toast('🚨 추적당했다! 하트 -1', { kind: 'bad', ms: 1300 });
      if (stage && stage.onCaught) stage.onCaught();
      paintDetect();
    }

    function timeUp() {
      if (!game.playing) return;
      busy = true;
      game.lose({ title: '시간 초과!', icon: '⌛', message: `${STAGES[stageIdx].name}에서 시간이 다 됐어요.`, checkpoint: stageIdx });
    }

    async function runStage() {
      busy = true;
      stage = null;
      detect = 0;
      board.innerHTML = '';
      game.footer.innerHTML = '';
      detBox.classList.remove('seg');
      board.className = 'wh-board s' + (stageIdx + 1);
      game.setStage(stageIdx, STAGES.length);
      const info = STAGES[stageIdx];
      game.setGoal(info.goal(plan.len));
      stage = [signalStage, firewallStage, decodeStage][stageIdx]();
      paintDetect();
      await game.banner(info.banner[0], info.banner[1], { ms: 1500 });
      stage.begin();
      busy = false;
    }

    async function stageClear() {
      busy = true;
      const left = game.timeLeft();
      game.stopTimer();
      const bonus = Math.round(left) * [5, 8, 5][stageIdx];
      if (bonus > 0) game.addScore(bonus, detBox);
      sfx('stage');
      fx.confetti(30);
      if (stageIdx >= STAGES.length - 1) {
        await game.wait(900);
        finish();
        return;
      }
      fx.toast(`${STAGES[stageIdx].name} 돌파! 남은 시간 +${bonus}`, { kind: 'good', ms: 1100 });
      await game.wait(1000);
      stageIdx++;
      runStage();
    }

    function finish() {
      const lost = game.config.lives - game.lives;
      let stars = lost === 0 && guesses <= plan.len + 1 ? 3 : lost <= 1 ? 2 : 1;
      if (game.retry > 0 || hintUsed) stars = Math.min(stars, 2);
      const tip =
        stars === 3 ? '들키지 않고 단숨에 뚫었어요. 최고의 해커!'
          : hintUsed ? '엿보기 없이 풀면 별 3개도 가능해요.'
            : lost === 0 ? `${plan.len + 1}번 안에 해독하면 별 3개!`
              : '하트를 지키면 별이 늘어나요.';
      game.win({
        stars,
        title: '해킹 성공!',
        message: `<b>${esc(TARGET)}</b> 접속 완료!<br>${tip}`,
        stats: [
          ['해독 시도', `${guesses}번`],
          ['잃은 하트', `${lost}개`],
          ['방화벽 회전', moves >= 0 ? `${moves}번` : '—'],
          ['엿보기', hintUsed ? '썼어요' : '안 썼어요'],
        ],
      });
    }

    // ============================================================ 1. 신호 추적
    function signalStage() {
      const NEED = 3;
      const fakes = Math.max(2, S.fakeCount - easy);
      const looks = Math.min(fakes, Math.max(0, S.lookalikes - (easy >= 2 ? 1 : 0)));
      const sharp = Math.max(1, [1, 1.4, 1.8][level] - easy * 0.3);
      const period = [3.3, 2.9, 2.5][level] + easy * 0.25;
      let got = 0;
      let nets = [];
      let lockUntil = 0;
      let slips = 0;

      const dots = h('div', { class: 'wh-dots' }, Array.from({ length: NEED }, () => h('i')));
      board.append(
        h('div', { class: 'wh-target' }, [
          h('div', { class: 'wh-target-top' }, [h('span', { class: 'ar-label', text: '📡 목표 네트워크' }), dots]),
          h('div', { class: 'wh-target-name', text: TARGET }),
        ])
      );
      const list = h('div', { class: 'wh-list' });
      board.append(h('div', { class: 'wh-radar', 'aria-hidden': 'true' }, [h('i'), h('span', { text: 'SCANNING' })]), list);

      /** 목표가 delay 초 뒤 처음 가득 차도록 맞춘다 */
      function retime(net, delay) {
        net.phase = Math.PI / 2 - (TAU * (game.time + delay)) / net.period;
      }

      function deal() {
        const names = makeRoster(TARGET, fakes, got === 0 ? 0 : looks, rng); // 첫 접속은 닮은 이름 없이
        list.innerHTML = '';
        nets = names.map((name, k) => {
          const isTarget = name === TARGET;
          const net = {
            name, isTarget, s: 0, bars: 0, lastFull: -9,
            period: isTarget ? period * rand(0.92, 1.08) : period * rand(0.7, 1.4),
            phase: rand(0, TAU),
            sharp: isTarget ? sharp : sharp * rand(0.85, 1.2),
          };
          if (isTarget) retime(net, rand(0.9, 0.9 + net.period * 0.7));
          net.barEls = Array.from({ length: 5 }, () => h('i'));
          net.el = h('button', { class: 'wh-net', style: { animationDelay: k * 45 + 'ms' } }, [
            h('span', { class: 'wh-bars' }, net.barEls),
            h('span', { class: 'wh-net-name' + (Array.from(name).length > 18 ? ' long' : ''), text: name }),
            h('span', { class: 'wh-net-lock', text: '🔒' }),
          ]);
          net.el.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            tap(net);
          });
          list.appendChild(net.el);
          return net;
        });
        paint(game.time);
      }

      function paint(t) {
        nets.forEach((net) => {
          net.s = signalAt(net, t);
          const b = barsOf(net.s);
          if (b === 5) net.lastFull = t;
          if (b === net.bars) return;
          net.bars = b;
          net.barEls.forEach((el, i) => el.classList.toggle('on', i < b));
          net.el.classList.toggle('full', b === 5);
        });
      }

      function flick(el, cls) {
        el.classList.remove('ok', 'wrong');
        void el.offsetWidth;
        el.classList.add(cls);
      }

      function tap(net) {
        if (busy || !game.playing || game.time < lockUntil) return;
        const full = net.bars === 5 || game.time - net.lastFull <= GRACE;
        if (net.isTarget && full) return connect(net);
        slips++;
        lockUntil = game.time + 0.35;
        flick(net.el, 'wrong');
        if (net.isTarget) {
          sfx('miss');
          fx.toast('신호가 약해! <b>가득</b> 찰 때 눌러', { kind: 'bad', ms: 1000 });
          setDetect(detect + 0.25);
        } else {
          sfx('bad');
          fx.shake(net.el, 6);
          fx.toast('가짜 와이파이! 이름을 잘 봐', { kind: 'bad', ms: 1000 });
          setDetect(detect + 0.4);
        }
      }

      async function connect(net) {
        busy = true;
        got++;
        const perfect = net.s >= 0.97;
        flick(net.el, 'ok');
        dots.children[got - 1].classList.add('on');
        game.addScore(150 + (perfect ? 50 : 0), net.el);
        fx.burst(net.el, { count: 12, spread: 90, colors: ['#2fd17a', '#36d6ff', '#ffffff'] });
        if (got >= NEED) {
          sfx('unlock');
          if (slips === 0) game.addScore(200, list);
          fx.toast(slips === 0 ? '접속 성공! 실수 없이 +200' : '접속 성공!', { kind: 'good' });
          await game.wait(500);
          stageClear();
          return;
        }
        sfx('good');
        fx.toast(perfect ? `정확해! 연결 ${got}/${NEED}` : `연결 ${got}/${NEED}! 다시 스캔`, { kind: perfect ? 'gold' : 'good', ms: 900 });
        await game.wait(750);
        deal();
        busy = false;
      }

      deal();
      return {
        begin() {
          const net = nets.find((x) => x.isTarget);
          retime(net, rand(0.8, 1.6)); // 안내 띠가 끝난 뒤 곧 첫 기회가 온다
          timer = game.startTimer(S.signalTime + easy * 6, { onEnd: timeUp, warnAt: 8 });
        },
        tick(dt, t) {
          paint(t);
          if (!busy && detect > 0) setDetect(detect - DECAY * dt);
        },
        onCaught() {
          lockUntil = game.time + 0.9;
          deal();
        },
        debug: {
          nets: () => nets.map((x) => ({ name: x.name, target: x.isTarget, s: x.s, bars: x.bars })),
          tap: (i) => tap(nets[i]),
          hit: () => !busy && game.playing && connect(nets.find((x) => x.isTarget)),
          got: () => got,
        },
      };
    }

    // ============================================================ 2. 방화벽
    function firewallStage() {
      const n = S.gridSize >= 5 && easy < 2 ? 5 : 4;
      const c = makeCircuit(n, Math.max(0, S.alarms - easy), rng);
      const goalTurns = c.par + 2;
      let used = 0;
      let lastLit = 0;
      let hot = [];
      let touched = false;
      let beepAt = 0;
      let graceUntil = 0;
      moves = 0;

      const ports = {};
      const grid = h('div', { class: 'wh-grid', style: { '--n': n } });
      for (let row = 0; row < n; row++) {
        const left = h('div', { class: 'wh-port' + (row === c.src ? ' src' : ''), text: row === c.src ? '⚡' : '' });
        grid.appendChild(left);
        if (row === c.src) ports.src = left;
        for (let col = 0; col < n; col++) {
          const i = row * n + col;
          const cell = c.cells[i];
          if (cell.alarm) {
            cell.el = h('div', { class: 'wh-tile alarm', html: '<span>🚨</span>' });
          } else {
            cell.el = h('button', { class: 'wh-tile', html: tileSvg(cell.base), 'aria-label': '회로 돌리기' });
            cell.svg = cell.el.firstChild;
            cell.svg.style.transform = `rotate(${cell.turns * 90}deg)`;
            cell.el.addEventListener('pointerdown', (e) => {
              e.preventDefault();
              spin(i);
            });
          }
          grid.appendChild(cell.el);
        }
        const right = h('div', { class: 'wh-port' + (row === c.exit ? ' exit' : ''), text: row === c.exit ? '🖥️' : '' });
        grid.appendChild(right);
        if (row === c.exit) ports.exit = right;
      }
      const chip = h('div', { class: 'ar-chip wh-moves' });
      const tip = h('div', { class: 'wh-tip', text: '칸을 누르면 돌아가요 · 🚨에 전기가 닿아 있으면 탐지 ↑' });
      board.append(tip, grid, chip);

      function refresh(silent) {
        const f = flow(c);
        let count = 0;
        const hotSet = new Set(f.alarms);
        c.cells.forEach((cell, i) => {
          if (cell.alarm) cell.el.classList.toggle('hot', hotSet.has(i));
          else {
            cell.el.classList.toggle('lit', f.lit[i]);
            if (f.lit[i]) count++;
          }
        });
        hot = f.alarms;
        ports.src.classList.toggle('lit', count > 0);
        if (!silent && count > lastLit) audio.tone({ freq: 330 + count * 45, type: 'triangle', dur: 0.09, vol: 0.14 });
        lastLit = count;
        chip.innerHTML = `회전 <b>${used}</b> · 보너스 기준 ${goalTurns}번`;
        chip.classList.toggle('over', used > goalTurns);
        return f;
      }

      function spin(i) {
        if (busy || !game.playing) return;
        const cell = c.cells[i];
        cell.turns++;
        used++;
        moves++;
        cell.svg.style.transform = `rotate(${cell.turns * 90}deg)`;
        sfx('tap');
        const f = refresh(false);
        if (f.solved) breach(f);
      }

      async function breach(f) {
        busy = true;
        game.stopTimer();
        sfx('power');
        ports.exit.classList.add('lit');
        for (const i of f.order) {
          c.cells[i].el.classList.add('surge');
          await game.wait(40);
        }
        const tidy = used <= goalTurns;
        const bonus = 300 + (tidy ? 200 : 0) + (touched ? 0 : 100);
        game.addScore(bonus, grid);
        fx.burst(ports.exit, { count: 16, spread: 100, colors: ['#2fd17a', '#36d6ff', '#ffffff'] });
        fx.toast(tidy ? '방화벽 해제! 최소 회전 보너스' : '방화벽 해제!', { kind: tidy ? 'gold' : 'good', ms: 1000 });
        await game.wait(500);
        stageClear();
      }

      refresh(true);
      return {
        begin() {
          timer = game.startTimer(S.firewallTime + easy * 8, { onEnd: timeUp, warnAt: 10 });
        },
        tick(dt, t) {
          if (busy) return;
          if (hot.length && t >= graceUntil) {
            touched = true;
            setDetect(detect + ALARM_RATE * dt);
            if (t >= beepAt) {
              beepAt = t + 0.35;
              audio.tone({ freq: 1250, type: 'square', dur: 0.06, vol: 0.08 });
            }
          } else if (detect > 0) setDetect(detect - DECAY * dt);
        },
        onCaught() {
          graceUntil = game.time + 1.5; // 숨 돌릴 틈
        },
        debug: {
          board: () => ({ n, src: c.src, exit: c.exit, par: c.par, path: c.path.slice(), cells: c.cells.map((x) => ({ base: x.base, turns: x.turns % 4, mask: x.mask, alarm: x.alarm, onPath: x.onPath })) }),
          spin,
          /** 길 위의 칸을 정답 모양까지 실제 누름과 같은 방법으로 돌린다 */
          solve() {
            for (const i of c.path) {
              while (!busy && needTurns(c.cells[i]) > 0) spin(i);
            }
          },
          hot: () => hot.slice(),
        },
      };
    }

    // ============================================================ 3. 암호 해독
    function decodeStage() {
      const len = plan.len;
      const maxTry = S.attempts + easy;
      const RANK = { miss: 1, near: 2, hit: 3 };
      const known = {}; // 숫자마다 지금까지 가장 좋은 판정
      const hitAt = new Array(len).fill(false);
      let used = 0; // 이번 기회 묶음에서 쓴 횟수
      let entry = [];
      let peek = -1;
      let finalMode = false;
      let finalMiss = 0;
      let finalInput = null;
      let finalHint = null;

      detBox.classList.add('seg');
      detBox.style.setProperty('--seg', maxTry);

      const legend = h('div', {
        class: 'wh-legend',
        html: '<span><i class="hit"></i>자리·숫자 맞음</span><span><i class="near"></i>숫자만 맞음</span><span><i class="miss"></i>없음</span>',
      });
      const fold = h('div', { class: 'wh-fold ar-hidden' });
      const empty = h('div', { class: 'wh-log-empty', text: `숫자 ${len}개를 넣고 해킹!` });
      const log = h('div', { class: 'wh-log' }, [h('div', { class: 'wh-log-space' }), fold, empty]);
      const slots = Array.from({ length: len }, () => h('div', { class: 'wh-slot' }));
      const slotRow = h('div', { class: 'wh-slots', style: { '--len': len } }, slots);
      board.append(legend, log, slotRow);

      const keys = {};
      const pad = h('div', { class: 'wh-pad' });
      const bind = (el, k) => {
        el.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          press(k);
        });
        pad.appendChild(el);
        return el;
      };
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].forEach((d) => (keys[d] = bind(h('button', { class: 'wh-key', text: d }), d)));
      const peekBtn = bind(h('button', { class: 'wh-key fn peek', text: '🔍 엿보기' }), 'peek');
      bind(h('button', { class: 'wh-key fn', text: '⌫', 'aria-label': '지우기' }), 'del');
      const goBtn = bind(h('button', { class: 'ar-btn wh-go', text: '해킹 ▶' }), 'go');
      game.footer.appendChild(pad);

      function render() {
        slots.forEach((el, i) => {
          el.textContent = entry[i] !== undefined ? entry[i] : '';
          el.classList.toggle('cur', i === entry.length);
          el.classList.toggle('filled', entry[i] !== undefined);
        });
        if (peek >= 0) slots[peek].dataset.peek = plan.answer[peek];
        goBtn.classList.toggle('wait', entry.length < len);
      }

      /** 지난 시도가 넘치면 오래된 것부터 접는다 */
      function fitLog() {
        const rows = Array.from(log.querySelectorAll('.wh-row'));
        rows.forEach((r) => r.classList.remove('gone'));
        fold.classList.add('ar-hidden');
        let k = 0;
        while (log.scrollHeight > log.clientHeight + 1 && k < rows.length - 1) {
          rows[k++].classList.add('gone');
          fold.textContent = `▲ 지난 시도 ${k}개 접힘`;
          fold.classList.remove('ar-hidden');
        }
      }

      function press(k) {
        if (busy || !game.playing || finalMode) return;
        if (k === 'go') return submit();
        if (k === 'peek') return usePeek();
        if (k === 'del') {
          if (!entry.length) return;
          entry.pop();
          sfx('tap');
        } else {
          if (entry.length >= len) {
            fx.shake(slotRow, 4);
            return;
          }
          entry.push(k);
          audio.tone({ freq: 600 + Number(k) * 40, type: 'square', dur: 0.05, vol: 0.08 });
        }
        render();
      }

      function usePeek() {
        if (hintUsed) {
          fx.toast('엿보기는 한 판에 한 번!', { ms: 900 });
          return;
        }
        const pool = [];
        for (let i = 0; i < len; i++) if (!hitAt[i]) pool.push(i);
        peek = pool.length ? pool[Math.floor(rng() * pool.length)] : 0;
        hintUsed = true;
        peekBtn.classList.add('used');
        sfx('coin');
        fx.toast(`엿보기: ${peek + 1}번째 숫자는 <b>${plan.answer[peek]}</b>`, { kind: 'gold', ms: 1800 });
        render();
      }

      async function submit() {
        if (entry.length < len) {
          fx.shake(slotRow, 5);
          sfx('miss');
          fx.toast(`숫자 ${len}개를 다 넣어`, { ms: 900 });
          return;
        }
        busy = true;
        if (timer) timer.pause(); // 불빛이 켜지는 동안은 시간을 재지 않는다
        const guess = entry.join('');
        const res = judge(guess, plan.answer);
        guesses++;
        used++;
        entry = [];
        render();
        empty.remove();
        const cells = Array.from(guess).map((d) => h('span', { class: 'c', text: d }));
        const row = h('div', { class: 'wh-row' }, [h('span', { class: 'n', text: '#' + guesses }), h('span', { class: 'cs' }, cells)]);
        log.appendChild(row);
        fitLog();
        sfx('whoosh');
        for (let i = 0; i < cells.length; i++) {
          await game.wait(130);
          cells[i].classList.add(res[i]);
          audio.tone({ freq: res[i] === 'hit' ? 1047 : res[i] === 'near' ? 784 : 262, type: 'triangle', dur: 0.1, vol: 0.16 });
          if (res[i] === 'hit') hitAt[i] = true;
          if (!known[guess[i]] || RANK[res[i]] > RANK[known[guess[i]]]) known[guess[i]] = res[i];
        }
        Object.keys(keys).forEach((d) => (keys[d].className = 'wh-key' + (known[d] ? ' ' + known[d] : '')));
        if (res.every((x) => x === 'hit')) {
          cracked(row);
          return;
        }
        if (timer) timer.resume();
        fx.shake(row, 4);
        setDetect(used / maxTry); // 기회를 다 쓰면 탐지 게이지가 가득 찬다
        busy = false;
      }

      async function cracked(row) {
        row.classList.add('win');
        ding();
        fx.flash('rgba(47,209,122,.3)');
        slots.forEach((el, i) => {
          el.textContent = plan.answer[i];
          el.classList.add('open');
        });
        fx.burst(slotRow, { count: 26, spread: 150, colors: ['#2fd17a', '#36d6ff', '#ffd166', '#ffffff'] });
        game.addScore(500 + (GUESS_BONUS[guesses] || 0) + (maxTry - used) * 50, slotRow);
        fx.toast(guesses === 1 ? '딩동! 한 번에 뚫었다!' : guesses === 2 ? '딩동! 단 두 번 만에!' : '딩동! 암호 해독!', { kind: guesses <= 2 ? 'gold' : 'good', ms: 1400 });
        await game.wait(1300);
        if (plan.final) startFinal();
        else stageClear();
      }

      // 비밀번호가 숫자 3~6자리가 아닐 때: 해독 뒤에 진짜 비밀번호를 직접 넣는다
      function startFinal() {
        finalMode = true;
        api.label = null;
        detBox.classList.remove('seg');
        detect = 0;
        paintDetect();
        game.setGoal('마지막 관문: <b>진짜 비밀번호</b>를 넣어라');
        finalInput = h('input', {
          class: 'ar-input wh-final-input', type: 'text', maxlength: 40, autocomplete: 'off', autocapitalize: 'off',
          spellcheck: 'false', placeholder: '비밀번호', inputmode: /^\d+$/.test(nfkc(plan.final)) ? 'numeric' : 'text',
        });
        finalHint = h('div', { class: 'wh-final-hint', text: '틀리면 한 글자씩 힌트가 열려요' });
        board.innerHTML = '';
        board.append(
          h('div', { class: 'wh-final' }, [
            h('div', { class: 'wh-final-icon', text: '🔑' }),
            h('div', { class: 'wh-final-name', text: TARGET }),
            h('p', { text: '부모님이 정한 와이파이 비밀번호' }),
            finalInput,
            finalHint,
          ])
        );
        game.footer.innerHTML = '';
        game.footer.appendChild(h('button', { class: 'ar-btn lg', text: '접속 ▶', onclick: () => tryFinal() }));
        finalInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            tryFinal();
          }
        });
        timer.add(15);
        timer.resume();
        busy = false;
      }

      function tryFinal(text) {
        if (busy || !game.playing || !finalMode) return;
        const v = typeof text === 'string' ? text : finalInput.value;
        if (!v.trim()) {
          fx.shake(finalInput, 5);
          return;
        }
        if (sameText(v, plan.final)) {
          busy = true;
          finalInput.blur();
          ding();
          fx.burst(finalInput, { count: 20, spread: 120 });
          game.addScore(300, finalInput);
          stageClear();
          return;
        }
        finalMiss++;
        sfx('bad');
        fx.shake(finalInput, 8);
        finalInput.value = '';
        const chars = Array.from(plan.final);
        finalHint.textContent = '힌트: ' + chars.map((ch, i) => (i < finalMiss ? ch : '○')).join('');
        fx.toast('접속 거부!', { kind: 'bad', ms: 900 });
        setDetect(detect + 0.34);
      }

      render();
      const api = {
        label: () => `기회 ${maxTry - used}`,
        begin() {
          timer = game.startTimer(S.decodeTime + easy * 15, { onEnd: timeUp, warnAt: 15 });
          game.on(window, 'resize', fitLog);
          game.on(window, 'keydown', (e) => {
            if (finalMode) return;
            if (/^[0-9]$/.test(e.key)) press(e.key);
            else if (e.key === 'Backspace') press('del');
            else if (e.key === 'Enter') press('go');
          });
        },
        onCaught() {
          used = 0;
          if (!finalMode) game.after(1400, () => fx.toast(`새 우회로 확보! 기회 ${maxTry}번`, { kind: 'gold', ms: 1200 }));
        },
        debug: {
          answer: () => plan.answer,
          final: () => plan.final,
          len,
          maxTry,
          used: () => used,
          finalMode: () => finalMode,
          press,
          /** 숫자를 실제 키와 같은 길로 넣고 해킹을 누른다. 불빛이 다 켜지면 끝나는 Promise */
          guess(code) {
            entry = [];
            for (const ch of String(code)) press(ch);
            return submit();
          },
          tryFinal: (t) => tryFinal(t),
          keyState: (d) => known[d] || null,
          folded: () => log.querySelectorAll('.wh-row.gone').length,
        },
      };
      return api;
    }

    // 매 프레임: 배경 비와 지금 스테이지
    game.loop((dt, t) => {
      matrix.step(dt, detect);
      if (stage && stage.tick) stage.tick(dt, t);
    });

    if (game.debug) {
      // 검증용 창구
      window.__game = {
        core: Core,
        plan: () => Object.assign({}, plan),
        settings: () => Object.assign({}, S, { level, target: TARGET, password: PASSWORD, mission: MISSION }),
        state: () => ({ stage: stageIdx, busy, detect, lives: game.lives, hintUsed, guesses, moves, timeLeft: game.timeLeft(), ready: !!stage && !busy && game.playing }),
        /** 지금 스테이지의 조작 창구 */
        s: () => (stage ? stage.debug : null),
        /** 탐지 게이지를 가득 채운다(하트 -1) */
        alarm: () => setDetect(1),
      };
    }

    runStage();
  }

  Arcade.createGame({
    id: GAME_ID,
    title: '와이파이 해커',
    icon: '📡',
    accent: '#2fd17a',
    accent2: '#36d6ff',
    tagline: esc(MISSION),
    howTo: [
      '<b>신호 추적</b>: 진짜 이름을 찾아 신호가 <b>가득</b> 찰 때 눌러요',
      '<b>방화벽</b>: 회로를 돌려 ⚡에서 서버까지 전기를 이어요',
      '<b>암호 해독</b>: <i class="wh-dot hit"></i>자리까지 <i class="wh-dot near"></i>숫자만 맞음. 틀리면 👁 탐지!',
    ],
    lives: 3,
    stages: STAGES.length,
    startLabel: '해킹 시작!',
    start,
  });
})();
