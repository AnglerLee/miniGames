// 결말 시험대: 가상의 아이가 엔진을 실제로 끝까지 돌려 상태를 만들고, 결말 화면이나 관찰 리포트를 띄운다.
// 검증 스크립트는 ?debug=1 일 때 열리는 window.__end 를 쓴다.
import { defaultSetup, missionKey, loadRun, saveRun, clearRun, KEYS } from '../shared/store.js';
import { makeStations } from '../shared/tags.js';
import { newGame, reduce } from '../shared/engine.js';
import { RULES } from '../shared/score.js';
import { ROOM_PRESETS } from '../shared/content.js';
import { DEBUG, toast } from '../shared/dom.js';
import { showEnding } from './ending.js';
import { audio } from './audio.js';
import { showReport, analyze, outcome } from './report.js';

const q = new URLSearchParams(location.search);
const d = Math.max(0, Math.min(2, Number(q.has('d') ? q.get('d') : 1) | 0));
const seed = Number(q.get('seed') || 7);
const kind = ['clean', 'rough', 'sunk', 'forced'].includes(q.get('case')) ? q.get('case') : 'clean';
const view = q.get('view') === 'report' ? 'report' : 'ending';
const R = Math.max(4, Math.min(6, Number(q.get('rooms') || 5) | 0));

const TREASURE_TEXT = { lock: '3 - 1 - 7', place: '세탁기 안', key: '신발장 둘째 칸', text: '엄마에게 "임무 완료"라고 말하기' };

function makeSetup() {
  const s = defaultSetup();
  s.seed = seed;
  s.tagSeed = seed * 7 + 3;
  s.difficulty = d;
  s.captain = q.has('name') ? q.get('name') : '지우';
  s.rooms = ROOM_PRESETS.slice(0, R).map((r, i) => ({ id: 'r' + (i + 1), name: r.name, icon: r.icon }));
  const tk = TREASURE_TEXT[q.get('treasure')] ? q.get('treasure') : 'place';
  s.treasure = { kind: tk, text: q.has('ttext') ? q.get('ttext') : TREASURE_TEXT[tk] };
  const b = q.get('bonus') || 'A';
  s.bonus = b === 'none' ? { text: '', rule: 'A' } : { text: q.get('btext') || '아이스크림 하나 더', rule: ['A', 'S', 'always'].includes(b) ? b : 'A' };
  const p = q.get('predict');
  if (p === '0') s.predict = null;
  else if (p && p.split(',').length === 3) {
    const [dm, rt, hd] = p.split(',');
    s.predict = { damage: Number(dm), retry: Number(rt), hardest: hd };
  } else s.predict = { damage: 1, retry: 0, hardest: 'deep' };
  s.missionNo = Number(q.get('no') || 3);
  s.placed = Object.fromEntries(s.rooms.map((r) => [r.id, true]).concat([['treasure', true], ['safety', true]]));
  s.ready = true;
  return s;
}

/**
 * 가상의 아이 (tests/engine.test.js 의 play() 와 같은 방식). 급한 경보부터 처리한다.
 *   clean  평소 걸음으로 손상 없이 끝낸다
 *   rough  경보 두 개를 그냥 두고(놓침), 도착 확인을 세 번 틀리고, 좌표를 한 번 틀리고,
 *          크레인 순서를 한 번 틀리고 한 번 다시 보고, 한 번 멈춘다
 *   sunk   심해부터 아무것도 안 하다 가라앉고, 다시 도전해서 끝낸다
 *   forced 심해에서 고장 하나를 고친 뒤 부모가 끝낸다
 */
