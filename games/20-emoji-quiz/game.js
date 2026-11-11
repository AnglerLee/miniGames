// 이모지 퀴즈쇼: 이모지를 보고 "아, 그거구나!" 하는 순간을 노리는 3라운드 퀴즈
// 키보드 없이 보기 버튼과 글자 타일만으로 답한다.
(function () {
  'use strict';

  const { h, shuffle, clamp, lerp, sfx, fx } = Arcade;
  const GAME_ID = 'game20';
  const SETTINGS_KEY = 'emoji_quiz_settings';
  const RECENT_KEY = 'emoji_quiz_recent';

  // ----- 설정 (관리자 페이지와 같은 키를 쓴다)
  const PRESETS = [
    { questionTime: 25, quota: 4, lives: 4 },
    { questionTime: 20, quota: 5, lives: 3 },
    { questionTime: 15, quota: 6, lives: 3 },
  ];
  const LIMITS = { questionTime: [5, 90], quota: [2, 10], lives: [1, 5] };

  /** 예전 게임이 쓰던 자리(treasureHunt_gameConfigs.game20.gameSettings)의 값을 새 설정 모양으로 바꾼다. */
  function legacySettings() {
    const all = Arcade.store.get('treasureHunt_gameConfigs', null);
    const old = all && all[GAME_ID] && all[GAME_ID].gameSettings;
    const out = {};
    if (!old || typeof old !== 'object') return out;
    const time = Number(old.timePerQuestion);
    const total = Number(old.totalQuestions);
    if (time > 0) out.questionTime = clamp(time, 8, 60);
    if (total > 0) out.quota = clamp(Math.round(total / 3), 3, 8); // 예전 값은 한 판 전체 문제 수였다
    return out;
  }

  const saved = Arcade.loadSettings(SETTINGS_KEY, {});
  const level = clamp(parseInt(saved.difficulty, 10) || 0, 0, 2);
  const source = Object.keys(saved).length ? saved : legacySettings();
  const S = Object.assign({}, PRESETS[level]);
  Object.keys(LIMITS).forEach((key) => {
    const v = Number(source[key]);
    if (Number.isFinite(v) && v > 0) S[key] = clamp(v, LIMITS[key][0], LIMITS[key][1]);
  });
  S.autoHint = saved.autoHint !== false;

  // ----- 문제 은행 (questions.js)
  const HANGUL = /^[가-힣]+$/;
  const squash = (s) => String(s || '').replace(/\s+/g, '');

  /** 문제 하나를 게임에서 쓰기 좋게 다듬는다. 형식이 틀린 항목은 null. */
  function normalize(raw, index) {
    if (!raw || !raw.emoji) return null;
    const list = (Array.isArray(raw.answer) ? raw.answer : [raw.answer]).map((a) => String(a || '').trim()).filter(Boolean);
    if (!list.length) return null;
    const rep = squash(list[0]);
    return {
      id: raw.id === undefined ? 'q' + index : raw.id,
      parts: String(raw.emoji).split('+').map((p) => p.trim()).filter(Boolean),
      label: list[0], // 화면에 보여 줄 정답
      rep, // 띄어쓰기를 뺀 대표 정답. 글자 타일은 이것으로 만든다
      answers: list.map(squash),
      hint: raw.hint || '',
      cat: raw.cat || '',
      buildable: HANGUL.test(rep) && rep.length >= 2 && rep.length <= 5,
    };
  }
  const RAW = typeof EMOJI_QUIZ_DATA !== 'undefined' && Array.isArray(EMOJI_QUIZ_DATA) ? EMOJI_QUIZ_DATA : [];
  const POOL = RAW.map(normalize).filter(Boolean);
  S.quota = Math.max(1, Math.min(Math.round(S.quota), Math.floor(POOL.filter((x) => x.buildable).length / 2)));
  S.lives = Math.round(S.lives);

  // 최근에 나온 문제는 다음 판에서 뒤로 민다
  const RECENT_MAX = Math.min(60, Math.floor(POOL.length / 2));
  function recentIds() {
    const list = Arcade.store.get(RECENT_KEY, []);
    return Array.isArray(list) ? list : [];
  }
  function remember(id) {
    const list = recentIds().filter((x) => x !== id);
    list.push(id);
    Arcade.store.set(RECENT_KEY, list.slice(-RECENT_MAX));
  }

  /** 한 판에 쓸 문제를 라운드별로 뽑는다. 서로 겹치지 않고, 최근에 안 나온 문제가 먼저다. */
  function drawDecks(quota) {
    const recent = recentIds();
    const rank = (x) => recent.indexOf(x.id); // -1 이면 최근에 안 나온 문제
    const order = shuffle(POOL).sort((a, b) => rank(a) - rank(b));
    const used = new Set();
    const take = (must, prefer) => {
      const out = [];
      for (const test of [prefer, () => true]) {
        for (const x of order) {
          if (out.length >= quota) break;
          if (!used.has(x) && must(x) && test(x)) {
            used.add(x);
            out.push(x);
          }
        }
      }
      return shuffle(out);
    };
    // 조립 문제를 먼저 챙긴다: 2라운드는 짧은 답, 3라운드는 긴 답
    const build = take((x) => x.buildable, (x) => x.rep.length <= 3);
    const speed = take((x) => x.buildable, (x) => x.rep.length >= 3);
    const warmup = take(() => true, () => true);
    return [warmup, build, speed];
  }

  /** 4지선다 보기. 오답은 다른 문제의 정답에서, 되도록 같은 갈래에서 가져온다. */
  function makeChoices(item) {
    // 정답과 글자가 겹쳐 헷갈리는 보기(노래·노래방)는 뺀다
    const clash = (x) => x === item || item.answers.some((a) => a.includes(x.rep) || x.rep.includes(a));
    const rest = shuffle(POOL.filter((x) => !clash(x)));
    const ordered = rest.filter((x) => x.cat === item.cat).concat(rest.filter((x) => x.cat !== item.cat));
    const wrong = [];
    for (const x of ordered) {
      if (wrong.length >= 3) break;
      if (!wrong.some((w) => w.rep === x.rep)) wrong.push(x);
    }
    return shuffle([item, ...wrong]);
  }

  /** 글자 타일. 정답 글자에 가짜 글자를 섞어 total 개를 만든다. */
  function makeTiles(item, total) {
    const real = Array.from(item.rep);
    const banned = new Set(item.answers.join('')); // 다른 정답을 만들 수 있는 글자는 가짜로 쓰지 않는다
    const letters = (list) => shuffle(Array.from(new Set(list.filter((x) => x.buildable).map((x) => x.rep).join(''))));
    const candidates = letters(POOL.filter((x) => x.cat === item.cat)).concat(letters(POOL.filter((x) => x.cat !== item.cat)));
    const fake = [];
    for (const ch of candidates) {
      if (fake.length >= total - real.length) break;
      if (!banned.has(ch) && !fake.includes(ch)) fake.push(ch);
    }
    return shuffle(real.map((ch) => ({ ch, real: true })).concat(fake.map((ch) => ({ ch, real: false }))));
  }

  const STAGES = [
    { mode: 'choice', name: '1라운드', goal: '이모지가 뜻하는 말을 <b>골라라</b>', banner: ['1라운드', '몸풀기! 넷 중에 하나를 골라라'] },
    { mode: 'build', name: '2라운드', goal: '글자를 <b>순서대로</b> 눌러 답을 완성!', banner: ['2라운드', '글자 타일로 답을 조립하라'], tiles: 8 },
    { mode: 'build', name: '마지막 라운드', goal: '<b>빨리</b> 맞힐수록 점수가 크다!', banner: ['마지막 라운드', '가짜는 늘고, 점수는 줄어든다!'], tiles: 12, speed: true },
  ];
  const CHANCES = [
    { key: 'magic', icon: '🪄', label: '글자 힌트' },
    { key: 'cut', icon: '✂️', label: '절반 제거' },
    { key: 'pass', icon: '⏭️', label: '패스' },
  ];
  const CHOICE_TIME = 0.4; // 4지선다는 문제당 시간의 40%
  const QUICK = 0.6; // 시간이 이만큼 넘게 남았을 때 맞히면 번개 정답
  const KEEP_BONUS = 300; // 아낀 찬스 하나당

  function start(game) {
    let stageIdx = game.checkpoint;
    let asked = 0; // 이번 라운드에서 낸 문제 수
    let askedTotal = 0;
    let correctTotal = 0;
    let quickTotal = 0;
    let q = null; // 지금 문제
    let timer = null;
    let accepting = false;
    const decks = drawDecks(S.quota);
    const chances = { magic: true, cut: true, pass: true };

    // ----- 화면
    const progress = h('div', { class: 'ar-chip eq-progress' });
    const worth = h('div', { class: 'ar-chip eq-worth ar-hidden' }); // 3라운드: 지금 맞히면 받는 점수
    const emojiEl = h('div', { class: 'eq-emoji' });
    const hintEl = h('div', { class: 'eq-hint' });
    const card = h('div', { class: 'eq-card' }, [emojiEl, hintEl]);
    const slotsEl = h('div', { class: 'eq-slots ar-hidden' });
    game.root.append(
      h('div', { class: 'eq-board' }, [
        h('div', { class: 'eq-top' }, [progress, worth]),
        h('div', { class: 'eq-mid' }, [card, slotsEl]),
      ])
    );

    const pad = h('div', { class: 'eq-pad' }); // 보기 버튼 또는 글자 타일
    const chanceBar = h('div', { class: 'eq-chances' });
    const chanceBtns = {};
    CHANCES.forEach((c) => {
      const btn = h('button', { class: 'eq-chance', 'aria-label': c.label }, [
        h('span', { class: 'i', text: c.icon }),
        h('span', { class: 't', text: c.label }),
      ]);
      btn.addEventListener('click', () => useChance(c.key));
      chanceBtns[c.key] = btn;
      chanceBar.appendChild(btn);
    });
    game.footer.append(h('div', { class: 'eq-dock' }, [pad, chanceBar]));

    const worthNow = (ratio) => Math.round(lerp(120, 500, clamp(ratio, 0, 1)));

    function setHint(text) {
      hintEl.textContent = text;
      hintEl.classList.toggle('on', !!text);
    }

    function showEmoji(item) {
      emojiEl.innerHTML = '';
      emojiEl.dataset.n = String(Math.min(4, item.parts.length));
      item.parts.forEach((part, i) => {
        if (i) emojiEl.appendChild(h('span', { class: 'plus', text: '+' }));
        emojiEl.appendChild(h('span', { text: part }));
      });
      card.classList.remove('in', 'right', 'wrong');
      void card.offsetWidth;
      card.classList.add('in');
    }

    // ----- 문제 내기
    function nextQuestion() {
      const deck = decks[stageIdx];
      if (asked >= deck.length) return stageClear();
      const st = STAGES[stageIdx];
      const item = deck[asked];
      asked++;
      askedTotal++;
      remember(item.id);
      q = { item, rep: item.rep, mode: st.mode, hinted: false };

      progress.textContent = `문제 ${asked} / ${deck.length}`;
      setHint('');
      showEmoji(item);
      if (st.mode === 'choice') renderChoices();
      else renderBuild(st.tiles);

      // 재도전할수록 시간을 조금 더 준다
      const base = st.mode === 'choice' ? Math.max(3, S.questionTime * CHOICE_TIME) : S.questionTime;
      q.time = base * (1 + Math.min(game.retry, 3) * 0.15);
      timer = game.startTimer(q.time, { onEnd: timeUp, intensity: 0.15 + stageIdx * 0.2 });
      worth.classList.toggle('ar-hidden', !st.speed);
      if (st.speed) worth.textContent = `🔥 +${worthNow(1)}`;
      sfx('flip');
      accepting = true;
    }

    function renderChoices() {
      slotsEl.classList.add('ar-hidden');
      pad.className = 'eq-pad choice';
      pad.innerHTML = '';
      q.options = makeChoices(q.item).map((item) => {
        const opt = { item, el: h('button', { class: 'ar-btn eq-opt', text: item.label }), gone: false };
        opt.el.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          choose(opt);
        });
        pad.appendChild(opt.el);
        return opt;
      });
    }

    function renderBuild(total) {
      slotsEl.className = 'eq-slots';
      slotsEl.innerHTML = '';
      slotsEl.dataset.n = String(q.rep.length);
      q.slots = Array.from(q.rep).map((_, i) => {
        const slot = { el: h('button', { class: 'eq-slot', 'aria-label': `${i + 1}번째 칸` }), tile: null, locked: false };
        slot.el.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          tapSlot(i);
        });
        slotsEl.appendChild(slot.el);
        return slot;
      });
      pad.className = 'eq-pad tiles';
      pad.innerHTML = '';
      q.tiles = makeTiles(q.item, total).map((t) => {
        const tile = { ch: t.ch, real: t.real, el: h('button', { class: 'eq-tile', text: t.ch }), slot: -1, gone: false };
        tile.el.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          place(tile);
        });
        pad.appendChild(tile.el);
        return tile;
      });
    }

    // ----- 4지선다
    function choose(opt) {
      if (!accepting || !game.playing || opt.gone) return;
      accepting = false;
      if (opt.item === q.item) {
        opt.el.classList.add('right');
        return correct(opt.el);
      }
      game.stopTimer();
      opt.el.classList.add('wrong');
      miss(opt.el, `정답은 <b>${q.item.label}</b>`);
    }

    // ----- 글자 조립
    /** el 이 from 자리에서 제자리로 날아오는 것처럼 보이게 한다. */
    function flyFrom(el, from) {
      if (!el.animate) return;
      const to = el.getBoundingClientRect();
      const dx = from.left + from.width / 2 - (to.left + to.width / 2);
      const dy = from.top + from.height / 2 - (to.top + to.height / 2);
      el.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${from.width / Math.max(1, to.width)})` }, { transform: 'none' }], {
        duration: 170,
        easing: 'cubic-bezier(.2,.9,.3,1.2)',
      });
    }

    function put(tile, i) {
      const slot = q.slots[i];
      const from = tile.el.getBoundingClientRect();
      slot.tile = tile;
      tile.slot = i;
      tile.el.classList.add('used');
      const letter = h('span', { class: 'eq-letter', text: tile.ch });
      slot.el.innerHTML = '';
      slot.el.appendChild(letter);
      slot.el.classList.add('full');
      flyFrom(letter, from);
    }

    function takeBack(i) {
      const slot = q.slots[i];
      const tile = slot.tile;
      if (!tile) return;
      const from = slot.el.getBoundingClientRect();
      slot.tile = null;
      tile.slot = -1;
      slot.el.innerHTML = '';
      slot.el.classList.remove('full', 'wrong');
      tile.el.classList.remove('used');
      flyFrom(tile.el, from);
    }

    function lock(i) {
      q.slots[i].locked = true;
      q.slots[i].el.classList.add('locked');
    }

    function place(tile) {
      if (!accepting || !game.playing || tile.gone || tile.slot >= 0) return;
      const i = q.slots.findIndex((s) => !s.tile);
      if (i < 0) return;
      put(tile, i);
      Arcade.audio.tone({ freq: 520 + i * 70, type: 'triangle', dur: 0.07, vol: 0.18 });
      checkFull();
    }

    function tapSlot(i) {
      if (!accepting || !game.playing) return;
      const slot = q.slots[i];
      if (!slot.tile || slot.locked) return;
      takeBack(i);
      sfx('tap');
    }

    /** 칸이 다 차면 시간을 멈추고, 마지막 글자가 내려앉은 뒤 채점한다. */
    function checkFull() {
      if (!q.slots.every((s) => s.tile)) return;
      accepting = false;
      timer.pause();
      game.after(260, grade);
    }

    function grade() {
      const made = q.slots.map((s) => s.tile.ch).join('');
      if (q.item.answers.includes(made)) {
        slotsEl.classList.add('right');
        return correct(slotsEl);
      }
      game.resetCombo();
      sfx('bad');
      q.slots.forEach((s) => s.el.classList.add('wrong'));
      fx.shake(slotsEl, 10);
      if (game.loseLife(slotsEl) <= 0) return fail();
      // 자리가 맞은 글자는 초록색으로 남고, 나머지는 타일로 돌아간다
      game.after(520, () => {
        let kept = 0;
        q.slots.forEach((s, i) => {
          s.el.classList.remove('wrong');
          if (s.tile.ch === q.rep[i]) {
            lock(i);
            kept++;
          } else {
            takeBack(i);
          }
        });
        fx.toast(kept ? '초록 글자는 맞았어! 나머지를 다시' : '다시 조립해 보자!', { ms: 1100 });
        timer.resume();
        accepting = true;
      });
    }

    // ----- 판정
    function correct(at) {
      const st = STAGES[stageIdx];
      const ratio = timer.ratio();
      game.stopTimer();
      const combo = game.addCombo();
      const mult = 1 + Math.min(combo - 1, 5) * 0.2; // 콤보마다 20%씩, 최대 2배
      const base = st.speed ? worthNow(ratio) : st.mode === 'build' ? 200 + Math.round(ratio * 100) : 100 + Math.round(ratio * 50);
      game.addScore(Math.round(base * mult), at);
      correctTotal++;
      card.classList.add('right');
      fx.burst(card, { count: st.mode === 'build' ? 16 : 10, spread: 120 });
      if (st.mode === 'build') sfx('great');
      if (ratio >= QUICK) {
        quickTotal++;
        fx.floatText(card, '⚡ 번개 정답!', { color: '#ffd43b', size: 20, rise: 44 });
      }
      Arcade.vibrate(30);
      game.after(st.mode === 'build' ? 800 : 420, nextQuestion);
    }

    /** 오답·시간 초과: 정답을 보여 주고 하트를 잃는다. */
    function miss(at, text) {
      game.resetCombo();
      sfx('bad');
      card.classList.add('wrong');
      fx.shake(card, 8);
      reveal();
      if (game.lives > 1) fx.toast(text, { kind: 'bad', ms: 1300 }); // 마지막 하트라면 실패 화면이 정답을 알려 준다
      if (game.loseLife(at) <= 0) return fail();
      game.after(1400, nextQuestion);
    }

    function timeUp() {
      if (!accepting) return;
      accepting = false;
      miss(card, `시간 초과! 정답은 <b>${q.item.label}</b>`);
    }

    function reveal() {
      if (q.mode === 'choice') {
        q.options.forEach((o) => {
          if (o.item === q.item) o.el.classList.add('right');
          else if (!o.el.classList.contains('wrong')) o.el.classList.add('dim');
        });
        return;
      }
      q.slots.forEach((s, i) => {
        s.tile = null;
        s.el.textContent = q.rep[i];
        s.el.className = 'eq-slot full reveal';
      });
      pad.classList.add('off');
    }

    function fail() {
      game.lose({
        message: `${STAGES[stageIdx].name}에서 하트를 모두 잃었어요.<br>마지막 정답은 <b>${q.item.label}</b>`,
        checkpoint: stageIdx,
      });
    }

    // ----- 찬스 (한 판에 한 번씩)
    function paintChances() {
      CHANCES.forEach((c) => chanceBtns[c.key].classList.toggle('spent', !chances[c.key]));
    }

    /** 🪄 아직 맞히지 못한 첫 칸에 정답 글자를 넣고 잠근다. */
    function giveLetter() {
      const i = q.slots.findIndex((s) => !s.locked);
      if (i < 0) return;
      const need = q.rep[i];
      if (q.slots[i].tile && q.slots[i].tile.ch !== need) takeBack(i);
      if (!q.slots[i].tile) {
        const tile =
          q.tiles.find((t) => t.ch === need && t.slot < 0 && !t.gone) ||
          q.tiles.find((t) => t.ch === need && t.slot >= 0 && !q.slots[t.slot].locked);
        if (!tile) return;
        if (tile.slot >= 0) takeBack(tile.slot);
        put(tile, i);
      }
      lock(i);
      fx.burst(q.slots[i].el, { count: 8, spread: 50, colors: ['#ffd43b', '#fff3c4'] });
    }

    function useChance(key) {
      if (!accepting || !game.playing || !chances[key]) return;
      chances[key] = false;
      paintChances();
      sfx('power');
      fx.flash('rgba(255,212,59,.16)');
      if (key === 'pass') {
        accepting = false;
        game.stopTimer();
        reveal();
        fx.toast(`패스! 정답은 <b>${q.item.label}</b>`, { ms: 1100 });
        game.after(1200, nextQuestion);
      } else if (key === 'magic') {
        if (q.mode === 'choice') {
          setHint(`🪄 첫 글자는 「${q.rep[0]}」`);
        } else {
          giveLetter();
          checkFull();
        }
      } else if (q.mode === 'choice') {
        // ✂️ 오답 보기 둘을 지운다
        shuffle(q.options.filter((o) => o.item !== q.item)).slice(0, 2).forEach((o) => {
          o.gone = true;
          o.el.classList.add('gone');
        });
      } else {
        // ✂️ 남은 가짜 글자의 절반을 지운다
        const fakes = shuffle(q.tiles.filter((t) => !t.real && !t.gone));
        fakes.slice(0, Math.ceil(fakes.length / 2)).forEach((t) => {
          if (t.slot >= 0) takeBack(t.slot);
          t.gone = true;
          t.el.classList.add('gone');
        });
      }
    }

    // ----- 라운드 진행
    async function runStage() {
      const st = STAGES[stageIdx];
      asked = 0;
      accepting = false;
      game.setStage(stageIdx, STAGES.length);
      game.setGoal(st.goal);
      game.hideTimer();
      progress.textContent = `문제 0 / ${decks[stageIdx].length}`;
      worth.classList.add('ar-hidden');
      emojiEl.innerHTML = '';
      setHint('');
      card.classList.remove('right', 'wrong');
      slotsEl.className = 'eq-slots ar-hidden';
      pad.innerHTML = '';
      paintChances();
      await game.banner(st.banner[0], st.banner[1], { ms: 1500 });
      nextQuestion();
    }

    async function stageClear() {
      game.stopTimer();
      fx.confetti(30);
      game.addScore(300, card);
      if (stageIdx >= STAGES.length - 1) return finish();
      stageIdx++;
      await runStage();
    }

    function finish() {
      const lost = game.config.lives - game.lives;
      const kept = CHANCES.filter((c) => chances[c.key]).length;
      const used = CHANCES.length - kept;
      if (kept) {
        game.addScore(kept * KEEP_BONUS, chanceBar);
        sfx('bonus');
        fx.toast(`아낀 찬스 ${kept}개! <b>+${kept * KEEP_BONUS}</b>`, { kind: 'gold', ms: 1200 });
      }
      const penalty = lost * 2 + used;
      let stars = penalty <= 1 ? 3 : penalty <= 3 ? 2 : 1;
      if (game.retry > 0) stars = Math.min(stars, 2);
      game.after(kept ? 900 : 300, () =>
        game.win({
          stars,
          title: stars === 3 ? '퀴즈왕 탄생!' : '퀴즈쇼 통과!',
          message:
            stars === 3
              ? '하트도 찬스도 아낀 완벽한 한 판!'
              : game.retry > 0
              ? '끝까지 포기하지 않았어요!'
              : '세 라운드를 모두 통과했어요!',
          stats: [
            ['정답', `${correctTotal} / ${askedTotal}`],
            ['최대 콤보', `${game.maxCombo}`],
            ['번개 정답', `${quickTotal}번`],
            ['아낀 찬스', `${kept}개`],
          ],
        })
      );
    }

    // 3라운드의 줄어드는 점수와 2라운드의 늦은 힌트
    game.loop(() => {
      if (!accepting || !timer) return;
      const st = STAGES[stageIdx];
      const ratio = timer.ratio();
      if (st.speed) {
        worth.textContent = `🔥 +${worthNow(ratio)}`;
        worth.classList.toggle('low', ratio < 0.35);
      } else if (st.mode === 'build' && S.autoHint && !q.hinted && ratio <= 0.5 && q.item.hint) {
        q.hinted = true;
        setHint('💡 ' + q.item.hint);
        sfx('pop');
      }
    });

    if (game.debug) {
      // 검증용: 상태를 보고, 정답·오답을 실제 입력과 같은 길로 대신 눌러 준다
      const clearSlots = () => q.slots.forEach((s, i) => !s.locked && takeBack(i));
      const need = () => q.slots.map((s, i) => (s.locked ? null : q.rep[i])).filter(Boolean);
      const tapLetters = (letters) =>
        letters.forEach((ch) => {
          const tile = q.tiles.find((t) => t.ch === ch && t.slot < 0 && !t.gone);
          if (tile) place(tile);
        });
      window.__game = {
        settings: () => S,
        poolSize: () => POOL.length,
        decks: () => decks.map((d) => d.map((x) => x.id)),
        accepting: () => accepting,
        state: () => ({
          stage: stageIdx,
          asked,
          accepting,
          mode: q && q.mode,
          id: q && q.item.id,
          answer: q && q.rep,
          time: q && q.time,
          left: timer ? timer.left() : 0,
          hint: hintEl.textContent,
          chances: Object.assign({}, chances),
          options: q && q.options ? q.options.map((o) => ({ label: o.item.label, gone: o.gone })) : null,
          slots: q && q.slots ? q.slots.map((s) => (s.tile ? s.tile.ch : '')) : null,
          locked: q && q.slots ? q.slots.map((s) => s.locked) : null,
          tiles: q && q.tiles ? q.tiles.map((t) => ({ ch: t.ch, real: t.real, slot: t.slot, gone: t.gone })) : null,
        }),
        answerRight() {
          if (q.mode === 'choice') return choose(q.options.find((o) => o.item === q.item));
          clearSlots();
          tapLetters(need());
        },
        answerWrong() {
          if (q.mode === 'choice') return choose(q.options.find((o) => o.item !== q.item && !o.gone));
          clearSlots();
          const letters = need();
          const fake = q.tiles.find((t) => !t.real && !t.gone);
          if (fake) letters[letters.length - 1] = fake.ch;
          else letters.reverse();
          tapLetters(letters);
        },
        useChance,
        /** 지금 문제를 원하는 문제로 바꾼다 (화면 모양 확인용) */
        ask(id) {
          const item = POOL.find((x) => x.id === id);
          if (!item || !q) return false;
          game.stopTimer();
          asked--;
          askedTotal--;
          decks[stageIdx][asked] = item;
          nextQuestion();
          return true;
        },
      };
    }

    runStage();
  }

  Arcade.createGame({
    id: GAME_ID,
    title: '이모지 퀴즈쇼',
    icon: '🤔',
    accent: '#ffd43b',
    accent2: '#ff7ab6',
    tagline: '이모지가 뜻하는 말은? 아, 그거구나!',
    howTo: [
      '이모지를 보고 답을 <b>고르거나</b>, <b>글자 타일</b>을 차례로 눌러 만들어요',
      '틀리거나 늦으면 <b>하트</b>가 줄어요',
      '찬스 🪄✂️⏭️ 는 <b>한 번씩</b>, 아끼면 보너스!',
    ],
    lives: S.lives,
    stages: STAGES.length,
    start,
  });
})();
