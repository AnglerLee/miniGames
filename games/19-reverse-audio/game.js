// 리버스 오디오: 거꾸로 해독반
// 거꾸로 재생되는 이상한 소리가 갑자기 "아, 그거다!" 하고 들리는 순간을 노리는 3스테이지 듣기 게임.
// 1 거꾸로 동요 → 2 외계인 통신(부모 녹음 · 녹음 대결 · 빠른 동요) → 3 속도 해독(다이얼로 원래 빠르기 찾기)
(function () {
  'use strict';

  const { h, shuffle, clamp, rand, sfx, fx } = Arcade;
  const { parseMelody, peaksFor, songClip, recordingMeta, loadRecordings, clipFromBlob, startSound, stopSound, retune, mic, closeMic } = window.ReverseSound;
  const GAME_ID = 'game19';
  const SETTINGS_KEY = 'reverseAudio_settings';

  // ----- 설정 (관리자 페이지와 같은 키를 쓴다)
  const PRESETS = [
    { questions: 3, maxHints: 3, listens: 4, battery: 8, questionTime: 30 },
    { questions: 3, maxHints: 2, listens: 3, battery: 6, questionTime: 25 },
    { questions: 4, maxHints: 1, listens: 3, battery: 6, questionTime: 20 },
  ];
  const LIMITS = { questions: [2, 5], maxHints: [0, 5], listens: [1, 6], battery: [0, 20], questionTime: [10, 90] };

  function readSettings() {
    const raw = Arcade.store.get(SETTINGS_KEY, null);
    const saved = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const isNew = saved.difficulty !== undefined;
    const level = clamp(parseInt(saved.difficulty, 10) || 0, 0, 2);
    // 예전 관리자 페이지는 { "0": { questions, maxHints }, "1": …, "2": … } 로 저장했고, 예전 게임은 쉬움(0)만 썼다
    const legacy = !isNew && saved[0] && typeof saved[0] === 'object' ? saved[0] : null;
    const src = isNew ? saved : legacy || {};
    const out = Object.assign({ level }, PRESETS[level]);
    Object.keys(LIMITS).forEach((key) => {
      const v = src[key];
      if (v === undefined || v === null || v === '' || !Number.isFinite(Number(v))) return;
      out[key] = clamp(Math.round(Number(v)), LIMITS[key][0], LIMITS[key][1]);
    });
    // 예전 questions 는 한 판 전체 문제 수였다. 지금은 스테이지당 문제 수라서 4개까지만 쓴다
    if (legacy && out.questions > 4) out.questions = 4;
    return out;
  }
  const S = readSettings();

  const TEMPO = [1, 1.1, 1.2][S.level]; // 난이도별 동요 빠르기
  const FAST = 1.35; // 2스테이지 "빠른 동요"
  const DETUNE = [[0.45, 0.75], [0.5, 0.85], [0.55, 0.95]][S.level]; // 3스테이지에서 빠르기가 틀어지는 정도(2의 지수)
  const LOCK = 0.09; // 다이얼이 이만큼 가까우면 신호가 잡힌다
  const BASE = [100, 150, 200]; // 스테이지별 정답 점수
  const EAR_BONUS = 150; // 한 번 듣고 맞히면
  const TWO_BONUS = 60; // 두 번 듣고 맞히면
  const CAN_RECORD = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);

  // ----- 동요: 저작권이 끝난 옛 노래의 앞부분만 음표로 적는다. "음이름:박자" (박자를 빼면 1박)
  // 학교종·산토끼·곰 세 마리는 작곡가 사후 70년이 지나지 않았거나 확실하지 않아 넣지 않았다.
  const SONGS = [
    { id: 'star', title: '반짝반짝 작은 별', icon: '⭐', bpm: 160, easy: true, notes: 'C4 C4 G4 G4 A4 A4 G4:2 F4 F4 E4 E4 D4 D4 C4:2' },
    { id: 'butterfly', title: '나비야', icon: '🦋', bpm: 160, easy: true, notes: 'G4 E4 E4:2 F4 D4 D4:2 C4 D4 E4 F4 G4 G4 G4:2' },
    { id: 'birthday', title: '생일 축하 노래', icon: '🎂', bpm: 130, easy: true, notes: 'G4:.75 G4:.25 A4 G4 C5 B4:2 G4:.75 G4:.25 A4 G4 D5 C5:2' },
    { id: 'plane', title: '비행기', icon: '✈️', bpm: 160, easy: true, notes: 'E4 D4 C4 D4 E4 E4 E4:2 D4 D4 D4:2 E4 G4 G4:2' },
    { id: 'jingle', title: '징글벨', icon: '🔔', bpm: 180, easy: true, notes: 'E4 E4 E4:2 E4 E4 E4:2 E4 G4 C4:1.5 D4:.5 E4:4' },
    { id: 'joy', title: '환희의 송가', icon: '🎻', bpm: 160, easy: true, notes: 'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4:1.5 D4:.5 D4:2' },
    { id: 'london', title: '런던 다리', icon: '🌉', bpm: 150, notes: 'G4:1.5 A4:.5 G4 F4 E4 F4 G4:2 D4 E4 F4:2 E4 F4 G4:2' },
    { id: 'farm', title: '올드 맥도날드', icon: '🐮', bpm: 160, notes: 'G4 G4 G4 D4 E4 E4 D4:2 B4 B4 A4 A4 G4:3' },
    { id: 'spider', title: '거미가 줄을 타고', icon: '🕷️', bpm: 120, notes: 'G4:.5 C5 C5:.5 C5 D5:.5 E5:1.5 E5 E5:.5 D5 C5:.5 D5 E5:.5 C5:1.5' },
    { id: 'clementine', title: '클레멘타인', icon: '🌊', bpm: 130, notes: 'C4:.75 C4:.25 C4 G3 E4:.75 E4:.25 E4 C4 C4:.75 E4:.25 G4:1.5 G4:.5 F4:.5 E4:.5 D4:2' },
    { id: 'elise', title: '엘리제를 위하여', icon: '🎹', bpm: 140, notes: 'E5:.5 D#5:.5 E5:.5 D#5:.5 E5:.5 B4:.5 D5:.5 C5:.5 A4:1.5 C4:.5 E4:.5 A4:.5 B4:1.5 E4:.5 G#4:.5 B4:.5 C5:1.5' },
    { id: 'susanna', title: '오! 수재너', icon: '🪕', bpm: 170, notes: 'C4:.5 D4:.5 E4 G4 G4:1.5 A4:.5 G4 E4 C4:1.5 D4:.5 E4 E4 D4 C4 D4:3' },
    { id: 'wedding', title: '결혼 행진곡', icon: '💒', bpm: 100, notes: 'G4 C5:.75 C5:.25 C5:2 G4 D5:.75 B4:.25 C5:2' },
  ];
  const FAMILIAR = SONGS.filter((s) => s.easy);
  const UNFAMILIAR = SONGS.filter((s) => !s.easy);
  SONGS.forEach((s) => (s.parsed = parseMelody(s.notes)));

  // 녹음 대결에서 소리 내어 말할 낱말. 거꾸로 해도 같은 말(토마토·기러기)은 뺐다
  const WORDS = [
    '사과', '바나나', '수박', '포도', '딸기', '고양이', '강아지', '호랑이', '코끼리', '원숭이', '거북이', '공룡', '상어', '펭귄',
    '자동차', '비행기', '자전거', '기차', '로봇', '냉장고', '컴퓨터', '시계', '우산', '안경', '연필', '지우개', '가방', '신발',
    '무지개', '눈사람', '해바라기', '선생님', '할머니', '할아버지', '떡볶이', '김밥', '라면', '피자', '햄버거', '초콜릿', '사탕',
    '축구공', '피아노', '운동장', '놀이터', '보물상자', '생일', '도서관', '소방차', '우주선', '외계인', '달팽이', '개구리', '나비',
    '장난감', '풍선', '미끄럼틀', '바다', '구름', '번개', '젤리', '팝콘', '도넛', '양말',
  ];

  const STAGES = [
    { name: '거꾸로 동요', banner: ['스테이지 1', '거꾸로 동요 🎵'], goal: '거꾸로 들리는 <b>동요</b>의 제목을 골라라' },
    { name: '외계인 통신', banner: ['스테이지 2', '외계인 통신 👽'], goal: '외계인 신호를 <b>해독</b>하라' },
    { name: '속도 해독', banner: ['마지막 스테이지', '속도 해독 📡 배터리를 아껴라'], goal: '<b>다이얼</b>을 움직여 원래 빠르기를 찾아라' },
  ];
  const GOAL2 = {
    parent: '거꾸로 된 <b>목소리</b>를 해독하라',
    duel: '한 명이 녹음, 다른 한 명이 <b>거꾸로</b> 듣고 맞혀라',
    fast: '<b>빨라진</b> 거꾸로 동요! 낯선 곡도 섞였다',
  };

  // ------------------------------------------------------------ 순수 함수 (검증 창구로도 연다)
  // 한글: 비슷하게 들리는 가짜 글자를 만든다 (모음을 바꾸거나, 비슷한 자음, 받침 바꾸기)
  const squash = (s) => String(s || '').replace(/\s+/g, '');
  const HANGUL = /^[가-힣]+$/;
  const VOWELS = [0, 4, 8, 13, 18, 20, 1, 5]; // ㅏ ㅓ ㅗ ㅜ ㅡ ㅣ ㅐ ㅔ
  const FINALS = [0, 4, 8, 16, 21, 1]; // 없음 ㄴ ㄹ ㅁ ㅇ ㄱ
  const NEAR = { 0: [15, 1], 1: [0], 15: [0], 3: [16, 4], 4: [3], 16: [3], 7: [17, 8], 8: [7], 17: [7], 12: [14, 13], 13: [12], 14: [12], 9: [10], 10: [9], 2: [5, 6], 5: [2], 6: [2, 7], 11: [18], 18: [11] };

  function soundAlike(ch) {
    if (!HANGUL.test(ch) || ch.length !== 1) return [];
    const c = ch.charCodeAt(0) - 0xac00;
    const i = Math.floor(c / 588);
    const v = Math.floor((c % 588) / 28);
    const f = c % 28;
    const make = (a, b, d) => String.fromCharCode(0xac00 + a * 588 + b * 28 + d);
    const out = new Set();
    VOWELS.forEach((x) => x !== v && out.add(make(i, x, f)));
    (NEAR[i] || []).forEach((x) => out.add(make(x, v, f)));
    FINALS.forEach((x) => x !== f && out.add(make(i, v, x)));
    out.delete(ch);
    return Array.from(out);
  }

  /** 정답 글자에 비슷한 소리의 가짜 글자를 섞어 total 개의 타일을 만든다. */
  function makeTiles(chars, total) {
    const banned = new Set(chars);
    const lists = chars.map((ch) => shuffle(soundAlike(ch)));
    const fake = [];
    const need = Math.max(0, total - chars.length);
    while (fake.length < need && lists.some((l) => l.length)) {
      lists.forEach((list) => {
        while (fake.length < need && list.length) {
          const x = list.pop();
          if (!banned.has(x) && !fake.includes(x)) {
            fake.push(x);
            break;
          }
        }
      });
    }
    return shuffle(chars.map((ch) => ({ ch, real: true })).concat(fake.map((ch) => ({ ch, real: false }))));
  }

  /** 낱말 보기 4개. 오답은 다른 문제의 답과 낱말 목록에서, 글자가 겹치거나 길이가 같은 것을 먼저 고른다. */
  function wordOptions(answer, others) {
    const rep = squash(answer);
    const seen = new Set([rep]);
    const cands = [];
    others.concat(WORDS).forEach((w) => {
      const s = squash(w);
      if (!s || seen.has(s) || s.includes(rep) || rep.includes(s)) return;
      seen.add(s);
      let score = Math.random();
      new Set(s).forEach((ch) => {
        if (rep.includes(ch)) score += 3;
      });
      if (s.length === rep.length) score += 2;
      cands.push({ w: String(w).trim(), score });
    });
    cands.sort((a, b) => b.score - a.score);
    return shuffle([String(answer).trim()].concat(cands.slice(0, 3).map((c) => c.w)));
  }

  const songOptions = (song, pool) => shuffle([song].concat(shuffle(pool.filter((s) => s !== song)).slice(0, 3)));
  const signalLevel = (off) => (off <= LOCK ? 4 : off <= 0.2 ? 3 : off <= 0.4 ? 2 : off <= 0.7 ? 1 : 0);

  // ------------------------------------------------------------ 판
  function start(game) {
    let stageIdx = game.checkpoint;
    let alive = true;
    let deck = [];
    let asked = 0;
    let q = null; // 지금 문제
    let phase = 'idle'; // idle | choose | secret | word | opening | recording | stopping | handover | question | reveal
    let accepting = false;
    let timer = null;
    let play = null; // 지금 재생 { clip, reverse, rate, offset, len, pos, purpose, handle, live }
    let lastPlay = null;
    let mode2 = null; // 2스테이지 방식: parent | duel | fast
    let dial = 0; // 3스테이지 다이얼 (-1 ~ 1)
    let lastLevel = null; // 마지막으로 들었을 때의 신호 세기
    let hintsLeft = S.maxHints;
    let hintsUsed = 0;
    const batteryMax = S.battery + Math.min(game.retry, 2) * 2;
    let battery = batteryMax;
    const maxPlays = S.listens + Math.min(game.retry, 2);
    const timeScale = 1 + Math.min(game.retry, 3) * 0.15;
    const stats = { asked: 0, correct: 0, perfect: 0, replays: 0 };
    const usedSongs = new Set();
    const usedRecs = new Set();
    const usedWords = new Set();
    const recsReady = loadRecordings(S.level);
    let recToken = null;

    // ----- 화면
    const progress = h('div', { class: 'ar-chip ra-progress' });
    const meter = h('div', { class: 'ar-chip ra-meter' });
    const modeTag = h('span', { class: 'ra-mode' });
    const status = h('span', { class: 'ra-status' });
    const canvas = h('canvas', { class: 'ra-wave' });
    const say = h('div', { class: 'ra-say ar-hidden' });
    const panel = h('div', { class: 'ra-panel ar-hidden' });
    const scope = h('div', { class: 'ra-scope' }, [
      h('div', { class: 'ra-scope-head' }, [modeTag, status]),
      h('div', { class: 'ra-wave-box' }, canvas),
      say,
      panel,
    ]);
    const range = h('input', { class: 'ra-range', type: 'range', min: -100, max: 100, step: 1, value: 0, 'aria-label': '빠르기 다이얼' });
    const signal = h('div', { class: 'ra-signal' }, [h('i'), h('i'), h('i'), h('i')]);
    const lockTag = h('span', { class: 'ra-lock', text: '📡 신호 잡힘!' });
    const dialEl = h('div', { class: 'ra-dial ar-hidden' }, [
      h('div', { class: 'ra-dial-head' }, [h('span', { text: '🐢 느리게' }), h('div', { class: 'ra-sigbox' }, [signal, lockTag]), h('span', { text: '빠르게 🐇' })]),
      range,
    ]);
    const slotsEl = h('div', { class: 'ra-slots ar-hidden' });
    game.root.append(h('div', { class: 'ra-board' }, [h('div', { class: 'ra-top' }, [progress, meter]), scope, dialEl, slotsEl]));

    const hintBtn = h('button', { class: 'ar-btn ghost ra-hint' });
    const listenBtn = h('button', { class: 'ar-btn ra-listen' });
    const ctrl = h('div', { class: 'ra-ctrl' }, [hintBtn, listenBtn]);
    const pad = h('div', { class: 'ra-pad' });
    game.footer.append(h('div', { class: 'ra-dock' }, [ctrl, pad]));
    /** 빨리 눌러야 하는 버튼은 pointerdown 으로 받는다 */
    const press = (el, fn) =>
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        fn();
      });
    hintBtn.addEventListener('click', () => useHint());
    listenBtn.addEventListener('click', () => listen(false));
    range.addEventListener('input', onDial);

    // ----- 파형 그리기
    const g2 = canvas.getContext('2d');
    const view = { peaks: null, from: 0, progress: -1, jitter: 0 };
    let dirty = true;

    function draw() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(canvas.clientWidth * dpr);
      const hh = Math.round(canvas.clientHeight * dpr);
      if (!w || !hh) return;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== hh) canvas.height = hh;
      g2.clearRect(0, 0, w, hh);
      g2.fillStyle = 'rgba(255,255,255,0.1)';
      g2.fillRect(0, Math.round(hh / 2 - dpr / 2), w, Math.max(1, dpr));
      const peaks = view.peaks;
      if (!peaks) return;
      const n = peaks.length;
      const gap = w / n;
      const bw = Math.max(dpr * 2, gap * 0.6);
      const grad = g2.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, '#ff7ab6');
      grad.addColorStop(1, '#7c5cff');
      for (let i = 0; i < n; i++) {
        let v = peaks[i];
        if (view.jitter > 0) v = clamp(v * (1 + (Math.random() - 0.5) * view.jitter * 1.4) + Math.random() * view.jitter * 0.3, 0, 1);
        const bh = Math.max(dpr * 3, v * hh * 0.82);
        const k = (i + 0.5) / n;
        const lit = view.progress >= 0 && k >= view.from && k <= view.progress;
        g2.fillStyle = lit ? grad : 'rgba(255,255,255,0.2)';
        g2.fillRect(i * gap + (gap - bw) / 2, (hh - bh) / 2, bw, bh);
      }
      if (view.progress >= 0) {
        g2.fillStyle = '#fff';
        g2.fillRect(Math.round(view.progress * w) - dpr, 0, dpr * 2, hh);
      }
    }

    // ----- 재생
    const listenRate = () => (stageIdx === 2 && q && q.detune !== undefined ? Math.pow(2, dial + q.detune) : 1);
    const offBy = () => (q && q.detune !== undefined ? Math.abs(dial + q.detune) : 0);
    const noiseLevel = () => clamp(offBy() / 0.6, 0, 1) * 0.16;

    /** 버퍼가 기대한 방향으로 들어갔는지 표본 몇 개로 확인한다 (검증용) */
    function flippedOk(buf, clip, reverse) {
      const d = buf.getChannelData(0);
      const src = clip.data;
      const n = src.length;
      if (d.length !== n) return false;
      return [0, 1, Math.floor(n / 3), Math.floor(n / 2), n - 2, n - 1].every((i) => d[i] === (reverse ? src[n - 1 - i] : src[i]));
    }

    function playClip(clip, opt) {
      endPlay();
      const offset = opt.offset || 0;
      const len = Math.min(clip.dur - offset, opt.len || Infinity);
      const live = stageIdx === 2 && opt.purpose === 'listen';
      const handle = startSound(clip, opt.reverse, opt.rate, offset, opt.len ? len : 0, live ? noiseLevel() : null);
      play = { clip, reverse: opt.reverse, rate: opt.rate, offset, len, pos: 0, purpose: opt.purpose, handle, live };
      if (handle) {
        handle.src.onended = () => {
          if (play && play.handle === handle) endPlay();
        };
      }
      const bufferOk = handle ? flippedOk(handle.src.buffer, clip, opt.reverse) : null;
      lastPlay = { purpose: opt.purpose, reverse: opt.reverse, rate: opt.rate, offset, len, dur: clip.dur, audio: !!handle, bufferOk, kind: q ? q.item.kind : null };
      view.peaks = peaksFor(clip, opt.reverse);
      view.from = offset / clip.dur;
      view.progress = view.from;
      view.jitter = 0;
      scope.classList.add('playing');
      scope.classList.toggle('fwd', !opt.reverse);
      status.textContent = opt.purpose === 'listen' ? '◀◀ 거꾸로' : opt.purpose === 'hint' ? '💡 앞으로' : '▶ 앞으로';
      paintButtons();
      dirty = true;
    }

    function endPlay() {
      if (!play) return null;
      const p = play;
      play = null;
      stopSound();
      view.progress = -1;
      view.jitter = 0;
      scope.classList.remove('playing', 'fwd');
      status.textContent = '';
      if (p.live) paintSignal();
      paintButtons();
      dirty = true;
      return p;
    }

    game.loop((dt) => {
      if (play) {
        play.pos += dt * play.rate;
        if (play.pos >= play.len) endPlay();
        else {
          view.progress = (play.offset + play.pos) / play.clip.dur;
          if (play.live) {
            const off = offBy();
            lastLevel = signalLevel(off);
            view.jitter = clamp(off / 0.6, 0, 1);
            paintSignal(true);
            status.textContent = lastLevel === 4 ? '📡 또렷!' : '지지직…';
          }
        }
        dirty = true;
      }
      if (dirty) {
        dirty = false;
        draw();
      }
    });

    // ----- 3스테이지 다이얼
    function onDial() {
      dial = clamp(Number(range.value) / 100, -1, 1);
      if (play && play.live) {
        const r = listenRate();
        play.rate = r;
        retune(play.handle, r, noiseLevel());
      } else {
        lastLevel = null; // 다이얼을 움직였으니 다시 들어 봐야 안다
        paintSignal();
      }
    }

    function paintSignal(live) {
      const level = lastLevel;
      Array.from(signal.children).forEach((el, i) => el.classList.toggle('on', level !== null && i < level));
      signal.classList.toggle('stale', !live);
      dialEl.classList.toggle('lock', !!live && level === 4);
    }

    // ----- 위쪽 표시와 버튼
    function paintMeter() {
      if (stageIdx === 2) {
        meter.innerHTML = '';
        meter.className = 'ar-chip ra-meter batt' + (battery <= 1 ? ' low' : '');
        meter.append(h('span', { class: 'ra-cell' }, h('i', { style: { width: Math.round((battery / Math.max(1, batteryMax)) * 100) + '%' } })), h('b', { text: String(battery) }));
      } else {
        meter.className = 'ar-chip ra-meter';
        const left = q ? Math.max(0, maxPlays - q.plays) : maxPlays;
        meter.textContent = `🎧 듣기 ${left}/${maxPlays}`;
        meter.classList.toggle('low', !!q && left === 0);
      }
    }

    function paintButtons() {
      const can = !!q && accepting && phase === 'question';
      const listening = !!play && play.purpose === 'listen';
      hintBtn.innerHTML = `💡 힌트 <b>${hintsLeft}</b>`;
      hintBtn.disabled = !can || hintsLeft <= 0 || listening;
      let label = '▶ 거꾸로 듣기';
      let off = !can || listening;
      if (listening) label = '🔊 듣는 중…';
      else if (q && stageIdx === 2) {
        if (q.plays > 0) label = battery > 0 ? '▶ 다시 듣기 🔋-1' : '🔋 배터리 없음';
        off = off || (q.plays > 0 && battery <= 0);
      } else if (q && q.plays > 0) {
        const left = maxPlays - q.plays;
        label = left > 0 ? `▶ 다시 듣기 (${left})` : '듣기 끝';
        off = off || left <= 0;
      }
      listenBtn.textContent = label;
      listenBtn.disabled = off;
    }

    function showPanel(icon, title, text, kind) {
      panel.className = 'ra-panel' + (kind ? ' ' + kind : '');
      panel.innerHTML = '';
      panel.append(h('div', { class: 'i', text: icon }), h('div', { class: 't', text: title }));
      if (text) panel.append(h('div', { class: 's', html: text }));
      if (kind === 'rec') panel.append(h('div', { class: 'ra-recbar' }, h('i')));
      say.classList.add('ar-hidden');
      meter.classList.add('ar-hidden'); // 녹음 대결 단계에서는 듣기 횟수가 필요 없다
    }
    const hidePanel = () => (panel.className = 'ra-panel ar-hidden');

    /** 아래쪽에 큰 버튼 몇 개를 놓는다 (녹음 대결 단계용) */
    function setPad(kind, buttons) {
      pad.className = 'ra-pad ' + kind;
      pad.innerHTML = '';
      buttons.forEach((b) => {
        const el = h('button', { class: 'ar-btn ' + (b.cls || ''), text: b.text });
        el.addEventListener('click', () => {
          if (!game.playing) return;
          sfx('tap');
          b.fn();
        });
        pad.appendChild(el);
      });
    }

    function clearBoard() {
      endPlay();
      q = null;
      accepting = false;
      hidePanel();
      say.classList.add('ar-hidden');
      slotsEl.className = 'ra-slots ar-hidden';
      dialEl.classList.add('ar-hidden');
      pad.className = 'ra-pad';
      pad.innerHTML = '';
      view.peaks = null;
      modeTag.textContent = '';
      dirty = true;
    }

    // ----- 문제 내기
    function pickSongs(k, pools) {
      const out = [];
      for (const pool of pools.concat([SONGS])) {
        for (const s of shuffle(pool)) {
          if (out.length >= k) break;
          if (!usedSongs.has(s.id) && !out.includes(s)) out.push(s);
        }
      }
      while (out.length < k) out.push(shuffle(SONGS)[0]); // 곡이 모자라면 겹쳐도 낸다
      out.forEach((s) => usedSongs.add(s.id));
      return out;
    }
    const songItem = (song, tempo, pool) => ({ kind: 'song', song, tempo, pool });
    const voiceItem = (r) => {
      usedRecs.add(r.id);
      return { kind: 'voice', answer: r.answer, clip: r.clip, id: r.id };
    };
    function fastSongs(k) {
      const half = Math.ceil(k / 2);
      return shuffle(pickSongs(half, [UNFAMILIAR]).concat(pickSongs(k - half, [FAMILIAR]))).map((s) => songItem(s, TEMPO * FAST, SONGS));
    }

    async function buildDeck() {
      const n = S.questions;
      if (stageIdx === 0) return pickSongs(n, [FAMILIAR]).map((s) => songItem(s, TEMPO, FAMILIAR));
      const recs = await recsReady;
      if (!alive) return [];
      const fresh = recs.filter((r) => !usedRecs.has(r.id));
      if (stageIdx === 1) {
        if (fresh.length) {
          mode2 = 'parent';
          const items = fresh.slice(0, n).map(voiceItem);
          return items.concat(fastSongs(n - items.length));
        }
        mode2 = CAN_RECORD ? await chooseMode() : 'fast';
        if (mode2 === 'duel') return Array.from({ length: n }, () => ({ kind: 'duel' }));
        return fastSongs(n);
      }
      // 3스테이지: 아직 안 나온 부모 녹음을 절반까지 섞는다
      const voices = fresh.slice(0, Math.ceil(n / 2)).map(voiceItem);
      return shuffle(voices.concat(pickSongs(n - voices.length, [UNFAMILIAR, FAMILIAR]).map((s) => songItem(s, TEMPO, SONGS))));
    }

    function chooseMode() {
      return new Promise((resolve) => {
        phase = 'choose';
        ctrl.classList.add('ar-hidden');
        progress.textContent = '통신 준비';
        modeTag.textContent = '👽 외계인 통신';
        showPanel('👽', '녹음된 통신이 없어요', '같이 할 사람이 있으면 <b>녹음 대결</b>!<br>혼자라면 <b>빠른 동요</b>로 가요');
        setPad('duo', [
          { text: '🎙️ 녹음 대결', fn: () => resolve('duel') },
          { text: '🎵 혼자 할래요', cls: 'ghost', fn: () => resolve('fast') },
        ]);
      });
    }

    function nextQuestion() {
      if (!alive) return;
      if (asked >= deck.length) return stageClear();
      const item = deck[asked++];
      if (item.kind === 'duel') return duelRound(item);
      beginQuestion(item);
    }

    function progressText() {
      const what = stageIdx === 1 && mode2 === 'duel' ? '대결' : '문제';
      return `${what} ${asked} / ${deck.length}`;
    }

    function beginQuestion(item) {
      clearBoard();
      const clip = item.clip || songClip(item.song, item.tempo);
      const answer = item.kind === 'song' ? item.song.title : String(item.answer).trim();
      const rep = squash(answer);
      const tiles = item.kind === 'voice' && HANGUL.test(rep) && rep.length >= 2 && rep.length <= 5;
      q = { item, clip, answer, rep, mode: tiles ? 'tiles' : 'choice', plays: 0, hinted: false, misses: 0 };
      stats.asked++;
      phase = 'question';
      progress.textContent = progressText();
      modeTag.textContent = stageIdx === 2 ? '📡 빠르기가 틀어진 신호' : item.kind === 'song' ? (item.tempo > TEMPO ? '🎵 빨라진 거꾸로 동요' : '🎵 거꾸로 동요') : '👽 거꾸로 목소리';
      view.peaks = peaksFor(clip, true);
      if (stageIdx === 2) {
        q.detune = (Math.random() < 0.5 ? -1 : 1) * rand(DETUNE[0], DETUNE[1]);
        dial = 0;
        range.value = '0';
        lastLevel = null;
        dialEl.classList.remove('ar-hidden');
        paintSignal();
      }
      if (q.mode === 'choice') renderChoices();
      else renderTiles();
      ctrl.classList.remove('ar-hidden');
      meter.classList.remove('ar-hidden');
      q.time = S.questionTime * [1, 1.2, 1.4][stageIdx] * timeScale;
      timer = game.startTimer(q.time, { onEnd: timeUp, warnAt: 5 });
      accepting = true;
      paintMeter();
      paintButtons();
      sfx('whoosh');
      // 첫 번째 듣기는 저절로 시작한다
      game.after(550, () => {
        if (q && q.item === item && accepting && q.plays === 0 && !play) listen(true);
      });
    }

    function listen(auto) {
      if (!q || !accepting || phase !== 'question' || !game.playing) return;
      if (play && play.purpose === 'listen') return;
      if (stageIdx === 2) {
        if (q.plays > 0) {
          if (battery <= 0) {
            fx.toast('🔋 배터리가 없어요. 감으로 골라요!', { kind: 'bad', ms: 1000 });
            sfx('miss');
            return;
          }
          battery--;
        }
      } else if (q.plays >= maxPlays) return;
      q.plays++;
      if (q.plays > 1) stats.replays++;
      if (!auto) sfx('tap');
      playClip(q.clip, { reverse: true, rate: listenRate(), purpose: 'listen' });
      paintMeter();
    }

    function useHint() {
      if (!q || !accepting || phase !== 'question' || !game.playing || hintsLeft <= 0) return;
      if (play && play.purpose === 'listen') return;
      hintsLeft--;
      hintsUsed++;
      q.hinted = true;
      sfx('power');
      fx.toast('💡 앞으로 살짝!', { kind: 'gold', ms: 900 });
      const len = q.item.kind === 'song' ? 1.2 : clamp(q.clip.dur * 0.45, 0.4, 1);
      playClip(q.clip, { reverse: false, rate: 1, len, purpose: 'hint' });
    }

    // ----- 4지선다
    function renderChoices() {
      pad.className = 'ra-pad choice';
      pad.innerHTML = '';
      const others = () => Array.from(new Set(recordingMeta(S.level).map((r) => r.answer).concat(deck.filter((d) => d.word).map((d) => d.word))));
      const list = q.item.kind === 'song' ? songOptions(q.item.song, q.item.pool) : wordOptions(q.answer, others());
      q.options = list.map((o) => {
        const isSong = typeof o !== 'string';
        const label = isSong ? o.title : o;
        const el = h('button', { class: 'ar-btn ra-opt' }, isSong ? [h('span', { class: 'i', text: o.icon }), h('span', { class: 't', text: o.title })] : [h('span', { class: 't', text: o })]);
        const opt = { label, right: label === q.answer, el };
        press(el, () => choose(opt));
        pad.appendChild(el);
        return opt;
      });
    }

    function choose(opt) {
      if (!accepting || phase !== 'question' || !game.playing) return;
      accepting = false;
      endPlay();
      if (opt.right) {
        opt.el.classList.add('right');
        return correct(opt.el);
      }
      opt.el.classList.add('wrong');
      q.options.forEach((o) => {
        if (o.right) o.el.classList.add('right');
        else if (o !== opt) o.el.classList.add('dim');
      });
      miss(opt.el, `정답은 <b>${q.answer}</b>`);
    }

    // ----- 글자 타일 조립
    function renderTiles() {
      slotsEl.className = 'ra-slots';
      slotsEl.innerHTML = '';
      slotsEl.dataset.n = String(q.rep.length);
      q.slots = Array.from(q.rep).map((_, i) => {
        const slot = { el: h('button', { class: 'ra-slot', 'aria-label': `${i + 1}번째 칸` }), tile: null, locked: false };
        press(slot.el, () => tapSlot(i));
        slotsEl.appendChild(slot.el);
        return slot;
      });
      pad.className = 'ra-pad tiles';
      pad.innerHTML = '';
      q.tiles = makeTiles(Array.from(q.rep), 8).map((t) => {
        const tile = { ch: t.ch, real: t.real, el: h('button', { class: 'ra-tile', text: t.ch }), slot: -1 };
        press(tile.el, () => place(tile));
        pad.appendChild(tile.el);
        return tile;
      });
    }

    function put(tile, i) {
      const slot = q.slots[i];
      slot.tile = tile;
      tile.slot = i;
      tile.el.classList.add('used');
      slot.el.textContent = tile.ch;
      slot.el.classList.add('full');
      fx.pop(slot.el);
    }

    function takeBack(i) {
      const slot = q.slots[i];
      if (!slot.tile) return;
      slot.tile.slot = -1;
      slot.tile.el.classList.remove('used');
      slot.tile = null;
      slot.el.textContent = '';
      slot.el.classList.remove('full', 'wrong');
    }

    function place(tile) {
      if (!accepting || phase !== 'question' || !game.playing || tile.slot >= 0) return;
      const i = q.slots.findIndex((s) => !s.tile);
      if (i < 0) return;
      put(tile, i);
      Arcade.audio.tone({ freq: 520 + i * 70, type: 'triangle', dur: 0.07, vol: 0.18 });
      if (q.slots.every((s) => s.tile)) {
        accepting = false;
        timer.pause();
        paintButtons();
        game.after(260, grade);
      }
    }

    function tapSlot(i) {
      if (!accepting || phase !== 'question' || !game.playing) return;
      const slot = q.slots[i];
      if (!slot.tile || slot.locked) return;
      takeBack(i);
      sfx('tap');
    }

    function grade() {
      const made = q.slots.map((s) => s.tile.ch).join('');
      if (made === q.rep) {
        slotsEl.classList.add('right');
        endPlay();
        return correct(slotsEl);
      }
      q.misses++;
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
            s.locked = true;
            s.el.classList.add('locked');
            kept++;
          } else takeBack(i);
        });
        fx.toast(kept ? '초록 글자는 맞았어! 다시 들어 봐' : '다시 들어 보고 조립해!', { ms: 1100 });
        timer.resume();
        accepting = true;
        paintButtons();
      });
    }

    // ----- 판정
    function correct(at) {
      const ratio = timer ? timer.ratio() : 0;
      game.stopTimer();
      const combo = game.addCombo();
      const mult = 1 + Math.min(combo - 1, 4) * 0.25; // 콤보마다 25%씩, 최대 2배
      let pts = BASE[stageIdx] + Math.round(ratio * 50);
      let ear = false;
      if (!q.hinted && !q.misses && q.plays === 1) {
        ear = true;
        pts += EAR_BONUS;
        stats.perfect++;
        if (stageIdx === 2) battery = Math.min(batteryMax, battery + 1);
      } else if (!q.hinted && !q.misses && q.plays === 2) pts += TWO_BONUS;
      game.addScore(Math.round(pts * mult), at);
      stats.correct++;
      sfx(ear ? 'perfect' : 'great');
      fx.burst(at, { count: ear ? 18 : 10, spread: 110 });
      if (ear) {
        fx.toast(stageIdx === 2 ? '🎯 절대 청각! 🔋+1' : '🎯 절대 청각!', { kind: 'gold', ms: 1100 });
        fx.flash('rgba(255,209,102,.22)');
        Arcade.vibrate(40);
      }
      paintMeter();
      reveal(true);
    }

    function miss(at, text) {
      game.stopTimer();
      game.resetCombo();
      sfx('bad');
      fx.shake(scope, 8);
      if (game.lives > 1) fx.toast(text, { kind: 'bad', ms: 1300 }); // 마지막 하트라면 실패 화면이 정답을 알려 준다
      if (game.loseLife(at) <= 0) return fail();
      reveal(false);
    }

    function timeUp() {
      if (!q || phase !== 'question' || !accepting) return;
      accepting = false;
      endPlay();
      if (q.mode === 'choice') q.options.forEach((o) => o.el.classList.add(o.right ? 'right' : 'dim'));
      miss(scope, `시간 초과! 정답은 <b>${q.answer}</b>`);
    }

    /** 정답을 보여 주고 앞으로 들려준다. "아, 그거였구나!" 하는 순간 */
    function reveal(right) {
      phase = 'reveal';
      accepting = false;
      paintButtons();
      if (q.mode === 'tiles') {
        q.slots.forEach((s, i) => {
          s.el.textContent = q.rep[i];
          s.el.className = 'ra-slot full ' + (right ? 'locked' : 'reveal');
        });
        pad.classList.add('off');
      }
      const icon = q.item.kind === 'song' ? q.item.song.icon + ' ' : '';
      say.innerHTML = '';
      say.append(h('div', { class: 'k', text: right ? '정답!' : '정답은' }), h('div', { class: 'v', text: icon + q.answer }), h('div', { class: 's', text: '▶ 앞으로 들으면…' }));
      say.className = 'ra-say' + (right ? '' : ' bad');
      // 노래는 원래 빠르기로 들려준다 (빠른 동요도 정답 확인은 보통 빠르기)
      const clip = q.item.kind === 'song' && q.item.tempo !== TEMPO ? songClip(q.item.song, TEMPO) : q.clip;
      const len = Math.min(clip.dur, 3);
      playClip(clip, { reverse: false, rate: 1, len, purpose: 'reveal' });
      const item = q.item;
      game.after(Math.max(1500, len * 1000 + 450), () => {
        if (!q || q.item !== item) return;
        endPlay();
        nextQuestion();
      });
    }

    function fail() {
      endPlay();
      game.lose({
        message: `${STAGES[stageIdx].name}에서 하트를 모두 잃었어요.<br>마지막 정답은 <b>${q.answer}</b>`,
        checkpoint: stageIdx,
      });
    }

    // ----- 녹음 대결: 한 사람이 몰래 녹음하고, 폰을 넘겨 다른 사람이 거꾸로 듣고 맞힌다
    function pickWord() {
      const fresh = WORDS.filter((w) => !usedWords.has(w));
      const w = shuffle(fresh.length ? fresh : WORDS)[0];
      usedWords.add(w);
      return w;
    }

    function duelRound(item) {
      clearBoard();
      game.hideTimer();
      ctrl.classList.add('ar-hidden');
      progress.textContent = progressText();
      modeTag.textContent = '🎙️ 녹음 대결';
      paintMeter();
      if (!item.word) item.word = pickWord();
      let fails = 0;
      phase = 'secret';
      showPanel('🤫', '녹음할 사람만 보세요!', '듣는 사람은 잠깐 <b>눈을 감아요</b>');
      setPad('one', [{ text: '👀 낱말 보기', fn: showWord }]);

      function showWord() {
        phase = 'word';
        showPanel('🎙️', item.word, '이 말을 <b>또박또박</b> 녹음해요 · 3초', 'word');
        setPad('duo', [
          { text: '● 녹음', cls: 'bad', fn: record },
          { text: '🔄 다른 낱말', cls: 'ghost', fn: () => ((item.word = pickWord()), showWord()) },
        ]);
      }
      item.showWord = showWord;

      async function record() {
        if (phase !== 'word') return;
        phase = 'opening';
        showPanel('🎙️', '마이크 준비 중…', '권한 창이 뜨면 <b>허용</b>을 눌러요');
        setPad('one', []);
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).catch(() => null);
        if (!alive || phase !== 'opening') {
          if (stream) stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (!stream) return micFailed('마이크를 쓸 수 없어요. 빠른 동요로!');
        let rec = null;
        try {
          rec = new MediaRecorder(stream);
        } catch (e) {
          stream.getTracks().forEach((t) => t.stop());
          return micFailed('녹음을 할 수 없어요. 빠른 동요로!');
        }
        mic.stream = stream;
        mic.rec = rec;
        const chunks = [];
        const token = {};
        recToken = token;
        rec.ondataavailable = (e) => {
          if (e.data && e.data.size) chunks.push(e.data);
        };
        rec.onstop = async () => {
          const type = rec.mimeType || 'audio/webm';
          closeMic(); // 마이크를 켜 둔 채로는 아이폰 소리가 작아진다
          if (!alive || recToken !== token || phase !== 'stopping') return;
          const clip = await clipFromBlob(new Blob(chunks, { type }));
          if (!alive || recToken !== token || phase !== 'stopping') return;
          if (!clip) {
            fails++;
            if (fails >= 2) return micFailed('녹음이 잘 안 돼요. 빠른 동요로!');
            fx.toast('소리가 잘 안 들렸어요. 다시!', { kind: 'bad', ms: 1200 });
            return showWord();
          }
          item.clip = clip;
          handover();
        };
        const t0 = game.time;
        const stopRec = () => {
          if (phase !== 'recording' || recToken !== token || game.time - t0 < 0.5) return;
          phase = 'stopping';
          showPanel('⏳', '녹음 정리 중…', '');
          setPad('one', []);
          try {
            rec.stop();
          } catch (e) {
            closeMic();
            showWord();
          }
        };
        try {
          rec.start();
        } catch (e) {
          closeMic();
          return micFailed('녹음을 할 수 없어요. 빠른 동요로!');
        }
        phase = 'recording';
        sfx('pop');
        showPanel('🔴', '녹음 중…', `「${item.word}」 또박또박!`, 'rec');
        setPad('one', [{ text: '⏹ 녹음 끝', cls: 'gold', fn: stopRec }]);
        game.after(3000, stopRec);
      }

      function handover() {
        phase = 'handover';
        sfx('whoosh');
        showPanel('📱', '폰을 넘겨요!', '듣는 사람이 준비되면 누르세요');
        setPad('duo', [
          { text: '👂 준비 완료', cls: 'good', fn: () => beginQuestion({ kind: 'voice', answer: item.word, clip: item.clip, duel: true }) },
          { text: '🔁 다시 녹음', cls: 'ghost', fn: showWord },
        ]);
      }
    }

    /** 녹음을 할 수 없으면 남은 대결을 빠른 동요로 바꾼다 */
    function micFailed(text) {
      closeMic();
      recToken = null;
      mode2 = 'fast';
      fx.toast(text, { kind: 'bad', ms: 1600 });
      game.setGoal(GOAL2.fast);
      const done = asked - 1;
      deck = deck.slice(0, done).concat(fastSongs(deck.length - done));
      asked = done;
      phase = 'idle';
      game.after(700, nextQuestion);
    }

    // ----- 스테이지 진행
    async function runStage() {
      clearBoard();
      asked = 0;
      phase = 'idle';
      mode2 = stageIdx === 1 ? null : mode2;
      game.setStage(stageIdx, STAGES.length);
      game.hideTimer();
      game.setGoal(STAGES[stageIdx].goal);
      ctrl.classList.add('ar-hidden');
      progress.textContent = `문제 0 / ${S.questions}`;
      paintMeter();
      const [title, sub] = STAGES[stageIdx].banner;
      await game.banner(title, sub, { ms: 1400 });
      if (!alive) return;
      deck = await buildDeck();
      if (!alive) return;
      if (stageIdx === 1) game.setGoal(GOAL2[mode2]);
      nextQuestion();
    }

    async function stageClear() {
      clearBoard();
      game.hideTimer();
      phase = 'idle';
      sfx('stage');
      fx.confetti(30);
      game.addScore(200, scope);
      const last = stageIdx >= STAGES.length - 1;
      if (stageIdx === 2 && battery > 0) {
        game.addScore(battery * 40, meter);
        fx.toast(`남은 배터리 ${battery}칸 <b>+${battery * 40}</b>`, { kind: 'gold', ms: 1200 });
      }
      if (last) return game.after(battery > 0 ? 900 : 400, finish);
      stageIdx++;
      await game.wait(500);
      runStage();
    }

    function finish() {
      const lost = game.config.lives - game.lives;
      let stars = 3;
      if (lost >= 1 || hintsUsed > 0 || stats.replays > stats.asked) stars = 2;
      if (lost >= 2) stars = 1;
      if (game.retry > 0) stars = Math.min(stars, 2);
      game.win({
        stars,
        title: stars === 3 ? '절대 청각 인정!' : '해독 성공!',
        message: stars === 3 ? '적게 듣고 다 맞혔어요. 귀가 정말 좋아요!' : game.retry > 0 ? '끝까지 포기하지 않고 해독했어요!' : '거꾸로 된 소리를 모두 해독했어요!',
        stats: [
          ['정답', `${stats.correct} / ${stats.asked}`],
          ['절대 청각', `${stats.perfect}번`],
          ['최대 콤보', `${game.maxCombo}`],
          ['다시 듣기 · 힌트', `${stats.replays}번 · ${hintsUsed}번`],
        ],
      });
    }

    // 일시 정지하면 소리와 녹음을 멈춘다. 끊긴 다시 듣기는 돌려준다
    game.onPauseChange((paused) => {
      if (!paused) return;
      const p = endPlay();
      if (p && p.purpose === 'listen' && q) {
        if (q.plays > 1) {
          stats.replays--;
          if (stageIdx === 2) battery++;
        }
        q.plays = Math.max(0, q.plays - 1);
        paintMeter();
        paintButtons();
      }
      if (phase === 'opening' || phase === 'recording' || phase === 'stopping') {
        recToken = null;
        closeMic();
        const item = deck[asked - 1];
        if (item && item.showWord) item.showWord();
      }
    });

    game.onCleanup(() => {
      alive = false;
      endPlay();
      stopSound();
      closeMic();
    });

    if (game.debug) {
      // 검증용: 상태 보기, 실제 입력과 같은 길로 정답·오답 누르기, 순수 함수
      const need = () => q.slots.map((s, i) => (s.locked ? null : q.rep[i])).filter(Boolean);
      const clearSlots = () => q.slots.forEach((s, i) => !s.locked && takeBack(i));
      const tapLetters = (letters) =>
        letters.forEach((ch) => {
          const tile = q.tiles.find((t) => t.ch === ch && t.slot < 0);
          if (tile) place(tile);
        });
      window.__game = {
        settings: () => Object.assign({}, S),
        accepting: () => !!q && accepting && phase === 'question',
        state: () => ({
          stage: stageIdx, phase, mode2, asked, deck: deck.length, maxPlays, battery, batteryMax, hintsLeft, hintsUsed, dial,
          kind: q ? q.item.kind : null, duel: !!(q && q.item.duel), answer: q ? q.answer : null, mode: q ? q.mode : null,
          plays: q ? q.plays : 0, time: q ? q.time : 0, detune: q && q.detune !== undefined ? q.detune : null, level: lastLevel,
          playing: play ? play.purpose : null, rate: play ? play.rate : null, mic: !!mic.stream, stats: Object.assign({}, stats),
          options: q && q.options ? q.options.map((o) => o.label) : null,
          slots: q && q.slots ? q.slots.map((s) => (s.tile ? s.tile.ch : '')) : null,
          tiles: q && q.tiles ? q.tiles.map((t) => t.ch) : null,
          word: deck[asked - 1] && deck[asked - 1].word,
        }),
        lastPlay: () => lastPlay,
        listen: () => listen(false),
        stop: () => !!endPlay(),
        hint: () => useHint(),
        setDial(v) {
          range.value = String(Math.round(clamp(v, -1, 1) * 100));
          onDial();
        },
        answerRight() {
          if (!q || phase !== 'question') return false;
          if (q.mode === 'choice') return choose(q.options.find((o) => o.right));
          clearSlots();
          tapLetters(need());
          return true;
        },
        answerWrong() {
          if (!q || phase !== 'question') return false;
          if (q.mode === 'choice') return choose(q.options.find((o) => !o.right));
          clearSlots();
          const letters = need();
          const fake = q.tiles.find((t) => !t.real && t.slot < 0);
          letters[letters.length - 1] = fake ? fake.ch : letters[0];
          tapLetters(letters);
          return true;
        },
        songs: () => SONGS.map((s) => ({ id: s.id, title: s.title, bpm: s.bpm, easy: !!s.easy, notes: s.parsed.map((n) => [n.name, n.midi, n.beats]) })),
        recordings: () => recsReady.then((list) => list.map((r) => ({ id: r.id, answer: r.answer, dur: r.clip.dur }))),
        pure: Object.assign({ soundAlike, makeTiles, wordOptions, signalLevel }, window.ReverseSound),
      };
    }

    runStage();
  }

  Arcade.createGame({
    id: GAME_ID,
    title: '리버스 오디오',
    icon: '🔄',
    accent: '#7c5cff',
    accent2: '#ff7ab6',
    tagline: '거꾸로 해독반 출동! 🔊 소리를 켜고, 이상한 소리의 정체를 밝혀라',
    howTo: [
      '<b>거꾸로</b> 재생되는 동요와 목소리를 듣고 맞혀요',
      '<b>적게 듣고</b> 맞힐수록 점수 UP. 한 번에 맞히면 <b>절대 청각!</b>',
      '틀리면 하트 -1. 💡 힌트는 <b>앞으로</b> 살짝 들려줘요',
    ],
    lives: 3,
    stages: STAGES.length,
    music: false, // 이 게임은 소리를 들어야 한다. 배경 리듬은 끈다
    startLabel: '🎧 해독 시작',
    start,
    onEnd() {
      // 결과·실패 화면에서는 소리와 마이크를 끈다
      stopSound();
      closeMic();
    },
  });
})();
