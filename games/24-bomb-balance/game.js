// 폭탄 해체반
// 손은 기포를 가운데 원 안에 붙잡느라 바쁘고, 머리는 지시서대로 폭탄을 해체한다.
(function () {
  'use strict';

  const { h, rand, randInt, pick, shuffle, clamp, sfx, fx } = Arcade;
  const GAME_ID = 'game24';

  // ---------------------------------------------------------------- 설정
  // 관리자 페이지와 같은 키. 기본값 표는 admin.js 와 같아야 한다
  const PRESETS = [
    { stageTime: 60, gustCount: 2, gustStrength: 14, stabilityDecreaseRate: 14, stabilityRecoverRate: 10, tiltThreshold: 18, tiltMax: 45 },
    { stageTime: 50, gustCount: 3, gustStrength: 17, stabilityDecreaseRate: 20, stabilityRecoverRate: 7, tiltThreshold: 15, tiltMax: 45 },
    { stageTime: 42, gustCount: 4, gustStrength: 21, stabilityDecreaseRate: 28, stabilityRecoverRate: 5, tiltThreshold: 12, tiltMax: 45 },
  ];
  const LIMITS = {
    stageTime: [20, 180],
    gustCount: [0, 10],
    gustStrength: [0, 40],
    stabilityDecreaseRate: [3, 80],
    stabilityRecoverRate: [0, 40],
    tiltThreshold: [4, 40],
    tiltMax: [15, 90],
  };
  // 옛 설정에서 뜻이 같은 키(gust·stability·tilt)는 그대로 이어 쓴다.
  // gameDuration(판 전체 시간)과 drift 3종은 뜻이 달라져서 읽지 않는다
  const saved = Arcade.loadSettings('bomb_balance_settings', {});
  const level = clamp(parseInt(saved.difficulty, 10) || 0, 0, 2);
  const S = Object.assign({}, PRESETS[level]);
  Object.keys(LIMITS).forEach((key) => {
    const raw = saved[key];
    if (raw === null || raw === '' || typeof raw === 'boolean') return;
    const v = Number(raw);
    if (Number.isFinite(v)) S[key] = clamp(v, LIMITS[key][0], LIMITS[key][1]);
  });
  S.gustCount = Math.round(S.gustCount);
  const forceTouch = saved.forceTouch === true;
  const SAFE = clamp(S.tiltThreshold / S.tiltMax, 0.15, 0.6); // 안전 원의 반지름(기포가 움직이는 범위를 1 로 본 값)

  // 난이도에 따라 정해지는 해체 작업의 양 (관리자 화면에는 없다)
  const LEVELS = [
    { cuts: [2, 2, 3], wires1: 4, codes: [3, 3, 4], flash: [0.8, 0.3], panels3: 3, wires3: 4, drift: 0.09 },
    { cuts: [2, 3, 3], wires1: 4, codes: [3, 4, 4], flash: [0.65, 0.25], panels3: 4, wires3: 5, drift: 0.12 },
    { cuts: [3, 3, 4], wires1: 5, codes: [4, 4, 4], flash: [0.55, 0.2], panels3: 4, wires3: 5, drift: 0.15 },
  ];
  const L = LEVELS[level];

  const WRONG_CUT = 7; // 틀린 선을 자르면 줄어드는 시간(초)
  const WRONG_CODE = 5; // 틀린 코드
  const REPLAY_COST = 3; // 코드 다시 보기
  const MOVE = 0.365; // 기포가 움직이는 반지름 (폭탄 상자 한 변에 대한 비율, style.css 와 맞춘다)
  const FOLLOW = 8; // 기포가 조종 위치를 따라가는 빠르기
  const SLIP = 1.25; // 손을 떼면 바람에 밀려 미끄러지는 빠르기
  const OUTWARD = 0.06; // 손을 떼면 가운데에서 저절로 굴러 나가는 빠르기
  const KEY_PUSH = 1.1; // 화살표 키로 미는 빠르기
  const GUST_WARN = 1.4; // 돌풍 예고(초)
  const GUST_DUR = 1.8; // 돌풍이 미는 시간(초)
  const STUN = 1.2; // 폭발 뒤 손을 못 쓰는 시간(초)
  const DANGER = 35; // 안정도가 이 아래면 경보

  const COLORS = {
    red: { name: '빨강', line: '빨간 선', code: '#ff4d5e' },
    blue: { name: '파랑', line: '파란 선', code: '#4d8dff' },
    yellow: { name: '노랑', line: '노란 선', code: '#ffd43b' },
    green: { name: '초록', line: '초록 선', code: '#2fd17a' },
    white: { name: '하양', line: '하얀 선', code: '#eef1ff' },
  };
  const COLOR_KEYS = Object.keys(COLORS);

  const STAGES = [
    { kind: 'wire', banner: ['폭탄 1 · 전선', '기포가 원 안에 있어야 잘린다'], goal: '기포는 원 안에, 선은 <b>지시 순서대로</b>' },
    { kind: 'code', banner: ['폭탄 2 · 코드', '깜빡이는 숫자를 외워라'], goal: '깜빡인 숫자를 외워 <b>그대로 입력</b>' },
    { kind: 'rule', banner: ['폭탄 3 · 조건', '조건을 읽고, 돌풍을 버텨라'], goal: '<b>조건</b>을 보고 맞는 선 하나만!' },
  ];

  let motionOK = false; // 센서 권한 결과. 시작 버튼을 누를 때 한 번만 묻는다

  // ---------------------------------------------------------------- 기울기 계산 (순수 함수)
  const RAD = Math.PI / 180;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  /** beta·gamma(도)로 기기 좌표계에서 '위쪽'이 어디인지 구한다. 폰을 세워 들어 gamma 가 튀어도 값이 이어진다 */
  function upVector(beta, gamma) {
    const b = beta * RAD;
    const g = gamma * RAD;
    return [-Math.sin(g) * Math.cos(b), Math.sin(b), Math.cos(g) * Math.cos(b)];
  }

  /**
   * 기준 자세(ref)에서 지금 자세(u)까지 기운 정도. 화면 좌표(오른쪽 +x, 아래 +y)의 도 단위.
   * 기포는 이 방향, 곧 낮아진 쪽으로 굴러간다. 눕혀 들든 세워 들든 처음 자세가 0 이다.
   */
  function tiltOf(u, ref) {
    let axis = [1, 0, 0]; // 화면 가로축
    if (Math.abs(ref[0]) > 0.9) axis = [0, 1, 0]; // 옆으로 눕힌 경우
    const k = dot(axis, ref);
    let ex = [axis[0] - k * ref[0], axis[1] - k * ref[1], axis[2] - k * ref[2]];
    const n = Math.hypot(ex[0], ex[1], ex[2]) || 1;
    ex = ex.map((v) => v / n);
    const ey = [ref[1] * ex[2] - ref[2] * ex[1], ref[2] * ex[0] - ref[0] * ex[2], ref[0] * ex[1] - ref[1] * ex[0]];
    const a = dot(u, ex);
    const b = dot(u, ey);
    const s = Math.hypot(a, b);
    if (s < 1e-6) return { x: 0, y: 0 };
    const deg = Math.atan2(s, dot(u, ref)) / RAD;
    return { x: (-a / s) * deg, y: (b / s) * deg };
  }

  // ---------------------------------------------------------------- 해체 작업 만들기 (순수 함수)
  /** 전선 자르기: 서로 다른 색 n 개 가운데 k 개를 정해진 순서로 */
  function makeWires(n, k) {
    const colors = shuffle(COLOR_KEYS).slice(0, n);
    const order = shuffle(colors.map((_, i) => i)).slice(0, k);
    return { colors, order, step: 0, cut: new Set() };
  }

  /** 코드: 같은 숫자가 바로 이어 나오지 않는다 */
  function makeCode(len) {
    const out = [];
    while (out.length < len) {
      const d = String(randInt(0, 9));
      if (d !== out[out.length - 1]) out.push(d);
    }
    return out;
  }

  function makeSerial() {
    return shuffle('123456789'.split('')).slice(0, 4).join('');
  }

  const RULE_KINDS = ['time', 'serial', 'blink', 'lamp', 'count'];
  const JOSA_I = '013678'; // 영·일·삼·육·칠·팔은 '이', 나머지는 '가'

  function colorTarget(c) {
    // 그 색이 딱 하나일 때만 답이 될 수 있다
    return { label: COLORS[c].line, dot: c, idx: (cols) => (cols.indexOf(c) === cols.lastIndexOf(c) ? cols.indexOf(c) : -1) };
  }
  const POS_TARGETS = [
    { label: '맨 위 선', idx: () => 0 },
    { label: '맨 아래 선', idx: (cols) => cols.length - 1 },
    { label: '두 번째 선', idx: () => 1 },
  ];

  /**
   * 조건 해체 한 판. clock 은 지금 폭탄 타이머(초), serial 은 번호판 숫자.
   * answer(타이머) 가 자를 선의 번호를 돌려준다. 타이머 조건은 자르는 순간의 값으로 본다.
   */
  function makeRule(n, avoid, clock, serial) {
    for (let tries = 0; tries < 400; tries++) {
      const kind = pick(RULE_KINDS.filter((k) => k !== avoid));
      let colors = Array.from({ length: n }, () => pick(COLOR_KEYS));
      const lamp = { color: pick(['red', 'green']), blink: Math.random() < 0.5 };
      let q;
      let test;
      let yes = null;
      if (kind === 'time') {
        const soon = clock - randInt(6, 10); // 지금은 참이고 곧 거짓이 된다: 빨리 자를수록 쉽다
        const N = soon >= 5 && Math.random() < 0.55 ? soon : clock + randInt(2, 8);
        q = `타이머가 <b>${N}</b>보다 크면?`;
        test = (t) => t > N;
      } else if (kind === 'serial') {
        const present = Math.random() < 0.5;
        const d = pick('123456789'.split('').filter((x) => serial.includes(x) === present));
        q = `번호판에 <b>${d}</b>${JOSA_I.includes(d) ? '이' : '가'} 있으면?`;
        test = () => serial.includes(d);
      } else if (kind === 'blink') {
        q = '램프가 <b>깜빡이면</b>?';
        test = () => lamp.blink;
      } else if (kind === 'lamp') {
        const ask = pick(['red', 'green']);
        q = `램프가 <b>${ask === 'red' ? '빨간색' : '초록색'}</b>이면?`;
        test = () => lamp.color === ask;
      } else {
        // 어떤 색이 1개 또는 2개 들어 있다
        const c = pick(COLOR_KEYS);
        const two = Math.random() < 0.5;
        colors = colors.map((x) => (x === c ? pick(COLOR_KEYS.filter((y) => y !== c)) : x));
        shuffle(colors.map((_, i) => i)).slice(0, two ? 2 : 1).forEach((i) => (colors[i] = c));
        q = `${COLORS[c].line}이 <b>2개</b>면?`;
        test = () => two;
        yes = { label: '아래쪽 ' + COLORS[c].line, dot: c, idx: (cols) => cols.lastIndexOf(c) };
      }
      const pool = shuffle([...COLOR_KEYS.map(colorTarget), ...POS_TARGETS]);
      if (!yes) yes = pool.find((t) => t.idx(colors) >= 0);
      if (!yes || yes.idx(colors) < 0) continue;
      const no = pool.find((t) => t !== yes && t.idx(colors) >= 0 && t.idx(colors) !== yes.idx(colors));
      if (!no) continue;
      return {
        kind, colors, lamp, q, yes, no,
        cut: new Set(),
        truth: test,
        answer: (t) => (test(t) ? yes : no).idx(colors),
      };
    }
    // 여기까지 올 일은 거의 없다
    const colors = shuffle(COLOR_KEYS).slice(0, n);
    const lamp = { color: 'red', blink: true };
    const yes = POS_TARGETS[1];
    const no = POS_TARGETS[0];
    return { kind: 'blink', colors, lamp, q: '램프가 <b>깜빡이면</b>?', yes, no, cut: new Set(), truth: () => true, answer: () => yes.idx(colors) };
  }

  /** 전선 한 가닥의 물결 모양 (viewBox 0 0 100 20) */
  function wavePath(x0, x1, amp, freq, phase) {
    let d = '';
    for (let x = x0; x <= x1 + 0.001; x += 2) {
      d += (d ? ' L' : 'M') + x.toFixed(1) + ' ' + (10 + amp * Math.sin(x * freq + phase)).toFixed(2);
    }
    return d;
  }

  function wireSvg() {
    const a = rand(2.5, 5.5);
    const f = rand(0.1, 0.22);
    const p = rand(0, 6.28);
    return (
      '<svg viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">' +
      `<path class="l" d="${wavePath(0, 46, a, f, p)}"/>` +
      `<path class="m" d="${wavePath(46, 54, a, f, p)}"/>` +
      `<path class="r" d="${wavePath(54, 100, a, f, p)}"/></svg>`
    );
  }

  // ---------------------------------------------------------------- 한 판
  function start(game) {
    const relief = Math.min(game.retry, 3); // 재도전하면 시간이 늘고 돌풍이 약해진다
    const stageTotal = S.stageTime + relief * 8;
    const gustPower = (S.gustStrength / S.tiltMax) * (1 - relief * 0.15);

    let stageIdx = game.checkpoint;
    let kind = 'wire'; // wire | code | rule
    let mode = 'touch'; // pending(센서 확인 중) | sensor | touch
    let live = false; // 폭탄 타이머가 도는 동안
    let busy = false; // 실수 직후나 다음 작업으로 넘어가는 중이라 입력을 받지 않는다
    let switching = false; // 다음 작업으로 넘어가는 중
    let stunUntil = -1; // 폭발 뒤 손을 못 쓰는 때까지(게임 시계)
    let task = null, taskIdx = 0, stageTimer = null;
    let stability = 100, inside = true;
    let bx = 0, by = 0; // 기포 위치 (움직이는 범위를 1 로 본 값)
    let wx = 0, wy = 0; // 지금 부는 바람 (같은 단위)
    let windAng = rand(0, Math.PI * 2), windTurn = 0.4, turnLeft = 0;
    let gust = null, gustWarn = null, gustCancels = [];
    let flashing = false, flashToken = 0, flashCancel = null;
    let lastRule = null, serial = '';
    let tickAcc = 0, tock = false, alarmAcc = 0;
    let wireEls = [], keypad = null, slots = null, size = 0;
    // 기록
    let mistakes = 0, booms = 0, denied = 0, replays = 0, leftSum = 0, totalSum = 0;
    let stageMistakes = 0, stageBooms = 0;
    // 입력
    let lastU = null, ref = null; // 지금 자세와 기준 자세('위쪽' 벡터)
    let sensorSeen = 0, sinceEvent = 0, lastEventMs = -1e9;
    let tiltX = 0, tiltY = 0, grip = null, holder = null;
    const pressed = new Set();
    let debugHold = null, assist = false, calm = false; // 검증용

    // ----- 화면: 폭탄
    const ringD = SAFE * MOVE * 200 + '%';
    const ring = h('div', { class: 'bb-ring', style: { width: ringD, height: ringD } });
    const bubble = h('div', { class: 'bb-bubble' });
    const lcd = h('div', { class: 'bb-lcd' });
    // 실수 표시가 끝나면 지워야 10초 아래 깜빡임이 다시 보인다
    lcd.addEventListener('animationend', (e) => {
      if (e.animationName === 'bb-hurt') lcd.classList.remove('hurt');
    });
    const led =h('div', { class: 'bb-led' }, h('i'));
    const serialEl = h('div', { class: 'bb-serial' });
    const codeEl = h('div', { class: 'bb-code' });
    const gustEl = h('div', { class: 'bb-gust' }, h('i', { text: '➤' }));
    const gripEl = h('div', { class: 'bb-grip' });
    const tether = h('div', { class: 'bb-tether' });
    const hint = h('div', { class: 'bb-hint', text: navigator.maxTouchPoints > 0 ? '👆 꾹 누른 채 끌기' : '⌨️ 화살표로 밀기' });
    const bomb = h('div', { class: 'bb-bomb' }, [
      h('div', { class: 'bb-fuse' }, h('i')),
      h('div', { class: 'bb-sphere' }),
      h('div', { class: 'bb-cross' }),
      ring, led, lcd, serialEl, tether, gripEl, bubble, codeEl, gustEl, hint,
    ]);
    const cell = h('div', { class: 'bb-cell' }, bomb);
    const gaugeFill = h('i');
    const gauge = h('div', { class: 'bb-gauge' }, gaugeFill);
    const stabNum = h('b', { text: '100' });
    const meter = h('div', { class: 'bb-side bb-meter' }, [h('small', { text: '안정도' }), gauge, stabNum]);
    const vaneArrow = h('i', { text: '➤' });
    const vane = h('div', { class: 'bb-vane' }, vaneArrow);
    const modeIcon = h('span');
    const modeLabel = h('small');
    const modeBtn = h('button', { class: 'bb-mode', 'aria-label': '조작 바꾸기' }, [modeIcon, modeLabel]);
    const right = h('div', { class: 'bb-side bb-right' }, [h('small', { text: '바람' }), vane, modeBtn]);
    const wrap = h('div', { class: 'bb-wrap', dataset: { mode: 'pending' } }, [h('div', { class: 'bb-edge' }), meter, cell, right]);
    game.root.append(wrap);

    // ----- 화면: 해체 장치 (엄지가 닿는 아래쪽)
    const guide = h('div', { class: 'bb-guide' });
    const stepEl = h('div', { class: 'bb-step' });
    const dbody = h('div', { class: 'bb-dbody' });
    const note = h('div', { class: 'bb-note', html: '✋ 손이 떨려요!<small>기포를 원 안에</small>' });
    const device = h('div', { class: 'bb-device' }, [h('div', { class: 'bb-dhead' }, [guide, stepEl]), dbody, note]);
    game.footer.append(device);

    // 폭탄 크기는 남은 칸에 맞춘다
    function fit() {
      const s = Math.max(90, Math.floor(Math.min(cell.clientWidth, cell.clientHeight, 300)));
      if (s !== size) {
        size = s;
        bomb.style.setProperty('--s', s + 'px');
      }
    }
    fit();
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(fit);
      ro.observe(cell);
      game.onCleanup(() => ro.disconnect());
    }
    game.on(window, 'resize', fit);

    const clockNow = () => (stageTimer ? Math.ceil(stageTimer.left()) : stageTotal);
    const taskCount = () => (kind === 'wire' ? L.cuts.length : kind === 'code' ? L.codes.length : L.panels3);
    const stunned = () => game.time < stunUntil;

    // ----- 조작 방식
    function applyMode(next) {
      mode = next;
      wrap.dataset.mode = next;
      grip = null;
      holder = null;
      modeIcon.textContent = next === 'sensor' ? '📱' : '👆';
      modeLabel.textContent = next === 'sensor' ? '기울기' : '손가락';
      if (next === 'sensor') {
        ref = lastU; // 지금 자세를 수평으로 잡는다
        tiltX = 0;
        tiltY = 0;
        sinceEvent = 0;
      }
    }

    function onOrient(e) {
      if (!Number.isFinite(e.beta) || !Number.isFinite(e.gamma)) return;
      lastU = upVector(e.beta, e.gamma);
      sensorSeen++;
      sinceEvent = 0;
      lastEventMs = performance.now();
      if (!ref) ref = lastU;
    }

    // 손가락 조작: 폭탄 아무 데나 꾹 누른 채 끌면 기포가 끈 만큼 따라 움직인다(트랙패드처럼).
    // 손가락이 기포를 가리지 않는다. 바람은 계속 밀어내므로 손가락으로 받아쳐야 한다
    function fingerAt(e) {
      const r = bomb.getBoundingClientRect();
      const mr = size * MOVE;
      return { x: (e.clientX - (r.left + r.width / 2)) / mr, y: (e.clientY - (r.top + r.height / 2)) / mr };
    }
    bomb.addEventListener('pointerdown', (e) => {
      if (mode !== 'touch' || holder !== null || !game.playing) return;
      e.preventDefault();
      holder = e.pointerId;
      try {
        bomb.setPointerCapture(e.pointerId);
      } catch (err) {
        /* 캡처를 못 해도 움직임은 받는다 */
      }
      const f = fingerAt(e);
      // 누르는 순간 기포가 튀지 않게, 지금 기포 자리를 기준으로 잡는다
      grip = { fx: f.x, fy: f.y, ox: bx - wx - f.x, oy: by - wy - f.y };
    });
    bomb.addEventListener('pointermove', (e) => {
      if (e.pointerId !== holder || !grip) return;
      const f = fingerAt(e);
      grip.fx = f.x;
      grip.fy = f.y;
    });
    const release = (e) => {
      if (e.pointerId !== holder) return;
      holder = null;
      grip = null;
    };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => bomb.addEventListener(t, release));

    modeBtn.addEventListener('click', () => {
      if (!game.playing || mode === 'pending') return;
      sfx('tap');
      if (mode === 'sensor') {
        applyMode('touch');
        fx.toast('👆 누른 채 <b>끌어서</b> 잡아요', { ms: 1600 });
      } else if (sensorSeen > 0 && performance.now() - lastEventMs < 1000) {
        applyMode('sensor');
        fx.toast('📱 지금 자세가 <b>수평</b>이에요', { ms: 1500 });
      } else {
        fx.toast('기울기 센서가 없어요', { ms: 1200 });
      }
    });

    // PC: 화살표로 기포를 밀고, 숫자 키로 코드를 넣는다
    const KEYS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    game.on(window, 'keydown', (e) => {
      if (KEYS[e.key]) {
        e.preventDefault();
        if (mode === 'sensor' && game.playing) {
          applyMode('touch');
          fx.toast('⌨️ 화살표로 기포를 밀어요', { ms: 1500 });
        }
        pressed.add(e.key);
      } else if (kind === 'code' && keypad && !e.repeat) {
        const k = /^[0-9]$/.test(e.key) ? e.key : e.key === 'Backspace' ? 'back' : null;
        const el = k && keypad.querySelector(`[data-k="${k}"]`);
        if (el) onKey(k, el);
      }
    });
    game.on(window, 'keyup', (e) => pressed.delete(e.key));
    game.on(window, 'blur', () => pressed.clear());

    // ----- 해체 장치 그리기
    function makeTask() {
      if (kind === 'wire') return makeWires(L.wires1, L.cuts[taskIdx]);
      if (kind === 'code') return { digits: makeCode(L.codes[taskIdx]), input: [] };
      const r = makeRule(L.wires3, lastRule, clockNow(), serial);
      lastRule = r.kind;
      return r;
    }

    function renderTask() {
      dbody.innerHTML = '';
      device.dataset.kind = kind;
      stepEl.textContent = `${Math.min(taskIdx + 1, taskCount())}/${taskCount()}`;
      wireEls = [];
      keypad = null;
      if (kind === 'code') renderKeypad();
      else renderWires();
      renderGuide();
      led.className = 'bb-led' + (kind === 'rule' ? ' ' + task.lamp.color + (task.lamp.blink ? ' blink' : '') : '');
    }

    function renderWires() {
      wireEls = task.colors.map((c, i) => {
        const el = h('button', { class: 'bb-wire' + (task.cut.has(i) ? ' cut' : ''), style: { '--c': COLORS[c].code }, 'aria-label': COLORS[c].line }, [
          h('span', { class: 'bb-tag', text: COLORS[c].name }),
          h('span', { class: 'bb-line', html: wireSvg() }),
        ]);
        el.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          onCut(i, el);
        });
        dbody.append(el);
        return el;
      });
    }

    function renderKeypad() {
      const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'replay', '0', 'back'];
      keypad = h(
        'div',
        { class: 'bb-keys' },
        keys.map((k) => {
          const el = h('button', {
            class: 'bb-key' + (k.length > 1 ? ' fn' : ''),
            dataset: { k },
            html: k === 'replay' ? `👁 다시<small>-${REPLAY_COST}초</small>` : k === 'back' ? '⌫' : k,
          });
          el.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            onKey(k, el);
          });
          return el;
        })
      );
      dbody.append(keypad);
      paintKeypad();
    }

    function paintKeypad() {
      if (keypad) keypad.classList.toggle('locked', flashing);
    }

    function targetHtml(t) {
      return (t.dot ? `<s style="background:${COLORS[t.dot].code}"></s>` : '') + t.label;
    }

    function renderGuide() {
      guide.innerHTML = '';
      if (kind === 'wire') {
        guide.append(
          h(
            'div',
            { class: 'bb-order' },
            task.order.flatMap((wi, n) => [
              n ? h('em', { text: '›' }) : null,
              h('span', {
                class: n < task.step ? 'done' : n === task.step ? 'now' : '',
                style: { '--c': COLORS[task.colors[wi]].code },
                text: COLORS[task.colors[wi]].name,
              }),
            ])
          )
        );
      } else if (kind === 'code') {
        slots = h('div', { class: 'bb-slots' }, task.digits.map((_, n) => h('span', { text: task.input[n] || '' })));
        guide.append(slots);
      } else {
        guide.append(
          h('div', { class: 'bb-rule' }, [
            h('div', { class: 'q', html: task.q }),
            h('div', { class: 'ans' }, [
              h('span', { class: 'yes', html: '<i>O</i>' + targetHtml(task.yes) }),
              h('span', { class: 'no', html: '<i>X</i>' + targetHtml(task.no) }),
            ]),
          ])
        );
      }
    }

    // ----- 해체 조작
    function deny(el) {
      denied++;
      sfx('miss');
      fx.shake(device, 5, 220);
      fx.floatText(el || device, '손이 떨려!', { color: '#ff9aa8', size: 18, rise: 40 });
    }

    function canAct(el) {
      if (!live || busy || stunned()) return false;
      if (!inside) {
        deny(el);
        return false;
      }
      return true;
    }

    function good(el, mult) {
      const combo = game.addCombo();
      game.addScore((50 + 10 * Math.min(combo, 10)) * mult, el);
      fx.burst(el, { count: 8, spread: 70, size: 7, colors: ['#ffd43b', '#fff3c4', '#3ddc97'] });
    }

    function mistake(el, sec, then) {
      mistakes++;
      stageMistakes++;
      busy = true;
      game.resetCombo();
      sfx('zap');
      sfx('bad');
      Arcade.vibrate(80);
      fx.flash('rgba(255,93,115,.25)');
      fx.shake(device, 9);
      fx.floatText(el, `틀렸다! -${sec}초`, { color: '#ff5d73', size: 22 });
      stageTimer.add(-sec);
      lcd.classList.remove('hurt');
      void lcd.offsetWidth;
      lcd.classList.add('hurt');
      game.after(650, () => {
        busy = false;
        if (then && live) then();
      });
    }

    function expected() {
      if (!task) return null;
      if (kind === 'wire') return task.order[task.step];
      if (kind === 'rule') return task.answer(clockNow());
      return task.digits.join('');
    }

    function onCut(i, el) {
      if (!game.playing || !task || kind === 'code' || task.cut.has(i)) return;
      if (!canAct(el)) return;
      if (i === expected()) {
        task.cut.add(i);
        el.classList.add('cut');
        Arcade.audio.noise({ dur: 0.07, freq: 4200, vol: 0.22 }); // 싹둑
        fx.burst(el, { count: 6, spread: 40, size: 5, colors: ['#ffe08a', '#fff'] });
        good(el, 1);
        if (kind === 'wire') {
          task.step++;
          renderGuide();
          if (task.step >= task.order.length) taskDone();
        } else taskDone();
      } else {
        el.classList.remove('zap');
        void el.offsetWidth;
        el.classList.add('zap');
        fx.burst(el, { count: 10, emoji: '⚡', size: 10, spread: 60 });
        mistake(el, WRONG_CUT, kind === 'rule' ? () => {
          // 하나씩 다 잘라 보는 것을 막는다: 틀리면 배선과 조건이 새로 바뀐다
          task = makeTask();
          renderTask();
          fx.toast('배선이 바뀌었다!', { ms: 1000 });
        } : null);
      }
    }

    function onKey(k, el) {
      if (!game.playing || kind !== 'code' || !task) return;
      if (k === 'replay') {
        if (!live || busy || flashing || stunned()) return;
        replays++;
        stageTimer.add(-REPLAY_COST);
        task.input = [];
        renderGuide();
        sfx('flip');
        queueFlash(200);
        return;
      }
      if (flashing) {
        if (live) fx.floatText(el, '폭탄을 봐!', { color: '#ffd43b', size: 16, rise: 36 });
        return;
      }
      if (!canAct(el)) return;
      el.classList.remove('hit');
      void el.offsetWidth;
      el.classList.add('hit');
      if (k === 'back') {
        task.input.pop();
        renderGuide();
        sfx('tap');
        return;
      }
      if (task.input.length >= task.digits.length) return;
      task.input.push(k);
      Arcade.audio.tone({ freq: 520 + Number(k) * 60, type: 'square', dur: 0.06, vol: 0.1 });
      renderGuide();
      if (task.input.length < task.digits.length) return;
      if (task.input.join('') === task.digits.join('')) {
        slots.classList.add('ok');
        good(slots, 2);
        taskDone();
      } else {
        slots.classList.add('bad');
        mistake(slots, WRONG_CODE, () => {
          task.input = [];
          renderGuide();
          queueFlash(150);
        });
      }
    }

    /** 코드를 폭탄 가운데에 한 자리씩 깜빡인다. 새로 부르면 하던 것은 멈추고 처음부터 */
    function queueFlash(ms) {
      const my = ++flashToken;
      flashing = true;
      codeEl.classList.remove('on');
      paintKeypad();
      if (flashCancel) flashCancel();
      flashCancel = game.after(ms, () => {
        flashCancel = null;
        runFlash(my);
      });
    }

    async function runFlash(my) {
      for (const d of task.digits) {
        if (my !== flashToken) return;
        codeEl.textContent = d;
        codeEl.classList.add('on');
        fx.pop(codeEl);
        Arcade.audio.tone({ freq: 520 + Number(d) * 60, type: 'triangle', dur: 0.2, vol: 0.18 });
        await game.wait(L.flash[0] * 1000);
        if (my !== flashToken) return;
        codeEl.classList.remove('on');
        await game.wait(L.flash[1] * 1000);
      }
      if (my !== flashToken) return;
      flashing = false;
      paintKeypad();
      sfx('pick');
    }

    function taskDone() {
      busy = true;
      switching = true;
      taskIdx++;
      sfx('great');
      game.addScore(100, guide);
      fx.pop(stepEl);
      game.after(600, () => {
        if (!live) return;
        if (taskIdx >= taskCount()) return defused();
        task = makeTask();
        renderTask();
        busy = false;
        switching = false;
        if (kind === 'code') queueFlash(350);
      });
    }

    // ----- 폭발, 시간 초과, 해체
    function explode() {
      booms++;
      stageBooms++;
      game.resetCombo();
      sfx('boom');
      fx.flash('rgba(255,140,40,.45)', 420);
      fx.burst(bomb, { emoji: ['💥', '🔥', '💨'], count: 12, size: 16, spread: 150 });
      bomb.classList.remove('blast');
      void bomb.offsetWidth;
      bomb.classList.add('blast');
      if (game.loseLife(bomb) <= 0) {
        live = false;
        game.lose({ title: '펑!', icon: '💥', message: `${stageIdx + 1}번 폭탄이 너무 흔들려 터졌어요.`, checkpoint: stageIdx });
        return;
      }
      stability = 100;
      bx = by = 0;
      inside = true;
      stunUntil = game.time + STUN;
      if (mode === 'sensor') {
        ref = lastU; // 자세를 다시 0 으로
        tiltX = 0;
        tiltY = 0;
      }
      fx.toast('💥 펑! 하던 작업은 <b>처음부터</b>', { kind: 'bad', ms: 1400 });
      if (switching || !task) return;
      if (kind === 'wire') {
        task.cut.clear();
        task.step = 0;
        renderTask();
      } else if (kind === 'code') {
        task.input = [];
        renderGuide();
        queueFlash(STUN * 1000);
      }
    }

    function timeUp() {
      if (!live) return;
      live = false;
      sfx('boom');
      game.lose({ title: '쾅! 시간 초과', icon: '💣', message: `${stageIdx + 1}번 폭탄의 시간이 다 됐어요.`, checkpoint: stageIdx });
    }

    async function defused() {
      live = false;
      busy = true;
      switching = false;
      gustCancels.forEach((c) => c());
      gustCancels = [];
      gust = null;
      gustWarn = null;
      const left = stageTimer.left();
      game.stopTimer();
      leftSum += left;
      totalSum += stageTotal;
      bomb.classList.add('safe');
      lcd.textContent = 'OFF';
      sfx('unlock');
      fx.confetti(30);
      game.addScore(Math.ceil(left) * 15, bomb);
      if (stageMistakes === 0 && stageBooms === 0) {
        game.after(450, () => {
          game.addScore(400, lcd);
          sfx('bonus');
          fx.toast('✨ 완벽 해체! <b>+400</b>', { kind: 'gold', ms: 1300 });
        });
      } else {
        fx.toast('해체 성공!', { kind: 'good', ms: 1100 });
      }
      await game.wait(1700);
      if (stageIdx >= STAGES.length - 1) return finish();
      stageIdx++;
      runStage();
    }

    function finish() {
      const lost = game.config.lives - game.lives;
      const ratio = leftSum / Math.max(1, totalSum);
      let stars = lost === 0 && ratio >= 0.25 ? 3 : lost <= 1 ? 2 : 1;
      if (game.retry > 0) stars = Math.min(stars, 2);
      game.win({
        stars,
        title: '해체 완료!',
        message:
          stars === 3
            ? '한 번도 터지지 않고 빠르게 해체했어요!'
            : lost === 0
              ? '한 번도 터지지 않았어요!'
              : '폭탄 3개를 모두 해체했어요!',
        stats: [
          ['남은 시간', `${Math.round(leftSum)}초`],
          ['실수', `${mistakes}번`],
          ['폭발', `${booms}번`],
          ['최대 콤보', `${game.maxCombo}`],
        ],
      });
    }

    // ----- 바람
    function scheduleGusts() {
      gustCancels.forEach((c) => c());
      gustCancels = [];
      const n = S.gustCount + (stageIdx === 2 ? 2 : 0); // 마지막 폭탄은 돌풍이 잦다
      if (n <= 0 || gustPower <= 0) return;
      const first = 4;
      const span = Math.max(8, stageTotal * 0.85 - first);
      for (let i = 0; i < n; i++) {
        const at = first + (span * (i + 0.5 + rand(-0.3, 0.3))) / n;
        gustCancels.push(game.after(at * 1000, warnGust));
      }
    }

    function warnGust() {
      if (!live || gust || gustWarn) return;
      const ang = rand(0, Math.PI * 2);
      gustWarn = { ang };
      fx.toast('💨 돌풍이 온다!', { kind: 'gold', ms: 1200 });
      Arcade.audio.noise({ dur: GUST_WARN, freq: 300, to: 1800, vol: 0.1 });
      gustCancels.push(
        game.after(GUST_WARN * 1000, () => {
          gustWarn = null;
          if (!live) return;
          gust = { ang, t: 0 };
          sfx('whoosh');
        })
      );
    }

    // ----- 매 프레임
    function control() {
      if (debugHold) return debugHold;
      if (assist) return { x: -wx, y: -wy };
      if (mode === 'sensor') return { x: tiltX / S.tiltMax, y: tiltY / S.tiltMax };
      if (mode === 'touch' && grip) return { x: grip.fx + grip.ox, y: grip.fy + grip.oy };
      return null;
    }

    function step(dt) {
      // 늘 부는 바람: 방향이 천천히 바뀌고 시간이 갈수록 세진다
      turnLeft -= dt;
      if (turnLeft <= 0) {
        windTurn = pick([-1, 1]) * rand(0.25, 0.7);
        turnLeft = rand(2, 4.5);
      }
      windAng += windTurn * dt;
      const drift = calm ? 0 : L.drift * (1.5 - 0.5 * stageTimer.ratio()) * (stageIdx === 2 ? 1.2 : 1) * (1 - relief * 0.1);
      wx = Math.cos(windAng) * drift;
      wy = Math.sin(windAng) * drift;
      if (gust) {
        gust.t += dt;
        if (gust.t >= GUST_DUR) gust = null;
        else {
          const e = gust.t < 0.25 ? gust.t / 0.25 : 1 - Math.pow((gust.t - 0.25) / (GUST_DUR - 0.25), 2);
          wx += Math.cos(gust.ang) * gustPower * e;
          wy += Math.sin(gust.ang) * gustPower * e;
        }
      }

      // 기포
      const c = control();
      if (c) {
        const k = 1 - Math.exp(-dt * FOLLOW);
        bx += (clamp(c.x, -1.4, 1.4) + wx - bx) * k;
        by += (clamp(c.y, -1.4, 1.4) + wy - by) * k;
      } else {
        // 아무도 붙잡지 않으면 바람에 밀려 미끄러진다. 화살표 키로 밀 수 있다
        const r0 = Math.hypot(bx, by);
        let kx = 0;
        let ky = 0;
        pressed.forEach((key) => {
          kx += KEYS[key][0];
          ky += KEYS[key][1];
        });
        const kl = Math.hypot(kx, ky) || 1;
        bx += (wx * SLIP + (r0 > 0.001 ? bx / r0 : 0) * OUTWARD + (kx / kl) * KEY_PUSH) * dt;
        by += (wy * SLIP + (r0 > 0.001 ? by / r0 : 0) * OUTWARD + (ky / kl) * KEY_PUSH) * dt;
      }
      const r = Math.hypot(bx, by);
      if (r > 1) {
        bx /= r;
        by /= r;
      }

      // 안정도
      const dist = Math.min(1, r);
      inside = dist <= SAFE;
      if (stunned()) stability = 100;
      else if (inside) stability = Math.min(100, stability + S.stabilityRecoverRate * dt);
      else {
        const sev = clamp((dist - SAFE) / (1 - SAFE), 0, 1);
        stability = Math.max(0, stability - S.stabilityDecreaseRate * (0.6 + 0.8 * sev) * dt);
        if (stability <= 0) return explode();
      }

      // 째깍: 남은 시간이 적을수록 빨라진다
      const left = stageTimer.left();
      const gap = left > 20 ? 1 : left > 10 ? 0.5 : 0.25;
      tickAcc += dt;
      if (tickAcc >= gap) {
        tickAcc = 0;
        tock = !tock;
        Arcade.audio.tone({ freq: tock ? 1250 : 880, type: 'square', dur: 0.025, vol: left > 10 ? 0.05 : 0.08 });
        lcd.classList.toggle('tock', tock);
      }
      // 안정도가 낮으면 경보
      if (stability < DANGER && !stunned()) {
        alarmAcc += dt;
        if (alarmAcc > 0.4) {
          alarmAcc = 0;
          Arcade.audio.tone({ freq: 1500, to: 1100, type: 'triangle', dur: 0.12, vol: 0.08 });
        }
      } else alarmAcc = 0.4;
    }

    const shown = { inside: null, stab: -1, band: '', lcd: '', shaky: null, danger: null, hint: null, gust: '', vane: '' };
    function paint() {
      const mr = size * MOVE;
      bubble.style.transform = `translate(${(bx * mr).toFixed(1)}px, ${(by * mr).toFixed(1)}px)`;
      if (inside !== shown.inside) {
        shown.inside = inside;
        bomb.classList.toggle('in', inside);
        bomb.classList.toggle('out', !inside);
      }
      const st = Math.ceil(stability);
      if (st !== shown.stab) {
        shown.stab = st;
        gaugeFill.style.transform = `scaleY(${(stability / 100).toFixed(3)})`;
        stabNum.textContent = st;
        const band = st > 60 ? '' : st > DANGER ? 'mid' : 'low';
        if (band !== shown.band) {
          shown.band = band;
          gauge.className = 'bb-gauge ' + band;
        }
      }
      const danger = live && stability < DANGER;
      if (danger !== shown.danger) {
        shown.danger = danger;
        wrap.classList.toggle('danger', danger);
      }
      const shaky = live && !inside && !stunned();
      if (shaky !== shown.shaky) {
        shown.shaky = shaky;
        device.classList.toggle('shaky', shaky);
      }
      device.classList.toggle('stun', live && stunned());
      if (live) {
        const t = String(clockNow()).padStart(2, '0');
        if (t !== shown.lcd) {
          shown.lcd = t;
          lcd.textContent = t;
          lcd.classList.toggle('low', clockNow() <= 10);
        }
      } else shown.lcd = '';
      // 손가락 조작: 잡은 자리와 기포를 줄로 잇는다
      const needHint = live && mode === 'touch' && !grip && pressed.size === 0;
      if (needHint !== shown.hint) {
        shown.hint = needHint;
        bomb.classList.toggle('needgrip', needHint);
      }
      if (mode === 'touch' && grip) {
        const gx = grip.fx * mr;
        const gy = grip.fy * mr;
        const dx = bx * mr - gx;
        const dy = by * mr - gy;
        bomb.classList.add('gripping');
        gripEl.style.transform = `translate(${gx.toFixed(1)}px, ${gy.toFixed(1)}px)`;
        tether.style.width = Math.hypot(dx, dy).toFixed(1) + 'px';
        tether.style.transform = `translate(${gx.toFixed(1)}px, ${gy.toFixed(1)}px) rotate(${Math.atan2(dy, dx).toFixed(3)}rad)`;
      } else bomb.classList.remove('gripping');
      // 바람개비와 돌풍 화살표
      const wm = Math.hypot(wx, wy);
      vaneArrow.style.transform = `rotate(${Math.atan2(wy, wx).toFixed(3)}rad) scale(${(0.7 + Math.min(wm, 0.6)).toFixed(2)})`;
      vaneArrow.style.opacity = live ? (0.35 + Math.min(wm * 2.5, 0.65)).toFixed(2) : '0.3';
      const g = gust || gustWarn;
      const gState = gust ? 'on' : gustWarn ? 'warn' : '';
      if (gState !== shown.gust) {
        shown.gust = gState;
        gustEl.className = 'bb-gust ' + gState;
        vane.classList.toggle('gust', !!gState);
      }
      if (g) {
        const rr = size * 0.47;
        gustEl.style.transform = `translate(${(-Math.cos(g.ang) * rr).toFixed(1)}px, ${(-Math.sin(g.ang) * rr).toFixed(1)}px) rotate(${g.ang.toFixed(3)}rad)`;
      }
    }

    game.loop((dt) => {
      if (mode === 'sensor') {
        sinceEvent += dt;
        if (sinceEvent > 2) {
          // 센서 이벤트가 끊기면 손가락 조작으로 바꾼다
          applyMode('touch');
          fx.toast('센서가 멈춰서 <b>손가락 조작</b>으로 바꿨어요', { ms: 2000 });
        } else if (lastU && ref) {
          const t = tiltOf(lastU, ref);
          const k = 1 - Math.exp(-dt / 0.06);
          tiltX += (t.x - tiltX) * k;
          tiltY += (t.y - tiltY) * k;
        }
      }
      if (live) step(dt);
      if (game.playing) paint();
    });

    // ----- 스테이지
    async function runStage() {
      live = false;
      busy = true;
      switching = false;
      kind = STAGES[stageIdx].kind;
      taskIdx = 0;
      stageMistakes = 0;
      stageBooms = 0;
      stability = 100;
      bx = by = 0;
      inside = true;
      gust = gustWarn = null;
      stunUntil = -1;
      flashToken++;
      flashing = false;
      codeEl.classList.remove('on');
      serial = makeSerial();
      serialEl.textContent = 'NO.' + serial;
      bomb.classList.remove('safe');
      lcd.textContent = String(stageTotal).padStart(2, '0');
      stageTimer = null;
      game.setStage(stageIdx, STAGES.length);
      game.setGoal(STAGES[stageIdx].goal);
      task = makeTask();
      renderTask();
      const [title, sub] = STAGES[stageIdx].banner;
      await game.banner(title, sub, { ms: 1500 });
      if (mode === 'pending') {
        // 안내 띠가 떠 있는 동안 센서 값이 한 번도 안 왔으면 손가락 조작
        applyMode(sensorSeen > 0 ? 'sensor' : 'touch');
        fx.toast(
          mode === 'sensor' ? '📱 지금 자세가 <b>수평</b>이에요' : '센서가 없어 <b>손가락 조작</b>으로 해요',
          { ms: 1800 }
        );
      } else if (mode === 'sensor') {
        ref = lastU; // 폭탄마다 지금 자세를 다시 0 으로
        tiltX = 0;
        tiltY = 0;
      }
      stageTimer = game.startTimer(stageTotal, { onEnd: timeUp });
      live = true;
      busy = false;
      tickAcc = 0;
      scheduleGusts();
      if (kind === 'code') queueFlash(300);
    }

    if (game.debug) {
      // 검증용: 상태 보기, 조종 위치 넣기, 정답·오답 대신 누르기 (실제 처리 경로를 탄다)
      const elFor = () => (kind === 'code' ? null : wireEls[expected()]);
      window.__game = {
        state: () => ({
          mode, kind, live, busy, flashing, inside, stability,
          stage: stageIdx,
          task: taskIdx,
          tasks: taskCount(),
          stunned: stunned(),
          bubble: { x: bx, y: by },
          wind: { x: wx, y: wy },
          gust: !!gust,
          gustWarn: !!gustWarn,
          safe: SAFE,
          timeLeft: game.timeLeft(),
          clock: clockNow(),
          answer: expected(),
          colors: task && task.colors,
          code: task && task.digits ? task.digits.join('') : null,
          input: task && task.input ? task.input.join('') : null,
          rule: task && task.q ? { kind: task.kind, q: task.q, lamp: task.lamp, truth: task.truth(clockNow()) } : null,
          serial, mistakes, booms, denied, replays, stageMistakes, stageBooms,
          sensorSeen, gustPower, stageTotal,
          tilt: { x: tiltX, y: tiltY },
          grip, holder, size,
        }),
        hold: (x, y) => (debugHold = typeof x === 'number' ? { x, y } : null),
        assist: (on) => (assist = !!on),
        calm: (on) => (calm = !!on),
        solve() {
          if (!live || busy || flashing) return false;
          if (kind === 'code') {
            const k = task.digits[task.input.length];
            onKey(k, keypad.querySelector(`[data-k="${k}"]`));
          } else onCut(expected(), elFor());
          return true;
        },
        wrong() {
          if (!live || busy || flashing) return false;
          if (kind === 'code') {
            const bad = task.digits[task.input.length] === '1' ? '2' : '1';
            onKey(bad, keypad.querySelector(`[data-k="${bad}"]`));
            while (live && !busy && task.input.length > 0 && task.input.length < task.digits.length) onKey('1', keypad.querySelector('[data-k="1"]'));
          } else {
            const ans = expected();
            const i = task.colors.findIndex((_, n) => n !== ans && !task.cut.has(n));
            onCut(i, wireEls[i]);
          }
          return true;
        },
        gustNow: () => warnGust(),
        setMode: applyMode,
        settings: S,
        level,
        makeRule,
        makeWires,
        makeCode,
        upVector,
        tiltOf,
      };
    }

    applyMode(motionOK && !forceTouch && navigator.maxTouchPoints > 0 ? 'pending' : 'touch');
    if (mode === 'pending') game.on(window, 'deviceorientation', onOrient);
    runStage();
  }

  Arcade.createGame({
    id: GAME_ID,
    title: '폭탄 해체반',
    icon: '💣',
    accent: '#ff5d73',
    accent2: '#ffd43b',
    tagline: '째깍째깍! 손은 수평을, 머리는 해체를',
    howTo: [
      '폰을 기울여 <b>기포</b>를 가운데 원 안에! (센서가 없으면 손가락으로 끌기)',
      '기포가 원 밖이면 손이 떨려 <b>해체가 안 되고</b>, 안정도가 0 이면 펑!',
      '<b>지시서</b>대로 전선을 자르고 코드를 넣어 폭탄 3개를 해체하라',
    ],
    lives: 3,
    stages: STAGES.length,
    music: false, // 째깍 소리가 배경 리듬 노릇을 한다
    async prepare() {
      if (!forceTouch) motionOK = await Arcade.sensors.requestMotion();
    },
    start,
  });
})();
