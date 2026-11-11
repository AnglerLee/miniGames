// 둘이서 한 호흡: 한 폰을 둘이 나눠 잡고 왼쪽(파랑)·오른쪽(분홍)을 하나씩 맡는 협동 게임
// 같이 따라가기 → 동시 박자 → 줄다리기 균형. 재미의 중심은 "하나, 둘, 셋!" 하고 동시에 해냈을 때다.
(function () {
  'use strict';

  const { h, clamp, lerp, rand, pick, sfx, fx } = Arcade;
  const GAME_ID = 'game21';

  // ----- 설정 (관리자 페이지와 같은 키. 옛 값 { difficulty: 'normal', goalTime, ... } 이 남아 있어도 읽힌다)
  const PRESETS = [
    { syncTolerance: 0.12, stageTime: 45, moveSpeed: 0.5, lives: 4 },
    { syncTolerance: 0.09, stageTime: 40, moveSpeed: 0.75, lives: 3 },
    { syncTolerance: 0.06, stageTime: 35, moveSpeed: 1.0, lives: 3 },
  ];
  const LIMITS = { syncTolerance: [0.04, 0.3], stageTime: [20, 120], moveSpeed: [0.3, 2], lives: [1, 5] };
  const saved = Arcade.loadSettings('dual_touch_settings', {});
  const level = clamp(parseInt(saved.difficulty, 10) || 0, 0, 2);
  const S = Object.assign({}, PRESETS[level]);
  Object.keys(LIMITS).forEach((key) => {
    const v = Number(saved[key]);
    if (Number.isFinite(v) && v > 0) S[key] = clamp(v, LIMITS[key][0], LIMITS[key][1]);
  });
  S.lives = Math.round(S.lives);

  const SIDES = ['L', 'R'];
  const RGB = { L: '77,141,255', R: '255,93,158' };
  const col = (side, a) => `rgba(${RGB[side]},${a})`;
  const GOLD = '#ffd166';
  const FONT = "system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
  const GAP = 8; // 두 구역 사이 틈(px)

  const BPM = [88, 96, 104][level];
  const LEAD = [1.6, 1.4, 1.25][level]; // 음표가 위에서 판정선까지 내려오는 시간(초)
  const GOOD_WIN = [0.16, 0.14, 0.12][level]; // 박자 판정 너비(초, ±)
  const PERFECT_WIN = 0.06;
  const COUNT_IN = 4; // 노래 앞에서 세는 박자 수
  const COUNT_WORDS = ['하나', '둘', '셋', '시작!'];
  const BASS = [130.81, 110, 87.31, 98]; // 도-라-파-솔
  const FOLLOW_FILL = 15; // 1스테이지: 둘 다 원 안에 있어야 하는 시간(초)
  const BALANCE_FILL = 14; // 3스테이지: 균형을 지켜야 하는 시간(초)
  const WIND = [0.32, 0.45, 0.58][level];

  const STAGES = [
    { banner: ['스테이지 1', '같이 따라가기'], goal: '둘 다 <b>원 안에</b> 손가락을 두고 따라가요', label: '호흡' },
    { banner: ['스테이지 2', '동시 박자'], goal: '선에 닿을 때 톡! <b>함께!</b>는 동시에', label: '함께!' },
    { banner: ['마지막 스테이지', '줄다리기 균형'], goal: '두 손을 <b>같은 높이</b>로, 막대는 <b>금색 띠</b>에', label: '균형' },
  ];

  /** 2스테이지 악보. 한 마디는 8분음표 8칸. L·R 은 한쪽, B 는 '함께!' */
  function makeChart(lv) {
    const P = {
      warm: ['L.R.L.R.', 'R.L.R.L.'],
      intro: ['L.R.B...', 'R.L.B...', 'L.L.R.B.'],
      mix: ['B.L.R.B.', 'R.R.L.B.', 'L.B.R.B.', 'B...L.R.', 'L.R.B.B.'],
      fast: ['L.RLB...', 'R.LRB...', 'B.LR.RB.', 'LR..B.B.'],
      end: ['B.B.B...'],
    };
    const plan = ['warm', 'warm', 'intro', 'intro', 'mix', 'mix', lv >= 1 ? 'fast' : 'mix', lv >= 2 ? 'fast' : 'mix', 'mix', 'end'];
    const notes = [];
    let prev = '';
    plan.forEach((kind, bar) => {
      const pool = P[kind].filter((p) => p !== prev);
      const pat = pick(pool.length ? pool : P[kind]);
      prev = pat;
      let nth = 0;
      for (let i = 0; i < 8; i++) {
        if (pat[i] === '.') continue;
        // 마지막 마디는 "하나, 둘, 셋!" 세 번 함께
        const word = kind === 'end' ? ['하나', '둘', '셋!'][nth++] : '함께!';
        notes.push({ beat: COUNT_IN + bar * 4 + i / 2, lane: pat[i], label: word });
      }
    });
    return notes;
  }

  // ----- 그리기 도우미
  const approach = (a, b, step) => (a < b ? Math.min(b, a + step) : Math.max(b, a - step));
  const smooth = (k) => k * k * (3 - 2 * k);
  function circlePath(c, x, y, r) {
    c.beginPath();
    c.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
  }
  function disc(c, x, y, r, fill) {
    circlePath(c, x, y, r);
    c.fillStyle = fill;
    c.fill();
  }
  function ring(c, x, y, r, stroke, width) {
    circlePath(c, x, y, r);
    c.strokeStyle = stroke;
    c.lineWidth = width;
    c.stroke();
  }
  function glow(c, color, blur) {
    c.shadowColor = color;
    c.shadowBlur = blur;
  }
  function label(c, text, x, y, font, fill) {
    c.font = font;
    if (fill) c.fillStyle = fill;
    c.fillText(text, x, y);
  }
  function roundPath(c, x, y, w, hh, r) {
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, hh, r);
    else c.rect(x, y, w, hh);
  }
  function starPath(c, x, y, ro, ri) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? ri : ro;
      c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    c.closePath();
  }
  function line(c, x1, y1, x2, y2) {
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
  }

  function start(game) {
    const retry = Math.min(game.retry, 3);
    const tol = S.syncTolerance + retry * 0.02; // '함께!' 허용 오차(초). 재도전하면 넓어진다
    const stageSec = S.stageTime + retry * 5;
    let stageIdx = game.checkpoint;
    let scene = null;
    let heartsLost = 0;
    let perfectTogether = 0;
    let togetherTotal = 0;
    const diffs = []; // '함께!' 음표에서 두 사람이 누른 시간 차(초)
    let W = 0;
    let H = 0;
    let rect = { left: 0, top: 0 };
    let lastReal = performance.now(); // 마지막 프레임의 실제 시각(ms). 터치 시각을 정확히 재는 데 쓴다
    let auto = false;

    // ----- 화면
    const keyHint = (k) => `<span class="dt-key">${k}</span>`;
    const zoneEl = {
      L: h('div', { class: 'dt-zone left' }, h('div', { class: 'dt-tag', html: '<i></i>파랑' + keyHint('F') })),
      R: h('div', { class: 'dt-zone right' }, h('div', { class: 'dt-tag', html: '<i></i>분홍' + keyHint('J') })),
    };
    const cv = h('canvas', { class: 'dt-canvas' });
    const ctx = cv.getContext('2d');
    const promptEl = h('div', { class: 'dt-prompt ar-hidden' });
    const board = h('div', { class: 'dt-board' }, [zoneEl.L, zoneEl.R, cv, promptEl]);
    const infoLabel = h('span', { class: 'ar-chip dt-label' });
    const meterFill = h('i');
    const meter = h('div', { class: 'dt-meter' }, meterFill);
    const infoVal = h('b', { class: 'dt-val' });
    game.root.append(h('div', { class: 'dt-info' }, [infoLabel, meter, infoVal]), board);

    function measure() {
      const w = board.clientWidth;
      const hh = board.clientHeight;
      if (w !== W || hh !== H) {
        W = w;
        H = hh;
        const dpr = Math.min(3, window.devicePixelRatio || 1);
        cv.width = Math.max(1, Math.round(W * dpr));
        cv.height = Math.max(1, Math.round(H * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      rect = board.getBoundingClientRect();
    }
    function zone(side) {
      const w = (W - GAP) / 2;
      const x0 = side === 'L' ? 0 : W - w;
      return { x0, w, cx: x0 + w / 2 };
    }
    const screen = (x, y) => ({ x: rect.left + x, y: rect.top + y });

    function setPrompt(html, big) {
      if (!html) {
        promptEl.classList.add('ar-hidden');
        return;
      }
      promptEl.className = 'dt-prompt' + (big ? ' big' : '');
      promptEl.innerHTML = html;
      if (big) {
        void promptEl.offsetWidth;
        promptEl.classList.add('beat');
      }
    }
    function setInfo(k, text) {
      meterFill.style.transform = `scaleX(${clamp(k, 0, 1)})`;
      infoVal.textContent = text;
    }
    const mult = () => (game.combo >= 10 ? 2 : game.combo >= 5 ? 1.5 : 1);

    // ----- 입력: 손가락마다 따로 추적한다 (pointerId → 맡은 쪽과 판 좌표)
    const pointers = new Map();
    const keys = { L: false, R: false };
    function finger(side) {
      let f = null;
      pointers.forEach((p) => {
        if (p.side === side) f = p; // 가장 나중에 댄 손가락
      });
      return f;
    }
    const holding = (side) => keys[side] || !!finger(side);
    function stamp(e) {
      const now = performance.now();
      const t = e && e.timeStamp;
      return t && Math.abs(now - t) < 250 ? t : now;
    }
    function press(side, real) {
      if (game.playing && scene && scene.press) scene.press(side, real);
    }
    function put(id, x, y, real) {
      const side = x < W / 2 ? 'L' : 'R';
      pointers.delete(id);
      pointers.set(id, { side, x, y });
      press(side, real);
    }
    function vput(side, x, y) {
      const p = pointers.get('v' + side);
      if (p) Object.assign(p, { x, y });
      else put('v' + side, x, y, performance.now());
    }
    board.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (!game.playing) return;
      try {
        board.setPointerCapture(e.pointerId);
      } catch (err) {
        /* 캡처를 못 해도 손가락은 따라간다 */
      }
      put(e.pointerId, e.clientX - rect.left, e.clientY - rect.top, stamp(e));
    });
    board.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (p) Object.assign(p, { x: e.clientX - rect.left, y: e.clientY - rect.top });
    });
    const lift = (e) => pointers.delete(e.pointerId);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => board.addEventListener(t, lift));

    // PC 에서는 F(왼쪽)·J(오른쪽) 키로도 한다
    const keySide = (e) => (e.code === 'KeyF' ? 'L' : e.code === 'KeyJ' ? 'R' : null);
    game.on(window, 'keydown', (e) => {
      const side = keySide(e);
      if (!side) return;
      e.preventDefault();
      if (e.repeat || keys[side]) return;
      keys[side] = true;
      press(side, stamp(e));
    });
    game.on(window, 'keyup', (e) => {
      const side = keySide(e);
      if (side) keys[side] = false;
    });
    game.on(window, 'blur', () => Object.assign(keys, { L: false, R: false }));

    const zoneOn = { L: false, R: false };
    function paintZones() {
      SIDES.forEach((s) => {
        const on = holding(s);
        if (on === zoneOn[s]) return;
        zoneOn[s] = on;
        zoneEl[s].classList.toggle('on', on);
      });
    }

    // ----- 공통 진행
    function loseHeart(msg, at) {
      heartsLost++;
      game.resetCombo();
      if (msg) fx.toast(msg, { kind: 'bad', ms: 900 });
      if (game.loseLife(at) > 0) return false;
      game.lose({ title: '하트를 모두 잃었어요', message: '다시 하면 판정이 조금 너그러워져요.', checkpoint: stageIdx });
      return true;
    }
    function timeUp() {
      game.lose({ title: '시간이 다 됐어요', icon: '⏰', message: '게이지를 다 채우지 못했어요. 다시 하면 조금 너그러워져요.', checkpoint: stageIdx });
    }

    /**
     * 1·3스테이지 공통: 두 사람이 손가락을 올릴 때까지 시간을 멈추고 기다렸다가 출발하고,
     * 스테이지 시간 안에 게이지를 채우면 클리어. 일시 정지에서 돌아오면 다시 기다린다.
     */
    function gaugeStage(sc, waitText) {
      const toWait = () => {
        sc.phase = 'wait';
        if (sc.timer) sc.timer.pause();
        setPrompt(waitText);
      };
      sc.begin = () => {
        sc.timer = game.startTimer(stageSec, { onEnd: timeUp });
        toWait();
      };
      sc.resume = () => sc.phase === 'run' && toWait();
      sc.go = () => {
        sc.phase = 'run';
        setPrompt('');
        sc.timer.resume();
        sfx('go');
        fx.toast('출발!', { kind: 'good', ms: 700 });
      };
      sc.fill = (gauge, active) => {
        sc.gauge = clamp(gauge, 0, 1);
        meter.classList.toggle('idle', !active);
        setInfo(sc.gauge, Math.floor(sc.gauge * 100) + '%');
        if (sc.gauge >= 1) sc.finish();
      };
      sc.finish = () => {
        sc.phase = 'done';
        sc.gauge = 1;
        meter.classList.remove('idle');
        setInfo(1, '100%');
        stageClear();
      };
      sc.skip = () => {
        if (sc.phase === 'intro' || sc.phase === 'done') return false;
        sc.finish();
        return true;
      };
      // 이어서 잘하면 찰떡 콤보 (every 초마다 +1), 잠깐(grace 초) 넘게 흐트러지면 끊긴다
      sc.streak = (good, dt, every, grace, points, at) => {
        if (good) {
          sc.off = 0;
          sc.run = (sc.run || 0) + dt;
          if (sc.run < every) return;
          sc.run -= every;
          game.addCombo();
          game.addScore(Math.round(points * mult()), at());
        } else {
          sc.run = 0;
          sc.off = (sc.off || 0) + dt;
          if (sc.off > grace && game.combo > 0) game.resetCombo();
        }
      };
      sc.gauge = 0;
      setInfo(0, '0%');
      return sc;
    }

    // ----- 스테이지 1: 같이 따라가기
    function followScene() {
      const MODES = {
        mirror: { mx: -1, dphi: 0, say: '🪞 거울처럼!' },
        side: { mx: 1, dphi: 0, say: '↔ 나란히!' },
        split: { mx: -1, dphi: Math.PI, say: '↕ 서로 반대로!' },
        cross: { mx: 1, dphi: Math.PI, say: '↕ 엇갈려 가요!' },
      };
      const ORDER = ['side', 'split', 'mirror', 'cross'];
      const sc = { phase: 'intro', s: 0, mx: -1, dphi: 0, goal: MODES.mirror, order: 0, nextMode: 7, t: 0 };
      Object.assign(sc, { in: { L: false, R: false }, both: false, lastMiss: -9, star: null, nextStar: 5 });
      gaugeStage(sc, '두 손가락을 <b>원</b>에 올려요');
      const radius = () => clamp(zone('L').w * 0.2, 24, 40);
      const slack = 16 + retry * 8; // 원 밖으로 이만큼은 봐준다(px)

      // 원의 길: 리사주 곡선. 오른쪽 원은 mx(좌우 거울)와 dphi(위아래 반대)만큼 달라진다
      function pos(side, s, mx, dphi) {
        const z = zone(side);
        const r = radius();
        const top = r + 8;
        const bot = H - r - 36;
        const ax = Math.max(0, z.w / 2 - r - 6);
        const ay = Math.max(0, (bot - top) / 2);
        const u = Math.sin(s);
        const v = Math.sin(s * 1.5 + (side === 'R' ? dphi : 0));
        return { x: z.cx + ax * (side === 'R' ? u * mx : u), y: (top + bot) / 2 + ay * v };
      }
      const here = (side) => pos(side, sc.s, sc.mx, sc.dphi);
      // 위아래로 가장 빠를 때 초당 약 150px × moveSpeed. 게이지가 찰수록 조금 빨라진다
      function rate() {
        const ay = Math.max(60, (H - 2 * radius() - 44) / 2);
        return ((100 * S.moveSpeed) / ay) * (1 + 0.3 * sc.gauge) * (1 - 0.08 * retry);
      }
      function inside(side, p) {
        if (keys[side]) return true;
        const f = finger(side);
        return !!f && Math.hypot(f.x - p.x, f.y - p.y) <= radius() + slack;
      }

      // 원에서 조금 떨어진 곳에 보너스 별: 잠깐 원을 벗어나 따러 갈지 고른다
      function bonusStar() {
        const st = sc.star;
        if (st) {
          const f = finger(st.side);
          if (f && Math.hypot(f.x - st.x, f.y - st.y) <= 36) {
            sc.star = null;
            sc.nextStar = sc.t + rand(7, 10);
            game.addScore(250, screen(st.x, st.y));
            sfx('coin');
            fx.burst(screen(st.x, st.y), { emoji: '⭐', count: 6, spread: 60, size: 10 });
          } else if (sc.t >= st.until) {
            sc.star = null;
            sc.nextStar = sc.t + rand(5, 8);
          }
          return;
        }
        if (sc.t < sc.nextStar) return;
        const side = pick(SIDES);
        const z = zone(side);
        const p = here(side);
        const r = radius();
        for (let i = 0; i < 16; i++) {
          const x = rand(z.x0 + 28, z.x0 + z.w - 28);
          const y = rand(40, H - 64);
          const d = Math.hypot(x - p.x, y - p.y);
          if (d >= r * 2.4 && d <= r * 5) {
            sc.star = { side, x, y, until: sc.t + 4 };
            sfx('pop');
            return;
          }
        }
        sc.nextStar = sc.t + 2;
      }

      sc.update = (dt) => {
        if (sc.phase !== 'wait' && sc.phase !== 'run') return;
        const pL = here('L');
        const pR = here('R');
        sc.in.L = inside('L', pL);
        sc.in.R = inside('R', pR);
        const both = sc.in.L && sc.in.R;
        if (sc.phase === 'wait') {
          if (both) sc.go();
          sc.both = both;
          return;
        }
        sc.t += dt;
        sc.s += rate() * dt;
        if (sc.t >= sc.nextMode) {
          sc.goal = MODES[ORDER[sc.order++ % ORDER.length]];
          sc.nextMode = sc.t + rand(5.5, 7);
          fx.toast(sc.goal.say, { kind: 'gold', ms: 1100 });
          sfx('whoosh');
        }
        sc.mx = approach(sc.mx, sc.goal.mx, 1.6 * dt);
        sc.dphi = approach(sc.dphi, sc.goal.dphi, 2.6 * dt);
        if (both && !sc.both) sfx('pick');
        if (!both && sc.both && sc.t - sc.lastMiss > 0.8) {
          sfx('miss');
          sc.lastMiss = sc.t;
        }
        sc.both = both;
        bonusStar();
        sc.streak(both, dt, 1.5, 0.35, 60, () => screen((pL.x + pR.x) / 2, (pL.y + pR.y) / 2));
        // 둘 다 안에 있으면 차고(서로 반대로 갈 때는 1.3배), 한쪽이라도 벗어나면 줄어든다
        const k = dt / FOLLOW_FILL;
        sc.fill(both ? sc.gauge + k * (sc.dphi > 1.5 ? 1.3 : 1) : sc.gauge - k * 0.5, both);
      };

      sc.draw = (c) => {
        const pL = here('L');
        const pR = here('R');
        const r = radius();
        const now = game.time;
        const running = sc.phase === 'run';
        // 두 원을 잇는 줄: 둘 다 안에 있으면 금빛
        c.save();
        c.lineCap = 'round';
        if (sc.both && running) {
          c.strokeStyle = GOLD;
          c.lineWidth = 5;
          glow(c, GOLD, 16);
        } else {
          c.strokeStyle = 'rgba(255,255,255,.2)';
          c.lineWidth = 2;
          c.setLineDash([6, 8]);
        }
        line(c, pL.x, pL.y, pR.x, pR.y);
        c.restore();
        // 앞으로 갈 길(점). 원 안에 겹치는 점은 그리지 않는다
        const rt = rate();
        SIDES.forEach((side) => {
          const cur = side === 'L' ? pL : pR;
          for (let k = 1; k <= 9; k++) {
            const ahead = k * 0.16;
            const p = pos(side, sc.s + rt * ahead, approach(sc.mx, sc.goal.mx, 1.6 * ahead), approach(sc.dphi, sc.goal.dphi, 2.6 * ahead));
            if (Math.hypot(p.x - cur.x, p.y - cur.y) >= r + 6) disc(c, p.x, p.y, 4.6 - k * 0.3, col(side, 0.6 - k * 0.055));
          }
        });
        // 원
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        SIDES.forEach((side) => {
          const p = side === 'L' ? pL : pR;
          const on = sc.in[side];
          const lost = running && !on;
          c.save();
          if (!running && !on) {
            const k = (now * 1.4) % 1;
            ring(c, p.x, p.y, r + 4 + k * 20, col(side, 0.7 * (1 - k)), 3);
          }
          if (on) glow(c, col(side, 0.9), 24);
          disc(c, p.x, p.y, r, col(side, on ? 0.78 : 0.3));
          c.shadowBlur = 0;
          ring(c, p.x, p.y, r, lost ? (Math.sin(now * 14) > 0 ? '#ff5d73' : 'rgba(255,93,115,.35)') : on ? '#fff' : col(side, 1), 4);
          if (!on && sc.phase !== 'done') label(c, '👆', p.x, p.y + 2, `${Math.round(r * 0.85)}px ${FONT}`);
          if (lost) label(c, '여기!', p.x, p.y - r - 12, `900 14px ${FONT}`, '#fff');
          c.restore();
        });
        // 보너스 별 (남은 시간 고리, 마지막 1초는 깜빡)
        const st = sc.star;
        if (st && (st.until - sc.t > 1 || Math.sin(now * 20) > -0.3)) {
          const k = 1 + 0.08 * Math.sin(now * 8);
          c.save();
          c.strokeStyle = 'rgba(255,209,102,.85)';
          c.lineWidth = 3;
          c.beginPath();
          c.arc(st.x, st.y, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp((st.until - sc.t) / 4, 0, 1));
          c.stroke();
          starPath(c, st.x, st.y, 15 * k, 6.5 * k);
          c.fillStyle = GOLD;
          glow(c, GOLD, 14);
          c.fill();
          c.restore();
        }
      };

      const targets = () => ({ L: here('L'), R: here('R') });
      sc.aim = () => {
        const t = targets();
        return { L: screen(t.L.x, t.L.y), R: screen(t.R.x, t.R.y) };
      };
      sc.auto = () => SIDES.forEach((s) => vput(s, targets()[s].x, targets()[s].y));
      sc.peek = () => ({ s: sc.s, mx: sc.mx, dphi: sc.dphi, in: Object.assign({}, sc.in), star: sc.star && { side: sc.star.side, at: screen(sc.star.x, sc.star.y) } });
      return sc;
    }

    // ----- 스테이지 2: 동시 박자
    function beatScene() {
      const spb = 60 / BPM;
      const notes = makeChart(level).map((n) => ({ lane: n.lane, label: n.label, t: n.beat * spb, hit: { L: null, R: null }, done: false }));
      const total = notes.filter((n) => n.lane === 'B').length;
      const win = GOOD_WIN + retry * 0.02;
      const endT = notes[notes.length - 1].t + 2 * spb;
      const sc = { phase: 'intro', songT: -0.5 * spb, next: 0, countFrom: 0, countTo: COUNT_IN, hold: 0, ok: 0, timer: null, flash: { L: 0, R: 0 } };
      const lineY = () => H - Math.max(80, H * 0.15); // 아래 이름표와 겹치지 않게
      const noteR = () => clamp(zone('L').w * 0.19, 22, 34);
      const lanePoint = (side) => screen(zone(side).cx, lineY());
      const centerPoint = () => screen(W / 2, lineY());
      // 터치한 실제 시각을 노래 시각으로 바꾼다 (프레임 사이에 누른 것도 정확히)
      const songAt = (real) => sc.songT + clamp((real - lastReal) / 1000, -0.05, 0.1);
      const end = () => {
        sc.phase = 'done';
        Arcade.audio.music.start();
        stageClear();
      };

      sc.begin = () => {
        Arcade.audio.music.stop(); // 엔진 배경 리듬 대신 이 노래의 박자를 직접 낸다
        sc.timer = game.startTimer(endT - sc.songT, { warnAt: 0 });
        sc.phase = 'run';
      };
      sc.resume = () => {
        Arcade.audio.music.stop();
        if (sc.phase !== 'run') return;
        // 일시 정지에서 돌아오면 네 박자 되감고 "하나, 둘, 셋"부터 다시 센다. 그동안 시간 막대는 멈춘다
        sc.songT -= COUNT_IN * spb;
        sc.next = Math.ceil(sc.songT / spb - 1e-6);
        sc.countFrom = sc.next;
        sc.countTo = sc.next + COUNT_IN;
        sc.hold = COUNT_IN * spb;
        sc.timer.pause();
      };

      function beatSound(k, delay) {
        const a = Arcade.audio;
        if (k >= sc.countFrom && k < sc.countTo) {
          const i = k - sc.countFrom;
          a.tone({ freq: i === COUNT_IN - 1 ? 1320 : 880, type: 'square', dur: 0.06, vol: 0.1, delay });
          game.after(delay * 1000, () => setPrompt(COUNT_WORDS[i], true));
          if (i === COUNT_IN - 1) game.after((delay + spb * 0.9) * 1000, () => setPrompt(''));
          return;
        }
        if (k < 0) return;
        a.tone({ freq: 120, to: 45, dur: 0.16, vol: 0.34, delay }); // 쿵
        if (k % 2 === 1) a.noise({ dur: 0.08, freq: 1800, vol: 0.08, delay }); // 짝
        a.noise({ dur: 0.03, freq: 8000, vol: 0.035, filter: 'highpass', delay: delay + spb / 2 }); // 치
        if (k % 2 === 0) {
          const bar = Math.floor((k - COUNT_IN) / 4);
          a.tone({ freq: BASS[((bar % 4) + 4) % 4], type: 'triangle', dur: spb * 0.9, vol: 0.11, delay });
        }
      }

      function late(n) {
        n.done = true;
        if (n.lane === 'B') {
          togetherTotal++;
          fx.floatText(centerPoint(), 'MISS', { color: '#ff5d73', size: 26 });
          loseHeart(!!n.hit.L !== !!n.hit.R ? '한쪽만 눌렀어요!' : '"함께!"를 놓쳤어요', null);
        } else {
          fx.floatText(lanePoint(n.lane), 'MISS', { color: '#ff5d73', size: 22 });
          loseHeart(null, null);
        }
      }

      function together(n) {
        n.done = true;
        togetherTotal++;
        const diff = Math.abs(n.hit.L.real - n.hit.R.real) / 1000;
        diffs.push(diff);
        const at = centerPoint();
        fx.floatText({ x: at.x, y: at.y + 34 }, diff.toFixed(3) + '초 차', { size: 15, color: '#fff' });
        if (diff > tol) {
          fx.floatText(at, '엇박!', { color: '#ff5d73', size: 28 });
          loseHeart('엇박! "하나, 둘, 셋!" 맞춰요', null);
          return;
        }
        const grade = diff <= Math.max(0.03, tol * 0.35) ? 'PERFECT' : diff <= tol * 0.7 ? 'GREAT' : 'GOOD';
        if (grade === 'PERFECT') perfectTogether++;
        sc.ok++;
        game.addCombo();
        game.addScore(Math.round({ PERFECT: 300, GREAT: 200, GOOD: 120 }[grade] * mult()));
        fx.floatText(at, grade === 'PERFECT' ? 'PERFECT!' : grade, { color: grade === 'GOOD' ? '#3ddc97' : GOLD, size: grade === 'PERFECT' ? 32 : 26 });
        fx.burst(at, { count: grade === 'PERFECT' ? 18 : 10, spread: 110, colors: [col('L', 1), col('R', 1), GOLD, '#fff'] });
        sfx(grade === 'PERFECT' ? 'perfect' : 'great');
        if (grade === 'PERFECT') fx.flash('rgba(255,209,102,.2)');
        Arcade.vibrate(30);
        setInfo(sc.ok / total, `${sc.ok}/${total}`);
      }

      sc.press = (side, real) => {
        if (sc.phase !== 'run') return;
        sc.flash[side] = 1;
        const tt = songAt(real);
        // 이 레인에서 아직 판정하지 않은 가장 이른 음표
        let n = null;
        for (const m of notes) {
          if (m.done || (m.lane !== side && m.lane !== 'B') || (m.lane === 'B' && m.hit[side])) continue;
          const d = tt - m.t;
          if (d > win) continue;
          if (d >= -win - 0.1) n = m;
          break;
        }
        if (!n) {
          Arcade.audio.tone({ freq: side === 'L' ? 392 : 523, type: 'triangle', dur: 0.06, vol: 0.08 });
          return;
        }
        const d = tt - n.t;
        if (d < -win) {
          // 너무 일찍 누르면 그 음표는 놓친 것으로 친다 (마구 누르기 막기)
          n.done = true;
          if (n.lane === 'B') togetherTotal++;
          fx.floatText(n.lane === 'B' ? centerPoint() : lanePoint(side), '너무 빨라!', { color: '#ff5d73', size: 20 });
          loseHeart(null, null);
          return;
        }
        if (n.lane === 'B') {
          n.hit[side] = { tt, real };
          Arcade.audio.tone({ freq: side === 'L' ? 587 : 880, type: 'triangle', dur: 0.08, vol: 0.14 });
          if (n.hit.L && n.hit.R) together(n);
          return;
        }
        n.done = true;
        const perfect = Math.abs(d) <= PERFECT_WIN;
        game.addCombo();
        game.addScore(Math.round((perfect ? 100 : 60) * mult()));
        fx.floatText(lanePoint(side), perfect ? 'PERFECT' : 'GOOD', { color: perfect ? GOLD : '#3ddc97', size: 22 });
        fx.burst(lanePoint(side), { count: perfect ? 10 : 6, spread: 60, colors: [col(side, 1), '#fff', GOLD] });
      };

      sc.update = (dt) => {
        if (sc.phase !== 'run') return;
        sc.songT += dt;
        if (sc.hold > 0) {
          sc.hold -= dt;
          if (sc.hold <= 0) sc.timer.resume();
        }
        SIDES.forEach((s) => (sc.flash[s] = Math.max(0, sc.flash[s] - dt * 5)));
        // 박자 소리는 조금 앞서 예약해서 흔들리지 않게 한다
        while (sc.next * spb <= sc.songT + 0.06) {
          const k = sc.next++;
          beatSound(k, Math.max(0, k * spb - sc.songT));
        }
        for (const n of notes) {
          if (n.done) continue;
          if (sc.songT <= n.t + win) break;
          late(n);
          if (!game.playing) return;
        }
        if (sc.songT >= endT && notes.every((n) => n.done)) end();
      };

      function drawNote(c, x, y, r, side, both) {
        c.save();
        glow(c, both ? GOLD : col(side, 0.8), 14);
        disc(c, x, y, r, col(side, 1));
        c.shadowBlur = 0;
        ring(c, x, y, r, both ? GOLD : '#fff', both ? 5 : 3);
        disc(c, x, y, r * 0.3, 'rgba(255,255,255,.85)');
        c.restore();
      }

      sc.draw = (c) => {
        const ly = lineY();
        const r = noteR();
        SIDES.forEach((side) => {
          const z = zone(side);
          if (sc.flash[side] > 0) {
            c.fillStyle = col(side, 0.22 * sc.flash[side]);
            roundPath(c, z.x0, 0, z.w, H, 22);
            c.fill();
          }
          c.fillStyle = 'rgba(255,255,255,.2)';
          roundPath(c, z.x0 + 10, ly - 3, z.w - 20, 6, 3);
          c.fill();
          disc(c, z.cx, ly, r + 3, col(side, 0.16 + 0.45 * sc.flash[side]));
          ring(c, z.cx, ly, r + 3, 'rgba(255,255,255,.75)', 3);
        });
        const x = { L: zone('L').cx, R: zone('R').cx };
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        // 먼 음표부터 그려서 가까운 음표가 위에 오게 한다
        for (let i = notes.length - 1; i >= 0; i--) {
          const n = notes[i];
          const k = (n.t - sc.songT) / LEAD;
          if (n.done || k > 1.05) continue;
          const y = ly - k * (ly + r);
          if (n.lane !== 'B') {
            drawNote(c, x[n.lane], y, r, n.lane, false);
            continue;
          }
          if (!n.hit.L && !n.hit.R) {
            // 금색 띠로 이어진 '함께!' 음표. 판정선에 가까워지면 두근거린다
            const pulse = k < 0.4 ? 1 + 0.08 * Math.sin(game.time * 22) : 1;
            c.fillStyle = 'rgba(255,209,102,.92)';
            roundPath(c, x.L, y - r * 0.52 * pulse, x.R - x.L, r * 1.04 * pulse, r * 0.52);
            c.fill();
            label(c, n.label, W / 2, y + 1, `900 15px ${FONT}`, '#2a1500');
          }
          SIDES.forEach((s) => !n.hit[s] && drawNote(c, x[s], y, r, s, true));
        }
      };

      sc.upcoming = () => {
        const now = songAt(performance.now());
        return notes
          .filter((n) => !n.done)
          .slice(0, 4)
          .map((n) => ({ lane: n.lane, inMs: (n.t - now) * 1000, L: !!n.hit.L, R: !!n.hit.R }));
      };
      sc.auto = () => {
        for (const n of notes) {
          if (n.done) continue;
          if (n.t > sc.songT + 0.004) break;
          if (n.lane === 'B') SIDES.forEach((s) => !n.hit[s] && sc.press(s, lastReal));
          else sc.press(n.lane, lastReal);
        }
      };
      sc.skip = () => {
        if (sc.phase !== 'run') return false;
        notes.forEach((n) => (n.done = true));
        end();
        return true;
      };
      sc.peek = () => ({ songT: sc.songT, hold: sc.hold, ok: sc.ok, total, left: notes.filter((n) => !n.done).length, endT });
      setInfo(0, `0/${total}`);
      return sc;
    }

    // ----- 스테이지 3: 줄다리기 균형
    function balanceScene() {
      const hb = 0.08 + [0.02, 0.01, 0][level] + retry * 0.02; // 목표 띠 절반 높이(레일 길이에 대한 비율)
      const G = 4.2 * (1 - 0.06 * retry); // 기울기가 공을 미는 세기
      const BALL = 13;
      const BEAM = 6; // 막대 두께의 절반
      const sc = { phase: 'intro', y: { L: 0.5, R: 0.5 }, b: 0, v: 0, target: 0.5, from: 0.5, to: 0.5, mk: 1, nextMove: 3.5, t: 0 };
      Object.assign(sc, { wind: 0, gust: null, nextGust: 4.5, fall: null, ok: false, sharp: false, streaks: [] });
      for (let i = 0; i < 14; i++) sc.streaks.push({ x: Math.random() * 1.2 - 0.1, y: Math.random(), len: rand(0.06, 0.16) });
      gaugeStage(sc, '둘 다 손가락을 대고 <b>위아래</b>로 움직여요');
      const rail = () => ({ top: Math.max(30, H * 0.09), bot: H - 56 });
      const railY = (n) => {
        const r = rail();
        return r.top + n * (r.bot - r.top);
      };
      const span = () => Math.max(40, zone('R').cx - zone('L').cx);
      const ends = () => ({ L: { x: zone('L').cx, y: railY(sc.y.L) }, R: { x: zone('R').cx, y: railY(sc.y.R) } });
      function ballPos() {
        const e = ends();
        const k = (sc.b + 1) / 2;
        const dx = e.R.x - e.L.x;
        const dy = e.R.y - e.L.y;
        const len = Math.hypot(dx, dy) || 1;
        return { x: lerp(e.L.x, e.R.x, k) + (dy / len) * (BEAM + BALL), y: lerp(e.L.y, e.R.y, k) - (dx / len) * (BEAM + BALL) };
      }

      // 손잡이 높이: 손가락이 있으면 그 높이, 키를 누르면 올라가고, 아무것도 없으면 천천히 처진다
      function steer(dt) {
        const r = rail();
        SIDES.forEach((side) => {
          const f = finger(side);
          if (f) sc.y[side] += (clamp((f.y - r.top) / (r.bot - r.top), 0, 1) - sc.y[side]) * Math.min(1, dt * 14);
          else if (keys[side]) sc.y[side] = Math.max(0, sc.y[side] - 0.5 * dt);
          else if (sc.phase === 'run') sc.y[side] = Math.min(1, sc.y[side] + 0.35 * dt);
        });
      }
      // 목표 띠가 다른 높이로 옮겨 간다 (올라가면 높은 소리, 내려가면 낮은 소리)
      function shift(dt) {
        if (sc.t >= sc.nextMove) {
          sc.from = sc.target;
          let to = sc.target;
          for (let i = 0; i < 12 && Math.abs(to - sc.target) < 0.22; i++) to = rand(0.18, 0.82);
          sc.to = to;
          sc.mk = 0;
          sc.nextMove = sc.t + rand(4.5, 6.5) - level * 0.4;
          Arcade.audio.tone({ freq: 520, to: to < sc.from ? 900 : 300, type: 'triangle', dur: 0.3, vol: 0.12 });
        }
        if (sc.mk < 1) {
          sc.mk = Math.min(1, sc.mk + dt / 1.4);
          sc.target = lerp(sc.from, sc.to, smooth(sc.mk));
        }
      }
      // 바람: 1.2초 예고 뒤 3~4초 동안 공을 한쪽으로 민다
      function blow(dt) {
        const g = sc.gust;
        if (g) {
          g.t += dt;
          const k = g.t / g.len;
          sc.wind = g.t < 0 ? 0 : g.dir * g.power * clamp(Math.min(k * 4, (1 - k) * 4), 0, 1);
          if (k >= 1) {
            sc.gust = null;
            sc.wind = 0;
            sc.nextGust = sc.t + rand(2.5, 4.5);
          }
        } else if (sc.t >= sc.nextGust) {
          const dir = pick([-1, 1]);
          sc.gust = { dir, power: WIND * rand(0.85, 1.2), t: -1.2, len: rand(3, 4.2) };
          fx.toast(dir > 0 ? '💨 바람이 불어요 →' : '← 바람이 불어요 💨', { kind: 'gold', ms: 1100 });
          sfx('whoosh');
        }
        sc.streaks.forEach((s) => {
          s.x += sc.wind * 1.6 * dt * (0.8 + s.len * 3);
          if (s.x > 1.1) s.x -= 1.2;
          if (s.x < -0.1) s.x += 1.2;
        });
      }
      function roll(dt) {
        if (sc.fall) {
          sc.fall.t += dt;
          if (sc.fall.t < 1.1) return;
          sc.fall = null;
          sc.b = 0;
          sc.v = 0;
          sfx('pop');
          return;
        }
        // 오른쪽이 낮으면(화면 y 가 크면) 공이 오른쪽으로 구른다
        const e = ends();
        sc.v += (G * ((e.R.y - e.L.y) / span()) + sc.wind) * dt;
        sc.v -= sc.v * 1.3 * dt;
        sc.b += sc.v * dt;
        if (Math.abs(sc.b) <= 1) return;
        const p = ballPos();
        sc.fall = { t: 0, x: p.x, y: p.y, dir: sc.b > 0 ? 1 : -1 };
        sc.v = 0;
        loseHeart('공이 떨어졌어요!', screen(p.x, p.y));
      }

      sc.update = (dt) => {
        if (sc.phase !== 'wait' && sc.phase !== 'run') return;
        steer(dt);
        if (sc.phase === 'wait') {
          if (holding('L') && holding('R')) sc.go();
          return;
        }
        sc.t += dt;
        shift(dt);
        blow(dt);
        roll(dt);
        if (!game.playing) return;
        const off = Math.abs((sc.y.L + sc.y.R) / 2 - sc.target);
        sc.ok = !sc.fall && off <= hb && Math.abs(sc.b) <= 0.42;
        // 금색 가운데 줄에 딱 맞추면 게이지가 1.5배로 찬다
        sc.sharp = sc.ok && off <= hb * 0.4 && Math.abs(sc.b) <= 0.2;
        sc.streak(sc.ok, dt, 1.2, 0.5, sc.sharp ? 80 : 50, () => {
          const p = ballPos();
          return screen(p.x, p.y - 24);
        });
        sc.fill(sc.ok ? sc.gauge + (dt / BALANCE_FILL) * (sc.sharp ? 1.5 : 1) : sc.gauge, sc.ok);
      };

      sc.draw = (c) => {
        const r = rail();
        const len = r.bot - r.top;
        const ty = railY(sc.target);
        const bh = hb * len;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        // 목표 띠
        c.fillStyle = sc.ok ? 'rgba(255,209,102,.28)' : 'rgba(255,209,102,.12)';
        c.fillRect(0, ty - bh, W, bh * 2);
        c.save();
        c.strokeStyle = 'rgba(255,209,102,.7)';
        c.lineWidth = 1.5;
        c.setLineDash([6, 6]);
        line(c, 0, ty - bh, W, ty - bh);
        line(c, 0, ty + bh, W, ty + bh);
        c.setLineDash([]);
        c.strokeStyle = sc.sharp ? GOLD : 'rgba(255,209,102,.45)';
        c.lineWidth = sc.sharp ? 3 : 1.5;
        line(c, 0, ty, W, ty);
        c.restore();
        label(c, sc.sharp ? '딱 맞아!' : '목표', W / 2, ty - bh - 9, `900 12px ${FONT}`, GOLD);
        // 레일
        c.lineCap = 'round';
        c.strokeStyle = 'rgba(255,255,255,.12)';
        c.lineWidth = 10;
        SIDES.forEach((side) => line(c, zone(side).cx, r.top, zone(side).cx, r.bot));
        // 바람 줄
        const wk = Math.min(1, Math.abs(sc.wind) / WIND);
        if (wk > 0.02) {
          c.strokeStyle = `rgba(255,255,255,${0.35 * wk})`;
          c.lineWidth = 2;
          sc.streaks.forEach((s) => line(c, s.x * W, r.top + s.y * len, s.x * W - Math.sign(sc.wind) * s.len * W, r.top + s.y * len));
        }
        // 막대 (파랑 → 분홍)
        const e = ends();
        const grad = c.createLinearGradient(e.L.x, 0, e.R.x, 0);
        grad.addColorStop(0, col('L', 1));
        grad.addColorStop(1, col('R', 1));
        c.save();
        if (sc.ok) glow(c, GOLD, 16);
        c.strokeStyle = grad;
        c.lineWidth = BEAM * 2;
        line(c, e.L.x, e.L.y, e.R.x, e.R.y);
        c.restore();
        disc(c, (e.L.x + e.R.x) / 2, (e.L.y + e.R.y) / 2, 3, 'rgba(255,255,255,.9)'); // 공이 머물 곳
        // 손잡이
        SIDES.forEach((side) => {
          const p = e[side];
          const on = holding(side);
          c.save();
          if (on) glow(c, col(side, 0.9), 18);
          disc(c, p.x, p.y, 19, col(side, 1));
          c.shadowBlur = 0;
          ring(c, p.x, p.y, 19, on ? '#fff' : 'rgba(255,255,255,.5)', 3);
          label(c, '↕', p.x, p.y + 1, `900 16px ${FONT}`, '#fff');
          c.restore();
        });
        // 공 (떨어질 때는 옆으로 굴러 떨어지며 사라진다)
        const t = sc.fall ? sc.fall.t : 0;
        const bp = sc.fall ? { x: sc.fall.x + sc.fall.dir * 70 * t, y: sc.fall.y + 520 * t * t } : ballPos();
        c.save();
        c.globalAlpha = sc.fall ? Math.max(0, 1 - t) : 1;
        if (sc.sharp) glow(c, GOLD, 22);
        const g2 = c.createRadialGradient(bp.x - 4, bp.y - 4, 2, bp.x, bp.y, BALL);
        g2.addColorStop(0, '#fff');
        g2.addColorStop(1, sc.sharp ? GOLD : '#c3ccf5');
        disc(c, bp.x, bp.y, BALL, g2);
        c.restore();
        // 바람 표시: 공을 미는 쪽에 바람, 미는 방향에 화살표
        if (sc.gust && !sc.fall) {
          const d = sc.gust.dir;
          c.globalAlpha = sc.gust.t < 0 ? 0.5 + 0.5 * Math.sin(game.time * 16) : 1;
          label(c, '💨', bp.x - d * 34, bp.y - 4, `22px ${FONT}`);
          label(c, d > 0 ? '→' : '←', bp.x + d * 30, bp.y - 4, `900 18px ${FONT}`, '#fff');
          c.globalAlpha = 1;
        }
      };

      // 공을 가운데로 모으는 손가락 높이 (자동 검증용)
      function plan() {
        const slope = clamp((-3.2 * sc.b - 2.6 * sc.v - sc.wind) / G, -0.4, 0.4);
        const mid = railY(sc.target);
        const dy = (slope * span()) / 2;
        return { L: { x: zone('L').cx, y: mid - dy }, R: { x: zone('R').cx, y: mid + dy } };
      }
      sc.aim = () => {
        const p = plan();
        return { L: screen(p.L.x, p.L.y), R: screen(p.R.x, p.R.y) };
      };
      sc.auto = () => {
        const p = plan();
        SIDES.forEach((s) => vput(s, p[s].x, p[s].y));
      };
      sc.peek = () => ({ b: sc.b, v: sc.v, y: Object.assign({}, sc.y), target: sc.target, wind: sc.wind, ok: sc.ok, sharp: sc.sharp, falling: !!sc.fall });
      return sc;
    }

    // ----- 스테이지 진행
    async function runStage() {
      const def = STAGES[stageIdx];
      game.setStage(stageIdx, STAGES.length);
      game.setGoal(def.goal);
      game.hideTimer();
      infoLabel.textContent = def.label;
      meter.classList.remove('idle');
      setPrompt('');
      scene = [followScene, beatScene, balanceScene][stageIdx]();
      await game.banner(def.banner[0], def.banner[1], { ms: 1500 });
      scene.begin();
    }

    async function stageClear() {
      game.stopTimer();
      const left = Math.floor(game.timeLeft());
      setPrompt('');
      sfx('bonus');
      fx.confetti(30);
      game.addScore(300 + (stageIdx === 1 ? 0 : left * 10), board);
      if (stageIdx >= STAGES.length - 1) {
        await game.wait(800);
        finish();
        return;
      }
      stageIdx++;
      await game.wait(900);
      runStage();
    }

    function finish() {
      const avg = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : null;
      const sharp = avg === null || avg <= Math.max(0.04, tol * 0.5);
      let stars = heartsLost === 0 && sharp ? 3 : heartsLost <= 1 ? 2 : 1;
      if (game.retry > 0) stars = Math.min(stars, 2);
      let message = '다음엔 "하나, 둘, 셋!"을 소리 내어 맞춰 봐요';
      if (avg === null) message = '끝까지 호흡을 맞췄어요!';
      else if (avg <= 0.03) message = '눈빛만 봐도 통하는 <b>텔레파시 호흡</b>!';
      else if (avg <= 0.07) message = '척척 맞는 <b>찰떡 호흡</b>이에요!';
      game.win({
        stars,
        title: '한 호흡 성공!',
        message,
        stats: [
          ['호흡 점수', avg === null ? '-' : `평균 ${avg.toFixed(3)}초 차`],
          ['함께! PERFECT', `${perfectTogether} / ${togetherTotal}`],
          ['최대 찰떡 콤보', String(game.maxCombo)],
          ['잃은 하트', `${heartsLost}개`],
        ],
      });
    }

    game.loop((dt) => {
      measure();
      lastReal = performance.now();
      if (scene) {
        if (auto && scene.auto && scene.phase !== 'done') scene.auto(dt);
        scene.update(dt);
      }
      paintZones();
      ctx.clearRect(0, 0, W, H);
      if (scene) scene.draw(ctx);
    });

    // 일시 정지에서 돌아오면 스테이지마다 다시 맞출 시간을 준다 (손가락 다시 올리기, 박자 다시 세기)
    game.onPauseChange((paused) => {
      if (!paused && scene && scene.resume) scene.resume();
    });

    if (game.debug) {
      // 검증용 창구: 상태 보기, 손가락 대신 대기, 자동 플레이, 스테이지 건너뛰기
      window.__game = {
        state: () => ({
          stage: stageIdx,
          sub: scene ? scene.phase : null,
          gauge: scene ? scene.gauge : null,
          heartsLost,
          lives: game.lives,
          tol,
          diffs: diffs.slice(),
          perfectTogether,
          togetherTotal,
          combo: game.combo,
          fingers: Array.from(pointers.values()).map((p) => p.side),
          keys: Object.assign({}, keys),
          extra: scene && scene.peek ? scene.peek() : null,
        }),
        aim: () => (scene && scene.aim ? scene.aim() : null),
        upcoming: () => (scene && scene.upcoming ? scene.upcoming() : []),
        finger: (side, x, y) => vput(side, x - rect.left, y - rect.top),
        lift: (side) => pointers.delete('v' + side),
        tap: (side) => press(side, performance.now()),
        auto: (on) => {
          auto = on !== false;
          if (!auto) SIDES.forEach((s) => pointers.delete('v' + s));
        },
        skip: () => !!(scene && scene.skip && scene.skip()),
        miss: () => loseHeart('검사용 실수', null),
        settings: S,
        level,
      };
    }

    measure();
    runStage();
  }

  Arcade.createGame({
    id: GAME_ID,
    title: '둘이서 한 호흡',
    icon: '🤝',
    accent: '#ff5d9e',
    accent2: '#4d8dff',
    tagline: '두 사람이 한 폰을 함께 잡고, 각자 한쪽을 맡아요',
    howTo: [
      '<b>왼쪽은 파랑</b>, <b>오른쪽은 분홍</b>. 혼자 두 손으로 해도 돼요',
      '원 따라가기 → 박자 맞추기 → 공 균형 잡기',
      '<b>함께!</b>는 "하나, 둘, 셋!" 하고 동시에 눌러요',
    ],
    lives: S.lives,
    stages: STAGES.length,
    start,
  });
})();
