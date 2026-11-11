// 매직 컴퍼스 "보물 레이더"
// 방향 이름은 알려 주지 않는다. 삐삐 소리와 레이더 불빛만 따라 제자리에서 몸을 돌려 보물 쪽을 찾는다.
(function () {
  'use strict';

  const { h, rand, shuffle, clamp, lerp, sfx, fx } = Arcade;
  const A = Arcade.audio;
  const GAME_ID = 'game16';

  // ----- 설정 (관리자 페이지와 같은 키. 기본값 표는 admin.js 와 같아야 한다)
  const PRESETS = [
    { tolerance: 20, holdTime: 1.2, missionCount: 2, findTime: 14, noiseAmplitude: 8, noiseFrequency: 0.5, noiseComplexity: 2 },
    { tolerance: 15, holdTime: 1.6, missionCount: 3, findTime: 12, noiseAmplitude: 12, noiseFrequency: 0.7, noiseComplexity: 3 },
    { tolerance: 11, holdTime: 2, missionCount: 4, findTime: 10, noiseAmplitude: 16, noiseFrequency: 0.9, noiseComplexity: 4 },
  ];
  const LIMITS = {
    tolerance: [5, 35],
    holdTime: [0.5, 4],
    missionCount: [1, 6],
    findTime: [6, 30],
    noiseAmplitude: [0, 30],
    noiseFrequency: [0.1, 2],
    noiseComplexity: [1, 5],
  };
  // 옛 설정은 { difficultyLevel, tolerance, holdTime, missionCount, compassNoise: { amplitude, frequency, complexity } } 이었다
  const saved = Arcade.loadSettings('game16_settings', {});
  const oldNoise = saved.compassNoise && typeof saved.compassNoise === 'object' ? saved.compassNoise : {};
  const LEGACY = { noiseAmplitude: oldNoise.amplitude, noiseFrequency: oldNoise.frequency, noiseComplexity: oldNoise.complexity };
  const level = clamp(parseInt(saved.difficulty !== undefined ? saved.difficulty : saved.difficultyLevel, 10) || 0, 0, 2);
  const S = Object.assign({}, PRESETS[level]);
  Object.keys(LIMITS).forEach((key) => {
    const raw = saved[key] !== undefined ? saved[key] : LEGACY[key];
    if (raw === null || raw === undefined || raw === '' || typeof raw === 'boolean') return;
    const v = Number(raw);
    if (!Number.isFinite(v) || v < 0 || (v === 0 && key !== 'noiseAmplitude')) return;
    S[key] = clamp(v, LIMITS[key][0], LIMITS[key][1]);
  });
  S.missionCount = Math.round(S.missionCount);
  S.noiseComplexity = Math.round(S.noiseComplexity);

  const HEAR = 4.5; // 삐삐가 들리는 폭 = 신호 폭(tolerance) × 이 값
  const ROCK_PEAK = 0.5; // 돌멩이 신호의 최대 세기 (진짜는 1)
  const ROCK_SEC = 3; // 돌멩이를 파면 잃는 시간(초)
  const DRAG_K = 0.55; // 끌기 1px 에 도는 각도
  const HARM = [1, 1.73, 2.91, 4.37, 6.13]; // 자기 폭풍 흔들림을 만드는 주파수 배수
  const LOOT = ['💎', '👑', '💰', '🏺', '🪙', '📿'];
  const STAGES = [
    {
      tol: 1.3, hear: 1.25, rocks: 0, move: false, storm: false, time: 1, fade: 0.45,
      banner: ['스테이지 1', '삐삐 소리를 따라 보물을 찾아라'],
      goal: '<b>삐삐가 빨라지는</b> 쪽을 찾아 버텨!',
    },
    {
      tol: 1, hear: 1, rocks: 2, move: false, storm: false, time: 1.25, fade: 0.55,
      banner: ['스테이지 2', '돌멩이 주의! 진짜는 소리가 높다'],
      goal: '<b>높은 삐삐</b>가 진짜, 낮은 뚝뚝은 <b>돌멩이</b>',
    },
    {
      tol: 1.15, hear: 1, rocks: 1, move: true, storm: true, time: 1.4, fade: 0.7,
      banner: ['마지막 스테이지', '보물이 도망친다! 자기 폭풍도 온다'],
      goal: '<b>도망가는 보물</b>을 쫓아라! 폭풍 조심',
    },
  ];

  const RAD = Math.PI / 180;
  const TAU = Math.PI * 2;
  const wrap180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
  const norm360 = (a) => ((a % 360) + 360) % 360;

  /**
   * 방향 센서 이벤트에서 "폰이 향한 쪽"의 방위(도, 시계 방향)를 구한다.
   * 폰 윗변과 뒷면이 가리키는 방향을 더해서 수평으로 눕히면, 눕혀 들든 세워 들든 앞쪽이 된다.
   * 값이 없으면 undefined, 폰을 뒤집어 들어 방향을 알 수 없으면 null.
   */
  function headingOf(e) {
    const { alpha, beta, gamma } = e;
    if (typeof alpha === 'number' && typeof beta === 'number' && typeof gamma === 'number') {
      const sa = Math.sin(alpha * RAD), ca = Math.cos(alpha * RAD);
      const sb = Math.sin(beta * RAD), cb = Math.cos(beta * RAD);
      const sg = Math.sin(gamma * RAD), cg = Math.cos(gamma * RAD);
      const x = -sa * cb - ca * sg - sa * sb * cg; // 동쪽 성분
      const y = ca * cb - sa * sg + ca * sb * cg; // 북쪽 성분
      if (Math.hypot(x, y) > 0.2) return norm360(Math.atan2(x, y) / RAD);
      return null;
    }
    // 아이폰에서 alpha 가 비어 있을 때의 대비
    if (typeof e.webkitCompassHeading === 'number' && e.webkitCompassHeading >= 0) return e.webkitCompassHeading;
    return undefined;
  }

  /** 각도 차이 d 에서 들리는 신호 세기 (0~peak) */
  function falloff(d, width, peak) {
    if (d >= width) return 0;
    return peak * Math.pow(1 - d / width, 1.6);
  }

  let motionOK = false; // 센서 권한 결과. 시작 버튼을 누를 때 한 번만 묻는다

  function start(game) {
    const R = Math.min(game.retry, 3);
    const widen = 1 + R * 0.15; // 재도전하면 신호가 넓어진다
    const stormEase = 1 - R * 0.1;

    let stageIdx = game.checkpoint;
    let st = STAGES[stageIdx];
    let tol = 10;
    let hear = 45;
    // 방향(도). 펼친 값이라 0/360 경계에서 튀지 않는다. 0 = 시작할 때 향한 쪽
    let heading = 0;
    let eff = 0; // 자기 폭풍 흔들림까지 더한, 레이더가 읽는 방향
    let jitter = 0;
    // 조작
    let mode = motionOK ? 'pending' : 'drag'; // pending(센서 확인 중) | sensor | drag
    let sensorHeading = 0;
    let lastRaw = null;
    let srcRank = 0;
    let srcAt = -9;
    let sensorSeen = 0;
    let sinceEvent = 99;
    let dragId = null;
    let lastX = 0;
    let lastMoveT = 0;
    let dragVel = 0;
    const keys = { left: false, right: false };
    let keyHold = 0;
    // 판
    let phase = 'idle'; // idle | search | reward
    let signals = []; // { a: 방위, real, peak, dir, turnIn }
    let found = 0;
    let need = S.missionCount;
    let spawnAt = 0;
    let dig = 0;
    let digTarget = null;
    let stageTimer = null;
    let stageTotal = 0;
    let rocksDug = 0;
    let foundTotal = 0;
    let fastest = Infinity;
    let leftSum = 0;
    let totalSum = 0;
    let storms = 0;
    const storm = { state: 'calm', at: 0, start: 0, end: 0, phase: [] };
    // 피드백
    let glow = 0;
    let inZone = null;
    let lastSense = { best: null, s: 0, zone: null };
    let beepPhase = 0.6;
    let idleT = 0;
    let digT = 0;
    let crackleT = 0;
    let note = null; // 잠깐 띄우는 글 { text, heat, until }
    let pop = null; // 레이더 위로 솟는 그림 { emoji, t }
    const trail = new Float32Array(72); // 지나온 방향(5도 칸)에서 들은 신호 세기. 천천히 사라진다
    let lastEff = null;
    const pings = [];

    // ----- 화면
    const lootEl = h('div', { class: 'ar-chip mc-loot' });
    const modeBtn = h('button', { class: 'mc-mode ar-hidden', type: 'button' });
    const canvas = h('canvas', { class: 'mc-canvas' });
    const radarBox = h('div', { class: 'mc-radar' }, canvas);
    const bars = [0, 1, 2, 3, 4].map(() => h('i'));
    const barsEl = h('div', { class: 'mc-bars' }, bars);
    const wordEl = h('div', { class: 'mc-word' });
    const hint = h('div', { class: 'mc-hint' });
    const wrap = h('div', { class: 'mc-wrap' }, [
      h('div', { class: 'mc-top' }, [lootEl, modeBtn]),
      radarBox,
      h('div', { class: 'mc-read' }, [barsEl, wordEl]),
      hint,
    ]);
    game.root.append(wrap);
    const ctx = canvas.getContext('2d');

    function radarPoint(k) {
      const r = canvas.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 - (r.height / 2) * k };
    }

    // ----- 조작 방식
    function paintMode() {
      wrap.dataset.mode = mode;
      modeBtn.classList.toggle('ar-hidden', sensorSeen === 0);
      modeBtn.textContent = mode === 'sensor' ? '📱 몸으로' : '👆 손가락';
      hint.textContent =
        mode === 'sensor'
          ? '📱 폰을 앞으로 들고 제자리에서 빙글!'
          : mode === 'pending'
            ? '📱 센서 확인 중…'
            : '👆 좌우로 끌거나 ◀ ▶ 키로 돌려요';
    }

    function setMode(next, why) {
      mode = next;
      lastRaw = null; // 센서로 바꾸면 지금 방향에서 이어 간다
      dragId = null;
      dragVel = 0;
      paintMode();
      if (why) fx.toast(why, { ms: 1800 });
    }

    modeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!game.playing) return;
      sfx('tap');
      if (mode === 'sensor') setMode('drag', '👆 끌어서 돌려요');
      else if (sinceEvent < 1) setMode('sensor', '📱 몸으로 돌려요');
      else fx.toast('센서 신호가 없어요', { kind: 'bad', ms: 1200 });
    });

    // 센서: 시작할 때 향한 쪽을 0으로 잡고, 그 뒤로는 바뀐 만큼만 더한다(상대 각도)
    function onOrient(e, rank) {
      const raw = headingOf(e);
      if (raw === undefined) return;
      if (rank < srcRank && game.time - srcAt < 1) return; // 더 좋은 센서가 살아 있으면 그쪽만 쓴다
      if (rank !== srcRank) {
        srcRank = rank;
        lastRaw = null;
      }
      srcAt = game.time;
      sinceEvent = 0;
      if (++sensorSeen === 1) paintMode();
      if (mode !== 'sensor' && mode !== 'pending') return;
      if (raw === null) {
        lastRaw = null;
        return;
      }
      if (lastRaw === null) sensorHeading = heading;
      else sensorHeading += wrap180(raw - lastRaw);
      lastRaw = raw;
    }
    // 'deviceorientation' 은 자이로 기반 상대값이라 실내에서 더 안정적이다. 없을 때만 절대값을 쓴다
    game.on(window, 'deviceorientation', (e) => onOrient(e, 2));
    game.on(window, 'deviceorientationabsolute', (e) => onOrient(e, 1));

    // 대체 조작: 좌우로 끌면 레이더가 돈다(손을 떼면 조금 더 미끄러진다)
    wrap.addEventListener('pointerdown', (e) => {
      if (e.target === modeBtn || !game.playing || mode !== 'drag') return;
      e.preventDefault();
      dragId = e.pointerId;
      lastX = e.clientX;
      lastMoveT = performance.now();
      dragVel = 0;
      try {
        wrap.setPointerCapture(e.pointerId);
      } catch (err) {
        /* 포인터 잡기를 지원하지 않는 브라우저 */
      }
    });
    wrap.addEventListener('pointermove', (e) => {
      if (e.pointerId !== dragId) return;
      const t = performance.now();
      const dts = Math.max(0.008, (t - lastMoveT) / 1000);
      const turn = -(e.clientX - lastX) * DRAG_K; // 오른쪽으로 끌면 판이 시계 방향으로 돈다 = 왼쪽을 본다
      lastX = e.clientX;
      lastMoveT = t;
      heading += turn;
      dragVel = lerp(dragVel, turn / dts, 0.6);
    });
    const endDrag = (e) => {
      if (e.pointerId !== dragId) return;
      dragId = null;
      if (performance.now() - lastMoveT > 90) dragVel = 0; // 멈췄다 뗀 것이면 미끄러지지 않는다
      dragVel = clamp(dragVel, -320, 320);
    };
    wrap.addEventListener('pointerup', endDrag);
    wrap.addEventListener('pointercancel', endDrag);

    // 키보드: ◀ ▶ (또는 A, D). 누르고 있으면 점점 빨라진다
    const KEYS = { ArrowLeft: 'left', ArrowRight: 'right', KeyA: 'left', KeyD: 'right' };
    game.on(window, 'keydown', (e) => {
      const dir = KEYS[e.code];
      if (!dir) return;
      e.preventDefault();
      if (!game.playing) return;
      if (mode !== 'drag') setMode('drag', '⌨️ 키보드로 돌려요');
      if (!keys[dir] && !e.repeat) heading += dir === 'right' ? 2 : -2;
      keys[dir] = true;
    });
    game.on(window, 'keyup', (e) => {
      const dir = KEYS[e.code];
      if (dir) keys[dir] = false;
    });
    game.onPauseChange((paused) => {
      if (!paused) return;
      keys.left = keys.right = false;
      dragId = null;
      dragVel = 0;
    });

    // ----- 소리
    function beep(real, s) {
      if (real) {
        const f = 988 + 600 * s;
        A.tone({ freq: f, type: 'sine', dur: 0.07, vol: 0.07 + 0.17 * s });
        A.tone({ freq: f * 2, type: 'sine', dur: 0.04, vol: 0.02 + 0.04 * s });
      } else {
        const f = 260 + 100 * s;
        A.tone({ freq: f, to: f * 0.7, type: 'triangle', dur: 0.1, vol: 0.1 + 0.18 * s });
        A.noise({ dur: 0.05, freq: 700, filter: 'lowpass', vol: 0.06 + 0.08 * s });
      }
    }

    function digSound(real, k) {
      A.noise({ dur: 0.06, freq: 1400 + 1800 * k, vol: 0.1, q: 1.2 });
      A.tone({ freq: (real ? 523 : 262) * Math.pow(2, k), type: 'square', dur: 0.05, vol: 0.05 });
    }

    // ----- 신호
    function layout() {
      const n = 1 + st.rocks;
      const sep = Math.min(110, Math.max(tol * 3.2, hear * 0.75));
      let list = [];
      for (let i = 0; i < 300 && list.length < n; i++) {
        const a = heading + rand(70, 290); // 지금 보는 쪽에서는 나오지 않는다
        if (list.every((b) => Math.abs(wrap180(a - b)) >= sep)) list.push(a);
      }
      if (list.length < n) {
        const gap = Math.min(sep, 220 / Math.max(1, n - 1));
        const base = heading + 180 - (gap * (n - 1)) / 2;
        list = shuffle(Array.from({ length: n }, (_, i) => base + gap * i));
      }
      signals = list.map((a, i) => ({
        a: norm360(a),
        real: i === 0,
        peak: i === 0 ? 1 : ROCK_PEAK,
        dir: Math.random() < 0.5 ? -1 : 1,
        turnIn: rand(1.5, 3.5),
      }));
      dig = 0;
      digTarget = null;
      spawnAt = game.time;
      beepPhase = 0.6;
    }

    // 3스테이지: 보물이 떠돌다가, 가까이 오면 도망간다. 파고 있을 때는 느려진다
    function moveTreasure(dt) {
      const t = signals.find((o) => o.real);
      if (!t) return;
      const d = wrap180(t.a - heading);
      const ad = Math.abs(d);
      let speed;
      if (ad <= tol) speed = 5;
      else if (ad < hear * 0.55) {
        speed = 14;
        t.dir = d >= 0 ? 1 : -1;
      } else {
        speed = 8;
        t.turnIn -= dt;
        if (t.turnIn <= 0) {
          t.turnIn = rand(1.5, 3.5);
          t.dir = -t.dir;
        }
      }
      const next = t.a + t.dir * speed * (1 - R * 0.1) * dt;
      if (signals.some((o) => !o.real && Math.abs(wrap180(next - o.a)) < tol * 2.6)) t.dir = -t.dir;
      else t.a = norm360(next);
    }

    function sense() {
      let best = null;
      let bestS = 0;
      let zone = null;
      let zoneD = 1e9;
      for (const o of signals) {
        const d = Math.abs(wrap180(o.a - eff));
        const s = falloff(d, hear, o.peak);
        if (s > bestS) {
          bestS = s;
          best = o;
        }
        if (d <= tol && d < zoneD) {
          zone = o;
          zoneD = d;
        }
      }
      return { best, s: bestS, zone };
    }

    function updateStorm(dt) {
      const t = game.time;
      if (storm.state === 'calm' && t >= storm.at) {
        storm.state = 'warn';
        storm.start = t + 1.2;
        wrap.classList.add('warn');
        sfx('warn');
        fx.toast('⚡ 자기 폭풍이 온다!', { kind: 'bad', ms: 1200 });
      } else if (storm.state === 'warn' && t >= storm.start) {
        storm.state = 'storm';
        storm.end = t + rand(2.6, 3.6);
        storm.phase = HARM.map(() => rand(0, TAU));
        storms++;
        wrap.classList.remove('warn');
        wrap.classList.add('storm');
        A.noise({ dur: 0.9, freq: 300, to: 3200, vol: 0.18 });
      } else if (storm.state === 'storm' && t >= storm.end) {
        storm.state = 'calm';
        storm.at = t + rand(5.5, 8.5);
        wrap.classList.remove('storm');
        A.noise({ dur: 0.4, freq: 2400, to: 300, vol: 0.1 });
      }
      if (storm.state !== 'storm') {
        jitter = 0;
        return;
      }
      const env = clamp(Math.min(t - storm.start, storm.end - t) / 0.4, 0, 1);
      let sum = 0;
      let wsum = 0;
      for (let i = 0; i < S.noiseComplexity; i++) {
        const w = 1 / Math.sqrt(i + 1);
        sum += w * Math.sin(TAU * S.noiseFrequency * HARM[i] * t + storm.phase[i]);
        wsum += w;
      }
      jitter = S.noiseAmplitude * stormEase * env * clamp((sum / wsum) * 1.5, -1.2, 1.2);
      crackleT -= dt;
      if (crackleT <= 0) {
        crackleT = rand(0.07, 0.22);
        A.noise({ dur: 0.04, freq: rand(2500, 7000), vol: 0.05, filter: 'highpass' });
      }
      // 레이더 기억에 가짜 반짝임이 섞인다
      if (Math.random() < dt * 14) {
        const i = Math.floor(Math.random() * 72);
        trail[i] = Math.max(trail[i], rand(0.25, 0.7));
      }
    }

    function updateTrail(dt) {
      const fade = storm.state === 'storm' ? 1.4 : st.fade;
      for (let i = 0; i < 72; i++) if (trail[i] > 0) trail[i] = Math.max(0, trail[i] - fade * dt);
      const from = lastEff === null ? eff : lastEff;
      lastEff = eff;
      if (phase !== 'search') return;
      // 빨리 돌아도 빈칸이 생기지 않게 지나온 사이를 4도마다 채운다
      const span = eff - from;
      const steps = Math.min(90, Math.ceil(Math.abs(span) / 4));
      for (let k = 0; k <= steps; k++) {
        const a = steps ? from + (span * k) / steps : eff;
        let s = 0;
        for (const o of signals) s = Math.max(s, falloff(Math.abs(wrap180(o.a - a)), hear, o.peak));
        const i = Math.floor(norm360(a) / 5) % 72;
        if (s > trail[i]) trail[i] = s;
      }
    }

    function feedback(dt, sn) {
      if (phase !== 'search') return;
      if (sn.zone) {
        digT -= dt;
        if (digT <= 0) {
          digT = 0.15;
          digSound(sn.zone.real, dig);
        }
        beepPhase = 0.6;
        return;
      }
      digT = 0;
      if (sn.s > 0.02) {
        idleT = 0;
        // 가까울수록 삐 소리 간격이 짧아진다 (1.1초 → 0.11초). 돌멩이는 아무리 가까워도 0.55초
        beepPhase += dt / lerp(1.1, 0.11, Math.pow(sn.s, 0.85));
        if (beepPhase >= 1) {
          beepPhase = Math.min(beepPhase - 1, 0.5);
          beep(sn.best.real, sn.s);
          pings.push({ t: 0, s: sn.s, rock: !sn.best.real });
        }
      } else {
        beepPhase = 0.6;
        idleT += dt;
        if (idleT >= 1.6) {
          idleT = 0;
          A.tone({ freq: 740, to: 700, type: 'sine', dur: 0.25, vol: 0.04 });
          pings.push({ t: 0, s: 0, rock: false });
        }
      }
    }

    // ----- 발굴 결과
    function foundTreasure() {
      phase = 'reward';
      const took = game.time - spawnAt;
      fastest = Math.min(fastest, took);
      const speed = clamp(1 - took / S.findTime, 0, 1);
      let combo = 0;
      if (took <= S.findTime) combo = game.addCombo();
      else game.resetCombo(); // 너무 오래 걸리면 콤보가 끊긴다
      const mult = 1 + 0.25 * clamp(combo - 1, 0, 4);
      const emoji = LOOT[foundTotal % LOOT.length];
      found++;
      foundTotal++;
      signals = [];
      dig = 0;
      digTarget = null;
      pop = { emoji, t: 0 };
      note = { text: emoji + ' 찾았다!', heat: 'hot', until: game.time + 0.9 };
      const at = radarPoint(0.5);
      game.addScore(Math.round((100 + 150 * speed) * mult), at);
      fx.burst(at, { count: 14, spread: 120, colors: ['#ffd166', '#fff3c4', '#4dd8ff', '#2fd17a'] });
      fx.burst(at, { count: 4, emoji, size: 12, spread: 90 });
      sfx('coin');
      sfx('great');
      Arcade.vibrate([40, 30, 60]);
      if (speed >= 0.6) fx.toast('⚡ 번개 발굴!', { kind: 'gold', ms: 900 });
      paintLoot(true);
      if (found >= need) game.after(700, stageClear);
      else
        game.after(900, () => {
          layout();
          phase = 'search';
          sfx('whoosh');
        });
    }

    function dugRock(o) {
      rocksDug++;
      signals = signals.filter((x) => x !== o);
      dig = 0;
      digTarget = null;
      game.resetCombo();
      pop = { emoji: '🪨', t: 0 };
      note = { text: '🪨 돌멩이…', heat: 'bad', until: game.time + 1 };
      const at = radarPoint(0.5);
      sfx('bad');
      A.noise({ dur: 0.25, freq: 400, to: 90, vol: 0.3, filter: 'lowpass' });
      fx.burst(at, { count: 6, emoji: '🪨', size: 10, spread: 80 });
      fx.shake(radarBox, 7);
      stageTimer.add(-ROCK_SEC);
      fx.toast(`돌멩이였다! <b>-${ROCK_SEC}초</b>`, { kind: 'bad', ms: 1100 });
      if (game.loseLife(at) <= 0) {
        game.lose({
          title: '하트를 다 잃었다!',
          icon: '🪨',
          message: `스테이지 ${stageIdx + 1}에서 돌멩이를 너무 많이 팠어요. 진짜는 <b>높은 삐삐</b>!`,
          checkpoint: stageIdx,
        });
      }
    }

    function timeUp() {
      if (phase === 'idle' || found >= need) return; // 마지막 보물을 캔 직후라면 실패가 아니다
      game.lose({
        title: '시간 초과!',
        icon: '⌛',
        message: `스테이지 ${stageIdx + 1}에서 보물을 <b>${found} / ${need}</b>개 찾았어요.`,
        checkpoint: stageIdx,
      });
    }

    async function stageClear() {
      phase = 'idle';
      const left = stageTimer.left();
      game.stopTimer();
      leftSum += left;
      totalSum += stageTotal;
      storm.state = 'calm';
      jitter = 0;
      wrap.classList.remove('storm', 'warn');
      sfx('stage');
      fx.confetti(30);
      game.addScore(Math.round(left) * 10, radarPoint(0));
      await game.wait(1000);
      if (stageIdx >= STAGES.length - 1) return finish();
      stageIdx++;
      runStage();
    }

    async function runStage() {
      st = STAGES[stageIdx];
      tol = Math.min(40, S.tolerance * st.tol * widen);
      hear = clamp(S.tolerance * HEAR * st.hear * widen, tol * 3, 160);
      need = S.missionCount;
      found = 0;
      signals = [];
      dig = 0;
      digTarget = null;
      phase = 'idle';
      trail.fill(0);
      storm.state = 'calm';
      jitter = 0;
      wrap.classList.remove('storm', 'warn');
      wrap.dataset.stage = String(stageIdx);
      game.setStage(stageIdx, STAGES.length);
      game.setGoal(st.goal);
      paintLoot();
      await game.banner(st.banner[0], st.banner[1], { ms: 1500 });
      if (mode === 'pending') {
        // 안내 띠가 떠 있는 동안 센서 이벤트가 한 번도 안 왔으면 손가락 조작으로 바꾼다
        if (sensorSeen > 0) setMode('sensor');
        else setMode('drag', '센서가 없어서 <b>끌어서</b> 돌려요');
      }
      stageTotal = Math.round(S.findTime * need * st.time) + R * 5;
      stageTimer = game.startTimer(stageTotal, { onEnd: timeUp });
      if (st.storm) storm.at = game.time + rand(3.5, 5);
      layout();
      phase = 'search';
    }

    function finish() {
      const ratio = leftSum / Math.max(1, totalSum);
      let stars = rocksDug === 0 && ratio >= 0.3 ? 3 : rocksDug <= 1 ? 2 : 1;
      if (game.retry > 0) stars = Math.min(stars, 2);
      game.win({
        stars,
        title: '보물을 다 찾았다!',
        message:
          stars === 3
            ? '돌멩이 하나 안 파고 빨리 찾았어요. 완벽해요!'
            : rocksDug === 0
              ? '돌멩이에 한 번도 안 속았어요!'
              : '레이더로 보물을 모두 찾았어요!',
        stats: [
          ['찾은 보물', `${foundTotal}개`],
          ['판 돌멩이', `${rocksDug}개`],
          ['가장 빨리', Number.isFinite(fastest) ? `${fastest.toFixed(1)}초` : '-'],
          ['최대 콤보', `${game.maxCombo}`],
        ],
      });
    }

    // ----- 그리기
    function paintLoot(bump) {
      lootEl.innerHTML = '';
      if (need > 4) {
        lootEl.textContent = `${LOOT[0]} ${found} / ${need}`;
      } else {
        // 아직 못 찾은 보물은 검은 그림자로 보인다
        for (let i = 0; i < need; i++) {
          const got = i < found;
          lootEl.appendChild(h('span', { class: got ? 'on' : '', text: LOOT[(foundTotal - found + i) % LOOT.length] }));
        }
      }
      if (bump) fx.pop(lootEl);
    }

    const shown = { word: null, heat: null, bars: -1, glow: -1 };
    function paintRead(sn) {
      let text;
      let heat;
      if (note && game.time < note.until) {
        text = note.text;
        heat = note.heat;
      } else if (phase !== 'search') {
        text = phase === 'reward' ? '찾았다!' : '준비…';
        heat = phase === 'reward' ? 'hot' : 'cold';
      } else if (sn.zone) {
        text = '⛏️ 파는 중!';
        heat = 'dig';
      } else {
        // 발굴 범위 가장자리의 세기가 0.66쯤이다. 돌멩이(최대 0.5)는 "따뜻해"까지만 간다
        const s = sn.s;
        [text, heat] =
          s >= 0.55 ? ['뜨거워!!', 'hot'] : s >= 0.3 ? ['따뜻해!', 'warm'] : s >= 0.12 ? ['미지근', 'luke'] : s > 0.02 ? ['희미해…', 'faint'] : ['차가워…', 'cold'];
      }
      if (text !== shown.word) {
        shown.word = text;
        wordEl.textContent = text;
        if (heat === 'dig' || heat === 'hot') fx.pop(wordEl);
      }
      if (heat !== shown.heat) {
        shown.heat = heat;
        wrap.dataset.heat = heat;
      }
      const n = phase === 'search' ? Math.ceil(sn.s * 5 - 0.001) : phase === 'reward' ? 5 : 0;
      if (n !== shown.bars) {
        shown.bars = n;
        bars.forEach((b, i) => b.classList.toggle('on', i < n));
      }
      if (Math.abs(glow - shown.glow) > 0.01) {
        shown.glow = glow;
        wrap.style.setProperty('--glow', glow.toFixed(2));
      }
    }

    let cssSize = 0;
    let dpr = 1;
    function fitCanvas() {
      const size = Math.floor(Math.min(radarBox.clientWidth, radarBox.clientHeight));
      if (size > 0 && size !== cssSize) {
        cssSize = size;
        dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';
        canvas.width = Math.round(size * dpr);
        canvas.height = Math.round(size * dpr);
      }
      return cssSize;
    }

    const disc = (c, r) => {
      c.beginPath();
      c.arc(0, 0, r, 0, TAU);
    };

    function draw(dt) {
      const size = fitCanvas();
      if (!size) return;
      const c = ctx;
      const half = size / 2;
      const Rr = half - 4;
      const stormy = storm.state === 'storm';
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, size, size);
      c.save();
      c.translate(half, half);
      if (stormy) c.translate(rand(-1.5, 1.5), rand(-1.5, 1.5));

      // 판
      const base = c.createRadialGradient(0, 0, Rr * 0.15, 0, 0, Rr);
      base.addColorStop(0, stormy ? '#2a1d4a' : '#0b3a45');
      base.addColorStop(1, stormy ? '#120a24' : '#041a22');
      c.fillStyle = base;
      disc(c, Rr);
      c.fill();
      c.save();
      disc(c, Rr);
      c.clip();
      // 신호에 가까울수록 판 전체가 밝아진다
      if (glow > 0.01) {
        const col = inZone ? '255,209,102' : '77,216,255';
        const g = c.createRadialGradient(0, -Rr * 0.35, 0, 0, -Rr * 0.35, Rr * 1.2);
        g.addColorStop(0, `rgba(${col},${(0.6 * glow).toFixed(3)})`);
        g.addColorStop(1, `rgba(${col},0)`);
        c.fillStyle = g;
        c.fillRect(-Rr, -Rr, Rr * 2, Rr * 2);
      }
      // 동심원과 십자
      c.strokeStyle = 'rgba(120,230,255,0.16)';
      c.lineWidth = 1;
      [0.38, 0.64].forEach((k) => {
        disc(c, Rr * k);
        c.stroke();
      });
      c.beginPath();
      c.moveTo(-Rr, 0);
      c.lineTo(Rr, 0);
      c.moveTo(0, -Rr);
      c.lineTo(0, Rr);
      c.stroke();
      // 신호 기억: 지나온 방향에서 들은 세기가 가장자리에 남는다
      c.lineWidth = Rr * 0.1;
      for (let i = 0; i < 72; i++) {
        const v = trail[i];
        if (v < 0.03) continue;
        const a0 = (i * 5 - eff - 90) * RAD;
        c.beginPath();
        c.arc(0, 0, Rr * 0.9, a0, a0 + 5 * RAD + 0.01);
        c.strokeStyle = `hsla(${Math.round(190 - 140 * v)},100%,${Math.round(52 + 18 * v)}%,${(0.2 + 0.75 * v).toFixed(3)})`;
        c.stroke();
      }
      // 눈금: 세상에 붙어 있어서 몸을 돌리면 함께 돈다
      c.strokeStyle = 'rgba(190,245,255,0.5)';
      for (let w = 0; w < 360; w += 15) {
        const a = (w - eff - 90) * RAD;
        const big = w % 45 === 0;
        const r0 = Rr * (big ? 0.9 : 0.94);
        c.lineWidth = big ? 2 : 1;
        c.beginPath();
        c.moveTo(Math.cos(a) * Rr, Math.sin(a) * Rr);
        c.lineTo(Math.cos(a) * r0, Math.sin(a) * r0);
        c.stroke();
      }
      // 삐 소리마다 퍼지는 고리. 돌멩이는 주황, 진짜는 하늘색
      for (let i = pings.length - 1; i >= 0; i--) {
        const p = pings[i];
        p.t += dt;
        const k = p.t / 0.7;
        if (k >= 1) {
          pings.splice(i, 1);
          continue;
        }
        disc(c, Rr * (0.22 + 0.68 * k));
        c.strokeStyle = `rgba(${p.rock ? '255,160,90' : '140,240,255'},${((1 - k) * (0.12 + 0.6 * p.s)).toFixed(3)})`;
        c.lineWidth = 2 + 4 * p.s;
        c.stroke();
      }
      // 앞쪽 빔 (위 = 폰이 향한 쪽). 폭은 발굴 범위와 같다
      const beam = inZone ? '255,209,102' : glow > 0.45 ? '150,255,200' : '77,216,255';
      const w = Math.max(6, tol) * RAD;
      const g2 = c.createLinearGradient(0, 0, 0, -Rr);
      g2.addColorStop(0, `rgba(${beam},${(0.04 + 0.25 * glow).toFixed(3)})`);
      g2.addColorStop(1, `rgba(${beam},${(0.14 + 0.6 * glow).toFixed(3)})`);
      c.fillStyle = g2;
      c.beginPath();
      c.moveTo(0, 0);
      c.arc(0, 0, Rr, -Math.PI / 2 - w, -Math.PI / 2 + w);
      c.closePath();
      c.fill();
      c.strokeStyle = `rgba(${beam},${(0.55 + 0.45 * glow).toFixed(3)})`;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(0, -Rr * 0.22);
      c.lineTo(0, -Rr);
      c.stroke();
      // 자기 폭풍 잡음
      if (stormy) {
        for (let i = 0; i < 46; i++) {
          c.fillStyle = `rgba(210,170,255,${rand(0.1, 0.45).toFixed(2)})`;
          c.fillRect(rand(-Rr, Rr), rand(-Rr, Rr), rand(1, 4), rand(1, 2.5));
        }
      }
      c.restore();

      // 테두리와 위쪽 화살표
      c.lineWidth = 3;
      c.strokeStyle = stormy ? 'rgba(200,150,255,0.85)' : `rgba(77,216,255,${(0.35 + 0.55 * glow).toFixed(3)})`;
      disc(c, Rr);
      c.stroke();
      c.fillStyle = inZone ? '#ffd166' : '#eafcff';
      c.beginPath();
      c.moveTo(0, -Rr + 18);
      c.lineTo(-10, -Rr + 1);
      c.lineTo(10, -Rr + 1);
      c.closePath();
      c.fill();

      // 가운데: 발굴 게이지
      const hub = Rr * 0.2;
      c.fillStyle = '#03161d';
      disc(c, hub);
      c.fill();
      c.lineWidth = Rr * 0.05;
      c.strokeStyle = 'rgba(255,255,255,0.12)';
      disc(c, hub);
      c.stroke();
      if (dig > 0) {
        c.strokeStyle = '#ffd166';
        c.beginPath();
        c.arc(0, 0, hub, -Math.PI / 2, -Math.PI / 2 + TAU * dig);
        c.stroke();
      }
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.save();
      if (inZone) c.rotate(Math.sin(game.time * 30) * 0.25);
      c.font = `${Math.round(hub * 0.95)}px system-ui, "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
      c.fillText(inZone ? '⛏️' : '📡', 0, hub * 0.06);
      c.restore();
      // 찾은 보물(또는 돌멩이)이 위로 솟는다
      if (pop) {
        pop.t += dt;
        const k = pop.t / 0.9;
        if (k >= 1) pop = null;
        else {
          c.globalAlpha = 1 - k * k;
          c.font = `${Math.round(Rr * (0.24 + 0.16 * k))}px system-ui, "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
          c.fillText(pop.emoji, 0, -Rr * (0.42 + 0.2 * k));
          c.globalAlpha = 1;
        }
      }
      c.restore();
    }

    // ----- 매 프레임
    game.loop((dt) => {
      sinceEvent += dt;
      if (mode === 'sensor' || mode === 'pending') {
        if (lastRaw !== null) heading += (sensorHeading - heading) * (1 - Math.exp(-dt / 0.06));
        // 센서 이벤트가 끊기면 손가락 조작으로 바꾼다
        if (mode === 'sensor' && sinceEvent > 2.5) setMode('drag', '센서가 멈춰서 <b>끌어서</b> 돌려요');
      } else {
        const kd = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
        if (kd) {
          keyHold += dt;
          heading += kd * lerp(45, 150, clamp(keyHold / 0.6, 0, 1)) * dt;
        } else keyHold = 0;
        if (dragId === null && dragVel) {
          heading += dragVel * dt;
          dragVel *= Math.exp(-dt / 0.2);
          if (Math.abs(dragVel) < 4) dragVel = 0;
        }
      }

      if (st.storm && phase !== 'idle') updateStorm(dt);
      else jitter = 0;
      eff = heading + jitter;
      if (phase === 'search' && st.move) moveTreasure(dt);
      const sn = phase === 'search' ? sense() : { best: null, s: 0, zone: null };
      lastSense = sn;
      inZone = sn.zone;

      // 발굴: 신호 폭 안에서 버티면 게이지가 차고, 벗어나면 천천히 줄어든다
      if (phase === 'search') {
        if (sn.zone) {
          if (digTarget !== sn.zone) {
            digTarget = sn.zone;
            dig = 0;
          }
          dig += dt / S.holdTime;
          if (dig >= 1) {
            if (sn.zone.real) foundTreasure();
            else dugRock(sn.zone);
            if (!game.playing) return;
          }
        } else if (dig > 0) {
          dig = Math.max(0, dig - (dt / S.holdTime) * 0.8);
          if (dig === 0) digTarget = null;
        }
      }
      glow += ((phase === 'reward' ? 1 : sn.s) - glow) * (1 - Math.exp(-dt / 0.1));
      updateTrail(dt);
      feedback(dt, sn);
      paintRead(sn);
      draw(dt);
    });

    if (game.debug) {
      // 검증용: 상태를 보고, 끌기 조작처럼 방향을 바로 바꾼다
      window.__game = {
        state: () => ({
          mode, phase, heading, eff, jitter, tol, hear, found, need, dig,
          stage: stageIdx,
          s: lastSense.s,
          zone: lastSense.zone ? (lastSense.zone.real ? 'real' : 'rock') : null,
          word: wordEl.textContent,
          rocks: rocksDug,
          storm: storm.state,
          storms,
          sensorSeen,
          dragVel,
          signals: signals.map((o) => ({ a: o.a, real: o.real, d: wrap180(o.a - eff) })),
          trailMax: Math.max.apply(null, Array.from(trail)),
          timeLeft: game.timeLeft(),
          stageTotal,
        }),
        face: (a) => {
          heading = a;
          dragVel = 0;
        },
        turn: (d) => {
          heading += d;
        },
        setMode,
        settings: S,
        headingOf,
        falloff,
      };
    }

    paintMode();
    runStage();
  }

  Arcade.createGame({
    id: GAME_ID,
    title: '매직 컴퍼스',
    icon: '🧭',
    accent: '#4dd8ff',
    accent2: '#2fd17a',
    tagline: '보물 레이더: 삐삐 소리를 쫓아 몸을 빙글!',
    howTo: [
      '폰을 들고 <b>제자리에서 빙글</b> 돌아요 (센서가 없으면 화면을 끌어서)',
      '보물 쪽일수록 <b>삐삐가 빨라지고</b> 레이더가 밝아져요',
      '딱 맞추고 버티면 <b>발굴!</b> 가짜 <b>돌멩이</b>를 파면 하트를 잃어요',
    ],
    lives: 3,
    stages: STAGES.length,
    music: false, // 삐삐 간격이 곧 단서라서 배경 리듬을 끈다
    async prepare() {
      motionOK = await Arcade.sensors.requestMotion();
    },
    start,
  });
})();
