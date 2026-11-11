// 리버스 오디오의 소리 재료: 동요 합성, 표본 뒤집기, 저장된 녹음 읽기, 재생, 마이크 정리.
// 게임 규칙은 game.js 에 있다. 여기 함수들은 화면을 건드리지 않는다.
(function () {
  'use strict';

  const { shuffle } = Arcade;
  const SR = 22050; // 합성 동요의 표본 주파수

  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function noteToMidi(name) {
    const m = /^([A-G])([#b]?)(\d)$/.exec(name);
    if (!m) return null;
    return 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }
  const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function parseMelody(text) {
    return String(text)
      .trim()
      .split(/\s+/)
      .map((tok) => {
        const [name, len] = tok.split(':');
        return { name, midi: noteToMidi(name), beats: len === undefined ? 1 : parseFloat(len) };
      });
  }

  function normalize(data, peak) {
    let max = 0;
    for (let i = 0; i < data.length; i++) max = Math.max(max, Math.abs(data[i]));
    if (max > 0) for (let i = 0; i < data.length; i++) data[i] *= peak / max;
    return data;
  }

  /** 음표를 소리 표본으로 만든다. 음마다 톡 치고 서서히 사라지므로, 거꾸로 틀면 소리가 부풀다 뚝 끊긴다. */
  function renderMelody(notes, bpm, sr) {
    const beat = 60 / bpm;
    const lead = 0.08;
    const total = notes.reduce((sum, n) => sum + n.beats, 0) * beat;
    const out = new Float32Array(Math.ceil((lead + total + 0.18) * sr));
    const HARM = [1, 0.5, 0.28, 0.14];
    let t = lead;
    notes.forEach((n) => {
      const dur = n.beats * beat;
      const len = Math.floor(dur * 0.94 * sr);
      const at = Math.floor(t * sr);
      const w = (2 * Math.PI * midiToFreq(n.midi)) / sr;
      const tau = (0.16 + dur * 0.35) * sr;
      const fade = 0.02 * sr;
      for (let i = 0; i < len && at + i < out.length; i++) {
        const env = Math.min(1, i / (0.008 * sr)) * Math.exp(-i / tau) * Math.min(1, (len - i) / fade);
        let v = 0;
        for (let k = 0; k < HARM.length; k++) v += HARM[k] * Math.sin(w * (k + 1) * i);
        out[at + i] += v * env;
      }
      t += dur;
    });
    return normalize(out, 0.6);
  }

  function reverseSamples(data) {
    const n = data.length;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = data[n - 1 - i];
    return out;
  }

  /** 앞뒤의 조용한 부분을 잘라 낸다. 소리가 거의 없으면 null */
  function trimSilence(data, sr) {
    const win = Math.max(1, Math.floor(sr * 0.01));
    const rms = [];
    let peak = 0;
    for (let i = 0; i < data.length; i += win) {
      const end = Math.min(data.length, i + win);
      let sum = 0;
      for (let j = i; j < end; j++) sum += data[j] * data[j];
      const r = Math.sqrt(sum / (end - i));
      rms.push(r);
      peak = Math.max(peak, r);
    }
    if (peak < 0.003) return null;
    const th = peak * 0.12;
    let a = rms.findIndex((r) => r >= th);
    let b = rms.length - 1;
    while (b > a && rms[b] < th) b--;
    a = Math.max(0, a - 6);
    b = Math.min(rms.length - 1, b + 6);
    return data.slice(a * win, Math.min(data.length, (b + 1) * win));
  }

  function peaksOf(data, n) {
    const out = new Float32Array(n);
    const step = data.length / n;
    let max = 0;
    for (let i = 0; i < n; i++) {
      let m = 0;
      const end = Math.min(data.length, Math.floor((i + 1) * step));
      for (let j = Math.floor(i * step); j < end; j += 3) m = Math.max(m, Math.abs(data[j]));
      out[i] = m;
      max = Math.max(max, m);
    }
    if (max > 0) for (let i = 0; i < n; i++) out[i] /= max;
    return out;
  }

  // ------------------------------------------------------------ 소리 조각 (clip)
  function makeClip(data, sr) {
    return { data, sr, dur: data.length / sr, rev: null, bufs: {}, peaks: {} };
  }
  const reversedData = (clip) => clip.rev || (clip.rev = reverseSamples(clip.data));

  function bufferOf(ctx, clip, reverse) {
    const key = reverse ? 'r' : 'f';
    const cached = clip.bufs[key];
    if (cached && cached.ctx === ctx) return cached.buf;
    const buf = ctx.createBuffer(1, clip.data.length, clip.sr);
    buf.getChannelData(0).set(reverse ? reversedData(clip) : clip.data);
    clip.bufs[key] = { ctx, buf };
    return buf;
  }

  function peaksFor(clip, reverse) {
    const key = reverse ? 'r' : 'f';
    return clip.peaks[key] || (clip.peaks[key] = peaksOf(reverse ? reversedData(clip) : clip.data, 52));
  }

  const songClips = new Map();
  function songClip(song, tempo) {
    const key = song.id + '@' + tempo.toFixed(3);
    if (!songClips.has(key)) songClips.set(key, makeClip(renderMelody(song.parsed, song.bpm * tempo, SR), SR));
    return songClips.get(key);
  }

  // ----- 부모가 관리자 페이지에서 녹음해 둔 문제 (reverseAudio_questions_0|1|2, reverseAudio_<id>)
  function recordingMeta(level) {
    const groups = [];
    const seen = new Set();
    [level, 0, 1, 2]
      .filter((v, i, a) => a.indexOf(v) === i)
      .forEach((d) => {
        const list = Arcade.store.get('reverseAudio_questions_' + d, []);
        if (!Array.isArray(list)) return;
        const group = [];
        list.forEach((item) => {
          if (!item || typeof item.id !== 'string' || seen.has(item.id)) return;
          const answer = String(item.answer || '').trim();
          if (!answer) return;
          seen.add(item.id);
          group.push({ id: item.id, answer });
        });
        groups.push(shuffle(group)); // 지금 난이도에 등록한 녹음을 먼저 쓴다
      });
    return [].concat(...groups);
  }

  function readAudioUrl(id) {
    let url = null;
    try { url = localStorage.getItem(Arcade.ns('reverseAudio_' + id)); } catch (e) { return null; }
    if (url && url.charAt(0) === '"') {
      try { url = JSON.parse(url); } catch (e) { /* 그대로 쓴다 */ }
    }
    return typeof url === 'string' && url.startsWith('data:') ? url : null;
  }

  function dataUrlBytes(url) {
    const comma = url.indexOf(',');
    if (comma < 0) return null;
    try {
      const body = url.slice(comma + 1);
      const bin = /;base64/i.test(url.slice(0, comma)) ? atob(body) : decodeURIComponent(body);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) & 255;
      return bytes;
    } catch (e) {
      return null;
    }
  }

  function decodeAudio(ctx, arrayBuffer) {
    return new Promise((resolve, reject) => {
      try {
        const p = ctx.decodeAudioData(arrayBuffer, resolve, reject);
        if (p && p.then) p.then(resolve, reject);
      } catch (e) {
        reject(e);
      }
    });
  }

  /** 녹음을 한 갈래로 합치고, 앞뒤 침묵을 자르고, 크기를 맞춘다. */
  function clipFromAudio(buf) {
    if (!buf || !buf.length) return null;
    const n = buf.length;
    const chs = buf.numberOfChannels;
    let data = new Float32Array(n);
    for (let c = 0; c < chs; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) data[i] += d[i] / chs;
    }
    data = trimSilence(data, buf.sampleRate);
    if (!data) return null;
    const max = Math.floor(buf.sampleRate * 6);
    if (data.length > max) data = data.slice(0, max);
    return makeClip(normalize(data, 0.9), buf.sampleRate);
  }

  async function clipFromBlob(blob) {
    const ctx = Arcade.audio.context();
    if (!ctx || !blob || !blob.size) return null;
    try {
      const ab = blob.arrayBuffer ? await blob.arrayBuffer() : await new Response(blob).arrayBuffer();
      return clipFromAudio(await decodeAudio(ctx, ab));
    } catch (e) {
      return null;
    }
  }

  const recCache = new Map(); // 한 번 푼 녹음은 재도전 때 다시 풀지 않는다
  function loadRecording(meta) {
    const url = readAudioUrl(meta.id);
    if (!url) return Promise.resolve(null);
    const key = meta.id + ':' + url.length;
    if (!recCache.has(key)) {
      const job = (async () => {
        const ctx = Arcade.audio.context();
        const bytes = dataUrlBytes(url);
        if (!ctx || !bytes) return null;
        return clipFromAudio(await decodeAudio(ctx, bytes.buffer));
      })().catch(() => null);
      recCache.set(key, job);
    }
    return recCache.get(key).then((clip) => (clip ? { id: meta.id, answer: meta.answer, clip } : null));
  }
  const loadRecordings = (level) => Promise.all(recordingMeta(level).map(loadRecording)).then((list) => list.filter(Boolean));

  // ------------------------------------------------------------ 소리 내기와 마이크 (판이 끝나도 끌 수 있게 밖에 둔다)
  const sound = { ctx: null, gain: null, noise: null, cur: null };

  function output() {
    const ctx = Arcade.audio.context();
    if (!ctx || !ctx.createBufferSource) return null;
    if (sound.ctx !== ctx) {
      sound.ctx = ctx;
      sound.gain = ctx.createGain();
      sound.gain.connect(ctx.destination);
      sound.noise = null;
    }
    sound.gain.gain.value = Arcade.audio.muted ? 0 : 1;
    if (ctx.state === 'suspended' || ctx.state === 'interrupted') ctx.resume().catch(() => {}); // 아이폰은 전화·알림 뒤에 interrupted 가 된다
    return ctx;
  }

  function noiseBuffer(ctx) {
    if (!sound.noise) {
      const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      sound.noise = b;
    }
    return sound.noise;
  }

  /** 소리 조각을 튼다. noise 를 주면 지지직 소리를 함께 낸다. 오디오를 쓸 수 없으면 null */
  function startSound(clip, reverse, rate, offset, length, noise) {
    stopSound();
    const ctx = output();
    if (!ctx) return null;
    try {
      const src = ctx.createBufferSource();
      src.buffer = bufferOf(ctx, clip, reverse);
      src.playbackRate.value = rate;
      src.connect(sound.gain);
      if (length) src.start(0, offset, length);
      else src.start(0, offset);
      const cur = { src, nodes: [] };
      if (noise !== null && noise !== undefined) {
        const n = ctx.createBufferSource();
        n.buffer = noiseBuffer(ctx);
        n.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 2200;
        f.Q.value = 0.5;
        const g = ctx.createGain();
        g.gain.value = noise;
        n.connect(f);
        f.connect(g);
        g.connect(sound.gain);
        n.start();
        cur.noise = n;
        cur.noiseGain = g;
        cur.nodes.push(f, g);
      }
      sound.cur = cur;
      return cur;
    } catch (e) {
      return null;
    }
  }

  function stopSound() {
    const c = sound.cur;
    if (!c) return;
    sound.cur = null;
    [c.src, c.noise].forEach((n) => {
      if (!n) return;
      n.onended = null;
      try { n.stop(); } catch (e) { /* 이미 멈춤 */ }
      try { n.disconnect(); } catch (e) { /* 이미 끊김 */ }
    });
    c.nodes.forEach((n) => {
      try { n.disconnect(); } catch (e) { /* 이미 끊김 */ }
    });
  }

  /** 3스테이지: 재생 중에 빠르기와 지지직 크기를 바꾼다 */
  function retune(handle, rate, noise) {
    if (!handle) return;
    try { handle.src.playbackRate.setValueAtTime(rate, sound.ctx.currentTime); } catch (e) { handle.src.playbackRate.value = rate; }
    if (handle.noiseGain) handle.noiseGain.gain.value = noise;
  }

  const mic = { stream: null, rec: null };
  function closeMic() {
    if (mic.rec) {
      mic.rec.ondataavailable = null;
      mic.rec.onstop = null;
      try { if (mic.rec.state !== 'inactive') mic.rec.stop(); } catch (e) { /* 이미 멈춤 */ }
    }
    if (mic.stream) mic.stream.getTracks().forEach((t) => t.stop());
    mic.rec = null;
    mic.stream = null;
  }

  window.ReverseSound = {
    SR,
    noteToMidi,
    parseMelody,
    renderMelody,
    reverseSamples,
    trimSilence,
    peaksOf,
    dataUrlBytes,
    makeClip,
    peaksFor,
    songClip,
    recordingMeta,
    loadRecordings,
    clipFromBlob,
    startSound,
    stopSound,
    retune,
    mic,
    closeMic,
  };
})();
