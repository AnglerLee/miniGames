// 계산 레이스: 문제를 맞혀 달리고, 쉬지 않고 쫓아오는 라이벌보다 먼저 결승선을 지난다.
// 한 판은 3랩. 랩마다 연산이 바뀌고, 랩의 끝은 보스 문제가 막고 있다.
(function () {
  'use strict';

  const { h, pick, shuffle, clamp, sfx, fx } = Arcade;
  const R = Arcade.randInt;
  const GAME_ID = 'game07';

  // ----- 설정 (관리자 페이지와 같은 키, 같은 기본값)
  const PRESETS = [
    { rivalSpeed: 85, lapQuestions: 6, numberLevel: 1 },
    { rivalSpeed: 100, lapQuestions: 7, numberLevel: 2 },
    { rivalSpeed: 115, lapQuestions: 8, numberLevel: 3 },
  ];
  const LIMITS = { rivalSpeed: [50, 200], lapQuestions: [4, 12], numberLevel: [1, 3] };
  const saved = Arcade.loadSettings('math_race_settings', {});
  // 옛 설정의 difficulty 는 'level3' 같은 글자였다. 숫자로 읽히지 않으면 쉬움으로 시작한다
  const level = clamp(parseInt(saved.difficulty, 10) || 0, 0, 2);
  const S = Object.assign({}, PRESETS[level]);
  Object.keys(LIMITS).forEach((key) => {
    const raw = saved[key];
    const usable = typeof raw === 'number' || (typeof raw === 'string' && raw.trim() !== '');
    if (usable && Number.isFinite(Number(raw))) S[key] = clamp(Number(raw), LIMITS[key][0], LIMITS[key][1]);
  });
  S.lapQuestions = Math.round(S.lapQuestions);
  S.numberLevel = Math.round(S.numberLevel);

  // ----- 경주 규칙
  const LAP_M = 100; // 한 랩의 길이(m)
  const GATE_M = 75; // 보스 관문의 위치. 보스 문제를 맞히면 여기서 결승선까지 한 번에 간다
  const HEAD_START_MAX = 15; // 앞 랩에서 벌린 거리 가운데 다음 랩으로 가져가는 최대치(m)
  const SPEED_BONUS = 0.5; // 바로 맞히면 전진 거리가 이만큼 늘어난다
  const TURBO_AT = 3; // 연속 정답이 이만큼 쌓이면 터보 장전
  const SLIP = [0.35, 0.6, 0.85]; // 오답으로 밀려나는 거리(기본 전진 거리의 배수). 연달아 틀리면 커진다
  const LOCK_MS = [800, 1100, 1400]; // 오답 뒤 입력이 잠기는 시간
  const NEXT_MS = 250; // 정답 뒤 다음 문제까지
  const SPURT = { warn: 1.2, sec: 2.2, mult: 2.2 }; // 라이벌 스퍼트: 예고 시간, 길이, 속도 배수
  const BAND = 0.3; // 고무줄 세기
  const RIVAL_PACE = 0.95; // 라이벌이 한 랩을 도는 시간 = 문제들의 기준 시간 합 x 이 값
  const RETRY_EASE = 0.12; // 재도전 한 번마다 라이벌이 느려지는 정도
  const RETRY_MAX = 6;
  const BOSS_PAR = 1.7; // 보스 문제는 기준 시간을 이만큼 더 준다
  // 문제 하나의 기준 시간(초). 수의 범위 1~3단계 순서. 속도 보너스 막대의 길이이기도 하다
  const PAR = { addsub: [5, 7, 9], mul: [4, 4.5, 7], mix: [5, 6, 8] };
  const LAPS = [
    { kind: 'addsub', spurts: 1, pace: 1.08, title: '1랩 · 덧셈과 뺄셈', sub: '라이벌보다 먼저 결승선으로!', goal: '<b>1랩</b> 덧셈·뺄셈 · 라이벌보다 먼저!' },
    { kind: 'mul', spurts: 2, pace: 1, title: '2랩 · 곱셈', sub: '라이벌이 스퍼트를 두 번 낸다', goal: '<b>2랩</b> 곱셈 · 스퍼트를 조심해!' },
    { kind: 'mix', spurts: 2, pace: 1, title: '마지막 랩 · 빈칸 채우기', sub: '빈칸에 들어갈 수를 찾아라', goal: '<b>마지막 랩</b> 빈칸에 들어갈 수는?' },
  ];

  // 옆에서 본 경주차(오른쪽을 본다). 색은 CSS 의 color 로 정한다
  const CAR_SVG =
    '<svg viewBox="0 0 46 24" aria-hidden="true">' +
    '<rect x="0" y="3" width="9" height="3" rx="1.5" fill="currentColor"/><rect x="2" y="4" width="3" height="9" fill="currentColor"/>' +
    '<path d="M3 17Q3 11 9 11L18 11Q21 5 28 5L31 5Q35 5 37 11L42 13Q45 14 45 17L45 18Q45 19 44 19L4 19Q3 19 3 18Z" fill="currentColor"/>' +
    '<path d="M22 11Q24 7 28 7L31 7Q33 7 34.5 11Z" fill="#d9f1ff"/>' +
    '<rect x="8" y="14" width="31" height="2" rx="1" fill="rgba(255,255,255,.6)"/>' +
    '<circle cx="12" cy="19" r="4.3" fill="#10142e"/><circle cx="12" cy="19" r="1.7" fill="#c5cdf0"/>' +
    '<circle cx="35" cy="19" r="4.3" fill="#10142e"/><circle cx="35" cy="19" r="1.7" fill="#c5cdf0"/>' +
    '</svg>';

  // ------------------------------------------------------------ 문제 만들기 (순수 함수)
  /**
   * 식 하나. parts 의 null 이 채워야 할 빈칸이다. 빈칸이 없으면 끝에 "= □" 를 붙인다.
   * traps 는 이 문제에서 나오기 쉬운 실수값들, other 는 연산을 잘못 봤을 때의 값이다.
   */
  function expr(parts, answer, traps, other) {
    return { parts: parts.includes(null) ? parts : parts.concat('=', null), answer, traps: traps || [], other };
  }

  /** 끝 두 자리를 뒤바꾼 수. 바꿔도 같거나 자릿수가 줄면 null */
  function swapDigits(n) {
    const s = String(n);
    if (s.length < 2) return null;
    const v = Number(s.slice(0, -2) + s[s.length - 1] + s[s.length - 2]);
    return v === n || String(v).length !== s.length ? null : v;
  }

  /** 정답 하나와 오답 셋. 오답은 아무 수가 아니라 흔한 실수값에서 고른다 */
  function buildOptions(answer, traps, other) {
    const usable = (list) => Array.from(new Set(list.filter((v) => Number.isInteger(v) && v > 0 && v !== answer)));
    const special = shuffle(usable(traps));
    // 어디서나 나오는 실수: 하나 차이, 받아올림·받아내림(10 차이), 자릿수 뒤바뀜
    const common = shuffle(
      usable(answer < 13 ? [answer + 1, answer - 1, answer + 2, answer - 2] : [answer + 1, answer - 1, answer + 10, answer - 10, swapDigits(answer)])
    );
    const wrong = [];
    const take = (v) => {
      if (wrong.length < 3 && !wrong.includes(v)) wrong.push(v);
    };
    if (Math.random() < 0.4) usable([other]).forEach(take);
    special.slice(0, 2).forEach(take);
    common.forEach(take);
    special.forEach(take);
    for (let d = 2; wrong.length < 3; d++) usable([answer + d, answer - d]).forEach(take);
    return shuffle([answer, ...wrong]);
  }

  function genAdd(lv) {
    let [a, b] = lv === 1 ? [R(11, 49), R(2, 9)] : lv === 2 ? [R(12, 69), R(12, 39)] : [R(26, 99), R(26, 99)];
    if (Math.random() < 0.5) [a, b] = [b, a];
    return expr([a, '+', b], a + b, [], Math.abs(a - b));
  }

  function genSub(lv) {
    const a = lv === 1 ? R(12, 49) : lv === 2 ? R(31, 99) : R(101, 199);
    const b = lv === 1 ? R(2, 9) : lv === 2 ? R(12, a - 9) : R(26, 99);
    // 자리마다 큰 수에서 작은 수를 빼 버리는 실수 (52 − 38 = 26)
    const columns = a < 100 ? Math.abs(Math.floor(a / 10) - Math.floor(b / 10)) * 10 + Math.abs((a % 10) - (b % 10)) : null;
    return expr([a, '−', b], a - b, [columns], a + b);
  }

  function genMul(lv) {
    let a, b;
    if (lv === 1) [a, b] = [R(2, 5), R(2, 9)];
    else if (lv === 2) [a, b] = [R(2, 9), R(3, 9)];
    else if (Math.random() < 0.5) [a, b] = [R(6, 12), R(6, 12)];
    else [a, b] = [R(12, 25), R(3, 9)];
    if (Math.random() < 0.5) [a, b] = [b, a];
    return expr([a, '×', b], a * b, [a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b], a + b);
  }

  function genDiv(lv) {
    const b = lv === 3 ? R(3, 12) : R(2, 9);
    const q = lv === 3 ? R(3, 12) : R(2, 9);
    return expr([b * q, '÷', b], q, [b]);
  }

  /** 빈칸 채우기: 7 × □ = 42 */
  function genBlank(lv) {
    const type = pick(lv === 1 ? ['add', 'add', 'mul'] : ['add', 'sub', 'mul', 'mul', 'div']);
    const big = () => (lv === 1 ? R(2, 9) : lv === 2 ? R(11, 49) : R(15, 89));
    const small = () => (lv === 3 ? R(3, 12) : R(2, 9));
    if (type === 'add') {
      const x = big();
      const b = big();
      return expr(Math.random() < 0.5 ? [null, '+', b, '=', x + b] : [b, '+', null, '=', x + b], x, [], x + b + b);
    }
    if (type === 'sub') {
      const x = big();
      const c = big();
      return expr([x + c, '−', null, '=', c], x, [], x + c + c);
    }
    const x = small();
    const a = lv === 1 ? R(2, 5) : small();
    if (type === 'mul') return expr(Math.random() < 0.5 ? [a, '×', null, '=', a * x] : [null, '×', a, '=', a * x], x, [a]);
    return expr([a * x, '÷', null, '=', a], x, [a]);
  }

  function genMix(lv) {
    const roll = Math.random();
    if (roll < 0.55) return genBlank(lv);
    if (lv === 1) return roll < 0.8 ? genMul(lv) : pick([genAdd, genSub])(lv);
    return roll < 0.8 ? genDiv(lv) : pick([genAdd, genSub, genMul])(lv);
  }

  /** 랩의 끝을 막는 보스 문제. 그 랩의 문제보다 한 단계 어렵다 */
  function genBoss(kind, lv) {
    if (kind === 'addsub') {
      if (lv === 1) {
        const [a, b] = [R(14, 48), R(13, 48)];
        return expr([a, '+', b], a + b, [], Math.abs(a - b));
      }
      const a = lv === 2 ? R(31, 69) : R(101, 189);
      const b = lv === 2 ? R(12, 39) : R(26, 89);
      const c = lv === 2 ? R(11, 29) : R(26, 89);
      if (Math.random() < 0.5) return expr([a, '+', b, '−', c], a + b - c, [a + b], a + b + c);
      return expr([a, '−', c, '+', b], a - c + b, [a - c], a - c - b);
    }
    if (kind === 'mul') {
      if (lv === 1) {
        const [a, b] = [R(6, 9), R(3, 9)];
        return expr([a, '×', b], a * b, [a * (b + 1), a * (b - 1), (a - 1) * b], a + b);
      }
      let a = lv === 2 ? R(11, 19) : R(21, 49);
      if (a % 10 === 0) a += 3;
      const b = R(3, 9);
      // 일의 자리를 곱하지 않고 그냥 더한 실수 (14 × 6 = 64)
      return expr([a, '×', b], a * b, [a * (b + 1), a * (b - 1), (a - (a % 10)) * b + (a % 10), (a + 1) * b]);
    }
    if (lv === 3) {
      const [a, b, c, d] = [R(4, 9), R(4, 9), R(3, 9), R(3, 9)];
      return expr([a, '×', b, '+', c, '×', d], a * b + c * d, [a * b + c + d, a * (b + 1) + c * d, a * b + c * (d - 1)]);
    }
    const [a, b] = lv === 1 ? [R(2, 5), R(2, 9)] : [R(3, 9), R(3, 9)];
    const c = lv === 1 ? R(2, 9) : R(11, 39);
    // 곱셈보다 덧셈을 먼저 해 버리는 실수(3 × 6 + 4 = 30)는 수가 작을 때만 그럴듯하다
    if (a * b - c >= 2 && Math.random() < 0.5) return expr([a, '×', b, '−', c], a * b - c, [a * b], a * b + c);
    return expr([a, '×', b, '+', c], a * b + c, lv === 1 ? [a * (b + c), a * b] : [a * b], a * b - c);
  }

  /** 문제 하나. kind 는 랩의 연산('addsub' | 'mul' | 'mix'), lv 는 수의 범위(1~3) */
  function makeQuestion(kind, lv, boss) {
    const e = boss
      ? genBoss(kind, lv)
      : kind === 'addsub'
        ? pick([genAdd, genSub])(lv)
        : kind === 'mul'
          ? genMul(lv)
          : genMix(lv);
    return {
      parts: e.parts,
      answer: e.answer,
      options: buildOptions(e.answer, e.traps, e.other),
      boss: !!boss,
      par: PAR[kind][lv - 1] * (boss ? BOSS_PAR : 1),
      key: e.parts.join(' '),
    };
  }

  // ------------------------------------------------------------ 라이벌
  /** 라이벌의 한 랩 계획: 기본 속도(m/초)와 스퍼트를 시작할 시각(초) */
  function rivalPlan(lapIdx, retry) {
    const lap = LAPS[lapIdx];
    const par = PAR[lap.kind][S.numberLevel - 1];
    const ease = 1 + RETRY_EASE * Math.min(retry, RETRY_MAX);
    const time = (RIVAL_PACE * lap.pace * par * (S.lapQuestions - 1 + BOSS_PAR) * ease) / (S.rivalSpeed / 100);
    // 스퍼트로 더 가는 거리까지 합쳐서 time 초에 한 랩을 돈다
    const speed = LAP_M / (time + lap.spurts * SPURT.sec * (SPURT.mult - 1));
    const spurts = [];
    for (let i = 0; i < lap.spurts; i++) spurts.push(time * ((i + 1) / (lap.spurts + 1) + Arcade.rand(-0.06, 0.06)));
    return { time, speed, spurts };
  }

  /** 고무줄: 라이벌은 크게 뒤지면 힘을 내고, 크게 앞서면 숨을 고른다. lead 는 내가 앞선 거리(m) */
  function band(lead) {
    if (lead >= 10) return 1 + Math.min(BAND, ((lead - 10) / 20) * BAND);
    if (lead <= -5) return 1 - Math.min(BAND, ((-5 - lead) / 15) * BAND);
    return 1;
  }

  // ------------------------------------------------------------ 한 판
  function start(game) {
    const lv = S.numberLevel;
    const step = GATE_M / (S.lapQuestions - 1); // 정답 한 번의 기본 전진 거리(m)
    let lapIdx = game.checkpoint;
    let me = 0; // 이번 랩에서 달린 거리(m)
    let rival = 0; // 라이벌이 달린 거리(m). 뒤에서 출발하면 음수
    let racing = false; // 라이벌이 달리고 있는가
    let accepting = false; // 답을 받을 수 있는가
    let plan = null;
    let lapClock = 0;
    let spurt = 'off'; // off | warn | on
    let spurtIdx = 0;
    let q = null;
    let qElapsed = 0;
    let lastKey = '';
    let buttons = new Map();
    let streak = 0; // 연속 정답 (터보를 쓰면 0 으로 돌아간다)
    let turbo = false;
    let missStreak = 0;
    let bossSeen = false;
    let turboTold = false;
    let wasBehind = false;
    let dangerTold = false;
    let finalGap = 0;
    const tally = { asked: 0, correct: 0, wrong: 0, run: 0, bestRun: 0, solveSec: 0 };

    // ----- 화면: 위는 트랙, 가운데는 문제, 아래는 보기
    const gapChip = h('div', { class: 'mr-gap' });
    const leftChip = h('div', { class: 'mr-left' });
    const alertChip = h('div', { class: 'mr-alert ar-hidden' });
    const makeCar = (cls, tag) =>
      h('div', { class: 'mr-car ' + cls }, [
        h('i', { class: 'mr-flame' }),
        h('div', { class: 'mr-body', html: CAR_SVG }),
        h('span', { class: 'mr-tag', text: tag }),
      ]);
    const meCar = makeCar('me', '나');
    const rivalCar = makeCar('rival', '라이벌');
    const gate = h('div', { class: 'mr-gate' }, h('span', { text: '👑' }));
    const startLine = h('div', { class: 'mr-startline' });
    const marks = [25, 50].map((m) => ({ m, el: h('i', { class: 'mr-mark' }) }));
    const road = h('div', { class: 'mr-road' }, [
      ...marks.map((k) => k.el),
      startLine,
      h('div', { class: 'mr-finish' }),
      h('div', { class: 'mr-lane' }, rivalCar),
      h('div', { class: 'mr-lane' }, [gate, meCar]),
    ]);
    const track = h('div', { class: 'mr-track' }, [h('div', { class: 'mr-status' }, [gapChip, leftChip, alertChip]), road]);

    const turboPips = [0, 1, 2].map(() => h('i'));
    const turboLabel = h('span', { text: '터보' });
    const turboBox = h('div', { class: 'mr-turbo' }, [turboLabel, ...turboPips]);
    const bossBadge = h('div', { class: 'mr-boss ar-hidden', text: '👑 보스 문제' });
    const exprEl = h('div', { class: 'mr-expr' });
    const bonusFill = h('i');
    const bonusBox = h('div', { class: 'mr-bonus' }, [h('span', { text: '⚡ 속도 보너스' }), h('div', { class: 'bar' }, bonusFill)]);
    const card = h('div', { class: 'mr-card' }, [h('div', { class: 'mr-top' }, [turboBox, bossBadge]), exprEl, bonusBox]);
    const answers = h('div', { class: 'mr-answers' });
    game.app.classList.remove('mr-paused');
    game.root.append(track, card);
    game.footer.append(answers);

    // ----- 트랙 그리기
    const FINISH_PAD = 24; // 결승선에서 트랙 오른쪽 끝까지(px)
    let shownLead = null;
    let shownLeft = null;

    function place() {
      const carW = meCar.offsetWidth;
      const startX = carW + 10; // 출발선의 위치(px). 차의 앞머리가 기준이다
      const span = road.clientWidth - FINISH_PAD - startX;
      const toX = (m) => startX + (clamp(m, -HEAD_START_MAX - 4, LAP_M + 14) / LAP_M) * span;
      meCar.style.transform = `translateX(${(toX(me) - carW).toFixed(1)}px)`;
      rivalCar.style.transform = `translateX(${(toX(rival) - carW).toFixed(1)}px)`;
      gate.style.left = toX(GATE_M) + 2 + 'px';
      startLine.style.left = startX + 'px';
      marks.forEach((k) => (k.el.style.left = toX(k.m) + 'px'));

      // 글자는 값이 바뀔 때만 다시 쓴다
      const lead = Math.round(Math.min(me, LAP_M) - Math.min(rival, LAP_M));
      if (lead !== shownLead) {
        shownLead = lead;
        gapChip.textContent = lead > 0 ? `▲ ${lead}m 앞서는 중` : lead < 0 ? `▼ ${-lead}m 뒤처짐` : '나란히 달리는 중';
        gapChip.className = 'mr-gap ' + (lead > 0 ? 'lead' : lead < 0 ? 'behind' : '');
      }
      const left = clamp(Math.round(LAP_M - me), 0, LAP_M);
      if (left !== shownLeft) {
        shownLeft = left;
        leftChip.textContent = left > 0 ? `🏁 ${left}m 남음` : '🏁 골인!';
      }
    }

    /** 차를 움직임 없이 한 번에 옮긴다 (랩을 새로 시작할 때) */
    function jump() {
      [meCar, rivalCar].forEach((c) => c.classList.add('jump'));
      place();
      void road.offsetWidth;
      [meCar, rivalCar].forEach((c) => c.classList.remove('jump'));
    }

    function paintTurbo() {
      turboPips.forEach((p, i) => p.classList.toggle('on', turbo || i < streak));
      turboBox.classList.toggle('armed', turbo);
      turboLabel.textContent = turbo ? '🔥 터보 준비!' : '터보';
      meCar.classList.toggle('turbo', turbo);
    }

    function setSpurt(state, quiet) {
      spurt = state;
      rivalCar.classList.toggle('warn', state === 'warn');
      rivalCar.classList.toggle('spurt', state === 'on');
      alertChip.classList.toggle('ar-hidden', state === 'off');
      alertChip.classList.toggle('on', state === 'on');
      leftChip.classList.toggle('ar-hidden', state !== 'off');
      if (quiet) return;
      if (state === 'warn') {
        alertChip.textContent = '⚡ 라이벌 스퍼트 예고';
        sfx('warn');
      } else if (state === 'on') {
        alertChip.textContent = '⚡ 라이벌 스퍼트!';
        sfx('whoosh');
        Arcade.vibrate(40);
      }
    }

    function setMusic() {
      const close = me - rival < 5 ? 0.25 : 0;
      const late = rival > 70 ? 0.25 : 0;
      Arcade.audio.music.setIntensity(0.2 + lapIdx * 0.12 + close + late + (spurt === 'on' ? 0.15 : 0));
    }

    // ----- 문제
    function nextQuestion() {
      if (!racing) return;
      const boss = me >= GATE_M - 0.01;
      do {
        q = makeQuestion(LAPS[lapIdx].kind, lv, boss);
      } while (q.key === lastKey);
      lastKey = q.key;
      qElapsed = 0;
      tally.asked++;

      exprEl.innerHTML = '';
      q.parts.forEach((p) => {
        const cls = p === null ? 'blank' : typeof p === 'string' ? 'op' : '';
        exprEl.appendChild(h('span', { class: cls, text: p === null ? '?' : String(p) }));
      });
      // 긴 식은 카드 안에 들어오도록 글자를 줄인다
      exprEl.style.fontSize = '';
      const room = card.clientWidth - 32;
      if (exprEl.scrollWidth > room) {
        exprEl.style.fontSize = Math.floor((parseFloat(getComputedStyle(exprEl).fontSize) * room) / exprEl.scrollWidth) + 'px';
      }

      answers.innerHTML = '';
      buttons = new Map();
      q.options.forEach((value) => {
        const btn = h('button', { class: 'ar-btn', text: String(value) });
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          answer(value);
        });
        buttons.set(value, btn);
        answers.appendChild(btn);
      });

      card.classList.remove('in', 'right', 'wrong');
      card.classList.toggle('boss', boss);
      bossBadge.classList.toggle('ar-hidden', !boss);
      void card.offsetWidth;
      card.classList.add('in');
      bonusFill.style.transform = 'scaleX(1)';
      bonusBox.classList.remove('empty');
      if (boss && !bossSeen) {
        bossSeen = true;
        gate.classList.add('active');
        sfx('lock');
        fx.toast('👑 보스 문제! 맞히면 바로 골인', { kind: 'gold', ms: 1400 });
      } else {
        sfx('flip');
      }
      accepting = true;
    }

    function answer(value) {
      if (!accepting || !game.playing) return;
      accepting = false;
      const right = value === q.answer;
      buttons.forEach((btn, v) => btn.classList.add(v === q.answer ? 'right' : v === value ? 'wrong' : 'dim'));
      if (right) onRight(buttons.get(value));
      else onWrong(buttons.get(value));
      paintTurbo();
    }

    function onRight(btn) {
      const bonus = clamp(1 - qElapsed / q.par, 0, 1);
      const behindBefore = me < rival;
      tally.correct++;
      tally.solveSec += qElapsed;
      tally.run++;
      tally.bestRun = Math.max(tally.bestRun, tally.run);
      streak++;
      missStreak = 0;
      card.classList.add('right');

      if (q.boss) {
        game.addScore(300 + Math.round(100 * bonus), btn);
        gate.classList.add('open');
        if (streak >= TURBO_AT) turbo = true;
        fx.floatText(meCar, '관문 돌파!', { color: '#ffd166', size: 22 });
        return lapDone();
      }

      const usedTurbo = turbo;
      const before = me;
      me = Math.min(GATE_M, me + step * (1 + SPEED_BONUS * bonus) * (usedTurbo ? 2 : 1));
      game.addScore((100 + Math.round(50 * bonus)) * (usedTurbo ? 2 : 1), btn);
      const moved = `+${Math.round(me - before)}m`;
      if (usedTurbo) {
        // 터보를 쓰면 다시 3연속을 모아야 한다
        turbo = false;
        streak = 0;
        sfx('power');
        fx.flash('rgba(255,180,70,.28)');
        fx.burst(meCar, { emoji: ['🔥', '💨'], count: 8, spread: 60, size: 9 });
        fx.floatText(meCar, `터보! ${moved}`, { color: '#ffb347', size: 24 });
        Arcade.vibrate(60);
      } else {
        sfx('combo', tally.run); // 연속으로 맞힐수록 음이 올라간다
        fx.floatText(meCar, behindBefore && me >= rival ? `역전! ${moved}` : moved, { color: bonus > 0.5 ? '#ffd166' : '#fff', size: 20 });
        if (streak >= TURBO_AT) {
          turbo = true;
          sfx('bonus');
          if (!turboTold) fx.toast('🔥 터보 준비! 다음 정답은 2배', { kind: 'gold', ms: 1300 });
          turboTold = true;
        }
      }
      game.after(NEXT_MS, nextQuestion);
    }

    function onWrong(btn) {
      const k = Math.min(missStreak, SLIP.length - 1);
      const back = Math.min(me, step * SLIP[k]);
      tally.wrong++;
      tally.run = 0;
      missStreak++;
      streak = 0;
      turbo = false;
      me -= back;
      game.addScore(-50, btn);
      card.classList.add('wrong');
      meCar.classList.add('slip');
      sfx('bad');
      Arcade.audio.noise({ dur: 0.35, freq: 2200, to: 500, vol: 0.12 }); // 타이어 미끄러지는 소리
      Arcade.vibrate(120);
      fx.shake(track, 8);
      fx.floatText(meCar, back >= 1 ? `미끄덩! −${Math.round(back)}m` : '미끄덩!', { color: '#ff5d73', size: 20 });
      game.after(LOCK_MS[k], () => {
        meCar.classList.remove('slip');
        nextQuestion();
      });
    }

    // ----- 랩의 시작과 끝
    async function startLap(headStart) {
      const lap = LAPS[lapIdx];
      plan = rivalPlan(lapIdx, game.retry);
      me = 0;
      rival = -headStart;
      lapClock = 0;
      spurtIdx = 0;
      bossSeen = false;
      wasBehind = false;
      dangerTold = false;
      setSpurt('off', true);
      gate.classList.remove('active', 'open');
      track.classList.remove('danger');
      jump();
      game.setStage(lapIdx, LAPS.length);
      game.setGoal(lap.goal);
      exprEl.innerHTML = '';
      answers.innerHTML = '';
      card.classList.remove('boss', 'right', 'wrong');
      bossBadge.classList.add('ar-hidden');
      paintTurbo();
      setMusic();
      await game.banner(lap.title, lap.sub, { ms: 1500 });
      if (headStart >= 1) fx.floatText(meCar, `${Math.round(headStart)}m 앞에서 출발!`, { color: '#3ddc97', size: 18 });
      racing = true;
      nextQuestion();
    }

    function lapDone() {
      racing = false;
      finalGap = LAP_M - rival; // 결승선을 지날 때 라이벌과의 거리
      me = LAP_M + 14; // 결승선을 시원하게 지나간다
      setSpurt('off', true);
      track.classList.remove('danger');
      sfx('stage');
      fx.confetti(30);
      game.addScore(200 + Math.round(Math.min(finalGap, 50)) * 10, road);
      if (lapIdx >= LAPS.length - 1) return game.after(900, finish);
      game.after(900, () => {
        lapIdx++;
        startLap(Math.min(HEAD_START_MAX, finalGap));
      });
    }

    function rivalWins() {
      racing = false;
      accepting = false;
      rival = LAP_M + 14;
      setSpurt('off', true);
      const left = Math.max(1, Math.round(LAP_M - me));
      sfx('zap');
      fx.shake(track, 10);
      game.after(700, () =>
        game.lose({
          icon: '🏁',
          title: '라이벌이 먼저 들어왔다!',
          message: `${lapIdx + 1}랩에서 <b>${left}m</b>를 남기고 졌어요.<br>다시 하면 라이벌이 조금 느려져요.`,
          checkpoint: lapIdx,
        })
      );
    }

    function finish() {
      const gap = Math.round(finalGap);
      let stars = tally.wrong <= 1 && gap >= 30 ? 3 : tally.wrong <= 4 && gap >= 10 ? 2 : 1;
      if (game.retry > 0) stars = Math.min(stars, 2);
      game.win({
        stars,
        title: '우승!',
        message: stars === 3 ? '라이벌을 멀찍이 따돌렸어요. 완벽한 레이스!' : '별 3개: 오답 1개 이하, 30m 넘게 앞서서 골인',
        stats: [
          ['결승선에서 앞선 거리', `${gap}m`],
          ['정답', `${tally.correct} / ${tally.asked}`],
          ['최대 연속 정답', `${tally.bestRun}`],
          ['평균 풀이 시간', `${(tally.solveSec / Math.max(1, tally.correct)).toFixed(1)}초`],
        ],
      });
    }

    // ----- 매 프레임: 라이벌이 달리고, 속도 보너스가 줄어든다
    game.loop((dt) => {
      if (racing) {
        lapClock += dt;
        const at = plan.spurts[spurtIdx];
        if (spurt === 'off' && at !== undefined && lapClock >= at - SPURT.warn) setSpurt('warn');
        else if (spurt === 'warn' && lapClock >= at) setSpurt('on');
        else if (spurt === 'on' && lapClock >= at + SPURT.sec) {
          spurtIdx++;
          setSpurt('off');
        }
        rival += plan.speed * (spurt === 'on' ? SPURT.mult : 1) * band(me - rival) * dt;

        if (accepting) {
          qElapsed += dt;
          const k = clamp(1 - qElapsed / q.par, 0, 1);
          bonusFill.style.transform = `scaleX(${k})`;
          bonusBox.classList.toggle('empty', k <= 0);
        }

        // 추월당하는 순간과 라이벌이 결승선에 다가오는 순간을 알린다
        const behind = me < rival;
        if (behind && !wasBehind && me > 0) {
          fx.floatText(rivalCar, '추월!', { color: '#ff5d73', size: 18 });
          Arcade.audio.tone({ freq: 300, to: 200, type: 'triangle', dur: 0.14, vol: 0.12 });
        }
        wasBehind = behind;
        if (rival >= 80 && !dangerTold) {
          dangerTold = true;
          track.classList.add('danger');
          sfx('warn');
        }
        setMusic();
        if (rival >= LAP_M) rivalWins();
      }
      place();
    });

    // PC 에서는 숫자 키 1~4 로도 고를 수 있다
    game.on(window, 'keydown', (e) => {
      const i = ['1', '2', '3', '4'].indexOf(e.key);
      if (i >= 0 && q && q.options[i] !== undefined) answer(q.options[i]);
    });

    if (game.debug) {
      // 검증용 창구
      window.__game = {
        state: () => ({ lap: lapIdx, me, rival, racing, accepting, streak, turbo, spurt, missStreak, step, plan, tally: Object.assign({}, tally) }),
        question: () => q,
        accepting: () => accepting,
        answerRight: () => answer(q.answer),
        answerWrong: () => answer(q.options.find((o) => o !== q.answer)),
        makeQuestion,
        settings: S,
      };
    }

    startLap(0);
  }

  Arcade.createGame({
    id: GAME_ID,
    title: '계산 레이스',
    icon: '🏎️',
    accent: '#ff9330',
    accent2: '#ffd43b',
    tagline: '문제를 풀어 달려라. 라이벌이 바짝 쫓아온다!',
    howTo: [
      '정답이면 내 차가 전진! <b>빨리 맞힐수록 더 멀리</b>',
      '<b>3연속 정답</b>이면 터보, 다음 정답은 <b>2배</b> 전진',
      '틀리면 미끄러진다. <b>라이벌보다 먼저</b> 결승선으로!',
    ],
    stages: LAPS.length,
    start,
    onPause: (game) => game.app.classList.add('mr-paused'),
    onResume: (game) => game.app.classList.remove('mr-paused'),
  });
})();
