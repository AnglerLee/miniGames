// 바코드 몬스터 사냥: 집 안 물건의 바코드를 찍으면 그 번호에서 몬스터가 태어난다.
// 같은 번호는 언제나 같은 몬스터. 임무 3개(아무거나 → 속성 사냥 → 보스전)를 시간 안에 해낸다.
// 맨 앞의 순수 함수(바코드 → 몬스터)와 바코드 읽기 도구는 관리자 페이지와 Node 시험에서도 쓴다.
(function () {
  'use strict';

  // ============================================================ 바코드 → 몬스터 (순수 함수)
  const ELEMENTS = [
    { id: 'fire', name: '불', icon: '🔥', c1: '#ff5f3d', c2: '#ffb347' },
    { id: 'water', name: '물', icon: '💧', c1: '#2f7bff', c2: '#5ee0ff' },
    { id: 'grass', name: '풀', icon: '🌿', c1: '#16a85a', c2: '#a8ec6a' },
    { id: 'thunder', name: '번개', icon: '⚡', c1: '#e3a200', c2: '#ffe45c' },
    { id: 'earth', name: '땅', icon: '⛰️', c1: '#8a5a2b', c2: '#d9a066' },
  ];
  const GOLD_EL = { id: 'gold', name: '황금', icon: '👑', c1: '#d99a00', c2: '#fff1b8' };
  const EL = {};
  ELEMENTS.concat(GOLD_EL).forEach((e) => (EL[e.id] = e));
  // 상성: 왼쪽이 오른쪽을 이긴다. 불 > 풀 > 땅 > 번개 > 물 > 불
  const BEATS = { fire: 'grass', grass: 'earth', earth: 'thunder', thunder: 'water', water: 'fire' };
  const counterOf = (el) => Object.keys(BEATS).find((k) => BEATS[k] === el);

  const BODY = {
    fire: ['🦊', '🐲', '🦖', '🦎', '🐔', '🦁', '🐯', '🐉'],
    water: ['🐙', '🐳', '🦈', '🐡', '🦑', '🐸', '🦀', '🐧'],
    grass: ['🐛', '🐞', '🐢', '🦔', '🐌', '🐨', '🐼', '🐰'],
    thunder: ['🐝', '🐱', '🦄', '🦇', '👾', '🐭', '🐹', '🦉'],
    earth: ['🐻', '🐗', '🦏', '🐊', '🐮', '🐷', '🦍', '🐘'],
  };
  const DECO = ['👑', '🎩', '🕶️', '🎀', '⭐', '💎', '🔔', '🌸', '🍀', '🎧', '🧢', '🍭', '🌙', '🦴', '🍩', '🎈'];
  const PREFIX = {
    fire: ['활활', '화끈', '뜨끈', '불꽃'],
    water: ['첨벙', '촉촉', '퐁당', '출렁'],
    grass: ['풀잎', '새싹', '푸릇', '덩굴'],
    thunder: ['찌릿', '번쩍', '파직', '우르'],
    earth: ['쿵쾅', '울퉁', '바위', '흙탕'],
  };
  const CORE = ['방구', '코딱', '딸꾹', '하품', '엉덩', '뒤뚱', '말랑', '쫀득', '꼬질', '뭉실',
    '삐약', '두둥', '부릉', '콧물', '트림', '간질', '꾸벅', '데굴', '보글', '털털'];
  const SUFFIX = ['몬', '룡', '냥', '돌이', '깨비', '츄', '뿡', '롱', '삐', '숑'];
  const BOSS_ICON = { fire: '👹', water: '🐋', grass: '🦕', thunder: '🤖', earth: '🗿' };
  const GOLD_POWER = 999;

  /** 문자열 → 32비트 해시 (cyrb53 의 아래 32비트) */
  function hash(str) {
    let h1 = 0xdeadbeef ^ str.length;
    let h2 = 0x41c6ce57 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h1 ^ h2) >>> 0;
  }

  /** 씨앗으로 정해지는 난수 (mulberry32) */
  function seeded(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** 읽은 값을 하나의 모양으로 맞춘다. 12자리 UPC-A 는 앞에 0 을 붙인 EAN-13 과 같은 바코드다 */
  function normalize(raw) {
    let s = String(raw === null || raw === undefined ? '' : raw).replace(/\s+/g, '').toUpperCase().slice(0, 40);
    if (/^\d{12}$/.test(s)) s = '0' + s;
    return s;
  }

  /** EAN-8, EAN-13 의 끝자리(확인 숫자)가 맞는가 */
  function checkDigitOk(code) {
    if (!/^\d+$/.test(code) || (code.length !== 8 && code.length !== 13)) return false;
    const n = code.length;
    let sum = 0;
    for (let i = 0; i < n - 1; i++) sum += Number(code[i]) * ((n - 1 - i) % 2 === 1 ? 3 : 1);
    return (10 - (sum % 10)) % 10 === Number(code[n - 1]);
  }

  /** 손으로 누른 번호가 실제 상품 바코드(8·12·13자리)일 수 있는가 */
  function retailOk(raw) {
    const d = String(raw);
    return /^\d+$/.test(d) && [8, 12, 13].indexOf(d.length) >= 0 && checkDigitOk(normalize(d));
  }

  /** 앞 12자리에 확인 숫자를 붙여 EAN-13 을 만든다 */
  function ean13(body12) {
    let s = 0;
    for (let i = 0; i < 12; i++) s += Number(body12[i]) * (i % 2 ? 3 : 1);
    return body12 + ((10 - (s % 10)) % 10);
  }

  /**
   * 바코드 번호에서 몬스터를 만든다. 같은 번호는 언제나 같은 몬스터.
   * 끝 두 자리가 같으면 ★★★ 전설, 나머지는 해시로 ★★(약 23%) 또는 ★.
   */
  function monsterOf(raw, gold) {
    const code = normalize(raw);
    const r = seeded(hash(code));
    const el = ELEMENTS[Math.floor(r() * ELEMENTS.length)];
    const twin = code.length >= 2 && code[code.length - 1] === code[code.length - 2];
    const lucky = r() < 0.25;
    const rarity = twin ? 3 : lucky ? 2 : 1;
    const k = r();
    const power = rarity === 3 ? 70 + Math.floor(k * 30) : rarity === 2 ? 40 + Math.floor(k * 35) : 10 + Math.floor(k * 40);
    const pickR = (arr) => arr[Math.floor(r() * arr.length)];
    const body = pickR(BODY[el.id]);
    const deco = pickR(DECO);
    const core = pickR(CORE);
    const suffix = pickR(SUFFIX);
    const prefix = pickR(PREFIX[el.id]);
    const m = { code, gold: false, element: el.id, el, rarity, power, body, deco, name: prefix + core + suffix };
    if (gold) Object.assign(m, { gold: true, element: 'gold', el: GOLD_EL, rarity: 4, power: GOLD_POWER, deco: '👑', name: '황금' + core + suffix });
    return m;
  }

  /** 보스와 싸울 때의 힘. 보스를 이기는 속성이면 1.5배 */
  function effPower(m, bossEl) {
    return m.gold ? m.power : Math.round(m.power * (BEATS[m.element] === bossEl ? 1.5 : 1));
  }

  /** 팀에서 고를 수 있는 가장 센 3마리의 힘 합 */
  function bestTeam(list, bossEl) {
    return list.map((m) => effPower(m, bossEl)).sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
  }

  /** 조건에 맞는 몬스터가 나오는 EAN-13 번호를 찾는다 (검증용) */
  function findCode(pred, start) {
    for (let i = start || 0; i < (start || 0) + 300000; i++) {
      const code = ean13('880' + String(i).padStart(9, '0'));
      if (pred(monsterOf(code))) return code;
    }
    return null;
  }

  const Lib = { ELEMENTS, EL, BEATS, counterOf, hash, normalize, checkDigitOk, retailOk, ean13, monsterOf, effPower, bestTeam, findCode };

  if (typeof window === 'undefined') {
    if (typeof module !== 'undefined') module.exports = Lib; // Node 시험
    return;
  }

  // ============================================================ 바코드 읽기: BarcodeDetector → quagga2
  const QUAGGA_URL = 'https://cdn.jsdelivr.net/npm/@ericblade/quagga2@1.8.4/dist/quagga.min.js';
  const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'itf', 'codabar'];
  const QUAGGA_READERS = ['ean_reader', 'ean_8_reader', 'code_128_reader', 'code_39_reader', 'upc_e_reader'];

  /** 바코드 읽기 도구. sleep(ms) 는 기다리는 함수. status: idle | loading | ready | fail */
  function makeReader(sleep) {
    const R = { engine: null, status: 'idle', busy: false };
    let native = null;
    let loading = null;
    let script = null;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    async function findNative() {
      if (!('BarcodeDetector' in window)) return null;
      try {
        const sup = await window.BarcodeDetector.getSupportedFormats();
        const formats = NATIVE_FORMATS.filter((f) => sup.indexOf(f) >= 0);
        return formats.length ? new window.BarcodeDetector({ formats }) : null;
      } catch (e) {
        return null;
      }
    }

    function loadQuagga() {
      if (window.Quagga && window.Quagga.decodeSingle) return Promise.resolve(true);
      if (!script) {
        script = new Promise((resolve) => {
          const s = document.createElement('script');
          s.src = QUAGGA_URL;
          s.async = true;
          s.onload = () => resolve(!!(window.Quagga && window.Quagga.decodeSingle));
          s.onerror = () => {
            script = null;
            resolve(false);
          };
          document.head.appendChild(s);
        });
      }
      return script;
    }

    /** 쓸 수 있는 읽기 방법을 준비한다. 기다리지 않아도 된다 */
    R.ready = function () {
      if (R.status === 'ready') return Promise.resolve(true);
      if (loading) return loading;
      R.status = 'loading';
      const p = (async () => {
        native = await findNative();
        let ok = !!native;
        if (ok) R.engine = 'native';
        else if (await Promise.race([loadQuagga(), sleep(15000).then(() => false)])) {
          R.engine = 'quagga';
          ok = true;
        }
        R.status = ok ? 'ready' : 'fail';
        loading = null;
        return ok;
      })();
      loading = p;
      return p;
    };

    function quagga(src, size, locate, patchSize) {
      const job = new Promise((resolve) => {
        try {
          const ret = window.Quagga.decodeSingle(
            {
              src,
              numOfWorkers: 0,
              locate,
              locator: { patchSize, halfSample: true },
              inputStream: { size },
              decoder: { readers: QUAGGA_READERS },
            },
            (res) => resolve(res && res.codeResult && res.codeResult.code ? String(res.codeResult.code) : null)
          );
          if (ret && ret.catch) ret.catch(() => resolve(null));
        } catch (e) {
          resolve(null);
        }
      });
      return Promise.race([job, sleep(5000).then(() => null)]);
    }

    // quagga 는 바코드가 그림에서 차지하는 크기에 따라 잘 읽는 방법이 달라서, 장면마다 돌아가며 쓴다
    //   0: 네모만 잘라 가운데 줄을 훑는다(가로로 맞춘 바코드, 가장 빠름)
    //   1: 화면에 보이는 전체에서 바코드 자리를 찾는다(작거나 기울어진 바코드)
    //   2: 네모 안에서 큰 조각으로 자리를 찾는다(네모를 가득 채운 바코드)
    let turn = 0;

    /** 영상 한 장면에서 읽는다. view 를 주면 화면에 보이는 부분(object-fit: cover)에 맞춰 자른다 */
    R.readFrame = async function (video, view) {
      if (R.busy || R.status !== 'ready' || !video.videoWidth) return null;
      R.busy = true;
      try {
        if (R.engine === 'native') {
          const list = await native.detect(video);
          return list && list.length ? String(list[0].rawValue) : null;
        }
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const box = view && view.clientHeight ? view.clientWidth / view.clientHeight : vw / vh;
        let w = vw;
        let hh = vh;
        if (vw / vh > box) w = vh * box;
        else hh = vw / box;
        const mode = turn++ % 3;
        const sw = mode === 1 ? w : w * 0.92;
        const sh = mode === 1 ? hh : hh * 0.5;
        const scale = (mode === 1 ? 800 : 640) / Math.max(sw, sh);
        canvas.width = Math.round(sw * scale);
        canvas.height = Math.round(sh * scale);
        ctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
        const size = Math.max(canvas.width, canvas.height);
        return await quagga(canvas.toDataURL('image/jpeg', 0.85), size, mode !== 0, mode === 2 ? 'large' : 'medium');
      } catch (e) {
        return null;
      } finally {
        R.busy = false;
      }
    };

    /** 사진 파일에서 읽는다 */
    R.readFile = async function (file) {
      if (!(await R.ready())) return null;
      for (let i = 0; R.busy && i < 100; i++) await sleep(60);
      R.busy = true;
      const url = URL.createObjectURL(file);
      try {
        if (R.engine === 'native') {
          const bmp = await createImageBitmap(file);
          const list = await native.detect(bmp);
          return list && list.length ? String(list[0].rawValue) : null;
        }
        // 사진 속 바코드 크기를 모르므로 몇 가지로 차례로 해 본다
        const tries = [[800, true, 'medium'], [800, true, 'large'], [1280, true, 'medium'], [640, true, 'x-large'], [800, false, 'medium']];
        for (const [size, locate, patch] of tries) {
          const code = await quagga(url, size, locate, patch);
          if (code) return code;
        }
        return null;
      } catch (e) {
        return null;
      } finally {
        URL.revokeObjectURL(url);
        R.busy = false;
      }
    };
    return R;
  }

  window.BarcodeMonster = Object.assign({ makeReader }, Lib);
  if (!window.Arcade) return; // 관리자 페이지는 여기까지만 쓴다

  // ============================================================ 게임
  const { h, sfx, fx, clamp, pick, shuffle, randInt } = Arcade;
  const GAME_ID = 'game17';
  const KEY = 'barcodeScannerSettings';
  const DEX_KEY = 'barcodeMonsterDex';

  // ----- 설정 (관리자 페이지와 같은 키를 쓴다. 기본값 표는 admin.js 와 같아야 한다)
  const PRESETS = [
    { timeLimit: 100, targetCount: 3, elemNeed: 2, bossPower: 165 },
    { timeLimit: 85, targetCount: 3, elemNeed: 2, bossPower: 185 },
    { timeLimit: 75, targetCount: 4, elemNeed: 3, bossPower: 210 },
  ];
  // 범위를 벗어난 옛 값(예: 시간 0 = 무제한)은 난이도 기본값으로 바꾼다
  const RANGE = { timeLimit: [40, 300], targetCount: [2, 6], elemNeed: [1, 4], bossPower: [80, 300] };
  const saved = Arcade.loadSettings(KEY, {});
  const level = clamp(parseInt(saved.difficulty, 10) || 0, 0, 2);
  const S = Object.assign({}, PRESETS[level]);
  Object.keys(RANGE).forEach((k) => {
    const v = Number(saved[k]);
    if (Number.isFinite(v) && v >= RANGE[k][0] && v <= RANGE[k][1]) S[k] = Math.round(v);
  });
  const GOLDS = Array.from(new Set((Array.isArray(saved.targetBarcodes) ? saved.targetBarcodes : []).map(normalize).filter(Boolean)));
  const GOLD_NEED = GOLDS.length ? clamp(parseInt(saved.goldCount, 10) || 1, 1, Math.min(3, GOLDS.length)) : 0;
  const GOLD_HINT = typeof saved.goldHint === 'string' ? saved.goldHint.trim().slice(0, 60) : '';

  const STAGE_MULT = [1, 1.3, GOLD_NEED ? 1.5 : 1]; // 스테이지 시간 = timeLimit × 이 값
  const RETRY_SEC = 15; // 재도전마다 늘어나는 시간 (최대 3번)
  const WRONG_SEC = 4; // 틀린 번호를 누르면 잃는 시간
  const STREAK_SEC = 20; // 이 시간 안에 다음 몬스터를 잡으면 연속 포획

  // ----- 도감 (판이 끝나도 남는다)
  function dexLoad() {
    const d = Arcade.store.get(DEX_KEY, null);
    return d && Array.isArray(d.codes) ? d.codes.filter((c) => typeof c === 'string' && c) : [];
  }
  function dexAdd(code) {
    const list = dexLoad();
    if (list.indexOf(code) >= 0) return false;
    list.push(code);
    while (list.length > 500) list.shift();
    Arcade.store.set(DEX_KEY, { v: 1, codes: list });
    return true;
  }
  const makeMon = (code) => monsterOf(code, GOLDS.indexOf(normalize(code)) >= 0);

  // ----- 카메라 (판이 바뀌어도 권한은 한 번만 묻도록 바깥에 둔다)
  const reader = makeReader(Arcade.wait);
  const cam = { stream: null, status: 'idle', why: '', opening: null };
  let session = null; // 지금 판. 판이 끝나면 null
  let carry = null; // 체크포인트 재도전 때 이어 쓸 것: 판의 계획, 각 스테이지가 시작될 때의 팀

  function openCamera() {
    if (cam.opening) return cam.opening;
    const fail = (why) => {
      cam.status = 'fail';
      cam.why = why;
      return false;
    };
    cam.status = 'opening';
    cam.opening = (async () => {
      if (!window.isSecureContext) return fail('insecure');
      const md = navigator.mediaDevices;
      if (!md || !md.getUserMedia) return fail('none');
      try {
        cam.stream = await md.getUserMedia({
          audio: false,
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        cam.status = 'ok';
        return true;
      } catch (e) {
        const name = e && e.name;
        return fail(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'none' : 'error');
      }
    })();
    cam.opening.then(() => (cam.opening = null));
    return cam.opening;
  }

  function stopCamera() {
    if (cam.stream) cam.stream.getTracks().forEach((t) => t.stop());
    cam.stream = null;
    if (cam.status === 'ok') cam.status = 'idle';
  }

  const camLive = () => !!cam.stream && cam.stream.getVideoTracks().some((t) => t.readyState === 'live');
  const WHY = {
    insecure: '📵 카메라는 <b>https</b> 주소에서만 열려요',
    denied: '📵 카메라 권한이 꺼져 있어요',
    none: '📵 카메라를 찾지 못했어요',
    error: '📵 카메라를 열지 못했어요',
  };

  function start(game) {
    const me = {};
    session = me;
    const alive = () => session === me;
    if (game.checkpoint === 0 || !carry || !carry.snaps[game.checkpoint]) {
      // 새 판: 보스 속성을 먼저 정하고, 2단계 목표 속성 하나는 보스를 이기는 속성으로 둔다
      const bossEl = pick(ELEMENTS).id;
      const other = pick(ELEMENTS.filter((e) => e.id !== counterOf(bossEl))).id;
      carry = { bossEl, targets: shuffle([counterOf(bossEl), other]), snaps: {}, fresh: [] };
    }
    const plan = carry;
    let stageIdx = game.checkpoint;
    const ease = Math.min(game.retry, 3);
    let catches = (plan.snaps[stageIdx] || []).map(makeMon);
    let stageCatches = [];
    let view = 'cam';
    let busy = true; // 배너, 카드 공개, 공격 중에는 찍기를 막는다
    let timer = null;
    let boss = null;
    let picks = [];
    let pad = '';
    let lastCatchAt = -999;
    let lastRead = { code: '', at: -9 };
    let lastDup = { code: '', at: -9 };
    let autoPad = false;
    let closeReveal = null;
    let dexPanel = null;
    let wrongs = 0;
    let photoClickAt = -1e9;
    let hiddenAt = 0;
    const leftRatios = [];
    const targetText = plan.targets.map((id) => `${EL[id].icon}${EL[id].name}`).join('·');

    // ----- 화면
    const streakBar = h('i', { class: 'bm-streak' });
    const strip = h('div', { class: 'bm-strip' });
    const video = h('video', { class: 'bm-video', playsinline: true, muted: true, autoplay: true });
    video.muted = true;
    const frame = h('div', { class: 'bm-frame' }, h('i', { class: 'bm-laser' }));
    const camMsg = h('div', { class: 'bm-cam-msg' });
    const camView = h('div', { class: 'bm-cam' }, [video, frame, camMsg]);
    const padNote = h('div', { class: 'bm-pad-note' });
    const padDigits = h('div', { class: 'bm-digits' });
    const padCount = h('div', { class: 'bm-count' });
    const padDisplay = h('div', { class: 'bm-display' }, [padDigits, padCount]);
    const keys = h('div', { class: 'bm-keys' });
    // 어떤 숫자를 누르는지 보여 주는 그림 (화면이 낮으면 CSS 가 숨긴다)
    const padArt = h('div', { class: 'bm-pad-art' }, [
      h('div', { class: 'bm-bars' }),
      h('div', { class: 'bm-bars-num', text: '8 801234 567893' }),
      h('div', { class: 'bm-bars-cap', text: '↑ 바코드 아래 이 숫자를 그대로!' }),
    ]);
    const padView = h('div', { class: 'bm-pad' }, [padArt, padNote, padDisplay, keys]);
    const bossIcon = h('div', { class: 'bm-boss-icon' });
    const bossName = h('div', { class: 'bm-boss-name' });
    const bossHpFill = h('i');
    const bossHpText = h('b');
    const bossHint = h('div', { class: 'bm-boss-hint' });
    const bossCard = h('div', { class: 'bm-boss' }, [
      bossIcon,
      h('div', { class: 'bm-boss-info' }, [bossName, h('div', { class: 'bm-boss-hp' }, [h('span', { class: 'bm-hpbar' }, bossHpFill), bossHpText]), bossHint]),
    ]);
    const meterFill = h('i');
    const meterText = h('div', { class: 'bm-meter-text' });
    const meter = h('div', { class: 'bm-meter' }, [h('div', { class: 'bm-meter-bar' }, meterFill), meterText]);
    const teamGrid = h('div', { class: 'bm-team' });
    const cycle = h('div', { class: 'bm-cycle' }); // 상성 고리. 화면이 낮으면 CSS 가 숨긴다
    const tip = h('div', { class: 'bm-tip' });
    const bossView = h('div', { class: 'bm-bossview' }, [bossCard, meter, teamGrid, cycle, tip]);
    const body = h('div', { class: 'bm-body' }, [camView, padView, bossView]);
    game.root.append(strip, body);

    // 숫자 키패드
    let okKey = null;
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'].forEach((k) => {
      const b = h('button', { class: 'bm-key' + (k === 'ok' ? ' ok' : k === 'del' ? ' del' : ''), text: k === 'del' ? '⌫' : k === 'ok' ? '잡기!' : k, dataset: { k } });
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        pressKey(k, b);
      });
      if (k === 'ok') okKey = b;
      keys.append(b);
    });

    // 사진으로 잡기: 카메라 앱에서 찍은 사진의 바코드를 읽는다
    const fileInput = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'bm-file' });
    const photoBtn = h('label', { class: 'ar-btn ghost bm-photo' }, ['🖼️ 사진', fileInput]);
    photoBtn.addEventListener('click', () => (photoClickAt = performance.now()));
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      backFromPhoto();
      if (!file || !alive() || !game.playing) return;
      fx.toast('사진에서 바코드를 찾는 중…', { ms: 2500 });
      const code = await reader.readFile(file);
      if (!alive() || !game.playing) return;
      if (code) {
        lastRead = { code: '', at: -9 };
        fx.toast('📷 찾았다!', { kind: 'good', ms: 700 });
        detected(code, 'photo');
      } else {
        sfx('miss');
        fx.toast(reader.status === 'fail' ? '사진 읽기를 쓸 수 없어요. 숫자로 잡아요' : '바코드를 못 찾았어요. <b>바코드만 크게</b> 찍어요', { kind: 'bad', ms: 1900 });
      }
    });

    // 사진 앱에 다녀오는 동안 화면이 가려지면 엔진이 멈춘다. 돌아오면 이어 가되, 다녀온 시간만큼은 뺀다
    game.on(document, 'visibilitychange', () => {
      if (document.hidden) {
        if (performance.now() - photoClickAt < 4000) hiddenAt = performance.now();
      } else if (hiddenAt) {
        backFromPhoto();
      }
    });
    function backFromPhoto() {
      if (!hiddenAt || !alive()) return;
      const away = Math.min(60, Math.round((performance.now() - hiddenAt) / 1000));
      hiddenAt = 0;
      photoClickAt = -1e9;
      if (game.phase === 'paused') game.resume();
      if (away >= 1 && timer && game.playing && !busy) {
        timer.add(-away);
        fx.toast(`사진 찍는 동안 <b>${away}초</b> 흘렀어요`, { ms: 1600 });
      }
    }

    // ----- 그리기
    function btn(cls, text, fn) {
      const b = h('button', { class: cls, text });
      b.addEventListener('click', () => {
        if (!game.playing) return;
        sfx('tap');
        fn();
      });
      return b;
    }

    function setView(v) {
      view = v;
      camView.classList.toggle('ar-hidden', v !== 'cam');
      padView.classList.toggle('ar-hidden', v !== 'pad');
      bossView.classList.toggle('ar-hidden', v !== 'boss');
      strip.classList.toggle('ar-hidden', v === 'boss');
      if (v === 'cam') attachVideo();
      paintCam();
      paintPad();
      paintBoss();
      paintFooter();
    }

    const camBroken = () => cam.status === 'fail' || reader.status === 'fail';
    const scanView = () => (camBroken() ? 'pad' : 'cam');

    function paintFooter() {
      game.footer.innerHTML = '';
      if (view === 'boss') {
        game.footer.append(btn('ar-btn ghost', '🔍 더 찾기', () => setView(scanView())), attackBtn);
        paintAttack();
        return;
      }
      if (view === 'cam') game.footer.append(btn('ar-btn ghost', '⌨️ 번호', () => setView('pad')));
      else if (cam.why !== 'insecure' && cam.why !== 'none' && reader.status !== 'fail') game.footer.append(btn('ar-btn ghost', '📷 카메라', toCamera));
      game.footer.append(photoBtn);
      if (stageIdx === 2) game.footer.append(btn('ar-btn', '⚔️ 보스', () => setView('boss')));
    }

    async function toCamera() {
      setView('cam');
      if (camLive()) return;
      const ok = await openCamera();
      if (!alive()) return;
      if (ok) setView('cam');
      else {
        fx.toast(WHY[cam.why], { kind: 'bad' });
        setView('pad');
      }
    }

    function attachVideo() {
      if (!camLive()) return;
      if (video.srcObject !== cam.stream) video.srcObject = cam.stream;
      const p = video.play();
      if (p && p.catch) p.catch(() => {});
    }

    function paintCam() {
      if (view !== 'cam') return;
      // 카메라나 읽기 도구가 안 되면 숫자 입력으로 한 번만 자동으로 바꾼다
      if (camBroken() && !autoPad) {
        autoPad = true;
        fx.toast(cam.status === 'fail' ? WHY[cam.why] : '스캐너를 못 불러왔어요. 숫자로 잡아요', { kind: 'bad', ms: 1800 });
        setView('pad');
        return;
      }
      camMsg.textContent = !camLive() ? '📷 카메라 켜는 중…' : reader.status !== 'ready' ? '스캐너 준비 중…' : '바코드를 네모 안에 맞춰요';
    }

    function paintPad() {
      padDigits.textContent = pad || '바코드 아래 숫자';
      padDigits.classList.toggle('empty', !pad);
      padCount.textContent = `${pad.length}/13`;
      okKey.classList.toggle('ready', pad.length >= 8);
      padNote.innerHTML = cam.status === 'fail' ? WHY[cam.why] : reader.status === 'fail' ? '스캐너를 못 불러왔어요' : '숫자를 <b>모두</b> 누르고 잡기!';
    }

    const counts = (m) => (stageIdx === 0 ? true : stageIdx === 1 ? m.gold || plan.targets.indexOf(m.element) >= 0 : GOLD_NEED ? m.gold : true);
    const goldsIn = (list) => list.filter((m) => m.gold).length;

    function paintStrip() {
      strip.innerHTML = '';
      if (stageIdx < 2) {
        const need = stageIdx === 0 ? S.targetCount : S.elemNeed;
        const got = stageCatches.filter(counts);
        const slots = h('div', { class: 'bm-slots' + (need > 4 ? ' many' : '') });
        for (let i = 0; i < need; i++) {
          const m = got[i];
          slots.append(
            m
              ? h('span', { class: 'bm-slot on', style: { '--c1': m.el.c1, '--c2': m.el.c2 }, text: m.body })
              : h('span', { class: 'bm-slot', text: stageIdx === 1 ? plan.targets.map((id) => EL[id].icon).join('') : '?' })
          );
        }
        strip.append(slots);
      } else if (boss) {
        strip.append(h('div', {
          class: 'bm-mini-boss',
          html: GOLD_NEED
            ? `👑 황금 <b>${goldsIn(catches)}/${GOLD_NEED}</b> · ${boss.icon} 보스 <b>${boss.power}</b>`
            : `${boss.icon} 보스 <b>${boss.power}</b> · 팀 최강 <b>${bestTeam(catches, boss.el.id)}</b>`,
        }));
      }
      strip.append(h('button', { class: 'bm-dexchip', text: '📖 ' + dexLoad().length, onclick: openDex }), streakBar);
    }

    // ----- 몬스터 카드
    function cardFace(m, isNew) {
      return h('div', { class: 'bm-face bm-front r' + m.rarity, style: { '--c1': m.el.c1, '--c2': m.el.c2 } }, [
        h('div', { class: 'bm-art' }, [
          h('span', { class: 'bm-elem', text: m.el.icon + ' ' + m.el.name }),
          h('span', { class: 'bm-stars', text: '★'.repeat(m.rarity) }),
          h('span', { class: 'bm-bodyemo', text: m.body }),
          h('span', { class: 'bm-deco', text: m.deco }),
          isNew ? h('span', { class: 'bm-new', text: 'NEW' }) : null,
        ]),
        h('div', { class: 'bm-name', text: m.name }),
        h('div', { class: 'bm-power' }, ['힘 ', h('b', { text: String(m.power) })]),
        h('div', { class: 'bm-code', text: m.code }),
      ]);
    }

    function miniEl(m, bossEl) {
      const e = bossEl ? effPower(m, bossEl) : m.power;
      return h('button', { class: 'bm-mini r' + m.rarity, style: { '--c1': m.el.c1, '--c2': m.el.c2 }, dataset: { code: m.code } }, [
        h('span', { class: 'bm-mini-el', text: m.el.icon }),
        h('span', { class: 'bm-mini-art' }, [m.body, h('i', { text: m.deco })]),
        h('span', { class: 'bm-mini-name', text: m.name }),
        h('span', { class: 'bm-mini-pw', html: e !== m.power ? `${m.power}→<b>${e}</b>` : `<b>${m.power}</b>` }),
      ]);
    }

    /** 카드가 흔들리다 뒤집히며 몬스터가 나온다. 누르거나 잠시 뒤 닫힌다 */
    function reveal(m, isNew, note) {
      return new Promise((resolve) => {
        const back = h('div', { class: 'bm-face bm-back' + (m.gold ? ' gold' : m.rarity === 3 ? ' rare' : '') }, h('span', { text: m.gold ? '👑' : '?' }));
        const card = h('div', { class: 'bm-card' }, h('div', { class: 'bm-flip' }, [back, cardFace(m, isNew)]));
        const box = h('div', { class: 'bm-reveal' }, [card, h('div', { class: 'bm-reveal-note', html: note }), h('div', { class: 'bm-tap', text: '눌러서 계속' })]);
        game.root.append(box);
        let done = false;
        let canClose = false;
        const finish = () => {
          if (done) return;
          done = true;
          closeReveal = null;
          box.remove();
          resolve();
        };
        closeReveal = finish;
        box.addEventListener('pointerdown', () => {
          if (canClose && game.playing) finish();
        });
        sfx('whoosh');
        const wobble = m.gold ? 1200 : m.rarity === 3 ? 950 : 650; // 귀한 몬스터일수록 오래 두근두근
        for (let i = 0; i < 3; i++) game.after((i * wobble) / 3, () => sfx('tick'));
        game.after(wobble, () => {
          card.classList.add('flip');
          sfx('flip');
          game.after(260, () => celebrate(m, card));
          game.after(700, () => {
            canClose = true;
            box.classList.add('can-close');
          });
          game.after(m.gold ? 3600 : 2600, finish);
        });
      });
    }

    function celebrate(m, card) {
      if (m.gold) {
        sfx('perfect');
        sfx('bonus');
        fx.flash('rgba(255,209,102,.45)', 400);
        fx.confetti(60);
        fx.burst(card, { emoji: ['👑', '✨', '💰'], count: 16, spread: 160 });
        Arcade.vibrate([60, 40, 60, 40, 160]);
      } else if (m.rarity === 3) {
        sfx('perfect');
        fx.flash('rgba(179,136,255,.35)', 320);
        fx.burst(card, { count: 26, spread: 150, colors: ['#b388ff', '#36d6ff', '#ffd166', '#ffffff'] });
        Arcade.vibrate([50, 40, 120]);
      } else if (m.rarity === 2) {
        sfx('great');
        fx.burst(card, { count: 14, spread: 120 });
        Arcade.vibrate(50);
      } else {
        sfx('good');
        fx.burst(card, { count: 8, spread: 90 });
      }
    }

    // ----- 잡기
    function detected(raw, source) {
      if (!alive() || !game.playing || busy || dexPanel) return false;
      const code = normalize(raw);
      if (!code) return false;
      if (catches.some((m) => m.code === code)) {
        // 카메라는 같은 바코드를 계속 읽으므로 안내는 3초에 한 번만
        if (source !== 'camera' || lastDup.code !== code || game.time - lastDup.at > 3) {
          fx.toast('이미 잡았어! <b>다른 물건</b>을 찾아봐', { ms: 1200 });
          sfx('miss');
        }
        lastDup = { code, at: game.time };
        return false;
      }
      catchMon(code);
      return true;
    }

    function noteFor(m, isNew, streak) {
      const lines = [];
      if (m.gold) lines.push('<b class="gold">황금 몬스터 발견!</b>');
      else if (stageIdx === 1) lines.push(counts(m) ? '<b class="good">임무 +1!</b>' : `${targetText} 몬스터가 아니야… 그래도 팀에 쏙!`);
      else if (stageIdx === 2 && boss && !GOLD_NEED) lines.push(`팀 최강 힘 <b>${bestTeam(catches, boss.el.id)}</b> / 보스 <b>${boss.power}</b>`);
      else lines.push(isNew ? `도감 <b>${dexLoad().length}</b>번째 몬스터!` : '도감에 있던 몬스터!');
      if (streak >= 2) lines.push(`<span class="streak">⚡ ${streak}연속 포획! 점수 ×${(1 + 0.2 * Math.min(streak - 1, 4)).toFixed(1)}</span>`);
      return lines.join('<br>');
    }

    async function catchMon(code) {
      busy = true;
      const m = makeMon(code);
      const isNew = dexAdd(code);
      if (isNew && plan.fresh.indexOf(code) < 0) plan.fresh.push(code);
      catches.push(m);
      stageCatches.push(m);
      const streak = game.time - lastCatchAt <= STREAK_SEC ? game.combo + 1 : 1;
      lastCatchAt = game.time;
      if (timer) timer.pause(); // 카드가 뒤집히는 동안은 시간이 흐르지 않는다
      await reveal(m, isNew, noteFor(m, isNew, streak));
      if (!alive()) return;
      if (streak === 1) game.resetCombo();
      game.addCombo();
      let pts = (m.gold ? 3000 : m.power * 10) * (1 + 0.2 * Math.min(streak - 1, 4));
      if (stageIdx === 1 && counts(m)) pts *= 1.5;
      if (m.rarity === 3) pts += 300;
      if (isNew) pts += 100;
      game.addScore(Math.round(pts), strip);
      if (timer) timer.resume();
      busy = false;
      afterCatch(m);
    }

    function afterCatch(m) {
      paintStrip();
      paintBoss();
      if (stageIdx === 0 && stageCatches.length >= S.targetCount) return stageClear();
      if (stageIdx === 1) {
        if (stageCatches.filter(counts).length >= S.elemNeed) return stageClear();
        if (!counts(m)) fx.toast(`<b>${targetText}</b> 몬스터를 더 찾아봐!`, { ms: 1400 });
        return;
      }
      if (stageIdx === 2) {
        if (GOLD_NEED) {
          if (m.gold && goldsIn(catches) >= GOLD_NEED) {
            fx.toast('👑 황금 몬스터로 공격하자!', { kind: 'gold' });
            setView('boss');
          } else if (m.gold) fx.toast(`황금 몬스터 <b>${GOLD_NEED - goldsIn(catches)}마리</b> 더!`, { kind: 'gold' });
        } else if (bestTeam(catches, boss.el.id) > boss.power) {
          fx.toast('이길 수 있어! <b>⚔️ 보스</b>를 눌러 팀을 골라', { kind: 'good', ms: 1600 });
        }
      }
    }

    // ----- 숫자 입력
    function pressKey(k, b) {
      if (!game.playing || busy || dexPanel) return;
      if (b) fx.pop(b);
      if (k === 'ok') return submitPad();
      if (k === 'del') pad = pad.slice(0, -1);
      else if (pad.length < 13) pad += k;
      else {
        fx.shake(padDisplay, 4);
        sfx('miss');
        return;
      }
      sfx('tap');
      paintPad();
    }

    function submitPad() {
      if (pad.length < 8) {
        sfx('miss');
        fx.shake(padDisplay, 6);
        fx.toast('숫자를 <b>8자리</b> 이상 눌러요', { ms: 1100 });
        return;
      }
      const code = normalize(pad);
      if (GOLDS.indexOf(code) < 0 && !retailOk(pad)) {
        // 아무 숫자나 눌러서 잡지 못하게: 끝자리 확인 숫자가 틀리면 시간을 잃는다
        wrongs++;
        sfx('bad');
        fx.shake(padDisplay, 10);
        padDisplay.classList.add('bad');
        game.after(600, () => padDisplay.classList.remove('bad'));
        if (timer) timer.add(-WRONG_SEC);
        fx.toast([8, 12, 13].indexOf(pad.length) >= 0 ? '숫자가 틀렸어요! <b>다시 확인</b>' : '바코드 숫자는 <b>8자리</b>나 <b>13자리</b>', { kind: 'bad' });
        return;
      }
      pad = '';
      paintPad();
      detected(code, 'pad');
    }

    game.on(document, 'keydown', (e) => {
      if (!game.playing || busy) return;
      if (/^[0-9]$/.test(e.key)) {
        if (view !== 'pad') setView('pad');
        pressKey(e.key);
      } else if (view === 'pad' && e.key === 'Backspace') pressKey('del');
      else if (view === 'pad' && e.key === 'Enter') pressKey('ok');
    });

    // ----- 카메라로 읽기
    function onRead(raw) {
      if (!game.playing || busy || dexPanel) return;
      const code = normalize(raw);
      // quagga 는 가끔 잘못 읽으므로 같은 번호가 2.5초 안에 두 번 나와야 믿는다
      if (reader.engine === 'quagga' && !(lastRead.code === code && game.time - lastRead.at < 2.5)) {
        lastRead = { code, at: game.time };
        return;
      }
      lastRead = { code: '', at: -9 };
      frame.classList.add('hit');
      game.after(450, () => frame.classList.remove('hit'));
      sfx('pick');
      detected(code, 'camera');
    }

    game.every(320, () => {
      if (view !== 'cam') return;
      paintCam();
      if (busy || dexPanel || !camLive() || reader.status !== 'ready') return;
      reader.readFrame(video, camView).then((code) => {
        if (code && alive()) onRead(code);
      });
    });

    // 연속 포획 막대: 다음 몬스터를 잡을 시간이 줄어든다
    game.loop(() => {
      const k = game.combo > 0 ? clamp(1 - (game.time - lastCatchAt) / STREAK_SEC, 0, 1) : 0;
      streakBar.style.transform = `scaleX(${k})`;
      if (game.combo > 0 && k <= 0 && !busy) game.resetCombo();
    });

    // ----- 도감 보기
    function openDex() {
      if (!game.playing || busy || dexPanel) return;
      sfx('tap');
      const list = dexLoad().reverse();
      const close = h('button', { class: 'ar-btn sm block', text: '닫기' });
      dexPanel = h('div', { class: 'bm-dex' }, [
        h('div', { class: 'bm-dex-head', html: `📖 몬스터 도감 <b>${list.length}</b>마리` }),
        list.length
          ? h('div', { class: 'bm-dexgrid' }, list.slice(0, 80).map((c) => miniEl(makeMon(c))))
          : h('div', { class: 'bm-dex-empty', text: '아직 비어 있어요. 바코드를 찍어 봐요!' }),
        close,
      ]);
      close.addEventListener('click', () => {
        sfx('tap');
        dexPanel.remove();
        dexPanel = null;
      });
      game.root.append(dexPanel);
    }

    // ----- 보스전
    const attackBtn = h('button', { class: 'ar-btn' });
    attackBtn.addEventListener('click', () => attack());

    function setupBoss() {
      const el = plan.bossEl;
      let power;
      if (GOLD_NEED) power = 450 + GOLD_POWER * (GOLD_NEED - 1) + randInt(0, 40);
      else {
        // 설정한 힘을 쓰되, 지금 팀보다 너무 세면 낮춘다 (★★★ 두 마리면 늘 넘는다)
        power = Math.min(S.bossPower + randInt(-6, 6) - ease * 12, bestTeam(catches, el) + 45);
        power = Math.max(60, power);
      }
      boss = { el: EL[el], power, name: PREFIX[el][0] + '대마왕', icon: BOSS_ICON[el] };
    }

    const pickedMons = () => picks.map((c) => catches.find((m) => m.code === c)).filter(Boolean);
    const pickSum = () => pickedMons().reduce((a, m) => a + effPower(m, boss.el.id), 0);
    const pickNeed = () => Math.min(3, catches.length);
    const canAttack = () =>
      !!boss && picks.length === pickNeed() && picks.length > 0 && pickSum() > boss.power && (!GOLD_NEED || goldsIn(pickedMons()) >= GOLD_NEED);

    function paintHp(v) {
      bossHpFill.style.transform = `scaleX(${clamp(v / boss.power, 0, 1)})`;
      bossHpText.textContent = String(Math.max(0, Math.round(v)));
    }

    function paintBoss() {
      if (!boss || view !== 'boss') return;
      bossIcon.textContent = boss.icon;
      bossName.innerHTML = `${boss.name} <span>${boss.el.icon}${boss.el.name}</span>`;
      paintHp(boss.power);
      const ctr = EL[counterOf(boss.el.id)];
      bossHint.innerHTML = GOLD_NEED ? '👑 <b>황금 몬스터</b>만 이길 수 있어' : `${ctr.icon}${ctr.name} 몬스터는 힘 <b>1.5배</b>`;
      teamGrid.innerHTML = '';
      catches
        .slice()
        .sort((a, b) => effPower(b, boss.el.id) - effPower(a, boss.el.id))
        .forEach((m) => {
          const el = miniEl(m, boss.el.id);
          el.classList.toggle('picked', picks.indexOf(m.code) >= 0);
          el.addEventListener('click', () => togglePick(m.code));
          teamGrid.append(el);
        });
      if (!catches.length) teamGrid.append(h('div', { class: 'bm-dex-empty', text: '팀이 비었어요. 몬스터를 잡아 와요!' }));
      const sum = pickSum();
      meterFill.style.transform = `scaleX(${clamp(sum / boss.power, 0, 1)})`;
      meter.classList.toggle('win', sum > boss.power);
      meterText.innerHTML = `고른 팀 <b>${picks.length}/${pickNeed() || 3}</b> · 힘 <b>${sum}</b> / ${boss.power}`;
      // 불 › 풀 › 땅 › 번개 › 물 › 불. 보스를 이기는 속성과 보스 속성을 밝힌다
      const ring = ['fire', 'grass', 'earth', 'thunder', 'water', 'fire'];
      const hot = (i) => (ring[i] === ctr.id && ring[i + 1] === boss.el.id) || (ring[i] === boss.el.id && ring[i - 1] === ctr.id);
      cycle.innerHTML =
        '<div>' + ring.map((id, i) => `<span class="${hot(i) ? 'hot' : ''}">${EL[id].icon}</span>`).join('<i>›</i>') + '</div><small>왼쪽이 오른쪽을 이겨요</small>';
      cycle.classList.toggle('ar-hidden', !!GOLD_NEED);
      tip.innerHTML = GOLD_NEED
        ? `💡 ${GOLD_HINT ? GOLD_HINT.replace(/[<>&]/g, '') : '부모님이 숨긴 물건의 바코드를 찾아요'}`
        : '💡 끝 두 자리가 같은 바코드(…<b>77</b>)는 <b>★★★</b> 전설!';
      paintAttack();
    }

    function paintAttack() {
      if (!boss) return;
      const sum = pickSum();
      const ready = canAttack();
      attackBtn.disabled = !ready;
      attackBtn.className = 'ar-btn' + (ready ? ' gold' : '');
      if (ready) attackBtn.textContent = `⚔️ 공격! ${sum}`;
      else if (picks.length < pickNeed() || !picks.length) attackBtn.textContent = `⚔️ ${picks.length}/${pickNeed() || 3} 골라요`;
      else if (GOLD_NEED && goldsIn(pickedMons()) < GOLD_NEED) attackBtn.textContent = '👑 황금을 넣어요';
      else attackBtn.textContent = `⚔️ ${boss.power - sum + 1} 모자라요`;
    }

    function togglePick(code) {
      if (!game.playing || busy) return;
      const i = picks.indexOf(code);
      if (i >= 0) picks.splice(i, 1);
      else {
        if (picks.length >= 3) picks.shift();
        picks.push(code);
      }
      sfx('pick');
      paintBoss();
    }

    async function attack() {
      if (!game.playing || busy || !canAttack()) return;
      busy = true;
      const sum = pickSum();
      leftRatios.push(timer ? timer.ratio() : 0);
      game.stopTimer();
      attackBtn.disabled = true;
      let hp = boss.power;
      for (const m of pickedMons()) {
        const card = Array.from(teamGrid.children).find((c) => c.dataset.code === m.code);
        if (card) card.classList.add('hit');
        const dmg = effPower(m, boss.el.id);
        sfx('zap');
        fx.floatText(bossIcon, '-' + dmg, { color: '#ffd166', size: 30 });
        fx.shake(bossCard, 9);
        const from = hp;
        hp = Math.max(0, hp - dmg);
        await game.tween(320, (k) => paintHp(from + (hp - from) * k));
        await game.wait(160);
      }
      sfx('boom');
      fx.flash('rgba(255,255,255,.5)', 300);
      fx.burst(bossIcon, { emoji: ['💥', '⭐', '✨'], count: 16, spread: 150 });
      bossCard.classList.add('ko');
      game.addScore(1000 + (sum - boss.power) * 10, bossCard);
      await game.wait(1100);
      finish(sum);
    }

    // ----- 스테이지
    function goalText() {
      if (stageIdx === 0) return `바코드를 찍어 몬스터 <b>${S.targetCount}마리</b> 잡기`;
      if (stageIdx === 1) return `<b>${targetText}</b> 몬스터 <b>${S.elemNeed}마리</b> 잡기`;
      return GOLD_NEED ? '<b>👑황금 몬스터</b>를 찾아 보스 물리치기' : '팀 3마리 힘의 합으로 <b>보스</b> 물리치기';
    }

    async function runStage() {
      busy = true;
      stageCatches = [];
      picks = [];
      plan.snaps[stageIdx] = catches.map((m) => m.code);
      game.setStage(stageIdx, 3);
      if (stageIdx === 2) setupBoss();
      game.setGoal(goalText());
      paintStrip();
      setView(stageIdx === 2 ? 'boss' : scanView());
      const banner = [
        ['사냥 1', '아무 바코드나 OK! 몬스터를 잡아라'],
        ['사냥 2', `${targetText} 몬스터만 임무에 들어가요`],
        GOLD_NEED ? ['황금 사냥', '황금 몬스터만 보스를 이길 수 있어!'] : ['보스전', `${boss && boss.icon} ${boss && boss.name} 등장!`],
      ][stageIdx];
      if (stageIdx === 2) fx.shake(bossCard, 10);
      await game.banner(banner[0], banner[1], { ms: 1500 });
      if (!alive()) return;
      const sec = Math.round(S.timeLimit * STAGE_MULT[stageIdx] + ease * RETRY_SEC);
      timer = game.startTimer(sec, { warnAt: 15, onEnd: timeUp, intensity: 0.15 + stageIdx * 0.2 });
      busy = false;
      if (stageIdx === 2) {
        if (GOLD_NEED && goldsIn(catches) >= GOLD_NEED) fx.toast('👑 황금 몬스터로 <b>공격</b>하자!', { kind: 'gold', ms: 1800 });
        else if (GOLD_NEED) fx.toast(GOLD_HINT ? `💡 ${GOLD_HINT.replace(/[<>&]/g, '')}` : '👑 숨겨진 <b>황금 몬스터</b>를 찾아라!', { kind: 'gold', ms: 2200 });
        else if (bestTeam(catches, boss.el.id) > boss.power) fx.toast('잘 고르면 <b>지금</b> 이길 수 있어!', { kind: 'good', ms: 1800 });
        else fx.toast('힘이 모자라! <b>더 센 몬스터</b>를 찾아와', { kind: 'bad', ms: 1800 });
      }
    }

    async function stageClear() {
      busy = true;
      const left = timer ? timer.left() : 0;
      leftRatios.push(timer ? timer.ratio() : 0);
      game.stopTimer();
      sfx('stage');
      fx.confetti(30);
      game.addScore(Math.ceil(left) * 10, strip);
      stageIdx++;
      await game.wait(700);
      if (alive()) runStage();
    }

    function timeUp() {
      if (!alive() || !game.playing) return;
      const why = [
        `몬스터 ${S.targetCount}마리를 다 못 잡았어요.`,
        `${targetText} 몬스터가 모자랐어요.`,
        GOLD_NEED ? '황금 몬스터를 찾지 못했어요.' : '보스를 물리치지 못했어요.',
      ][stageIdx];
      game.lose({
        title: '시간 끝!',
        icon: '⏰',
        message: why + (game.retry < 3 ? `<br>다시 하면 시간이 <b>${RETRY_SEC}초</b> 늘어요` : ''),
        checkpoint: stageIdx,
      });
    }

    function finish(sum) {
      const margin = (sum - boss.power) / boss.power;
      const avgLeft = leftRatios.length ? leftRatios.reduce((a, b) => a + b, 0) / leftRatios.length : 0;
      let stars = 1 + (avgLeft >= 0.35 ? 1 : 0) + (margin >= 0.15 ? 1 : 0);
      if (game.retry > 0) stars = Math.min(stars, 2);
      const row = catches.slice(-12).map((m) => m.body).join('');
      game.win({
        stars,
        title: '보스 격파!',
        message:
          `<span class="bm-result-row">${row}</span>` +
          (stars === 3 ? '빠르고 여유 있게 이겼어요!' : margin < 0.15 ? '아슬아슬! 더 센 팀이면 별이 늘어요' : '조금 더 빨리 잡으면 별 3개!'),
        stats: [
          ['잡은 몬스터', `${catches.length}마리`],
          ['새로 도감에', `${plan.fresh.length}마리`],
          ['보스전 여유', `+${Math.round(margin * 100)}%`],
          ['내 도감', `${dexLoad().length}마리`],
        ],
      });
    }

    // ----- 일시 정지, 정리
    game.onPauseChange((paused) => {
      if (paused) {
        if (video.srcObject) video.pause();
      } else if (view === 'cam') attachVideo();
    });
    game.onCleanup(() => {
      if (alive()) session = null;
      stopCamera();
    });

    if (game.debug) {
      // 검증용: 상태 보기, 카메라가 읽은 것처럼 번호 넣기, 카드 닫기, 팀 고르기와 공격
      window.__game = {
        state: () => ({
          stage: stageIdx, view, busy, revealing: !!closeReveal, dexOpen: !!dexPanel, pad, wrongs,
          catches: catches.map((m) => ({ code: m.code, name: m.name, element: m.element, power: m.power, rarity: m.rarity, gold: m.gold })),
          stageCount: stageCatches.length, matched: stageCatches.filter(counts).length, targets: plan.targets.slice(),
          boss: boss && { power: boss.power, el: boss.el.id, name: boss.name }, best: boss ? bestTeam(catches, boss.el.id) : 0,
          picks: picks.slice(), pickSum: boss ? pickSum() : 0, canAttack: canAttack(),
          timeLeft: game.timeLeft(), cam: cam.status, why: cam.why, camLive: camLive(), engine: reader.engine, reader: reader.status,
          dex: dexLoad().length, fresh: plan.fresh.length, golds: GOLDS.slice(), goldNeed: GOLD_NEED, settings: Object.assign({}, S),
        }),
        scan: (code) => detected(code, 'camera'),
        read: (code) => onRead(code),
        closeReveal: () => closeReveal && closeReveal(),
        skip: (sec) => timer && timer.add(-sec), // 시간을 줄여 시간 초과 경로를 시험한다
        pick: togglePick,
        attack,
        view: setView,
        find: (pred, startAt) => findCode(pred, startAt),
        lib: Lib,
      };
    }

    // ----- 시작: 카메라가 켜져 있으면 바로, 실패했으면 숫자 입력으로, 아직이면 기다린다
    reader.ready().then(() => {
      if (!alive()) return;
      paintCam();
      paintPad();
      if (view !== 'boss') paintFooter();
    });
    if (camLive()) attachVideo();
    else if (cam.status !== 'fail') {
      openCamera().then((ok) => {
        if (!alive()) {
          if (!session) stopCamera();
          return;
        }
        if (ok) attachVideo();
        paintCam();
        paintPad();
        if (view !== 'boss') paintFooter();
      });
    }
    runStage();
  }

  const dexCount = dexLoad().length;
  Arcade.createGame({
    id: GAME_ID,
    title: '바코드 몬스터',
    icon: '👾',
    accent: '#b388ff',
    accent2: '#36d6ff',
    tagline: '집 안 물건마다 몬스터가 숨어 있다! 바코드로 잡아라' + (dexCount ? ` · 📖 <b>${dexCount}</b>마리` : ''),
    howTo: [
      '물건의 <b>바코드</b>를 찍으면 몬스터가 나와요. 같은 번호는 늘 같은 몬스터!',
      '임무대로 잡아요. 카메라가 안 되면 <b>바코드 숫자</b>를 눌러도 OK',
      GOLD_NEED ? '마지막엔 부모님이 숨긴 <b>황금 몬스터</b>를 찾아 보스를 이겨요' : '마지막은 <b>보스전</b>! 팀 3마리 힘의 합으로 물리쳐라',
    ],
    stages: 3,
    startLabel: '📷 사냥 시작!',
    async prepare() {
      reader.ready(); // 읽기 도구는 뒤에서 준비한다(인터넷이 느려도 시작은 막지 않는다)
      // 권한 창에서 오래 머물면 일단 시작하고, 나중에 허용되면 카메라로 바꾼다
      await Promise.race([openCamera(), Arcade.wait(6000)]);
    },
    start,
    onEnd() {
      // 결과 화면에서는 카메라를 끈다. 다시 하면 start 가 다시 연다
      session = null;
      stopCamera();
    },
  });
})();
