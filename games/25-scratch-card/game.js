// 복권 긁기: 행운의 복권 세 장
// 살짝 긁어 엿보고, 어디를 끝까지 긁을지 고른다. 마지막 황금 복권에서 부모가 올린 사진이 드러난다.
(function () {
  'use strict';

  const { h, shuffle, clamp, rand, sfx, fx, fmt } = Arcade;
  const GAME_ID = 'game25';
  const PHOTO_KEY = 'minigames:scratch_bg_image'; // 관리자 페이지가 올린 사진. JSON 이 아니라 data URL 문자열 그대로다

  // ----- 설정 (관리자 페이지와 같은 키, 같은 기본값)
  const PRESETS = [
    { coinSlack: 1.8, stageTime: 50, bombs: 3, lives: 3, goldTime: 20, revealRatio: 70 },
    { coinSlack: 1.2, stageTime: 40, bombs: 4, lives: 3, goldTime: 14, revealRatio: 80 },
    { coinSlack: 0.8, stageTime: 32, bombs: 5, lives: 2, goldTime: 11, revealRatio: 88 },
  ];
  const LIMITS = {
    coinSlack: [0.3, 4],
    stageTime: [15, 120],
    bombs: [1, 6],
    goldTime: [5, 60],
    revealRatio: [30, 95],
    lives: [1, 5],
  };
  const saved = Arcade.loadSettings('scratch_card_settings', {});
  const level = clamp(parseInt(saved.difficulty, 10) || 0, 0, 2);
  const S = Object.assign({}, PRESETS[level]);
  Object.keys(LIMITS).forEach((key) => {
    const raw = saved[key];
    if (raw === null || raw === undefined || raw === '') return;
    const v = Number(raw);
    if (Number.isFinite(v)) S[key] = clamp(v, LIMITS[key][0], LIMITS[key][1]);
  });
  S.bombs = Math.round(S.bombs);
  S.lives = Math.round(S.lives);

  // ----- 규칙에 쓰는 수
  const NEED = 3; // 찾아야 하는 같은 그림 수
  const FULL = 0.6; // 칸 넓이의 이만큼 긁으면 "다 긁었다". 동전 1칸 = 이만큼 긁는 값
  const BOMB_AT = 0.3; // 꽝은 이만큼 긁으면 터진다
  const FUSE_AT = 0.12; // 꽝을 이만큼 긁으면 심지가 타기 시작한다(경고)
  const BOMB_COST = 0.3; // 꽝이 터지면 더 잃는 동전(칸)
  const SAMPLES = 14; // 칸 한 변의 표본점 수. 긁힌 넓이는 표본점으로 센다
  const PAD = 10; // 복권 테두리 두께. style.css 의 .sc-ticket padding 과 같아야 한다
  const FONT = 'system-ui, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';

  const FRUITS = ['🍎', '🍋', '🍇', '🍀', '💎', '🍊']; // 색이 뚜렷이 달라 조금만 봐도 안다
  const TWINS = ['🍓', '⭐', '🔮', '🍏', '🎃']; // 위 그림과 색이 닮아서 자세히 봐야 구별된다
  const BLACK = '🎱'; // 꽝처럼 검다. 가운데가 하얗다 (보통 난이도부터)

  const STAGES = [
    {
      kind: 'grid',
      n: 3,
      name: '일반 복권',
      theme: 'silver',
      pool: FRUITS,
      slackMul: 1,
      timeMul: 1,
      goal: '<b>같은 그림 3개</b>를 찾아 끝까지 긁어라',
      sub: '살짝 긁어 엿보고, 3개짜리만 끝까지!',
      tip: '톡톡 조금만 긁어도 그림이 보여요. 동전을 아끼세요',
      flakes: ['#eef1f6', '#b4bdcc', '#98a3b6'],
    },
    {
      kind: 'grid',
      n: 4,
      name: '고급 복권',
      theme: 'violet',
      bombs: true,
      pool: FRUITS.concat(TWINS, level >= 1 ? [BLACK] : []),
      slackMul: 1.6,
      timeMul: 1.5,
      goal: '<b>💣 꽝</b>을 피해 <b>같은 그림 3개</b>를 찾아라',
      sub: '꽝이 숨어 있다. 닮은 그림도 조심!',
      tip: level >= 1 ? '검다고 다 꽝은 아니에요. 🎱 은 가운데가 하얘요' : '검은 그림이 보이면 꽝! 거기서 멈추세요',
      flakes: ['#d9ccff', '#8f7bd6', '#6f5bbd'],
    },
    {
      kind: 'gold',
      name: '황금 복권',
      theme: 'gold',
      goal: '시간 안에 <b>황금 복권</b>을 문질러 열어라',
      sub: '마음껏 문질러라! 무엇이 나올까?',
      flakes: ['#fff1b8', '#ffd166', '#f0b93a', '#ffffff'],
    },
  ];

  const FOILS = {
    silver: { stops: ['#eef1f6', '#b4bdcc', '#dfe4ec', '#98a3b6'], ink: 'rgba(60, 70, 95, 0.5)' },
    violet: { stops: ['#e0d6ff', '#9a86e0', '#cbbcff', '#7460c4'], ink: 'rgba(40, 25, 90, 0.5)' },
    gold: { stops: ['#fff1b8', '#f0b93a', '#ffe58a', '#d9982a'], ink: 'rgba(120, 70, 0, 0.3)' },
  };

  // ------------------------------------------------------------ 순수 함수

  /** n×n 복권의 그림 배치. 같은 그림은 당첨 그림만 3개이고, 나머지는 많아야 2개씩이다. */
  function makeDeck(n, bombCount, pool) {
    const total = n * n;
    const syms = shuffle(pool);
    const deck = [];
    for (let i = 0; i < NEED; i++) deck.push({ sym: syms[0], win: true });
    for (let i = 0; i < bombCount; i++) deck.push({ sym: '💣', bomb: true });
    for (let k = 1; deck.length < total; k++) {
      const count = Math.min(2, total - deck.length);
      for (let i = 0; i < count; i++) deck.push({ sym: syms[k] });
    }
    return shuffle(deck);
  }

  /** 긁는 넓이를 재는 칸. 표본점 nx×ny 개 가운데 몇 개가 긁혔는지로 비율을 안다. */
  function makeCell(x, y, w, hh, nx, ny) {
    return { x, y, w, h: hh, nx, ny, marks: new Uint8Array(nx * ny), count: 0, total: nx * ny, done: false };
  }

  /** 굵기 2r 인 선분이 지나간 표본점을 새로 표시하고, 새로 표시한 수를 돌려준다. */
  function markCell(c, x0, y0, x1, y1, r) {
    const minX = Math.min(x0, x1) - r;
    const maxX = Math.max(x0, x1) + r;
    const minY = Math.min(y0, y1) - r;
    const maxY = Math.max(y0, y1) + r;
    if (maxX < c.x || minX > c.x + c.w || maxY < c.y || minY > c.y + c.h) return 0;
    const sx = c.w / c.nx;
    const sy = c.h / c.ny;
    const i0 = clamp(Math.floor((minX - c.x) / sx), 0, c.nx - 1);
    const i1 = clamp(Math.floor((maxX - c.x) / sx), 0, c.nx - 1);
    const j0 = clamp(Math.floor((minY - c.y) / sy), 0, c.ny - 1);
    const j1 = clamp(Math.floor((maxY - c.y) / sy), 0, c.ny - 1);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    let gained = 0;
    for (let j = j0; j <= j1; j++) {
      const py = c.y + (j + 0.5) * sy;
      for (let i = i0; i <= i1; i++) {
        const idx = j * c.nx + i;
        if (c.marks[idx]) continue;
        const px = c.x + (i + 0.5) * sx;
        const t = len2 ? clamp(((px - x0) * dx + (py - y0) * dy) / len2, 0, 1) : 0;
        const ex = x0 + t * dx - px;
        const ey = y0 + t * dy - py;
        if (ex * ex + ey * ey <= r * r) {
          c.marks[idx] = 1;
          gained++;
        }
      }
    }
    return gained;
  }

  /** maxW×maxH 안에 가로세로 비율을 지켜 넣는다. */
  function fitBox(maxW, maxH, aspect) {
    let w = maxW;
    let hh = w / aspect;
    if (hh > maxH) {
      hh = maxH;
      w = hh * aspect;
    }
    return { w: Math.floor(w), h: Math.floor(hh) };
  }

  // ------------------------------------------------------------ 사진

  function readPhotoUrl() {
    let raw = null;
    try {
      raw = localStorage.getItem(PHOTO_KEY);
    } catch (e) {
      return null;
    }
    if (raw && raw.charAt(0) === '"') {
      // 혹시 JSON 문자열로 저장돼 있어도 읽는다
      try {
        raw = JSON.parse(raw);
      } catch (e) {
        /* 그대로 쓴다 */
      }
    }
    return typeof raw === 'string' && raw.length > 10 ? raw : null;
  }

  /** 저장된 사진을 불러온다. 없거나 깨졌으면 null. */
  function loadPhoto() {
    const url = readPhotoUrl();
    if (!url) return Promise.resolve(null);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () =>
        resolve(img.naturalWidth > 0 && img.naturalHeight > 0 ? { url, img, aspect: img.naturalWidth / img.naturalHeight } : null);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  // ------------------------------------------------------------ 덮개(긁는 면)

  function roundRect(ctx, x, y, w, hh, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + hh, r);
    ctx.arcTo(x + w, y + hh, x, y + hh, r);
    ctx.arcTo(x, y + hh, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /** 은박(금박) 한 칸을 그린다. */
  function paintFoil(ctx, c, foil, radius, mark) {
    const g = ctx.createLinearGradient(c.x, c.y, c.x + c.w, c.y + c.h);
    foil.stops.forEach((color, i) => g.addColorStop(i / (foil.stops.length - 1), color));
    ctx.save();
    roundRect(ctx, c.x, c.y, c.w, c.h, radius);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.clip();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    for (let d = -c.h; d < c.w; d += 14) {
      ctx.beginPath();
      ctx.moveTo(c.x + d, c.y + c.h);
      ctx.lineTo(c.x + d + c.h, c.y);
      ctx.stroke();
    }
    const dots = Math.round((c.w * c.h) / 220);
    for (let i = 0; i < dots; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(c.x + Math.random() * c.w, c.y + Math.random() * c.h, 1.6, 1.6);
    }
    if (mark) {
      ctx.fillStyle = foil.ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `900 ${Math.round(c.w * 0.4)}px ${FONT}`;
      ctx.fillText(mark, c.x + c.w / 2, c.y + c.h / 2 + c.h * 0.03);
    }
    ctx.restore();
  }

  /** 황금 복권의 덮개: 금박 위에 별 무늬와 글자 */
  function paintGoldFoil(ctx, c) {
    paintFoil(ctx, c, FOILS.gold, 12, '');
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = FOILS.gold.ink;
    ctx.font = `18px ${FONT}`;
    for (let y = 24, row = 0; y < c.h; y += 46, row++) {
      for (let x = row % 2 ? 46 : 23; x < c.w; x += 46) ctx.fillText('★', x, y);
    }
    const bandH = Math.max(74, c.w * 0.3);
    roundRect(ctx, c.w * 0.1, c.h / 2 - bandH / 2, c.w * 0.8, bandH, 16);
    ctx.fillStyle = 'rgba(255, 247, 214, 0.92)';
    ctx.fill();
    ctx.fillStyle = '#7a4500';
    ctx.font = `900 ${Math.round(clamp(c.w * 0.12, 24, 40))}px ${FONT}`;
    ctx.fillText('황금 복권', c.w / 2, c.h / 2 - bandH * 0.15);
    ctx.font = `700 ${Math.round(clamp(c.w * 0.055, 13, 18))}px ${FONT}`;
    ctx.fillText('마구 문질러서 열기', c.w / 2, c.h / 2 + bandH * 0.24);
    ctx.restore();
  }

  /** 판 전체를 덮는 캔버스. 긁기는 destination-out 으로 지운다. */
  function makeCover(W, H) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = h('canvas', { class: 'sc-cover' });
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return {
      canvas,
      ctx,
      erase(x0, y0, x1, y1, r) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineCap = 'round';
        ctx.lineWidth = r * 2;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x1, y1, r, 0, Math.PI * 2);
        ctx.fill();
      },
      clearCell(c) {
        ctx.clearRect(c.x - 1, c.y - 1, c.w + 2, c.h + 2);
      },
    };
  }

  // ------------------------------------------------------------ 한 판

  function start(game) {
    let stageIdx = clamp(game.checkpoint || 0, 0, STAGES.length - 1);
    let accepting = false; // 지금 긁을 수 있는가
    let alive = true; // 이번 판이 아직 살아 있는가 (사진이 늦게 불려 올 때를 대비)
    let st = null; // 지금 긁는 복권의 상태
    let lastFx = -1;
    const savedRatios = []; // 격자 복권마다 "남긴 동전 ÷ 여유분"
    let bombsHit = 0;
    let goldSec = 0;
    let streak = 0; // 엉뚱한 칸 없이 이어서 찾은 당첨 칸 수. 점수가 100, 200, 300… 으로 커진다
    const ease = Math.min(game.retry, 3); // 재도전할수록 조금 넉넉하게
    const photoReady = loadPhoto();
    game.onCleanup(() => {
      alive = false;
    });

    /** 판(board)에 줄 수 있는 높이. 판 높이를 뺀 나머지 요소들을 재서 구한다. */
    function freeHeight(board) {
      const kids = Array.from(game.root.children);
      const gap = parseFloat(getComputedStyle(game.root).rowGap) || 12;
      const used = kids.reduce((sum, k) => sum + k.offsetHeight, 0) + gap * (kids.length - 1);
      return game.root.clientHeight - (used - board.offsetHeight) - 2;
    }

    // ----- 게이지
    function buildGauge(icon, label) {
      const fill = h('i');
      const ticks = h('div', { class: 'sc-ticks' });
      const num = h('b', { class: 'sc-gnum', html: '0<small>칸</small>' }); // 판 크기를 재기 전에도 제 높이를 갖도록 채워 둔다
      const el = h('div', { class: 'sc-gauge' }, [
        h('div', { class: 'sc-gicon', text: icon }),
        h('div', { class: 'sc-gbody' }, [
          h('div', { class: 'sc-grow' }, [h('span', { class: 'sc-glabel', text: label }), num]),
          h('div', { class: 'sc-gbar' }, [fill, ticks]),
        ]),
      ]);
      return { el, fill, ticks, num };
    }

    function paintCoin() {
      const g = Math.max(0, st.gauge);
      st.ui.fill.style.transform = `scaleX(${g / st.total})`;
      st.ui.num.innerHTML = `${(Math.ceil(g * 10 - 1e-6) / 10).toFixed(1)}<small>칸</small>`;
      st.ui.el.classList.toggle('low', g / st.total < 0.25);
    }

    function spend(amount) {
      st.gauge = Math.max(0, st.gauge - amount);
      paintCoin();
    }

    function paintGold() {
      const ratio = st.cells[0].count / st.cells[0].total;
      st.ui.fill.style.transform = `scaleX(${clamp(ratio, 0, 1)})`;
      st.ui.num.innerHTML = `${Math.floor(ratio * 100)}<small>% / ${S.revealRatio}%</small>`;
    }

    // ----- 긁기 입력
    function bindScratch(canvas) {
      const pointers = new Map();
      const at = (e) => {
        const r = canvas.getBoundingClientRect();
        return { x: ((e.clientX - r.left) * st.W) / r.width, y: ((e.clientY - r.top) * st.H) / r.height };
      };
      canvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (!accepting || !game.playing) return;
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch (err) {
          /* 잡지 못해도 긁기는 된다 */
        }
        const p = at(e);
        pointers.set(e.pointerId, p);
        scratch(p.x, p.y, p.x, p.y, e.clientX, e.clientY);
      });
      canvas.addEventListener('pointermove', (e) => {
        const last = pointers.get(e.pointerId);
        if (!last) return;
        if (!accepting || !game.playing) {
          pointers.delete(e.pointerId);
          return;
        }
        e.preventDefault();
        const p = at(e);
        pointers.set(e.pointerId, p);
        scratch(last.x, last.y, p.x, p.y, e.clientX, e.clientY);
      });
      const end = (e) => pointers.delete(e.pointerId);
      canvas.addEventListener('pointerup', end);
      canvas.addEventListener('pointercancel', end);
    }

    /** 판 좌표의 선분만큼 긁는다. 손가락과 검증 창구가 모두 이 함수를 쓴다. */
    function scratch(x0, y0, x1, y1, clientX, clientY) {
      if (!accepting) return;
      const s = st;
      s.cover.erase(x0, y0, x1, y1, s.brush);
      let any = false;
      for (const cell of s.cells) {
        if (cell.done) continue;
        const gained = markCell(cell, x0, y0, x1, y1, s.brush);
        if (!gained) continue;
        any = true;
        cell.count += gained;
        if (s.kind === 'grid') onGridScratch(cell, gained);
        else onGoldScratch(cell);
        if (!accepting) break; // 방금 긁은 것으로 복권이 끝났다
      }
      if (any) scratchFx(clientX, clientY);
    }

    function scratchFx(x, y) {
      if (game.time - lastFx < 0.055) return;
      lastFx = game.time;
      Arcade.audio.noise({ dur: 0.07, freq: rand(2400, 4200), vol: 0.07, q: 1.5 });
      const gold = st.kind === 'gold';
      fx.burst({ x, y }, { count: gold ? 3 : 2, colors: st.def.flakes, spread: 34, size: 5, life: 420 });
      if (gold && Math.random() < 0.3) fx.burst({ x, y }, { count: 1, emoji: '✨', spread: 46, size: 8, life: 600 });
      if (Math.random() < 0.3) Arcade.vibrate(5);
    }

    // ----- 격자 복권 (1, 2스테이지)
    function buildGrid(def, time) {
      const n = def.n;
      const bombCount = def.bombs ? Math.min(S.bombs, n * n - NEED - 2) : 0;
      const slack = S.coinSlack * def.slackMul + ease * 0.4;
      const total = NEED + slack; // 정답 세 칸을 다 긁는 값 + 엿보기 여유
      const ui = buildGauge('🪙', '동전 게이지');
      for (let k = 1; k < total; k++) ui.ticks.appendChild(h('span', { style: { left: (k / total) * 100 + '%' } }));
      const slots = h('div', { class: 'sc-slots' }, [0, 1, 2].map(() => h('i', { text: '?' })));
      const bombChip = bombCount ? h('div', { class: 'sc-bombs' }) : null;
      const board = h('div', { class: 'sc-board' });
      const ticket = h('div', { class: 'sc-ticket ' + def.theme }, [
        h('div', { class: 'sc-head' }, [h('div', { class: 'sc-name', text: def.name }), bombChip, slots]),
        board,
      ]);
      game.root.append(ui.el, ticket, h('div', { class: 'sc-tip', text: '💡 ' + def.tip }));

      const size = Math.floor(Math.min(game.root.clientWidth - PAD * 2, freeHeight(board), 380));
      board.style.width = size + 'px';
      board.style.height = size + 'px';
      const gap = Math.round(size * 0.022);
      const cs = (size - gap * (n - 1)) / n;
      const cover = makeCover(size, size);
      const cells = makeDeck(n, bombCount, def.pool).map((card, i) => {
        const c = Object.assign(makeCell((i % n) * (cs + gap), Math.floor(i / n) * (cs + gap), cs, cs, SAMPLES, SAMPLES), card);
        c.el = h(
          'div',
          {
            class: 'sc-cell',
            style: { left: c.x + 'px', top: c.y + 'px', width: cs + 'px', height: cs + 'px', fontSize: Math.round(cs * 0.56) + 'px' },
          },
          h('span', { text: card.sym })
        );
        board.appendChild(c.el);
        paintFoil(cover.ctx, c, FOILS[def.theme], cs * 0.12, '?');
        return c;
      });
      board.appendChild(cover.canvas);
      bindScratch(cover.canvas);

      st = {
        def,
        kind: 'grid',
        W: size,
        H: size,
        cells,
        cover,
        brush: Math.max(9, cs * 0.12),
        time,
        total,
        slack,
        gauge: total,
        hits: 0,
        clean: true, // 엉뚱한 칸을 다 긁거나 꽝을 터뜨리지 않았는가
        bombsLeft: bombCount,
        ui,
        slots,
        bombChip,
      };
      paintCoin();
      paintBombs();
    }

    function paintBombs() {
      if (st.bombChip) st.bombChip.textContent = `💣 ${st.bombsLeft}개 숨음`;
    }

    function onGridScratch(cell, gained) {
      // 한 칸에 드는 동전은 많아야 1칸이다. "다 긁었다"는 넓이를 넘겨 긁은 만큼은 받지 않는다
      const cap = Math.ceil(FULL * cell.total);
      const paid = Math.min(gained, Math.max(0, cap - (cell.count - gained)));
      spend(paid / cell.total / FULL);
      const ratio = cell.count / cell.total;
      if (cell.bomb) {
        if (ratio >= BOMB_AT) explode(cell);
        else if (ratio >= FUSE_AT && !cell.fuse) {
          cell.fuse = true;
          cell.el.classList.add('fuse');
          sfx('warn');
          fx.toast('💣 꽝이다! 멈춰!', { kind: 'bad', ms: 1000 });
        }
      } else if (ratio >= FULL) {
        openCell(cell);
      }
      if (accepting && st.gauge <= 0) fail('동전이 다 닳았어요.<br>살짝만 긁어 엿보면 동전을 아낄 수 있어요.', '🪙');
    }

    /** 칸을 다 긁었다: 남은 덮개가 저절로 벗겨진다. */
    function openCell(cell) {
      cell.done = true;
      st.cover.clearCell(cell);
      cell.el.classList.add('open');
      fx.burst(cell.el, { count: 10, colors: st.def.flakes, spread: 60, size: 7 });
      if (cell.win) {
        st.hits++;
        const slot = st.slots.children[st.hits - 1];
        slot.textContent = cell.sym;
        slot.classList.add('on');
        cell.el.classList.add('hit');
        streak++;
        sfx('combo', streak * 2);
        game.addScore(100 * streak, cell.el);
        fx.burst(cell.el, { count: 8, emoji: '✨', spread: 70, size: 9 });
        if (st.hits >= NEED) stageClear();
      } else {
        st.clean = false;
        streak = 0;
        cell.el.classList.add('dud');
        sfx('miss');
        fx.shake(cell.el, 5);
        fx.toast('3개짜리가 아니에요', { kind: 'bad', ms: 900 });
      }
    }

    function explode(cell) {
      cell.done = true;
      st.cover.clearCell(cell);
      cell.el.classList.remove('fuse');
      cell.el.classList.add('open', 'boom');
      st.clean = false;
      st.bombsLeft--;
      bombsHit++;
      paintBombs();
      streak = 0;
      sfx('boom');
      fx.burst(cell.el, { count: 10, emoji: ['💥', '🔥'], spread: 90, size: 11 });
      spend(BOMB_COST);
      fx.floatText(st.ui.num, `-${BOMB_COST}칸`, { color: '#ff5d73', size: 20, rise: -34 });
      fx.shake(st.ui.el, 6);
      if (game.loseLife(cell.el) <= 0) fail('꽝을 너무 많이 긁었어요.<br>검은 그림이 보이면 바로 멈추세요.', '💥');
    }

    /** 남은 덮개를 모두 걷어 배치를 보여 준다. */
    function revealAll() {
      st.cells.forEach((cell) => {
        if (cell.done) return;
        cell.done = true;
        st.cover.clearCell(cell);
        cell.el.classList.remove('fuse');
        cell.el.classList.add('open', cell.win ? 'hit' : 'late');
      });
    }

    async function stageClear() {
      accepting = false;
      const s = st;
      const timeLeft = game.timeLeft();
      game.stopTimer();
      revealAll();
      savedRatios.push(clamp(s.gauge / s.slack, 0, 1));
      const bonus = Math.round(s.gauge * 20) * 10 + Math.ceil(timeLeft) * 10 + (s.clean ? 300 : 0);
      sfx('great');
      fx.confetti(40);
      Arcade.vibrate([40, 40, 80]);
      game.addScore(bonus, s.ui.el);
      await game.banner(s.clean ? '깔끔한 당첨!' : '당첨!', `남은 동전 ${s.gauge.toFixed(1)}칸 · +${fmt(bonus)}점`, { ms: 1700, kind: 'good' });
      stageIdx++;
      runStage();
    }

    // ----- 황금 복권 (3스테이지)
    function buildGold(def, photo, time) {
      const ui = buildGauge('📸', '사진 공개');
      ui.el.classList.add('gold');
      ui.ticks.appendChild(h('span', { class: 'goal', style: { left: S.revealRatio + '%' } }));
      const board = h('div', { class: 'sc-board photo' });
      const ticket = h('div', { class: 'sc-ticket gold' }, board);
      const doneBtn = h('button', { class: 'ar-btn gold lg block', disabled: true, text: '🔒 다 긁으면 열려요' });
      game.footer.append(doneBtn);
      game.root.append(ui.el, ticket);

      // 사진이 잘리지 않도록 판을 사진 비율에 맞춘다
      const aspect = photo ? clamp(photo.aspect, 0.6, 1.7) : 0.8;
      const maxW = Math.min(game.root.clientWidth, 400) - PAD * 2;
      const box = fitBox(maxW, freeHeight(board), aspect);
      board.style.width = box.w + 'px';
      board.style.height = box.h + 'px';
      if (photo) {
        photo.img.className = 'sc-photo';
        photo.img.alt = '보물 단서 사진';
        photo.img.draggable = false;
        board.appendChild(photo.img);
      } else {
        board.appendChild(
          h('div', { class: 'sc-prize' }, [
            h('div', { class: 'e', text: '🏆' }),
            h('div', { class: 't', text: '황금 복권 당첨!' }),
            h('div', { class: 's', text: '부모님이 설정에서 사진을 올리면 여기에 보물 단서가 나와요' }),
          ])
        );
      }
      const cell = makeCell(0, 0, box.w, box.h, Math.round(box.w / 9), Math.round(box.h / 9));
      const cover = makeCover(box.w, box.h);
      paintGoldFoil(cover.ctx, cell);
      board.appendChild(cover.canvas);
      bindScratch(cover.canvas);

      st = {
        def,
        kind: 'gold',
        W: box.w,
        H: box.h,
        cells: [cell],
        cover,
        brush: Math.max(12, box.w * 0.04),
        time,
        step: 0,
        photo,
        aspect,
        maxW,
        board,
        ui,
        doneBtn,
        opened: false,
      };
      paintGold();
    }

    function onGoldScratch(cell) {
      const ratio = cell.count / cell.total;
      paintGold();
      const step = Math.floor(ratio * 10);
      if (step > st.step) {
        st.step = step;
        sfx('combo', step + 2); // 많이 드러날수록 음이 올라간다
      }
      if (ratio >= S.revealRatio / 100) openGold();
    }

    /** 황금 복권이 열렸다: 덮개를 걷고, 사진을 크게 또렷하게 보여 준다. 결과 화면은 아이가 버튼을 누른 뒤에 띄운다. */
    function openGold() {
      accepting = false;
      const s = st;
      const timeLeft = game.timeLeft();
      goldSec = s.time - timeLeft;
      game.stopTimer();
      Arcade.audio.music.setIntensity(0.1);
      s.opened = true;
      s.cells[0].done = true;
      s.cover.canvas.classList.add('gone');
      sfx('unlock');
      fx.flash('rgba(255, 209, 102, 0.4)');
      fx.confetti(80);
      fx.burst(s.board, { count: 16, emoji: ['✨', '⭐'], spread: 160, size: 11, life: 900 });
      Arcade.vibrate([60, 40, 120]);
      game.addScore(500 + Math.ceil(timeLeft) * 30, s.board);
      game.setGoal(s.photo ? '사진 속 <b>단서</b>를 잘 봐 두세요!' : '<b>황금 복권 당첨!</b> 축하해요');

      // 게이지를 치우고 그 자리만큼 사진을 키운다
      s.ui.el.remove();
      const box = fitBox(s.maxW, freeHeight(s.board), s.aspect);
      s.board.style.width = box.w + 'px';
      s.board.style.height = box.h + 'px';

      // 문지르던 손이 바로 누르지 않도록 잠깐 뒤에 버튼을 연다
      game.after(900, () => {
        s.cover.canvas.remove();
        s.doneBtn.disabled = false;
        s.doneBtn.textContent = s.photo ? '사진 확인 완료 ▶' : '당첨 확인 ▶';
        s.doneBtn.addEventListener('click', finish);
        fx.pop(s.doneBtn);
      });
    }

    function finish() {
      if (!game.playing) return;
      const lost = S.lives - game.lives;
      // 격자 복권을 건너뛰고 황금 복권만 다시 한 판은 여유를 보통만큼 남긴 것으로 친다
      const kept = savedRatios.length ? savedRatios.reduce((a, b) => a + b, 0) / savedRatios.length : 0.2;
      let stars = lost === 0 && kept >= 0.4 ? 3 : lost <= 1 && kept >= 0.15 ? 2 : 1;
      if (game.retry > 0) stars = Math.min(stars, 2);
      const photo = st.photo;
      const thumb =
        photo && /^data:image\/[\w.+-]+;base64,[A-Za-z0-9+/=]+$/.test(photo.url)
          ? `<img class="sc-thumb" src="${photo.url}" alt="보물 단서 사진">`
          : '';
      const text = stars === 3 ? '동전도 하트도 아낀 완벽한 당첨!' : photo ? '세 장 모두 당첨! 사진 속 단서를 기억하세요.' : '복권 세 장 모두 당첨!';
      game.win({
        stars,
        title: '황금 복권 당첨!',
        message: thumb + text,
        stats: [
          ['아낀 동전 여유', savedRatios.length ? `${Math.round(kept * 100)}%` : '-'],
          ['터뜨린 꽝', `${bombsHit}개`],
          ['황금 복권', `${goldSec.toFixed(1)}초`],
        ],
      });
    }

    // ----- 진행
    function fail(message, icon) {
      if (!accepting) return;
      accepting = false;
      game.stopTimer();
      const grid = st.kind === 'grid';
      if (grid) revealAll(); // 정답이 어디 있었는지 보여 준다
      game.after(grid ? 1400 : 300, () => game.lose({ message, icon, checkpoint: stageIdx }));
    }

    async function runStage() {
      const def = STAGES[stageIdx];
      accepting = false;
      game.root.innerHTML = '';
      game.footer.innerHTML = '';
      game.setStage(stageIdx, STAGES.length);
      game.setGoal(def.goal);
      // 시간 막대를 먼저 띄운다. 위쪽 표시가 다 자리를 잡은 뒤에 판 크기를 재야 한다
      const grid = def.kind === 'grid';
      const time = grid ? S.stageTime * def.timeMul + ease * 5 : S.goldTime + ease * 4;
      const timeUp = grid ? '시간이 다 됐어요.' : '시간 안에 다 긁지 못했어요.<br>더 빠르게 문질러 보세요!';
      const timer = game.startTimer(time, { intensity: 0.15 + stageIdx * 0.2, onEnd: () => fail(timeUp, '⏰') });
      timer.pause(); // 안내가 떠 있는 동안에는 시간이 가지 않는다
      if (grid) {
        buildGrid(def, time);
      } else {
        const photo = await photoReady;
        if (!alive) return;
        buildGold(def, photo, time);
      }
      await game.banner(def.name, def.sub, { ms: 1500 });
      timer.resume();
      accepting = true;
    }

    if (game.debug) {
      // 검증용 창구. 손가락과 같은 scratch() 를 거친다
      const toClient = (x, y) => {
        const r = st.cover.canvas.getBoundingClientRect();
        return { x: r.left + (x / st.W) * r.width, y: r.top + (y / st.H) * r.height };
      };
      window.__game = {
        settings: S,
        makeDeck,
        pools: STAGES.map((s) => s.pool || []),
        accepting: () => accepting,
        state: () =>
          st && {
            stage: stageIdx,
            kind: st.kind,
            gauge: st.gauge,
            total: st.total,
            slack: st.slack,
            hits: st.hits,
            brush: st.brush,
            time: st.time,
            photo: !!st.photo,
            opened: !!st.opened,
            cells: st.cells.map((c) => ({ sym: c.sym, win: !!c.win, bomb: !!c.bomb, done: c.done, ratio: c.count / c.total })),
          },
        /** 칸 안의 한 점(0~1)을 화면 좌표로 바꾼다. 실제 드래그 시험에 쓴다 */
        point: (i, u = 0.5, v = 0.5) => toClient(st.cells[i].x + st.cells[i].w * u, st.cells[i].y + st.cells[i].h * v),
        /** 칸 가운데를 톡 찍어 엿본다 */
        peek(i) {
          const c = st.cells[i];
          const p = toClient(c.x + c.w / 2, c.y + c.h / 2);
          scratch(c.x + c.w / 2, c.y + c.h / 2, c.x + c.w / 2, c.y + c.h / 2, p.x, p.y);
        },
        /** 칸을 비율 upTo 까지(기본은 끝까지) 줄줄이 긁는다. 옆 칸으로 번지지 않게 안쪽만 긁는다 */
        rub(i, upTo = 1) {
          const c = st.cells[i];
          const r = st.brush;
          const span = c.w - r * 2;
          for (let y = c.y + r; y <= c.y + c.h - r + 0.01; y += r * 1.5) {
            for (let k = 0; k < 8; k++) {
              if (!accepting || c.done || c.count / c.total >= upTo) return;
              const xa = c.x + r + (span * k) / 8;
              const xb = c.x + r + (span * (k + 1)) / 8;
              const p = toClient(xb, y);
              scratch(xa, y, xb, y, p.x, p.y);
            }
          }
        },
      };
    }

    runStage();
  }

  Arcade.createGame({
    id: GAME_ID,
    title: '복권 긁기',
    icon: '🎫',
    accent: '#ff6aa8',
    accent2: '#ffc145',
    tagline: '복권 세 장, 어디를 끝까지 긁을까?',
    howTo: [
      '<b>살짝만</b> 긁어 숨은 그림을 엿보세요',
      '<b>같은 그림 3개</b>만 끝까지 긁으면 당첨',
      '긁는 만큼 <b>동전</b>이 닳아요. <b>💣 꽝</b> 조심!',
    ],
    lives: S.lives,
    stages: STAGES.length,
    start,
  });
})();
