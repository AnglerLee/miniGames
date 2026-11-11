// 게임 규칙. 화면 없이 상태만 바꾸는 순수 함수라서 그대로 테스트할 수 있다.
//
//   state = newGame({ seed, difficulty, stationCount })
//   state = reduce(state, event, env)        env: { stations }  (tags.js 의 makeStations 결과)
//
// phase 흐름
//   intro → (begin) → dock | run → [route] → clear → (next) → intro … → done
//   run/route 에서 선체가 0 이 되면 failed → (retry) → intro (같은 단계를 더 넉넉하게)
//
// event
//   { type:'begin' }                 단계 안내를 읽고 시작
//   { type:'tick', dt }              시간이 dt(ms) 흘렀다. 화면이 0.1~0.25초마다 보낸다.
//   { type:'checkin', station }      도착 확인 질문을 맞혔다
//   { type:'wrongQuery' }            도착 확인 질문을 틀렸다
//   { type:'taskDone', id }          수리 놀이를 끝냈다
//   { type:'taskMiss' }              수리 놀이에서 실수했다
//   { type:'code', id, input:[…] }   전달할 암호를 입력했다
//   { type:'next' }                  단계 완료 화면을 넘겼다
//   { type:'retry' }                 실패한 단계를 다시 한다
//   { type:'pause' } { type:'resume' }
//   { type:'rescue' }                부모가 지금 단계를 넘겼다
//   { type:'peek' }                  크레인 순서를 다시 본다 (시간이 깎인다)
//   { type:'finish' }                부모가 임무를 끝냈다 (바로 보물 공개로)

import { DIFFICULTY, STAGES, HOP, CARRY_MAX } from './content.js';
import { buildStage } from './plan.js';

/** 한 번의 tick 에 흐를 수 있는 최대 시간. 탭이 잠들었다 깨도 시간이 한꺼번에 흐르지 않게 한다. */
const MAX_TICK_MS = 1000;
/** 암호나 크레인 순서를 틀렸을 때 깎이는 시간 */
export const WRONG_COST_MS = 5000;
/** 크레인 순서를 시간 안에 못 끝냈을 때 선체 손상 */
const ROUTE_DAMAGE = 2;
/** 묶음이 처음 뜨기 전 잠깐의 여유 */
const FIRST_WAVE_MS = 1500;

export function newGame({ seed, difficulty, stationCount }) {
  const D = DIFFICULTY[difficulty] || DIFFICULTY[1];
  return {
    v: 1,
    seed,
    difficulty: Math.max(0, Math.min(2, difficulty | 0)),
    stationCount,
    stage: 0,
    phase: 'intro',
    clock: 0,
    stageStartedAt: 0,
    hull: D.hull,
    hullMax: D.hull,
    hopMs: HOP.defaultMs,
    hopSamples: [],
    lastCheckin: null, // { station, at }
    visited: [],
    script: null,
    wave: 0,
    waveAt: null,
    active: [], // [{ …경보, spawnedAt, deadline, hasPart, sawCode, seenAt, tries, pair }]
    carrying: [],
    route: null, // { order, step, shownUntil, deadline, limitMs, showMs, wrong }
    ease: 0,
    retries: 0,
    paused: false,
    stats: {
      checkins: 0,
      wrongQueries: 0,
      taskMisses: 0,
      damage: 0,
      relayWrong: 0,
      routeWrong: 0,
      rescues: 0,
      pauses: 0,
      resolved: [], // { id, kind, stage, tookMs, limitMs }
      missed: [], // { id, kind, stage, severity }
      doubles: [], // { stage, urgentFirst }
      hops: [], // { stage, ms }
      stages: [], // { id, ms, retries }
    },
    log: [], // { at, type, … }  관찰 리포트가 읽는다
  };
}

const stageId = (s) => STAGES[s.stage].id;
const clone = (s) => JSON.parse(JSON.stringify(s));
const log = (s, type, extra = {}) => s.log.push(Object.assign({ at: s.clock, stage: stageId(s), type }, extra));

