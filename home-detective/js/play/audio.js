// 소리. 소리 파일 없이 Web Audio 로 그 자리에서 합성한다.
// 규격은 그대로 지킨다 (다른 모듈이 이 이름으로 부른다).
//
//   audio.unlock()            첫 터치에서 부른다 (모바일은 터치 뒤에만 소리가 난다)
//   audio.sfx(name)           효과음. 모르는 이름은 조용히 무시한다.
//   audio.music.start()       배경 음악 시작 (이미 켜져 있으면 그대로)
//   audio.music.stop()
//   audio.music.setTension(v) 0(여유) ~ 1(시간 초과). 빠르기와 세기가 따라 오른다.
//   audio.setMuted(bool) / audio.muted()   설정은 localStorage 'minigames:homeDetective_muted' 에 남긴다
//
// 지키는 약속
// - Node 에서 import 해도 터지지 않게 최상위에서 window/document/localStorage 를 건드리지 않는다.
// - AudioContext 가 없거나 unlock 전이면 모든 함수가 조용히 아무 일도 하지 않는다. 예외를 밖으로 내보내지 않는다.
// - unlock 전에 music.start() 가 불리면 "켜 달라"는 뜻만 기억했다가 unlock 때 시작한다.

const MUTE_KEY = 'minigames:homeDetective_muted';
const SAME_SFX_MS = 30; // 같은 효과음이 이 안에 또 불리면 건너뛴다 (겹쳐 커지는 것 막기)
const LOOKAHEAD = 0.14; // 음악은 이만큼 앞서 예약한다 (초)
const TIMER_MS = 25;

let ac = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let noiseBuf = null;
let unlocked = false;
let listening = false;
let suspendedByUs = false;
let mutedFlag = null; // null 이면 아직 저장소를 읽지 않았다
const lastSfx = new Map();

function nowMs() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}

function readMuted() {
  if (mutedFlag === null) {
    mutedFlag = false;
    try {
      if (typeof localStorage !== 'undefined') mutedFlag = localStorage.getItem(MUTE_KEY) === '1';
    } catch (e) {
      /* 저장소를 못 쓰는 브라우저(사생활 보호 모드 등) */
    }
  }
  return mutedFlag;
}

function ensureContext() {
  if (ac) return ac;
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ac = new AC();
  } catch (e) {
    ac = null;
    return null;
  }
  master = ac.createGain();
  master.gain.value = readMuted() ? 0 : 1;
  // 효과음이 몰려도 찢어지지 않게 마지막에 가볍게 눌러 준다
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 10;
  comp.ratio.value = 4;
  comp.attack.value = 0.004;
  comp.release.value = 0.2;
  master.connect(comp);
  comp.connect(ac.destination);
  sfxBus = ac.createGain();
  sfxBus.gain.value = 0.9;
  sfxBus.connect(master);
  musicBus = ac.createGain();
  musicBus.gain.value = 0.32;
  musicBus.connect(master);
  return ac;
}

/** 지금 소리를 만들어도 되는가 */
function live() {
  return !!(unlocked && ac && ac.state !== 'closed' && !readMuted());
}

// ------------------------------------------------------------ 소리 재료

/** 음 하나. at 은 오디오 시계의 절대 시각(초). lp 를 주면 그 위를 깎아 부드럽게 한다. */
function tone({ f, to = 0, type = 'sine', dur = 0.15, vol = 0.2, at, attack = 0.005, lp = 0, bus = sfxBus, detune = 0 }) {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, at);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(1, to), at + dur);
  if (detune) o.detune.setValueAtTime(detune, at);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + Math.min(attack, dur * 0.5));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  let out = o;
  if (lp) {
    const flt = ac.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(lp, at);
    o.connect(flt);
    out = flt;
  }
  out.connect(g);
  g.connect(bus);
  o.start(at);
  o.stop(at + dur + 0.05);
}

