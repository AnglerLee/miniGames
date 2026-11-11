// 단계별 임무(경보 묶음)를 만든다. 씨앗과 아이의 걸음(hopMs)만으로 같은 임무가 다시 만들어진다.
//
// 경보 kind
//   fix    그 구역에 가서 수리 놀이를 한다 (걸음 1번)
//   fetch  부품 창고에서 부품을 챙긴 뒤 그 구역에 가서 수리한다 (걸음 2번)
//   relay  source 구역에서 기호 암호를 보고 외워, 그 구역에 가서 입력한다 (걸음 2번)
//
// 제한 시간은 "걸음 수 × hopMs × 여유 배수 + 도착 확인 + 수리 시간 + 반응 시간" 이다.
// 두 경보가 함께 뜨면 급한 것부터 차례로 하면 둘 다 해낼 수 있게 두 번째 경보에 첫 번째의 시간을 더한다.

import { stream } from './prng.js';
import { DIFFICULTY, PROBLEMS, STAGES, RELAY_SYMBOLS, TASK_ALLOW_MS, REACT_MS, CHECKIN_MS } from './content.js';

/** 다시 도전할 때마다 여유가 이만큼씩 는다 (저장소 규칙: 재도전하면 쉬워진다) */
const EASE_STEP = 0.18;
/** 마지막 단계는 조금 더 빡빡하다 */
const RISE_TIGHT = 0.92;
/** 경보 묶음 사이에 숨 돌릴 시간 */
const GAP_MS = [3500, 3000, 2500];

const stageIndex = (id) => STAGES.findIndex((s) => s.id === id);

/** 걸음 n 번과 수리 한 번에 드는 넉넉한 시간 */
function allowance(hops, hopMs, factor, withTask) {
  return Math.round(hops * (hopMs * factor + CHECKIN_MS) + (withTask ? TASK_ALLOW_MS : 6000));
}

function pickProblem(rng, station, usedTasks, allowPart) {
  const list = PROBLEMS[station.role.id].filter((p) => allowPart || !p.part);
  // 아직 덜 나온 수리 놀이를 먼저 고른다 (여섯 가지가 고루 나오게)
  const min = Math.min(...list.map((p) => usedTasks[p.task] || 0));
  const p = rng.pick(list.filter((q) => (usedTasks[q.task] || 0) === min));
  usedTasks[p.task] = (usedTasks[p.task] || 0) + 1;
  return p;
}

/**
 * 한 단계의 임무를 만든다.
 * ctx: { seed, difficulty, stations, hopMs, ease }   ease: 이 단계를 다시 하는 횟수
 * 결과: { stage, waves:[{ gapMs, alerts:[…] }], route: null | { order:[구역 번호…], showMs, limitMs } }
 *   alert: { id, kind, station, source, task, title, part, code, severity, limitMs }
 */