function median(list) {
  const a = list.slice().sort((x, y) => x - y);
  return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
}

function startStage(s, env) {
  s.active = [];
  s.carrying = [];
  s.route = null;
  s.wave = 0;
  s.waveAt = null;
  s.stageStartedAt = s.clock;
  const id = stageId(s);
  if (id === 'dock') {
    s.visited = [];
    s.script = null;
    s.phase = 'dock';
  } else {
    s.script = buildStage(id, { seed: s.seed, difficulty: s.difficulty, stations: env.stations, hopMs: s.hopMs, ease: s.ease });
    s.waveAt = s.clock + FIRST_WAVE_MS;
    s.phase = 'run';
  }
  log(s, 'stage', { ease: s.ease });
}

function damage(s, amount) {
  s.hull = Math.max(0, s.hull - amount);
  s.stats.damage += amount;
  if (s.hull <= 0) {
    s.phase = 'failed';
    s.active = [];
    s.carrying = [];
    s.route = null;
    s.waveAt = null;
    log(s, 'failed');
    return true;
  }
  return false;
}

function clearStage(s) {
  s.phase = 'clear';
  s.active = [];
  s.route = null;
  s.waveAt = null;
  s.stats.stages.push({ id: stageId(s), ms: s.clock - s.stageStartedAt, retries: s.ease });
  log(s, 'clear');
}

function resolve(s, alert) {
  const mate = s.active.find((a) => a.id !== alert.id && a.pair === alert.pair);
  if (mate) s.stats.doubles.push({ stage: stageId(s), urgentFirst: alert.deadline <= mate.deadline });
  if (alert.part) {
    const i = s.carrying.indexOf(alert.part);
    if (i >= 0) s.carrying.splice(i, 1);
  }
  s.active = s.active.filter((a) => a.id !== alert.id);
  s.stats.resolved.push({ id: alert.id, kind: alert.kind, stage: stageId(s), tookMs: s.clock - alert.spawnedAt, limitMs: alert.limitMs });
  log(s, 'resolve', { id: alert.id, kind: alert.kind, station: alert.station, tookMs: s.clock - alert.spawnedAt });
}

function tick(s, dt) {
  if (s.paused || !['dock', 'run', 'route'].includes(s.phase)) return;
  s.clock += Math.max(0, Math.min(MAX_TICK_MS, dt));
  if (s.phase === 'run') {
    for (const a of s.active.filter((x) => x.deadline <= s.clock)) {
      s.stats.missed.push({ id: a.id, kind: a.kind, stage: stageId(s), severity: a.severity });
      log(s, 'miss', { id: a.id, kind: a.kind, station: a.station, severity: a.severity });
      if (a.part && a.hasPart) {
        const i = s.carrying.indexOf(a.part);
        if (i >= 0) s.carrying.splice(i, 1);
      }
      s.active = s.active.filter((x) => x.id !== a.id);
      if (damage(s, a.severity)) return;
    }
    if (s.active.length === 0) {
      if (s.waveAt === null) {
        if (s.wave < s.script.waves.length) s.waveAt = s.clock + s.script.waves[s.wave].gapMs;
        else if (s.script.route) {
          const r = s.script.route;
          s.route = { order: r.order.slice(), step: 0, shownUntil: s.clock + r.showMs, deadline: s.clock + r.showMs + r.limitMs, limitMs: r.limitMs, showMs: r.showMs, wrong: 0 };
          s.phase = 'route';
          log(s, 'route');
        } else clearStage(s);
      } else if (s.clock >= s.waveAt) {
        const wave = s.script.waves[s.wave];
        s.active = wave.alerts.map((a) =>
          Object.assign({}, a, { spawnedAt: s.clock, deadline: s.clock + a.limitMs, hasPart: false, sawCode: false, seenAt: null, tries: 0, pair: s.wave })
        );
        log(s, 'wave', { ids: wave.alerts.map((a) => a.id) });
        s.wave++;
        s.waveAt = null;
      }
    }
  } else if (s.phase === 'route' && s.clock >= s.route.deadline) {
    log(s, 'routeMiss');
    if (damage(s, ROUTE_DAMAGE)) return;
    // 순서를 다시 보여 주고 처음부터
    s.route.step = 0;
    s.route.shownUntil = s.clock + s.route.showMs;
    s.route.deadline = s.clock + s.route.showMs + s.route.limitMs;
  }
}