/** 거른 잡음 한 토막 (쓸림, 종이, 지직, 하이햇) */
function noise({ dur = 0.2, vol = 0.15, at, f = 1500, to = 0, q = 0.8, filter = 'bandpass', attack = 0.006, bus = sfxBus }) {
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const flt = ac.createBiquadFilter();
  flt.type = filter;
  flt.Q.setValueAtTime(q, at);
  flt.frequency.setValueAtTime(f, at);
  if (to) flt.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + Math.min(attack, dur * 0.5));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(flt);
  flt.connect(g);
  g.connect(bus);
  // 버퍼 안의 시작 자리를 흩어 같은 잡음이 반복돼 들리지 않게 한다
  src.start(at, Math.random() * 0.8);
  src.stop(at + dur + 0.05);
}

function thud(at, vol = 0.35) {
  noise({ at, dur: 0.16, vol: vol * 0.8, f: 420, to: 120, filter: 'lowpass', q: 0.7 });
  tone({ at, f: 150, to: 48, dur: 0.2, vol, type: 'sine' });
}

function drum(at, vol) {
  tone({ at, f: 160, to: 52, dur: 0.42, vol, type: 'sine' });
  noise({ at, dur: 0.09, vol: vol * 0.45, f: 700, filter: 'lowpass', q: 0.6 });
}

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// ------------------------------------------------------------ 효과음

const SFX = {
  tap: (t) => tone({ at: t, f: 1500, to: 900, type: 'triangle', dur: 0.035, vol: 0.12 }),
  good: (t) => {
    tone({ at: t, f: 784, type: 'triangle', dur: 0.13, vol: 0.2 });
    tone({ at: t + 0.085, f: 1175, type: 'triangle', dur: 0.24, vol: 0.2 });
    tone({ at: t + 0.085, f: 2350, type: 'sine', dur: 0.18, vol: 0.035 });
  },
  bad: (t) => {
    tone({ at: t, f: 130, to: 96, type: 'sawtooth', dur: 0.3, vol: 0.17, lp: 900 });
    tone({ at: t, f: 137, to: 101, type: 'square', dur: 0.3, vol: 0.06, lp: 700 });
  },
  rub: (t) => noise({ at: t, dur: 0.12, vol: 0.1, f: 1900, to: 900, q: 1.1, attack: 0.02 }),
  tick: (t) => {
    tone({ at: t, f: 2300, type: 'square', dur: 0.012, vol: 0.045 });
    noise({ at: t, dur: 0.016, vol: 0.06, f: 5200, filter: 'highpass', q: 0.7 });
  },
  snap: (t) => {
    noise({ at: t, dur: 0.075, vol: 0.2, f: 2400, to: 6500, q: 0.8 });
    tone({ at: t + 0.02, f: 420, to: 150, type: 'triangle', dur: 0.08, vol: 0.14 });
  },
  reveal: (t) => {
    [1568, 2093, 2637, 3136].forEach((f, i) => tone({ at: t + i * 0.045, f, type: 'sine', dur: 0.28, vol: 0.075 }));
  },
  open: (t) => {
    noise({ at: t, dur: 0.2, vol: 0.12, f: 700, to: 3200, q: 0.9, attack: 0.03 });
    noise({ at: t + 0.17, dur: 0.06, vol: 0.07, f: 2600, filter: 'highpass' });
  },
  found: (t) => {
    [523, 659, 784].forEach((f, i) => tone({ at: t + i * 0.085, f, type: 'triangle', dur: 0.17, vol: 0.18 }));
    tone({ at: t + 0.17, f: 1568, type: 'sine', dur: 0.3, vol: 0.05 });
  },
  ask: (t) => {
    tone({ at: t, f: 520, to: 780, type: 'sine', dur: 0.09, vol: 0.14 });
    tone({ at: t + 0.08, f: 700, to: 1040, type: 'sine', dur: 0.1, vol: 0.11 });
  },
  type: (t) => noise({ at: t, dur: 0.018, vol: 0.045, f: 3800, q: 2 }),
  fact: (t) => {
    thud(t, 0.32);
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => tone({ at: t + 0.07, f, type: 'triangle', dur: 0.7, vol: 0.065, attack: 0.02 }));
  },
  hint: (t) => {
    // 무전기: 지직지직 몇 번 끊기다가 짧게 삑
    for (let i = 0; i < 5; i++) {
      noise({ at: t + i * 0.045, dur: 0.03 + Math.random() * 0.02, vol: 0.09, f: 1300 + Math.random() * 900, q: 2.5 });
    }
    tone({ at: t + 0.27, f: 1000, type: 'sine', dur: 0.08, vol: 0.07 });
  },
  accuse: (t) => {
    drum(t, 0.42);
    drum(t + 0.3, 0.55);
    tone({ at: t + 0.3, f: midi(38), type: 'sawtooth', dur: 0.9, vol: 0.07, lp: 320, attack: 0.04 });
  },
  solved: (t) => {
    [392, 523.25, 659.25, 783.99].forEach((f, i) => tone({ at: t + i * 0.11, f, type: 'triangle', dur: 0.2, vol: 0.18 }));
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => {
      tone({ at: t + 0.48, f, type: 'triangle', dur: 1.0, vol: 0.085, attack: 0.02 });
      tone({ at: t + 0.48, f: f * 2, type: 'sine', dur: 0.6, vol: 0.02 });
    });
    noise({ at: t + 0.48, dur: 0.5, vol: 0.05, f: 9000, filter: 'highpass' });
  },
  deny: (t) => {
    tone({ at: t, f: 587, to: 494, type: 'triangle', dur: 0.15, vol: 0.16 });
    tone({ at: t + 0.15, f: 440, to: 330, type: 'triangle', dur: 0.28, vol: 0.16 });
  },
  wrong: (t) => {
    [311.1, 370, 440].forEach((f) => tone({ at: t, f, to: f * 0.94, type: 'sawtooth', dur: 0.75, vol: 0.06, lp: 1300, attack: 0.02 }));
    tone({ at: t, f: 155.6, to: 146, type: 'triangle', dur: 0.75, vol: 0.12 });
  },
  alarm: (t) => {
    for (let i = 0; i < 3; i++) {
      tone({ at: t + i * 0.18, f: 988, type: 'square', dur: 0.08, vol: 0.06 });
      tone({ at: t + i * 0.18 + 0.09, f: 740, type: 'square', dur: 0.08, vol: 0.06 });
    }
  },
  page: (t) => noise({ at: t, dur: 0.09, vol: 0.09, f: 2000, to: 5200, q: 0.7, attack: 0.015 }),
  lock: (t) => {
    noise({ at: t, dur: 0.02, vol: 0.18, f: 3500, filter: 'highpass' });
    tone({ at: t + 0.01, f: 180, to: 90, type: 'square', dur: 0.07, vol: 0.13, lp: 1200 });
    noise({ at: t + 0.075, dur: 0.025, vol: 0.12, f: 2800, q: 1.5 });
  },
  stamp: (t) => thud(t, 0.38),
};

