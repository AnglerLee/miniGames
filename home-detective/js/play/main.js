// 아이 수사 화면(play.html)의 시작점: 설정 읽기 → 표지/브리핑 → 수사 → 결말.
// 진행 상태(run)는 바뀔 때마다 저장하고, 시계는 벽시계 기준이라 꺼져 있던 동안도 흐른다.

import { h, toast, showModal, DEBUG } from '../shared/dom.js';
import { loadSetup, saveSetup, decodeSetup, loadRun, saveRun, clearRun, caseKey, photos } from '../shared/store.js';
import { buildCase } from '../shared/case.js';
import { DIFFICULTY } from '../shared/content.js';
import { newRun } from '../shared/score.js';
import { G, on, emit, commit, log, left, at, discover, markUnseen, suspectTag, heardAll, lastProgressAt } from './game.js';
import { setLayer, closeAll, topOverlay } from './overlay.js';
import { mountHud, hudTick, setRadioBlink } from './hud.js';
import { mountTabs, currentTab } from './tabs.js';
import { showCover, showBriefing } from './brief.js';
import { enterCode } from './pad.js';
import { hear, refreshInterrogate } from './interrogate.js';
import { solveOpenScene, sceneStats } from './evidence.js';
import { applyAccusation, showVerdict, resetWizard } from './accuse.js';
import { openHints, takeHint, nudge } from './hints.js';
import { openMenu, pause } from './parent.js';
import { showEnding } from './ending.js';
import { audio } from './audio.js';

const root = document.getElementById('root');
let loopId = null;
let musicOn = false;
let ending = null;
let wake = null;

boot();

function boot() {
  // 준비되지 않은 화면에서도 검증 스크립트가 상태를 읽을 수 있게 먼저 연다
  if (DEBUG) exposeDebug();
  // 다른 폰에서 받은 설정 (#c=…)
  const m = location.hash.match(/^#c=(.+)$/);
  if (m) {
    const got = decodeSetup(m[1]);
    if (got) {
      got.ready = true;
      saveSetup(got);
    } else toast('사건 링크를 읽지 못했어', 'bad', 3000);
    history.replaceState(null, '', location.pathname + location.search);
  }

  const setup = loadSetup();
  if (!setup || !setup.ready) return showNotReady();
  let cs;
  try {
    cs = buildCase(setup);
  } catch (e) {
    return showNotReady(e.message);
  }
  G.setup = setup;
  G.cs = cs;
  if (!setup.minutes) setup.minutes = (DIFFICULTY[cs.difficulty] || DIFFICULTY[1]).minutes;

  let run = loadRun();
  if (run && run.caseKey !== caseKey(setup)) {
    clearRun();
    run = null;
  }
  G.run = run;
  checkPhotos();
  document.addEventListener('pointerdown', firstTouch, true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && G.run && G.run.phase === 'play') requestWake();
  });
  on('solved', toEnding);

  if (!run) showCover(root, () => showBriefing(root, startInvestigation));
  else if (run.phase === 'play') showPlay();
  else toEnding();
}

function showNotReady(reason) {
  root.replaceChildren(
    h(
      'div',
      { class: 'notready' },
      h(
        'div',
        { class: 'card' },
        h('div', { class: 'nr-icon', text: '🗂️' }),
        h('h2', { text: '아직 사건이 준비되지 않았어' }),
        h('p', { text: '부모님께 준비를 부탁해.' }),
        reason ? h('p', { class: 'soft', text: reason }) : null,
        h('a', { class: 'btn primary block', href: 'setup.html', text: '준비 화면으로 (부모)' }),
        h('a', { class: 'btn ghost block', href: 'index.html', text: '처음으로' })
      )
    )
  );
}

