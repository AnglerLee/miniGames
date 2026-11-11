// 컬러 헌터: 팔레트를 채워라
// 집 안을 돌아다니며 목표 색과 같은 색 물건을 찍어 팔레트 칸을 채운다.
// 색 비교는 Lab 색공간의 CIEDE2000 색차로 하고, 0~100% 일치도로 바꿔 보여 준다.
(function () {
  'use strict';

  const { h, clamp, lerp, shuffle, pick, sfx, fx } = Arcade;
  const GAME_ID = 'game18';

  // ----- 설정 (관리자 페이지와 같은 키를 쓴다)
  const PRESETS = [
    { stageTime: 120, matchNeed: 60, passCount: 3 },
    { stageTime: 90, matchNeed: 66, passCount: 2 },
    { stageTime: 70, matchNeed: 72, passCount: 1 },
  ];
  /** 옛 설정의 RGB 거리 허용치(50~200)를 새 일치도 기준(%)으로 바꾼다. 150→60, 130→65, 100→72 */
  const needFromOld = (d) => clamp(Math.round(96 - 0.24 * d), 40, 90);
  const num = (v) => (v === '' || v === null || v === undefined || typeof v === 'boolean' ? NaN : Number(v));

  const saved = Arcade.loadSettings('game18_settings', {});
  const level = clamp(parseInt(saved.difficulty, 10) || 0, 0, 2);
  const S = Object.assign({}, PRESETS[level]);
  if (num(saved.stageTime) >= 20) S.stageTime = Math.min(600, num(saved.stageTime));
  if (num(saved.matchNeed) >= 30) S.matchNeed = Math.min(98, num(saved.matchNeed));
  else if (num(saved.colorThreshold) > 0) S.matchNeed = needFromOld(num(saved.colorThreshold));
  if (num(saved.passCount) >= 0) S.passCount = Math.min(10, Math.floor(num(saved.passCount)));

  const MISS_SEC = 4; // 빗나간 찍기의 대가
  const PERFECT = 95; // 이 일치도 이상이면 "완벽한 색!"
  const PERFECT_SEC = 5;
  const RELAY_SEC = Math.max(6, Math.round(S.stageTime * 0.12)); // 순서 팔레트: 찾을 때마다 늘어나는 시간
  const SAME_DE = 7; // 순서 팔레트: 바로 전에 찍은 색과 이보다 가까우면 같은 물건으로 본다
  const SAMPLE_K = 0.06; // 카메라: 화면 짧은 변의 6% 크기 네모를 평균 낸다
  const PHOTO_R = 15; // 사진: 손가락 자리 둘레 반지름(px)
  const FORCE_PHOTO = /[?&]nocam=1/.test(location.search);

  // ----- 색 계산: sRGB → Lab(D65) → CIEDE2000
  const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  function toLab({ r, g, b }) {
    const R = lin(r), G = lin(g), B = lin(b);
    const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
    const fx_ = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
    const fy = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
    const fz = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
    return { L: 116 * fy - 16, a: 500 * (fx_ - fy), b: 200 * (fy - fz) };
  }

  function deltaE(l1, l2) {
    const rad = Math.PI / 180;
    const p7 = (x) => Math.pow(x, 7);
    const Cm = (Math.hypot(l1.a, l1.b) + Math.hypot(l2.a, l2.b)) / 2;
    const G = 0.5 * (1 - Math.sqrt(p7(Cm) / (p7(Cm) + p7(25))));
    const a1 = l1.a * (1 + G), a2 = l2.a * (1 + G);
    const c1 = Math.hypot(a1, l1.b), c2 = Math.hypot(a2, l2.b);
    const hue = (b, a) => (a === 0 && b === 0 ? 0 : (Math.atan2(b, a) / rad + 360) % 360);
    const h1 = hue(l1.b, a1), h2 = hue(l2.b, a2);
    let dh = 0;
    if (c1 * c2) {
      dh = h2 - h1;
      if (dh > 180) dh -= 360;
      else if (dh < -180) dh += 360;
    }
    const dL = l2.L - l1.L, dC = c2 - c1;
    const dH = 2 * Math.sqrt(c1 * c2) * Math.sin((dh * rad) / 2);
    const Lm = (l1.L + l2.L) / 2, cm = (c1 + c2) / 2;
    let hm = h1 + h2;
    if (c1 * c2) hm = Math.abs(h1 - h2) <= 180 ? (h1 + h2) / 2 : (h1 + h2 + (h1 + h2 < 360 ? 360 : -360)) / 2;
    const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) +
      0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad);
    const Rc = 2 * Math.sqrt(p7(cm) / (p7(cm) + p7(25)));
    const Rt = -Math.sin(2 * 30 * Math.exp(-Math.pow((hm - 275) / 25, 2)) * rad) * Rc;
    const Sl = 1 + (0.015 * Math.pow(Lm - 50, 2)) / Math.sqrt(20 + Math.pow(Lm - 50, 2));
    const Sc = 1 + 0.045 * cm, Sh = 1 + 0.015 * cm * T;
    return Math.sqrt(Math.pow(dL / Sl, 2) + Math.pow(dC / Sc, 2) + Math.pow(dH / Sh, 2) + Rt * (dC / Sc) * (dH / Sh));
  }

  /** 색차를 일치도로: ΔE 1.5 이하는 100%, 1 늘 때마다 2.5% 줄어든다 (ΔE 3.5 → 95%, 15 → 66%) */
  const matchOf = (lab, target) => clamp(Math.round(100 - Math.max(0, deltaE(lab, target) - 1.5) * 2.5), 0, 100);
  const css = (c) => `rgb(${c.r}, ${c.g}, ${c.b})`;
  function lch(lab) {
    return { L: lab.L, C: Math.hypot(lab.a, lab.b), h: ((Math.atan2(lab.b, lab.a) * 180) / Math.PI + 360) % 360 };
  }

  // Lab 색상각으로 색 이름을 붙인다 (조언 문구용)
  const HUE_WORDS = [[15, '분홍빛으로'], [45, '빨갛게'], [75, '주황빛으로'], [105, '노랗게'], [165, '초록빛으로'], [255, '하늘빛으로'], [295, '파랗게'], [330, '보랏빛으로'], [361, '분홍빛으로']];
  const hueWord = (hh) => HUE_WORDS.find(([end]) => ((hh % 360) + 360) % 360 < end)[1];

  /** 찍은 색이 목표와 어느 쪽으로 다른지 한 마디로 알려 준다 */
  function hintFor(capLab, targetLab) {
    const c = lch(capLab), t = lch(targetLab);
    if (t.C >= 15 && c.C < 9) return '너무 흐려요. 더 선명한 색!';
    let dh = t.h - c.h;
    if (dh > 180) dh -= 360;
    if (dh < -180) dh += 360;
    const hueGap = t.C >= 10 && c.C >= 9 ? 2 * Math.sqrt(c.C * t.C) * Math.sin((Math.abs(dh) * Math.PI) / 360) : 0;
    const dL = c.L - t.L, dC = c.C - t.C;
    const top = [[Math.abs(dL), 'L'], [Math.abs(dC) * 0.7, 'C'], [hueGap, 'H']].sort((x, y) => y[0] - x[0])[0][1];
    // 색상이 조금 다르면 섞는 방향(빨강→주황이면 "노랗게"), 많이 다르면 목표 색 이름
    if (top === 'H') return '조금 더 ' + hueWord(Math.abs(dh) > 40 ? t.h : t.h + Math.sign(dh) * 30) + '!';
    if (top === 'L') return dL > 0 ? '조금 더 어두운 색!' : '조금 더 밝은 색!';
    return dC < 0 ? '조금 더 선명한 색!' : '조금 더 흐린 색!';
  }

  // ----- 팔레트 (카메라로 찍힌 색에 가깝게 살짝 눌러 둔 색)
  const C = (name, hex) => {
    const n = parseInt(hex.slice(1), 16);
    const rgb = { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    return { name, hex, rgb, lab: toLab(rgb) };
  };
  const RED = C('빨강', '#d83a3a'), YELLOW = C('노랑', '#f2c73a'), BLUE = C('파랑', '#2f6fd0');
  const GREEN = C('초록', '#3aa857'), ORANGE = C('주황', '#f08a2c');
  const BASIC = [RED, YELLOW, BLUE, GREEN, ORANGE];
  const LIGHT = [C('연한 하늘색', '#9fd0ef'), C('베이지', '#d9c3a0'), C('연분홍', '#f2b8c6'), C('연두', '#a8d46a'), C('연보라', '#b9a3e0')];
  const DARK = [C('진한 초록', '#2f5e3a'), C('남색', '#283a6e'), C('갈색', '#7a4e2e'), C('진한 빨강', '#8a2434')];
  // 순서 팔레트는 이웃한 색끼리 이어 붙여서, 한 물건으로 두 칸을 채우기 어렵게 했다
  const ORDER_SETS = [
    [YELLOW, ORANGE, RED, C('분홍', '#e86aa0')],
    [C('연두', '#b5d44a'), GREEN, C('하늘색', '#4fb0d8'), BLUE],
  ];

  const STAGES = [
    { name: '기본 팔레트', goal: '<b>칸을 눌러</b> 고르고, 그 색 물건을 찍어라', banner: ['팔레트 1', '또렷한 색 3개를 찾아라!'] },
    { name: '명도 팔레트', goal: '<b>연한 색</b>·<b>진한 색</b>, 밝기까지 맞춰라', banner: ['팔레트 2', '연한 색, 진한 색까지 똑같이!'] },
    { name: '순서 팔레트', goal: `<b>순서대로</b>! 찾을 때마다 시간 +${RELAY_SEC}초`, banner: ['마지막 팔레트', '순서대로! 같은 물건은 한 번만'] },
  ];

  /** 서로 충분히 다른 색 n개를 고른다 */
  function pickSpread(pool, n, minDE) {
    for (let i = 0; i < 80; i++) {
      const cand = shuffle(pool).slice(0, n);
      if (cand.every((a, x) => cand.every((b, y) => y <= x || deltaE(a.lab, b.lab) >= minDE))) return cand;
    }
    return pool.slice(0, n);
  }

  function makePalette(idx) {
    if (idx === 0) return pickSpread(BASIC, 3, 25);
    if (idx === 1) return shuffle(pickSpread(LIGHT, 2, 21).concat(pickSpread(DARK, 2, 21)));
    const set = pick(ORDER_SETS).slice();
    return Math.random() < 0.5 ? set : set.reverse();
  }

  // ----- 카메라 (판이 바뀌어도 권한은 한 번만 묻도록 바깥에 둔다)
  const cam = { stream: null, status: 'idle', why: '', opening: null };
  let session = null; // 지금 판. 판이 끝나면 null

  function openCamera() {
    if (cam.opening) return cam.opening;
    const fail = (why) => {
      cam.status = 'fail';
      cam.why = why;
      return false;
    };
    cam.status = 'opening';
    cam.opening = (async () => {
      if (FORCE_PHOTO) return fail('off');
      if (!window.isSecureContext) return fail('insecure');
      const md = navigator.mediaDevices;
      if (!md || !md.getUserMedia) return fail('none');
      try {
        cam.stream = await md.getUserMedia({
          audio: false,
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
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
  }

  const camLive = () => !!cam.stream && cam.stream.getVideoTracks().some((t) => t.readyState === 'live');

  const WHY = {
    insecure: '카메라는 <b>https</b> 주소에서만 열려요',
    denied: '카메라 권한이 꺼져 있어요',
    none: '이 기기에서는 카메라를 쓸 수 없어요',
    error: '카메라를 열지 못했어요',
    lost: '카메라가 꺼졌어요',
    off: '사진 모드예요',
  };

  function start(game) {
    let stageIdx = game.checkpoint;
    const ease = Math.min(game.retry, 3); // 재도전할수록 기준과 시간을 조금씩 풀어 준다
    const need = Math.max(35, S.matchNeed - ease * 4);
    let passesLeft = S.passCount;
    let passesUsed = 0;
    let misses = 0;
    let perfects = 0;
    const matches = [];
    let slots = [];
    let cur = -1; // 지금 목표 칸
    let lastGot = null; // 순서 팔레트: 바로 전에 찍은 색(Lab)
    let busy = true; // 찍기·패스를 잠시 막는다
    let timer = null;
    let mode = 'wait'; // camera | photo | wait
    let live = null; // 지금 십자선 아래 색 { rgb, lab, match }
    let shown = 0; // 화면에 보이는 일치도(부드럽게 따라간다)
    let fake = null; // 검증용: 지금 색을 직접 넣는다
    let recent = []; // 카메라: 최근 0.25초 동안 읽은 색. 찍을 때 함께 평균 내서 손떨림을 줄인다
    let photo = null; // { img, rect } 올린 사진
    let point = { x: 0, y: 0 }; // 사진에서 고른 자리(px)
    let photoClickAt = -1e9; // 사진 버튼을 누른 때. 곧이어 화면이 가려지면 사진 앱에 간 것으로 본다
    let hiddenAt = 0;
    let sampleAcc = 0;
    let beepAcc = 0;
    const me = {};
    session = me;
    const alive = () => session === me;

    // ----- 화면
    const palette = h('div', { class: 'ch-palette' });
    const video = h('video', { class: 'ch-video', playsinline: true, muted: true, autoplay: true });
    video.muted = true;
    const photoCan = h('canvas', { class: 'ch-photo' });
    const pctx = photoCan.getContext('2d', { willReadFrequently: true });
    const cross = h('div', { class: 'ch-cross' });
    const emptyIcon = h('div', { class: 'ch-empty-icon' });
    const emptyTitle = h('div', { class: 'ch-empty-title' });
    const emptySub = h('div', { class: 'ch-empty-sub' });
    const emptyBtn = photoButton('ar-btn ch-photo-btn', '📷 사진 찍기');
    const empty = h('div', { class: 'ch-empty' }, [emptyIcon, emptyTitle, emptySub, emptyBtn]);
    const retake = photoButton('ar-btn ghost sm ch-retake', '📷 새 사진');
    const nowSw = h('div', { class: 'ch-sw now' }, h('small', { text: '지금' }));
    const goalSw = h('div', { class: 'ch-sw goal' }, h('small', { text: '목표' }));
    const tname = h('span', { class: 'ch-tname' });
    const pct = h('span', { class: 'ch-pct', text: '--%' });
    const fill = h('i');
    const bar = h('div', { class: 'ch-bar', style: { '--need': need + '%' } }, [fill, h('b')]);
    const warm = h('div', { class: 'ch-warm' });
    const meter = h('div', { class: 'ch-meter' }, [
      nowSw,
      h('div', { class: 'ch-mid' }, [h('div', { class: 'ch-mtop' }, [tname, pct]), bar, warm]),
      goalSw,
    ]);
    const view = h('div', { class: 'ch-view' }, [video, photoCan, cross, empty, retake, meter]);
    const passBtn = h('button', { class: 'ar-btn ghost ch-pass' });
    const shootBtn = h('button', { class: 'ar-btn lg ch-shoot', text: '📸 찍기' });
    game.root.append(palette, view);
    game.footer.append(passBtn, shootBtn);

    shootBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      capture();
    });
    passBtn.addEventListener('click', pass);
    game.on(window, 'keydown', (e) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        capture();
      }
    });
    game.on(window, 'resize', () => {
      if (photo) drawPhoto(false);
      sizeRing();
    });

    // ----- 사진 올리기 (카메라를 못 쓸 때)
    function photoButton(cls, text) {
      const input = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'ch-file' });
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        input.value = '';
        backFromPhoto();
        if (file) loadPhoto(file);
      });
      const label = h('label', { class: cls }, [text, input]);
      label.addEventListener('click', () => (photoClickAt = performance.now()));
      return label;
    }

    // 사진 앱을 여는 동안 화면이 가려지면 엔진이 멈춘다. 돌아오면 이어 가되, 다녀온 시간만큼은 뺀다
    game.on(document, 'visibilitychange', () => {
      if (document.hidden) {
        if (performance.now() - photoClickAt < 4000) hiddenAt = performance.now();
      } else if (hiddenAt) {
        backFromPhoto();
      }
    });

    function backFromPhoto() {
      if (!hiddenAt || !alive()) return;
      const away = Math.min(45, Math.round((performance.now() - hiddenAt) / 1000));
      hiddenAt = 0;
      photoClickAt = -1e9;
      if (game.phase === 'paused') game.resume();
      if (away >= 1 && timer && game.playing) {
        timer.add(-away);
        fx.toast(`사진 찍는 동안 <b>${away}초</b> 흘렀어요`, { ms: 1600 });
      }
    }

    function loadPhoto(file) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        if (!alive()) return;
        photo = { img, rect: null };
        if (mode !== 'camera') mode = 'photo';
        drawPhoto(true);
        sfx('pop');
        paintMode();
        updateLive();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        if (alive()) fx.toast('사진을 열지 못했어요', { kind: 'bad' });
      };
      img.src = url;
    }

    /** 사진을 미터 위쪽 공간에 맞춰 그린다. center 면 고른 자리를 가운데로 되돌린다 */
    function drawPhoto(center) {
      const w = view.clientWidth, hh = view.clientHeight;
      if (!w || !hh) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      photoCan.width = Math.round(w * dpr);
      photoCan.height = Math.round(hh * dpr);
      pctx.fillStyle = '#070914';
      pctx.fillRect(0, 0, photoCan.width, photoCan.height);
      const room = Math.max(60, hh - meter.offsetHeight - 16);
      const { naturalWidth: iw, naturalHeight: ih } = photo.img;
      const s = Math.min(w / iw, room / ih);
      const rect = { x: (w - iw * s) / 2, y: (room - ih * s) / 2, w: iw * s, h: ih * s };
      pctx.drawImage(photo.img, rect.x * dpr, rect.y * dpr, rect.w * dpr, rect.h * dpr);
      photo.rect = rect;
      if (center) point = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
      setPoint(point.x, point.y);
    }

    function setPoint(x, y) {
      const r = photo.rect;
      point = { x: clamp(x, r.x + 2, r.x + r.w - 2), y: clamp(y, r.y + 2, r.y + r.h - 2) };
      cross.style.left = point.x + 'px';
      cross.style.top = point.y + 'px';
    }

    function clearPhoto() {
      photo = null;
      if (mode === 'photo' && camLive()) return useCamera();
      paintMode();
    }

    let dragging = false;
    const pointAt = (e) => {
      const b = view.getBoundingClientRect();
      setPoint(e.clientX - b.left, e.clientY - b.top);
      updateLive();
    };
    view.addEventListener('pointerdown', (e) => {
      if (mode !== 'photo' || !photo || e.target.closest('label, button')) return;
      dragging = true;
      pointAt(e);
      sfx('tap');
    });
    view.addEventListener('pointermove', (e) => dragging && mode === 'photo' && photo && pointAt(e));
    game.on(window, 'pointerup', () => (dragging = false));

    // ----- 모드 바꾸기
    function useCamera() {
      mode = 'camera';
      photo = null;
      video.srcObject = cam.stream;
      video.play().catch(() => {});
      const track = cam.stream.getVideoTracks()[0];
      if (track) {
        track.onended = () => {
          if (!alive() || mode !== 'camera') return;
          stopCamera();
          cam.status = 'fail';
          cam.why = 'lost';
          usePhoto();
        };
      }
      video.onloadedmetadata = sizeRing;
      paintMode();
    }

    function usePhoto() {
      mode = 'photo';
      video.srcObject = null;
      paintMode();
    }

    function paintMode() {
      const hasPhoto = mode === 'photo' && !!photo;
      view.classList.toggle('cam', mode === 'camera');
      view.classList.toggle('photo', mode === 'photo');
      view.classList.toggle('has', hasPhoto);
      empty.classList.toggle('ar-hidden', mode === 'camera' || hasPhoto);
      retake.classList.toggle('ar-hidden', !hasPhoto);
      cross.classList.toggle('ar-hidden', !(mode === 'camera' || hasPhoto));
      if (mode === 'camera') {
        cross.style.left = '50%';
        cross.style.top = '50%';
        sizeRing();
      } else {
        cross.style.setProperty('--ring', PHOTO_R * 2 + 'px');
      }
      if (mode === 'wait') {
        emptyIcon.textContent = '📷';
        emptyTitle.innerHTML = '카메라 켜는 중…';
        emptySub.innerHTML = '권한을 물으면 <b>허용</b>! 안 되면 사진으로';
        emptyBtn.firstChild.textContent = '🖼️ 사진으로 할래요';
      } else if (mode === 'photo' && !photo) {
        emptyIcon.textContent = '🖼️';
        emptyTitle.innerHTML = cam.status === 'opening' ? '카메라를 기다리는 중이에요' : WHY[cam.why] || WHY.error;
        emptySub.innerHTML = '물건을 <b>사진으로 찍어</b> 올리고, 색을 콕 집어요';
        emptyBtn.firstChild.textContent = '📷 사진 찍기';
      }
      shootBtn.textContent = mode === 'photo' ? '🎯 이 색으로!' : '📸 찍기';
      updateLive();
    }

    /** 십자선 동그라미를 실제로 평균 내는 영역 크기에 맞춘다 */
    function sizeRing() {
      if (mode !== 'camera') return;
      const vw = video.videoWidth, vh = video.videoHeight;
      const bw = view.clientWidth, bh = view.clientHeight;
      if (!vw || !vh || !bw) return;
      const scale = Math.max(bw / vw, bh / vh);
      cross.style.setProperty('--ring', Math.max(22, Math.round(Math.min(vw, vh) * SAMPLE_K * scale)) + 'px');
    }

    // ----- 색 읽기
    const sCan = h('canvas', { width: 12, height: 12 });
    const sctx = sCan.getContext('2d', { willReadFrequently: true });

    /** 밝기로 줄 세워 위아래 15%(반사광, 그림자)를 버리고 평균 낸다 */
    function average(data) {
      const px = [];
      for (let i = 0; i < data.length; i += 4) px.push([data[i], data[i + 1], data[i + 2], data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11]);
      px.sort((p, q) => p[3] - q[3]);
      const cut = Math.floor(px.length * 0.15);
      const keep = px.slice(cut, px.length - cut);
      const sum = keep.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]);
      return { r: Math.round(sum[0] / keep.length), g: Math.round(sum[1] / keep.length), b: Math.round(sum[2] / keep.length) };
    }

    function readCamera() {
      const vw = video.videoWidth, vh = video.videoHeight;
      if (!vw || !vh || video.readyState < 2) return null;
      const size = Math.max(6, Math.round(Math.min(vw, vh) * SAMPLE_K));
      sctx.drawImage(video, (vw - size) / 2, (vh - size) / 2, size, size, 0, 0, 12, 12);
      return average(sctx.getImageData(0, 0, 12, 12).data);
    }

    function readPhoto() {
      if (!photo || !photo.rect) return null;
      const k = photoCan.width / Math.max(1, view.clientWidth);
      const r = Math.round(PHOTO_R * 0.8 * k);
      const x = clamp(Math.round(point.x * k) - r, 0, photoCan.width - 2 * r);
      const y = clamp(Math.round(point.y * k) - r, 0, photoCan.height - 2 * r);
      return average(pctx.getImageData(x, y, 2 * r, 2 * r).data);
    }

    function readReal() {
      try {
        if (mode === 'camera') return readCamera();
        if (mode === 'photo') return readPhoto();
      } catch (e) {
        /* 영상이 아직 준비되지 않았다 */
      }
      return null;
    }

    const readColor = () => fake || readReal();

    function updateLive() {
      const rgb = cur >= 0 ? readColor() : null;
      if (!rgb) {
        live = null;
        recent = [];
      } else {
        const lab = toLab(rgb);
        live = { rgb, lab, match: matchOf(lab, slots[cur].lab) };
        recent.push({ t: game.time, rgb });
        recent = recent.filter((p) => game.time - p.t <= 0.25);
      }
      paintMeter();
    }

    function steadyColor() {
      const now = readColor();
      if (!now || fake || mode !== 'camera') return now;
      const pool = [now].concat(recent.filter((p) => game.time - p.t <= 0.25).map((p) => p.rgb));
      const avg = (k) => Math.round(pool.reduce((s, c) => s + c[k], 0) / pool.length);
      return { r: avg('r'), g: avg('g'), b: avg('b') };
    }

    // ----- 그리기
    function renderPalette() {
      palette.innerHTML = '';
      palette.classList.toggle('order', stageIdx === 2);
      slots.forEach((slot, i) => {
        if (i > 0 && stageIdx === 2) palette.appendChild(h('span', { class: 'ch-arrow', text: '›' }));
        const dot = h('span', { class: 'ch-dot', style: { '--c': slot.hex } }, [h('span', { class: 'ch-in' }), h('span', { class: 'ch-tag' })]);
        const el = h('button', { class: 'ch-slot', 'aria-label': slot.name }, [dot, h('span', { class: 'ch-name', text: slot.name })]);
        el.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          tapSlot(i);
        });
        slot.el = el;
        slot.dot = dot;
        palette.appendChild(el);
        paintSlot(i);
      });
    }

    function paintSlot(i) {
      const s = slots[i];
      const el = s.el;
      el.className = 'ch-slot' + (s.state ? ' ' + s.state : '') + (i === cur ? ' sel' : '') +
        (stageIdx === 2 && !s.state && i > cur ? ' later' : '');
      const inner = s.dot.firstChild;
      const tag = s.dot.lastChild;
      inner.style.background = s.got ? css(s.got) : '';
      inner.textContent = stageIdx === 2 && !s.state ? String(i + 1) : s.state === 'pass' ? '패스' : '';
      tag.textContent = s.state === 'done' || s.state === 'perfect' ? s.match + '%' : '';
    }

    function paintMeter() {
      const slot = slots[cur];
      goalSw.style.background = slot ? slot.hex : 'transparent';
      tname.textContent = slot ? slot.name : '';
      view.style.setProperty('--goal', slot ? slot.hex : '#fff');
      if (!live) {
        nowSw.style.background = '';
        nowSw.classList.add('none');
        pct.textContent = '--%';
        fill.style.transform = 'scaleX(0)';
        bar.className = 'ch-bar';
        bar.dataset.kind = '';
        warm.textContent = mode === 'photo' && !photo ? '사진을 올리면 여기에 색이 나와요' : mode === 'photo' ? '사진을 눌러 색을 골라요' : '…';
        view.classList.remove('hot');
        shootBtn.classList.remove('ready');
        return;
      }
      nowSw.classList.remove('none');
      nowSw.style.background = css(live.rgb);
      paintLevel();
    }

    /** 막대·글자·반짝임은 모두 부드럽게 따라가는 값(shown) 하나로 그린다 */
    function paintLevel() {
      const m = Math.round(shown);
      const hot = m >= need;
      pct.textContent = m + '%';
      fill.style.transform = `scaleX(${clamp(shown / 100, 0, 1)})`;
      const kind = m >= PERFECT ? 'perfect' : hot ? 'hot' : m >= need - 15 ? 'warm' : 'cold';
      if (kind !== bar.dataset.kind) {
        bar.dataset.kind = kind;
        bar.className = 'ch-bar ' + kind;
        warm.textContent = { perfect: '완벽해! ✨', hot: '따뜻해! 지금 찍어 🔥', warm: '미지근해… 조금만 더 🙂', cold: '차가워 🥶' }[kind];
      }
      view.classList.toggle('hot', hot);
      shootBtn.classList.toggle('ready', hot && !busy);
    }

    function paintPass() {
      passBtn.textContent = `⏭ 패스 ${passesLeft}`;
      passBtn.classList.toggle('disabled', passesLeft <= 0);
    }

    // ----- 고르기, 찍기, 패스
    function tapSlot(i) {
      if (!game.playing || busy || i === cur) return;
      const s = slots[i];
      if (s.state) return fx.toast('이미 채운 칸이에요', { ms: 900 });
      if (stageIdx === 2) return fx.toast('순서대로! 지금은 <b>' + slots[cur].name + '</b>', { kind: 'bad', ms: 1100 });
      select(i);
      sfx('pick');
    }

    function select(i) {
      const before = cur;
      cur = i;
      if (before >= 0 && slots[before]) paintSlot(before);
      if (i >= 0) {
        paintSlot(i);
        fx.pop(slots[i].dot);
      }
      shown = 0;
      updateLive();
    }

    function shutter() {
      fx.flash('rgba(255,255,255,.85)', 220);
      Arcade.audio.noise({ dur: 0.06, freq: 4200, vol: 0.22, filter: 'highpass' });
      Arcade.audio.tone({ freq: 1600, to: 700, type: 'square', dur: 0.05, vol: 0.05, delay: 0.05 });
    }

    function capture() {
      if (!game.playing || busy || cur < 0) return;
      const rgb = steadyColor();
      if (!rgb) {
        sfx('tap');
        fx.toast(mode === 'camera' ? '카메라를 준비하는 중이에요' : '먼저 <b>사진</b>을 찍어 올려요', { ms: 1200 });
        return;
      }
      shutter();
      const lab = toLab(rgb);
      const match = matchOf(lab, slots[cur].lab);
      if (match >= need) {
        if (stageIdx === 2 && lastGot && deltaE(lab, lastGot) < SAME_DE) return reject();
        success(rgb, match);
      } else {
        miss(lab, match);
      }
    }

    function hold(ms) {
      busy = true;
      shootBtn.classList.remove('ready');
      game.after(ms, () => (busy = false));
    }

    function reject() {
      sfx('miss');
      fx.shake(view, 6);
      fx.toast('방금 그 물건 같아요! <b>다른 물건</b>으로', { kind: 'bad', ms: 1500 });
      hold(600);
    }

    function miss(lab, match) {
      misses++;
      game.resetCombo();
      sfx('bad');
      fx.shake(view, 9);
      view.classList.remove('miss');
      void view.offsetWidth;
      view.classList.add('miss');
      if (timer) timer.add(-MISS_SEC);
      const near = match >= need - 8 ? '거의 다 왔어! ' : '';
      fx.toast(`${match}% · ${near}${hintFor(lab, slots[cur].lab)}`, { kind: 'bad', ms: 1700 });
      hold(700);
    }

    async function success(rgb, match) {
      busy = true;
      shootBtn.classList.remove('ready');
      const i = cur;
      const slot = slots[i];
      const perfect = match >= PERFECT;
      matches.push(match);
      if (perfect) perfects++;
      lastGot = toLab(rgb);
      const combo = game.addCombo();
      sfx(perfect ? 'perfect' : match >= need + 15 ? 'great' : 'good');
      await flyTo(slot.dot, rgb);
      slot.state = perfect ? 'perfect' : 'done';
      slot.match = match;
      slot.got = rgb;
      paintSlot(i);
      fx.pop(slot.dot);
      fx.burst(slot.dot, { count: perfect ? 22 : 12, spread: perfect ? 110 : 70, colors: [css(rgb), slot.hex, '#ffffff'] });
      game.addScore(100 + Math.max(0, match - 50) * 8 + (perfect ? 150 : 0) + Math.min(combo - 1, 5) * 30, slot.dot);
      if (perfect) {
        fx.toast(`✨ 완벽한 색! <b>+${PERFECT_SEC}초</b>`, { kind: 'gold' });
        if (timer) timer.add(PERFECT_SEC);
      } else {
        fx.toast(`${match}% 성공!`, { kind: 'good', ms: 900 });
      }
      if (stageIdx === 2 && timer && slots.some((x) => !x.state)) timer.add(RELAY_SEC);
      if (mode === 'photo') clearPhoto();
      advance();
    }

    function flyTo(target, rgb) {
      const a = (cross.offsetWidth ? cross : view).getBoundingClientRect();
      const b = target.getBoundingClientRect();
      const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
      const x1 = b.left + b.width / 2, y1 = b.top + b.height / 2;
      const dot = h('div', { class: 'ch-fly', style: { background: css(rgb) } });
      game.root.appendChild(dot);
      return game
        .tween(480, (k) => {
          const x = lerp(x0, x1, k), y = lerp(y0, y1, k) - Math.sin(k * Math.PI) * 70;
          dot.style.transform = `translate(${x - 24}px, ${y - 24}px) scale(${lerp(1.5, 0.9, k)})`;
        })
        .then(() => dot.remove());
    }

    function pass() {
      if (!game.playing || busy || cur < 0) return;
      if (passesLeft <= 0) return fx.toast('패스를 다 썼어요', { kind: 'bad', ms: 1000 });
      passesLeft--;
      passesUsed++;
      slots[cur].state = 'pass';
      paintSlot(cur);
      game.resetCombo();
      sfx('whoosh');
      fx.toast('패스! 별이 하나 줄어요', { ms: 1100 });
      paintPass();
      advance();
    }

    function advance() {
      const order = slots.map((_, k) => (cur + 1 + k) % slots.length);
      const next = stageIdx === 2 ? slots.findIndex((s) => !s.state) : order.find((k) => !slots[k].state);
      if (next === undefined || next < 0) return stageClear();
      select(next);
      busy = false;
    }

    // ----- 스테이지 흐름
    function stageSeconds() {
      const base = S.stageTime + ease * 15;
      return stageIdx === 2 ? Math.round(base * 0.6) : base;
    }

    function timeUp() {
      game.lose({
        icon: '⏰',
        title: '시간 끝!',
        message: `${STAGES[stageIdx].name}를 다 채우지 못했어요.<br>다시 하면 기준이 4% 너그러워져요`,
        checkpoint: stageIdx,
      });
    }

    async function stageClear() {
      busy = true;
      select(-1);
      if (timer) timer.stop();
      const left = timer ? Math.ceil(timer.left()) : 0;
      sfx('stage');
      fx.confetti(40);
      if (left > 0) game.addScore(left * 4, palette);
      if (stageIdx >= STAGES.length - 1) {
        await game.wait(900);
        return finish();
      }
      await game.banner('팔레트 완성!', left > 0 ? `남은 시간 보너스 +${left * 4}` : '', { ms: 1200, kind: 'good' });
      stageIdx++;
      runStage();
    }

    async function runStage() {
      busy = true;
      slots = makePalette(stageIdx).map((c) => Object.assign({}, c, { state: '', match: 0, got: null }));
      cur = -1;
      lastGot = null;
      game.hideTimer();
      game.setStage(stageIdx, STAGES.length);
      game.setGoal(STAGES[stageIdx].goal);
      renderPalette();
      select(0);
      const [title, sub] = STAGES[stageIdx].banner;
      const extra = ease ? `<br>재도전: 기준 ${need}% · 시간 +${ease * 15}초` : '';
      await game.banner(title, sub + extra, { ms: 1600 });
      timer = game.startTimer(stageSeconds(), { onEnd: timeUp, warnAt: 15 });
      busy = false;
      paintMeter();
    }

    function finish() {
      const avg = matches.length ? Math.round(matches.reduce((a, b) => a + b, 0) / matches.length) : 0;
      let stars = avg >= 85 ? 3 : avg >= 75 ? 2 : 1;
      stars = Math.max(1, stars - passesUsed);
      if (game.retry > 0) stars = Math.min(stars, 2);
      game.win({
        stars,
        title: '팔레트 완성!',
        message: stars === 3 ? '눈이 정말 좋아요. 색 사냥의 달인!' : passesUsed ? '패스 없이 하면 별이 더 늘어요!' : '더 비슷한 색을 찾으면 별이 늘어요!',
        stats: [
          ['평균 일치도', avg + '%'],
          ['완벽한 색', perfects + '개'],
          ['패스', passesUsed + '번'],
          ['빗나간 찍기', misses + '번'],
        ],
      });
    }

    // ----- 매 프레임: 색 읽기(0.1초마다), 막대, 따뜻해/차가워 소리
    game.loop((dt) => {
      sampleAcc += dt;
      if (sampleAcc >= 0.1) {
        sampleAcc = 0;
        updateLive();
      }
      if (live) {
        shown += (live.match - shown) * Math.min(1, dt * 9);
        paintLevel();
        if (!busy && timer) {
          beepAcc += dt;
          const k = clamp(shown / 100, 0, 1);
          if (beepAcc >= lerp(0.9, 0.15, k * k)) {
            beepAcc = 0;
            Arcade.audio.tone({ freq: 220 + k * k * 900, type: live.match >= need ? 'triangle' : 'sine', dur: 0.06, vol: 0.05 });
          }
        }
      }
    });

    // ----- 판이 끝나거나 다시 시작할 때
    me.pause = () => video.srcObject && video.pause();
    me.resume = () => video.srcObject && video.play().catch(() => {});
    game.onCleanup(() => {
      if (alive()) session = null;
      stopCamera();
    });

    if (game.debug) {
      // 검증용: 상태 보기, 지금 색 넣기(null 이면 실제 카메라·사진으로), 찍기·패스 대신 누르기
      window.__game = {
        state: () => ({
          mode, stage: stageIdx, cur, need, busy, passesLeft, passesUsed, misses, perfects,
          matches: matches.slice(),
          live: live && { rgb: live.rgb, match: live.match },
          slots: slots.map((s) => ({ name: s.name, hex: s.hex, state: s.state, match: s.match })),
          timeLeft: game.timeLeft(),
          cam: cam.status, why: cam.why, photo: !!photo, rect: photo && photo.rect, point,
        }),
        feed: (rgb) => {
          fake = rgb;
          recent = [];
          updateLive();
        },
        target: () => (cur >= 0 ? Object.assign({}, slots[cur].rgb) : null),
        // 지금 칸의 목표 색을 바꾼다. 시험 무늬(가짜 카메라)의 색으로 실제 찍기 경로를 확인할 때 쓴다
        paint: (hex) => {
          Object.assign(slots[cur], C(slots[cur].name, hex));
          slots[cur].dot.style.setProperty('--c', hex);
          updateLive();
        },
        readReal,
        capture,
        pass,
        tap: tapSlot,
        matchOf: (rgb, i) => matchOf(toLab(rgb), slots[i === undefined ? cur : i].lab),
        hintFor: (rgb, hex) => hintFor(toLab(rgb), C('', hex).lab),
        deltaE: (a, b) => deltaE(toLab(a), toLab(b)),
        settings: S,
      };
    }

    // 카메라: 이미 켜져 있으면 바로, 실패했으면 사진으로, 아직이면 기다린다(그동안 사진도 된다)
    if (camLive()) useCamera();
    else if (cam.status === 'fail') usePhoto();
    else {
      paintMode();
      openCamera().then((ok) => {
        if (!alive()) {
          if (!session) stopCamera();
          return;
        }
        if (ok && camLive()) {
          if (!photo) useCamera();
        } else if (mode === 'wait') usePhoto();
      });
    }
    paintPass();
    runStage();
  }

  Arcade.createGame({
    id: GAME_ID,
    title: '컬러 헌터',
    icon: '🎨',
    accent: '#ff7ab6',
    accent2: '#ffd43b',
    tagline: '집 안을 뛰어다니며 색을 사냥해 <b>팔레트 3장</b>을 채워라!',
    howTo: [
      '목표 색과 <b>같은 색 물건</b>을 찾아 십자선에 맞추고 찍기!',
      '막대가 <b>기준선</b>을 넘으면 성공. 95%를 넘으면 <b>완벽한 색</b>',
      `빗나가면 <b>시간 -${MISS_SEC}초</b>. 마지막 팔레트는 <b>순서대로</b>`,
    ],
    stages: STAGES.length,
    startLabel: '📷 카메라 켜고 시작',
    async prepare() {
      // 권한 창에서 오래 머물면 일단 시작하고, 나중에 허용되면 카메라로 바꾼다
      await Promise.race([openCamera(), Arcade.wait(9000)]);
    },
    start,
    onPause() {
      if (session && session.pause) session.pause();
    },
    onResume() {
      if (session && session.resume) session.resume();
    },
    onEnd() {
      // 결과 화면에서는 카메라를 끈다. 다시 하면 start 가 다시 연다
      session = null;
      stopCamera();
      document.querySelectorAll('.ch-fly').forEach((e) => e.remove());
    },
  });
})();