// ------------------------------------------------------------ 배경 음악
// 탐정물 분위기: 걷는 베이스(4박) + 브러시/하이햇 + 가끔 비브라폰. 16스텝 = 한 마디, 4마디 반복.
// 진행: Dm7 - Gm7 - A7 - Dm. 마디 끝 음은 다음 마디 첫 음으로 반음 다가간다.
const BASS = [
  [38, 41, 45, 44],
  [43, 46, 41, 44],
  [45, 49, 43, 39],
  [38, 45, 41, 37],
];
const VIBE = [
  [65, 69, 72, 74],
  [70, 74, 77, 67],
  [73, 76, 79, 69],
  [74, 77, 69, 81],
];

const m = {
  want: false,
  timer: null,
  step: 0,
  bar: 0,
  next: 0,
  tension: 0,
  pending: null,
};

const bpmOf = (v) => 84 + 48 * v;

function applyTension(v) {
  m.tension = v;
  if (musicBus) musicBus.gain.setTargetAtTime(0.32 + 0.26 * v, ac.currentTime, 0.4);
}

function bass(at, n, vol, dur) {
  tone({ at, f: midi(n), type: 'triangle', dur, vol, lp: 700, attack: 0.008, bus: musicBus });
  tone({ at, f: midi(n), type: 'sine', dur: dur * 0.8, vol: vol * 0.7, attack: 0.008, bus: musicBus });
}

