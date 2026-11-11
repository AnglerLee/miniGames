// 아케이드 공통 엔진
// 모든 미니게임이 함께 쓰는 화면 틀, 진행 관리(스테이지·점수·콤보·하트·시간), 연출, 소리, 기록.
// 사용법은 docs/arcade-guide.md 를 본다.
(function () {
  'use strict';

  const embedded = window.parent !== window; // 보물찾기 안(iframe)에서 열렸는가
  const debug = /[?&]debug=1/.test(location.search);

  // ------------------------------------------------------------ 도우미
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (lo, hi) => lo + Math.random() * (hi - lo);
  const randInt = (lo, hi) => Math.floor(rand(lo, hi + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** 엘리먼트를 만든다. h('div', { class: 'a', text: '글', onclick: fn }, [자식...]) */
  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const key of Object.keys(attrs)) {
        const v = attrs[key];
        if (v === null || v === undefined || v === false) continue;
        if (key === 'class') el.className = v;
        else if (key === 'text') el.textContent = v;
        else if (key === 'html') el.innerHTML = v;
        else if (key === 'style' && typeof v === 'object') {
          // '--이름' 으로 시작하는 CSS 변수는 setProperty 로 넣어야 한다
          for (const prop of Object.keys(v)) {
            if (prop.startsWith('--')) el.style.setProperty(prop, v[prop]);
            else el.style[prop] = v[prop];
          }
        }
        else if (key === 'dataset') Object.assign(el.dataset, v);
        else if (key.startsWith('on') && typeof v === 'function') el.addEventListener(key.slice(2), v);
        else el.setAttribute(key, v === true ? '' : v);
      }
    }
    const list = Array.isArray(children) ? children : children === undefined ? [] : [children];
    for (const c of list) {
      if (c === null || c === undefined || c === false) continue;
      el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
    }
    return el;
  }

  // AnglerBox 에서는 여러 앱이 한 주소(출처)를 함께 쓴다. 이 사이트의 저장 키에는 모두 앱 이름을 앞에 붙인다.
  // 관리자 도구(admin-kit.js)의 접두사와 같아야 한다.
  const NS = 'minigames:';
  const ns = (key) => NS + key;

  const store = {
    get(key, fallback = null) {
      try {
        const raw = localStorage.getItem(ns(key));
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(ns(key), JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(ns(key));
      } catch (e) {
        /* 저장소를 쓸 수 없는 환경 */
      }
    },
  };

  /** 관리자 페이지가 저장한 설정을 기본값 위에 덮어서 돌려준다. */
  function loadSettings(key, defaults) {
    const saved = store.get(key, null);
    return Object.assign({}, defaults, saved && typeof saved === 'object' ? saved : {});
  }

  function vibrate(pattern) {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (e) {
      /* 진동을 지원하지 않는 기기 */
    }
  }

  function formatTime(sec) {
    const s = Math.max(0, sec);
    if (s < 10) return s.toFixed(1);
    if (s < 60) return String(Math.ceil(s));
    const whole = Math.ceil(s);
    return Math.floor(whole / 60) + ':' + String(whole % 60).padStart(2, '0');
  }

  const fmt = (n) => Math.round(n).toLocaleString('ko-KR');

  /** 오늘 날짜(기기 시간 기준) 'YYYY-MM-DD' */
  function today() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // ------------------------------------------------------------ 소리
  const audio = (() => {
    let ctx = null;
    let master = null;
    let muted = !!store.get('arcade_muted', false);

    function ensure() {
      if (ctx) return ctx;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
      } catch (e) {
        return null;
      }
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
      return ctx;
    }

    function unlock() {
      const c = ensure();
      if (c && c.state === 'suspended') c.resume().catch(() => {});
    }
    ['pointerdown', 'touchend', 'keydown'].forEach((type) =>
      window.addEventListener(type, unlock, { capture: true, passive: true })
    );

    /** 음 하나. at 은 오디오 시계의 절대 시각, delay 는 지금부터의 초. */
    function tone(o) {
      const c = ensure();
      if (!c || muted) return;
      const { freq = 440, to = null, type = 'sine', dur = 0.15, vol = 0.22, delay = 0, attack = 0.006 } = o;
      const t0 = (o.at || c.currentTime) + delay;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    }

    let noiseBuf = null;
    function noise(o) {
      const c = ensure();
      if (!c || muted) return;
      const { dur = 0.2, vol = 0.18, delay = 0, freq = 1500, to = null, q = 0.8, filter = 'bandpass' } = o;
      if (!noiseBuf) {
        noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const t0 = (o.at || c.currentTime) + delay;
      const src = c.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = filter;
      f.Q.value = q;
      f.frequency.setValueAtTime(freq, t0);
      if (to) f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f);
      f.connect(g);
      g.connect(master);
      src.start(t0);
      src.stop(t0 + dur + 0.03);
    }

    /** 음 여러 개를 차례로. seq 는 주파수 배열. */
    function run(seq, step, opt) {
      seq.forEach((f, i) => tone(Object.assign({ freq: f, delay: i * step }, opt)));
    }

    const SFX = {
      tap: () => tone({ freq: 540, type: 'triangle', dur: 0.05, vol: 0.16 }),
      pick: () => tone({ freq: 660, to: 990, type: 'triangle', dur: 0.08, vol: 0.2 }),
      flip: () => noise({ dur: 0.09, freq: 2600, to: 900, vol: 0.12 }),
      pop: () => tone({ freq: 380, to: 900, dur: 0.09, vol: 0.22 }),
      good: () => run([660, 880], 0.07, { type: 'triangle', dur: 0.12 }),
      great: () => run([660, 880, 1109], 0.06, { type: 'triangle', dur: 0.13 }),
      perfect: () => run([880, 1109, 1319, 1760], 0.055, { type: 'triangle', dur: 0.16 }),
      bad: () => tone({ freq: 220, to: 130, type: 'sawtooth', dur: 0.26, vol: 0.18 }),
      miss: () => tone({ freq: 320, to: 210, type: 'triangle', dur: 0.18, vol: 0.18 }),
      // 콤보가 쌓일수록 반음씩 올라간다
      combo: (n) => tone({ freq: 523 * Math.pow(2, clamp(n || 1, 1, 14) / 12), type: 'triangle', dur: 0.12, vol: 0.22 }),
      tick: () => tone({ freq: 1100, type: 'square', dur: 0.03, vol: 0.07 }),
      warn: () => run([880, 660], 0.12, { type: 'square', dur: 0.1, vol: 0.1 }),
      count: () => tone({ freq: 440, type: 'triangle', dur: 0.14, vol: 0.25 }),
      go: () => tone({ freq: 880, type: 'triangle', dur: 0.35, vol: 0.28 }),
      stage: () => run([523, 659, 784], 0.09, { type: 'triangle', dur: 0.18 }),
      win: () => {
        run([523, 659, 784, 1047], 0.11, { type: 'triangle', dur: 0.22, vol: 0.24 });
        [1047, 1319, 1568].forEach((f) => tone({ freq: f, delay: 0.46, dur: 0.6, vol: 0.14, type: 'triangle' }));
      },
      lose: () => run([392, 330, 262, 196], 0.14, { type: 'triangle', dur: 0.24, vol: 0.2 }),
      star: () => {
        tone({ freq: 1319, dur: 0.25, vol: 0.2, type: 'triangle' });
        tone({ freq: 1976, dur: 0.3, vol: 0.1, delay: 0.05 });
      },
      coin: () => run([988, 1319], 0.06, { type: 'square', dur: 0.1, vol: 0.1 }),
      bonus: () => run([784, 988, 1175, 1568], 0.05, { type: 'square', dur: 0.1, vol: 0.09 }),
      whoosh: () => noise({ dur: 0.25, freq: 400, to: 3000, vol: 0.14 }),
      lock: () => tone({ freq: 130, to: 80, type: 'square', dur: 0.1, vol: 0.2 }),
      unlock: () => {
        noise({ dur: 0.05, freq: 3000, vol: 0.2 });
        run([392, 587, 784], 0.07, { type: 'triangle', dur: 0.15, delay: 0.05 });
      },
      power: () => tone({ freq: 200, to: 900, type: 'sawtooth', dur: 0.4, vol: 0.12 }),
      zap: () => tone({ freq: 1400, to: 180, type: 'sawtooth', dur: 0.16, vol: 0.14 }),
      boom: () => {
        noise({ dur: 0.5, freq: 500, to: 60, vol: 0.4, filter: 'lowpass' });
        tone({ freq: 90, to: 35, dur: 0.5, vol: 0.4 });
      },
      heart: () => tone({ freq: 330, to: 150, type: 'square', dur: 0.3, vol: 0.14 }),
    };

    function play(name, arg) {
      const fn = SFX[name];
      if (!fn) return;
      try {
        fn(arg);
      } catch (e) {
        /* 소리가 안 나도 게임은 계속된다 */
      }
    }

    // 배경 리듬: 긴장도(0~1)에 따라 빨라지고 악기가 늘어난다
    const music = (() => {
      let timer = null;
      let step = 0;
      let next = 0;
      let intensity = 0;
      const BASS = [0, 0, 7, 0, 3, 3, 10, 7];
      const LEAD = [12, 15, 19, 15, 22, 19, 15, 19];

      function tick() {
        const c = ensure();
        if (!c || muted || c.state !== 'running') return;
        if (next < c.currentTime) next = c.currentTime + 0.05;
        while (next < c.currentTime + 0.15) {
          const beat = step % 16;
          const bar = Math.floor(step / 16) % 2;
          const note = (n) => 55 * Math.pow(2, n / 12);
          if (beat % 4 === 0 || (intensity > 0.45 && beat % 4 === 2)) {
            const n = BASS[(Math.floor(beat / 2) + bar * 4) % 8];
            tone({ at: next, freq: note(n + 12), type: 'triangle', dur: 0.2, vol: 0.09 });
          }
          if (intensity > 0.2 && beat % 2 === 1) noise({ at: next, dur: 0.03, freq: 6000, vol: 0.025, filter: 'highpass' });
          if (intensity > 0.7 && beat % 2 === 0) {
            tone({ at: next, freq: note(LEAD[(beat / 2) % 8] + 24), type: 'square', dur: 0.09, vol: 0.03 });
          }
          const bpm = 96 + intensity * 60;
          next += 60 / bpm / 4;
          step++;
        }
      }

      return {
        start() {
          if (timer) return;
          step = 0;
          next = 0;
          timer = setInterval(tick, 40);
        },
        stop() {
          clearInterval(timer);
          timer = null;
        },
        setIntensity(v) {
          intensity = clamp(v, 0, 1);
        },
        get playing() {
          return !!timer;
        },
      };
    })();

    return {
      unlock,
      tone,
      noise,
      play,
      music,
      get muted() {
        return muted;
      },
      setMuted(v) {
        muted = !!v;
        store.set('arcade_muted', muted);
      },
      /** 마이크를 쓰는 게임이 같은 오디오 컨텍스트를 쓰고 싶을 때 */
      context: () => ensure(),
    };
  })();

  // ------------------------------------------------------------ 연출
  const fx = (() => {
    let layer = null;
    const COLORS = ['#ffd166', '#ff5d73', '#36d6ff', '#3ddc97', '#b388ff', '#ffffff'];

    function getLayer() {
      if (!layer || !layer.isConnected) {
        layer = h('div', { class: 'ar-fx' });
        document.body.appendChild(layer);
      }
      return layer;
    }

    /** 엘리먼트면 그 가운데, {x,y} 면 그대로, 없으면 화면 가운데 */
    function point(target) {
      if (target && typeof target.getBoundingClientRect === 'function') {
        const r = target.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
      if (target && typeof target.x === 'number') return target;
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }

    function animate(el, frames, opts) {
      if (!el.animate) {
        setTimeout(() => el.remove(), opts.duration);
        return;
      }
      el.animate(frames, opts).onfinish = () => el.remove();
    }

    function burst(target, o = {}) {
      const { count = 14, colors = COLORS, emoji = null, spread = 90, size = 9, life = 700 } = o;
      const { x, y } = point(target);
      const root = getLayer();
      for (let i = 0; i < count; i++) {
        const ang = rand(0, Math.PI * 2);
        const dist = rand(spread * 0.35, spread);
        const p = h('div', { class: 'p' });
        if (emoji) {
          p.textContent = Array.isArray(emoji) ? pick(emoji) : emoji;
          p.style.fontSize = size * 2 + 'px';
          p.style.background = 'none';
        } else {
          const s = rand(size * 0.6, size * 1.3);
          p.style.width = s + 'px';
          p.style.height = s + 'px';
          p.style.background = pick(colors);
        }
        root.appendChild(p);
        const dx = Math.cos(ang) * dist;
        const dy = Math.sin(ang) * dist;
        animate(
          p,
          [
            { transform: `translate(${x}px, ${y}px) scale(1) rotate(0deg)`, opacity: 1 },
            { transform: `translate(${x + dx}px, ${y + dy + 40}px) scale(0.3) rotate(${rand(-240, 240)}deg)`, opacity: 0 },
          ],
          { duration: life * rand(0.7, 1.1), easing: 'cubic-bezier(.15,.7,.3,1)', fill: 'forwards' }
        );
      }
    }

    function floatText(target, text, o = {}) {
      const { color = '#fff', size = 24, rise = 64, life = 900 } = o;
      const { x, y } = point(target);
      const el = h('div', { class: 'ft', text, style: { color, fontSize: size + 'px' } });
      getLayer().appendChild(el);
      const w = el.offsetWidth / 2;
      const hh = el.offsetHeight / 2;
      const px = clamp(x - w, 4, window.innerWidth - w * 2 - 4);
      animate(
        el,
        [
          { transform: `translate(${px}px, ${y - hh}px) scale(0.6)`, opacity: 0 },
          { transform: `translate(${px}px, ${y - hh - rise * 0.4}px) scale(1.15)`, opacity: 1, offset: 0.25 },
          { transform: `translate(${px}px, ${y - hh - rise}px) scale(1)`, opacity: 0 },
        ],
        { duration: life, easing: 'ease-out', fill: 'forwards' }
      );
    }

    function shake(el, strength = 8, ms = 320) {
      const node = el || document.querySelector('.ar-app');
      if (!node || !node.animate) return;
      const s = strength;
      node.animate(
        [
          { transform: 'translate(0,0)' },
          { transform: `translate(${-s}px, ${s * 0.4}px)` },
          { transform: `translate(${s * 0.8}px, ${-s * 0.5}px)` },
          { transform: `translate(${-s * 0.6}px, ${-s * 0.3}px)` },
          { transform: `translate(${s * 0.4}px, ${s * 0.3}px)` },
          { transform: 'translate(0,0)' },
        ],
        { duration: ms, easing: 'ease-out' }
      );
    }

    function flash(color = 'rgba(255,255,255,.35)', ms = 240) {
      const el = h('div', { class: 'ar-flash', style: { background: color } });
      getLayer().appendChild(el);
      animate(el, [{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: 'ease-out', fill: 'forwards' });
    }

    function confetti(count = 70) {
      const root = getLayer();
      const W = window.innerWidth;
      const H = window.innerHeight;
      for (let i = 0; i < count; i++) {
        const p = h('div', { class: 'p' });
        const w = rand(6, 11);
        p.style.width = w + 'px';
        p.style.height = w * rand(0.4, 1.4) + 'px';
        p.style.background = pick(COLORS);
        root.appendChild(p);
        const x0 = rand(0, W);
        const drift = rand(-80, 80);
        animate(
          p,
          [
            { transform: `translate(${x0}px, -20px) rotate(0deg)`, opacity: 1 },
            { transform: `translate(${x0 + drift}px, ${H + 30}px) rotate(${rand(-720, 720)}deg)`, opacity: 0.9 },
          ],
          { duration: rand(1400, 2600), delay: rand(0, 500), easing: 'cubic-bezier(.3,.2,.6,1)', fill: 'forwards' }
        );
      }
    }

    let toastEl = null;
    let toastTimer = null;
    function toast(text, o = {}) {
      const { ms = 1400, kind = '' } = o;
      if (toastEl) toastEl.remove();
      clearTimeout(toastTimer);
      toastEl = h('div', { class: 'ar-toast ' + kind, html: text });
      getLayer().appendChild(toastEl);
      const mine = toastEl;
      toastTimer = setTimeout(() => mine.remove(), ms);
    }

    /**
     * 화면 가운데 큰 안내 띠. 사라질 때 끝나는 Promise 를 돌려준다.
     * o.manual 이면 저절로 사라지지 않고, 닫는 함수를 바로 돌려준다(game.banner 가 게임 시계로 닫을 때 쓴다).
     */
    function banner(title, sub, o = {}) {
      const { ms = 1300, kind = '' } = o;
      const el = h('div', { class: 'ar-banner ' + kind }, [
        h('div', { class: 't', html: title }),
        sub ? h('div', { class: 's', html: sub }) : null,
      ]);
      getLayer().appendChild(el);
      if (o.manual) {
        return () => animate(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
      }
      return new Promise((resolve) => {
        setTimeout(() => {
          animate(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
          resolve();
        }, ms);
      });
    }

    function pop(el) {
      if (!el) return;
      el.classList.remove('ar-pop');
      void el.offsetWidth;
      el.classList.add('ar-pop');
    }

    function clear() {
      if (layer) layer.innerHTML = '';
    }

    return { burst, floatText, shake, flash, confetti, toast, banner, pop, point, clear };
  })();

  // ------------------------------------------------------------ 기록
  const RECORD_KEY = 'arcade_records';
  const records = {
    all: () => store.get(RECORD_KEY, {}) || {},
    get(id) {
      return records.all()[id] || { best: null, stars: 0, plays: 0, clears: 0 };
    },
    update(id, fn) {
      const all = records.all();
      const rec = Object.assign({ best: null, stars: 0, plays: 0, clears: 0 }, all[id]);
      fn(rec);
      rec.at = new Date().toISOString();
      all[id] = rec;
      store.set(RECORD_KEY, all);
      return rec;
    },
    totalStars() {
      const all = records.all();
      return Object.keys(all).reduce((sum, k) => sum + (all[k].stars || 0), 0);
    },
  };

  // ------------------------------------------------------------ 센서 권한
  const sensors = {
    /** 기울기·흔들기 센서 권한을 요청한다. 반드시 버튼 누름 처리 안에서 불러야 한다(iOS). */
    async requestMotion() {
      const ask = async (Ctor) => {
        if (Ctor && typeof Ctor.requestPermission === 'function') {
          try {
            return (await Ctor.requestPermission()) === 'granted';
          } catch (e) {
            return false;
          }
        }
        return !!Ctor;
      };
      const motion = await ask(window.DeviceMotionEvent);
      const orient = await ask(window.DeviceOrientationEvent);
      return motion || orient;
    },
  };

  // 보물찾기가 보내 주는 테마 배경
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (d && d.type === 'THEME_BG') {
      const bg = d.gradient || d.bg;
      if (bg) {
        document.body.style.background = bg;
        document.body.style.backgroundAttachment = 'fixed';
        document.body.classList.add('ar-themed');
      }
    }
  });

  // 브라우저 기본 동작 가운데 게임을 방해하는 것들을 막는다
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  // ------------------------------------------------------------ 게임 틀
  /**
   * 게임 하나를 만든다. config:
   *   id, title, icon, tagline, howTo[], accent, accent2
   *   lives        하트 수 (없으면 하트 표시 안 함)
   *   stages       스테이지 수 (없으면 진행 칸 표시 안 함)
   *   showScore    점수 표시 여부 (기본 true)
   *   scoreLabel   결과 화면의 점수 이름 (기본 '점수')
   *   lowerIsBetter 기록이 낮을수록 좋은가
   *   countdown    시작 전 3-2-1 (기본 true)
   *   music        배경 리듬 (기본 true, 마이크 게임은 false)
   *   startLabel   시작 버튼 글자
   *   prepare()    시작 버튼을 눌렀을 때 바로 불린다 (센서·카메라 권한 요청). Promise 가능
   *   start(game)  게임 시작. 재도전 때마다 다시 불린다
   */
  function createGame(config) {
    const cfg = Object.assign(
      { icon: '🎮', tagline: '', howTo: [], showScore: true, scoreLabel: '점수', countdown: true, music: true },
      config
    );
    const homeUrl = cfg.home || '../../index.html';
    let clearSent = false;

    // ----- 화면
    const el = {};
    el.pause = h('button', { class: 'ar-icon-btn', 'aria-label': '일시 정지', text: '⏸' });
    el.title = h('div', { class: 'ar-hud-title', text: cfg.icon + ' ' + cfg.title });
    el.pips = h('div', { class: 'ar-pips' });
    el.score = h('div', { class: 'ar-score', text: '0' });
    el.lives = h('div', { class: 'ar-lives' });
    el.timeFill = h('i');
    el.timebar = h('div', { class: 'ar-timebar' }, el.timeFill);
    el.time = h('div', { class: 'ar-time' });
    el.bar = h('div', { class: 'ar-hud-bar ar-hidden' }, [el.lives, el.timebar, el.time]);
    el.goal = h('div', { class: 'ar-goal ar-hidden' });
    el.hud = h('header', { class: 'ar-hud' }, [
      h('div', { class: 'ar-hud-top' }, [el.pause, h('div', { class: 'ar-hud-mid' }, [el.title, el.pips]), el.score]),
      el.bar,
      el.goal,
    ]);
    el.combo = h('div', { class: 'ar-combo' });
    el.stage = h('main', { class: 'ar-stage' });
    // 콤보 표시는 게임이 root 를 비워도 사라지지 않도록 바깥 틀에 둔다
    el.wrap = h('div', { class: 'ar-stage-wrap' }, [el.stage, el.combo]);
    el.footer = h('footer', { class: 'ar-footer' });
    el.app = h('div', { class: 'ar-app' }, [el.hud, el.wrap, el.footer]);
    // 강조색은 겹침 화면(시작·결과)에도 쓰이므로 문서 전체에 건다
    if (cfg.accent) document.documentElement.style.setProperty('--ar-accent', cfg.accent);
    if (cfg.accent2) document.documentElement.style.setProperty('--ar-accent-2', cfg.accent2);
    // 강조색이 밝으면 버튼 글자를 어둡게 해서 읽히게 한다
    const brightness = (hex) => {
      const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
      if (!m) return 0;
      const n = parseInt(m[1], 16);
      return (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
    };
    if (cfg.accent && cfg.accent2 && (brightness(cfg.accent) + brightness(cfg.accent2)) / 2 > 165) {
      document.documentElement.style.setProperty('--ar-on-accent', '#2a1a05');
    }
    document.body.appendChild(el.app);
    if (!cfg.showScore) el.score.classList.add('ar-hidden');

    // ----- 시계와 예약 (일시 정지하면 함께 멈춘다)
    let now = 0; // 플레이한 시간(ms)
    let running = false;
    let lastTs = 0;
    let tasks = new Set();
    let loops = new Set();
    let listeners = [];
    let cleanups = [];
    let generation = 0; // 재시작할 때마다 올라간다. 지난 판의 콜백을 버리는 데 쓴다

    function frame(ts) {
      requestAnimationFrame(frame);
      const dt = Math.min(100, ts - (lastTs || ts));
      lastTs = ts;
      if (!running) return;
      now += dt;
      for (const t of Array.from(tasks)) {
        if (!tasks.has(t) || t.at > now) continue;
        if (t.every) t.at += t.every;
        else tasks.delete(t);
        t.fn();
        if (!running) return;
      }
      for (const fn of Array.from(loops)) {
        if (loops.has(fn)) fn(dt / 1000, now / 1000);
        if (!running) return;
      }
      updateTimer();
    }
    requestAnimationFrame(frame);

    // ----- 상태
    const state = {
      phase: 'intro', // intro | countdown | playing | paused | ended
      score: 0,
      lives: 0,
      maxLives: 0,
      combo: 0,
      maxCombo: 0,
      stage: 0,
      stageTotal: 0,
      retry: 0,
      checkpoint: 0,
    };
    let timer = null;
    let overlay = null;
    let tensionFloor = 0; // 게임이 정하는 배경 리듬 긴장도의 하한 (game.setTension)
    let pauseHandlers = []; // 이번 판에서 등록한 일시 정지 알림 (game.onPauseChange)
    let runMusic = true; // 이번 판에서 배경 리듬을 켤지 (game.setMusic)

    function closeOverlay() {
      if (overlay) overlay.remove();
      overlay = null;
    }

    function openOverlay(children, extraClass) {
      closeOverlay();
      overlay = h('div', { class: 'ar-overlay' + (extraClass ? ' ' + extraClass : '') }, h('div', { class: 'ar-sheet' }, children));
      document.body.appendChild(overlay);
      return overlay;
    }

    function starRow(n, small) {
      return h(
        'div',
        { class: 'ar-stars' + (small ? ' sm' : '') },
        [0, 1, 2].map((i) => h('span', { class: small && i < n ? 'on' : '', text: '⭐' }))
      );
    }

    // ----- HUD 갱신
    function renderLives() {
      el.lives.innerHTML = '';
      for (let i = 0; i < state.maxLives; i++) {
        el.lives.appendChild(h('span', { class: i < state.lives ? '' : 'off', text: '❤️' }));
      }
      syncBar();
    }

    function syncBar() {
      const showTime = !!timer;
      el.timebar.style.visibility = showTime ? '' : 'hidden';
      el.time.style.visibility = showTime ? '' : 'hidden';
      el.bar.classList.toggle('ar-hidden', !showTime && state.maxLives === 0);
    }

    function renderPips() {
      el.pips.innerHTML = '';
      for (let i = 0; i < state.stageTotal; i++) {
        el.pips.appendChild(h('i', { class: i < state.stage ? 'done' : i === state.stage ? 'now' : '' }));
      }
    }

    function renderScore(bump) {
      el.score.textContent = fmt(state.score);
      if (bump) {
        el.score.classList.remove('bump');
        void el.score.offsetWidth;
        el.score.classList.add('bump');
      }
    }

    function renderCombo(bump) {
      const n = state.combo;
      el.combo.textContent = n + ' 콤보';
      el.combo.classList.toggle('on', n >= 2);
      el.combo.classList.toggle('hot', n >= 8);
      if (bump && n >= 2) {
        el.combo.classList.remove('bump');
        void el.combo.offsetWidth;
        el.combo.classList.add('bump');
      }
    }

    function updateTimer() {
      if (!timer || timer.stopped) return;
      if (!timer.paused) timer.left -= (now - timer.last) / 1000;
      timer.last = now;
      const left = Math.max(0, timer.left);
      el.timeFill.style.transform = `scaleX(${clamp(left / timer.total, 0, 1)})`;
      el.time.textContent = formatTime(left);
      const warn = left <= timer.warnAt;
      el.hud.classList.toggle('warn', warn);
      if (cfg.music) audio.music.setIntensity(Math.max(timer.baseIntensity, tensionFloor, warn ? 1 : 1 - left / timer.total));
      if (warn && left > 0) {
        const sec = Math.ceil(left);
        if (sec !== timer.lastTick) {
          timer.lastTick = sec;
          if (sec <= 5) audio.play('tick');
        }
      }
      if (left <= 0) {
        timer.stopped = true;
        const cb = timer.onEnd;
        if (cb) cb();
      }
    }

    // ----- 판 정리와 재시작
    function cleanup() {
      generation++;
      tasks = new Set();
      loops = new Set();
      listeners.forEach(([target, type, fn, opts]) => target.removeEventListener(type, fn, opts));
      listeners = [];
      runCleanups();
      timer = null;
      tensionFloor = 0;
      pauseHandlers = [];
      runMusic = true;
      el.hud.classList.remove('warn');
      fx.clear();
    }

    function resetBoard() {
      cleanup();
      el.stage.innerHTML = '';
      el.footer.innerHTML = '';
      el.goal.classList.add('ar-hidden');
      state.score = 0;
      state.combo = 0;
      state.maxCombo = 0;
      state.stage = state.checkpoint || 0;
      state.stageTotal = cfg.stages || 0;
      state.maxLives = cfg.lives || 0;
      state.lives = state.maxLives;
      now = 0;
      renderScore();
      renderCombo();
      renderLives();
      renderPips();
      syncBar();
    }

    async function begin() {
      closeOverlay();
      el.app.classList.remove('ar-paused');
      document.body.classList.remove('ar-is-paused');
      resetBoard();
      const gen = generation;
      state.phase = 'countdown';
      if (cfg.countdown) {
        const box = h('div', { class: 'ar-count' });
        document.body.appendChild(box);
        for (const label of ['3', '2', '1']) {
          box.innerHTML = '';
          box.appendChild(h('span', { text: label }));
          audio.play('count');
          await wait(620);
          if (gen !== generation) return box.remove();
        }
        box.innerHTML = '';
        box.appendChild(h('span', { text: '시작!' }));
        audio.play('go');
        await wait(420);
        box.remove();
        if (gen !== generation) return;
      }
      state.phase = 'playing';
      running = true;
      records.update(cfg.id, (r) => {
        r.plays = (r.plays || 0) + 1;
      });
      if (cfg.music) {
        audio.music.setIntensity(0);
        audio.music.start();
      }
      try {
        if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => {});
      } catch (e) {
        /* 화면 꺼짐 방지를 지원하지 않는 기기 */
      }
      try {
        cfg.start(game);
      } catch (e) {
        console.error(e);
      }
    }

    function runCleanups() {
      cleanups.splice(0).forEach((fn) => {
        try {
          fn();
        } catch (e) {
          console.error(e);
        }
      });
    }

    function stopPlay() {
      running = false;
      state.phase = 'ended';
      runCleanups(); // 판이 끝나면 카메라·마이크·센서를 바로 끈다
      fx.clear(); // 직전 안내 문구나 조각이 결과 화면 위에 남지 않게
      audio.music.stop();
      if (timer) timer.stopped = true;
    }

    function goHome() {
      location.href = homeUrl;
    }

    function sendClear(stars) {
      if (clearSent) return;
      clearSent = true;
      try {
        window.parent.postMessage({ type: 'GAME_CLEAR', gameId: cfg.id, stars, score: state.score }, '*');
      } catch (e) {
        console.error(e);
      }
    }

    // ----- 시작 화면
    function showIntro() {
      const rec = records.get(cfg.id);
      const best =
        rec.clears > 0
          ? h('div', { class: 'ar-best' }, [
              '내 기록 ',
              starRow(rec.stars, true),
              rec.best !== null && cfg.showScore ? h('b', { text: ' ' + fmt(rec.best) + (cfg.scoreUnit || '점') }) : null,
            ])
          : null;
      const startBtn = h('button', { class: 'ar-btn lg block', text: cfg.startLabel || '시작!' });
      startBtn.addEventListener('click', async () => {
        if (startBtn.disabled) return;
        startBtn.disabled = true;
        audio.unlock();
        audio.play('pick');
        if (cfg.prepare) {
          try {
            // 권한 창이 오래 떠 있어도 시작이 막히지 않게 10초까지만 기다린다
            await Promise.race([Promise.resolve(cfg.prepare(game)), wait(10000)]);
          } catch (e) {
            console.error(e);
          }
        }
        begin();
      });
      openOverlay([
        h('div', { class: 'ar-emblem', text: cfg.icon }),
        h('h1', { text: cfg.title }),
        cfg.tagline ? h('p', { class: 'ar-tagline', html: cfg.tagline }) : null,
        cfg.howTo.length
          ? h(
              'ul',
              { class: 'ar-howto' },
              cfg.howTo.map((line, i) => h('li', { dataset: { n: String(i + 1) } }, h('span', { html: line })))
            )
          : null,
        best,
        h('div', { class: 'ar-actions' }, [
          startBtn,
          embedded ? null : h('button', { class: 'ar-btn ghost sm block', text: '게임 목록', onclick: goHome }),
        ]),
      ]);
    }

    // ----- 일시 정지
    function pause() {
      if (state.phase !== 'playing') return;
      state.phase = 'paused';
      running = false;
      el.app.classList.add('ar-paused'); // CSS 움직임도 함께 멈춘다
      document.body.classList.add('ar-is-paused'); // 연출 층(안내 띠, 조각)도 정지 화면 아래로 숨긴다
      audio.music.stop();
      const soundBtn = h('button', { class: 'ar-btn ghost block' });
      const paint = () => (soundBtn.textContent = audio.muted ? '🔇 소리 꺼짐' : '🔊 소리 켜짐');
      paint();
      soundBtn.addEventListener('click', () => {
        audio.setMuted(!audio.muted);
        paint();
        audio.play('tap');
      });
      openOverlay([
        h('div', { class: 'ar-emblem', text: '⏸' }),
        h('h1', { text: '잠깐 멈춤' }),
        h('p', { class: 'ar-tagline', text: '시간도 함께 멈춰 있어요' }),
        h('div', { class: 'ar-actions' }, [
          h('button', { class: 'ar-btn lg block', text: '계속하기', onclick: resume }),
          soundBtn,
          h('button', {
            class: 'ar-btn ghost block',
            text: '처음부터 다시',
            onclick: () => {
              state.retry = 0;
              state.checkpoint = 0;
              begin();
            },
          }),
          embedded ? null : h('button', { class: 'ar-btn ghost block', text: '게임 목록', onclick: goHome }),
        ]),
      ], 'solid');
      pauseHandlers.forEach((fn) => fn(true));
      if (cfg.onPause) cfg.onPause(game);
    }

    function resume() {
      if (state.phase !== 'paused') return;
      closeOverlay();
      state.phase = 'playing';
      running = true;
      el.app.classList.remove('ar-paused');
      document.body.classList.remove('ar-is-paused');
      if (cfg.music && runMusic) audio.music.start();
      pauseHandlers.forEach((fn) => fn(false));
      if (cfg.onResume) cfg.onResume(game);
    }

    el.pause.addEventListener('click', () => {
      audio.play('tap');
      pause();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pause();
    });

    // ----- 결과
    function win(o = {}) {
      if (state.phase === 'ended') return;
      stopPlay();
      const stars = clamp(Math.round(o.stars === undefined ? 3 : o.stars), 1, 3);
      const before = records.get(cfg.id);
      let isBest = false;
      records.update(cfg.id, (r) => {
        r.clears = (r.clears || 0) + 1;
        r.stars = Math.max(r.stars || 0, stars);
        r.lastClear = today(); // 게임 목록의 "오늘의 도전"이 본다
        const better =
          r.best === null || r.best === undefined || (cfg.lowerIsBetter ? state.score < r.best : state.score > r.best);
        if (better) {
          r.best = state.score;
          isBest = before.clears > 0;
        }
      });

      audio.play('win');
      vibrate([80, 60, 80, 60, 160]);
      fx.confetti();

      const starsEl = starRow(0);
      const scoreEl = h('div', { class: 'ar-result-score', text: '0' });
      const secret = store.get('treasureHunt_gameConfigs', {}) || {};
      const mine = (!embedded && secret[cfg.id]) || {};
      const actions = embedded
        ? h('div', { class: 'ar-actions' }, [
            h('button', { class: 'ar-btn gold lg block', text: '다음으로 ▶', onclick: () => sendClear(stars) }),
          ])
        : h('div', { class: 'ar-actions row' }, [
            h('button', { class: 'ar-btn ghost', text: '게임 목록', onclick: goHome }),
            h('button', {
              class: 'ar-btn',
              text: '한 번 더',
              onclick: () => {
                state.retry = 0;
                state.checkpoint = 0;
                begin();
              },
            }),
          ]);
      openOverlay([
        h('div', { class: 'ar-label', text: 'MISSION CLEAR' }),
        h('h1', { html: o.title || '미션 성공!' }),
        starsEl,
        cfg.showScore ? scoreEl : null,
        cfg.showScore && isBest ? h('div', { class: 'ar-newbest', text: '🏆 신기록!' }) : null,
        o.message ? h('p', { class: 'ar-msg', html: o.message }) : null,
        o.stats && o.stats.length
          ? h(
              'dl',
              { class: 'ar-stats' },
              o.stats.flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { html: String(v) })])
            )
          : null,
        mine.secretCode
          ? h('div', { class: 'ar-secret' }, [
              h('div', { class: 'ar-label', text: '🔑 비밀번호' }),
              h('div', { class: 'code', text: mine.secretCode }),
            ])
          : null,
        mine.hintMessage ? h('p', { class: 'ar-msg', text: '💡 ' + mine.hintMessage }) : null,
        actions,
      ]);

      // 별이 하나씩 켜지고 점수가 올라간다
      Array.from(starsEl.children).forEach((s, i) => {
        if (i >= stars) return;
        setTimeout(() => {
          s.classList.add('on');
          audio.play('star');
          fx.burst(s, { count: 8, spread: 50, colors: ['#ffd166', '#fff3c4', '#ffb938'] });
        }, 450 + i * 380);
      });
      const target = state.score;
      const t0 = performance.now();
      const unit = cfg.scoreUnit || '점';
      (function countUp(ts) {
        const k = clamp((ts - t0) / 900, 0, 1);
        scoreEl.textContent = fmt(target * (1 - Math.pow(1 - k, 3))) + unit;
        if (k < 1) requestAnimationFrame(countUp);
      })(t0);

      // 보물찾기에서는 아이가 버튼을 누르지 않아도 잠시 뒤 다음으로 넘어간다
      if (embedded) setTimeout(() => sendClear(stars), 15000);
      if (cfg.onEnd) cfg.onEnd(game, true);
    }

    function lose(o = {}) {
      if (state.phase === 'ended') return;
      stopPlay();
      if (typeof o.checkpoint === 'number') state.checkpoint = o.checkpoint;
      audio.play('lose');
      vibrate(250);
      const again = () => {
        state.retry++;
        begin();
      };
      openOverlay([
        h('div', { class: 'ar-emblem', text: o.icon || '😵' }),
        h('h1', { html: o.title || '아깝다!' }),
        h('p', { class: 'ar-msg', html: o.message || '다시 도전해 보자!' }),
        state.checkpoint > 0
          ? h('p', { class: 'ar-tagline', text: `스테이지 ${state.checkpoint + 1}부터 이어서 할 수 있어요` })
          : null,
        h('div', { class: 'ar-actions' }, [
          h('button', { class: 'ar-btn lg block', text: '다시 도전', onclick: again }),
          state.checkpoint > 0
            ? h('button', {
                class: 'ar-btn ghost block',
                text: '처음부터',
                onclick: () => {
                  state.checkpoint = 0;
                  again();
                },
              })
            : null,
          embedded ? null : h('button', { class: 'ar-btn ghost block', text: '게임 목록', onclick: goHome }),
        ]),
      ]);
      if (cfg.onEnd) cfg.onEnd(game, false);
    }

    // ----- 게임이 쓰는 기능
    const guard = (fn) => {
      const gen = generation;
      return (...args) => {
        if (gen === generation) return fn(...args);
        return undefined;
      };
    };

    const game = {
      config: cfg,
      root: el.stage,
      footer: el.footer,
      app: el.app,
      embedded,
      debug,

      get phase() {
        return state.phase;
      },
      get playing() {
        return state.phase === 'playing';
      },
      /** 재도전 횟수. 난이도를 조금 풀어 주는 데 쓴다 */
      get retry() {
        return state.retry;
      },
      /** 실패했을 때 저장해 둔 스테이지. 재도전하면 여기서 다시 시작한다 */
      get checkpoint() {
        return state.checkpoint;
      },
      /** 플레이한 시간(초). 일시 정지 중에는 흐르지 않는다 */
      get time() {
        return now / 1000;
      },

      // 점수
      get score() {
        return state.score;
      },
      setScore(v) {
        state.score = Math.max(0, Math.round(v));
        renderScore();
      },
      addScore(n, at) {
        state.score = Math.max(0, Math.round(state.score + n));
        renderScore(true);
        if (at) fx.floatText(at, (n >= 0 ? '+' : '') + fmt(n), { color: n >= 0 ? '#ffd166' : '#ff5d73' });
        return state.score;
      },

      // 콤보
      get combo() {
        return state.combo;
      },
      get maxCombo() {
        return state.maxCombo;
      },
      addCombo() {
        state.combo++;
        state.maxCombo = Math.max(state.maxCombo, state.combo);
        renderCombo(true);
        audio.play('combo', state.combo);
        return state.combo;
      },
      resetCombo() {
        state.combo = 0;
        renderCombo();
      },

      // 하트
      get lives() {
        return state.lives;
      },
      setLives(n, max) {
        if (typeof max === 'number') state.maxLives = max;
        state.lives = clamp(n, 0, state.maxLives);
        renderLives();
      },
      /** 하트를 하나 잃는다. 남은 수를 돌려준다. 0 이면 게임이 lose() 를 부른다 */
      loseLife(at) {
        state.lives = Math.max(0, state.lives - 1);
        renderLives();
        audio.play('heart');
        vibrate(120);
        fx.flash('rgba(255,60,90,.28)');
        fx.shake(el.app, 7);
        if (at) fx.floatText(at, '💔', { size: 30 });
        return state.lives;
      },
      gainLife() {
        state.lives = Math.min(state.maxLives, state.lives + 1);
        renderLives();
        audio.play('bonus');
        return state.lives;
      },

      // 스테이지
      get stage() {
        return state.stage;
      },
      setStage(index, total) {
        state.stage = index;
        if (typeof total === 'number') state.stageTotal = total;
        renderPips();
      },
      setGoal(html) {
        el.goal.classList.toggle('ar-hidden', !html);
        el.goal.innerHTML = html || '';
      },
      setTitle(text) {
        el.title.textContent = text;
      },

      // 시간 제한
      /**
       * 화면 위 시간 막대를 시작한다.
       * opts: { onEnd, warnAt(초, 기본 10), intensity(배경 리듬의 최소 긴장도 0~1) }
       */
      startTimer(seconds, opts = {}) {
        timer = {
          total: seconds,
          left: seconds,
          last: now,
          warnAt: opts.warnAt === undefined ? Math.min(10, seconds * 0.3) : opts.warnAt,
          onEnd: opts.onEnd ? guard(opts.onEnd) : null,
          baseIntensity: opts.intensity || 0,
          paused: false,
          stopped: false,
          lastTick: -1,
        };
        const mine = timer;
        syncBar();
        updateTimer();
        return {
          left: () => Math.max(0, mine.left),
          ratio: () => clamp(mine.left / mine.total, 0, 1),
          add(sec, opt) {
            mine.left = Math.max(0, mine.left + sec);
            if (mine.left > mine.total) mine.total = mine.left;
            if (opt && opt.silent) return;
            if (sec > 0) fx.floatText(el.time, '+' + sec + '초', { color: '#3ddc97', size: 18, rise: -30 });
            else if (sec < 0) fx.floatText(el.time, sec + '초', { color: '#ff5d73', size: 18, rise: -30 });
          },
          pause() {
            mine.paused = true;
          },
          resume() {
            mine.paused = false;
          },
          stop() {
            mine.stopped = true;
          },
        };
      },
      stopTimer() {
        if (timer) timer.stopped = true;
        el.hud.classList.remove('warn');
      },
      hideTimer() {
        timer = null;
        el.hud.classList.remove('warn');
        syncBar();
      },
      timeLeft() {
        return timer ? Math.max(0, timer.left) : 0;
      },
      /** 이번 판의 배경 리듬을 끄거나 다시 켠다. 게임이 직접 박자를 내는 스테이지에서 쓴다 */
      setMusic(on) {
        runMusic = !!on;
        if (!runMusic) audio.music.stop();
        else if (cfg.music && state.phase === 'playing') audio.music.start();
      },
      /** 배경 리듬 긴장도(0~1)의 하한. 시간 막대가 있어도 이 값 아래로 내려가지 않는다 */
      setTension(v) {
        tensionFloor = clamp(v || 0, 0, 1);
        if (cfg.music && !timer) audio.music.setIntensity(tensionFloor);
      },

      // 예약: 일시 정지에 함께 멈추고, 재시작하면 자동으로 사라진다
      after(ms, fn) {
        const t = { at: now + ms, fn };
        tasks.add(t);
        return () => tasks.delete(t);
      },
      every(ms, fn) {
        const t = { at: now + ms, fn, every: ms };
        tasks.add(t);
        return () => tasks.delete(t);
      },
      /** 매 프레임 불린다. fn(dt초, 플레이시간초). 돌려주는 함수를 부르면 멈춘다 */
      loop(fn) {
        loops.add(fn);
        return () => loops.delete(fn);
      },
      /** 게임 시계 기준으로 기다린다. 재시작되면 영영 끝나지 않으므로 지난 판의 흐름이 이어지지 않는다 */
      wait(ms) {
        return new Promise((resolve) => game.after(ms, resolve));
      },
      /**
       * 게임 시계로 도는 움직임. step(k) 이 k=0→1 로 불리고, 끝나면 Promise 가 끝난다.
       * ease 는 0~1 을 받아 0~1 을 돌려주는 함수(생략하면 부드럽게 감속).
       */
      tween(ms, step, ease) {
        const curve = ease || ((t) => 1 - Math.pow(1 - t, 3));
        return new Promise((resolve) => {
          let elapsed = 0;
          const stop = game.loop((dt) => {
            elapsed += dt * 1000;
            const k = clamp(elapsed / ms, 0, 1);
            step(curve(k));
            if (k >= 1) {
              stop();
              resolve();
            }
          });
        });
      },
      /** window·document 같은 바깥 대상에 이벤트를 걸 때 쓴다. 재시작 때 자동으로 풀린다 */
      on(target, type, fn, opts) {
        target.addEventListener(type, fn, opts);
        listeners.push([target, type, fn, opts]);
      },
      /** 이번 판에서만 쓰는 일시 정지 알림. fn(true) 는 멈출 때, fn(false) 는 이어 갈 때. 재시작하면 저절로 풀린다 */
      onPauseChange(fn) {
        pauseHandlers.push(fn);
      },
      /** 판이 끝나거나 재시작될 때 할 정리(카메라·마이크 끄기 등)를 등록한다 */
      onCleanup(fn) {
        cleanups.push(fn);
      },
      /** 화면 가운데 큰 안내 띠를 띄우고, 사라질 때까지 기다린다 */
      banner(title, sub, opts = {}) {
        // 띠도 게임 시계로 닫아서, 떠 있는 동안 일시 정지하면 띠와 진행이 함께 멈춘다
        const close = fx.banner(title, sub, Object.assign({}, opts, { manual: true }));
        if (opts.sound !== false) audio.play(opts.kind === 'bad' ? 'miss' : 'stage');
        return game.wait(opts.ms || 1300).then(() => {
          close();
          return game.wait(220); // 띠가 완전히 사라진 뒤에 이어 간다
        });
      },

      pause,
      resume,
      win,
      lose,
      /** 0~1 값을 별 1~3개로 바꾼다. thresholds 는 [별2 기준, 별3 기준] */
      starsFor(value, thresholds) {
        return value >= thresholds[1] ? 3 : value >= thresholds[0] ? 2 : 1;
      },
    };

    if (debug) window.__arcade = { game, state, Arcade: window.Arcade };
    showIntro();
    return game;
  }

  window.Arcade = {
    embedded,
    debug,
    clamp,
    lerp,
    rand,
    randInt,
    pick,
    shuffle,
    wait,
    h,
    ns,
    store,
    loadSettings,
    vibrate,
    formatTime,
    fmt,
    today,
    sfx: (name, arg) => audio.play(name, arg),
    audio,
    fx,
    records,
    sensors,
    createGame,
  };
})();