/** 힌트 사진이 이 기기에 실제로 있는지 미리 본다 */
async function checkPhotos() {
  const placed = G.setup.placed || {};
  for (const tag of G.cs.tags) {
    const p = placed[tag.id];
    if (!p || !p.photo) continue;
    try {
      G.photoOk[tag.id] = !!(await photos.url(p.photo));
    } catch (e) {
      G.photoOk[tag.id] = false;
    }
  }
}

function startInvestigation() {
  if (G.run || !G.cs) return;
  const run = newRun(caseKey(G.setup), G.setup.minutes * 60000, Date.now());
  run.phase = 'play';
  run.tab = 'site';
  G.run = run;
  log('start');
  saveRun(run);
  audio.unlock();
  startMusic();
  requestWake();
  showPlay();
}

// ---------- 수사 화면 ----------

function showPlay() {
  const hud = mountHud({ onRadio: openHints, onMenu: openMenu });
  const { main, bar } = mountTabs();
  const layer = h('div', { class: 'ov-layer' });
  setLayer(layer);
  root.replaceChildren(h('div', { class: 'app' }, hud, h('div', { class: 'stage' }, main, bar, layer)));
  if (G.run.pauseAt !== null) pause(true);
  startLoop();
  requestWake();
}

function startLoop() {
  clearInterval(loopId);
  loopId = setInterval(loop, 250);
  loop();
}

function loop() {
  const run = G.run;
  if (!run || run.phase !== 'play') {
    clearInterval(loopId);
    loopId = null;
    return;
  }
  const now = Date.now();
  hudTick(now);

  // 시간이 0 이 되는 순간 한 번. 실패로 끝나지 않고 수사는 계속된다.
  if (!run.late && left(now) <= 0) {
    run.late = true;
    log('late');
    audio.sfx('alarm');
    commit('late');
    showModal({
      title: '⏰ 시간 초과!',
      text: '범인이 간식 상자를 열기 시작했어. 서둘러!',
      body: h('p', { class: 'late-art', text: '🍪💨' }),
      actions: [{ label: '계속 수사하기', value: true, kind: 'primary' }],
    });
  }

  if (run.suspendUntil && now >= run.suspendUntil) {
    run.suspendUntil = 0;
    run.badges = Math.max(1, run.badges);
    commit('unsuspend');
    toast('서장님 보고 끝! 다시 고발할 수 있어', 'good', 3000);
  }

  // 오래 진전이 없으면 무전 버튼이 깜빡이고 한 번만 알려 준다 (내용은 알려 주지 않는다)
  const gap = (DIFFICULTY[G.cs.difficulty] || DIFFICULTY[1]).hintGapSec * 1000;
  const lp = lastProgressAt();
  const idle = run.pauseAt === null && at(now) - lp >= gap;
  if (idle && run.nudged !== lp) {
    run.nudged = lp;
    saveRun(run);
    toast('막히면 무전으로 힌트를 받을 수 있어', '', 3500);
  }
  setRadioBlink(idle && nudge.seenFor !== lp);

  emit('tick', now);
}

function startMusic() {
  if (G.run && G.run.phase === 'play' && G.run.pauseAt === null) {
    audio.music.start();
    musicOn = true;
  }
}

/** 이어 하기로 들어온 경우 소리는 첫 터치 뒤에만 켤 수 있다 */
function firstTouch() {
  audio.unlock();
  if (!musicOn) startMusic();
}

async function requestWake() {
  try {
    if (!('wakeLock' in navigator) || wake || document.visibilityState !== 'visible') return;
    wake = await navigator.wakeLock.request('screen');
    wake.addEventListener('release', () => (wake = null));
  } catch (e) {
    wake = null; // 안 되는 기기
  }
}

// ---------- 결말 ----------