function vibe(at, n, vol) {
  const f = midi(n);
  tone({ at, f, type: 'sine', dur: 1.6, vol, attack: 0.004, bus: musicBus });
  // 살짝 어긋난 음을 겹쳐 비브라폰 특유의 떨림(울림)을 낸다
  tone({ at, f: f + 3.5, type: 'sine', dur: 1.4, vol: vol * 0.55, attack: 0.004, bus: musicBus });
  tone({ at, f: f * 4, type: 'sine', dur: 0.22, vol: vol * 0.14, attack: 0.002, bus: musicBus });
}

function playStep(step, at, stepDur) {
  if (step === 0 && m.pending !== null) {
    applyTension(m.pending);
    m.pending = null;
  }
  if (readMuted()) return;
  const v = m.tension;
  const swing = step % 4 === 2 ? stepDur * 0.5 : 0; // 엇박 8분음을 늦춰 스윙 느낌
  const t = at + swing;
  const bar = m.bar % 4;
  const line = BASS[bar];

  // 걷는 베이스: 한 박에 한 음. 긴장되면 박 사이 "덧음"이 붙는다
  if (step % 4 === 0) bass(t, line[step / 4], 0.24, stepDur * 3.6);
  if ((v >= 0.45 && step === 14) || (v >= 0.75 && step === 6)) {
    bass(t, line[Math.floor(step / 4)], 0.1, stepDur * 1.2);
  }

  // 발 하이햇은 늘, 라이드는 조금 긴장되면, 16분 잘게 썰기는 많이 긴장되면
  if (step === 4 || step === 12) {
    noise({ at: t, dur: 0.04, vol: 0.04, f: 7000, filter: 'highpass', bus: musicBus });
    noise({ at: t, dur: 0.2, vol: 0.05 + 0.04 * v, f: 2600, q: 0.6, attack: 0.03, bus: musicBus });
  }
  if (v >= 0.3 && [0, 4, 6, 8, 12, 14].includes(step)) {
    noise({ at: t, dur: 0.12, vol: 0.03 + 0.03 * v, f: 9000, filter: 'highpass', bus: musicBus });
    tone({ at: t, f: 5200, type: 'sine', dur: 0.2, vol: 0.006, bus: musicBus });
  }
  if (v >= 0.65 && step % 2 === 1) noise({ at: t, dur: 0.025, vol: 0.02, f: 8000, filter: 'highpass', bus: musicBus });

  // 비브라폰: 가끔. 긴장될수록 자주
  const chord = VIBE[bar];
  if (step === 6 && Math.random() < 0.25 + 0.35 * v) vibe(t, chord[Math.floor(Math.random() * 4)], 0.05);
  if (step === 10 && Math.random() < 0.5 * v) vibe(t, chord[Math.floor(Math.random() * 4)], 0.045);
  if (v >= 0.6 && step === 14 && Math.random() < 0.3) vibe(t, chord[0] + 12, 0.035);

  // 0.8 이상: 쿵-쿵 심장 박동
  if (v >= 0.8 && (step === 0 || step === 8)) {
    tone({ at, f: 95, to: 42, type: 'sine', dur: 0.24, vol: 0.5, bus: musicBus });
    tone({ at: at + stepDur * 1.6, f: 85, to: 40, type: 'sine', dur: 0.2, vol: 0.32, bus: musicBus });
  }
}

function schedule() {
  try {
    if (!ac || ac.state !== 'running') return;
    const now = ac.currentTime;
    // 타이머가 오래 밀렸으면 몰아서 치지 말고 지금부터 다시 이어 간다
    if (m.next < now) m.next = now + 0.04;
    while (m.next < now + LOOKAHEAD) {
      const stepDur = 60 / bpmOf(m.tension) / 4;
      playStep(m.step, m.next, stepDur);
      m.next += stepDur;
      m.step = (m.step + 1) % 16;
      if (m.step === 0) m.bar = (m.bar + 1) % 4;
    }
  } catch (e) {
    /* 소리가 안 나도 게임은 계속된다 */
  }
}

