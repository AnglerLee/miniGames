// 결말 화면: 자백 → 등급 → 보물 공개 → 신문 → 마무리. 아이가 혼자 한 장씩 넘겨 본다.
//
// 규격
//   showEnding(root, ctx) → { destroy() }
//   root  화면 전체를 덮는 빈 요소 (100dvh, 세로 flex)
//   ctx   { setup, cs, run, now, onNewCase(), onHome() }
//         run 은 solvedAt 이 채워진 상태다. 기록 저장(addHistory)은 이 화면이 한 번만 한다
//         (run.recorded 가 없을 때 저장하고 run.recorded = true 로 바꿔 saveRun).
//         run.forced === true 면 부모가 "수사 끝내기"로 끝낸 것: 자백 없이 보물 공개, 등급은 C.
//         새로고침으로 다시 들어오면(run.recorded 가 이미 있으면) 자백을 건너뛰고 등급 장부터 보여 준다.
//   돌려주는 값에는 검증용으로 page(), next(), prev(), go(i), timers() 도 들어 있다.

import { h, fill, avatar, buzz } from '../shared/dom.js';
import { confession, josa } from '../shared/text.js';
import { clock, bonusUnlocked, summarize } from '../shared/score.js';
import { TREASURE_KINDS } from '../shared/content.js';
import { addHistory, saveRun } from '../shared/store.js';
import { audio } from './audio.js';
import { renderNewspaper, canvasBlob } from './newspaper.js';
import { showReport, outcome } from './report.js';

// 등급 한 줄 평: 결과보다 노력을 짚는다 (낮은 등급일수록 더 따뜻하게)
const GRADE_WORDS = {
  S: { title: '명탐정', line: '단서를 하나하나 맞춰 범인을 정확히 짚었어.' },
  A: { title: '뛰어난 탐정', line: '꼼꼼하게 살피고 끝까지 따져서 해냈어.' },
  B: { title: '끈기 있는 탐정', line: '막힐 때도 멈추지 않고 다시 생각해서 해냈어.' },
  C: { title: '포기하지 않은 탐정', line: '쉽지 않았는데 끝까지 포기하지 않았어. 그게 진짜 탐정이야.' },
};
const MINUS_NAMES = { wrong: '잘못 고발', deny: '증거 불충분', hint: '힌트', miss: '조사 실수', slow: '느린 수사', late: '시간 초과' };

/** 이 화면이 만든 타이머와 애니메이션 프레임을 모아 두었다가 destroy 때 한꺼번에 지운다 */
function timerBag() {
  const outs = new Set();
  const frames = new Set();
  return {
    after(ms, fn) {
      const id = setTimeout(() => {
        outs.delete(id);
        fn();
      }, ms);
      outs.add(id);
      return id;
    },
    cancel(id) {
      clearTimeout(id);
      outs.delete(id);
    },
    frame(fn) {
      const id = requestAnimationFrame((t) => {
        frames.delete(id);
        fn(t);
      });
      frames.add(id);
      return id;
    },
    cancelFrame(id) {
      cancelAnimationFrame(id);
      frames.delete(id);
    },
    clear() {
      outs.forEach((id) => clearTimeout(id));
      frames.forEach((id) => cancelAnimationFrame(id));
      outs.clear();
      frames.clear();
    },
    count: () => outs.size + frames.size,
  };
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 양쪽 아래에서 쏘아 올리는 색종이. 3초 남짓 뒤 스스로 멈추고 캔버스를 치운다. */
function confetti(host, T) {
  if (reducedMotion()) return () => {};
  const w = host.clientWidth;
  const ht = host.clientHeight;
  if (!w || !ht) return () => {};
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const canvas = h('canvas', { class: 'end-confetti', 'aria-hidden': 'true' });
  canvas.width = Math.round(w * ratio);
  canvas.height = Math.round(ht * ratio);
  host.append(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  const colors = ['#e3b341', '#d9412f', '#3d7ea6', '#3f9d6b', '#f6ecd6', '#ffd95a'];
  const speed = Math.sqrt(ht / 844);
  const bits = [];
  for (let i = 0; i < 120; i++) {
    const left = i % 2 === 0;
    bits.push({
      x: left ? -10 : w + 10,
      y: ht * 0.92,
      vx: (left ? 1 : -1) * (2 + Math.random() * 6) * speed,
      vy: -(11 + Math.random() * 9) * speed,
      r: Math.random() * 6.28,
      vr: (Math.random() - 0.5) * 0.35,
      s: 6 + Math.random() * 6,
      c: colors[i % colors.length],
    });
  }
  const t0 = performance.now();
  let id = null;
  const stop = () => {
    if (id !== null) T.cancelFrame(id);
    id = null;
    canvas.remove();
  };
  const tick = (t) => {
    const age = t - t0;
    ctx.clearRect(0, 0, w, ht);
    ctx.globalAlpha = age > 2600 ? Math.max(0, 1 - (age - 2600) / 700) : 1;
    for (const b of bits) {
      b.vy += 0.34 * speed;
      b.vx *= 0.985;
      b.x += b.vx;
      b.y += b.vy;
      b.r += b.vr;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.r);
      ctx.fillStyle = b.c;
      ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2);
      ctx.restore();
    }
    if (age > 3300) {
      stop();
      return;
    }
    id = T.frame(tick);
  };
  id = T.frame(tick);
  return stop;
}

