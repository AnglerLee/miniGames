// 미로 탈출: 열쇠를 모아 탈출하라
// 어느 열쇠부터 갈지 고르고, 어둠 속을 더듬고, 뒤쫓는 유령을 따돌린다.
(function () {
  'use strict';

  // ============================================================ 미로 (순수 함수)
  // 화면과 무관해서 Node 에서 require 로 불러 수백 번 돌려 볼 수 있다.
  const DX = [0, 1, 0, -1]; // 방향: 0 위, 1 오른쪽, 2 아래, 3 왼쪽
  const DY = [-1, 0, 1, 0];
  const SIZES = [[7, 9], [9, 11], [11, 13], [13, 15]]; // 가로×세로 칸 수

  const canGo = (m, i, d) => (m.open[i] >> d) & 1;
  const step = (m, i, d) => i + DX[d] + DY[d] * m.w;
  const ways = (m, i) => canGo(m, i, 0) + canGo(m, i, 1) + canGo(m, i, 2) + canGo(m, i, 3);
  const pickOne = (list, rng) => list[Math.floor(rng() * list.length)];

  function inside(m, i, d) {
    const x = (i % m.w) + DX[d];
    const y = Math.floor(i / m.w) + DY[d];
    return x >= 0 && y >= 0 && x < m.w && y < m.h;
  }

  function carve(m, i, d) {
    m.open[i] |= 1 << d;
    m.open[step(m, i, d)] |= 1 << ((d + 2) % 4);
  }

  /** i 칸의 d 쪽 벽을 헐면 2×2 빈 방이 생기는가. 방이 생기면 길이 아니라 광장이 된다 */
  function makesRoom(m, i, d) {
    const j = step(m, i, d);
    return [(d + 1) % 4, (d + 3) % 4].some(
      (s) => inside(m, i, s) && canGo(m, i, s) && canGo(m, j, s) && canGo(m, step(m, i, s), d)
    );
  }

  /**
   * 미로를 만든다. DFS 로 모든 칸을 잇고, 벽을 더 헐어 순환로를 만든다.
   * 막다른 길만 있으면 유령을 피할 곳이 없으므로 막다른 칸의 벽을 먼저 헌다.
   * loops: 칸 수 대비 더 허무는 벽의 비율. 돌려주는 값: { w, h, open[칸] = 열린 방향 비트 }
   */
  function generateMaze(w, h, loops, rng = Math.random) {
    const m = { w, h, open: new Uint8Array(w * h) };
    const seen = new Uint8Array(w * h);
    const stack = [Math.floor(rng() * w * h)];
    seen[stack[0]] = 1;
    while (stack.length) {
      const cur = stack[stack.length - 1];
      const fresh = [0, 1, 2, 3].filter((d) => inside(m, cur, d) && !seen[step(m, cur, d)]);
      if (!fresh.length) {
        stack.pop();
        continue;
      }
      const d = pickOne(fresh, rng);
      carve(m, cur, d);
      seen[step(m, cur, d)] = 1;
      stack.push(step(m, cur, d));
    }
    let extra = Math.round(w * h * loops);
    for (let tries = 0; extra > 0 && tries < 600; tries++) {
      const dead = [];
      for (let i = 0; i < w * h; i++) if (ways(m, i) === 1) dead.push(i);
      const i = dead.length && rng() < 0.7 ? pickOne(dead, rng) : Math.floor(rng() * w * h);
      const walls = [0, 1, 2, 3].filter((d) => inside(m, i, d) && !canGo(m, i, d) && !makesRoom(m, i, d));
      if (!walls.length) continue;
      carve(m, i, pickOne(walls, rng));
      extra--;
    }
    return m;
  }

  /** from 칸에서 모든 칸까지의 걸음 수 (BFS). 닿지 못하는 칸은 -1 */
  function distances(m, from) {
    const dist = new Int16Array(m.w * m.h).fill(-1);
    const queue = [from];
    dist[from] = 0;
    for (let k = 0; k < queue.length; k++) {
      const i = queue[k];
      for (let d = 0; d < 4; d++) {
        if (!canGo(m, i, d)) continue;
        const j = step(m, i, d);
        if (dist[j] < 0) {
          dist[j] = dist[i] + 1;
          queue.push(j);
        }
      }
    }
    return dist;
  }

  /** 목표까지의 거리표(dist)를 보고, i 칸에서 최단 경로로 가는 방향을 고른다. 이미 도착했으면 -1 */
  function dirToward(m, i, dist) {
    for (let d = 0; d < 4; d++) if (canGo(m, i, d) && dist[step(m, i, d)] === dist[i] - 1) return d;
    return -1;
  }

  /** 시작(맨 아랫줄), 출구, 열쇠, 아이템 자리를 서로 멀리 떨어뜨려 고른다 */
  function placeThings(m, keyCount, itemCount, rng = Math.random) {
    const n = m.w * m.h;
    const start = (m.h - 1) * m.w + Math.floor(rng() * m.w);
    const near = distances(m, start); // 이미 고른 자리들 가운데 가장 가까운 곳까지의 거리
    const taken = new Set([start]);
    const pickFar = () => {
      let best = 0;
      for (let i = 0; i < n; i++) if (!taken.has(i)) best = Math.max(best, near[i]);
      const pool = [];
      for (let i = 0; i < n; i++) if (!taken.has(i) && near[i] >= best * 0.8) pool.push(i);
      const cell = pickOne(pool, rng);
      taken.add(cell);
      const d = distances(m, cell);
      for (let i = 0; i < n; i++) near[i] = Math.min(near[i], d[i]);
      return cell;
    };
    const exit = pickFar();
    const keys = Array.from({ length: keyCount }, pickFar);
    const items = Array.from({ length: itemCount }, pickFar);
    return { start, exit, keys, items };
  }

  const Core = { SIZES, canGo, step, ways, inside, makesRoom, generateMaze, distances, dirToward, placeThings };
  if (typeof module === 'object' && module.exports) {
    module.exports = Core;
    return;
  }

  // ============================================================ 게임
  const { h, clamp, lerp, pick, sfx, fx } = Arcade;
  const GAME_ID = 'game02';
  const TAU = Math.PI * 2;
  const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

  // ----- 설정 (관리자 페이지와 같은 키를 쓴다)
  const PRESETS = [
    { stageTime: 45, mazeSize: 1, ghostSpeed: 40, sight: 3 },
    { stageTime: 40, mazeSize: 2, ghostSpeed: 50, sight: 2.6 },
    { stageTime: 36, mazeSize: 3, ghostSpeed: 60, sight: 2.3 },
  ];
  const LIMITS = { stageTime: [15, 300], mazeSize: [1, 3], ghostSpeed: [10, 95], sight: [1.5, 6] };
  const saved = Arcade.loadSettings('mazeGameSettings', {});
  // 옛 설정은 난이도를 activeDifficulty: 'easy' | 'normal' | 'hard' 로 저장했다
  let level = parseInt(saved.difficulty, 10);
  if (!Number.isFinite(level)) level = ['easy', 'normal', 'hard'].indexOf(saved.activeDifficulty);
  level = clamp(level, 0, 2);
  const S = Object.assign({}, PRESETS[level]);
  Object.keys(LIMITS).forEach((key) => {
    const v = Number(saved[key]);
    if (Number.isFinite(v) && v > 0) S[key] = clamp(v, LIMITS[key][0], LIMITS[key][1]);
  });
  S.mazeSize = Math.round(S.mazeSize);

  // 캐릭터 테마: 열쇠를 다 모으면 출구에 그 캐릭터의 보물이 나타난다
  const THEMES = {
    cat: { player: '😺', goal: '🧶', wall: '#ff9db0' },
    rabbit: { player: '🐰', goal: '🥕', wall: '#3ddc97' },
    unicorn: { player: '🦄', goal: '🌈', wall: '#c39bff' },
    panda: { player: '🐼', goal: '🎋', wall: '#5cc8ff' },
    dog: { player: '🐶', goal: '🦴', wall: '#ffb86b' },
  };
  const themeName = THEMES[saved.gameTheme] ? saved.gameTheme : 'cat';
  const theme = THEMES[themeName];

  const ITEMS = {
    time: { icon: '⏱️', text: '시간 +8초' },
    light: { icon: '🔦', text: '미로가 잠깐 보인다!' },
    ice: { icon: '❄️', text: '유령이 얼어붙었다!' },
  };
  const STAGES = [
    {
      loops: 0.06,
      items: () => ['time'],
      goal: '열쇠 <b>3개</b>를 모아 출구로!',
      banner: ['스테이지 1 · 탐색', '어느 열쇠부터 갈까?'],
    },
    {
      dark: true,
      loops: 0.08,
      items: () => ['light', 'time'],
      goal: '<b>반짝임</b>이 열쇠가 있는 쪽이다',
      banner: ['스테이지 2 · 어둠', '가장자리의 반짝임을 따라가라'],
    },
    {
      dark: true,
      ghost: true,
      loops: 0.14,
      items: () => ['ice', pick(['time', 'light'])],
      goal: '<b>유령</b>을 피해 열쇠를 모아라',
      banner: ['스테이지 3 · 추격', '유령이 쫓아온다! 닿으면 하트 -1'],
    },
  ];
  const KEYS = 3;
  const SPEED = 6.5; // 캐릭터 속도 (칸/초)
  const TIME_MULT = [1, 1.5, 2]; // 스테이지별 시간 배율
  const COMBO_SEC = [9, 14, 14]; // 이 안에 다음 열쇠를 모으면 콤보
  const TENSE = [0.1, 0.3, 0.45]; // 스테이지별 배경 리듬 긴장도
  const TIME_ITEM = 8;
  const REVEAL_SEC = 5;
  const FREEZE_SEC = 6;
  const SAFE_SEC = 2.5; // 잡힌 뒤 무적 시간
  const GHOST_REST = 3; // 유령이 나타나거나 물러난 뒤 가만히 있는 시간
  const SWIPE = 18; // 이만큼(px) 밀면 방향으로 본다
  const PAD = 6; // 캔버스 안쪽 여백

  function start(game) {
    const ease = Math.min(game.retry, 3); // 재도전할수록 시간은 늘고 유령은 느려진다
    const ghostSpeed = SPEED * (S.ghostSpeed / 100) * (1 - 0.08 * ease);
    let stageIdx = game.checkpoint;
    let st, m, keys, items, exitCell, exitOpen, p, ghost, seen, toPlayer, timer;
    let stageSec = 0;
    let sight = 0; // 손전등 반경 (칸)
    let extended = false; // 이 스테이지에서 하트를 내고 시간을 늘렸는가
    let active = false;
    let want = -1; // 다음 갈림길에서 꺾을 방향
    let held = -1; // 누르고 있는 방향 버튼
    let comboUntil = 0;
    let safeUntil = 0;
    let revealUntil = 0;
    let bump = { d: 0, until: 0 };
    let fogA = 1;
    let danger = 0; // 유령이 가까운 정도 0~1
    let beat = 0;
    let beatAt = 0;
    let pingAt = 0;
    let ping = 0;
    let keysGot = 0;
    let leftSum = 0;
    let totalSum = 0;
    let auto = false; // 검증용 자동 이동 (true 또는 목표 칸 번호)

    // ----- 화면
    const canvas = h('canvas', { class: 'mz-canvas' });
    const ctx = canvas.getContext('2d');
    const wallLayer = document.createElement('canvas');
    const fog = document.createElement('canvas');
    const redEdge = h('div', { class: 'mz-danger' });
    const keyBox = h('div', { class: 'mz-slot', dataset: { label: '열쇠' } });
    const itemBox = h('div', { class: 'mz-slot', dataset: { label: '아이템' } });
    const hud = game.app.querySelector('.ar-hud');
    game.root.append(canvas, redEdge);
    game.root.style.touchAction = 'none';
    game.footer.append(
      h('div', { class: 'mz-pad' }, [keyBox, padButton(0), itemBox, padButton(3), padButton(2), padButton(1)])
    );

    let cell = 0;
    let W = 0;
    let H = 0;
    let dpr = 1;

    /** 화면에 맞춰 칸 크기를 정하고 벽을 다시 그린다 */
    function layout() {
      if (!m) return;
      const box = game.root.getBoundingClientRect();
      cell = clamp(Math.floor(Math.min((box.width - PAD * 2) / m.w, (box.height - PAD * 2) / m.h)), 10, 58);
      W = m.w * cell + PAD * 2;
      H = m.h * cell + PAD * 2;
      dpr = Math.min(window.devicePixelRatio || 1, 3);
      [canvas, wallLayer, fog].forEach((c) => {
        c.width = Math.round(W * dpr);
        c.height = Math.round(H * dpr);
      });
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      paintWalls();
    }

    function paintWalls() {
      const c = wallLayer.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, W, H);
      c.fillStyle = 'rgba(255,255,255,.08)';
      c.beginPath();
      for (let i = 0; i < m.open.length; i++) {
        const x = PAD + (i % m.w) * cell;
        const y = PAD + Math.floor(i / m.w) * cell;
        c.moveTo(x + cell / 2 + 1.2, y + cell / 2);
        c.arc(x + cell / 2, y + cell / 2, 1.2, 0, TAU);
      }
      c.fill();
      c.beginPath();
      for (let i = 0; i < m.open.length; i++) {
        const x = PAD + (i % m.w) * cell;
        const y = PAD + Math.floor(i / m.w) * cell;
        if (!canGo(m, i, 0)) c.moveTo(x, y), c.lineTo(x + cell, y);
        if (!canGo(m, i, 3)) c.moveTo(x, y), c.lineTo(x, y + cell);
        if (!canGo(m, i, 2) && i >= m.open.length - m.w) c.moveTo(x, y + cell), c.lineTo(x + cell, y + cell);
        if (!canGo(m, i, 1) && i % m.w === m.w - 1) c.moveTo(x + cell, y), c.lineTo(x + cell, y + cell);
      }
      c.lineCap = 'round';
      c.lineWidth = Math.max(2.5, cell * 0.1);
      c.strokeStyle = theme.wall;
      c.shadowColor = theme.wall;
      c.shadowBlur = cell * 0.3 * dpr;
      c.globalAlpha = 0.6;
      c.stroke();
      c.shadowBlur = 0;
      c.globalAlpha = 1;
      c.stroke();
    }

    // ----- 좌표
    const center = (i) => [PAD + ((i % m.w) + 0.5) * cell, PAD + (Math.floor(i / m.w) + 0.5) * cell];
    /** 움직이는 것(캐릭터, 유령)의 캔버스 좌표 */
    function spot(e) {
      const a = center(e.from);
      if (e.to < 0 || e.to === e.from) return a;
      const b = center(e.to);
      return [lerp(a[0], b[0], e.t), lerp(a[1], b[1], e.t)];
    }
    /** 칸의 화면 좌표 (연출용) */
    function point(i) {
      const r = canvas.getBoundingClientRect();
      const [x, y] = center(i);
      return { x: r.left + x, y: r.top + y };
    }
    const here = () => (p.to >= 0 && p.t >= 0.5 ? p.to : p.from);

    // ----- 그리기
    function disc(x, y, r, color, alpha) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    function emoji(ch, x, y, size, alpha = 1) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#fff';
      ctx.font = `${Math.round(size)}px ${EMOJI}`;
      ctx.fillText(ch, x, y + size * 0.06);
      ctx.globalAlpha = 1;
    }

    /** 어둠에 구멍을 낸다 (가운데는 환하고 가장자리로 갈수록 어둡다) */
    function hole(f, x, y, r) {
      const g = f.createRadialGradient(x, y, r * 0.45, x, y, r);
      g.addColorStop(0, '#000');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      f.fillStyle = g;
      f.beginPath();
      f.arc(x, y, r, 0, TAU);
      f.fill();
    }

    function drawFog(me, light, t) {
      const f = fog.getContext('2d');
      f.setTransform(dpr, 0, 0, dpr, 0, 0);
      f.globalCompositeOperation = 'source-over';
      f.fillStyle = '#04061a';
      f.fillRect(0, 0, W, H);
      f.globalCompositeOperation = 'destination-out';
      f.fillStyle = 'rgba(0,0,0,.4)'; // 지나온 길은 흐리게 남는다
      for (let i = 0; i < seen.length; i++) {
        if (seen[i]) f.fillRect(PAD + (i % m.w) * cell, PAD + Math.floor(i / m.w) * cell, cell, cell);
      }
      hole(f, me[0], me[1], light * (1 + 0.02 * Math.sin(t * 9)));
      if (exitOpen) hole(f, ...center(exitCell), cell * 1.8);
      ctx.globalAlpha = fogA;
      ctx.drawImage(fog, 0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    /** 보이지 않는 열쇠가 있는 쪽 가장자리에 반짝임을 그린다. 가까울수록 크고 빠르게 깜빡인다 */
    function drawSparkles(me, light, t) {
      keys.forEach((k, n) => {
        const [kx, ky] = center(k);
        const dx = kx - me[0];
        const dy = ky - me[1];
        const far = Math.hypot(dx, dy);
        if (far < light * 0.85) return;
        const edge = 10;
        const sx = dx > 0 ? (W - edge - me[0]) / dx : dx < 0 ? (edge - me[0]) / dx : Infinity;
        const sy = dy > 0 ? (H - edge - me[1]) / dy : dy < 0 ? (edge - me[1]) / dy : Infinity;
        const s = Math.min(sx, sy);
        const x = me[0] + dx * s;
        const y = me[1] + dy * s;
        const near = 1 - clamp(far / Math.hypot(W, H), 0, 1);
        const r = 4 + near * 6 + ping * 3;
        const alpha = clamp(0.3 + 0.7 * Math.abs(Math.sin(t * (2 + near * 5) + n * 2)) + ping * 0.4, 0, 1);
        disc(x, y, r * 1.5, '#ffd166', alpha * 0.25);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#fff1c2';
        ctx.beginPath();
        for (let v = 0; v < 8; v++) {
          const rr = v % 2 ? r * 0.3 : r;
          ctx.lineTo(x + Math.cos((v * Math.PI) / 4) * rr, y + Math.sin((v * Math.PI) / 4) * rr);
        }
        ctx.fill();
        ctx.globalAlpha = 1;
      });
    }

    function draw(t) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(wallLayer, 0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const me = spot(p);
      const light = (sight + 0.5) * cell;
      const [ex, ey] = center(exitCell);

      // 출구: 잠겨 있으면 자물쇠, 열리면 캐릭터의 보물이 빛난다
      if (exitOpen) {
        disc(ex, ey, cell * (0.6 + 0.08 * Math.sin(t * 6)), '#3ddc97', 0.4);
        emoji(theme.goal, ex, ey, cell * 0.74);
      } else {
        disc(ex, ey, cell * 0.42, '#fff', 0.1);
        emoji('🔒', ex, ey, cell * 0.56);
      }
      items.forEach((it) => {
        if (it.taken) return;
        const [x, y] = center(it.cell);
        disc(x, y, cell * 0.4, '#36d6ff', 0.22);
        emoji(ITEMS[it.kind].icon, x, y, cell * 0.56);
      });
      keys.forEach((k, n) => {
        const [x, y] = center(k);
        disc(x, y, cell * 0.42, '#ffd166', 0.2);
        emoji('🔑', x, y + Math.sin(t * 3 + n * 2) * cell * 0.06, cell * 0.66);
      });

      // 캐릭터
      if (game.time < bump.until) {
        const k = ((bump.until - game.time) / 0.14) * cell * 0.16;
        me[0] += DX[bump.d] * k;
        me[1] += DY[bump.d] * k;
      }
      if (active && p.to < 0) {
        // 멈춰 있을 때는 갈 수 있는 방향을 작은 화살표로 알려 준다
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.4 + 0.25 * Math.sin(t * 7);
        for (let d = 0; d < 4; d++) {
          if (!canGo(m, p.from, d)) continue;
          const x = me[0] + DX[d] * cell * 0.64;
          const y = me[1] + DY[d] * cell * 0.64;
          const r = cell * 0.13;
          ctx.beginPath();
          ctx.moveTo(x + DX[d] * r, y + DY[d] * r);
          ctx.lineTo(x - DX[d] * r * 0.4 + DY[d] * r, y - DY[d] * r * 0.4 + DX[d] * r);
          ctx.lineTo(x - DX[d] * r * 0.4 - DY[d] * r, y - DY[d] * r * 0.4 - DX[d] * r);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      const safe = game.time < safeUntil;
      disc(me[0], me[1], cell * 0.46, safe ? '#fff' : theme.wall, safe ? 0.3 : 0.22);
      emoji(theme.player, me[0], me[1], cell * 0.78, safe && Math.sin(t * 30) > 0 ? 0.35 : 1);
      if (active && game.combo > 0 && keys.length && game.time < comboUntil) {
        // 콤보가 이어지는 시간: 금색 고리가 다 줄기 전에 다음 열쇠를 모은다
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = Math.max(2, cell * 0.08);
        ctx.beginPath();
        ctx.arc(me[0], me[1], cell * 0.52, -Math.PI / 2, -Math.PI / 2 + (TAU * (comboUntil - game.time)) / COMBO_SEC[stageIdx]);
        ctx.stroke();
      }

      if (st.dark) drawFog(me, light, t);

      // 유령은 어둠 위에 그린다: 멀리 있어도 희미하게 보인다
      if (ghost) {
        const [gx, gy] = spot(ghost);
        const frozen = game.time < ghost.frozenUntil;
        const resting = game.time < ghost.restUntil;
        const lit = !st.dark || fogA < 0.5 || Math.hypot(gx - me[0], gy - me[1]) < light * 0.8;
        const alpha = (lit ? 1 : 0.6) * (resting ? 0.5 + 0.2 * Math.sin(t * 12) : 1);
        disc(gx, gy, cell * 0.52, frozen ? '#36d6ff' : '#ff3d5e', (frozen ? 0.4 : 0.25 + 0.1 * Math.sin(t * 8)) * alpha);
        emoji('👻', gx, gy + Math.sin(t * 4) * cell * 0.05, cell * 0.82, alpha);
        if (frozen) emoji('❄️', gx + cell * 0.3, gy - cell * 0.3, cell * 0.42);
      }
      if (st.dark && fogA > 0.5) drawSparkles(me, light, t);
    }

    // ----- 아래쪽 칸: 모은 열쇠, 이번 미로의 아이템
    function paintSlots() {
      keyBox.dataset.label = game.combo >= 2 ? `${game.combo} 콤보` : '열쇠';
      keyBox.classList.toggle('hot', game.combo >= 2);
      keyBox.innerHTML = '';
      for (let k = 0; k < KEYS; k++) keyBox.append(h('span', { class: k < KEYS - keys.length ? 'on' : '', text: '🔑' }));
      itemBox.innerHTML = '';
      items.forEach((it) => itemBox.append(h('span', { class: it.taken ? 'on' : '', text: ITEMS[it.kind].icon })));
    }

    // ----- 조작
    /** 방향 입력. 멈춰 있으면 바로 달리고, 달리는 중이면 다음 갈림길에서 꺾는다 */
    function input(dir) {
      if (!active || !game.playing) return;
      if (p.to >= 0) {
        if (dir === (p.dir + 2) % 4) {
          // 반대쪽은 그 자리에서 바로 돌아선다
          [p.from, p.to] = [p.to, p.from];
          p.t = 1 - p.t;
          p.dir = dir;
          want = -1;
        } else want = dir;
      } else if (canGo(m, p.from, dir)) {
        p.to = step(m, p.from, dir);
        p.dir = dir;
        p.t = 0;
        want = -1;
        Arcade.audio.tone({ freq: 300, to: 440, type: 'triangle', dur: 0.06, vol: 0.07 });
      } else {
        bump = { d: dir, until: game.time + 0.14 };
        Arcade.audio.tone({ freq: 130, type: 'square', dur: 0.05, vol: 0.07 });
      }
    }

    function padButton(dir) {
      const btn = h('button', { class: 'mz-btn', 'aria-label': ['위', '오른쪽', '아래', '왼쪽'][dir], dataset: { dir } }, h('i'));
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        held = dir;
        btn.classList.add('on');
        input(dir);
      });
      const release = () => {
        if (held === dir) held = -1;
        btn.classList.remove('on');
      };
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((type) => btn.addEventListener(type, release));
      return btn;
    }

    // 스와이프: 손을 떼지 않고 이어서 꺾을 수 있다
    let swipe = null;
    game.on(game.root, 'pointerdown', (e) => {
      swipe = { id: e.pointerId, x: e.clientX, y: e.clientY, dir: -1 };
    });
    game.on(game.root, 'pointermove', (e) => {
      if (!swipe || swipe.id !== e.pointerId) return;
      const dx = e.clientX - swipe.x;
      const dy = e.clientY - swipe.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE) return;
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
      if (dir !== swipe.dir) input(dir); // 길게 밀어도 같은 방향은 한 번만
      swipe = { id: swipe.id, x: e.clientX, y: e.clientY, dir };
    });
    ['pointerup', 'pointercancel'].forEach((type) => game.on(game.root, type, () => (swipe = null)));

    const KEYMAP = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3 };
    game.on(window, 'keydown', (e) => {
      const dir = KEYMAP[e.key];
      if (dir === undefined) return;
      e.preventDefault();
      if (e.repeat) return;
      held = dir;
      input(dir);
    });
    game.on(window, 'keyup', (e) => {
      if (KEYMAP[e.key] === held) held = -1;
    });
    game.on(window, 'blur', () => (held = -1));
    game.on(window, 'resize', layout);

    // ----- 움직임
    function movePlayer(dt) {
      if (p.to < 0) {
        if (held >= 0 && canGo(m, p.from, held)) input(held);
        return;
      }
      p.t += SPEED * dt;
      while (p.to >= 0 && p.t >= 1) {
        p.t -= 1;
        p.from = p.to;
        arrive(p.from);
        const back = (p.dir + 2) % 4;
        const outs = [0, 1, 2, 3].filter((d) => d !== back && canGo(m, p.from, d));
        let next = -1;
        if (!active) next = -1;
        else if (outs.length === 1) next = outs[0]; // 외길은 모퉁이도 따라 돈다 (예약한 방향은 갈림길까지 들고 간다)
        else if (outs.includes(want)) next = want; // 갈림길: 예약한 방향으로 꺾는다
        else if (outs.includes(held)) next = held; // 버튼을 누르고 있으면 갈림길도 지나간다
        if (outs.length !== 1) want = -1;
        if (next < 0) {
          p.to = -1;
          p.t = 0;
        } else {
          p.dir = next;
          p.to = step(m, p.from, next);
        }
      }
    }

    function arrive(i) {
      toPlayer = distances(m, i);
      const k = keys.indexOf(i);
      if (k >= 0) takeKey(k);
      const it = items.find((o) => o.cell === i && !o.taken);
      if (it) takeItem(it);
      if (i !== exitCell) return;
      if (exitOpen) stageClear();
      else fx.toast(`🔒 열쇠가 ${keys.length}개 더 필요해!`, { ms: 900 });
    }

    function takeKey(k) {
      const at = point(keys[k]);
      keys.splice(k, 1);
      keysGot++;
      if (game.time > comboUntil) game.resetCombo();
      const combo = game.addCombo();
      const gain = 100 * Math.min(combo, 5);
      comboUntil = game.time + COMBO_SEC[stageIdx];
      game.addScore(gain);
      fx.floatText(at, combo >= 2 ? `+${gain} · ${combo}콤보!` : `+${gain}`, { color: '#ffd166' });
      sfx('coin');
      fx.burst(at, { count: 12, spread: 70, colors: ['#ffd166', '#fff3c4', '#ffb938'] });
      paintSlots();
      if (keys.length) return;
      exitOpen = true;
      sfx('unlock');
      Arcade.vibrate(80);
      fx.flash('rgba(61,220,151,.25)');
      fx.toast('🚪 출구가 열렸다!', { kind: 'good' });
      game.setGoal(`<b>출구가 열렸다!</b> ${theme.goal} 쪽으로 달려라`);
    }

    function takeItem(it) {
      const at = point(it.cell);
      it.taken = true;
      game.addScore(50, at);
      sfx('power');
      fx.burst(at, { count: 8, spread: 60, emoji: '✨' });
      fx.toast(`${ITEMS[it.kind].icon} ${ITEMS[it.kind].text}`, { kind: 'gold', ms: 1100 });
      if (it.kind === 'time') timer.add(TIME_ITEM);
      if (it.kind === 'light') revealUntil = game.time + REVEAL_SEC;
      if (it.kind === 'ice' && ghost) ghost.frozenUntil = game.time + FREEZE_SEC;
      paintSlots();
    }

    function dropCombo() {
      game.resetCombo();
      comboUntil = 0;
      paintSlots();
    }

    /** 캐릭터에게서 먼 칸 가운데 하나 (유령이 나타나거나 물러나는 곳) */
    function farCell() {
      const max = toPlayer.reduce((a, b) => Math.max(a, b), 0);
      const pool = [];
      toPlayer.forEach((d, i) => d >= max * 0.8 && pool.push(i));
      return pick(pool);
    }

    function moveGhost(dt) {
      const g = ghost;
      if (game.time < g.restUntil || game.time < g.frozenUntil) return;
      const next = (i) => {
        const d = dirToward(m, i, toPlayer);
        return d < 0 ? i : step(m, i, d);
      };
      if (g.to === g.from) g.to = next(g.from);
      else if (toPlayer[g.from] < toPlayer[g.to]) {
        // 캐릭터가 뒤로 돌아갔으면 유령도 돌아선다
        [g.from, g.to] = [g.to, g.from];
        g.t = 1 - g.t;
      }
      if (g.to === g.from) return;
      // 가까워지면 살금살금(절반 속도까지) 다가온다: 심장 소리를 듣고 달아날 틈을 준다
      const gap = toPlayer[g.t >= 0.5 ? g.to : g.from];
      g.t += ghostSpeed * lerp(0.5, 1, clamp((gap - 2) / 5, 0, 1)) * dt;
      while (g.t >= 1) {
        g.from = g.to;
        g.to = next(g.from);
        g.t = g.to === g.from ? 0 : g.t - 1;
      }
    }

    function checkCaught() {
      if (game.time < safeUntil || game.time < ghost.frozenUntil) return;
      const a = spot(p);
      const b = spot(ghost);
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) > cell * 0.6) return;
      const at = point(here());
      sfx('zap');
      dropCombo();
      if (game.loseLife(at) <= 0) {
        active = false;
        game.lose({ icon: '👻', title: '잡혔다!', message: '유령에게 하트를 모두 빼앗겼어요.', checkpoint: stageIdx });
        return;
      }
      // 잠깐 무적이 되고, 유령은 멀리 물러난다
      safeUntil = game.time + SAFE_SEC;
      fx.burst(at, { count: 6, spread: 70, emoji: '💨' });
      ghost.from = ghost.to = farCell();
      ghost.t = 0;
      ghost.restUntil = game.time + GHOST_REST;
    }

    // ----- 시간
    function timeUp() {
      if (!active) return;
      // 시간이 다 되면 하트 하나를 내고 조금 더 버틴다. 하트가 없으면 실패
      extended = true;
      dropCombo();
      if (game.loseLife(canvas) <= 0) {
        active = false;
        game.lose({ icon: '⏰', title: '시간 초과!', message: '시간도 하트도 바닥났어요.', checkpoint: stageIdx });
        return;
      }
      const more = Math.round(stageSec * 0.3);
      fx.toast(`⏰ 하트를 내고 +${more}초!`, { kind: 'bad', ms: 1600 });
      timer = game.startTimer(more, { onEnd: timeUp, intensity: TENSE[stageIdx] });
    }

    /** 유령이 다가오면 심장 소리가 빨라지고 화면 가장자리가 붉어진다 */
    function feelDanger(dt) {
      const frozen = game.time < ghost.frozenUntil;
      const gap = toPlayer[ghost.t >= 0.5 ? ghost.to : ghost.from];
      danger = lerp(danger, frozen ? 0 : clamp(1 - (gap - 2) / 9, 0, 1), Math.min(1, dt * 4));
      if (danger > 0.08 && game.time >= beatAt) {
        beatAt = game.time + lerp(1.05, 0.36, danger);
        beat = 1;
        const vol = 0.12 + danger * 0.22;
        Arcade.audio.tone({ freq: 150, to: 55, type: 'triangle', dur: 0.12, vol });
        Arcade.audio.tone({ freq: 120, to: 50, type: 'triangle', dur: 0.14, vol: vol * 0.7, delay: 0.15 });
        if (danger > 0.55) Arcade.vibrate(18);
      }
      if (danger > 0.05 && timer) {
        // 엔진이 매 프레임 시간 막대 기준으로 긴장도를 덮어쓴다. 그 뒤(마이크로태스크)에 유령 거리까지 넣어 다시 정한다
        const tense = hud.classList.contains('warn') ? 1 : Math.max(danger, 1 - timer.ratio(), TENSE[stageIdx]);
        Promise.resolve().then(() => Arcade.audio.music.setIntensity(tense));
      }
    }

    /** 어둠 속 열쇠 탐지음: 가장 가까운 열쇠가 가까울수록 높은 소리 */
    function pingKeys() {
      pingAt = game.time + 2.4;
      const gap = Math.min(...keys.map((k) => toPlayer[k]));
      const near = 1 - clamp(gap / (m.w + m.h), 0, 1);
      Arcade.audio.tone({ freq: 440 + near * near * 880, type: 'sine', dur: 0.22, vol: 0.07 + near * 0.05 });
      ping = 1;
    }

    // ----- 스테이지 진행
    async function runStage() {
      st = STAGES[stageIdx];
      const [w, hh] = SIZES[clamp(S.mazeSize - 1 + stageIdx, 0, SIZES.length - 1)];
      const kinds = st.items();
      m = generateMaze(w, hh, st.loops);
      const put = placeThings(m, KEYS, kinds.length);
      keys = put.keys;
      exitCell = put.exit;
      exitOpen = false;
      items = put.items.map((at, n) => ({ cell: at, kind: kinds[n], taken: false }));
      p = { from: put.start, to: -1, t: 0, dir: 0 };
      toPlayer = distances(m, p.from);
      seen = new Uint8Array(w * hh);
      sight = S.sight + (st.ghost ? 0.8 : 0); // 쫓길 때는 조금 더 멀리 보인다
      ghost = null;
      if (st.ghost) {
        const far = farCell();
        ghost = { from: far, to: far, t: 0, restUntil: Infinity, frozenUntil: 0 };
      }
      want = held = -1;
      extended = false;
      revealUntil = safeUntil = 0;
      danger = 0;
      fogA = 1;
      stageSec = Math.round(S.stageTime * TIME_MULT[stageIdx] * (1 + 0.12 * ease));

      game.setStage(stageIdx, STAGES.length);
      game.setGoal(st.goal);
      paintSlots();
      layout();
      await game.banner(st.banner[0], st.banner[1], { ms: 1500 });
      timer = game.startTimer(stageSec, { onEnd: timeUp, intensity: TENSE[stageIdx] });
      if (ghost) ghost.restUntil = game.time + GHOST_REST;
      if (game.combo) comboUntil = game.time + COMBO_SEC[stageIdx]; // 콤보는 다음 스테이지로 이어진다
      pingAt = game.time + 1;
      active = true;
    }

    function stageClear() {
      active = false;
      const left = timer.left();
      game.stopTimer();
      leftSum += extended ? 0 : left;
      totalSum += stageSec;
      game.addScore(200 + Math.round(left) * 10, point(exitCell));
      sfx('great');
      fx.confetti(28);
      fx.burst(point(exitCell), { count: 10, spread: 90, emoji: ['✨', '⭐'] });
      game.after(900, () => {
        if (stageIdx >= STAGES.length - 1) return finish();
        stageIdx++;
        runStage();
      });
    }

    function finish() {
      const lost = game.config.lives - game.lives;
      const ratio = leftSum / Math.max(1, totalSum);
      let stars = lost === 0 && ratio >= 0.3 ? 3 : lost <= 1 ? 2 : 1;
      if (game.retry > 0) stars = Math.min(stars, 2);
      game.addScore(game.lives * 150);
      game.win({
        stars,
        title: '탈출 성공!',
        message: stars === 3 ? '하트도 시간도 넉넉히 남겼어요. 완벽한 탈출!' : `${theme.player}${theme.goal} 미로를 무사히 빠져나왔어요!`,
        stats: [
          ['모은 열쇠', `${keysGot}개`],
          ['남은 하트', `${game.lives} / ${game.config.lives}`],
          ['남긴 시간', `${Math.round(leftSum)}초`],
          ['최대 콤보', `${game.maxCombo}`],
        ],
      });
    }

    /** 검증용: 가장 가까운 열쇠(다 모았으면 출구)나 정해 준 칸으로 최단 경로를 따라간다 */
    function autoDrive() {
      const at = p.to >= 0 ? p.to : p.from;
      const mine = distances(m, at);
      const target = typeof auto === 'number' ? auto : keys.length ? keys.reduce((a, b) => (mine[b] < mine[a] ? b : a)) : exitCell;
      const dir = dirToward(m, at, distances(m, target));
      if (dir < 0) return;
      if (p.to < 0 || dir === (p.dir + 2) % 4) input(dir);
      else want = dir;
    }

    game.loop((dt, t) => {
      if (!m) return;
      if (active) {
        if (auto !== false) autoDrive();
        movePlayer(dt);
      }
      if (active && ghost) {
        moveGhost(dt);
        checkCaught();
      }
      if (active && ghost) feelDanger(dt);
      else danger = lerp(danger, 0, Math.min(1, dt * 4));
      if (active && st.dark) {
        // 손전등이 닿은 칸은 본 칸으로 남긴다
        const [x, y] = spot(p);
        for (let i = 0; i < seen.length; i++) {
          if (seen[i]) continue;
          const [cx, cy] = center(i);
          if (Math.hypot(cx - x, cy - y) <= (sight - 0.3) * cell) seen[i] = 1;
        }
        if (keys.length && game.time >= pingAt) pingKeys();
      }
      if (active && game.combo && game.time > comboUntil) dropCombo();
      fogA = lerp(fogA, game.time < revealUntil ? 0.08 : 1, Math.min(1, dt * 6));
      beat = Math.max(0, beat - dt * 3);
      ping = Math.max(0, ping - dt * 2);
      redEdge.style.opacity = (danger * (0.55 + 0.45 * beat)).toFixed(2);
      draw(t);
    });

    if (game.debug) {
      // 검증용 창구
      window.__game = {
        core: Core,
        settings: Object.assign({ level, theme: themeName }, S),
        maze: () => m,
        state: () => ({
          stage: stageIdx, active, cell: p.from, moving: p.to >= 0, size: [m.w, m.h], cellPx: cell,
          keys: keys.slice(), items: items.map((it) => Object.assign({}, it)), exitCell, exitOpen,
          dark: !!st.dark, seen: seen.reduce((a, b) => a + b, 0), reveal: game.time < revealUntil,
          stageSec, timeLeft: timer ? timer.left() : null, safe: game.time < safeUntil, danger,
          ghost: ghost && { cell: ghost.from, gap: toPlayer[ghost.from], frozen: game.time < ghost.frozenUntil, speed: ghostSpeed },
        }),
        auto: (v) => (auto = v === undefined ? true : v), // true: 열쇠와 출구로, 숫자: 그 칸으로, false: 끔
        input,
        point,
        setTimeLeft: (sec) => timer.add(sec - timer.left()),
        holdGhost: (sec) => ghost && (ghost.restUntil = game.time + sec),
      };
    }

    runStage();
  }

  Arcade.createGame({
    id: GAME_ID,
    title: '미로 탈출',
    icon: '🔑',
    accent: '#3ddc97',
    accent2: '#36d6ff',
    tagline: '열쇠를 모아 미로를 탈출하라. 어느 열쇠부터 갈까?',
    howTo: [
      '화면을 <b>밀면</b> 갈림길까지 달려요. 아래 <b>방향 버튼</b>도 돼요',
      '<b>열쇠 3개</b>를 모두 모으면 출구가 열려요',
      '<b>유령</b>에 닿거나 시간이 다 되면 하트를 잃어요',
    ],
    lives: 3,
    stages: STAGES.length,
    start,
  });
})();
