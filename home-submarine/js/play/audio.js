// 소리. 소리 파일 없이 Web Audio 로 그 자리에서 합성한다.
// 규격은 그대로 지킨다 (다른 모듈이 이 이름으로 부른다).
//
//   audio.unlock()             첫 터치에서 부른다 (모바일은 터치 뒤에만 소리가 난다)
//   audio.sfx(name)            효과음. 모르는 이름은 조용히 무시한다.
//                              'beep' 만 둘째 인자(0~3)로 음 높이를 고를 수 있다. 없으면 4음을 차례로 돌려 쓴다.
//   audio.music.start()        배경 소리 시작 (이미 켜져 있으면 그대로)
//   audio.music.stop()
//   audio.music.setUrgency(v)  0(평온) ~ 1(곧 터진다). 경보음 간격과 빠르기가 따라 오른다.
//   audio.music.setDepth(m)    수심 0~1000. 깊을수록 낮고 묵직해진다.
//   audio.setMuted(bool) / audio.muted()   설정은 localStorage 'minigames:homeSubmarine_muted' 에 남긴다
//
// 배경 소리는 음악이 아니라 "잠수함 안의 소리"다: 낮은 엔진 웅웅거림 + 몇 초마다 소나 핑 + 물방울.
// 급해지면(0.3~) 심장 박동 같은 저음 펄스가 들어와 60 → 140 BPM 으로 빨라지고, 0.75 부터 경고음이 섞인다.
//
// 지키는 약속
// - Node 에서 import 해도 터지지 않게 최상위에서 window/document/localStorage 를 건드리지 않는다.
// - AudioContext 가 없거나 unlock 전이면 모든 함수가 조용히 아무 일도 하지 않는다. 예외를 밖으로 내보내지 않는다.
// - unlock 전에 music.start() 가 불리면 "켜 달라"는 뜻만 기억했다가 unlock 때 시작한다.
// - 마지막 단에 부드러운 리미터(파형 깎기)를 두어 출력이 0.9 를 넘지 않는다. 폰 스피커가 찢어지지 않게.

const MUTE_KEY = 'minigames:homeSubmarine_muted';
const SAME_SFX_MS = 30; // 같은 효과음이 이 안에 또 불리면 건너뛴다 (겹쳐 커지는 것 막기)
const LOOKAHEAD = 0.2; // 배경 소리 사건은 이만큼 앞서 예약한다 (초)
const TIMER_MS = 50;
const PEAK = 0.9; // 리미터 천장

let ac = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let noiseBuf = null;
let unlocked = false;
let listening = false;
let suspendedByUs = false;
let mutedFlag = null; // null 이면 아직 저장소를 읽지 않았다
let beepTurn = 0;
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

/** 0.6 까지는 그대로, 그 위는 부드럽게 눌러 PEAK 에 닿기 전에 멈추는 곡선. 범위 밖 입력은 끝값으로 잘린다 */
function limiterCurve() {
  const n = 2049;
  const curve = new Float32Array(n);
  const knee = 0.6;
  const room = PEAK - knee - 0.005;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= knee ? a : knee + room * Math.tanh((a - knee) / room);
    curve[i] = Math.sign(x) * y;
  }
  return curve;
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
  // 효과음이 몰려도 덜 튀게 가볍게 눌러 준 뒤, 마지막에 파형 천장을 씌운다
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 12;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;
  const trim = ac.createGain();
  trim.gain.value = 0.7; // 압축기가 스스로 올리는 만큼(약 +5dB)을 덜어 낸다
  const limiter = ac.createWaveShaper();
  limiter.curve = limiterCurve();
  limiter.oversample = '2x';
  master.connect(comp);
  comp.connect(trim);
  trim.connect(limiter);
  limiter.connect(ac.destination);
  sfxBus = ac.createGain();
  sfxBus.gain.value = 0.85;
  sfxBus.connect(master);
  musicBus = ac.createGain();
  musicBus.gain.value = 0.55;
  musicBus.connect(master);
  return ac;
}

/** 지금 소리를 만들어도 되는가 */
function live() {
  return !!(unlocked && ac && ac.state !== 'closed' && !readMuted());
}

// ------------------------------------------------------------ 소리 재료

