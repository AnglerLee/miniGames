// 금고 털이: 세 개의 잠금
// 다이얼을 조심조심 돌리며 딸깍 소리가 가장 또렷한 숫자를 찾는다.
// 서두르면 소음이 쌓여 들키고 감지 소리도 묻힌다. 느긋하면 시간이 모자란다.
(function () {
  'use strict';

  const { h, rand, randInt, pick, clamp, sfx, fx, audio } = Arcade;
  const GAME_ID = 'game23';
  const TICKS = 60; // 다이얼 눈금 0~59

  // ----- 설정 (관리자 페이지와 같은 키를 쓴다)
  const PRESETS = [
    { senseRange: 10, stageTime: 45, noiseSens: 70, lives: 4 },
    { senseRange: 8, stageTime: 35, noiseSens: 100, lives: 3 },
    { senseRange: 6, stageTime: 28, noiseSens: 130, lives: 3 },
  ];
  const LIMITS = { senseRange: [3, 12], stageTime: [15, 120], noiseSens: [30, 250], lives: [1, 5] };
  const saved = Arcade.loadSettings('safe_cracker_settings', {});
  const level = clamp(parseInt(saved.difficulty, 10) || 0, 0, 2);
  const S = Object.assign({}, PRESETS[level]);
  Object.keys(LIMITS).forEach((key) => {
    const v = Number(saved[key]);
    if (Number.isFinite(v) && v > 0) S[key] = clamp(v, LIMITS[key][0], LIMITS[key][1]);
  });
  S.lives = Math.round(S.lives);
  S.senseRange = Math.round(S.senseRange);

  // 금고마다 규칙이 하나씩 더해진다: 방향과 미끼 → 경비 순찰
  const STAGES = [
    { locks: 1, range: 0, time: 1, treasure: '💰', banner: ['첫 번째 금고', '바늘이 끝까지 가는 숫자에서 멈춰라'] },
    { locks: 2, range: -1, time: 1.5, dirs: true, decoy: true, treasure: '💎', banner: ['두 번째 금고', '화살표 방향으로! 약한 반응은 미끼'] },
    { locks: 3, range: -2, time: 2, dirs: true, decoy: true, guard: true, treasure: '👑', banner: ['마지막 금고', '발소리가 나면 쉿! 손을 멈춰라'] },
  ];

  const QUIET = 7; // 이 속도(칸/초)까지는 소음이 쌓이지 않는다
  const CLEAR_LO = 10; // 여기까지는 감지 소리가 또렷하다
  const CLEAR_HI = 20; // 이보다 빠르면 감지 소리가 완전히 묻힌다
  const SPEED_TAU = 0.22; // 속도를 고르게 재는 시간(초)
  const NOISE_GAIN = 0.22;
  const NOISE_DECAY = 0.2; // 가만히 있을 때 1초에 줄어드는 소음
  const WRONG_DIR = 0.04; // 반대 방향으로 한 칸 돌릴 때의 소음
  const HUSH_TICK = 0.25; // "쉿!" 동안 한 칸 움직일 때의 소음
  const HOLD_WAIT = 0.25; // 멈춘 뒤 확정 게이지가 차기 시작할 때까지(초)
  const HOLD_FILL = 1.1; // 확정 게이지가 다 차는 시간(초)
  const CONFIRM_MIN = 0.2; // 이보다 약한 반응에서는 멈춰도 확정되지 않는다
  const DECOY_PEAK = 0.75;
  const DECOY_RANGE = 4;
  const STEPS_SEC = 0.9; // 발소리가 들리는 예고 시간
  const HUSH_SEC = 1.5; // 숨죽여야 하는 시간
  const STUN_SEC = 1.2; // 경보가 울린 뒤 다이얼을 만질 수 없는 시간
  const RING_LEN = 289; // 확정 고리의 둘레 (r=46)

  const mod = (n, m) => ((n % m) + m) % m;
  /** 다이얼 위 두 숫자 사이의 거리(칸) */
  const circ = (a, b) => {
    const d = mod(a - b, TICKS);
    return Math.min(d, TICKS - d);
  };

  /** 미끼 자리. 진짜 신호와 겹치지 않고, 되도록 정답보다 먼저 만나는 곳에 둔다. */
  function placeDecoy(from, target, sign, range) {
    const all = [];
    for (let v = 0; v < TICKS; v++) {
      if (circ(v, target) >= range + DECOY_RANGE + 1 && circ(v, from) >= DECOY_RANGE + 2) all.push(v);
    }
    const toTarget = mod((target - from) * sign, TICKS);
    const ahead = all.filter((v) => mod((v - from) * sign, TICKS) < toTarget);
    const pool = ahead.length && Math.random() < 0.75 ? ahead : all;
    return pool.length ? pick(pool) : -1;
  }

  /** 금고 하나의 잠금들을 만든다. 순수 함수라서 따로 시험하기 쉽다. */
  function makePlan(stage, range, from) {
    const plan = [];
    let pos = from;
    for (let i = 0; i < stage.locks; i++) {
      const dir = stage.dirs ? (i % 2 === 0 ? 1 : -1) : 0; // 1 시계, -1 반시계, 0 자유
      const sign = dir || pick([1, -1]);
      const minDist = Math.max(15, range + 5);
      const target = mod(pos + sign * randInt(minDist, Math.max(minDist, 40)), TICKS);
      const decoy = stage.decoy ? placeDecoy(pos, target, sign, range) : -1;
      plan.push({ target, dir, decoy });
      pos = target;
    }
    return plan;
  }

  /** 숫자 v 에서의 반응 세기(0~1). 정답만 1, 한 칸 옆은 0.8 아래, 미끼 꼭대기는 0.75. */
  function strength(lock, v, range) {
    if (!lock) return 0;
    const d = circ(v, lock.target);
    if (d === 0) return 1;
    let s = d < range ? 0.8 * (1 - d / range) : 0;
    if (lock.decoy >= 0) {
      const dd = circ(v, lock.decoy);
      if (dd === 0) s = Math.max(s, DECOY_PEAK);
      else if (dd < DECOY_RANGE) s = Math.max(s, 0.45 * (1 - dd / DECOY_RANGE));
    }
    return s;
  }

  // ----- 그림
  function ringSvg() {
    let s = '';
    for (let i = 0; i < TICKS; i++) {
      const a = ((i * 6 - 90) * Math.PI) / 180;
      const major = i % 5 === 0;
      const x = (r) => (100 + r * Math.cos(a)).toFixed(1);
      const y = (r) => (100 + r * Math.sin(a)).toFixed(1);
      s += `<line${major ? ' class="maj"' : ''} x1="${x(major ? 86 : 90)}" y1="${y(major ? 86 : 90)}" x2="${x(96)}" y2="${y(96)}"/>`;
      if (major) s += `<text x="${x(76)}" y="${(100 + 76 * Math.sin(a) + 4).toFixed(1)}">${i}</text>`;
    }
    return `<svg class="sc-ring" viewBox="0 0 200 200" aria-hidden="true">${s}</svg>`;
  }

  // 감지 계기: 아래쪽 멀리 있는 축에서 바늘이 좌우로 흔들린다
  const METER = { x: 135, y: 326, r: 296, sweep: 19 };
  function meterSvg() {
    const { x, y, r, sweep } = METER;
    const pt = (deg, rad) => {
      const a = ((deg - 90) * Math.PI) / 180;
      return `${(x + rad * Math.cos(a)).toFixed(1)} ${(y + rad * Math.sin(a)).toFixed(1)}`;
    };
    const arc = (a0, a1, rad) => `M${pt(a0, rad)}A${rad} ${rad} 0 0 1 ${pt(a1, rad)}`;
    let ticks = '';
    for (let i = 0; i <= 10; i++) {
      const a = -sweep + (2 * sweep * i) / 10;
      ticks += `M${pt(a, r)}L${pt(a, r + (i % 5 === 0 ? 10 : 6))}`;
    }
    return `<svg viewBox="0 0 270 48" aria-hidden="true">
      <path class="arc" d="${arc(-sweep, sweep, r)}"/>
      <path class="ticks" d="${ticks}"/>
      <path class="gold" d="${arc(sweep * 0.78, sweep, r + 5)}"/>
      <text x="10" y="17">감지</text>
      <text class="max" x="260" y="17" text-anchor="end">끝!</text>
      <line class="sc-needle" x1="${x}" y1="${y}" x2="${x}" y2="${y - r - 15}"/>
    </svg>`;
  }

  // 도는 방향을 알려 주는 둥근 화살표 (반시계는 좌우를 뒤집는다)
  const ARROW = '<path d="M18.5 9.3A7.5 7.5 0 1 1 11.4 5.5"/><path class="head" d="M10.2 1.9L15.3 5.3L10.8 9.2Z"/>';
  const arrowSvg = (dir) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true"><g${dir < 0 ? ' transform="translate(24 0) scale(-1 1)"' : ''}>${ARROW}</g></svg>`;
  const triSvg = (dir) => `<svg viewBox="0 0 12 14" aria-hidden="true"><path d="${dir > 0 ? 'M1 1v12l10-6z' : 'M11 1v12L1 7z'}"/></svg>`;
  const RING_SVG =
    '<svg class="sc-hold" viewBox="0 0 100 100" aria-hidden="true"><circle class="bg" cx="50" cy="50" r="46"/>' +
    `<circle class="fill" cx="50" cy="50" r="46" transform="rotate(-90 50 50)" stroke-dasharray="${RING_LEN}" stroke-dashoffset="${RING_LEN}"/></svg>`;

  // ----- 소리: 청진기를 댄 듯한 딸깍. 반응이 셀수록 높고 또렷하다
  // 폰 스피커는 낮은 소리를 거의 못 내므로 발소리와 심장 소리도 150Hz 위에서 만든다
  function clickSound(sig, kind) {
    if (kind === 'rattle') {
      // 너무 빨리 돌리면 덜그럭거리는 소리만 난다
      audio.noise({ dur: 0.05, freq: 700, q: 0.7, vol: 0.14 });
      return;
    }
    audio.noise({ dur: 0.03, freq: 1400 + 2600 * sig, q: 2 + 8 * sig, vol: 0.05 + 0.12 * sig });
    if (sig > 0.02) {
      audio.tone({ freq: 380 * Math.pow(2, sig * 1.9), type: 'triangle', dur: 0.05 + 0.06 * sig, vol: 0.04 + 0.16 * sig });
    }
    if (kind === 'peak') {
      audio.tone({ freq: 2093, dur: 0.4, vol: 0.16 });
      audio.tone({ freq: 3136, dur: 0.3, vol: 0.07, delay: 0.02 });
    } else if (kind === 'decoy') {
      audio.tone({ freq: 880, type: 'triangle', dur: 0.14, vol: 0.1 });
    }
  }

  function footsteps() {
    [0, 0.28, 0.56].forEach((delay, i) => {
      audio.tone({ freq: 230, to: 140, type: 'triangle', dur: 0.1, vol: 0.16 + i * 0.07, delay });
      audio.noise({ dur: 0.05, freq: 900, q: 1.2, vol: 0.08 + i * 0.05, delay });
    });
  }

  function start(game) {
    const ease = Math.min(game.retry, 3); // 재도전할수록 조금 쉬워진다
    const sens = (S.noiseSens / 100) * (1 - 0.1 * ease);

    let stageIdx = game.checkpoint;
    let plan = [];
    let lockIdx = 0;
    let range = S.senseRange;
    let busy = true; // 안내 띠나 문 열리는 연출 중에는 조작을 받지 않는다
    let timer = null;

    // 다이얼: angle 은 손이 돌린 만큼(칸, 소수), raw 는 지금 가리키는 칸(끝없이 이어지는 정수)
    let angle = 0;
    let raw = 0;
    let value = 0;
    let shown = 0;
    let moved = 0;
    let speed = 0;
    let drag = null;

    let needle = 0;
    let glow = -1;
    let still = 0;
    let confirm = 0;
    let armed = true; // 틀린 확정 뒤에는 한 번 움직여야 다시 확정할 수 있다
    let ringStep = 0;
    let lastClick = -1;

    let noise = 0;
    let peakNoise = 0;
    let loud = false;
    let stunUntil = 0;
    let dirWarned = false;
    let beatAt = 0;
    let faceNow = '';
    const guard = { phase: 'idle', at: Infinity, until: 0, moved: false };

    let streak = 0;
    let opened = 0;
    let quietLocks = 0;
    let ratioSum = 0;
    let leftSum = 0;
    let stagesDone = 0;

    // ----- 화면
    const slotsEl = h('div', { class: 'sc-slots' });
    let slots = [];
    const meter = h('div', { class: 'sc-meter', html: meterSvg() });
    const needleEl = meter.querySelector('.sc-needle');
    const knob = h('div', { class: 'sc-knob' }, h('i', { class: 'sc-ptr' }));
    const numEl = h('div', { class: 'sc-num', text: '0' });
    const dirEl = h('div', { class: 'sc-dir' });
    const hub = h('div', { class: 'sc-hub', html: RING_SVG }, [numEl, dirEl]);
    const ringEl = hub.querySelector('.fill');
    const dial = h('div', { class: 'sc-dial', html: ringSvg() }, [knob, hub]);
    const boltsEl = h('div', { class: 'sc-bolts' });
    const door = h('div', { class: 'sc-door' }, [meter, dial, boltsEl]);
    const treasure = h('div', { class: 'sc-treasure' });
    const inside = h('div', { class: 'sc-inside' }, treasure);
    const safe = h('div', { class: 'sc-safe' }, [inside, door]);
    const alertEl = h('div', { class: 'sc-alert ar-hidden' });
    const wrap = h('div', { class: 'sc-wrap' }, [safe, alertEl]);
    const noiseFill = h('i');
    const face = h('span', { class: 'face' });
    const noiseBox = h('div', { class: 'sc-noise' }, [
      h('span', { class: 'lab', text: '소음' }),
      h('div', { class: 'bar' }, noiseFill),
      face,
    ]);
    game.root.append(h('div', { class: 'sc-board' }, [slotsEl, wrap, noiseBox]));

    function stepButton(dir) {
      const btn = h('button', {
        class: 'ar-btn ghost sc-step',
        'aria-label': dir > 0 ? '시계 방향으로 한 칸' : '반시계 방향으로 한 칸',
        html: dir > 0 ? `한 칸 ${triSvg(1)}` : `${triSvg(-1)} 한 칸`,
      });
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        nudge(dir);
      });
      return btn;
    }
    game.footer.append(stepButton(-1), stepButton(1));

    // 남는 자리에 맞춰 다이얼 크기를 정한다
    function fit() {
      const d = clamp(Math.min(wrap.clientWidth - 60, wrap.clientHeight - 90), 150, 300);
      safe.style.setProperty('--d', Math.floor(d) + 'px');
    }
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(fit);
      ro.observe(wrap);
      game.onCleanup(() => ro.disconnect());
    }
    game.on(window, 'resize', fit);

    // ----- 판정에 쓰는 값
    const lock = () => plan[lockIdx];
    const signalAt = (v) => strength(lock(), v, range);
    const clarity = () => clamp((CLEAR_HI - speed) / (CLEAR_HI - CLEAR_LO), 0, 1);
    const hushing = () => guard.phase === 'hush';
    const stunned = () => game.time < stunUntil;
    const canTurn = () => game.playing && !busy && !stunned();

    // ----- 다이얼 돌리기
    function turn(d) {
      if (!canTurn() || !d) return;
      angle += d;
      moved += Math.abs(d);
      // 경계에서 숫자가 떨리지 않게, 반 칸보다 조금 더 넘어가야 바뀐다
      while (Math.abs(angle - raw) > 0.6) {
        const step = angle > raw ? 1 : -1;
        raw += step;
        onTick(step);
        if (!canTurn()) break;
      }
    }

    function nudge(step) {
      if (!canTurn()) return;
      raw += step;
      angle = raw;
      moved += 1;
      onTick(step);
    }

    function onTick(step) {
      value = mod(raw, TICKS);
      numEl.textContent = value;
      still = 0;
      confirm = 0;
      ringStep = 0;
      armed = true;

      const L = lock();
      if (hushing()) {
        noise += HUSH_TICK * sens;
        audio.tone({ freq: 170, to: 110, type: 'sawtooth', dur: 0.09, vol: 0.12 });
        if (!guard.moved) {
          guard.moved = true;
          fx.toast('쉿! 움직이면 들켜요', { kind: 'bad', ms: 900 });
          fx.shake(safe, 6);
        }
      } else if (L && L.dir && step !== L.dir) {
        noise += WRONG_DIR * sens;
        audio.tone({ freq: 250, to: 190, type: 'sawtooth', dur: 0.06, vol: 0.07 });
        dirEl.classList.add('bad');
        if (!dirWarned) {
          dirWarned = true;
          fx.toast('반대 방향! 끼익 소리가 나요', { kind: 'bad', ms: 1000 });
        }
      } else {
        dirEl.classList.remove('bad');
      }

      const clear = clarity();
      const base = signalAt(value);
      const sig = base * clear;
      if (game.time - lastClick >= 0.028) {
        lastClick = game.time;
        if (clear <= 0) clickSound(0, 'rattle');
        else clickSound(sig, clear < 0.8 ? '' : base === 1 ? 'peak' : L && value === L.decoy ? 'decoy' : '');
      }
      if (sig > 0.05) Arcade.vibrate(Math.round(6 + 26 * sig));
    }

    const angleOf = (e) => {
      const r = dial.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      return { a: Math.atan2(dy, dx), far: Math.hypot(dx, dy) / (r.width / 2) };
    };

    dial.addEventListener('pointerdown', (e) => {
      if (!canTurn() || drag) return;
      e.preventDefault();
      try {
        dial.setPointerCapture(e.pointerId);
      } catch (err) {
        /* 포인터 잡기를 지원하지 않는 브라우저 */
      }
      drag = { id: e.pointerId, a: angleOf(e).a };
      dial.classList.add('grab');
    });
    dial.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const p = angleOf(e);
      let d = p.a - drag.a;
      drag.a = p.a;
      if (p.far < 0.12) return; // 한가운데서는 각도가 튄다
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      turn((d * TICKS) / (Math.PI * 2));
    });
    function endDrag(e) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      drag = null;
      angle = raw; // 손을 떼면 눈금에 딱 맞춘다
      dial.classList.remove('grab');
    }
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => dial.addEventListener(type, endDrag));

    game.on(window, 'keydown', (e) => {
      if (e.repeat) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') nudge(1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') nudge(-1);
      else return;
      e.preventDefault();
    });

    // ----- 실수의 대가
    function hurt(why) {
      streak = 0;
      confirm = 0;
      still = 0;
      if (game.loseLife(hub) <= 0) {
        busy = true;
        game.lose({ icon: '🚨', title: '들켰다!', message: why, checkpoint: stageIdx });
      }
    }

    function alarm() {
      // 경보가 울리면 잠깐 손을 뗀다. 이어서 또 울리는 일을 막는다
      noise = 0.3;
      loud = false;
      speed = moved = 0;
      stunUntil = game.time + STUN_SEC;
      endDrag();
      [0, 0.22, 0.44].forEach((delay) => audio.tone({ freq: 660, to: 990, type: 'square', dur: 0.2, vol: 0.12, delay }));
      if (game.lives > 1) fx.toast('🚨 경보! 너무 시끄러웠어요', { kind: 'bad', ms: 1300 });
      hurt('소음 경보가 울려서 경비에게 들켰어요.');
    }

    function commit() {
      confirm = 0;
      still = 0;
      armed = false;
      const L = lock();
      if (value === L.target) return openLock();
      sfx('bad');
      fx.shake(safe, 9);
      if (game.lives > 1) {
        fx.toast(value === L.decoy ? '미끼였다! 진짜는 바늘이 <b>끝까지</b> 가요' : '아직 아니야! 바늘이 <b>끝까지</b> 가는 곳을 찾아라', {
          kind: 'bad',
          ms: 1600,
        });
      }
      hurt('틀린 숫자를 넣다가 잠금 장치가 잠겨 버렸어요.');
    }

    // ----- 잠금 하나 풀기
    function openLock() {
      const slot = slots[lockIdx];
      slot.classList.remove('now');
      slot.classList.add('done');
      slot.querySelector('b').textContent = value;
      fx.pop(slot);
      boltsEl.children[lockIdx].classList.add('off');
      sfx('unlock');
      Arcade.vibrate([30, 40, 70]);
      fx.burst(slot, { count: 12, spread: 70, colors: ['#ffd166', '#fff3c4', '#3ddc97'] });

      streak++;
      opened++;
      const quiet = peakNoise < 0.35;
      if (quiet) quietLocks++;
      if (streak >= 2) sfx('combo', streak);
      game.addScore(200 + (quiet ? 100 : 0) + (streak - 1) * 50, hub);
      if (quiet) fx.floatText(noiseBox, '🤫 조용 보너스!', { color: '#3ddc97', size: 18, rise: 40 });

      lockIdx++;
      if (lockIdx >= plan.length) return stageClear();
      paintLock();
      fx.pop(dirEl);
    }

    function paintLock() {
      const L = lock();
      const st = STAGES[stageIdx];
      slots.forEach((s, i) => s.classList.toggle('now', i === lockIdx));
      dirEl.innerHTML = L.dir ? arrowSvg(L.dir) : '';
      dirEl.classList.remove('bad');
      dirEl.classList.toggle('ccw', L.dir < 0);
      const way = L.dir ? `<b>${L.dir > 0 ? '시계 방향' : '반시계 방향'}</b>으로! ` : '';
      if (st.guard) game.setGoal(way + '<b>쉿!</b>이 뜨면 멈춰라');
      else if (st.decoy) game.setGoal(way + '약한 반응은 <b>미끼</b>');
      else game.setGoal('바늘이 <b>끝까지</b> 가는 숫자에서 <b>멈춰라</b>');
      peakNoise = noise;
      dirWarned = false;
      armed = true;
      still = 0;
      confirm = 0;
    }

    // ----- 금고 하나
    async function runStage() {
      busy = true;
      const st = STAGES[stageIdx];
      range = clamp(S.senseRange + st.range + ease, 3, 16);
      angle = raw = value = 0;
      numEl.textContent = '0';
      speed = moved = noise = 0;
      loud = false;
      stunUntil = 0;
      guard.phase = 'idle';
      guard.at = Infinity;
      alertEl.classList.add('ar-hidden');
      wrap.classList.remove('hush');
      inside.classList.remove('show');
      door.classList.remove('open');

      plan = makePlan(st, range, value);
      lockIdx = 0;
      slotsEl.innerHTML = '';
      boltsEl.innerHTML = '';
      slots = plan.map((L) => {
        const slot = h('div', { class: 'sc-slot' }, [
          L.dir ? h('span', { class: 'dir', html: arrowSvg(L.dir) }) : null,
          h('b', { text: '?' }),
        ]);
        slotsEl.appendChild(slot);
        boltsEl.appendChild(h('i'));
        return slot;
      });
      game.setStage(stageIdx, STAGES.length);
      paintLock();
      fit();

      await game.banner(st.banner[0], st.banner[1], { ms: 1600 });
      const seconds = S.stageTime * st.time + ease * 5;
      timer = game.startTimer(seconds, {
        onEnd: () => {
          busy = true;
          game.lose({
            icon: '⏰',
            title: '시간 초과!',
            message: `${stageIdx + 1}번째 금고를 열기 전에 경비가 돌아왔어요.`,
            checkpoint: stageIdx,
          });
        },
      });
      if (st.guard) guard.at = game.time + rand(4.5, 6.5);
      busy = false;
    }

    async function stageClear() {
      busy = true;
      endDrag();
      guard.phase = 'idle';
      guard.at = Infinity;
      alertEl.classList.add('ar-hidden');
      wrap.classList.remove('hush');
      const left = timer.left();
      ratioSum += timer.ratio();
      leftSum += left;
      stagesDone++;
      game.stopTimer();

      // 빗장이 모두 풀리면 문이 열리고 보물이 나온다
      await game.wait(450);
      treasure.textContent = STAGES[stageIdx].treasure;
      door.classList.add('open');
      sfx('whoosh');
      audio.tone({ freq: 140, to: 70, type: 'square', dur: 0.25, vol: 0.14 });
      await game.wait(550);
      inside.classList.add('show');
      sfx('bonus');
      fx.burst(inside, { count: 16, spread: 130, size: 11, emoji: ['🪙', '✨'] });
      fx.confetti(30);
      game.addScore(Math.ceil(left) * 10);
      const box = inside.getBoundingClientRect();
      fx.floatText({ x: box.left + box.width / 2, y: box.top + 56 }, `남은 시간 +${Math.ceil(left) * 10}`, {
        color: '#ffd166',
        size: 22,
        rise: 24,
        life: 1300,
      });
      await game.wait(1400);

      if (stageIdx >= STAGES.length - 1) return finish();
      stageIdx++;
      runStage();
    }

    function finish() {
      const lost = game.config.lives - game.lives;
      const ratio = ratioSum / Math.max(1, stagesDone);
      let stars = lost === 0 && ratio >= 0.35 ? 3 : lost <= 1 ? 2 : 1;
      if (game.retry > 0) stars = Math.min(stars, 2);
      game.win({
        stars,
        title: '금고를 모두 열었다!',
        message: stars === 3 ? '한 번도 들키지 않은 완벽한 솜씨예요!' : '조심조심, 세 금고의 잠금을 모두 풀었어요!',
        stats: [
          ['남은 하트', `${game.lives} / ${game.config.lives}`],
          ['남긴 시간', `${Math.round(leftSum)}초`],
          ['조용히 푼 잠금', `${quietLocks} / ${opened}`],
        ],
      });
    }

    // ----- 매 프레임
    function tickNoise(dt) {
      if (speed > QUIET) noise += sens * NOISE_GAIN * Math.pow((speed - QUIET) / QUIET, 1.5) * dt;
      else noise -= NOISE_DECAY * (speed < 2 ? 1 : 0.4) * dt;
      noise = clamp(noise, 0, 1);
      peakNoise = Math.max(peakNoise, noise);
      if (!loud && noise >= 0.75 && noise < 1) {
        loud = true;
        sfx('warn');
        fx.toast('조용히! 곧 들켜요', { kind: 'bad', ms: 900 });
      } else if (loud && noise < 0.55) {
        loud = false;
      }
      if (noise >= 1) alarm();
    }

    function tickGuard() {
      const t = game.time;
      if (guard.phase === 'idle' && t >= guard.at) {
        guard.phase = 'steps';
        guard.until = t + STEPS_SEC;
        footsteps();
        alertEl.className = 'sc-alert steps';
        alertEl.innerHTML = '👣 발소리가 다가온다…';
      } else if (guard.phase === 'steps' && t >= guard.until) {
        guard.phase = 'hush';
        guard.until = t + HUSH_SEC;
        guard.moved = false;
        audio.noise({ dur: 0.5, freq: 5200, to: 2600, q: 0.7, vol: 0.12, filter: 'highpass' });
        alertEl.className = 'sc-alert hush';
        alertEl.innerHTML = '<span>🤫</span>쉿! 멈춰!<i></i>';
        wrap.classList.add('hush');
      } else if (guard.phase === 'hush' && t >= guard.until) {
        guard.phase = 'idle';
        guard.at = t + rand(6, 9);
        alertEl.classList.add('ar-hidden');
        wrap.classList.remove('hush');
        if (!guard.moved) {
          sfx('good');
          game.addScore(50, hub); // 들키지 않고 넘겼다
        }
      }
    }

    function tickConfirm(dt) {
      // 경비가 지나가는 동안에는 멈춰 있어도 확정되지 않는다 (억지로 틀리게 되는 일을 막는다)
      if (!armed || guard.phase !== 'idle' || stunned()) {
        still = 0;
        confirm = 0;
        ringStep = 0;
        return;
      }
      still += dt;
      if (still < HOLD_WAIT || signalAt(value) < CONFIRM_MIN) return;
      confirm += dt / HOLD_FILL;
      const stepNow = Math.min(3, Math.floor(confirm * 4));
      if (stepNow > ringStep) {
        ringStep = stepNow;
        audio.tone({ freq: 520 + 140 * stepNow, dur: 0.07, vol: 0.1 });
      }
      if (confirm >= 1) commit();
    }

    // 시간이 얼마 없거나 소음이 위험하면 심장 소리가 난다
    function tickBeat() {
      const tense = (timer && timer.ratio() < 0.25) || noise > 0.7;
      if (!tense || game.time < beatAt) return;
      beatAt = game.time + 0.75;
      audio.tone({ freq: 190, to: 110, type: 'triangle', dur: 0.11, vol: 0.18 });
      audio.tone({ freq: 170, to: 100, type: 'triangle', dur: 0.11, vol: 0.13, delay: 0.16 });
    }

    function render(dt) {
      shown += (angle - shown) * (1 - Math.exp(-dt / 0.04));
      knob.style.transform = `rotate(${(shown * 6).toFixed(2)}deg)`;

      // 감지 바늘: 반응이 셀수록 멀리 가고 더 떨린다. 너무 빠르면 잡음만 보인다
      const clear = clarity();
      const sig = signalAt(value) * clear;
      const amp = 0.008 + 0.035 * sig + 0.12 * (1 - clear);
      const aim = clamp(Math.max(sig, 0.1 * (1 - clear)) + rand(-amp, amp), 0, 1);
      needle += (aim - needle) * (1 - Math.exp(-dt / 0.05));
      const deg = -METER.sweep + 2 * METER.sweep * needle;
      needleEl.setAttribute('transform', `rotate(${deg.toFixed(2)} ${METER.x} ${METER.y})`);
      const g = Math.round(sig * 20) / 20;
      if (g !== glow) {
        glow = g;
        dial.style.setProperty('--sig', g);
      }

      noiseFill.style.transform = `scaleX(${noise.toFixed(3)})`;
      const mood = noise >= 0.75 ? 'high' : noise >= 0.4 ? 'mid' : 'low';
      if (mood !== faceNow) {
        faceNow = mood;
        noiseBox.className = 'sc-noise ' + mood;
        face.textContent = mood === 'high' ? '😠' : mood === 'mid' ? '🤨' : '😴';
      }

      ringEl.style.strokeDashoffset = (RING_LEN * (1 - clamp(confirm, 0, 1))).toFixed(1);
      dial.classList.toggle('holding', confirm > 0);
      dial.classList.toggle('stun', stunned());
      if (hushing()) {
        const bar = alertEl.querySelector('i');
        if (bar) bar.style.transform = `scaleX(${clamp((guard.until - game.time) / HUSH_SEC, 0, 1).toFixed(3)})`;
      }
    }

    game.loop((dt) => {
      const inst = moved / Math.max(dt, 0.004);
      moved = 0;
      speed += (inst - speed) * (1 - Math.exp(-dt / SPEED_TAU));
      if (!busy) {
        tickNoise(dt);
        if (!game.playing) return;
        tickGuard();
        tickConfirm(dt);
        if (!game.playing) return;
        tickBeat();
      }
      render(dt);
    });

    if (game.debug) {
      // 검증용: 정답을 보고, 다이얼 값을 직접 정한다
      window.__game = {
        state: () => ({
          stage: stageIdx,
          lock: lockIdx,
          locks: plan.length,
          value,
          dir: lock() ? lock().dir : 0,
          signal: signalAt(value),
          range,
          noise,
          speed,
          confirm,
          busy,
          guard: guard.phase,
          stunned: stunned(),
          timeLeft: timer ? timer.left() : null,
          open: door.classList.contains('open'),
        }),
        answers: () => plan.map((L) => L.target),
        makePlan: (stage, r, from) => makePlan(STAGES[stage], r, from),
        strength,
        target: () => (lock() ? lock().target : null),
        decoy: () => (lock() ? lock().decoy : -1),
        /** 소리와 소음 없이 다이얼을 n 으로 옮긴다 */
        setDial(n) {
          let d = mod(n - value, TICKS);
          if (d > TICKS / 2) d -= TICKS;
          raw += d;
          angle = raw;
          value = mod(raw, TICKS);
          numEl.textContent = value;
          still = 0;
          confirm = 0;
          armed = true;
        },
        step: (dir) => nudge(dir > 0 ? 1 : -1),
        setNoise: (v) => (noise = clamp(v, 0, 1)),
        patrol: () => (guard.at = game.time),
        setTimeLeft: (sec) => timer && timer.add(sec - timer.left()),
      };
    }

    runStage();
  }

  Arcade.createGame({
    id: GAME_ID,
    title: '금고 털이',
    icon: '🔓',
    accent: '#ffd166',
    accent2: '#ff9330',
    tagline: '세 개의 금고, 소리로 여는 잠금. 들키기 전에!',
    howTo: [
      '다이얼을 <b>천천히</b> 돌리며 딸깍 소리와 <b>감지 바늘</b>을 살펴요',
      '바늘이 <b>끝까지</b> 가는 숫자에서 <b>멈추면</b> 잠금이 풀려요',
      '빨리 돌리면 <b>소음</b>이 쌓여요. 가득 차면 들켜요!',
    ],
    lives: S.lives,
    stages: STAGES.length,
    music: false, // 작은 딸깍 소리를 들어야 하므로 배경 리듬을 끈다
    start,
  });
})();