export function showEnding(root, ctx) {
  const { setup, cs, run } = ctx;
  const T = timerBag();
  const res = outcome(run, ctx.now);
  const forced = res.forced;
  const culprit = cs.suspects[cs.culprit];
  const firstVisit = !run.recorded;
  let dead = false;
  let report = null;
  let stopConfetti = () => {};
  let paperUrl = null;

  // 기록은 처음 한 번만. 새로고침해도 다시 쌓이지 않게 run 에 표시해 둔다.
  if (firstVisit) {
    addHistory({
      at: Date.now(),
      caseNo: setup.caseNo,
      detective: setup.detective,
      culprit: { name: culprit.name, icon: culprit.icon },
      grade: res.grade,
      score: res.score,
      usedMs: res.usedMs,
      difficulty: cs.difficulty,
      hints: (run.hints || []).length,
      wrong: summarize(run, ctx.now).wrong,
      forced: forced || undefined,
    });
    run.recorded = true;
  }
  run.phase = 'end';
  saveRun(run);

  audio.music.stop();
  // 새로고침으로 들어오면 아직 터치가 없어 소리가 잠겨 있다
  const unlock = () => audio.unlock();
  root.addEventListener('pointerdown', unlock, { once: true });

  const names = forced ? ['grade', 'treasure', 'paper', 'finish'] : ['confess', 'grade', 'treasure', 'paper', 'finish'];
  const pages = new Map();
  let index = firstVisit && !forced ? 0 : names.indexOf('grade');

  const stage = h('div', { class: 'end-stage' });
  const dots = h('div', { class: 'end-dots', 'aria-hidden': 'true' }, names.map(() => h('span')));
  const prevBtn = h('button', { class: 'btn ghost end-prev', type: 'button', text: '이전', onClick: () => go(index - 1) });
  const nextBtn = h('button', { class: 'btn primary end-next', type: 'button', text: '다음', onClick: () => advance() });
  const nav = h('nav', { class: 'end-nav' }, prevBtn, dots, nextBtn);
  const box = h('div', { class: 'end' }, stage, nav);
  root.append(box);

  // ---------- 1. 자백 ----------
  function confessPage() {
    const lines = confession(cs);
    const ghost = h('span', { class: 'end-ghost', 'aria-hidden': 'true' });
    const typed = h('span', { class: 'end-typed' });
    const bubble = h('div', { class: 'end-bubble', 'aria-live': 'polite' }, h('p', {}, ghost, typed));
    const count = h('div', { class: 'end-linedots', 'aria-hidden': 'true' }, lines.map(() => h('span')));
    const solvedStamp = h('span', { class: 'stamp end-solved', text: '사건 해결' });
    const tip = h('p', { class: 'end-tip', text: '화면을 누르면 다음 말' });
    const face = h('div', { class: 'end-face' }, avatar(culprit, 'big'));
    const node = h(
      'div',
      { class: 'end-page end-confess', onClick: () => advance() },
      h('p', { class: 'end-kicker', text: '범인의 자백' }),
      h('div', { class: 'end-who' }, face, solvedStamp),
      h('h2', { class: 'end-name', text: culprit.name }),
      bubble,
      count,
      tip
    );
    let li = -1;
    let typeId = null;
    let startId = null;
    let stampId = null;
    let stamped = false;

    const typing = () => typeId !== null;
    function finishLine() {
      if (typeId !== null) T.cancel(typeId);
      typeId = null;
      typed.textContent = lines[li];
      lineDone();
    }
    function lineDone() {
      if (li === lines.length - 1 && !stamped && stampId === null) {
        stampId = T.after(700, () => {
          stampId = null;
          if (names[index] === 'confess') stamp();
        });
      }
    }
    function showLine(k) {
      if (startId !== null) T.cancel(startId);
      startId = null;
      li = k;
      ghost.textContent = lines[k];
      typed.textContent = '';
      [...count.children].forEach((d, i) => d.classList.toggle('on', i <= k));
      const chars = Array.from(lines[k]);
      let n = 0;
      const step = () => {
        n++;
        typed.textContent = chars.slice(0, n).join('');
        const ch = chars[n - 1];
        // 'type' 소리는 몇 글자에 한 번만 (매 글자마다 내면 시끄럽다)
        if (n % 3 === 1 && ch !== ' ') audio.sfx('type');
        if (n >= chars.length) {
          typeId = null;
          lineDone();
          return;
        }
        typeId = T.after(ch === '.' || ch === '…' || ch === '!' ? 240 : 45, step);
      };
      typeId = T.after(60, step);
      if (k > 0) face.classList.remove('nod');
      void face.offsetWidth;
      face.classList.add('nod');
    }
    function stamp() {
      if (stampId !== null) T.cancel(stampId);
      stampId = null;
      stamped = true;
      solvedStamp.classList.add('on');
      tip.textContent = '화면을 누르면 다음 장';
      audio.sfx('stamp');
      buzz(40);
    }
    return {
      node,
      enter() {
        if (li < 0) startId = T.after(firstVisit ? 900 : 300, () => showLine(0));
      },
      leave() {
        // 첫 문장이 시작되기 전에 떠나면 다른 장에서 타자 소리가 나지 않게 미룬 시작을 지운다
        if (startId !== null) T.cancel(startId);
        startId = null;
        if (typing()) finishLine();
      },
      step() {
        if (typing()) {
          finishLine();
          return true;
        }
        if (li < lines.length - 1) {
          showLine(li + 1);
          return true;
        }
        if (!stamped) {
          stamp();
          return true;
        }
        return false;
      },
      state: () => ({ line: li, lines: lines.length, typing: typing(), stamped }),
    };
  }

  // ---------- 2. 등급 ----------
  function gradePage() {
    const g = res.grade;
    const words = GRADE_WORDS[g];
    const big = h('div', { class: 'end-grade g-' + g, role: 'img', 'aria-label': g + ' 등급' }, h('span', { class: 'end-grade-letter', text: g }), h('span', { class: 'end-grade-sub', text: '등급' }));
    const penalty = run.penaltyMs || 0;
    const rows = [
      h(
        'div',
        { class: 'end-row' },
        h('span', { text: '걸린 시간' }),
        h('b', { text: clock(res.usedMs) }),
        h('small', { text: penalty ? '힌트·잘못된 고발로 늘어난 ' + clock(penalty) + ' 포함' : '늘어난 시간 없이 이 기록이야' })
      ),
    ];
    if (forced) {
      // 부모가 "찾은 것으로 처리"한 쪽지는 빼고 아이가 찾은 것만 센다 (신문과 같은 수)
      const rescued = new Set((run.events || []).filter((e) => e.type === 'rescue').map((e) => e.tag));
      const found = Object.keys(run.found || {}).filter((id) => !rescued.has(id)).length;
      rows.push(h('div', { class: 'end-row' }, h('span', { text: '찾은 쪽지' }), h('b', { text: found + ' / ' + cs.tags.length })));
      rows.push(h('p', { class: 'end-forced', text: '이번 사건은 부모님과 함께 마무리해서 등급은 C야.' }));
    } else {
      rows.push(h('div', { class: 'end-row' }, h('span', { text: '점수' }), h('b', { text: res.score + '점' })));
      const minus = Object.keys(MINUS_NAMES).filter((k) => res.parts[k] > 0);
      rows.push(
        h(
          'div',
          { class: 'end-minus' },
          minus.length ? minus.map((k) => h('span', { class: 'chip', 'data-part': k, text: MINUS_NAMES[k] + ' −' + res.parts[k] })) : h('span', { class: 'end-perfect', text: '깎인 점수 없음' })
        )
      );
    }
    const node = h(
      'div',
      { class: 'end-page end-gradepage' },
      h('p', { class: 'end-kicker', text: '수사 결과' }),
      big,
      h('h2', { class: 'end-title', text: words.title }),
      h('p', { class: 'end-praise', text: words.line }),
      h('div', { class: 'card end-card' }, rows)
    );
    let shown = false;
    return {
      node,
      enter() {
        if (shown) return;
        shown = true;
        big.classList.add('slam');
        T.after(330, () => {
          audio.sfx('stamp');
          buzz(30);
        });
      },
      state: () => ({ grade: g, score: res.score, minus: Object.keys(MINUS_NAMES).filter((k) => res.parts[k] > 0) }),
    };
  }

  // ---------- 3. 보물 공개 ----------
  function treasurePage() {
    const kind = TREASURE_KINDS.find((k) => k.id === (setup.treasure && setup.treasure.kind)) || TREASURE_KINDS[1];
    const text = ((setup.treasure && setup.treasure.text) || '').trim() || '부모님께 물어봐!';
    const len = Array.from(text).length;
    const size = len <= 6 ? 'xl' : len <= 12 ? 'l' : len <= 24 ? 'm' : 's';
    const bonusText = ((setup.bonus && setup.bonus.text) || '').trim();
    const rule = (setup.bonus && setup.bonus.rule) || 'A';
    const unlocked = bonusText && bonusUnlocked(res.grade, rule);

    const env = h(
      'button',
      { class: 'end-env', type: 'button', 'aria-label': '봉투 열기', onClick: () => open() },
      h('span', { class: 'end-env-back' }),
      h('span', { class: 'end-env-peek' }),
      h('span', { class: 'end-env-front' }),
      h('span', { class: 'end-env-flap' }),
      h('span', { class: 'end-env-seal', text: '탐' })
    );
    const letter = h(
      'div',
      { class: 'end-letter', hidden: true },
      h('p', { class: 'end-letter-lead', text: kind.lead }),
      h('p', { class: 'end-letter-text ' + size + (kind.id === 'lock' ? ' lock' : ''), text: text }),
      forced ? null : h('p', { class: 'end-letter-sign', text: '— ' + josa(culprit.name, '이/가') })
    );
    const bonusBox = h('div', { class: 'end-bonus-slot' });
    const tip = h('p', { class: 'end-tip', text: '봉투를 눌러서 열어 봐' });
    const from = forced ? '부모님이' : josa(culprit.name, '이/가');
    const envBox = h('div', { class: 'end-envbox' }, env, letter);
    const node = h(
      'div',
      { class: 'end-page end-treasure' },
      h('p', { class: 'end-kicker', text: '보물 공개' }),
      h('h2', { class: 'end-title small', text: from + ' 비밀 봉투를 건넸어' }),
      envBox,
      bonusBox,
      tip
    );
    let opened = false;
    let settled = false;
    const ids = [];

    function bonusNode() {
      if (!bonusText) return null;
      // 못 받은 보너스는 문구를 DOM 에 아예 넣지 않는다 (아이가 미리 알면 안 된다)
      if (unlocked) return h('div', { class: 'end-bonus' }, h('p', { class: 'end-bonus-head', text: '🎁 보너스 보상' }), h('p', { class: 'end-bonus-text', text: bonusText }));
      const need = rule === 'S' ? 'S 등급만 받을 수 있어' : 'A 등급부터야';
      return h('div', { class: 'end-bonus locked' }, h('p', { text: '🔒 보너스 보상은 ' + need + '. 다음 사건에서 도전!' }));
    }
    function settle() {
      if (settled) return;
      settled = true;
      ids.forEach((id) => T.cancel(id));
      env.classList.add('open', 'gone');
      env.hidden = true;
      letter.hidden = false;
      letter.classList.add('rise');
      envBox.classList.add('lit');
      tip.hidden = true;
      const b = bonusNode();
      if (b && !bonusBox.firstChild) bonusBox.append(b);
    }
    function open() {
      if (opened) return;
      opened = true;
      env.classList.add('open');
      env.setAttribute('aria-label', '봉투가 열렸어');
      audio.sfx('open');
      ids.push(
        T.after(reducedMotion() ? 0 : 620, () => {
          env.classList.add('gone');
          letter.hidden = false;
          letter.classList.add('rise');
          envBox.classList.add('lit');
          tip.hidden = true;
          audio.sfx('reveal');
          buzz([30, 50, 30]);
        })
      );
      ids.push(
        T.after(reducedMotion() ? 0 : 1100, () => {
          env.hidden = true;
        })
      );
      ids.push(
        T.after(reducedMotion() ? 0 : 1500, () => {
          const b = bonusNode();
          if (b) {
            bonusBox.append(b);
            audio.sfx(unlocked ? 'good' : 'tap');
          }
          settled = true;
        })
      );
    }
    return {
      node,
      leave() {
        if (opened) settle();
      },
      step() {
        if (!opened) {
          open();
          return true;
        }
        if (!settled) {
          settle();
          return true;
        }
        return false;
      },
      state: () => ({ opened, settled, bonus: bonusText ? (unlocked ? 'open' : 'locked') : 'none' }),
    };
  }

  // ---------- 4. 신문 ----------
  function paperPage() {
    const frame = h('div', { class: 'end-paper-frame' }, h('p', { class: 'end-paper-wait', text: '신문을 찍는 중…' }));
    const save = h('a', {
      class: 'btn gold block end-save',
      href: '#',
      role: 'button',
      'aria-disabled': 'true',
      text: '사진으로 저장',
      onClick: (e) => {
        if (save.getAttribute('aria-disabled') === 'true') {
          e.preventDefault();
          return;
        }
        audio.sfx('tap');
      },
    });
    const node = h(
      'div',
      { class: 'end-page end-paper' },
      h('p', { class: 'end-kicker', text: '오늘의 신문' }),
      frame,
      save,
      h('p', { class: 'end-tip small', text: '저장이 안 되면 신문을 길게 눌러서 저장할 수 있어.' })
    );
    let ready = false;
    let paperLayout = null;
    renderNewspaper({ setup, cs, run, grade: res.grade, usedMs: res.usedMs, forced })
      .then((canvas) => {
        paperLayout = canvas.layout || null;
        return canvasBlob(canvas);
      })
      .then((blob) => {
        if (dead || !blob) return;
        paperUrl = URL.createObjectURL(blob);
        fill(frame, h('img', { src: paperUrl, alt: '우리 집 일보 1면' }));
        save.href = paperUrl;
        save.setAttribute('download', '우리집일보-사건' + (setup.caseNo || 1) + '.png');
        save.removeAttribute('aria-disabled');
        ready = true;
      })
      .catch((err) => {
        if (dead) return;
        console.warn('신문을 그리지 못했어요', err);
        fill(frame, h('p', { class: 'end-paper-wait', text: '신문을 만들지 못했어. 다음 장으로 넘어가자.' }));
      });
    return { node, state: () => ({ ready, href: ready ? save.href : null, layout: paperLayout }) };
  }

  // ---------- 5. 마무리 ----------
  function finishPage() {
    const node = h(
      'div',
      { class: 'end-page end-finish' },
      h('div', { class: 'end-finish-icon', 'aria-hidden': 'true', text: '🕵️' }),
      h('h2', { class: 'end-title', text: '수사 끝!' }),
      h('p', { class: 'end-praise', text: '부모님께 폰을 돌려주자.' }),
      h('p', { class: 'end-tip', text: forced ? '오늘 어디까지 수사했는지 이야기해 줘.' : '어떻게 범인을 찾았는지 이야기해 줘.' }),
      h(
        'div',
        { class: 'end-finish-actions' },
        h('button', { class: 'btn gold block end-report', type: 'button', text: '관찰 리포트 보기 (부모)', onClick: () => openReport() }),
        h('button', { class: 'btn primary block end-newcase', type: 'button', text: '새 사건 준비하기', onClick: () => ctx.onNewCase && ctx.onNewCase() }),
        h('button', { class: 'btn ghost block end-home', type: 'button', text: '처음으로', onClick: () => ctx.onHome && ctx.onHome() })
      )
    );
    return { node };
  }

  const builders = { confess: confessPage, grade: gradePage, treasure: treasurePage, paper: paperPage, finish: finishPage };

  function render() {
    const name = names[index];
    let pg = pages.get(name);
    if (!pg) {
      pg = builders[name]();
      pages.set(name, pg);
    }
    stage.replaceChildren(pg.node);
    pg.node.classList.remove('in');
    void pg.node.offsetWidth;
    pg.node.classList.add('in');
    if (pg.enter) pg.enter();
    [...dots.children].forEach((d, i) => d.classList.toggle('on', i === index));
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === names.length - 1;
    nextBtn.style.visibility = index === names.length - 1 ? 'hidden' : '';
    stage.scrollTop = 0;
  }

  function go(i) {
    if (dead || i < 0 || i >= names.length || i === index) return;
    const cur = pages.get(names[index]);
    if (cur && cur.leave) cur.leave();
    index = i;
    audio.sfx('page');
    render();
  }

  /** "다음"과 화면 누르기: 장 안에서 할 일(남은 자백, 봉투 열기)이 있으면 그것부터 */
  function advance() {
    if (dead) return;
    const pg = pages.get(names[index]);
    if (pg && pg.step && pg.step()) return;
    go(index + 1);
  }

  function openReport() {
    if (report) return;
    box.hidden = true;
    report = showReport(root, {
      setup,
      cs,
      run,
      now: ctx.now,
      onBack() {
        if (report) report.destroy();
        report = null;
        box.hidden = false;
      },
    });
  }

  render();
  if (firstVisit) {
    audio.sfx('solved');
    // 첫 장이 그려진 뒤에 크기를 재야 캔버스가 화면에 맞는다
    T.frame(() => {
      if (!dead) stopConfetti = confetti(box, T);
    });
  }

  return {
    destroy() {
      if (dead) return;
      dead = true;
      T.clear();
      stopConfetti();
      root.removeEventListener('pointerdown', unlock);
      if (report) report.destroy();
      report = null;
      box.remove();
      if (paperUrl) URL.revokeObjectURL(paperUrl);
    },
    page() {
      const name = names[index];
      const pg = pages.get(name);
      return { index, name, names: names.slice(), reportOpen: !!report, state: pg && pg.state ? pg.state() : null };
    },
    next: advance,
    prev: () => go(index - 1),
    go,
    timers: () => T.count(),
  };
}