/** 음 하나. at 은 오디오 시계의 절대 시각(초). lp 를 주면 그 위를 깎아 부드럽게 한다. */
function tone({ f, to = 0, type = 'sine', dur = 0.15, vol = 0.2, at, attack = 0.005, lp = 0, bus = sfxBus, curve = 'exp' }) {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, at);
  if (to) {
    if (curve === 'lin') o.frequency.linearRampToValueAtTime(to, at + dur);
    else o.frequency.exponentialRampToValueAtTime(Math.max(1, to), at + dur);
  }
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
  return o;
}

/** 오르내리는 음 (사이렌). points 는 [초, 주파수] 목록 */
function sweep({ points, type = 'sawtooth', vol = 0.08, at, lp = 2400, bus = sfxBus }) {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(points[0][1], at);
  for (const [t, f] of points.slice(1)) o.frequency.linearRampToValueAtTime(f, at + t);
  const end = points[points.length - 1][0];
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.03);
  g.gain.setValueAtTime(vol, at + end - 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, at + end);
  const flt = ac.createBiquadFilter();
  flt.type = 'lowpass';
  flt.frequency.setValueAtTime(lp, at);
  o.connect(flt);
  flt.connect(g);
  g.connect(bus);
  o.start(at);
  o.stop(at + end + 0.05);
}