function toEnding() {
  clearInterval(loopId);
  loopId = null;
  closeAll();
  document.querySelectorAll('.verdict, .suspense, .pause-cover, .modal-backdrop').forEach((n) => n.remove());
  document.body.classList.remove('is-paused');
  audio.music.stop();
  musicOn = true; // 결말에서는 음악을 다시 켜지 않는다
  if (wake) wake.release().catch(() => {});
  if (ending) ending.destroy();
  const box = h('div', { class: 'ending-root', id: 'ending' });
  root.replaceChildren(box);
  ending = showEnding(box, {
    setup: G.setup,
    cs: G.cs,
    run: G.run,
    now: Date.now(),
    onNewCase: () => (location.href = 'setup.html'),
    onHome: () => (location.href = 'index.html'),
  });
}

// ---------- 검증용 손잡이 (?debug=1) ----------

function exposeDebug() {
  const playing = () => G.run && G.run.phase === 'play';
  const copy = (v) => JSON.parse(JSON.stringify(v));
  window.__hd = {
    get cs() {
      return G.cs;
    },
    get setup() {
      return G.setup;
    },
    sceneStats,
    state() {
      const run = G.run;
      const top = topOverlay();
      return {
        // 결말 화면이 기록을 마치면 run.phase 를 'end' 로 바꾸지만, 바깥에서는 둘 다 '해결됨'이다
        phase: run ? (run.phase === 'end' ? 'solved' : run.phase) : G.cs ? 'brief' : 'none',
        runPhase: run ? run.phase : null,
        tab: run ? currentTab() : null,
        remainingMs: run ? left() : null,
        badges: run ? run.badges : null,
        found: run ? copy(run.found) : {},
        asked: run ? copy(run.asked) : {},
        hints: run ? copy(run.hints) : [],
        accusations: run ? copy(run.accusations) : [],
        late: run ? run.late : false,
        paused: !!(run && run.pauseAt !== null),
        lockUntil: run ? run.lockUntil : 0,
        suspendUntil: run ? run.suspendUntil : 0,
        overlay: top ? top.name : null,
      };
    },
    start() {
      startInvestigation();
      return window.__hd.state();
    },
    enter(shape, digit) {
      if (!playing()) return null;
      closeAll();
      return enterCode(shape, digit);
    },
    askAll(s) {
      if (!playing()) return null;
      G.cs.slots.forEach((_, t) => hear(s, t));
      refreshInterrogate();
      return heardAll(s);
    },
    solveScene() {
      return solveOpenScene();
    },
    findAll() {
      if (!playing()) return null;
      closeAll();
      const run = G.run;
      for (const tag of G.cs.tags) discover(tag);
      G.cs.suspects.forEach((_, s) => {
        G.cs.slots.forEach((_, t) => {
          const list = run.asked[s] || (run.asked[s] = []);
          if (!list.includes(t)) {
            list.push(t);
            log('asked', { s, t });
          }
        });
        run.found[suspectTag(s).id].done = true;
      });
      G.cs.tags.forEach((tag) => {
        const f = run.found[tag.id];
        if (tag.kind === 'evidence' && !f.done) {
          f.done = true;
          log('scene', { tag: tag.id, misses: f.misses || 0 });
        }
      });
      markUnseen();
      commit('findAll');
      return Object.keys(run.found).length;
    },
    accuse(suspect, slot, item) {
      if (!playing()) return null;
      closeAll();
      const pick = { suspect, slot, item: item || null };
      const result = applyAccusation(pick);
      resetWizard();
      commit('accuse');
      showVerdict(result, pick, { instant: true });
      return result;
    },
    shift(ms) {
      const run = G.run;
      if (!run) return null;
      run.startedAt -= ms;
      // 수사 시간이 흐른 만큼 잠김과 정지도 풀려 가야 한다
      if (run.lockUntil) run.lockUntil -= ms;
      if (run.suspendUntil) run.suspendUntil -= ms;
      commit('shift');
      if (playing()) loop();
      return left();
    },
    hint(kind, level, room) {
      if (!playing()) return null;
      return takeHint(kind, level, room);
    },
    pause() {
      if (playing()) pause();
    },
  };
}
