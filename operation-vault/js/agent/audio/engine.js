// 소리: 효과음과 긴장감 음악. 소리 파일 없이 Web Audio 로 모두 합성한다.
//
// 음악은 16분음표 단위 스케줄러로 돌린다. 긴장도(0~1)가 오르면 빨라지고 악기가 늘어난다.
// 긴장도는 남은 시간과 경보 단계로 정해지며, 감독(director)이 매 프레임 알려 준다.

const A1 = 55; // 기준 음 (Hz)
const semitone = (n) => A1 * Math.pow(2, n / 12);
const BASS = [0, 0, 3, 0, 5, 0, 3, -2]; // 단조 베이스 진행 (반음 단위)
const ARP = [12, 15, 19, 24, 19, 15, 22, 19];

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicBus = null;
  let sfxBus = null;
  let noiseBuffer = null;
  let muted = false;

  // 음악 상태
  let playing = false;
  let mode = 'normal'; // 'normal' | 'breath'(금고: 심장 박동만) | 'off'
  let tension = 0;
  let step = 0;
  let nextTime = 0;

  function unlock() {
    if (ctx) {
      if (ctx.state !== 'running') ctx.resume().catch(() => {});
      return;
    }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    // 아이폰에서 무음 스위치와 상관없이 소리가 나게 한다 (지원하는 기기만)
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch {
      /* 지원하지 않음 */
    }
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 8;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.5;
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.9;
    musicBus.connect(master);
    sfxBus.connect(master);
    master.connect(limiter);
    limiter.connect(ctx.destination);

    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
  }

  /** 음 하나. f1 을 주면 f0 에서 f1 로 미끄러진다. */
  function tone({ type = 'sine', f0, f1, dur = 0.15, gain = 0.3, at = 0, bus = sfxBus, attack = 0.005, cutoff }) {
    if (!ctx) return;
    const t = (at || ctx.currentTime) + 0.001;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (cutoff) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      osc.connect(filter);
      node = filter;
    }
    node.connect(g);
    g.connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** 잡음 한 번 (하이햇, 스프레이, 문 끌리는 소리 등). */
  function noise({ dur = 0.1, gain = 0.2, at = 0, bus = sfxBus, type = 'highpass', freq = 4000, q = 0.7, freqEnd }) {
    if (!ctx) return;
    const t = (at || ctx.currentTime) + 0.001;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    if (freqEnd) filter.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  const SFX = {
    key: () => tone({ type: 'square', f0: 880, dur: 0.06, gain: 0.12 }),
    click: () => tone({ type: 'square', f0: 520, dur: 0.04, gain: 0.1 }),
    granted() {
      const t = ctx.currentTime;
      [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.22, gain: 0.25, at: t + i * 0.08 }));
    },
    denied() {
      const t = ctx.currentTime;
      tone({ type: 'sawtooth', f0: 160, f1: 110, dur: 0.35, gain: 0.3, cutoff: 900 });
      tone({ type: 'sawtooth', f0: 150, f1: 100, dur: 0.35, gain: 0.3, at: t + 0.18, cutoff: 900 });
    },
    alarm() {
      const t = ctx.currentTime;
      for (let i = 0; i < 3; i++) {
        tone({ type: 'square', f0: 620, f1: 920, dur: 0.22, gain: 0.2, at: t + i * 0.26 });
      }
    },
    siren() {
      const t = ctx.currentTime;
      for (let i = 0; i < 6; i++) {
        tone({ type: 'sawtooth', f0: 480, f1: 960, dur: 0.4, gain: 0.26, at: t + i * 0.44, cutoff: 2400 });
      }
    },
    tick: () => tone({ type: 'square', f0: 2200, dur: 0.012, gain: 0.07 }),
    // 금고 다이얼의 숨은 번호에 걸렸을 때: 낮고 묵직한 딸깍
    gate() {
      tone({ type: 'sine', f0: 190, f1: 70, dur: 0.16, gain: 0.6 });
      noise({ dur: 0.05, gain: 0.25, type: 'bandpass', freq: 1800, q: 3 });
    },
    mark: () => tone({ type: 'triangle', f0: 660, f1: 990, dur: 0.18, gain: 0.25 }),
    commit() {
      tone({ type: 'sine', f0: 130, f1: 60, dur: 0.3, gain: 0.6 });
      tone({ type: 'triangle', f0: 880, dur: 0.12, gain: 0.2 });
    },
    switch() {
      noise({ dur: 0.04, gain: 0.3, type: 'bandpass', freq: 2500, q: 2 });
      tone({ type: 'sine', f0: 140, f1: 80, dur: 0.1, gain: 0.4 });
    },
    step() {
      tone({ type: 'sine', f0: 95, f1: 55, dur: 0.14, gain: 0.45 });
      noise({ dur: 0.1, gain: 0.08, type: 'lowpass', freq: 700 });
    },
    turn: () => noise({ dur: 0.14, gain: 0.07, type: 'bandpass', freq: 900, q: 1 }),
    bump: () => tone({ type: 'sine', f0: 70, f1: 40, dur: 0.18, gain: 0.6 }),
    trip() {
      tone({ type: 'sawtooth', f0: 1800, f1: 200, dur: 0.4, gain: 0.3 });
      noise({ dur: 0.3, gain: 0.2, type: 'bandpass', freq: 3000, q: 4 });
    },
    spray: () => noise({ dur: 0.7, gain: 0.22, type: 'highpass', freq: 5000, freqEnd: 2500 }),
    spark() {
      noise({ dur: 0.25, gain: 0.4, type: 'highpass', freq: 3000 });
      tone({ type: 'square', f0: 60, dur: 0.3, gain: 0.3 });
    },
    door() {
      noise({ dur: 1.3, gain: 0.22, type: 'lowpass', freq: 300, freqEnd: 900 });
      tone({ type: 'sawtooth', f0: 55, f1: 75, dur: 1.2, gain: 0.25, cutoff: 300 });
    },
    vault() {
      const t = ctx.currentTime;
      tone({ type: 'sine', f0: 80, f1: 35, dur: 0.6, gain: 0.8 });
      noise({ dur: 2.2, gain: 0.25, type: 'lowpass', freq: 200, freqEnd: 1200, at: t + 0.4 });
      [392, 523, 659, 784, 1047, 1319].forEach((f, i) =>
        tone({ type: 'triangle', f0: f, dur: 0.5, gain: 0.22, at: t + 1.2 + i * 0.12 })
      );
    },
    clear() {
      const t = ctx.currentTime;
      [440, 554, 659, 880].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.3, gain: 0.25, at: t + i * 0.1 }));
    },
    caught() {
      const t = ctx.currentTime;
      [392, 330, 262, 196].forEach((f, i) =>
        tone({ type: 'sawtooth', f0: f, dur: 0.45, gain: 0.3, at: t + i * 0.3, cutoff: 1500 })
      );
    },
    radio: () => noise({ dur: 0.18, gain: 0.12, type: 'bandpass', freq: 1500, q: 0.8 }),
    reroll() {
      noise({ dur: 0.3, gain: 0.18, type: 'bandpass', freq: 800, freqEnd: 4000, q: 2 });
    },
  };

  /** 16분음표 한 칸에 낼 소리를 예약한다. */
  function schedule(index, t) {
    const beat = index % 16;
    if (mode === 'breath') {
      // 금고 앞: 음악이 사라지고 심장 박동만 남는다
      if (beat === 0 || beat === 3) {
        tone({ type: 'sine', f0: beat === 0 ? 62 : 54, f1: 34, dur: 0.22, gain: beat === 0 ? 0.9 : 0.6, at: t, bus: musicBus });
      }
      return;
    }
    // 저음 박동
    if (beat % 4 === 0) {
      tone({ type: 'sine', f0: 110, f1: 42, dur: 0.2, gain: 0.7, at: t, bus: musicBus });
    }
    // 베이스
    if (beat % 2 === 0) {
      const note = BASS[Math.floor(index / 2) % BASS.length];
      tone({
        type: 'sawtooth',
        f0: semitone(note),
        dur: 0.16,
        gain: 0.16 + tension * 0.16,
        at: t,
        bus: musicBus,
        cutoff: 380 + tension * 900,
      });
    }
    // 째깍거리는 고음: 긴장이 오르면 촘촘해진다
    if (tension > 0.2 && (beat % 2 === 0 || tension > 0.6)) {
      noise({ dur: 0.03, gain: 0.05 + tension * 0.07, at: t, bus: musicBus, freq: 7000 });
    }
    // 아르페지오
    if (tension > 0.45) {
      const note = ARP[index % ARP.length];
      tone({ type: 'square', f0: semitone(note) * 2, dur: 0.07, gain: 0.03 + tension * 0.05, at: t, bus: musicBus });
    }
    // 막바지: 두 마디마다 불안한 사이렌
    if (tension > 0.8 && index % 32 === 0) {
      tone({ type: 'sawtooth', f0: 440, f1: 880, dur: 0.9, gain: 0.08, at: t, bus: musicBus, cutoff: 2000 });
    }
  }

  return {
    unlock,
    get ready() {
      return !!ctx && ctx.state === 'running';
    },

    sfx(name) {
      if (!ctx || ctx.state !== 'running' || !SFX[name]) return;
      SFX[name]();
    },

    startMusic() {
      if (!ctx) return;
      playing = true;
      step = 0;
      nextTime = ctx.currentTime + 0.1;
    },
    stopMusic() {
      playing = false;
    },
    setMode(next) {
      mode = next;
    },
    setTension(t) {
      tension = Math.max(0, Math.min(1, t));
    },

    /** 매 프레임 호출: 조금 앞의 소리를 미리 예약한다. */
    update() {
      if (!ctx || !playing || ctx.state !== 'running' || mode === 'off') return;
      const now = ctx.currentTime;
      if (nextTime < now - 0.25) nextTime = now + 0.05; // 오래 멈췄다 돌아온 경우
      const bpm = mode === 'breath' ? 62 + tension * 50 : 84 + tension * 66;
      const stepDur = 60 / bpm / 4;
      while (nextTime < now + 0.3) {
        schedule(step, nextTime);
        step++;
        nextTime += stepDur;
      }
    },

    suspend() {
      if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
    },
    resume() {
      if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
    },

    get muted() {
      return muted;
    },
    setMuted(v) {
      muted = v;
      if (master) master.gain.value = muted ? 0 : 0.9;
    },

    /** 검증용: 지금 음악 상태 */
    debug: () => ({ playing, mode, tension, step, state: ctx ? ctx.state : 'none' }),
  };
}