function noiseBuffer() {
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

/** 거른 잡음 한 토막 (물, 쇳소리, 쉭) */
function noise({ dur = 0.2, vol = 0.15, at, f = 1500, to = 0, q = 0.8, filter = 'bandpass', attack = 0.006, bus = sfxBus }) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer();
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

/** 쇠가 울리는 소리: 배음이 정수배가 아닌 사인 몇 개를 길게 끈다 */
function metal(at, base, vol, dur) {
  [1, 1.79, 2.68, 3.86].forEach((m, i) => tone({ at, f: base * m, type: 'sine', dur: dur * (1 - i * 0.15), vol: vol / (1 + i * 0.6), attack: 0.002 }));
}

function plip(at, vol, bus = sfxBus) {
  const f = 520 + Math.random() * 420;
  tone({ at, f, to: f * 2.6, type: 'sine', dur: 0.06, vol, attack: 0.002, bus });
}

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
const BEEPS = [midi(72), midi(76), midi(79), midi(84)]; // 도 미 솔 높은도: 어떤 순서로 이어도 듣기 좋다

// ------------------------------------------------------------ 효과음

const SFX = {
  // 놀이
  tap: (t) => tone({ at: t, f: 1300, to: 850, type: 'triangle', dur: 0.04, vol: 0.12 }),
  good: (t) => {
    tone({ at: t, f: 660, type: 'triangle', dur: 0.12, vol: 0.18 });
    tone({ at: t + 0.08, f: 990, type: 'triangle', dur: 0.22, vol: 0.18 });
  },
  bad: (t) => {
    tone({ at: t, f: 150, to: 104, type: 'sawtooth', dur: 0.3, vol: 0.16, lp: 900 });
    tone({ at: t, f: 157, to: 109, type: 'square', dur: 0.3, vol: 0.05, lp: 700 });
  },
  turn: (t) => {
    // 밸브 톱니가 한 칸 걸리는 소리: 짧은 쇳소리 + 낮은 덜컥
    noise({ at: t, dur: 0.03, vol: 0.14, f: 3200, filter: 'highpass', q: 0.7 });
    tone({ at: t + 0.006, f: 260, to: 140, type: 'square', dur: 0.06, vol: 0.09, lp: 1400 });
    tone({ at: t + 0.006, f: 1850, type: 'sine', dur: 0.09, vol: 0.025 });
  },
  click: (t) => {
    // 철판이 탁 붙는 소리: 날카로운 머리 + 둔한 몸통 + 짧은 쇠 울림
    noise({ at: t, dur: 0.025, vol: 0.2, f: 4200, filter: 'highpass', q: 0.7 });
    tone({ at: t, f: 540, to: 220, type: 'triangle', dur: 0.07, vol: 0.16 });
    metal(t + 0.004, 1320, 0.035, 0.18);
  },
  water: (t) => {
    noise({ at: t, dur: 0.45, vol: 0.15, f: 1400, to: 650, q: 0.6, attack: 0.02 });
    noise({ at: t, dur: 0.3, vol: 0.05, f: 3800, filter: 'highpass', q: 0.5, attack: 0.015 });
    for (let i = 0; i < 3; i++) plip(t + 0.05 + i * 0.07 + Math.random() * 0.03, 0.05);
  },
  pump: (t) => {
    // 쉭 하고 밀려 들어가며 꿀렁
    noise({ at: t, dur: 0.22, vol: 0.13, f: 900, to: 260, filter: 'lowpass', q: 0.9, attack: 0.02 });
    tone({ at: t, f: 120, to: 70, type: 'sine', dur: 0.22, vol: 0.28 });
    tone({ at: t, f: 240, to: 140, type: 'triangle', dur: 0.16, vol: 0.08 });
    tone({ at: t + 0.11, f: 260, to: 460, type: 'sine', dur: 0.09, vol: 0.09 });
  },
  beep: (t, v) => {
    const i = Number.isInteger(v) && v >= 0 ? v % 4 : beepTurn++ % 4;
    const f = BEEPS[i];
    tone({ at: t, f, type: 'square', dur: 0.24, vol: 0.06, lp: 2600, attack: 0.004 });
    tone({ at: t, f, type: 'sine', dur: 0.26, vol: 0.12, attack: 0.004 });
  },
  fixed: (t) => {
    tone({ at: t, f: 880, type: 'triangle', dur: 0.14, vol: 0.18 });
    tone({ at: t + 0.1, f: 1318.5, type: 'triangle', dur: 0.3, vol: 0.19 });
    tone({ at: t + 0.1, f: 2637, type: 'sine', dur: 0.22, vol: 0.035 });
  },

  // 임무
  alarm: (t) => {
    // 사이렌 두 번 (오르내림)
    sweep({ at: t, vol: 0.085, points: [[0, 560], [0.22, 980], [0.44, 560], [0.66, 980], [0.9, 560]] });
    sweep({ at: t, type: 'square', vol: 0.025, lp: 1600, points: [[0, 280], [0.22, 490], [0.44, 280], [0.66, 490], [0.9, 280]] });
  },
  alarm2: (t) => {
    // 두 곳 동시: 더 높고 빠르게 네 번
    const pts = [];
    for (let i = 0; i <= 8; i++) pts.push([i * 0.11, i % 2 ? 1250 : 700]);
    sweep({ at: t, vol: 0.085, points: pts });
    sweep({ at: t, type: 'square', vol: 0.03, lp: 1800, points: pts.map(([x, f]) => [x, f * 1.5]) });
  },
  tick: (t) => {
    tone({ at: t, f: 2200, type: 'square', dur: 0.014, vol: 0.05 });
    noise({ at: t, dur: 0.016, vol: 0.05, f: 5200, filter: 'highpass', q: 0.7 });
  },
  damage: (t) => {
    // 선체에 쿵: 낮은 충격 + 길게 우는 쇠
    tone({ at: t, f: 95, to: 34, type: 'sine', dur: 0.55, vol: 0.5 });
    tone({ at: t, f: 190, to: 70, type: 'triangle', dur: 0.3, vol: 0.14 });
    noise({ at: t, dur: 0.4, vol: 0.22, f: 500, to: 80, filter: 'lowpass', q: 0.7 });
    metal(t + 0.02, 212, 0.07, 1.3);
    sweep({ at: t + 0.15, type: 'triangle', vol: 0.03, lp: 900, points: [[0, 330], [0.6, 300], [1.1, 318]] });
  },
  checkin: (t) => {
    tone({ at: t, f: 1046.5, type: 'sine', dur: 0.1, vol: 0.14 });
    tone({ at: t + 0.075, f: 1568, type: 'sine', dur: 0.18, vol: 0.13 });
    tone({ at: t + 0.075, f: 784, type: 'triangle', dur: 0.18, vol: 0.06 });
  },
  wrong: (t) => {
    tone({ at: t, f: 440, to: 400, type: 'sawtooth', dur: 0.16, vol: 0.09, lp: 1400 });
    tone({ at: t + 0.17, f: 330, to: 290, type: 'sawtooth', dur: 0.3, vol: 0.09, lp: 1200 });
    tone({ at: t, f: 220, to: 145, type: 'triangle', dur: 0.45, vol: 0.1 });
  },
  pick: (t) => {
    noise({ at: t, dur: 0.03, vol: 0.1, f: 2600, q: 1.2 });
    [784, 988, 1318.5].forEach((f, i) => tone({ at: t + 0.02 + i * 0.055, f, type: 'triangle', dur: 0.1, vol: 0.13 }));
  },
  code: (t) => {
    // 화면에 암호가 찍히는 전자음
    const fs = [1480, 1975, 1661, 2217, 1760];
    fs.forEach((f, i) => tone({ at: t + i * 0.045, f, type: 'square', dur: 0.03, vol: 0.04, lp: 4000 }));
    tone({ at: t + 0.25, f: 1318.5, type: 'sine', dur: 0.2, vol: 0.08 });
  },
  stage: (t) => {
    [523.25, 659.25, 783.99].forEach((f, i) => tone({ at: t + i * 0.12, f, type: 'triangle', dur: 0.22, vol: 0.17 }));
    tone({ at: t + 0.24, f: 1567.98, type: 'sine', dur: 0.4, vol: 0.05 });
  },
  dive: (t) => {
    // 잠항: 내려가는 음 + 공기 빠지는 쉭 + 거품
    sweep({ at: t, type: 'sine', vol: 0.14, lp: 3000, points: [[0, 880], [1.0, 190]] });
    sweep({ at: t, type: 'triangle', vol: 0.04, lp: 1500, points: [[0, 440], [1.0, 95]] });
    noise({ at: t, dur: 1.0, vol: 0.09, f: 1800, to: 300, filter: 'lowpass', q: 0.6, attack: 0.08 });
    for (let i = 0; i < 5; i++) plip(t + 0.3 + i * 0.12 + Math.random() * 0.05, 0.045);
  },
  fail: (t) => {
    // 가라앉음: 느리게 처지는 음 + 낮은 웅 + 쇠 신음
    sweep({ at: t, type: 'sawtooth', vol: 0.09, lp: 700, points: [[0, 300], [1.4, 62]] });
    tone({ at: t, f: 70, to: 38, type: 'sine', dur: 1.5, vol: 0.32, attack: 0.05 });
    metal(t + 0.3, 160, 0.05, 1.4);
    for (let i = 0; i < 6; i++) plip(t + 0.2 + i * 0.18 + Math.random() * 0.08, 0.04);
  },
  surface: (t) => {
    // 물 위로: 철썩 + 팡파르 (1.5초)
    noise({ at: t, dur: 0.5, vol: 0.12, f: 2200, to: 500, q: 0.5, attack: 0.01 });
    const lead = [
      [0, 392],
      [0.12, 523.25],
      [0.24, 659.25],
      [0.36, 783.99],
    ];
    lead.forEach(([d, f]) => tone({ at: t + d, f, type: 'triangle', dur: 0.15, vol: 0.17 }));
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => {
      tone({ at: t + 0.5, f, type: 'triangle', dur: 1.0, vol: 0.07, attack: 0.02 });
      tone({ at: t + 0.5, f: f * 2, type: 'sine', dur: 0.6, vol: 0.018 });
    });
    noise({ at: t + 0.5, dur: 0.6, vol: 0.04, f: 9000, filter: 'highpass' });
  },
  page: (t) => noise({ at: t, dur: 0.09, vol: 0.09, f: 2000, to: 5200, q: 0.7, attack: 0.015 }),
  lock: (t) => {
    noise({ at: t, dur: 0.02, vol: 0.18, f: 3500, filter: 'highpass' });
    tone({ at: t + 0.01, f: 180, to: 90, type: 'square', dur: 0.07, vol: 0.12, lp: 1200 });
    noise({ at: t + 0.075, dur: 0.025, vol: 0.12, f: 2800, q: 1.5 });
  },
};