function runScheduler() {
  // 음소거 중에도 박자는 계속 센다 (playStep 이 소리만 건너뛴다). 풀었을 때 박자가 이어진다.
  if (m.timer || !unlocked || !ac) return;
  m.next = ac.currentTime + 0.06;
  m.timer = setInterval(schedule, TIMER_MS);
  schedule();
}

function haltScheduler() {
  if (m.timer) clearInterval(m.timer);
  m.timer = null;
}

// ------------------------------------------------------------ 탭 가림, 잠깐 끊긴 소리 되살리기

function onVisibility() {
  try {
    if (document.hidden) {
      haltScheduler();
      if (ac && ac.state === 'running') {
        suspendedByUs = true;
        ac.suspend().catch(() => {});
      }
    } else {
      if (ac && suspendedByUs) ac.resume().catch(() => {});
      suspendedByUs = false;
      if (m.want) runScheduler();
    }
  } catch (e) {
    /* 무시 */
  }
}

// iOS 는 전화나 다른 앱 소리 뒤에 소리 상자를 멈춰 둔다. 다음 터치에서 다시 깨운다.
function onAnyTouch() {
  try {
    if (ac && ac.state !== 'running' && ac.state !== 'closed' && !document.hidden) ac.resume().catch(() => {});
  } catch (e) {
    /* 무시 */
  }
}

// ------------------------------------------------------------ 밖에 내놓는 것

export const audio = {
  unlock() {
    try {
      const c = ensureContext();
      if (!c) return;
      unlocked = true;
      if (c.state === 'suspended' && !(typeof document !== 'undefined' && document.hidden)) c.resume().catch(() => {});
      // 옛 iOS 는 터치 안에서 무엇이든 한 번 재생해야 소리가 풀린다
      const b = c.createBuffer(1, 1, c.sampleRate);
      const s = c.createBufferSource();
      s.buffer = b;
      s.connect(c.destination);
      s.start(0);
      if (!listening && typeof document !== 'undefined') {
        listening = true;
        document.addEventListener('visibilitychange', onVisibility);
        document.addEventListener('pointerdown', onAnyTouch, { capture: true, passive: true });
      }
      if (m.want) runScheduler();
    } catch (e) {
      /* 소리 없이 계속 */
    }
  },

  sfx(name) {
    try {
      if (!live()) return;
      const fn = SFX[name];
      if (!fn) return;
      const t = nowMs();
      const last = lastSfx.get(name);
      if (last !== undefined && t - last < SAME_SFX_MS) return;
      lastSfx.set(name, t);
      fn(ac.currentTime + 0.005);
    } catch (e) {
      /* 소리가 안 나도 게임은 계속된다 */
    }
  },

  music: {
    start() {
      try {
        if (m.want && m.timer) return;
        if (!m.want) {
          m.step = 0;
          m.bar = 0;
        }
        m.want = true;
        if (unlocked && ac && !(typeof document !== 'undefined' && document.hidden)) runScheduler();
      } catch (e) {
        /* 무시 */
      }
    },
    stop() {
      try {
        m.want = false;
        haltScheduler();
      } catch (e) {
        /* 무시 */
      }
    },
    setTension(v) {
      try {
        const n = Number(v);
        if (!Number.isFinite(n)) return;
        const t = Math.min(1, Math.max(0, n));
        // 연주 중이면 다음 마디 첫 박에 바꾼다 (중간에 빠르기가 튀지 않게)
        if (m.timer) m.pending = t;
        else {
          m.pending = null;
          m.tension = t;
          if (musicBus && ac) musicBus.gain.setValueAtTime(0.32 + 0.26 * t, ac.currentTime);
        }
      } catch (e) {
        /* 무시 */
      }
    },
  },

  setMuted(v) {
    try {
      mutedFlag = !!v;
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(MUTE_KEY, mutedFlag ? '1' : '0');
      } catch (e) {
        /* 저장소를 못 써도 이번 판에는 적용된다 */
      }
      if (master && ac) master.gain.setTargetAtTime(mutedFlag ? 0 : 1, ac.currentTime, 0.015);
    } catch (e) {
      /* 무시 */
    }
  },

  muted() {
    try {
      return readMuted();
    } catch (e) {
      return false;
    }
  },
};