function checkin(s, station) {
  if (!['dock', 'run', 'route'].includes(s.phase)) return;
  s.stats.checkins++;
  if (s.lastCheckin && s.lastCheckin.station !== station) {
    const ms = s.clock - s.lastCheckin.at;
    s.stats.hops.push({ stage: stageId(s), ms });
    if (s.phase === 'dock') s.hopSamples.push(ms);
  }
  s.lastCheckin = { station, at: s.clock };
  log(s, 'checkin', { station });

  if (s.phase === 'dock') {
    if (!s.visited.includes(station)) s.visited.push(station);
    if (s.visited.length >= s.stationCount) {
      // 걸음 기준: 구역 사이를 옮겨 다닌 시간의 가운데 값
      if (s.hopSamples.length) s.hopMs = Math.round(Math.max(HOP.minMs, Math.min(HOP.maxMs, median(s.hopSamples))));
      clearStage(s);
    }
    return;
  }
  if (s.phase === 'run') {
    for (const a of s.active) {
      if (a.kind === 'fetch' && a.source === station && !a.hasPart && s.carrying.length < CARRY_MAX) {
        a.hasPart = true;
        s.carrying.push(a.part);
        log(s, 'pick', { id: a.id, part: a.part });
      }
      if (a.kind === 'relay' && a.source === station) {
        a.sawCode = true;
        a.seenAt = s.clock;
        log(s, 'see', { id: a.id });
      }
    }
    return;
  }
  // 크레인 순서
  const r = s.route;
  if (station === r.order[r.step]) {
    r.step++;
    log(s, 'routeStep', { step: r.step });
    if (r.step >= r.order.length) clearStage(s);
  } else {
    r.wrong++;
    s.stats.routeWrong++;
    r.deadline -= WRONG_COST_MS;
    log(s, 'routeWrong', { station });
  }
}

/** 상태를 바꾸지 않고 새 상태를 돌려준다 */
export function reduce(state, event, env) {
  const s = clone(state);
  switch (event.type) {
    case 'begin':
      if (s.phase === 'intro') startStage(s, env);
      break;
    case 'tick':
      tick(s, event.dt);
      break;
    case 'checkin':
      checkin(s, event.station);
      break;
    case 'wrongQuery':
      s.stats.wrongQueries++;
      log(s, 'wrongQuery');
      break;
    case 'taskMiss':
      s.stats.taskMisses++;
      break;
    case 'taskDone': {
      const a = s.active.find((x) => x.id === event.id);
      if (a && s.phase === 'run' && a.task && (a.kind !== 'fetch' || a.hasPart)) resolve(s, a);
      break;
    }
    case 'code': {
      const a = s.active.find((x) => x.id === event.id);
      if (!a || s.phase !== 'run' || a.kind !== 'relay') break;
      const ok = Array.isArray(event.input) && event.input.length === a.code.length && event.input.every((v, i) => v === a.code[i]);
      if (ok) resolve(s, a);
      else {
        a.tries++;
        s.stats.relayWrong++;
        a.deadline -= WRONG_COST_MS;
        log(s, 'codeWrong', { id: a.id });
      }
      break;
    }
    case 'next':
      if (s.phase === 'clear') {
        s.ease = 0;
        if (s.stage >= STAGES.length - 1) {
          s.phase = 'done';
          log(s, 'done');
        } else {
          s.stage++;
          s.phase = 'intro';
        }
      }
      break;
    case 'retry':
      if (s.phase === 'failed') {
        s.ease++;
        s.retries++;
        s.hull = s.hullMax;
        s.phase = 'intro';
        log(s, 'retry');
      }
      break;
    case 'pause':
      if (!s.paused) {
        s.paused = true;
        s.stats.pauses++;
        log(s, 'pause');
      }
      break;
    case 'resume':
      s.paused = false;
      break;
    case 'rescue':
      if (['dock', 'run', 'route', 'failed'].includes(s.phase)) {
        s.stats.rescues++;
        log(s, 'rescue');
        if (s.hull <= 0) s.hull = 1;
        clearStage(s);
      }
      break;
    case 'peek':
      if (s.phase === 'route' && s.clock >= s.route.shownUntil) {
        s.route.shownUntil = s.clock + Math.round(s.route.showMs / 2);
        s.route.deadline -= WRONG_COST_MS;
        s.route.peeks = (s.route.peeks || 0) + 1;
        s.stats.routeWrong++;
        log(s, 'peek');
      }
      break;
    case 'finish':
      if (s.phase !== 'done') {
        s.forced = true;
        s.active = [];
        s.route = null;
        s.phase = 'done';
        log(s, 'finish');
      }
      break;
    default:
      break;
  }
  return s;
}