// ------------------------------------------------------------ 배경 소리 (잠수함 안)

const m = {
  want: false,
  timer: null,
  nodes: null, // 늘 울리는 웅웅거림 (start 에서 만들고 stop 에서 치운다)
  urgency: 0, // 바라는 값
  depth: 0,
  u: 0, // 실제로 쓰는 값. 바라는 값으로 천천히 옮겨 가서 소리가 튀지 않는다
  d: 0,
  lastTick: 0,
  nextPing: 0,
  nextDrop: 0,
  nextBeat: 0,
  beatNo: 0,
};

const humFreq = (d) => 55 * (1 - 0.3 * (d / 1000)); // 수심 0 → 55Hz, 1000 → 38.5Hz
const humCut = (d) => 360 - 150 * (d / 1000);
const pingGap = (d) => 4 + 4 * (d / 1000); // 소나 간격 4 → 8초
const bpm = (u) => 60 + 80 * Math.min(1, Math.max(0, (u - 0.3) / 0.7));

function buildHum() {
  const t = ac.currentTime;
  const out = ac.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(1, t + 1.2);
  out.connect(musicBus);
  // 엔진: 살짝 어긋난 톱니 둘 + 한 옥타브 아래 사인. 폰 스피커는 저음을 못 내므로 배음이 들리게 거르는 곳을 너무 낮추지 않는다
  const flt = ac.createBiquadFilter();
  flt.type = 'lowpass';
  flt.Q.value = 0.9;
  flt.frequency.setValueAtTime(humCut(m.d), t);
  const humGain = ac.createGain();
  humGain.gain.value = 0.11;
  flt.connect(humGain);
  humGain.connect(out);
  const f0 = humFreq(m.d);
  const oscs = [
    [f0, 'sawtooth', 0.55],
    [f0 * 1.006, 'sawtooth', 0.45],
    [f0 / 2, 'sine', 0.9],
  ].map(([f, type, v]) => {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    const g = ac.createGain();
    g.gain.value = v;
    o.connect(g);
    g.connect(flt);
    o.start(t);
    return o;
  });
  // 엔진이 천천히 숨 쉬듯 출렁인다
  const lfo = ac.createOscillator();
  lfo.frequency.value = 0.23;
  const lfoGain = ac.createGain();
  lfoGain.gain.value = 0.035;
  lfo.connect(lfoGain);
  lfoGain.connect(humGain.gain);
  lfo.start(t);
  // 선체 밖 물살: 아주 낮게 거른 잡음
  const rum = ac.createBufferSource();
  rum.buffer = noiseBuffer();
  rum.loop = true;
  const rumF = ac.createBiquadFilter();
  rumF.type = 'lowpass';
  rumF.frequency.value = 220;
  const rumG = ac.createGain();
  rumG.gain.value = 0.05;
  rum.connect(rumF);
  rumF.connect(rumG);
  rumG.connect(out);
  rum.start(t);
  // 소나 핑의 메아리
  const echoIn = ac.createGain();
  const delay = ac.createDelay(1.5);
  delay.delayTime.value = 0.42;
  const fb = ac.createGain();
  fb.gain.value = 0.38;
  const fbF = ac.createBiquadFilter();
  fbF.type = 'lowpass';
  fbF.frequency.value = 1600;
  echoIn.connect(delay);
  delay.connect(fbF);
  fbF.connect(fb);
  fb.connect(delay);
  fbF.connect(out);
  echoIn.connect(out);
  return { out, flt, oscs, lfo, rum, echoIn, sources: [...oscs, lfo, rum] };
}

