// 색깔 스피드: 규칙이 바뀌는 스트룹 챌린지
// 스테이지마다 "무엇을 답해야 하는지"가 달라져서, 익숙해질 만하면 다시 헷갈리게 만든다.
(function () {
  'use strict';

  const { h, pick, shuffle, clamp, sfx, fx } = Arcade;
  const GAME_ID = 'game12';

  // ----- 설정 (관리자 페이지와 같은 키를 쓴다)
  const PRESETS = [
    { questionTime: 3.6, quota: 6, lives: 4 },
    { questionTime: 2.8, quota: 8, lives: 3 },
    { questionTime: 2.2, quota: 10, lives: 3 },
  ];
  const saved = Arcade.loadSettings('color_rush_settings', {});
  const level = clamp(parseInt(saved.difficulty, 10) || 0, 0, 2);
  const S = Object.assign({}, PRESETS[level]);
  ['questionTime', 'quota', 'lives'].forEach((key) => {
    const v = Number(saved[key]);
    if (Number.isFinite(v) && v > 0) S[key] = v;
  });

  const COLORS = [
    { name: '빨강', code: '#ff4d5e' },
    { name: '파랑', code: '#4d8dff' },
    { name: '초록', code: '#2fd17a' },
    { name: '노랑', code: '#ffd43b' },
    { name: '보라', code: '#b874ff' },
    { name: '주황', code: '#ff9330' },
  ].slice(0, 4 + level);

  const STAGES = [
    { rule: 'ox', goal: '<b>뜻</b>과 <b>색</b>이 같으면 O, 다르면 X', banner: ['스테이지 1', '뜻과 색이 같으면 O!'] },
    { rule: 'ink', goal: '글자의 <b>색</b>을 골라라. 뜻에 속지 마!', banner: ['스테이지 2', '이번엔 글자의 색을 골라라'] },
    { rule: 'mix', goal: '카드 위 <b>지시</b>대로 뜻 또는 색을 골라라', banner: ['마지막 스테이지', '규칙이 문제마다 바뀐다!'] },
  ];
  const FEVER_AT = 6; // 이 콤보에 닿으면 피버
  const FEVER_SEC = 6;

  /** 문제 하나를 만든다. 순수 함수라서 따로 시험하기 쉽다. */
  function makeQuestion(rule) {
    const word = pick(COLORS);
    const others = COLORS.filter((c) => c !== word);
    if (rule === 'ox') {
      const same = Math.random() < 0.5;
      return { rule, word, ink: same ? word : pick(others), answer: same ? 'O' : 'X', options: ['O', 'X'] };
    }
    const ink = pick(others);
    const ask = rule === 'ink' ? 'ink' : pick(['ink', 'word']);
    const answer = ask === 'ink' ? ink : word;
    const trap = ask === 'ink' ? word : ink; // 반대 속성이 함정이 된다
    const rest = shuffle(COLORS.filter((c) => c !== answer && c !== trap)).slice(0, 2);
    return { rule, ask, word, ink, answer, options: shuffle([answer, trap, ...rest]) };
  }

  function start(game) {
    let stageIdx = game.checkpoint;
    let solved = 0;
    let asked = 0;
    let correctTotal = 0;
    let reactionSum = 0;
    let q = null;
    let qTime = 0;
    let qLeft = 0;
    let accepting = false;
    let feverUntil = 0;

    // ----- 화면
    const progress = h('div', { class: 'ar-chip cr-progress' });
    const tag = h('div', { class: 'cr-tag' });
    const word = h('div', { class: 'cr-word' });
    const feverBadge = h('div', { class: 'cr-fever ar-hidden', text: '🔥 피버 x2' });
    const card = h('div', { class: 'cr-card' }, [feverBadge, tag, word]);
    const qFill = h('i');
    const qbar = h('div', { class: 'cr-qbar' }, qFill);
    const answers = h('div', { class: 'cr-answers' });
    game.root.append(progress, card, qbar);
    game.footer.append(answers);

    const inFever = () => game.time < feverUntil;

    function setMusic() {
      Arcade.audio.music.setIntensity(0.15 + stageIdx * 0.25 + (inFever() ? 0.35 : 0));
    }

    function renderButtons() {
      answers.innerHTML = '';
      answers.className = 'cr-answers ' + (q.rule === 'ox' ? 'ox' : 'four');
      q.options.forEach((opt) => {
        const isOX = typeof opt === 'string';
        const btn = h('button', {
          class: 'ar-btn' + (isOX ? (opt === 'O' ? ' good' : ' bad') : ''),
          text: isOX ? opt : opt.name,
          style: isOX ? null : { background: opt.code },
        });
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          answer(opt, btn);
        });
        answers.appendChild(btn);
      });
    }

    function nextQuestion() {
      q = makeQuestion(STAGES[stageIdx].rule);
      asked++;
      // 뒤 스테이지는 생각할 것이 많아 시간을 조금 더 주고, 콤보가 쌓이면 점점 빨라진다
      qTime = S.questionTime * [1, 1.15, 1.3][stageIdx] - Math.min(game.combo, 10) * 0.04 + Math.min(game.retry, 3) * 0.3;
      qLeft = qTime;

      progress.textContent = `${solved} / ${S.quota}`;
      word.textContent = q.word.name;
      word.style.color = q.ink.code;
      if (q.rule === 'mix') {
        tag.textContent = q.ask === 'ink' ? '색을 골라라' : '뜻을 골라라';
        tag.className = 'cr-tag ' + q.ask;
      } else {
        tag.textContent = '';
      }
      card.classList.remove('in', 'right', 'wrong');
      void card.offsetWidth;
      card.classList.add('in');
      renderButtons();
      sfx('flip');
      accepting = true;
    }

    function answer(choice, btn) {
      if (!accepting || !game.playing) return;
      accepting = false;
      const right = choice === q.answer;

      if (right) {
        const combo = game.addCombo();
        const speed = clamp(qLeft / qTime, 0, 1);
        const mult = (combo >= 10 ? 3 : combo >= 5 ? 2 : 1) * (inFever() ? 2 : 1);
        game.addScore((100 + Math.round(speed * 50)) * mult, btn || card);
        reactionSum += qTime - qLeft;
        correctTotal++;
        solved++;
        card.classList.add('right');
        fx.burst(card, { count: 10, spread: 110 });
        if (combo === FEVER_AT || (combo > FEVER_AT && combo % 10 === 0)) startFever();
      } else {
        game.resetCombo();
        feverUntil = 0;
        card.classList.add('wrong');
        fx.shake(card, 10);
        sfx('bad');
        const answerText = typeof q.answer === 'string' ? q.answer : q.answer.name;
        fx.toast(choice === null ? `시간 초과! 정답은 <b>${answerText}</b>` : `정답은 <b>${answerText}</b>`, { kind: 'bad', ms: 900 });
        if (game.loseLife(card) <= 0) {
          game.lose({
            message: `스테이지 ${stageIdx + 1}에서 하트를 모두 잃었어요.`,
            checkpoint: stageIdx,
          });
          return;
        }
      }
      paintFever();
      progress.textContent = `${solved} / ${S.quota}`;

      if (solved >= S.quota) {
        game.after(350, stageClear);
      } else {
        game.after(right ? 180 : 750, nextQuestion);
      }
    }

    function startFever() {
      feverUntil = game.time + FEVER_SEC;
      sfx('power');
      fx.toast('🔥 피버! 점수 2배', { kind: 'gold' });
      fx.flash('rgba(255,209,102,.3)');
      Arcade.vibrate(60);
    }

    function paintFever() {
      const on = inFever();
      card.classList.toggle('fever', on);
      feverBadge.classList.toggle('ar-hidden', !on);
      setMusic();
    }

    async function stageClear() {
      sfx('stage');
      fx.confetti(30);
      game.addScore(300, card);
      if (stageIdx >= STAGES.length - 1) return finish();
      stageIdx++;
      await runStage();
    }

    async function runStage() {
      solved = 0;
      game.setStage(stageIdx, STAGES.length);
      game.setGoal(STAGES[stageIdx].goal);
      progress.textContent = `0 / ${S.quota}`;
      word.textContent = '';
      tag.textContent = '';
      answers.innerHTML = '';
      qFill.style.transform = 'scaleX(1)';
      setMusic();
      const [title, sub] = STAGES[stageIdx].banner;
      await game.banner(title, sub, { ms: 1500 });
      nextQuestion();
    }

    function finish() {
      const lost = game.config.lives - game.lives;
      let stars = lost === 0 ? 3 : lost === 1 ? 2 : 1;
      if (game.retry > 0) stars = Math.min(stars, 2);
      game.win({
        stars,
        message: stars === 3 ? '하트를 하나도 잃지 않았어요. 완벽해요!' : '헷갈리는 규칙을 모두 통과했어요!',
        stats: [
          ['정답', `${correctTotal} / ${asked}`],
          ['최대 콤보', `${game.maxCombo}`],
          ['평균 반응', `${(reactionSum / Math.max(1, correctTotal)).toFixed(2)}초`],
        ],
      });
    }

    // 문제마다 줄어드는 시간 막대
    game.loop((dt) => {
      if (accepting) {
        qLeft -= dt;
        const k = clamp(qLeft / qTime, 0, 1);
        qFill.style.transform = `scaleX(${k})`;
        qbar.classList.toggle('low', k < 0.35);
        if (qLeft <= 0) answer(null, null);
      }
      if (feverUntil && !inFever()) {
        feverUntil = 0;
        paintFever();
      }
    });

    if (game.debug) {
      // 검증용: 정답 또는 오답을 대신 눌러 준다
      window.__game = {
        question: () => q,
        accepting: () => accepting,
        answerRight: () => answer(q.answer, null),
        answerWrong: () => answer(q.options.find((o) => o !== q.answer), null),
      };
    }

    runStage();
  }

  Arcade.createGame({
    id: GAME_ID,
    title: '색깔 스피드',
    icon: '🌈',
    accent: '#ff5d9e',
    accent2: '#ffb347',
    tagline: '눈은 색을 보고, 머리는 글자를 읽는다. 누가 이길까?',
    howTo: [
      '글자의 <b>뜻</b>과 <b>색</b>이 서로 다르게 나와요',
      '스테이지마다 <b>규칙이 바뀌니</b> 위쪽 안내를 꼭 확인!',
      '연속으로 맞히면 콤보, <b>6콤보면 피버</b>로 점수 2배',
    ],
    lives: S.lives,
    stages: STAGES.length,
    start,
  });
})();
