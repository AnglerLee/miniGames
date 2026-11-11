// 에너지 충전 "무궁화 발전소"
// 감시 로봇이 등을 돌린 동안에만 흔들어 충전하고, 예고가 다 켜져 로봇이 돌아보면 딱 멈춘다.
(function () {
  'use strict';

  const { h, rand, randInt, pick, clamp, sfx, fx } = Arcade;
  const GAME_ID = 'game13';

  // ----- 설정 (관리자 페이지와 같은 키. 기본값 표는 admin.js 와 같아야 한다)
  const PRESETS = [
    { threshold: 25, chargeRate: 4.2, stageTime: 55, turnTime: 0.65, redTolerance: 40, lives: 4 },
    { threshold: 30, chargeRate: 3.6, stageTime: 48, turnTime: 0.5, redTolerance: 25, lives: 3 },
    { threshold: 35, chargeRate: 3.2, stageTime: 42, turnTime: 0.4, redTolerance: 18, lives: 3 },
  ];
  const LIMITS = {
    threshold: [10, 60],
    chargeRate: [1, 12],
    stageTime: [20, 180],
    turnTime: [0.2, 1.5],
    redTolerance: [5, 90],
    lives: [1, 5],
  };
  // 옛 설정({ threshold, increment, timeLimit, decayRate, theme })에서는 threshold 만 이어 쓴다
  const saved = Arcade.loadSettings('energy_charge_settings', {});
  const level = clamp(parseInt(saved.difficulty, 10) || 0, 0, 2);
  const S = Object.assign({}, PRESETS[level]);
  Object.keys(LIMITS).forEach((key) => {
    const v = Number(saved[key]);
    if (Number.isFinite(v) && v > 0) S[key] = clamp(v, LIMITS[key][0], LIMITS[key][1]);
  });
  S.lives = Math.round(S.lives);
  const forceTap = saved.forceTap === true;

  const SYL = ['무', '궁', '화', '꽃', '이', '피', '었', '습', '니', '다'];
  const SCALE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16]; // 예고 음: 한 칸마다 한 음씩 올라간다
  const SHAKE_MIN = S.threshold * 0.08; // 센서 세기가 이 값을 넘으면 충전된다 (threshold 30 → 2.4)
  const STILL_MAX = S.redTolerance / 100; // 빨간불에서 봐주는 세기 (충전 기준을 1 로 본 값)
  const STRONG = 2; // 세기가 충전 기준의 이 배수를 넘으면 "세게"
  const STRONG_BONUS = 1.4; // 세게 할 때의 충전 배수
  const RAMP_SEC = 3; // 쉬지 않고 이만큼 충전하면 속도가 2배
  const SHOCK_LOSS = 15; // 감전되면 깎이는 충전량(%)
  const TAP_HOLD = 0.3; // 버튼 한 번이 충전으로 이어지는 시간(초)
  const TAP_UNIT = 3.7; // 1초에 이만큼 누르면 세기 1
  const METER_MAX = 3.2; // 세기 막대의 끝
  const HEAT = { normal: 0.16, strong: 0.55, cool: 0.3, lock: 2 }; // 과열: 초당 오르내리는 양, 막히는 시간
  const STAGE_RATE = [1, 1, 1.25]; // 마지막 배터리는 고출력(대신 과열된다)
  const RED_SEC = [[1.2, 2.0], [1.0, 2.5], [1.0, 2.2]];
  const STAGES = [
    { banner: ['배터리 1', '예고가 다 켜지면 딱 멈춰!'] },
    { banner: ['배터리 2', '예고가 변덕스럽다. 가짜도 있다!'], goal: '예고 속도가 바뀐다. <b>가짜 예고</b>에 속지 마!' },
    { banner: ['마지막 배터리', '세게만 하면 과열된다!'], goal: '<b>과열</b> 주의! 세게만 하면 충전이 막힌다' },
  ];

  let motionOK = false; // 센서 권한 결과. 시작 버튼을 누를 때 한 번만 묻는다

  /**
   * 예고 한 번의 박자를 만든다. delays[i] 는 i번째 칸이 켜지기까지 기다리는 시간(초).
   * fakeAt 이 있으면 그만큼 켜진 뒤 꺼지는 가짜 예고다.
   */
  function makeChant(stage, slow, fake) {
    let delays;
    if (stage === 0) {
      const beat = rand(0.4, 0.48); // 일정하고 느리다
      delays = SYL.map(() => beat);
    } else if (stage === 1) {
      const cut = randInt(4, 6); // 여기서 속도가 바뀐다
      const kind = pick(['accel', 'brake', 'pause']);
      delays = SYL.map((_, i) => {
        if (kind === 'accel') return i < cut ? 0.52 : 0.17;
        if (kind === 'brake') return i < cut ? 0.2 : 0.55;
        return i === cut ? rand(0.9, 1.3) : i < cut ? 0.32 : 0.15;
      });
    } else {
      delays = SYL.map(() => rand(0.12, 0.4)); // 빠르고 불규칙
      delays[randInt(3, 8)] += rand(0.3, 0.6);
    }
    return { delays: delays.map((d) => d * slow), fakeAt: fake ? randInt(stage === 1 ? 7 : 6, 9) : 0 };
  }

  function start(game) {
    const slow = 1 + Math.min(game.retry, 3) * 0.1; // 재도전하면 예고가 느려진다
    const stageTotal = S.stageTime + Math.min(game.retry, 3) * 4;
    const turnBase = S.turnTime + Math.min(game.retry, 3) * 0.05;

    let stageIdx = game.checkpoint;
    let mode = 'tap'; // pending(센서 확인 중) | sensor | tap
    let light = 'idle'; // idle | green | turn | red | stun | done
    let charge = 0;
    let peak = 0; // 이 배터리에서 가장 높았던 충전량. 점수는 여기를 넘을 때만 준다
    let scoreCarry = 0;
    let streak = 0; // 쉬지 않고 충전한 시간(초)
    let idle = 0;
    let maxed = false;
    let heat = 0;
    let lockLeft = 0; // 과열로 막힌 시간
    let chant = null;
    let lit = 0;
    let tNext = 0;
    let phaseLeft = 0;
    let grace = turnBase;
    let round = 0;
    let lastFake = false;
    let roundGain = 0;
    let lastActive = -9;
    let greedy = false; // 예고 끝까지 충전하다 멈췄는가
    let immuneUntil = 0;
    let blip = 0;
    let stageTimer = null;
    let shocks = 0;
    let sharp = 0;
    let leftSum = 0;
    let totalSum = 0;
    // 입력
    let motion = 0; // 센서: 가속도 변화량을 다듬은 값. 충전 판정용이라 천천히 내려간다
    let quick = 0; // 같은 값을 빨리 따라가게 다듬은 것. 빨간불 판정용이라 멈추면 바로 내려간다
    let prev = null;
    let prevT = 0;
    let sensorSeen = 0;
    let sinceEvent = 0;
    let lastTap = -9;
    let tapRate = 0;
    const taps = [];
    let debugX = null;

    // ----- 화면
    const lamps = SYL.map((s) => h('span', { text: s }));
    const chantEl = h('div', { class: 'ec-chant' }, lamps);
    const head = h('div', { class: 'ec-head' }, [
      h('div', { class: 'ec-face back' }, [h('i'), h('i'), h('i')]),
      h('div', { class: 'ec-face front' }, [h('div', { class: 'ec-eyes' }, [h('i'), h('i')]), h('div', { class: 'ec-mouth' })]),
    ]);
    const bot = h('div', { class: 'ec-bot' }, [h('div', { class: 'ec-ant' }), head]);
    const call = h('div', { class: 'ec-call' });
    const multEl = h('b', { text: 'x1.0' });
    const multBox = h('div', { class: 'ec-side ec-mult' }, [multEl, h('small', { text: '충전 속도' })]);
    const fill = h('div', { class: 'ec-fill' });
    const pctEl = h('div', { class: 'ec-pct', text: '0%' });
    const cell = h('div', { class: 'ec-cell' }, [fill, h('div', { class: 'ec-seg' }), pctEl, h('div', { class: 'ec-lock', text: '🔥 과열' })]);
    const batt = h('div', { class: 'ec-batt' }, [h('div', { class: 'ec-cap' }), cell]);
    const countEl = h('b');
    const countBox = h('div', { class: 'ec-count' }, [countEl, h('small', { text: '배터리' })]);
    const heatFill = h('i');
    const heatBox = h('div', { class: 'ec-heat ar-hidden' }, [h('div', { class: 'ec-thermo' }, heatFill), h('small', { text: '과열' })]);
    const mid = h('div', { class: 'ec-mid' }, [multBox, batt, h('div', { class: 'ec-side' }, [countBox, heatBox])]);
    const meterFill = h('i');
    const meter = h('div', { class: 'ec-meter' }, [
      h('span', { text: '세기' }),
      h('div', { class: 'ec-bar' }, [
        meterFill,
        h('b', { class: 'still', style: { left: (STILL_MAX / METER_MAX) * 100 + '%' } }),
        h('b', { class: 'min', style: { left: (1 / METER_MAX) * 100 + '%' } }),
        h('b', { class: 'hot', style: { left: (STRONG / METER_MAX) * 100 + '%' } }),
      ]),
    ]);
    const wrap = h('div', { class: 'ec-wrap', dataset: { light: 'idle' } }, [
      h('div', { class: 'ec-glow' }),
      bot,
      call,
      chantEl,
      mid,
      meter,
    ]);
    game.root.append(wrap);

    const tapLabel = h('span', { text: '⚡ 충전!' });
    const tapBtn = h('button', { class: 'ar-btn lg ec-tap' }, tapLabel);
    tapBtn.addEventListener('pointerdown', onTap);

    function paintCall() {
      const stop = light === 'turn' || light === 'red';
      const text =
        light === 'green'
          ? lockLeft > 0
            ? '식히는 중…'
            : mode === 'sensor'
              ? '흔들어!'
              : '연타!'
          : stop
            ? '멈춰!'
            : light === 'stun'
              ? '찌릿!'
              : light === 'done'
                ? '완충!'
                : '';
      if (call.textContent !== text) {
        call.textContent = text;
        fx.pop(call);
      }
      tapBtn.classList.toggle('stop', stop || light === 'stun');
      tapLabel.textContent = stop || light === 'stun' ? '✋ 손 떼!' : '⚡ 충전!';
    }

    function setLight(next) {
      light = next;
      wrap.dataset.light = next;
      paintCall();
    }

    function paintGoal() {
      if (STAGES[stageIdx].goal) return game.setGoal(STAGES[stageIdx].goal);
      game.setGoal(
        mode === 'tap'
          ? '초록불엔 <b>연타</b>, 로봇이 돌아보면 <b>손 떼!</b>'
          : '초록불엔 <b>흔들고</b>, 로봇이 돌아보면 <b>멈춰!</b>'
      );
    }

    function applyMode(next) {
      mode = next;
      wrap.dataset.mode = next;
      grace = next === 'tap' ? Math.max(0.25, turnBase * 0.7) : turnBase; // 버튼은 멈추기 쉬우니 여유를 줄인다
      wrap.style.setProperty('--ec-turn', grace + 's');
      game.footer.innerHTML = '';
      if (next === 'tap') game.footer.append(tapBtn);
      paintGoal();
      paintCall();
    }

    // ----- 소리
    function sylTone(i) {
      Arcade.audio.tone({ freq: 392 * Math.pow(2, SCALE[i] / 12), type: 'triangle', dur: 0.1, vol: 0.2 });
    }

    function chargeTone(strong) {
      const f = 196 * Math.pow(2, (charge / 100) * 2); // 충전량에 따라 두 옥타브 올라간다
      Arcade.audio.tone({ freq: f, to: f * 1.12, type: 'square', dur: 0.06, vol: strong ? 0.07 : 0.05 });
    }

    // ----- 입력: 세기 1 이상이면 충전, STRONG 이상이면 "세게"
    function intensity() {
      if (debugX !== null) return debugX;
      if (mode === 'sensor') return motion / SHAKE_MIN;
      if (mode !== 'tap' || game.time - lastTap > TAP_HOLD) return 0;
      return clamp(tapRate / TAP_UNIT, 1, METER_MAX);
    }

    /** 빨간불에서 보는 움직임. 버튼 조작은 누르는 순간 onTap 에서 판정하므로 0 이다. */
    function movement() {
      if (debugX !== null) return debugX;
      return mode === 'sensor' ? quick / SHAKE_MIN : 0;
    }

    function onMotion(e) {
      const a = e.accelerationIncludingGravity || e.acceleration;
      if (!a || typeof a.x !== 'number') return;
      sensorSeen++;
      sinceEvent = 0;
      if (!game.playing) {
        // 멈춘 동안의 값은 버리고, 다시 시작한 직후에는 잠깐 봐준다
        prev = null;
        motion = 0;
        quick = 0;
        immuneUntil = game.time + 0.8;
        return;
      }
      const t = performance.now();
      if (prev) {
        const dt = clamp((t - prevT) / 1000, 0.004, 0.12);
        // 가속도 변화량을 1/60초 기준으로 맞춘다. 기기를 어떻게 들고 있든 가만히 있으면 0 에 가깝다
        const change = Math.hypot(a.x - prev.x, a.y - prev.y, (a.z || 0) - prev.z) / dt / 60;
        motion += (change - motion) * (1 - Math.exp(-dt / (change > motion ? 0.05 : 0.2)));
        quick += (change - quick) * (1 - Math.exp(-dt / 0.06));
      }
      prev = { x: a.x, y: a.y, z: a.z || 0 };
      prevT = t;
    }

    function onTap(e) {
      if (e && e.preventDefault) e.preventDefault();
      if (!game.playing || mode !== 'tap') return;
      if (light === 'green') {
        const t = game.time;
        while (taps.length && (t - taps[0] > 0.8 || taps.length > 3)) taps.shift();
        taps.push(t);
        tapRate = taps.length > 1 ? (taps.length - 1) / Math.max(0.05, t - taps[0]) : 0;
        lastTap = t;
        if (lockLeft > 0) return sfx('tick');
        chargeTone(tapRate / TAP_UNIT >= STRONG);
        fx.burst(cell, { count: 3, spread: 60, size: 6, life: 420, colors: ['#ffd43b', '#fff3c4', '#ff9330'] });
      } else if (light === 'red' && game.time >= immuneUntil) {
        shock();
      }
    }

    // ----- 한 판의 흐름
    function beginGreen() {
      round++;
      // 가짜 예고는 연달아 나오지 않는다. 2스테이지에서는 두 번째 예고가 반드시 가짜다
      let fake = false;
      if (stageIdx === 1) fake = !lastFake && (round === 2 || (round > 2 && Math.random() < 0.35));
      else if (stageIdx === 2) fake = !lastFake && Math.random() < 0.3;
      lastFake = fake;
      chant = makeChant(stageIdx, slow, fake);
      lit = 0;
      tNext = 0.3 + chant.delays[0];
      streak = 0;
      idle = 0;
      maxed = false;
      roundGain = 0;
      lamps.forEach((l) => (l.className = ''));
      setLight('green');
      sfx('pick');
    }

    function advance() {
      if (chant.fakeAt && lit >= chant.fakeAt) return fakeOut();
      lamps[lit].className = 'on';
      sylTone(lit);
      lit++;
      if (lit >= SYL.length) beginTurn();
      else tNext += chant.delays[lit];
    }

    function fakeOut() {
      lamps.forEach((l) => (l.className = l.className === 'on' ? 'fizz' : ''));
      head.classList.remove('fake');
      void head.offsetWidth;
      head.classList.add('fake');
      Arcade.audio.tone({ freq: 720, to: 260, type: 'triangle', dur: 0.22, vol: 0.2 });
      fx.floatText(bot, '가짜 예고!', { color: '#36d6ff', size: 22 });
      chant = makeChant(stageIdx, slow, false);
      lit = 0;
      tNext = 0.6 + chant.delays[0];
    }

    function beginTurn() {
      greedy = game.time - lastActive < 0.3;
      streak = 0;
      maxed = false;
      phaseLeft = grace;
      setLight('turn');
      sfx('whoosh');
      sfx('warn');
      Arcade.vibrate(40); // 돌아보는 동안에 끝나므로 센서 판정에 걸리지 않는다
    }

    function passRed() {
      // 충전하지 않고 서 있기만 한 예고는 통과로 세지 않는다
      if (roundGain >= 2) {
        const combo = game.addCombo();
        let bonus = 40 * Math.min(combo, 5);
        if (greedy) {
          sharp++;
          bonus += 120;
          fx.floatText(bot, '칼멈춤!', { color: '#ffd43b', size: 26 });
          sfx('coin');
        }
        game.addScore(bonus, call);
      }
      beginGreen();
    }

    function shock() {
      shocks++;
      game.resetCombo();
      const loss = Math.min(charge, SHOCK_LOSS);
      charge -= loss;
      phaseLeft = 1.2;
      setLight('stun');
      sfx('zap');
      Arcade.audio.noise({ dur: 0.35, freq: 2400, to: 500, vol: 0.25 });
      fx.flash('rgba(255, 233, 110, .35)');
      fx.burst(cell, { count: 10, emoji: '⚡', size: 11, spread: 120 });
      if (loss >= 1) fx.floatText(cell, `-${Math.round(loss)}%`, { color: '#ff5d73', size: 30 });
      fx.shake(batt, 10);
      fx.toast(mode === 'tap' ? '빨간불에 눌렀다! <b>감전</b>' : '움직였다! <b>감전</b>', { kind: 'bad', ms: 1000 });
      if (game.loseLife(bot) <= 0) {
        game.lose({
          title: '감전!',
          icon: '🤖',
          message: `${stageIdx + 1}번 배터리를 <b>${Math.floor(charge)}%</b>까지 채웠지만 하트를 모두 잃었어요.`,
          checkpoint: stageIdx,
        });
      }
    }

    function overheat() {
      lockLeft = HEAT.lock;
      streak = 0;
      maxed = false;
      wrap.classList.add('locked');
      paintCall();
      Arcade.audio.noise({ dur: 0.6, freq: 5000, to: 1200, vol: 0.2, filter: 'highpass' });
      sfx('miss');
      Arcade.vibrate(80);
      fx.toast('🔥 과열! 잠깐 식히자', { kind: 'bad', ms: 1100 });
    }

    function addCharge(gain) {
      charge = Math.min(100, charge + gain);
      roundGain += gain;
      if (charge > peak) {
        scoreCarry += (charge - peak) * 10;
        peak = charge;
        const whole = Math.floor(scoreCarry);
        if (whole > 0) {
          scoreCarry -= whole;
          game.setScore(game.score + whole);
        }
      }
    }

    function timeUp() {
      if (light === 'done') return;
      game.lose({
        title: '시간 초과!',
        icon: '🪫',
        message: `${stageIdx + 1}번 배터리를 <b>${Math.floor(charge)}%</b>까지 채웠어요.`,
        checkpoint: stageIdx,
      });
    }

    async function stageClear() {
      const left = stageTimer.left();
      game.stopTimer();
      leftSum += left;
      totalSum += stageTotal;
      lamps.forEach((l) => (l.className = ''));
      wrap.classList.remove('locked');
      lockLeft = 0;
      setLight('done');
      sfx('power');
      fx.confetti(30);
      fx.burst(cell, { count: 18, spread: 130, colors: ['#ffd43b', '#fff3c4', '#3ddc97'] });
      game.addScore(Math.round(left) * 20, cell);
      await game.wait(1000);
      if (stageIdx >= STAGES.length - 1) return finish();
      stageIdx++;
      runStage();
    }

    async function runStage() {
      charge = 0;
      peak = 0;
      heat = 0;
      lockLeft = 0;
      round = 0;
      lastFake = false;
      setLight('idle');
      game.setStage(stageIdx, STAGES.length);
      paintGoal();
      countEl.textContent = `${stageIdx + 1}/${STAGES.length}`;
      countBox.classList.toggle('ar-hidden', stageIdx === 2);
      heatBox.classList.toggle('ar-hidden', stageIdx !== 2);
      wrap.classList.toggle('heatmode', stageIdx === 2);
      const [title, sub] = STAGES[stageIdx].banner;
      await game.banner(title, sub, { ms: 1500 });
      if (mode === 'pending') {
        // 안내 띠가 떠 있는 동안 센서 이벤트가 한 번도 안 왔으면 버튼으로 바꾼다
        applyMode(sensorSeen > 0 ? 'sensor' : 'tap');
        if (mode === 'tap') fx.toast('흔들기 센서가 없어 <b>버튼 연타</b>로 충전해요', { ms: 2000 });
      }
      stageTimer = game.startTimer(stageTotal, { onEnd: timeUp, intensity: 0.15 + stageIdx * 0.2 });
      beginGreen();
    }

    function finish() {
      const ratio = leftSum / Math.max(1, totalSum);
      let stars = shocks === 0 && ratio >= 0.25 ? 3 : shocks <= 1 ? 2 : 1;
      if (game.retry > 0) stars = Math.min(stars, 2);
      game.win({
        stars,
        title: '발전소 가동!',
        message:
          stars === 3
            ? '한 번도 들키지 않았어요. 완벽해요!'
            : shocks === 0
              ? '한 번도 들키지 않았어요!'
              : '배터리 3개를 모두 채웠어요!',
        stats: [
          ['감전', `${shocks}번`],
          ['칼멈춤', `${sharp}번`],
          ['남은 시간', `${Math.round(leftSum)}초`],
          ['최대 콤보', `${game.maxCombo}`],
        ],
      });
    }

    // ----- 매 프레임
    const shown = { pct: -1, mult: '', zone: null };

    function paint(x, charging, strong) {
      const pct = Math.floor(charge + 1e-6);
      if (pct !== shown.pct) {
        shown.pct = pct;
        pctEl.textContent = pct + '%';
        fill.style.backgroundColor = `hsl(${Math.round(pct * 1.3)}, 85%, 52%)`; // 빨강 → 노랑 → 초록
      }
      fill.style.transform = `scaleY(${(charge / 100).toFixed(4)})`;
      const ramp = light === 'green' && lockLeft <= 0 ? 1 + clamp(streak / RAMP_SEC, 0, 1) : 1;
      const text = 'x' + (ramp * (charging && strong ? STRONG_BONUS : 1)).toFixed(1);
      if (text !== shown.mult) {
        shown.mult = text;
        multEl.textContent = text;
      }
      multBox.classList.toggle('up', ramp >= 1.5);
      multBox.classList.toggle('max', ramp >= 2);
      meterFill.style.transform = `scaleX(${clamp(x / METER_MAX, 0.001, 1).toFixed(3)})`;
      const zone = light === 'red' && x > STILL_MAX ? 'bad' : x >= STRONG ? 'hot' : x >= 1 ? 'ok' : '';
      if (zone !== shown.zone) {
        shown.zone = zone;
        meter.dataset.zone = zone;
      }
      heatFill.style.transform = `scaleY(${heat.toFixed(3)})`;
      wrap.classList.toggle('charging', charging);
      wrap.classList.toggle('hot', heat > 0.7 && lockLeft <= 0);
    }

    game.loop((dt) => {
      if (mode === 'sensor') {
        // 센서 이벤트가 끊기면 버튼 조작으로 바꾼다
        sinceEvent += dt;
        if (sinceEvent > 2) {
          applyMode('tap');
          fx.toast('센서가 멈춰서 <b>버튼 연타</b>로 바꿨어요', { ms: 2000 });
        }
      }
      const x = intensity();
      const moved = movement();
      const strong = x >= STRONG;
      let charging = false;

      if (light === 'green') {
        if (lockLeft <= 0 && x >= 1) {
          charging = true;
          idle = 0;
          streak += dt;
          lastActive = game.time;
          const ramp = 1 + clamp(streak / RAMP_SEC, 0, 1);
          addCharge(S.chargeRate * STAGE_RATE[stageIdx] * ramp * (strong ? STRONG_BONUS : 1) * dt);
          if (ramp >= 2 && !maxed) {
            maxed = true;
            sfx('bonus');
            const r = multEl.getBoundingClientRect();
            fx.floatText({ x: r.left + r.width / 2, y: r.top - 14 }, '최고 속도!', { color: '#ff9330', size: 18, rise: 40 });
          }
          if (mode !== 'tap') {
            blip += dt;
            if (blip >= 0.14) {
              blip = 0;
              chargeTone(strong);
              fx.burst(cell, { count: 2, spread: 60, size: 6, life: 420, colors: ['#ffd43b', '#fff3c4', '#ff9330'] });
            }
          }
          if (stageIdx === 2) {
            heat = Math.min(1, heat + (strong ? HEAT.strong : HEAT.normal) * dt);
            if (heat >= 1) overheat();
          }
          if (charge >= 100) {
            paint(x, false, strong);
            return stageClear();
          }
        } else {
          idle += dt;
          if (idle > 0.5) streak = 0; // 쉬면 충전 속도가 처음으로 돌아간다
        }
        tNext -= dt;
        if (tNext <= 0) advance();
      } else if (light === 'turn') {
        phaseLeft -= dt;
        if (phaseLeft <= 0) {
          phaseLeft = rand(RED_SEC[stageIdx][0], RED_SEC[stageIdx][1]);
          setLight('red');
          sfx('lock');
        }
      } else if (light === 'red') {
        // 센서: 손떨림보다 큰 움직임이면 감전. 버튼은 onTap 에서 판정한다
        if (moved > STILL_MAX && game.time >= immuneUntil) {
          shock();
          if (!game.playing) return;
        } else {
          phaseLeft -= dt;
          if (phaseLeft <= 0) passRed();
        }
      } else if (light === 'stun') {
        phaseLeft -= dt;
        if (phaseLeft <= 0) beginGreen();
      }

      if (lockLeft > 0) {
        lockLeft -= dt;
        heat = Math.max(0.3, heat - (0.7 / HEAT.lock) * dt);
        if (lockLeft <= 0) {
          lockLeft = 0;
          wrap.classList.remove('locked');
          paintCall();
          sfx('pick');
        }
      } else if (!charging) {
        heat = Math.max(0, heat - HEAT.cool * dt);
      }
      paint(light === 'green' ? x : moved, charging, strong);
    });

    // PC 에서는 스페이스바로도 충전. 센서가 달린 노트북이라면 스페이스바를 누르는 순간 버튼 조작으로 바꾼다
    game.on(window, 'keydown', (e) => {
      if (e.code !== 'Space' || e.repeat) return;
      if (mode === 'sensor' && game.playing) applyMode('tap');
      onTap(e);
    });
    const useSensor = motionOK && !forceTap && navigator.maxTouchPoints > 0; // 터치 화면이 없으면 폰이 아니다
    if (useSensor) game.on(window, 'devicemotion', onMotion);

    if (game.debug) {
      // 검증용: 상태를 보고, 세기를 직접 넣는다(null 이면 실제 입력으로 돌아간다)
      window.__game = {
        state: () => ({
          mode, light, lit, round, charge, heat, shocks, sharp, grace,
          stage: stageIdx,
          x: intensity(),
          moved: movement(),
          ramp: 1 + clamp(streak / RAMP_SEC, 0, 1),
          locked: lockLeft > 0,
          fakeAt: chant ? chant.fakeAt : 0,
          chantSec: chant ? chant.delays.reduce((a, b) => a + b, 0) : 0,
          timeLeft: game.timeLeft(),
        }),
        hold: (x) => (debugX = x),
        setMode: applyMode,
        settings: S,
        makeChant,
      };
    }

    applyMode(useSensor ? 'pending' : 'tap');
    runStage();
  }

  Arcade.createGame({
    id: GAME_ID,
    title: '에너지 충전',
    icon: '⚡',
    accent: '#ffd43b',
    accent2: '#ff9330',
    tagline: '무궁화 발전소: 로봇이 등을 돌린 사이에만 충전하라!',
    howTo: [
      '<b>초록불</b>에 폰을 흔들어 충전! (센서가 없으면 버튼 연타)',
      '<b>무궁화 꽃이 피었습니다</b>가 다 켜지면 로봇이 돌아본다. 딱 <b>멈춰!</b>',
      '쉬지 않고 흔들수록 <b>충전이 빨라진다</b>. 움직이다 들키면 감전!',
    ],
    lives: S.lives,
    stages: STAGES.length,
    async prepare() {
      if (!forceTap) motionOK = await Arcade.sensors.requestMotion();
    },
    start,
  });
})();