/**
 * 방금 도착한 구역에서 할 수 있는 일들. 화면은 이것을 보고 수리 놀이나 암호 판을 띄운다.
 * 돌려주는 값: [{ type, alert? }]
 *   'task'      수리 놀이를 시작할 수 있다
 *   'needPart'  부품이 없어서 못 고친다 (창고에 다녀와야 한다)
 *   'picked'    이 창고에서 부품을 챙겼다
 *   'full'      손이 꽉 차서 부품을 더 못 든다
 *   'showCode'  전달할 암호를 보여 준다
 *   'enterCode' 외워 온 암호를 입력한다
 *   'needCode'  아직 암호를 보지 않았다
 *   'idle'      이 구역에는 할 일이 없다
 */
export function actionsAt(state, station) {
  const out = [];
  if (state.phase !== 'run') return out;
  for (const a of state.active) {
    if (a.kind === 'fix' && a.station === station) out.push({ type: 'task', alert: a });
    if (a.kind === 'fetch') {
      if (a.station === station) out.push({ type: a.hasPart ? 'task' : 'needPart', alert: a });
      if (a.source === station) out.push({ type: a.hasPart ? 'picked' : 'full', alert: a });
    }
    if (a.kind === 'relay') {
      if (a.source === station) out.push({ type: 'showCode', alert: a });
      if (a.station === station) out.push({ type: a.sawCode ? 'enterCode' : 'needCode', alert: a });
    }
  }
  if (!out.length) out.push({ type: 'idle' });
  return out;
}

/** 경보의 남은 시간 (ms) */
export function remaining(state, alert) {
  return Math.max(0, alert.deadline - state.clock);
}

/** 가장 급한 정도 0~1 (음악과 화면 긴장에 쓴다) */
export function urgency(state) {
  let u = 0;
  for (const a of state.active) u = Math.max(u, 1 - remaining(state, a) / a.limitMs);
  if (state.phase === 'route' && state.route && state.clock >= state.route.shownUntil) {
    u = Math.max(u, 1 - Math.max(0, state.route.deadline - state.clock) / state.route.limitMs);
  }
  return Math.max(0, Math.min(1, u));
}

/** 지금 수심 (m). 단계 안에서는 진행에 따라 조금씩 바뀐다. */
export function depth(state) {
  const cur = STAGES[state.stage];
  const prev = state.stage > 0 ? STAGES[state.stage - 1].depth : 0;
  if (state.phase === 'intro') return prev;
  if (state.phase === 'clear' || state.phase === 'done') return cur.depth;
  const total = state.script ? state.script.waves.length + (state.script.route ? 1 : 0) : 1;
  const doneWaves = state.script ? Math.max(0, state.wave - (state.active.length ? 1 : 0)) : 0;
  return Math.round(prev + ((cur.depth - prev) * doneWaves) / Math.max(1, total));
}