function play(setup, stations) {
  const env = { stations };
  const w = { hopMs: 12000, taskMs: 9000, checkinMs: 2000, reactMs: 2000 };
  let s = newGame({ seed: setup.seed, difficulty: setup.difficulty, stationCount: stations.length });
  const live = () => ['dock', 'run', 'route'].includes(s.phase);
  const ev = (e) => (s = reduce(s, e, env));
  const wait = (ms) => {
    for (let left = ms; left > 0 && live(); left -= 250) ev({ type: 'tick', dt: Math.min(250, left) });
  };
  const stage = () => s.script && s.script.stage;
  let checkins = 0;
  const wrongAt = new Set([2, 6, 11]);
  const go = (station) => {
    wait(w.hopMs + w.checkinMs);
    if (!live()) return;
    checkins++;
    if (kind === 'rough' && wrongAt.has(checkins)) {
      ev({ type: 'wrongQuery' });
      wait(RULES.wrongQueryLockMs);
      if (!live()) return;
    }
    ev({ type: 'checkin', station });
  };
  const skipped = new Set();
  const skipStages = new Set();
  let forgot = false;
  let routeTricks = 0;
  let paused = false;
  let fixedInDeep = 0;
  let sank = false;

  let guard = 0;
  while (s.phase !== 'done' && guard++ < 6000) {
    if (s.phase === 'intro') ev({ type: 'begin' });
    else if (s.phase === 'clear') ev({ type: 'next' });
    else if (s.phase === 'failed') {
      sank = true;
      ev({ type: 'retry' });
    }
    else if (s.phase === 'dock') go(stations.find((st) => !s.visited.includes(st.idx)).idx);
    else if (s.phase === 'route') {
      if (q.get('rescue') === '1') {
        ev({ type: 'rescue' });
        continue;
      }
      if (s.clock < s.route.shownUntil) wait(s.route.shownUntil - s.clock + 250);
      else if (kind === 'rough' && routeTricks === 0) {
        routeTricks++;
        go((s.route.order[s.route.step] + 1) % stations.length);
      } else if (kind === 'rough' && routeTricks === 1 && s.route.step === 1) {
        routeTricks++;
        ev({ type: 'peek' });
      } else go(s.route.order[s.route.step]);
    } else if (!s.active.length) wait(250);
    else if (kind === 'sunk' && !sank && stage() !== 'dive') wait(1000);
    else {
      if (kind === 'forced' && stage() === 'deep' && fixedInDeep >= 1) {
        ev({ type: 'finish' });
        break;
      }
      if (kind === 'rough' && !paused && stage() === 'deep') {
        paused = true;
        ev({ type: 'pause' });
        ev({ type: 'resume' });
      }
      wait(w.reactMs);
      const a = s.active.slice().sort((x, y) => x.deadline - y.deadline)[0];
      if (!a) continue;
      // 혼자 뜬 가벼운 경보를 단계마다 하나씩, 모두 두 개까지 그냥 둔다 (선체가 남게)
      const lone = s.active.length === 1 && a.kind === 'fix' && a.severity === 1 && stage() !== 'salvage' && !skipStages.has(stage()) && skipStages.size < 2;
      if (kind === 'rough' && (skipped.has(a.id) || lone)) {
        skipped.add(a.id);
        skipStages.add(stage());
        wait(1000);
        continue;
      }
      if (a.kind === 'fix') {
        go(a.station);
        if (!s.active.some((x) => x.id === a.id)) continue;
        wait(w.taskMs);
        ev({ type: 'taskDone', id: a.id });
      } else if (a.kind === 'fetch') {
        go(a.source);
        if (!s.active.some((x) => x.id === a.id)) continue;
        go(a.station);
        if (!s.active.some((x) => x.id === a.id)) continue;
        wait(w.taskMs);
        ev({ type: 'taskDone', id: a.id });
      } else {
        go(a.source);
        if (!s.active.some((x) => x.id === a.id)) continue;
        go(a.station);
        if (!s.active.some((x) => x.id === a.id)) continue;
        if (kind === 'rough' && !forgot) {
          forgot = true;
          ev({ type: 'code', id: a.id, input: a.code.map((c) => (c + 1) % 6) });
        }
        wait(3000);
        ev({ type: 'code', id: a.id, input: a.code.slice() });
      }
      if (stage() === 'deep' && !s.active.some((x) => x.id === a.id)) fixedInDeep++;
    }
  }
  return s;
}

function main() {
  if (q.get('reset') === '1') {
    clearRun();
    try {
      localStorage.removeItem(KEYS.history);
    } catch (e) {
      /* 저장소 없음 */
    }
    // 새로고침 시험에서 다시 지우지 않게 주소에서 뺀다
    q.delete('reset');
    history.replaceState(null, '', location.pathname + '?' + q.toString());
  }
  const setup = makeSetup();
  const stations = makeStations(setup);
  const key = missionKey(setup);
  const saved = loadRun();
  let state;
  if (saved && saved.key === key && saved.state.labCase === kind && saved.state.labRescue === (q.get('rescue') === '1')) state = saved.state;
  else {
    state = play(setup, stations);
    state.labCase = kind;
    state.labRescue = q.get('rescue') === '1';
    saveRun(key, state);
  }

  const root = document.getElementById('root');
  const calls = [];
  const sfx = [];
  if (DEBUG) {
    const real = audio.sfx.bind(audio);
    audio.sfx = (name) => (sfx.push(name), real(name));
  }
  let handle;
  if (view === 'report') {
    handle = showReport(root, { setup, stations, state, onBack: () => (calls.push('back'), toast('돌아가기 (시험대)')) });
  } else {
    handle = showEnding(root, {
      setup,
      stations,
      state,
      markRecorded() {
        state.recorded = true;
        saveRun(key, state);
        calls.push('markRecorded');
      },
      onNewMission: () => (calls.push('newMission'), toast('쪽지 그대로 새 임무 (시험대)')),
      onHome: () => (calls.push('home'), toast('처음으로 (시험대)')),
    });
  }
  if (DEBUG) {
    window.__end = {
      state,
      setup,
      stations,
      calls,
      sfx,
      handle,
      page: () => handle.page && handle.page(),
      next: () => handle.next && handle.next(),
      prev: () => handle.prev && handle.prev(),
      go: (i) => handle.go && handle.go(i),
      timers: () => (handle.timers ? handle.timers() : 0),
      destroy: () => handle.destroy(),
      result: () => outcome(state),
      analyze: () => analyze(setup, stations, state),
    };
  }
}

try {
  main();
} catch (err) {
  console.error(err);
  document.getElementById('root').textContent = '시험대를 띄우지 못했어요: ' + err.message;
}
