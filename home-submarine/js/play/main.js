// 아이 임무 화면(play.html)의 시작점.
// 설정 읽기 → 저장된 진행 복구(멈춘 채로) → 단계마다 화면 바꾸기 → 결말.
// 상태는 엔진이 전부 갖고, 화면은 send(event) 로만 바꾼 뒤 그 결과를 그린다.

import { h, DEBUG, toast } from '../shared/dom.js';
import { loadSetup, saveSetup, decodeSetup, loadRun, clearRun, missionKey } from '../shared/store.js';
import { makeStations } from '../shared/tags.js';
import { newGame } from '../shared/engine.js';
import { G, on, send, save, timed } from './game.js';
import { closeAll, setHost, updateOverlays } from './overlay.js';
import { mountHud } from './hud.js';
import { mountCenter } from './center.js';
import { mountStations } from './stations.js';
import { openQuery, resetQueries } from './query.js';
import { cancelArrival } from './arrive.js';
import { briefScreen, stageIntroScreen, clearScreen, failedScreen, notReadyScreen } from './stage.js';
import { openMenu, pauseGame, syncPause } from './menu.js';
import { handleChange, frameEffects } from './effects.js';
import { requestWake, releaseWake, onVisible } from './device.js';
import { exposeDebug } from './debug.js';
import { showEnding } from './ending.js';
import { audio } from './audio.js';

const TICK_MS = 150;
const SAVE_EVERY_MS = 5000;

const root = document.getElementById('root');
let screenKey = null;
let mission = null;
let ending = null;
let loopId = null;

boot();

function boot() {
  // 준비 안 된 화면에서도 검사가 상태를 읽을 수 있게 먼저 연다
  if (DEBUG) exposeDebug({ startStage, onNext, onRetry });
  // 다른 기기에서 받은 임무 링크 (#c=…): 이 기기에 저장하고 주소에서 지운다.
  // 같은 링크를 다시 열면 같은 임무라서 하던 데서 이어진다.
  const m = location.hash.match(/^#c=(.+)$/);
  if (m) {
    const got = decodeSetup(m[1]);
    if (got) saveSetup(got);
    else toast('임무 링크를 읽지 못했어요', 'bad', 3000);
    history.replaceState(null, '', location.pathname + location.search);
  }
  const setup = loadSetup();
  if (!setup || !setup.ready) {
    root.replaceChildren(notReadyScreen());
    return;
  }
  G.setup = setup;
  G.stations = makeStations(setup);
  G.key = missionKey(setup);

  const run = loadRun();
  let restored = null;
  if (run && run.key === G.key) restored = run.state;
  else if (run) clearRun(); // 다른 임무의 저장은 버린다
  G.state = restored || newGame({ seed: setup.seed, difficulty: setup.difficulty, stationCount: G.stations.length });
  // 새로고침해도 방금과 같은 질문이 되풀이되지 않게 질문 번호를 이어 간다
  resetQueries(G.state.stats.checkins + G.state.stats.wrongQueries);

  on('change', (c) => {
    handleChange(c);
    render();
  });
  // 모바일은 터치한 뒤에만 소리가 난다
  document.addEventListener('pointerdown', () => audio.unlock(), true);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', save);
  startLoop();

  // 시간이 흐르던 단계에서 다시 열었으면 멈춘 채로 연다. "이어 하기"를 눌러야 시간이 간다.
  if (restored && timed() && !restored.paused) send({ type: 'pause' });
  else render();
}

function startLoop() {
  let last = performance.now();
  let lastSave = last;
  loopId = setInterval(() => {
    const now = performance.now();
    const dt = now - last;
    last = now;
    if (G.manual || !timed() || G.state.paused) return;
    send({ type: 'tick', dt });
    if (now - lastSave >= SAVE_EVERY_MS) {
      lastSave = now;
      save();
    }
  }, TICK_MS);
}

function onVisibility() {
  if (document.visibilityState === 'hidden') {
    // 가려지면 멈춘다. 돌아와도 저절로 풀지 않는다 (아이가 준비됐을 때 이어 하기)
    pauseGame();
    save();
  } else onVisible();
}

// ---------- 그리기 ----------

function render() {
  const s = G.state;
  const key = s.phase === 'done' ? 'done' : timed(s) ? 'mission' : s.phase + ':' + s.stage;
  if (key !== screenKey) {
    screenKey = key;
    mountScreen();
  }
  if (mission) {
    mission.hud.update(s);
    mission.center.update(s);
    mission.bar.update(s);
  }
  updateOverlays(s);
  syncPause();
  frameEffects(s);
}

function mountScreen() {
  const s = G.state;
  // 단계가 바뀌면 판은 모두 닫는다. 마지막 "수리 완료" 알림만 단계 완료 화면 위에서 마저 보여 준다.
  cancelArrival(s.phase === 'clear');
  closeAll('stage');
  setHost('stage', null);
  mission = null;
  if (s.phase === 'done') return toEnding();
  if (timed(s)) return mountMission();
  if (s.phase === 'intro') root.replaceChildren(s.stage === 0 ? briefScreen(startStage) : stageIntroScreen(s, startStage));
  else if (s.phase === 'clear') root.replaceChildren(clearScreen(s, onNext));
  else root.replaceChildren(failedScreen(s, onRetry));
}

function mountMission() {
  const hud = mountHud({ onMenu: openMenu, onPause: pauseGame });
  const center = mountCenter();
  const bar = mountStations(openQuery);
  const layer = h('div', { class: 'ov-layer' });
  setHost('stage', layer);
  root.replaceChildren(h('div', { class: 'mission' }, hud.el, h('div', { class: 'deck' }, center.el, bar.el, layer)));
  mission = { hud, center, bar };
}

// ---------- 버튼 ----------

/** "출항 준비"와 단계 안내의 "시작" */
function startStage() {
  if (!G.state || G.state.phase !== 'intro') return;
  audio.unlock();
  audio.music.start();
  requestWake();
  // 부모 메뉴로 단계를 넘기면 멈춘 표시가 남아 있을 수 있다
  if (G.state.paused) send({ type: 'resume' });
  send({ type: 'begin' });
}

function onNext() {
  if (G.state && G.state.phase === 'clear') send({ type: 'next' });
}

function onRetry() {
  if (G.state && G.state.phase === 'failed') send({ type: 'retry' });
}

// ---------- 결말 ----------

function toEnding() {
  closeAll();
  clearInterval(loopId);
  loopId = null;
  document.body.classList.remove('is-danger', 'is-paused');
  audio.music.stop();
  releaseWake();
  if (ending) ending.destroy();
  const box = h('div', { class: 'ending-root', id: 'ending' });
  root.replaceChildren(box);
  ending = showEnding(box, {
    setup: G.setup,
    stations: G.stations,
    state: G.state,
    markRecorded() {
      G.state.recorded = true;
      save();
    },
    // 대문이 #again 을 받으면 쪽지는 그대로 두고 새 임무를 바로 연다
    onNewMission: () => (location.href = 'index.html#again'),
    onHome: () => (location.href = 'index.html'),
  });
}
