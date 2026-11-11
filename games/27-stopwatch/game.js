// 타임 스나이퍼: 속으로 초를 세다가 목표 시각에 딱 멈춘다
// 스테이지마다 시계를 덜 믿을 수 있게 된다: 보이는 시계 → 사라지는 시계 → 거짓말하는 시계.
(function () {
  'use strict';

  const { h, pick, rand, randInt, clamp, lerp, sfx, fx } = Arcade;
  const GAME_ID = 'game27';

  // ----- 설정 (관리자 페이지와 같은 키를 쓴다)
  const PRESETS = [
    { rounds: 2, lives: 3, maxTarget: 6, perfect: 0.07, great: 0.18, good: 0.35, blindAt: 2.5, tick: 'all' },
    { rounds: 2, lives: 3, maxTarget: 8, perfect: 0.05, great: 0.15, good: 0.3, blindAt: 2, tick: 'start' },
    { rounds: 3, lives: 3, maxTarget: 10, perfect: 0.04, great: 0.1, good: 0.22, blindAt: 1.5, tick: 'off' },
  ];
  const saved = Arcade.loadSettings('stopwatch_settings', {});
  const level = clamp(parseInt(saved.difficulty, 10) || 0, 0, 2);
  const S = Object.assign({}, PRESETS[level]);
  ['rounds', 'lives', 'maxTarget', 'perfect', 'great', 'good', 'blindAt'].forEach((key) => {
    const v = Number(saved[key]);
    if (Number.isFinite(v) && v > 0) S[key] = v;
  });
  if (['all', 'start', 'off'].includes(saved.tick)) S.tick = saved.tick;
  S.rounds = clamp(Math.round(S.rounds), 1, 4);
  S.lives = clamp(Math.round(S.lives), 1, 5);
  S.maxTarget = clamp(Math.round(S.maxTarget), 4, 15);
  S.blindAt = clamp(S.blindAt, 0.5, 5);
  // 판정 폭은 좁은 것부터 차례로 쓴다 (거꾸로 저장돼 있어도 돌아가게)
  [S.perfect, S.great, S.good] = [S.perfect, S.great, S.good].sort((a, b) => a - b);

  const MIN_TARGET = 3;
  const MIN_RUN = 0.6; // 시작 직후의 정지는 실수로 두 번 누른 것으로 본다
  const OVERTIME = 3; // 목표를 이만큼 넘기면 자동으로 멈춘다
  const TICK_START = 2; // 박자 소리 '처음만'일 때 들려주는 횟수
  const POINTS = { perfect: 500, great: 300, good: 120 };
  const STAGE_BONUS = 200;
  const LABEL = { perfect: 'PERFECT!', great: 'GREAT!', good: 'GOOD', miss: 'MISS' };
  const EPS = 1e-9;

  const num = (v) => String(Math.round(v * 10) / 10);

  const STAGES = [
    { goal: '시계를 보고 <b>목표 시간</b>에 딱 멈춰라', banner: ['스테이지 1', '보이는 시계로 감을 잡아라'] },
    { goal: '시계가 <b>사라진다!</b> 속으로 세어라', banner: ['스테이지 2', '시계가 도중에 사라진다!'] },
    { goal: '시계가 <b>거짓말</b>을 한다. 네 감각을 믿어라', banner: ['마지막 스테이지', '거짓말하는 시계'] },
  ];

  // 3스테이지에서 라운드 순서대로 쓰는 거짓말 조합 (난이도별)
  //   rate 가짜 시계의 빠르기, strobe 뚝뚝 끊김, reverse 거꾸로, heckler 방해꾼, hide 도중에 사라짐
  const LIES = [
    [{ strobe: true }, { rate: 2 }],
    [{ rate: 1.5 }, { rate: 0.5, heckler: true }, { reverse: true, strobe: true }],
    [{ rate: 1.3, heckler: true }, { reverse: true, strobe: true, heckler: true }, { rate: 0.7, heckler: true, hide: true }],
  ];
  const SHOUTS = ['지금이야!', '아직 멀었어~', '늦었어!', '멈춰!', '벌써 지났어!', '하나, 둘…'];

  /** 라운드 하나의 조건을 만든다. used 는 이미 나온 목표 시간들. */
  function makeRound(stageIdx, roundIdx, used) {
    const r = { rate: 1, strobe: false, reverse: false, heckler: false, blindAt: null, bet: false };
    if (stageIdx === 1) r.blindAt = S.blindAt;
    if (stageIdx === 2) {
      const lie = LIES[level][roundIdx % LIES[level].length];
      Object.assign(r, lie);
      if (lie.hide) r.blindAt = S.blindAt + 1;
    }
    const hi = stageIdx === 0 ? Math.min(S.maxTarget, 5) : S.maxTarget;
    let lo = MIN_TARGET;
    // 시계가 사라진 뒤에도 셀 시간이 남아야 한다
    if (r.blindAt !== null) lo = Math.min(hi, Math.max(lo, Math.ceil(r.blindAt + 1.5)));
    const step = stageIdx === 2 && level >= 1 ? 0.5 : 1;
    const all = [];
    for (let t = lo; t <= hi + EPS; t += step) all.push(t);
    const fresh = all.filter((t) => !used.includes(t));
    r.target = pick(fresh.length ? fresh : all);
    if (r.blindAt !== null) r.blindAt = Math.min(r.blindAt, r.target - 1);
    return r;
  }

  /** 오차(초)를 판정 이름으로 바꾼다. */
  function gradeOf(err, W) {
    const a = Math.abs(err);
    return a <= W.perfect + EPS ? 'perfect' : a <= W.great + EPS ? 'great' : a <= W.good + EPS ? 'good' : 'miss';
  }

  function hintFor(r) {
    if (r.bet) return '시계도 박자 소리도 없이! 맞히면 <b>점수 2배</b>';
    const lines = [];
    if (r.rate > 1) lines.push(`이 시계는 <b>${r.rate}배 빨리</b> 간다. 속지 마!`);
    if (r.rate < 1) lines.push(`이 시계는 <b>${r.rate}배로 느리게</b> 간다. 속지 마!`);
    if (r.reverse) lines.push('<b>거꾸로</b> 세는 시계. 0.00 이 목표!');
    if (r.strobe) lines.push('시계가 <b>뚝뚝 끊겨서</b> 가끔만 바뀐다');
    if (r.blindAt !== null) lines.push(`<b>${num(r.blindAt)}초</b> 뒤에 시계가 사라진다`);
    if (r.heckler) lines.push('<b>방해꾼</b>이 하는 말은 무시!');
    if (!lines.length) lines.push('감을 잡는 라운드. 자신 있으면 <b>눈 가리고!</b>');
    return lines.slice(0, 2).join('<br>');
  }

  function tagFor(r) {
    const t = [];
    if (r.rate !== 1) t.push('가짜 ×' + r.rate);
    if (r.reverse) t.push('거꾸로');
    if (r.strobe) t.push('끊김');
    return t.join(' · ');
  }

  const clockText = (v) => (v < -0.004 ? '-' : '') + Math.abs(v).toFixed(2);

  // 일시 정지를 지금 판에 알려 주는 창구 (start 가 채운다)
  let live = null;

  function start(game) {
    // 재도전할수록 판정 폭이 조금씩 넓어진다
    const ease = 1 + 0.15 * Math.min(game.retry, 3);
    const W = { perfect: S.perfect * ease, great: S.great * ease, good: S.good * ease };
    const RANGE = W.good * 1.6; // 과녁 막대의 양 끝(초)

    let stageIdx = game.checkpoint;
    let roundIdx = 0;
    let cur = null; // 지금 라운드의 조건
    let phase = 'idle'; // idle | ready | running | void | reveal | judged | over
    let t0 = 0; // 시작을 누른 시각 (performance.now 기준)
    let readyAt = 0;
    let covered = false;
    let lastTick = 0;
    let strobeValue = 0;
    let nextJump = 0;
    let nextShout = 0;
    let hecklerSpan = 0;
    let cancelAuto = null;
    const results = [];
    const usedTargets = [];
    let misses = 0;
    let perfects = 0;
    let betWins = 0;

    // ----- 화면
    const roundChip = h('div', { class: 'ar-chip ts-round' });
    const top = h('div', { class: 'ts-top' }, roundChip);
    const targetNum = h('b');
    const target = h('div', { class: 'ts-target' }, [h('span', { text: '목표' }), targetNum, h('span', { text: '초' })]);
    const digits = h('div', { class: 'ts-digits', text: '0.00' });
    const tag = h('div', { class: 'ts-tag' });
    const cover = h('div', { class: 'ts-cover' }, [h('span', { text: '🙈' }), h('small', { text: '속으로 하나, 둘…' })]);
    const dial = h('div', { class: 'ts-dial' }, [digits, tag, cover]);
    const bubble = h('div', { class: 'ts-bubble' });
    const heckler = h('div', { class: 'ts-heckler ar-hidden' }, [bubble, h('span', { text: '👻' })]);
    const dialWrap = h('div', { class: 'ts-dial-wrap' }, [dial, heckler]);
    const grade = h('div', { class: 'ts-grade' });
    const detail = h('div', { class: 'ts-detail' });
    const msg = h('div', { class: 'ts-msg' }, [grade, detail]);
    const marker = h('div', { class: 'ts-marker ar-hidden' });
    const bar = h('div', { class: 'ts-bar' }, marker);
    const gauge = h('div', { class: 'ts-gauge' }, [
      bar,
      h('div', { class: 'ts-scale' }, [h('span', { text: '◀ 빨랐다' }), h('span', { text: '🎯 목표' }), h('span', { text: '느렸다 ▶' })]),
    ]);
    game.root.append(top, h('div', { class: 'ts-main' }, [target, dialWrap, msg, gauge]));

    const betBtn = h('button', { class: 'ar-btn ghost ts-bet' }, [h('span', { text: '🙈 눈 가리고' }), h('b', { text: '점수 ×2' })]);
    const mainBtn = h('button', { class: 'ar-btn lg ts-go' });
    game.footer.append(betBtn, mainBtn);

    // 과녁 막대: 가운데가 목표, 판정 폭만큼 색을 칠한다
    const at = (sec) => 50 + (clamp(sec, -RANGE, RANGE) / RANGE) * 50;
    const stops = [
      ['miss', -RANGE], ['good', -W.good], ['great', -W.great], ['perfect', -W.perfect],
      ['great', W.perfect], ['good', W.great], ['miss', W.good],
    ].map(([name, from], i, arr) => `var(--ts-${name}) ${at(from).toFixed(2)}% ${at(i + 1 < arr.length ? arr[i + 1][1] : RANGE).toFixed(2)}%`);
    bar.style.background = `linear-gradient(90deg, ${stops.join(', ')})`;

    function setMain(mode) {
      mainBtn.className = 'ar-btn lg ts-go' + (mode === 'running' ? ' bad' : mode === 'judged' ? ' ghost' : '');
      mainBtn.textContent = { ready: '▶ 시작', running: '멈춰!', judged: '다음 ▶', wait: '…' }[mode];
      mainBtn.disabled = mode === 'wait';
    }

    function setCover(on) {
      covered = on;
      dial.classList.toggle('blind', on);
    }

    /** 시계에 값 v(초)를 그린다. 거꾸로 시계는 남은 시간을 보여 준다 */
    function showValue(v) {
      digits.textContent = clockText(cur.reverse ? cur.target - v : v);
      const p = cur.reverse ? 1 - v / cur.target : v / cur.target;
      dial.style.setProperty('--p', clamp(p, 0, 1).toFixed(4));
      dial.classList.toggle('over', v > cur.target);
    }

    function renderDots() {
      bar.querySelectorAll('.ts-dot').forEach((d) => d.remove());
      // 막대 끝을 넘은 점도 막대 안쪽에 보이게 한다
      results.slice(-8).forEach((r) => bar.appendChild(h('i', { class: 'ts-dot', style: { left: clamp(at(r.err), 1.5, 98.5) + '%' } })));
    }

    // ----- 라운드 진행
    function readyRound() {
      phase = 'ready';
      readyAt = game.time;
      cur.bet = false;
      roundChip.textContent = `라운드 ${roundIdx + 1} / ${S.rounds}`;
      targetNum.textContent = cur.target.toFixed(2);
      dial.className = 'ts-dial';
      setCover(false);
      showValue(0);
      tag.textContent = tagFor(cur);
      grade.textContent = '';
      grade.className = 'ts-grade';
      detail.innerHTML = hintFor(cur);
      marker.className = 'ts-marker ar-hidden';
      heckler.classList.add('ar-hidden');
      renderDots();
      betBtn.classList.remove('ar-hidden', 'on');
      betBtn.disabled = false;
      setMain('ready');
      fx.pop(target);
    }

    function newRound() {
      cur = makeRound(stageIdx, roundIdx, usedTargets);
      usedTargets.push(cur.target);
      readyRound();
    }

    function setBet(on) {
      if (phase !== 'ready' || !game.playing) return;
      cur.bet = !!on;
      betBtn.classList.toggle('on', cur.bet);
      setCover(cur.bet);
      tag.textContent = cur.bet ? '' : tagFor(cur);
      detail.innerHTML = hintFor(cur);
      sfx(cur.bet ? 'power' : 'tap');
    }

    function beginRun(t) {
      phase = 'running';
      t0 = t;
      lastTick = 0;
      strobeValue = 0;
      nextJump = rand(0.5, 0.9);
      nextShout = 0.35;
      hecklerSpan = dialWrap.clientWidth * 0.34;
      betBtn.classList.add('ar-hidden');
      setMain('running');
      dial.classList.add('run');
      detail.textContent = '';
      sfx('pick');
      if (cur.heckler) {
        bubble.textContent = '헤헤…';
        heckler.classList.remove('ar-hidden');
      }
      paintClock(0);
    }

    function paintClock(el) {
      const hide = cur.bet || (cur.blindAt !== null && el >= cur.blindAt);
      if (hide !== covered) {
        setCover(hide);
        if (hide) sfx('whoosh');
      }
      if (hide) return;
      let v = el * cur.rate;
      if (cur.strobe) {
        if (el >= nextJump) {
          strobeValue = v;
          nextJump = el + rand(0.6, 1) + level * 0.2;
          fx.pop(digits);
        }
        v = strobeValue;
      }
      showValue(v);
    }

    /** 1초마다 울리는 박자 도우미. 소리를 꺼 둔 기기를 위해 시계 테두리도 함께 뛴다 */
    function beat() {
      Arcade.audio.tone({ freq: 880, type: 'triangle', dur: 0.06, vol: 0.2 });
      dial.classList.remove('beat');
      void dial.offsetWidth;
      dial.classList.add('beat');
    }

    function moveHeckler(el) {
      const x = Math.sin(el * 1.9 + 1) * hecklerSpan;
      const y = Math.sin(el * 3.1) * 24;
      heckler.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      if (el < nextShout) return;
      nextShout = el + rand(0.5, 1);
      bubble.textContent = Math.random() < 0.6 ? randInt(1, 9) + '초!' : pick(SHOUTS);
      // 어려움에서는 엇박자 소리로 속셈까지 흔든다
      if (level === 2) Arcade.audio.tone({ freq: pick([700, 940, 1250]), type: 'square', dur: 0.04, vol: 0.05 });
    }

    game.loop(() => {
      if (phase !== 'running') return;
      const el = (performance.now() - t0) / 1000;
      paintClock(el);
      const sec = Math.floor(el);
      if (sec > lastTick) {
        lastTick = sec;
        if (!cur.bet && (S.tick === 'all' || (S.tick === 'start' && sec <= TICK_START))) beat();
      }
      if (cur.heckler) moveHeckler(el);
      if (el >= cur.target + OVERTIME) stopRun(cur.target + OVERTIME, true);
    });

    /** el 초에 멈춘 것으로 판정한다. late 는 너무 늦어 자동으로 멈춘 경우 */
    function stopRun(el, late) {
      if (phase !== 'running') return;
      phase = 'reveal';
      // 화면에 보이는 0.01초 단위로 맞춘 뒤 판정한다 (보이는 숫자와 판정이 어긋나지 않게)
      const time = Math.round(el * 100) / 100;
      const err = Math.round((time - cur.target) * 100) / 100;
      const res = { target: cur.target, time, err, grade: gradeOf(err, W), bet: cur.bet, late: !!late };
      results.push(res);

      setMain('wait');
      heckler.classList.add('ar-hidden');
      setCover(false);
      dial.classList.remove('run', 'over', 'beat');
      digits.textContent = time.toFixed(2);
      dial.style.setProperty('--p', clamp(time / cur.target, 0, 1).toFixed(4));
      tag.textContent = '진짜 시간';
      detail.textContent = '';
      sfx('lock');

      // 표식이 과녁 막대 위를 미끄러져 멈춘다
      const to = at(err);
      marker.className = 'ts-marker';
      game.tween(480, (k) => (marker.style.left = lerp(0, to, k) + '%')).then(() => settle(res));
    }

    function settle(res) {
      const g = res.grade;
      const a = Math.abs(res.err);
      marker.classList.add(g);
      dial.classList.add(g);
      grade.textContent = LABEL[g];
      grade.className = 'ts-grade ' + g;
      fx.pop(grade);
      detail.innerHTML = res.late
        ? '너무 늦었어! 시계가 멈춰 버렸다'
        : a < 0.005
          ? '오차 <b>0.00초</b>! 딱 맞았어'
          : `<b>${a.toFixed(2)}초</b> ${res.err < 0 ? '빨랐어!' : '느렸어!'}`;

      if (g === 'miss') {
        misses++;
        game.resetCombo();
        sfx('bad');
        if (game.loseLife(dial) <= 0) {
          phase = 'over';
          game.after(1500, () =>
            game.lose({
              icon: '⏱️',
              message: `스테이지 ${stageIdx + 1}에서 하트를 모두 잃었어요.<br>다시 하면 판정이 조금 넉넉해져요.`,
              checkpoint: stageIdx,
            })
          );
          return;
        }
      } else {
        // PERFECT·GREAT 가 이어지면 콤보. 2콤보 1.5배, 3콤보부터 2배
        let combo = 0;
        if (g === 'good') game.resetCombo();
        else combo = game.addCombo();
        const mult = (combo >= 3 ? 2 : combo === 2 ? 1.5 : 1) * (res.bet ? 2 : 1);
        game.addScore(Math.round(POINTS[g] * mult), dial);
        sfx(g);
        fx.burst(marker, { count: g === 'perfect' ? 22 : 10, spread: g === 'perfect' ? 130 : 80 });
        const notes = [];
        if (res.bet) {
          betWins++;
          notes.push('🙈 눈 가리고 성공 ×2');
        }
        if (g === 'perfect') {
          perfects++;
          fx.flash('rgba(255,209,102,.3)');
          Arcade.vibrate(60);
          if (game.lives < S.lives) {
            game.gainLife();
            notes.push('❤️ 하트 +1');
          }
        }
        if (notes.length) fx.toast(notes.join(' · '), { kind: 'gold', ms: 1300 });
      }
      phase = 'judged';
      setMain('judged');
      cancelAuto = game.after(2600, advance);
    }

    function advance() {
      if (phase !== 'judged') return;
      phase = 'idle';
      if (cancelAuto) cancelAuto();
      roundIdx++;
      if (roundIdx < S.rounds) return newRound();
      game.addScore(STAGE_BONUS, dial);
      if (stageIdx >= STAGES.length - 1) return finish();
      fx.confetti(24);
      stageIdx++;
      runStage();
    }

    async function runStage() {
      roundIdx = 0;
      game.setStage(stageIdx, STAGES.length);
      game.setGoal(STAGES[stageIdx].goal);
      // 첫 라운드를 미리 깔아 두고, 안내가 지나간 뒤에 누를 수 있게 한다
      newRound();
      phase = 'idle';
      setMain('wait');
      betBtn.disabled = true;
      const [title, sub] = STAGES[stageIdx].banner;
      await game.banner(title, sub, { ms: 1400 });
      readyRound();
    }

    function finish() {
      const abs = results.map((r) => Math.abs(r.err));
      const avg = abs.reduce((s, v) => s + v, 0) / abs.length;
      const bias = results.reduce((s, r) => s + r.err, 0) / results.length;
      const best = results.reduce((b, r) => (Math.abs(r.err) < Math.abs(b.err) ? r : b));
      let stars = misses === 0 && avg <= W.great + EPS ? 3 : misses <= 1 && avg <= W.good + EPS ? 2 : 1;
      if (game.retry > 0) stars = Math.min(stars, 2);
      const habit =
        bias < -0.03
          ? `마음이 급한 편! 평균 ${Math.abs(bias).toFixed(2)}초 빨리 눌렀어요.`
          : bias > 0.03
            ? `느긋한 편! 평균 ${bias.toFixed(2)}초 늦게 눌렀어요.`
            : '빠르지도 늦지도 않은 딱 좋은 감각이에요.';
      game.win({
        stars,
        title: stars === 3 ? '명사수 탄생!' : '미션 성공!',
        message: habit,
        stats: [
          ['평균 오차', `${avg.toFixed(2)}초`],
          ['베스트 샷', `${Math.abs(best.err).toFixed(2)}초 (목표 ${best.target.toFixed(2)}초)`],
          ['PERFECT', `${perfects}번`],
          ['눈 가리고 성공', `${betWins}번`],
        ],
      });
    }

    // ----- 입력: 손을 뗄 때가 아니라 누르는 순간을 잰다
    /** 누른 시각. 이벤트가 만들어진 시각을 믿을 수 있으면 그것을 쓴다 */
    function stamp(e) {
      const now = performance.now();
      const ts = e && e.timeStamp;
      return ts > 0 && ts <= now && now - ts < 200 ? ts : now;
    }

    function press(e) {
      if (!game.playing) return;
      const t = stamp(e);
      if (phase === 'ready') {
        if (game.time - readyAt >= 0.35) beginRun(t);
      } else if (phase === 'running') {
        const el = (t - t0) / 1000;
        if (el >= MIN_RUN) stopRun(el);
      } else if (phase === 'judged') {
        advance();
      }
    }

    mainBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      press(e);
    });
    betBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      setBet(!cur.bet);
    });
    // PC 에서는 스페이스바로도 누를 수 있다
    game.on(window, 'keydown', (e) => {
      // 일시 정지·결과 화면에서는 스페이스바가 그 화면의 버튼을 누르게 둔다
      if (e.code !== 'Space' || e.repeat || !game.playing) return;
      e.preventDefault();
      press(e);
    });

    // 재는 도중에 멈추면 그 라운드는 무효. 돌아오면 같은 목표로 다시 한다
    live = {
      pause() {
        if (phase === 'running') phase = 'void';
      },
      resume() {
        if (phase !== 'void') return;
        readyRound();
        fx.toast('멈췄던 라운드는 처음부터!', { ms: 1400 });
      },
    };
    game.onCleanup(() => (live = null));

    if (game.debug) {
      // 검증용 창구
      window.__game = {
        state: () => ({
          phase,
          stage: stageIdx,
          round: roundIdx,
          spec: cur && Object.assign({}, cur),
          covered,
          shown: digits.textContent,
          elapsed: phase === 'running' ? (performance.now() - t0) / 1000 : null,
          windows: W,
          settings: S,
          level,
          results: results.slice(),
          misses,
          perfects,
          betWins,
        }),
        press: () => press(null),
        setBet,
        /** 목표에서 d초 어긋나게 멈춘다. 준비 상태면 먼저 시작한다 */
        stopAt(d) {
          if (phase === 'ready') beginRun(performance.now());
          if (phase !== 'running') return false;
          stopRun(cur.target + d);
          return true;
        },
        next: advance,
        makeRound,
        gradeOf,
      };
    }

    runStage();
  }

  Arcade.createGame({
    id: GAME_ID,
    title: '타임 스나이퍼',
    icon: '⏱️',
    accent: '#36d6ff',
    accent2: '#b388ff',
    tagline: '하나, 둘, 셋… 지금! 0.01초를 노리는 감각 승부',
    howTo: [
      '<b>시작</b>을 누르고 속으로 세다가, 목표 시간에 <b>멈춰!</b>',
      '시계가 <b>사라지고 거짓말</b>도 한다. 크게 빗나가면 하트 -1',
      '자신 있으면 <b>🙈 눈 가리고</b> 도전! 맞히면 점수 2배',
    ],
    lives: S.lives,
    stages: STAGES.length,
    music: false, // 박자가 있는 배경음은 속으로 세는 것을 방해한다
    start,
    onPause: () => live && live.pause(),
    onResume: () => live && live.resume(),
  });
})();