function dropHum() {
  const n = m.nodes;
  m.nodes = null;
  if (!n || !ac) return;
  try {
    const t = ac.currentTime;
    n.out.gain.cancelScheduledValues(t);
    n.out.gain.setValueAtTime(Math.max(0.0001, n.out.gain.value), t);
    n.out.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    n.sources.forEach((s) => s.stop(t + 0.5));
    setTimeout(() => {
      try {
        n.out.disconnect();
      } catch (e) {
        /* 이미 끊김 */
      }
    }, 700);
  } catch (e) {
    /* 무시 */
  }
}

function ping(at, vol) {
  const f = 1250 - 300 * (m.d / 1000);
  const bus = m.nodes ? m.nodes.echoIn : musicBus;
  tone({ at, f, to: f * 0.97, type: 'sine', dur: 1.4, vol, attack: 0.004, bus });
  tone({ at, f: f * 2, type: 'sine', dur: 0.3, vol: vol * 0.15, attack: 0.002, bus });
}

function heartbeat(at, u) {
  const k = Math.min(1, Math.max(0, (u - 0.3) / 0.7));
  const v = 0.22 + 0.25 * k;
  const gap = 0.16 + 0.06 * (1 - k);
  // 쿵-쿵. 저음 위에 한 옥타브 위 세모파를 얹어 폰 스피커에서도 들린다
  tone({ at, f: 78, to: 42, type: 'sine', dur: 0.2, vol: v, bus: musicBus });
  tone({ at, f: 156, to: 90, type: 'triangle', dur: 0.12, vol: v * 0.3, bus: musicBus });
  tone({ at: at + gap, f: 70, to: 40, type: 'sine', dur: 0.17, vol: v * 0.7, bus: musicBus });
  tone({ at: at + gap, f: 140, to: 85, type: 'triangle', dur: 0.1, vol: v * 0.2, bus: musicBus });
}

