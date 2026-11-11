// 목소리 비행선: 목소리 크기로 비행선의 높이를 조종해 고리, 협곡, 쉿과 폭풍 구간을 지난다.
// 마이크가 없거나 거부되면 "누르고 있으면 위로, 떼면 아래로" 조작으로 바뀐다.
(function () {
  'use strict';

  const { h, clamp, lerp, rand, fx } = Arcade;
  const GAME_ID = 'game15';
  const STORE_KEY = 'game15_config';

  // ----- 설정 (관리자 페이지와 같은 키, 같은 기본값)
  const PRESETS = [
    { stageSec: 30, gap: 3.0, sens: 1.2, lives: 4 },
    { stageSec: 36, gap: 2.5, sens: 1.0, lives: 3 },
    { stageSec: 42, gap: 2.1, sens: 0.9, lives: 3 },
  ];
  const LIMITS = { stageSec: [15, 90], gap: [1.4, 6], sens: [0.3, 3], lives: [1, 5] };
  // 옛 형식({ difficulties, currentDifficulty })이 저장돼 있으면 아는 값이 없으므로 쉬움 기본값을 쓴다
  const saved = Arcade.loadSettings(STORE_KEY, {});
  const LEVEL = clamp(parseInt(saved.difficulty, 10) || 0, 0, 2);
  const S = Object.assign({}, PRESETS[LEVEL]);
  Object.keys(LIMITS).forEach((k) => {
    const v = Number(saved[k]);
    if (Number.isFinite(v) && v > 0) S[k] = clamp(v, LIMITS[k][0], LIMITS[k][1]);
  });
  S.lives = Math.round(S.lives);

  // 난이도에 따라 정해지는 너그러움 (고리 반지름, 협곡 반 폭, 쉿 선, 폭풍 바닥 높이)
  const TOL = [
    { ring: 0.13, canyon: 0.18, hush: 0.3, storm: 0.55 },
    { ring: 0.115, canyon: 0.16, hush: 0.27, storm: 0.6 },
    { ring: 0.1, canyon: 0.145, hush: 0.25, storm: 0.64 },
  ][LEVEL];

  // ----- 비행 공간: 가로는 비행 시간(초), 세로는 0(땅)~1(하늘 끝)
  const MIN_Y = 0.06;
  const MAX_Y = 0.94;
  const SHIP_R = 0.04; // 비행선 반 높이
  const HIT_Y = SHIP_R * 0.8;
  const HIT_T = 0.23; // 비행선 반 길이 (초)
  const VIEW_T = 3.3; // 화면 가로에 보이는 비행 시간
  const SHIP_X = 0.25; // 비행선의 가로 위치 (화면 폭 비율)
  const INVULN = 1.6;
  const TAP_UP = 0.2; // 손가락 조작: 폭풍 구간에서 한 번 누를 때 오르는 양
  const FORCE_TOUCH = /[?&]touch=1/.test(location.search);

  const STAGES = [
    { name: '고리 통과', banner: ['스테이지 1', '고리를 통과하며 높이 조절!'] },
    { name: '좁은 협곡', banner: ['스테이지 2', '같은 소리로 쭉~ 벽에 닿지 마!'] },
    { name: '쉿과 폭풍', banner: ['마지막 스테이지', '쉿! 엔 조용히, 폭풍엔 크게!'] },
  ];
  const THEMES = [
    { sky: ['#3f8cf5', '#a8dcff'], far: '#7cc7a6', ground: '#4fae6d', cloud: 'rgba(255,255,255,.85)' },
    { sky: ['#ff7b7b', '#ffd59e'], far: '#e08a6c', ground: '#c47a52', cloud: 'rgba(255,240,225,.7)' },
    { sky: ['#1d1b4a', '#5b3f88'], far: '#2e2a63', ground: '#2a2552', cloud: 'rgba(205,195,255,.3)' },
  ];

  // ----- 세상 만들기 (순수 함수: 스테이지 하나의 고리, 기둥, 별, 협곡, 구간, 안내 길)
  function newWorld(len) {
    return { len, rings: [], pillars: [], stars: [], canyons: [], zones: [], guide: [] };
  }
  const flip = () => (Math.random() < 0.5 ? -1 : 1);
  /** 고리를 놓고, 안내 길도 그 고리 가운데를 지나게 한다 */
  function addRing(w, x, y, r) {
    const ring = { x, y, r };
    w.rings.push(ring);
    w.guide.push([x, y]);
    return ring;
  }

  function buildRings(len, gap, tol) {
    const w = newWorld(len);
    let x = 3.2;
    let y = 0.45;
    let prev = null;
    w.guide.push([0, 0.42]);
    for (let i = 0; x < len - 1; i++, x += gap) {
      if (i > 0) {
        let dy = rand(0.1, 0.26) * flip();
        if (y + dy > 0.8 || y + dy < 0.2) dy = -dy;
        y = clamp(y + dy, 0.2, 0.8);
      }
      const ring = addRing(w, x, y, tol.ring);
      if (prev) {
        // 고리 사이에 기둥: 길에서 넉넉히 떨어진 쪽을 막는다
        const pw = 0.44;
        const px = (prev.x + x) / 2 - pw / 2;
        const at = (xx) => lerp(prev.y, y, (xx - prev.x) / (x - prev.x));
        const lo = Math.min(at(px), at(px + pw));
        const hi = Math.max(at(px), at(px + pw));
        const room = 0.19;
        const canTop = hi + room < 0.86;
        const canBot = lo - room > 0.14;
        let side = 0;
        if (i >= 2 && Math.random() < 0.8 && (canTop || canBot)) {
          side = canTop && (!canBot || Math.random() < 0.5) ? 1 : -1;
          w.pillars.push(side > 0 ? { x: px, w: pw, y0: hi + room, y1: 1.2, top: true } : { x: px, w: pw, y0: -0.2, y1: lo - room, top: false });
        }
        // 별은 기둥 반대쪽, 길에서 조금 벗어난 곳 (욕심내면 다음 고리가 급해진다)
        if (i % 2 === 1) {
          const sy = at(px + pw / 2) + (side ? -side : flip()) * 0.2;
          if (sy > 0.12 && sy < 0.88) w.stars.push({ x: px + pw / 2, y: sy });
        }
      }
      prev = ring;
    }
    w.guide.push([len + 3, y]);
    return w;
  }

  /** 협곡 한 토막의 아래·위 벽 높이. 들어가고 나오는 입구는 넓게 벌어진다 */
  function bounds(seg, x) {
    const c = seg.c(x);
    const fin = Math.max(0, 1 - (x - seg.x0) / 0.8);
    const fout = Math.max(0, 1 - (seg.x1 - x) / 0.8);
    const f = 0.3 * (fin * fin + fout * fout);
    return [c - seg.g - f, c + seg.g + f];
  }

  function buildCanyon(len, gap, tol, ease) {
    const w = newWorld(len);
    const open = 2.0 * (1 + 0.15 * ease);
    const usable = len - 3.5;
    const n = Math.max(2, Math.ceil((usable + open) / (5.5 + open)));
    const segLen = Math.max(2.5, (usable - open * (n - 1)) / n);
    const g = tol.canyon;
    const lo = g + 0.1;
    const hi = 1 - g - 0.1;
    let base = 0.45;
    let x = 2.5;
    for (let i = 0; i < n; i++) {
      if (i > 0) base = clamp(base + rand(0.12, 0.26) * (base > 0.5 ? -1 : base < 0.4 ? 1 : flip()), lo, hi);
      const x0 = x;
      const amp = rand(0.04, 0.09);
      const wl = rand(3.5, 5.5);
      const ph = rand(0, Math.PI * 2);
      const b = base;
      const seg = { x0, x1: x0 + segLen, g, c: (xx) => clamp(b + amp * Math.sin(((xx - x0) / wl) * Math.PI * 2 + ph), lo, hi) };
      w.canyons.push(seg);
      x = seg.x1 + open;
    }
    // 길목마다 고리 하나, 협곡 안에는 벽 가까이에 별
    const entry = w.canyons[0].c(w.canyons[0].x0);
    w.guide.push([0, entry]);
    addRing(w, 1.4, entry, tol.ring);
    w.canyons.forEach((seg, i) => {
      for (let xx = seg.x0; xx <= seg.x1 + 1e-6; xx += 0.25) w.guide.push([xx, seg.c(xx)]);
      let side = flip();
      for (let sx = seg.x0 + 1.1; sx < seg.x1 - 0.7; sx += gap * 0.9) {
        w.stars.push({ x: sx, y: seg.c(sx) + side * (g - 0.05) });
        side = -side;
      }
      const next = w.canyons[i + 1];
      if (next) addRing(w, (seg.x1 + next.x0) / 2, (seg.c(seg.x1) + next.c(next.x0)) / 2, tol.ring);
    });
    const last = w.canyons[n - 1];
    w.guide.push([len + 3, last.c(last.x1)]);
    return w;
  }

  function buildZones(len, gap, tol, ease) {
    const w = newWorld(len);
    const Z = 4.0;
    const open = gap * 0.85 * (1 + 0.15 * ease);
    let x = 3.2;
    let kind = 'hush';
    w.guide.push([0, 0.35]);
    addRing(w, 1.8, 0.3, tol.ring);
    while (x + Z < len - 0.6) {
      const line = kind === 'hush' ? tol.hush : tol.storm;
      const safe = kind === 'hush' ? MIN_Y + 0.02 : Math.min(0.9, line + 0.2);
      w.zones.push({ x0: x, x1: x + Z, kind, line, wake: 0, failed: false, done: false, warned: false, awakeUntil: 0 });
      w.guide.push([x - 0.3, safe], [x + Z, safe]);
      w.stars.push({ x: x + Z / 2, y: kind === 'hush' ? 0.11 : Math.min(0.9, line + 0.26) });
      x += Z;
      const next = kind === 'hush' ? 'storm' : 'hush';
      if (x + open + Z < len - 0.6) addRing(w, x + open * 0.45, next === 'storm' ? 0.5 : 0.38, tol.ring);
      x += open;
      kind = next;
    }
    w.guide.push([len + 3, 0.4]);
    return w;
  }

  /** 안내 길(자동 조종과 검증에 쓴다)의 x 위치 높이 */
  function guideAt(w, x) {
    const g = w.guide;
    if (x <= g[0][0]) return g[0][1];
    for (let i = 1; i < g.length; i++) {
      if (g[i][0] >= x) {
        const [x0, y0] = g[i - 1];
        const [x1, y1] = g[i];
        return x1 === x0 ? y1 : lerp(y0, y1, (x - x0) / (x1 - x0));
      }
    }
    return g[g.length - 1][1];
  }

  const pct = (arr, p) => {
    const a = arr.slice().sort((m, n) => m - n);
    return a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : -100;
  };

  // ----- 마이크 (권한은 한 번만 묻고, 판이 끝나면 끈다)
  const mic = { stream: null, src: null, an: null, buf: null, status: 'idle', why: '', opening: null, gen: 0 };
  let prefer = FORCE_TOUCH ? 'touch' : 'mic'; // 사용자가 고른 조작. 다음 판에도 이어진다
  let calib = null; // { floor, max } dB. 한 번 재면 재도전 때도 쓴다

  function openMic() {
    if (mic.opening) return mic.opening;
    const gen = mic.gen;
    const fail = (why) => {
      mic.status = 'fail';
      mic.why = why;
      return false;
    };
    mic.status = 'opening';
    mic.opening = (async () => {
      const md = navigator.mediaDevices;
      if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return fail('insecure');
      if (!md || !md.getUserMedia) return fail('none');
      const ctx = Arcade.audio.context();
      if (!ctx || !ctx.createAnalyser) return fail('none');
      try {
        // 자동 음량 조절을 끄지 않으면 크게 외쳐도 작게 들린다. 효과음은 메아리 제거로 덜 들어오게 한다
        const stream = await md.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } });
        if (gen !== mic.gen) {
          stream.getTracks().forEach((t) => t.stop());
          mic.status = 'idle';
          return false;
        }
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        mic.stream = stream;
        mic.src = ctx.createMediaStreamSource(stream);
        mic.an = ctx.createAnalyser();
        mic.an.fftSize = 1024;
        mic.src.connect(mic.an);
        // 출력에 이어 두어야 분석값이 갱신되는 브라우저가 있다. 소리는 0 으로 막는다
        mic.sink = ctx.createGain();
        mic.sink.gain.value = 0;
        mic.an.connect(mic.sink);
        mic.sink.connect(ctx.destination);
        mic.buf = new Float32Array(mic.an.fftSize);
        mic.status = 'ok';
        return true;
      } catch (e) {
        const n = e && e.name;
        return fail(n === 'NotAllowedError' || n === 'SecurityError' ? 'denied' : n === 'NotFoundError' || n === 'OverconstrainedError' ? 'none' : 'error');
      }
    })();
    mic.opening.then(() => (mic.opening = null));
    return mic.opening;
  }

  function closeMic() {
    mic.gen++;
    try {
      if (mic.src) mic.src.disconnect();
      if (mic.sink) mic.sink.disconnect();
    } catch (e) {
      /* 이미 끊긴 연결 */
    }
    if (mic.stream) mic.stream.getTracks().forEach((t) => t.stop());
    mic.stream = mic.src = mic.an = mic.sink = null;
    if (mic.status !== 'fail') mic.status = 'idle';
  }

  const micLive = () => !!mic.stream && mic.stream.getAudioTracks().some((t) => t.readyState === 'live');

  /** 지금 마이크 소리 크기 (dB, -100 ~ 0) */
  function micDb() {
    const an = mic.an;
    if (!an) return -100;
    let sum = 0;
    const buf = mic.buf;
    if (an.getFloatTimeDomainData) {
      an.getFloatTimeDomainData(buf);
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    } else {
      const b = new Uint8Array(an.fftSize);
      an.getByteTimeDomainData(b);
      for (let i = 0; i < b.length; i++) sum += ((b[i] - 128) / 128) ** 2;
    }
    return 20 * Math.log10(Math.max(1e-5, Math.sqrt(sum / buf.length)));
  }

  const WHY = {
    insecure: '마이크는 https 주소에서만 열려요.',
    denied: '마이크 권한이 꺼져 있어요.',
    none: '마이크를 찾지 못했어요.',
    error: '마이크를 열지 못했어요.',
  };

  // ----- 그리기 도우미
  const TAU = Math.PI * 2;
  function rrect(c, x, y, w, hh, r) {
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, hh, r);
    else c.rect(x, y, w, hh);
  }
  /** 타원 하나. width 를 주면 선으로, 없으면 채워서 그린다 */
  function oval(c, x, y, rx, ry, color, width, a0 = 0, a1 = TAU) {
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, a0, a1);
    paint(c, color, width);
  }
  /** 점들을 이은 선(width 가 있을 때) 또는 채운 다각형 */
  function poly(c, pts, color, width) {
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    paint(c, color, width);
  }
  function paint(c, color, width) {
    if (width) {
      c.strokeStyle = color;
      c.lineWidth = width;
      c.stroke();
    } else {
      c.fillStyle = color;
      c.fill();
    }
  }
  function vgrad(c, y0, y1, stops) {
    const g = c.createLinearGradient(0, y0, 0, y1);
    stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
    return g;
  }
  const bolt = (c, x, y) => poly(c, [[x, y], [x - 8, y + 22], [x + 6, y + 26], [x - 4, y + 52]], '#ffe066', 3);
  const starPts = (x, y, r, rot) =>
    Array.from({ length: 10 }, (_, i) => {
      const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      return [x + Math.cos(a) * rr, y + Math.sin(a) * rr];
    });

  function drawBird(c, x, y, s, awake, t) {
    const by = y + (awake ? Math.sin(t * 40) * 2 : 0);
    oval(c, x, by, s, s * 0.8, awake ? '#ff8a5c' : '#8fb7ff');
    poly(c, [[x + s * 0.8, by - s * 0.1], [x + s * 1.35, by + s * 0.08], [x + s * 0.8, by + s * 0.25]], '#ffd166');
    if (awake) oval(c, x + s * 0.38, by - s * 0.2, s * 0.16, s * 0.16, '#1a1a33');
    else oval(c, x + s * 0.38, by - s * 0.25, s * 0.18, s * 0.18, '#1a1a33', Math.max(1.5, s * 0.14), 0.2, Math.PI - 0.2);
  }

  function drawShip(c, x, y, w, hh, tilt, mouth, ghost, t) {
    c.save();
    c.translate(x, y);
    c.rotate(tilt);
    if (ghost) c.globalAlpha = 0.4;
    // 꼬리 날개 위아래 두 장, 곤돌라
    for (const s of [-1, 1]) poly(c, [[-w * 0.26, s * hh * 0.18], [-w * 0.47, s * hh * 0.64], [-w * 0.56, s * hh * 0.64], [-w * 0.52, s * hh * 0.08]], '#c93a5a');
    poly(c, [[-w * 0.1, hh * 0.3], [-w * 0.12, hh * 0.46]], 'rgba(40,20,60,.6)', 1.5);
    poly(c, [[w * 0.1, hh * 0.3], [w * 0.12, hh * 0.46]], 'rgba(40,20,60,.6)', 1.5);
    rrect(c, -w * 0.16, hh * 0.42, w * 0.32, hh * 0.28, 5);
    paint(c, '#5b3a8c');
    c.fillStyle = '#ffe9a8';
    c.fillRect(-w * 0.1, hh * 0.49, w * 0.07, hh * 0.12);
    c.fillRect(w * 0.03, hh * 0.49, w * 0.07, hh * 0.12);
    // 몸통, 이음새, 빛
    oval(c, 0, 0, w * 0.46, hh * 0.4, vgrad(c, -hh * 0.45, hh * 0.4, ['#ffcf7a', '#ff8a5c', '#ff5d73']));
    for (const k of [-0.18, 0.06]) oval(c, w * k, 0, w * 0.07, hh * 0.39, 'rgba(150,40,70,.35)', 1.5, -Math.PI / 2, Math.PI / 2);
    oval(c, -w * 0.05, -hh * 0.02, w * 0.32, hh * 0.22, 'rgba(255,255,255,.5)', 2, Math.PI * 1.1, Math.PI * 1.7);
    // 얼굴: 입은 지금 소리 크기만큼 벌어진다
    oval(c, w * 0.27, -hh * 0.1, hh * 0.12, hh * 0.12, '#fff');
    oval(c, w * 0.3, -hh * 0.1, hh * 0.065, hh * 0.065, '#2a1030');
    oval(c, w * 0.35, hh * 0.13, hh * 0.07, hh * (0.025 + 0.12 * mouth), '#2a1030');
    // 프로펠러
    const s = Math.abs(Math.sin(t * 28));
    c.fillStyle = 'rgba(255,255,255,.85)';
    c.fillRect(-w * 0.6, -hh * 0.32 * s, 3, hh * 0.64 * s + 1);
    c.restore();
  }

  // ------------------------------------------------------------ 한 판
  function start(game) {
    const ease = Math.min(game.retry, 3);
    const tol = {
      ring: TOL.ring + 0.012 * ease,
      canyon: TOL.canyon + 0.012 * ease,
      hush: TOL.hush + 0.02 * ease,
      storm: TOL.storm - 0.03 * ease,
    };
    const gap = S.gap * (1 + 0.15 * ease); // 재도전하면 장애물 간격이 넓어진다
    let stageIdx = game.checkpoint;
    let world = null;
    let dist = 0; // 이번 스테이지에서 날아온 거리(초)
    let flying = false;
    let alive = true;
    let mode = 'wait'; // mic | touch | wait
    let calibrating = false;
    let prov = null; // 보정 중에 쓰는 임시 범위
    // 입력: level 은 거른 세기(0~1), raw 는 마이크 원값, touchLv 는 손가락 조작의 세기
    let [level, raw, touchLv] = [0, 0, 0.3];
    let [fake, pilot, pilotTap] = [null, null, 0]; // 검증용 입력과 자동 조종
    const pointers = new Set();
    let taps = 0;
    // 비행선: 높이, 오르내리는 속도, 부딪힌 뒤 튕김, 무적·마이크 붙잡기가 끝나는 시각
    let [shipY, shipVy, bump, invulnUntil, deafUntil] = [0.3, 0, 0, 0, 0];
    let [ringsPassed, ringsTotal, starsGot, hits] = [0, 0, 0, 0];
    const hitLog = []; // 검증용: [스테이지, 거리, 높이, 방향]
    let goalNow = '';
    let G = { top: 6, fh: 100, gh: 14, ppt: 100, sx: 80 };

    // ----- 화면
    const chip = h('div', { class: 'vs-chip' });
    const trackFill = h('i');
    const mark = h('span', { class: 'vs-mark' });
    const track = h('div', { class: 'vs-track' }, [trackFill, mark, h('b', { text: '🏁' })]);
    const modeBtn = h('button', { class: 'vs-mode', 'aria-label': '조작 바꾸기' });
    const topBar = h('div', { class: 'vs-top' }, [chip, track, modeBtn]);
    const canvas = h('canvas', { class: 'vs-canvas' });
    const calIcon = h('div', { class: 'vs-cal-icon' });
    const calTitle = h('div', { class: 'vs-cal-title' });
    const calSub = h('div', { class: 'vs-cal-sub' });
    const calFill = h('i');
    const calBar = h('div', { class: 'vs-cal-bar' }, calFill);
    const calTouch = h('button', { class: 'ar-btn ghost sm', text: '👆 손가락으로 할래요' });
    const cal = h('div', { class: 'vs-cal ar-hidden' }, [calIcon, calTitle, calSub, calBar, calTouch]);
    const sky = h('div', { class: 'vs-sky' }, [canvas, cal]);
    const pad = h('button', { class: 'vs-pad' });
    game.root.append(topBar, sky);
    chip.textContent = `${stageIdx + 1}. ${STAGES[stageIdx].name}`;
    const goalEl = document.querySelector('.ar-goal');
    const ctx = canvas.getContext('2d');
    let W = 1;
    let H = 1;
    let dpr = 1;

    function fit() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(1, sky.clientWidth);
      H = Math.max(1, sky.clientHeight);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      const gh = Math.max(14, Math.round(H * 0.045));
      G = { top: 6, gh, fh: H - gh - 6, ppt: W / VIEW_T, sx: W * SHIP_X };
    }
    fit();
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(fit);
      ro.observe(sky);
      game.onCleanup(() => ro.disconnect());
    }
    game.on(window, 'resize', fit);

    const X = (x) => G.sx + (x - dist) * G.ppt;
    const Y = (y) => G.top + (1 - y) * G.fh;
    function screenPoint(y) {
      const r = canvas.getBoundingClientRect();
      return { x: r.left + G.sx, y: r.top + Y(y) };
    }
    const shipPoint = () => screenPoint(shipY);
    const moving = () => flying && !calibrating && game.playing;
    const zoneAt = (x) => (world ? world.zones.find((z) => x >= z.x0 - 0.15 && x <= z.x1) : null);
    /** 효과음이 마이크로 다시 들어가지 않게 잠깐 마이크 값을 붙잡아 둔다 */
    const deaf = (ms) => (deafUntil = Math.max(deafUntil, game.time + ms / 1000));

    function softTone(freq, to, dur) {
      deaf(dur * 1000 + 120);
      Arcade.audio.tone({ freq, to, type: 'triangle', dur, vol: 0.06 });
    }

    // ----- 조작 방식
    function setMode(m) {
      mode = m;
      pointers.clear();
      taps = 0;
      if (m === 'touch') {
        touchLv = clamp((shipY - MIN_Y) / (MAX_Y - MIN_Y), 0, 1);
        if (!pad.isConnected) game.footer.append(pad);
      } else pad.remove();
      modeBtn.textContent = m === 'mic' ? '🎤 목소리' : m === 'touch' ? '👆 손가락' : '⏳ 준비';
      sky.dataset.mode = m;
      paintGoal();
    }

    function useTouchInstead(msg) {
      prefer = 'touch';
      closeMic();
      setMode('touch');
      if (calibrating) endCal();
      if (msg) fx.toast(msg, { kind: 'bad', ms: 1800 });
    }

    calTouch.addEventListener('click', () => useTouchInstead(''));
    modeBtn.addEventListener('click', async () => {
      if (!game.playing || calibrating || mode === 'wait') return;
      Arcade.sfx('tap');
      if (mode === 'mic') {
        useTouchInstead('');
        fx.toast('👆 손가락 조작으로 바꿨어요', { ms: 1200 });
        return;
      }
      prefer = 'mic';
      setMode('wait');
      const ok = micLive() || (await openMic());
      if (!alive) return;
      if (!ok || !micLive()) return useTouchInstead((WHY[mic.why] || WHY.error) + ' 손가락으로 해요');
      setMode('mic');
      if (!calib) await calibrate();
    });

    // 손가락: 누르고 있으면 위로, 떼면 아래로. 폭풍 구간에서는 연타
    function onDown(e) {
      if (mode !== 'touch' || !game.playing) return;
      e.preventDefault();
      pointers.add(e.pointerId);
      taps++;
      pad.classList.add('on');
    }
    function onUp(e) {
      pointers.delete(e.pointerId);
      if (!pointers.size) pad.classList.remove('on');
    }
    sky.addEventListener('pointerdown', onDown);
    pad.addEventListener('pointerdown', onDown);
    game.on(window, 'pointerup', onUp);
    game.on(window, 'pointercancel', onUp);
    game.onPauseChange((paused) => {
      if (paused) {
        pointers.clear();
        pad.classList.remove('on');
      }
    });

    // ----- 입력 세기 0~1
    function readLevel(dt) {
      let v = 0;
      if (fake !== null) v = fake;
      else if (mode === 'touch') {
        const z = zoneAt(dist);
        if (z && z.kind === 'storm' && moving()) touchLv += taps * TAP_UP - 0.75 * dt;
        else touchLv += (pointers.size ? 0.95 : -0.8) * dt;
        taps = 0;
        touchLv = clamp(touchLv, 0, 1);
        return touchLv;
      } else if (mode === 'mic') {
        if (!micLive()) {
          useTouchInstead('마이크가 꺼져서 손가락 조작으로 바꿨어요');
          return level;
        }
        if (game.time < deafUntil) v = raw;
        else {
          const c = calib || prov || { floor: -60, max: -30 };
          raw = clamp(((micDb() - c.floor - 3) / Math.max(8, c.max - c.floor - 3)) * S.sens, 0, 1);
          v = raw;
        }
      }
      taps = 0;
      // 흔들림을 줄이려고 부드럽게 거른다. 커질 때는 빠르게, 작아질 때는 조금 천천히
      return level + (v - level) * (1 - Math.exp(-dt * (v > level ? 9 : 4.5)));
    }

    // 검증용 자동 조종: 안내 길을 따라 목소리 값이나 손가락 누름을 대신 넣는다
    function runPilot(dt) {
      const want = guideAt(world, dist + 0.4);
      const z = zoneAt(dist + 0.2);
      const lv = clamp((want - MIN_Y) / (MAX_Y - MIN_Y) + (z && z.kind === 'storm' ? 0.16 : 0), 0, 1);
      if (pilot === 'voice') {
        fake = lv;
        return;
      }
      fake = null;
      const zn = zoneAt(dist);
      if (zn && zn.kind === 'storm') {
        pointers.delete('pilot');
        pilotTap += dt;
        if (touchLv < lv && pilotTap >= 0.2) {
          pilotTap = 0;
          taps++;
        }
      } else if (touchLv < lv - 0.02) pointers.add('pilot');
      else pointers.delete('pilot');
    }

    // ----- 보정: 조용히 2초로 바닥을, "아~" 2초로 최대치를 잡는다
    function showCal(icon, title, sub, k) {
      cal.classList.remove('ar-hidden');
      calIcon.textContent = icon;
      calTitle.innerHTML = title;
      calSub.innerHTML = sub;
      calBar.classList.toggle('ar-hidden', k === null);
      calFill.style.transform = `scaleX(${k || 0})`;
    }
    function endCal() {
      calibrating = false;
      cal.classList.add('ar-hidden');
    }
    /** ms 동안 dB 를 모은다(게임 시계). until 이 참이면 일찍 끝나고, 보정이 취소되면 null */
    function listen(ms, until) {
      return new Promise((resolve) => {
        const out = [];
        let t = 0;
        const stop = game.loop((dt) => {
          const db = micDb();
          t += dt * 1000;
          if (mode !== 'mic' || !calibrating) {
            stop();
            return resolve(null);
          }
          if (t > 250) out.push(db); // 시작 직후는 버린다
          if (!until) calFill.style.transform = `scaleX(${clamp(t / ms, 0, 1)})`;
          if (t >= ms || (until && until(db))) {
            stop();
            resolve(out);
          }
        });
      });
    }
    async function calibrate() {
      calibrating = true;
      prov = { floor: 0, max: 30 }; // 조용히 재는 동안에는 비행선이 움직이지 않게
      showCal('🤫', '조용히 해 주세요', '주변 소리를 재고 있어요', 0);
      const quiet = await listen(2000);
      if (!quiet) return;
      const floor = Math.max(-90, pct(quiet, 0.5));
      prov = { floor, max: floor + 30 };
      showCal('🗣️', '<b>"아~"</b> 하고 크게!', '비행선이 위로 올라가요', 0);
      if (!(await listen(2500, (db) => db > floor + 10))) return; // 소리가 들리기 시작할 때까지
      const loud = await listen(2000);
      if (!loud) return;
      let max = pct(loud, 0.75);
      let note = '크게 내면 <b>위로</b>, 작게 내면 <b>아래로</b>';
      if (max - floor < 10) {
        max = floor + 30;
        note = '소리가 작게 들려서 기본값으로 맞췄어요';
      }
      calib = { floor, max };
      showCal('✅', '준비 완료!', note, 1);
      await game.wait(900);
      endCal();
    }

    // ----- 판정
    function hit(dir, msg) {
      if (game.time < invulnUntil || !game.playing) return;
      invulnUntil = game.time + INVULN;
      hits++;
      hitLog.push([stageIdx, +dist.toFixed(2), +shipY.toFixed(2), dir]);
      bump = 0.3 * dir;
      game.resetCombo();
      deaf(450);
      if (msg) fx.toast(msg, { kind: 'bad', ms: 900 });
      if (game.loseLife(shipPoint()) <= 0) {
        flying = false;
        game.lose({ icon: '🎈', message: `스테이지 ${stageIdx + 1}에서 하트를 모두 잃었어요.`, checkpoint: stageIdx });
      }
    }

    function reward(base, at) {
      const combo = game.addCombo();
      deaf(250);
      const mult = combo >= 10 ? 3 : combo >= 5 ? 2 : 1;
      game.addScore(base * mult, at);
    }

    function passRing(r) {
      r.done = true;
      ringsTotal++;
      const d = Math.abs(shipY - r.y);
      const at = screenPoint(r.y);
      if (d <= r.r) {
        r.ok = true;
        ringsPassed++;
        const perfect = d <= r.r * 0.35;
        reward(perfect ? 150 : 100, at);
        fx.burst(at, { count: perfect ? 14 : 8, spread: perfect ? 70 : 45, colors: ['#ffd166', '#fff3c4', '#ffb347'] });
        if (perfect) fx.floatText({ x: at.x + 40, y: at.y - 24 }, '완벽!', { color: '#ffe08a', size: 18 });
      } else {
        r.ok = false;
        game.resetCombo();
        softTone(320, 210, 0.12);
        fx.floatText(at, '놓침', { color: '#c9d1f5', size: 17 });
      }
    }

    function zoneTick(z, dt) {
      if (z.kind === 'hush') {
        const over = shipY + HIT_Y > z.line;
        const cap = game.time < invulnUntil ? 0.95 : 1;
        z.wake = clamp(z.wake + (over ? dt / 0.55 : -dt / 1.2), 0, cap);
        if (z.wake >= 1) {
          z.wake = 0.3;
          z.failed = true;
          z.awakeUntil = game.time + 1.2;
          softTone(1300, 700, 0.1);
          hit(-0.8, '🐦 새가 깼어요!');
        }
      } else if (shipY - HIT_Y < z.line) {
        z.failed = true;
        hit(1.3, '⚡ 찌릿! 더 크게!');
      }
    }

    function check(dt) {
      for (const p of world.pillars) {
        if (dist + HIT_T > p.x && dist - HIT_T < p.x + p.w && shipY + HIT_Y > p.y0 && shipY - HIT_Y < p.y1) {
          hit(p.top ? -1 : 1);
          break;
        }
      }
      const seg = world.canyons.find((s) => dist + HIT_T > s.x0 && dist - HIT_T < s.x1);
      if (seg) {
        for (const xs of [dist - HIT_T, dist, dist + HIT_T]) {
          if (xs < seg.x0 || xs > seg.x1) continue;
          const [lo, hi] = bounds(seg, xs);
          if (shipY + HIT_Y > hi) {
            hit(-1);
            break;
          }
          if (shipY - HIT_Y < lo) {
            hit(1);
            break;
          }
        }
      }
      const z = zoneAt(dist);
      if (z && dist >= z.x0) zoneTick(z, dt);
      if (!game.playing) return; // 하트를 다 잃었다
      for (const zz of world.zones) {
        if (zz.done || dist <= zz.x1) continue;
        zz.done = true;
        if (!zz.failed) {
          reward(200, shipPoint());
          fx.toast(zz.kind === 'hush' ? '🤫 쉿 성공!' : '🌪️ 폭풍 돌파!', { kind: 'good', ms: 900 });
        }
      }
      for (const r of world.rings) if (!r.done && dist >= r.x) passRing(r);
      for (const s of world.stars) {
        if (s.got || Math.abs(s.x - dist) > HIT_T * 0.8 + 0.05 || Math.abs(s.y - shipY) > 0.075) continue;
        s.got = true;
        starsGot++;
        const at = screenPoint(s.y);
        reward(50, at);
        fx.burst(at, { count: 10, spread: 50, colors: ['#ffe08a', '#ffffff', '#ffb347'] });
      }
    }

    // ----- 목표 줄 (스테이지와 구간, 조작 방식에 따라)
    function goalHtml() {
      const touch = mode === 'touch';
      const z = world && world.zones.find((zz) => dist > zz.x0 - 1.4 && dist < zz.x1);
      if (z && z.kind === 'hush') return touch ? '🤫 <b>손을 떼고</b> 낮게! 새가 자요' : '🤫 <b>쉿!</b> 아주 조용히, 새가 자요';
      if (z && z.kind === 'storm') return touch ? '🌪️ <b>연타!</b> 바람을 이겨라' : '🌪️ <b>크게 외쳐!</b> 바람을 이겨라';
      if (mode === 'wait') return '🎤 마이크를 준비하고 있어요';
      if (stageIdx === 1) return touch ? '<b>톡톡</b> 끊어 눌러 협곡 가운데로' : '<b>같은 소리</b>로 쭉~ 벽에 닿지 마!';
      if (stageIdx === 2) return touch ? '떼면 <b>쉿</b>, 연타하면 <b>폭풍</b> 돌파' : '<b>쉿</b>엔 조용히, <b>폭풍</b>엔 크게!';
      return touch ? '꾹 누르면 <b>위로</b>, 떼면 <b>아래로</b>' : '크게 내면 <b>위로</b>, 작게 내면 <b>아래로</b>';
    }
    function paintGoal() {
      const html = goalHtml();
      if (html !== goalNow) {
        goalNow = html;
        game.setGoal(html);
      }
      const z = zoneAt(dist + 1.4);
      if (z && !z.warned && moving()) {
        // 구간이 다가오면 목표 줄이 바뀌면서 한 번 튀어 오른다
        z.warned = true;
        softTone(z.kind === 'hush' ? 520 : 700, z.kind === 'hush' ? 390 : 980, 0.12);
        fx.pop(goalEl);
      }
      const zn = zoneAt(dist);
      const storm = mode === 'touch' && !!zn && zn.kind === 'storm';
      if (pad.dataset.storm !== String(storm)) {
        pad.dataset.storm = String(storm);
        pad.innerHTML = storm ? '👆👆 <b>연타!</b> 바람을 이겨라' : '👆 꾹 누르면 <b>위로</b>';
      }
    }

    // ----- 그리기
    const clouds = Array.from({ length: 6 }, (_, i) => ({ x: (i * 0.37 + rand(0, 0.2)) % 1, y: rand(0.12, 0.5), s: rand(0.7, 1.3) }));
    const dots = Array.from({ length: 22 }, () => ({ x: Math.random(), y: Math.random() * 0.7, p: rand(0, 6) }));
    const visible = (x0, x1) => X(x1) > -30 && X(x0) < W + 30;

    function drawBack(t) {
      const th = THEMES[stageIdx];
      ctx.fillStyle = vgrad(ctx, 0, H, th.sky);
      ctx.fillRect(0, 0, W, H);
      if (stageIdx === 2) {
        ctx.fillStyle = '#fff';
        dots.forEach((d) => {
          ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 2 + d.p);
          ctx.fillRect(d.x * W, d.y * H, 2, 2);
        });
        ctx.globalAlpha = 1;
      }
      // 먼 언덕 (천천히 흐른다)
      const off = dist * G.ppt * 0.18;
      const hills = [[0, H]];
      for (let x = 0; x <= W + 8; x += 8) {
        const k = (x + off) / 70;
        hills.push([x, G.top + G.fh * (0.78 - 0.07 * Math.sin(k) - 0.04 * Math.sin(k * 2.3))]);
      }
      hills.push([W + 8, H]);
      poly(ctx, hills, th.far);
      // 구름
      const span = W + 160;
      clouds.forEach((c) => {
        const x = ((((c.x * span - dist * G.ppt * 0.35) % span) + span) % span) - 80;
        const y = G.top + G.fh * c.y;
        const r = 16 * c.s * Math.max(1, W / 380);
        oval(ctx, x, y, r, r, th.cloud);
        oval(ctx, x + r * 0.9, y + r * 0.2, r * 0.75, r * 0.75, th.cloud);
        oval(ctx, x - r * 0.9, y + r * 0.25, r * 0.65, r * 0.65, th.cloud);
      });
    }

    function drawPillar(p, t) {
      const x0 = X(p.x);
      const pw = p.w * G.ppt;
      if (p.top) {
        // 먹구름 기둥
        const yb = Y(p.y0);
        const cg = vgrad(ctx, 0, yb, ['#363b70', '#5d64a8']);
        ctx.fillStyle = cg;
        ctx.fillRect(x0, -10, pw, yb + 10 - pw * 0.2);
        for (let k = 0; k < 3; k++) oval(ctx, x0 + pw * (0.2 + k * 0.3), yb - pw * 0.22, pw * 0.24, pw * 0.24, cg);
        oval(ctx, x0 + pw * 0.3, yb - pw * 0.3, pw * 0.12, pw * 0.12, 'rgba(255,255,255,.16)');
        if ((t * 3 + p.x) % 2 < 0.25) bolt(ctx, x0 + pw * 0.5, yb - 2);
      } else {
        // 바위 탑
        const yt = Y(p.y1);
        rrect(ctx, x0, yt, pw, H - yt, [pw * 0.45, pw * 0.45, 0, 0]);
        paint(ctx, '#7a5a92');
        rrect(ctx, x0 + pw * 0.15, yt + 6, pw * 0.18, H - yt - 6, 6);
        paint(ctx, 'rgba(255,255,255,.18)');
      }
    }

    function drawCanyon(s) {
      const a = Math.max(s.x0, dist - G.sx / G.ppt - 0.1);
      const b = Math.min(s.x1, dist + (W - G.sx) / G.ppt + 0.1);
      const step = 6 / G.ppt;
      for (const side of [1, 0]) {
        const edge = [];
        for (let x = a; x < b + step; x += step) edge.push([X(Math.min(x, b)), Y(bounds(s, Math.min(x, b))[side])]);
        const far = side ? -10 : H + 10;
        poly(ctx, [[X(a), far], ...edge, [X(b), far]], side ? '#a2475f' : '#8e3a53');
        poly(ctx, edge, '#ffb3a1', 3);
      }
    }

    function drawHush(z, x0, x1, yl, t) {
      // 새들이 자는 숲 지붕: 쉿 선 위는 모두 나뭇가지다
      ctx.fillStyle = vgrad(ctx, 0, yl, ['#0c2422', '#1d5546']);
      ctx.fillRect(x0, -10, x1 - x0, yl + 10);
      for (let vx = z.x0 + 0.2; vx < z.x1 - 0.1; vx += 0.38) {
        const vy = yl - 40 - ((vx * 137) % 1) * G.fh * 0.25;
        ctx.beginPath();
        ctx.moveTo(X(vx), -4);
        ctx.quadraticCurveTo(X(vx) + 8, vy * 0.6, X(vx), vy);
        paint(ctx, 'rgba(120,200,150,.28)', 2);
        oval(ctx, X(vx) + 4, vy, 5, 3, 'rgba(120,200,150,.35)');
      }
      for (let x = x0 + 10, k = 0; x < x1 - 4; x += 20, k++) oval(ctx, x, yl - 2, 11 + (k % 3), 11 + (k % 3), k % 2 ? '#2b7258' : '#236250');
      ctx.setLineDash([6, 6]);
      poly(ctx, [[x0, yl + 10], [x1, yl + 10]], 'rgba(255,255,255,.5)', 2);
      ctx.setLineDash([]);
      const awake = game.time < z.awakeUntil;
      const bs = Math.max(8, G.fh * 0.022);
      ctx.font = `800 ${Math.round(bs * (awake ? 1.6 : 1.1))}px system-ui, sans-serif`;
      for (let bx = z.x0 + 0.55; bx < z.x1 - 0.2; bx += 1.1) {
        drawBird(ctx, X(bx), yl - bs * 2.2, bs, awake, t);
        ctx.fillStyle = awake ? '#ff5d73' : 'rgba(255,255,255,.75)';
        const lift = (t * 0.8 + bx) % 1;
        if (awake) ctx.fillText('!', X(bx) + bs * 0.4, yl - bs * 4);
        else if (z.wake > 0.25) ctx.fillText('?', X(bx) + bs * 0.6, yl - bs * 3.8);
        else ctx.fillText('z', X(bx) + bs * (0.8 + lift), yl - bs * (3.2 + lift * 1.5));
      }
    }

    function drawStorm(z, x0, x1, yl, t) {
      // 번개 구름 바닥: 폭풍 선 아래로 내려가면 찌릿
      ctx.fillStyle = vgrad(ctx, yl, H, ['#4a3a88', '#171034']);
      ctx.fillRect(x0, yl + 8, x1 - x0, H - yl);
      for (let x = x0 + 12, k = 0; x < x1 - 6; x += 24, k++) oval(ctx, x, yl + 10, 14 + (k % 3) * 2, 14 + (k % 3) * 2, k % 2 ? '#5a4aa0' : '#4d3e90');
      for (let x = x0 + 30; x < x1 - 20; x += 70) oval(ctx, x, yl + 60 + ((x * 0.37) % 40), 26, 26, 'rgba(255,255,255,.06)');
      if ((t * 5 + z.x0) % 1.7 < 0.18) bolt(ctx, x0 + ((z.x0 * 97 + Math.floor(t * 5) * 53) % 1) * (x1 - x0), yl + 4);
      // 아래로 부는 바람
      for (let k = 0; k < 9; k++) {
        const wx = x0 + ((k * 0.13 + t * 1.6) % 1) * (x1 - x0);
        const wy = G.top + G.fh * (0.05 + ((k * 0.29) % 1) * (1 - z.line - 0.1));
        poly(ctx, [[wx, wy], [wx - 22, wy + 9]], 'rgba(220,230,255,.45)', 2);
      }
    }

    function drawObstacles(t) {
      const w = world;
      w.pillars.forEach((p) => visible(p.x, p.x + p.w) && drawPillar(p, t));
      w.canyons.forEach((s) => visible(s.x0, s.x1) && drawCanyon(s));
      for (const z of w.zones) {
        if (!visible(z.x0, z.x1)) continue;
        const x0 = X(z.x0);
        const yl = Y(z.line);
        (z.kind === 'hush' ? drawHush : drawStorm)(z, x0, X(z.x1), yl, t);
        // 들어가는 곳의 표지판
        if (x0 > G.sx + 10) {
          const label = z.kind === 'hush' ? '🤫 쉿!' : '🌪️ 크게!';
          const sy = z.kind === 'hush' ? yl + 40 : yl - 30;
          ctx.font = '900 17px system-ui, sans-serif';
          const tw = ctx.measureText(label).width + 20;
          rrect(ctx, x0 - tw / 2, sy - 15, tw, 28, 14);
          paint(ctx, z.kind === 'hush' ? '#3ddc97' : '#ffd166');
          ctx.fillStyle = '#1a1433';
          ctx.textAlign = 'center';
          ctx.fillText(label, x0, sy + 5);
          ctx.textAlign = 'start';
        }
      }
      for (const s of w.stars) {
        if (s.got || !visible(s.x, s.x)) continue;
        const pts = starPts(X(s.x), Y(s.y), Math.max(9, G.fh * 0.026) * (1 + 0.08 * Math.sin(t * 6 + s.x)), Math.sin(t * 2 + s.x) * 0.3);
        poly(ctx, pts, '#ffd166');
        poly(ctx, [...pts, pts[0]], '#fff3c4', 2);
      }
      // 결승 깃발
      if (visible(w.len, w.len)) {
        const fx0 = X(w.len);
        const fy = G.top + G.fh * 0.1;
        ctx.fillStyle = '#eee';
        ctx.fillRect(fx0 - 2, fy, 4, G.fh * 0.9);
        for (let k = 0; k < 12; k++) {
          ctx.fillStyle = ((k >> 2) + k) % 2 ? '#222' : '#fff';
          ctx.fillRect(fx0 + 2 + (k % 4) * 8, fy + (k >> 2) * 8, 8, 8);
        }
      }
    }

    /** 고리는 뒤쪽 반을 비행선보다 먼저, 앞쪽 반을 나중에 그려 통과하는 느낌을 낸다 */
    function drawRings(front) {
      for (const r of world.rings) {
        if (!visible(r.x, r.x)) continue;
        const ry = r.r * G.fh;
        const rx = Math.max(7, ry * 0.3);
        const color = r.done ? (r.ok ? 'rgba(61,220,151,.75)' : 'rgba(180,190,220,.45)') : front ? '#ffd166' : '#e0a83a';
        oval(ctx, X(r.x), Y(r.y), rx, ry, color, Math.max(5, rx * 0.6), front ? Math.PI / 2 : -Math.PI / 2, front ? Math.PI * 1.5 : Math.PI / 2);
      }
    }

    function drawMeter() {
      // 화면 왼쪽 가장자리: 지금 소리(또는 누름) 세기, 구간이 다가오면 넘으면 안 되는/넘어야 하는 표시
      const bx = 6;
      const bw = 10;
      const by = G.top + 8;
      const bh = G.fh - 16;
      rrect(ctx, bx - 2, by - 2, bw + 4, bh + 4, 7);
      paint(ctx, 'rgba(10,12,30,.45)');
      const z = zoneAt(dist + 1.0);
      const hush = !!z && z.kind === 'hush';
      const need = z ? (z.line + (hush ? -HIT_Y : HIT_Y) - MIN_Y) / (MAX_Y - MIN_Y) + (hush ? 0 : 0.12) : null;
      const over = need !== null && (hush ? level > need : level < need);
      const fh = clamp(level, 0, 1) * bh;
      rrect(ctx, bx, by + bh - fh, bw, Math.max(2, fh), 5);
      paint(ctx, over && hush ? '#ff5d73' : vgrad(ctx, by, by + bh, ['#ff5d73', '#ffb347', '#3ddc97']));
      if (need !== null) {
        const ny = by + bh - clamp(need, 0, 1) * bh;
        const col = over ? '#ff5d73' : '#fff';
        ctx.fillStyle = col;
        ctx.fillRect(bx - 3, ny - 1.5, bw + 6, 3);
        poly(ctx, [[bx + bw + 4, ny], [bx + bw + 11, ny - 5], [bx + bw + 11, ny + 5]], col);
      }
    }

    function draw(t) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBack(t);
      if (world) {
        drawObstacles(t);
        drawRings(false);
      }
      const ghost = game.time < invulnUntil && Math.floor(t * 10) % 2 === 0;
      drawShip(ctx, G.sx, Y(shipY), 0.62 * G.ppt, SHIP_R * 2 * G.fh, clamp(-shipVy * 0.45, -0.35, 0.35), clamp(level, 0, 1), ghost, t);
      if (world) drawRings(true);
      // 땅
      const gy = G.top + G.fh;
      ctx.fillStyle = THEMES[stageIdx].ground;
      ctx.fillRect(0, gy, W, H - gy);
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      for (let x = -((dist * G.ppt) % 28); x < W; x += 28) ctx.fillRect(x, gy + 5, 12, 3);
      drawMeter();
    }

    function paintTrack() {
      const k = world ? clamp(dist / world.len, 0, 1) : 0;
      trackFill.style.transform = `scaleX(${k})`;
      mark.style.left = `calc(${(k * 100).toFixed(2)}% - ${(k * 14).toFixed(1)}px)`;
    }

    // ----- 진행
    function build(i) {
      const len = S.stageSec;
      if (i === 0) return buildRings(len, gap, tol);
      if (i === 1) return buildCanyon(len, gap, tol, ease);
      return buildZones(len, gap, tol, ease);
    }

    async function runStage() {
      world = build(stageIdx);
      dist = 0;
      flying = false;
      game.setStage(stageIdx, STAGES.length);
      chip.textContent = `${stageIdx + 1}. ${STAGES[stageIdx].name}`;
      paintGoal();
      deaf(600);
      const [title, sub] = STAGES[stageIdx].banner;
      await game.banner(title, sub, { ms: 1500 });
      flying = true;
    }

    async function stageClear() {
      flying = false;
      deaf(700);
      game.addScore(300, shipPoint());
      fx.confetti(24);
      if (stageIdx >= STAGES.length - 1) return finish();
      Arcade.sfx('stage');
      fx.toast('🏁 통과! +300', { kind: 'good', ms: 1000 });
      await game.wait(800);
      stageIdx++;
      runStage();
    }

    function finish() {
      const lost = game.config.lives - game.lives;
      const ratio = ringsTotal ? ringsPassed / ringsTotal : 1;
      let stars = lost === 0 && ratio >= 0.8 ? 3 : lost <= 1 && ratio >= 0.5 ? 2 : 1;
      if (game.retry > 0) stars = Math.min(stars, 2);
      game.win({
        stars,
        title: '착륙 성공!',
        message: stars === 3 ? '한 번도 안 부딪히고 고리도 거의 다! 목소리 조종 달인이에요.' : '쉿과 폭풍을 모두 지나 무사히 도착했어요!',
        stats: [
          ['통과한 고리', `${ringsPassed} / ${ringsTotal}`],
          ['모은 별', `${starsGot}개`],
          ['부딪힘', `${hits}번`],
          ['최대 콤보', `${game.maxCombo}`],
        ],
      });
    }

    game.loop((dt, t) => {
      if (pilot && world) runPilot(dt);
      level = readLevel(dt);
      const z = zoneAt(dist);
      const gust = z && z.kind === 'storm' && moving() ? 0.1 + 0.05 * Math.sin(t * 2.6) : 0;
      const goal = MIN_Y + (MAX_Y - MIN_Y) * clamp(level + bump - gust, 0, 1);
      const step = clamp((goal - shipY) * (1 - Math.exp(-dt * 6)), -1.8 * dt, 1.8 * dt);
      shipY += step;
      shipVy = dt > 0 ? step / dt : 0;
      bump *= Math.exp(-dt * 2.4);
      if (moving()) {
        dist += dt;
        check(dt);
        if (game.playing && dist >= world.len) stageClear();
      }
      paintGoal();
      paintTrack();
      draw(t);
    });

    game.onCleanup(() => {
      alive = false;
      closeMic();
    });

    if (game.debug) {
      // 검증용: 상태 보기, 입력 세기 직접 넣기(null 이면 실제 입력), 자동 조종('voice' | 'touch' | null)
      window.__game = {
        state: () => ({
          stage: stageIdx, dist, len: world ? world.len : 0, flying, moving: moving(), mode, calibrating, calib, prov,
          level, raw, touchLv, shipY, held: pointers.size, lives: game.lives, ringsPassed, ringsTotal, starsGot, hits, hitLog,
          zone: (() => { const z = zoneAt(dist); return z ? { kind: z.kind, wake: z.wake, line: z.line } : null; })(),
          mic: { status: mic.status, why: mic.why, live: micLive() }, gap, tol,
        }),
        world: () => world,
        guide: (x) => guideAt(world, x === undefined ? dist : x),
        feed: (v) => (fake = v === null || v === undefined ? null : clamp(Number(v), 0, 1)),
        pilot: (m) => {
          pilot = m || null;
          if (!pilot) {
            fake = null;
            pointers.delete('pilot');
          }
        },
        db: () => micDb(),
        setMode: (m) => (m === 'touch' ? useTouchInstead('') : setMode(m)),
        skip: (x) => (dist = x),
        settings: S,
      };
    }

    // ----- 시작: 조작 방식 정하기 → (마이크면) 보정 → 스테이지
    (async () => {
      if (prefer === 'touch') setMode('touch');
      else if (micLive()) setMode('mic');
      else {
        setMode('wait');
        showCal('🎤', '마이크 준비 중', '권한 창이 뜨면 <b>허용</b>을 눌러 주세요', null);
        const ok = mic.status === 'fail' ? false : await openMic();
        if (!alive) return;
        cal.classList.add('ar-hidden');
        if (mode === 'wait') {
          if (ok && micLive()) setMode('mic');
          else useTouchInstead((WHY[mic.why] || WHY.error) + ' 손가락으로 해요');
        }
      }
      if (mode === 'mic' && !calib) await calibrate();
      if (!alive) return;
      runStage();
    })();
  }

  Arcade.createGame({
    id: GAME_ID,
    title: '목소리 비행선',
    icon: '🎈',
    accent: '#ff5d73',
    accent2: '#ffb347',
    tagline: '크게 외치면 올라가고, 조용하면 내려가요. <b>목소리</b>로 하늘을 날아라!',
    howTo: [
      '소리가 <b>크면 위로</b>, 작으면 <b>아래로</b>. 고리를 통과해요',
      '벽과 기둥에 부딪히면 <b>하트 -1</b>. 마지막엔 <b>쉿!</b>과 <b>폭풍</b>',
      '마이크가 없으면 <b>누르고 있기</b>로 조종해요',
    ],
    lives: S.lives,
    stages: STAGES.length,
    music: false, // 배경 리듬이 마이크에 들어가면 안 된다
    startLabel: '🎤 마이크 켜고 시작',
    async prepare() {
      if (prefer === 'touch') return;
      // 권한 창에서 오래 머물면 일단 시작하고, 판 안에서 마저 기다린다
      await Promise.race([openMic(), Arcade.wait(8000)]);
    },
    start,
    onEnd() {
      // 결과·실패 화면에서는 마이크를 끈다. 다시 하면 start 가 다시 연다
      closeMic();
    },
  });
})();