export function buildStage(stageId, ctx) {
  const D = DIFFICULTY[ctx.difficulty] || DIFFICULTY[1];
  const si = stageIndex(stageId);
  const stations = ctx.stations;
  const N = stations.length;
  const rng = stream(ctx.seed, 'stage', stageId, ctx.ease || 0);
  if (stageId === 'dock') return { stage: stageId, waves: [], route: null };

  const k = si - 1; // 난이도 표의 칸 (잠항 0, 심해 1, 인양 2, 부상 3)
  const waveCount = D.waves[k];
  const factor = D.factor * (1 + EASE_STEP * (ctx.ease || 0)) * (stageId === 'rise' ? RISE_TIGHT : 1);
  const storage = stations.findIndex((s) => s.role.id === 'storage');
  const usedTasks = {};
  let serial = 0;
  let last = -1;

  const target = (avoid) => {
    const pool = stations.map((s) => s.idx).filter((i) => !avoid.includes(i));
    return rng.pick(pool);
  };

  const makeAlert = (kind, avoid) => {
    const id = stageId + '-' + ++serial;
    if (kind === 'relay') {
      const station = target(avoid);
      const source = target(avoid.concat(station));
      const code = Array.from({ length: D.relayLen }, () => rng.int(RELAY_SYMBOLS.length));
      return {
        id, kind, station, source, task: null, part: null, code, severity: 1,
        title: stations[source].role.name + '의 좌표를 ' + stations[station].role.name + '에 전달하라',
        limitMs: allowance(2, ctx.hopMs, factor, false) + D.showMs + REACT_MS,
      };
    }
    if (kind === 'fetch') {
      const pool = stations.filter((s) => s.idx !== storage && !avoid.includes(s.idx) && PROBLEMS[s.role.id].some((p) => p.part));
      const st = rng.pick(pool.length ? pool : stations.filter((s) => s.idx !== storage));
      const withPart = PROBLEMS[st.role.id].filter((p) => p.part);
      const p = rng.pick(withPart);
      usedTasks[p.task] = (usedTasks[p.task] || 0) + 1;
      return {
        id, kind, station: st.idx, source: storage, task: p.task, part: p.part, code: null, severity: 2,
        title: p.title, limitMs: allowance(2, ctx.hopMs, factor, true) + REACT_MS,
      };
    }
    const station = target(avoid);
    const p = pickProblem(rng, stations[station], usedTasks, false);
    return {
      id, kind: 'fix', station, source: -1, task: p.task, part: null, code: null, severity: 1,
      title: p.title, limitMs: allowance(1, ctx.hopMs, factor, true) + REACT_MS,
    };
  };

  // 단계마다 나오는 경보 종류
  const kindsFor = { dive: ['fix'], deep: ['fix', 'fix', 'fetch'], salvage: ['relay'], rise: ['fix', 'fetch', 'relay'] }[stageId];
  // 판마다 경보 종류를 먼저 정한다. 심해에서는 부품 경보가 한 번은 나오게 한다
  const kinds = [];
  let fetchSeen = stageId !== 'deep';
  // 처음 나오는 종류는 혼자 나오게 한다: 심해의 첫 부품 경보, 인양의 첫 전달. 그 판은 겹치기에서 뺀다
  let intro = stageId === 'salvage' ? 0 : -1;
  for (let w = 0; w < waveCount; w++) {
    let kind = rng.pick(kindsFor);
    if (stageId === 'deep' && !fetchSeen && w === waveCount - 1) kind = 'fetch';
    if (kind === 'fetch' && !fetchSeen) {
      fetchSeen = true;
      intro = w;
    }
    kinds.push(kind);
  }
  const pool = [...Array(waveCount).keys()].filter((w) => w !== intro);
  const doubles = new Set(rng.sample(pool, Math.min(D.doubles[k], pool.length)));
  const waves = [];
  for (let w = 0; w < waveCount; w++) {
    const alerts = [];
    const kind = kinds[w];
    const first = makeAlert(kind, last >= 0 ? [last] : []);
    alerts.push(first);
    if (doubles.has(w) && N >= 3) {
      // 함께 뜨는 두 번째 경보: 다른 구역, 더 느긋하지만 놓치면 더 아프다
      const avoid = [first.station].concat(first.source >= 0 ? [first.source] : []);
      const second = makeAlert(stageId === 'salvage' ? 'relay' : 'fix', avoid);
      second.severity = 2;
      first.severity = 1;
      second.limitMs += first.limitMs - REACT_MS;
      alerts.push(second);
    }
    last = alerts[alerts.length - 1].station;
    waves.push({ gapMs: GAP_MS[ctx.difficulty] || GAP_MS[1], alerts });
  }

  let route = null;
  if (stageId === 'salvage') {
    // 크레인 순서: 같은 구역이 연달아 나오지 않게
    const order = [];
    for (let i = 0; i < D.routeLen; i++) {
      order.push(target(order.length ? [order[order.length - 1]] : last >= 0 ? [last] : []));
    }
    route = { order, showMs: D.showMs + 1000, limitMs: allowance(D.routeLen, ctx.hopMs, factor, false) + REACT_MS };
  }
  return { stage: stageId, waves, route };
}

/**
 * 가장 빠듯한 걸음으로 모든 경보를 해낼 수 있는지 따져 본다 (테스트용).
 * 급한 것부터 차례로 하는 아이를 흉내 낸다. hopMs 는 아이의 실제 걸음, taskMs 는 수리에 걸리는 시간.
 * 결과: { ok, worstSlackMs }
 */
export function simulate(script, walker) {
  let worst = Infinity;
  for (const wave of script.waves) {
    let t = walker.reactMs;
    const sorted = wave.alerts.slice().sort((a, b) => a.limitMs - b.limitMs);
    for (const a of sorted) {
      const hops = a.kind === 'fix' ? 1 : 2;
      t += hops * (walker.hopMs + walker.checkinMs) + (a.task ? walker.taskMs : walker.codeMs);
      worst = Math.min(worst, a.limitMs - t);
    }
  }
  if (script.route) {
    const t = walker.reactMs + script.route.order.length * (walker.hopMs + walker.checkinMs);
    worst = Math.min(worst, script.route.limitMs - t);
  }
  return { ok: worst >= 0, worstSlackMs: worst };
}