function warn(at, u) {
  const v = 0.02 + 0.05 * Math.min(1, (u - 0.75) / 0.25);
  tone({ at, f: 932, type: 'square', dur: 0.13, vol: v, lp: 1800, bus: musicBus });
  tone({ at: at + 0.15, f: 698.5, type: 'square', dur: 0.13, vol: v, lp: 1800, bus: musicBus });
}

function schedule() {
  try {
    if (!ac || ac.state !== 'running') return;
    const now = ac.currentTime;
    const dt = m.lastTick ? Math.min(0.5, now - m.lastTick) : 0;
    m.lastTick = now;
    // 바라는 값으로 천천히 옮겨 간다 (급함은 약 0.8초, 수심은 약 2초 만에)
    m.u += (m.urgency - m.u) * Math.min(1, dt / 0.8);
    m.d += (m.depth - m.d) * Math.min(1, dt / 2);
    if (m.nodes) {
      m.nodes.oscs[0].frequency.setTargetAtTime(humFreq(m.d), now, 0.6);
      m.nodes.oscs[1].frequency.setTargetAtTime(humFreq(m.d) * 1.006, now, 0.6);
      m.nodes.oscs[2].frequency.setTargetAtTime(humFreq(m.d) / 2, now, 0.6);
      m.nodes.flt.frequency.setTargetAtTime(humCut(m.d), now, 0.6);
    }
    // 타이머가 오래 밀렸으면 몰아서 치지 말고 지금부터 다시 이어 간다
    if (m.nextPing < now) m.nextPing = Math.max(m.nextPing, now + 0.05);
    if (m.nextDrop < now) m.nextDrop = now + 0.05;
    if (m.nextBeat < now) m.nextBeat = now + 0.05;
    const quiet = readMuted();
    const horizon = now + LOOKAHEAD;
    while (m.nextPing < horizon) {
      if (!quiet) ping(m.nextPing, 0.09);
      m.nextPing += pingGap(m.d);
    }
    while (m.nextDrop < horizon) {
      if (!quiet) plip(m.nextDrop, 0.03, musicBus);
      m.nextDrop += 1.2 + Math.random() * 2.6;
    }
    while (m.nextBeat < horizon) {
      const u = m.u;
      if (u >= 0.3) {
        if (!quiet) heartbeat(m.nextBeat, u);
        // 경고음은 두 박에 한 번
        if (u >= 0.75 && m.beatNo % 2 === 0 && !quiet) warn(m.nextBeat + 30 / bpm(u), u);
        m.beatNo++;
        m.nextBeat += 60 / bpm(u);
      } else {
        // 평온할 때는 박동이 없다. 급해지면 곧바로 들어오도록 짧게 다시 본다
        m.nextBeat += 0.25;
      }
    }
  } catch (e) {
    /* 소리가 안 나도 게임은 계속된다 */
  }
}

function runScheduler() {
  if (m.timer || !unlocked || !ac) return;
  if (!m.nodes) m.nodes = buildHum();
  const t = ac.currentTime;
  m.lastTick = t;
  if (!m.nextPing || m.nextPing < t) m.nextPing = t + 1.2;
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
      if (m.want && !(typeof document !== 'undefined' && document.hidden)) runScheduler();
    } catch (e) {
      /* 소리 없이 계속 */
    }
  },

  sfx(name, variant) {
    try {
      if (!live()) return;
      const fn = SFX[name];
      if (!fn) return;
      const t = nowMs();
      const last = lastSfx.get(name);
      if (last !== undefined && t - last < SAME_SFX_MS) return;
      lastSfx.set(name, t);
      fn(ac.currentTime + 0.005, variant);
    } catch (e) {
      /* 소리가 안 나도 게임은 계속된다 */
    }
  },

  music: {
    start() {
      try {
        if (m.want && m.timer) return;
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
        dropHum();
      } catch (e) {
        /* 무시 */
      }
    },
    setUrgency(v) {
      try {
        const n = Number(v);
        if (!Number.isFinite(n)) return;
        m.urgency = Math.min(1, Math.max(0, n));
        // 연주 전이면 바로 그 값에서 시작한다 (처음부터 천천히 올라가지 않게)
        if (!m.timer) m.u = m.urgency;
      } catch (e) {
        /* 무시 */
      }
    },
    setDepth(d) {
      try {
        const n = Number(d);
        if (!Number.isFinite(n)) return;
        m.depth = Math.min(1000, Math.max(0, n));
        if (!m.timer) m.d = m.depth;
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
