// 규칙 엔진과 임무 생성 검증. 화면 없이 "가상의 아이"가 끝까지 해 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeStations, makeQuery, checkAnswer, tagText } from '../js/shared/tags.js';
import { buildStage, simulate } from '../js/shared/plan.js';
import { newGame, reduce, actionsAt, urgency, depth, WRONG_COST_MS } from '../js/shared/engine.js';
import { computeScore, bonusUnlocked, summarize, clock } from '../js/shared/score.js';
import { ROOM_PRESETS, DIFFICULTY, STAGES, PROBLEMS, TASKS, PARTS, CARRY_MAX, HOP } from '../js/shared/content.js';
import { makeRng } from '../js/shared/prng.js';
import { alertGuide, stationLabel, briefing, howTo, stageTitle, gradeLine, headline, josa } from '../js/shared/text.js';
import { defaultSetup, missionKey } from '../js/shared/store.js';

const setupOf = (R, tagSeed = 77, extra = {}) =>
  Object.assign({ tagSeed, rooms: ROOM_PRESETS.slice(0, R).map((r, i) => ({ id: 'r' + (i + 1), ...r })) }, extra);

/**
 * 가상의 아이. 급한 경보부터 처리한다.
 *   hopMs  한 번 이동하는 데 걸리는 시간, taskMs 수리 시간, forget 암호를 틀리는 횟수
 */
function play(seed, difficulty, R, walker = {}) {
  const w = Object.assign({ hopMs: 12000, taskMs: 9000, checkinMs: 2000, reactMs: 2000, forget: 0, lazy: false }, walker);
  const stations = makeStations(setupOf(R));
  const env = { stations };
  let s = newGame({ seed, difficulty, stationCount: R });
  const wait = (ms) => {
    for (let left = ms; left > 0 && ['dock', 'run', 'route'].includes(s.phase); left -= 250) s = reduce(s, { type: 'tick', dt: Math.min(250, left) }, env);
  };
  const go = (station) => {
    wait(w.hopMs + w.checkinMs);
    if (['dock', 'run', 'route'].includes(s.phase)) s = reduce(s, { type: 'checkin', station }, env);
  };
  let guard = 0;
  while (s.phase !== 'done' && guard++ < 4000) {
    if (s.phase === 'intro') s = reduce(s, { type: 'begin' }, env);
    else if (s.phase === 'clear') s = reduce(s, { type: 'next' }, env);
    else if (s.phase === 'failed') {
      if (w.giveUp) break;
      s = reduce(s, { type: 'retry' }, env);
    } else if (s.phase === 'dock') {
      const nextStation = stations.find((st) => !s.visited.includes(st.idx));
      go(nextStation.idx);
    } else if (s.phase === 'route') {
      if (s.clock < s.route.shownUntil) wait(s.route.shownUntil - s.clock);
      else go(s.route.order[s.route.step]);
    } else if (!s.active.length) wait(250);
    else if (w.lazy) wait(1000);
    else {
      wait(w.reactMs);
      const a = s.active.slice().sort((x, y) => x.deadline - y.deadline)[0];
      if (!a) continue;
      if (a.kind === 'fix') {
        go(a.station);
        if (!s.active.some((x) => x.id === a.id)) continue;
        assert.ok(actionsAt(s, a.station).some((act) => act.type === 'task' && act.alert.id === a.id));
        wait(w.taskMs);
        s = reduce(s, { type: 'taskDone', id: a.id }, env);
      } else if (a.kind === 'fetch') {
        go(a.source);
        if (!s.active.some((x) => x.id === a.id)) continue;
        assert.ok(s.active.find((x) => x.id === a.id).hasPart, '창고에서 부품을 챙긴다');
        go(a.station);
        if (!s.active.some((x) => x.id === a.id)) continue;
        wait(w.taskMs);
        s = reduce(s, { type: 'taskDone', id: a.id }, env);
      } else {
        go(a.source);
        if (!s.active.some((x) => x.id === a.id)) continue;
        go(a.station);
        if (!s.active.some((x) => x.id === a.id)) continue;
        assert.ok(actionsAt(s, a.station).some((act) => act.type === 'enterCode'));
        for (let i = 0; i < w.forget; i++) s = reduce(s, { type: 'code', id: a.id, input: a.code.map((c) => (c + 1) % 6) }, env);
        wait(3000);
        s = reduce(s, { type: 'code', id: a.id, input: a.code.slice() }, env);
      }
    }
  }
  return s;
}

test('구역 쪽지: 모양이 겹치지 않고 숫자 네 개가 서로 다르다', () => {
  for (const R of [4, 5, 6]) {
    for (let seed = 1; seed <= 300; seed++) {
      const st = makeStations(setupOf(R, seed));
      assert.equal(st.length, R);
      assert.equal(new Set(st.map((x) => x.shape)).size, R);
      assert.equal(new Set(st.map((x) => x.role.id)).size, R);
      assert.ok(st.some((x) => x.role.id === 'storage'), '부품 창고는 늘 있다');
      for (const x of st) {
        assert.equal(x.digits.length, 4);
        assert.equal(new Set(x.digits).size, 4);
        assert.ok(x.digits.every((d) => d >= 1 && d <= 9));
        assert.match(tagText(x), /^[●▲■★♥◆] \d \d \d \d$/);
      }
    }
  }
});

test('구역 쪽지: 같은 tagSeed 면 같은 쪽지, 부모가 배정한 구역을 따른다', () => {
  assert.deepEqual(makeStations(setupOf(5, 9)), makeStations(setupOf(5, 9)));
  const st = makeStations(setupOf(5, 9, { roleOf: { r3: 'helm', r1: 'storage' } }));
  assert.equal(st[2].role.id, 'helm');
  assert.equal(st[0].role.id, 'storage');
  assert.equal(new Set(st.map((x) => x.role.id)).size, 5);
  // 방 이름을 고쳐도 쪽지 숫자는 그대로 (방 id 로 정한다)
  const renamed = setupOf(5, 9);
  renamed.rooms[1].name = '주방';
  assert.deepEqual(makeStations(renamed)[1].digits, makeStations(setupOf(5, 9))[1].digits);
});

test('도착 확인 질문: 답은 쪽지에서 읽을 수 있고, 맞는 답만 통과한다', () => {
  const st = makeStations(setupOf(6, 3));
  const rng = makeRng(5);
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    const station = st[i % 6];
    const q = makeQuery(rng, station, ['pos', 'pair', 'max', 'min']);
    seen.add(q.kind);
    assert.ok(q.text.length > 3);
    assert.ok(q.answer.every((d) => station.digits.includes(d)));
    assert.ok(checkAnswer(q, q.answer));
    assert.ok(!checkAnswer(q, q.answer.map((d) => (d % 9) + 1)));
    assert.ok(!checkAnswer(q, []));
    if (q.kind === 'max') assert.equal(q.answer[0], Math.max(...station.digits));
    if (q.kind === 'min') assert.equal(q.answer[0], Math.min(...station.digits));
    if (q.kind === 'pair') assert.equal(q.answer.length, 2);
  }
  assert.equal(seen.size, 4);
  assert.equal(makeQuery(rng, st[0], []).kind, 'pos');
});

test('임무: 모든 단계가 규칙대로 만들어지고, 평소 걸음이면 급한 것부터 해서 모두 해낼 수 있다', () => {
  for (const d of [0, 1, 2]) {
    for (const R of [4, 5, 6]) {
      const stations = makeStations(setupOf(R));
      for (let seed = 1; seed <= 250; seed++) {
        for (const hopMs of [9000, 20000, 45000]) {
          for (const st of STAGES.slice(1)) {
            const script = buildStage(st.id, { seed, difficulty: d, stations, hopMs, ease: 0 });
            const k = STAGES.indexOf(st) - 1;
            assert.equal(script.waves.length, DIFFICULTY[d].waves[k]);
            assert.equal(script.waves.filter((w) => w.alerts.length === 2).length, Math.min(DIFFICULTY[d].doubles[k], script.waves.length));
            const ids = new Set();
            for (const wave of script.waves) {
              assert.ok(wave.alerts.length >= 1 && wave.alerts.length <= 2);
              if (wave.alerts.length === 2) assert.notEqual(wave.alerts[0].station, wave.alerts[1].station);
              for (const a of wave.alerts) {
                ids.add(a.id);
                assert.ok(a.station >= 0 && a.station < R);
                assert.ok(a.title.length > 3);
                if (a.kind === 'fix') {
                  assert.ok(TASKS[a.task]);
                  assert.equal(a.part, null);
                } else if (a.kind === 'fetch') {
                  assert.ok(PARTS[a.part] && TASKS[a.task]);
                  assert.equal(stations[a.source].role.id, 'storage');
                  assert.notEqual(a.station, a.source);
                } else {
                  assert.equal(a.code.length, DIFFICULTY[d].relayLen);
                  assert.notEqual(a.station, a.source);
                  assert.ok(a.source >= 0);
                }
              }
            }
            assert.equal(ids.size, script.waves.reduce((n, w) => n + w.alerts.length, 0));
            if (st.id === 'dive') assert.ok(script.waves.every((w) => w.alerts.every((a) => a.kind === 'fix')));
            if (st.id === 'deep') assert.ok(script.waves.some((w) => w.alerts.some((a) => a.kind === 'fetch')), '심해에는 부품 경보가 하나는 있다');
            if (st.id === 'salvage') {
              assert.ok(script.waves.every((w) => w.alerts.every((a) => a.kind === 'relay')));
              assert.equal(script.route.order.length, DIFFICULTY[d].routeLen);
              script.route.order.forEach((x, i) => i && assert.notEqual(x, script.route.order[i - 1]));
            } else assert.equal(script.route, null);
            // 잰 걸음 그대로 걷고 수리에 12초 쓰는 아이
            const sim = simulate(script, { hopMs, taskMs: 12000, checkinMs: 3000, reactMs: 4000, codeMs: 5000 });
            assert.ok(sim.ok, `d${d} R${R} 씨앗 ${seed} 걸음 ${hopMs} ${st.id} 여유 ${sim.worstSlackMs}`);
          }
        }
      }
    }
  }
});

test('임무: 다시 도전하면 제한 시간이 넉넉해지고, 어려울수록 빡빡하다', () => {
  const stations = makeStations(setupOf(5));
  const total = (d, ease) => buildStage('deep', { seed: 5, difficulty: d, stations, hopMs: 20000, ease }).waves[0].alerts[0].limitMs;
  const perHop = (d) => {
    const a = buildStage('dive', { seed: 5, difficulty: d, stations, hopMs: 20000, ease: 0 }).waves[0].alerts[0];
    return a.limitMs;
  };
  assert.ok(perHop(0) > perHop(1) && perHop(1) > perHop(2));
  // 같은 씨앗이라도 다시 할 때는 다른 임무가 나오므로, 종류가 같은 경보끼리 견준다
  const fixLimit = (ease) => {
    for (let seed = 1; seed < 50; seed++) {
      const a = buildStage('dive', { seed, difficulty: 1, stations, hopMs: 20000, ease }).waves[0].alerts[0];
      if (a.kind === 'fix') return a.limitMs;
    }
    return 0;
  };
  assert.ok(fixLimit(1) > fixLimit(0) && fixLimit(2) > fixLimit(1));
  assert.ok(total(1, 0) > 0);
});

test('수리 놀이 여섯 가지가 한 판에 고루 나온다', () => {
  for (const d of [0, 1, 2]) {
    let all = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const stations = makeStations(setupOf(6));
      const seen = new Set();
      for (const st of STAGES.slice(1)) {
        for (const w of buildStage(st.id, { seed, difficulty: d, stations, hopMs: 20000, ease: 0 }).waves) for (const a of w.alerts) if (a.task) seen.add(a.task);
      }
      if (seen.size >= 5) all++;
    }
    assert.ok(all >= 40, `난이도 ${d}: 다섯 가지 이상 나온 판 ${all}/60`);
  }
  // 고장 표의 수리 이름과 부품 이름이 모두 있다
  for (const list of Object.values(PROBLEMS)) for (const p of list) {
    assert.ok(TASKS[p.task]);
    if (p.part) assert.ok(PARTS[p.part]);
  }
});

test('한 판: 평소 걸음의 아이는 선체 손상 없이 끝까지 간다', () => {
  for (const d of [0, 1, 2]) {
    for (const R of [4, 5, 6]) {
      for (let seed = 1; seed <= 12; seed++) {
        const s = play(seed * 31 + d, d, R);
        assert.equal(s.phase, 'done', `d${d} R${R} 씨앗 ${seed}`);
        assert.equal(s.stats.damage, 0, `d${d} R${R} 씨앗 ${seed} 손상 ${s.stats.damage}`);
        assert.equal(s.retries, 0);
        assert.equal(s.stats.stages.length, STAGES.length);
        assert.equal(s.hopMs, 14000, '걸음 = 이동 12초 + 도착 확인 2초');
        assert.equal(s.carrying.length, 0);
        const sc = computeScore(s);
        assert.equal(sc.score, 100);
        assert.equal(sc.grade, 'S');
      }
    }
  }
});

test('한 판: 가만히 있으면 선체가 깎여 실패하고, 다시 하면 채워진다', () => {
  const stations = makeStations(setupOf(5));
  const env = { stations };
  let s = play(3, 1, 5, { lazy: true, giveUp: true });
  assert.equal(s.phase, 'failed');
  assert.equal(s.hull, 0);
  // 보통 난이도는 잠항의 경보 셋을 다 놓쳐도 선체가 남는다. 손상이 쌓여 심해에서 가라앉는다.
  const failedAt = STAGES[s.stage].id;
  assert.equal(failedAt, 'deep');
  assert.ok(s.stats.missed.length >= 4);
  assert.equal(s.active.length, 0);
  s = reduce(s, { type: 'retry' }, env);
  assert.equal(s.phase, 'intro');
  assert.equal(s.hull, s.hullMax);
  assert.equal(s.ease, 1);
  assert.equal(s.retries, 1);
  s = reduce(s, { type: 'begin' }, env);
  assert.equal(s.phase, 'run');
  assert.equal(STAGES[s.stage].id, failedAt, '실패한 단계부터 다시 한다');
  const sc = computeScore(s);
  assert.ok(sc.parts.retry > 0 && sc.parts.damage > 0);
  assert.notEqual(sc.grade, 'S');
});

test('한 판: 느린 아이도 다시 도전하다 보면 끝까지 간다 (다시 할수록 넉넉해진다)', () => {
  // 출항 점검에서는 빨리 걸었는데 그 뒤로는 두 배쯤 느린 아이
  const stations = makeStations(setupOf(5));
  const env = { stations };
  let s = newGame({ seed: 8, difficulty: 2, stationCount: 5 });
  s = reduce(s, { type: 'begin' }, env);
  for (const st of stations) {
    for (let i = 0; i < 40; i++) s = reduce(s, { type: 'tick', dt: 250 }, env);
    s = reduce(s, { type: 'checkin', station: st.idx }, env);
  }
  assert.equal(s.phase, 'clear');
  assert.equal(s.hopMs, 10000);
  // 여기부터는 엔진만으로: 실패 → 재도전을 되풀이하면 제한 시간이 늘어난다
  s = reduce(s, { type: 'next' }, env);
  s = reduce(s, { type: 'begin' }, env);
  const first = s.script.waves[0].alerts[0].limitMs;
  s.hull = 1;
  for (let i = 0; i < 2000 && s.phase === 'run'; i++) s = reduce(s, { type: 'tick', dt: 250 }, env);
  assert.equal(s.phase, 'failed');
  s = reduce(reduce(s, { type: 'retry' }, env), { type: 'begin' }, env);
  const kindSame = s.script.waves[0].alerts[0].kind === 'fix';
  if (kindSame) assert.ok(s.script.waves[0].alerts[0].limitMs > first);
  assert.equal(s.ease, 1);
});

test('시간: tick 은 최대 1초만 흐르고, 멈춘 동안은 흐르지 않는다', () => {
  const env = { stations: makeStations(setupOf(4)) };
  let s = reduce(newGame({ seed: 1, difficulty: 1, stationCount: 4 }), { type: 'begin' }, env);
  s = reduce(s, { type: 'tick', dt: 60000 }, env);
  assert.equal(s.clock, 1000);
  s = reduce(s, { type: 'pause' }, env);
  s = reduce(s, { type: 'tick', dt: 500 }, env);
  assert.equal(s.clock, 1000);
  assert.equal(s.stats.pauses, 1);
  s = reduce(s, { type: 'pause' }, env);
  assert.equal(s.stats.pauses, 1);
  s = reduce(s, { type: 'resume' }, env);
  s = reduce(s, { type: 'tick', dt: 500 }, env);
  assert.equal(s.clock, 1500);
  // intro 에서는 시간이 가지 않는다
  const intro = reduce(newGame({ seed: 1, difficulty: 1, stationCount: 4 }), { type: 'tick', dt: 500 }, env);
  assert.equal(intro.clock, 0);
});

test('출항 점검: 모든 구역을 돌아야 끝나고, 걸음은 범위 안으로 잘린다', () => {
  const env = { stations: makeStations(setupOf(4)) };
  let s = reduce(newGame({ seed: 1, difficulty: 1, stationCount: 4 }), { type: 'begin' }, env);
  assert.equal(s.phase, 'dock');
  s = reduce(s, { type: 'checkin', station: 0 }, env);
  s = reduce(s, { type: 'checkin', station: 0 }, env);
  assert.deepEqual(s.visited, [0]);
  for (const st of [1, 2, 3]) {
    s = reduce(s, { type: 'tick', dt: 1000 }, env);
    s = reduce(s, { type: 'checkin', station: st }, env);
  }
  assert.equal(s.phase, 'clear');
  assert.equal(s.hopMs, HOP.minMs, '1초 걸음은 최소값으로');
  assert.equal(s.hopSamples.length, 3);
  s = reduce(s, { type: 'next' }, env);
  assert.equal(s.phase, 'intro');
  assert.equal(s.stage, 1);
  assert.equal(depth(s), 0);
});

/** 원하는 종류의 경보가 뜬 상태를 만든다 */
function untilAlert(kind, difficulty = 1, R = 5) {
  const stations = makeStations(setupOf(R));
  const env = { stations };
  for (let seed = 1; seed < 400; seed++) {
    let s = newGame({ seed, difficulty, stationCount: R });
    s = reduce(s, { type: 'begin' }, env);
    for (const st of stations) {
      for (let i = 0; i < 60; i++) s = reduce(s, { type: 'tick', dt: 250 }, env);
      s = reduce(s, { type: 'checkin', station: st.idx }, env);
    }
    // 원하는 단계까지 부모 넘기기로 간다
    const want = kind === 'fetch' ? 'deep' : kind === 'relay' || kind === 'route' ? 'salvage' : 'dive';
    let guard = 0;
    while (STAGES[s.stage].id !== want && guard++ < 20) {
      if (s.phase === 'clear') s = reduce(s, { type: 'next' }, env);
      else if (s.phase === 'intro') s = reduce(reduce(s, { type: 'begin' }, env), { type: 'rescue' }, env);
    }
    if (s.phase === 'clear') s = reduce(s, { type: 'next' }, env);
    s = reduce(s, { type: 'begin' }, env);
    for (let i = 0; i < 40 && !s.active.length; i++) s = reduce(s, { type: 'tick', dt: 250 }, env);
    if (kind === 'route') return { s, env, stations };
    if (s.active.length && s.active[0].kind === kind && (kind !== 'double' || s.active.length === 2)) return { s, env, stations };
  }
  throw new Error('경보를 못 만들었다: ' + kind);
}

test('부품 경보: 창고에 들러야 고칠 수 있고, 고치면 손이 빈다', () => {
  let { s, env } = untilAlert('fetch');
  const a = s.active[0];
  assert.equal(actionsAt(s, a.station)[0].type, 'needPart');
  s = reduce(s, { type: 'checkin', station: a.station }, env);
  s = reduce(s, { type: 'taskDone', id: a.id }, env);
  assert.equal(s.active.length, 1, '부품 없이 끝낼 수 없다');
  s = reduce(s, { type: 'checkin', station: a.source }, env);
  assert.deepEqual(s.carrying, [a.part]);
  assert.equal(actionsAt(s, a.source)[0].type, 'picked');
  assert.equal(actionsAt(s, a.station)[0].type, 'task');
  // 창고에 또 들러도 두 번 챙기지 않는다
  s = reduce(s, { type: 'checkin', station: a.source }, env);
  assert.equal(s.carrying.length, 1);
  s = reduce(s, { type: 'checkin', station: a.station }, env);
  s = reduce(s, { type: 'taskDone', id: a.id }, env);
  assert.equal(s.active.length, 0);
  assert.equal(s.carrying.length, 0);
  assert.equal(s.stats.resolved.at(-1).kind, 'fetch');
  assert.ok(CARRY_MAX >= 1);
});

test('부품 경보: 부품을 든 채 시간을 넘기면 부품도 사라진다', () => {
  let { s, env } = untilAlert('fetch');
  const a = s.active[0];
  s = reduce(s, { type: 'checkin', station: a.source }, env);
  assert.equal(s.carrying.length, 1);
  const hull = s.hull;
  for (let i = 0; i < 2000 && s.active.some((x) => x.id === a.id); i++) s = reduce(s, { type: 'tick', dt: 250 }, env);
  assert.equal(s.carrying.length, 0);
  assert.equal(s.hull, hull - a.severity);
  assert.equal(s.stats.missed.at(-1).id, a.id);
});

test('암호 전달: 보고 와야 입력할 수 있고, 틀리면 시간이 깎인다', () => {
  let { s, env } = untilAlert('relay');
  const a = s.active[0];
  assert.equal(actionsAt(s, a.station)[0].type, 'needCode');
  assert.equal(actionsAt(s, a.source)[0].type, 'showCode');
  s = reduce(s, { type: 'checkin', station: a.source }, env);
  assert.ok(s.active[0].sawCode);
  assert.equal(actionsAt(s, a.station)[0].type, 'enterCode');
  const before = s.active[0].deadline;
  s = reduce(s, { type: 'code', id: a.id, input: a.code.map((c) => (c + 1) % 6) }, env);
  assert.equal(s.active[0].deadline, before - WRONG_COST_MS);
  assert.equal(s.stats.relayWrong, 1);
  s = reduce(s, { type: 'code', id: a.id, input: a.code.slice(0, -1) }, env);
  assert.equal(s.stats.relayWrong, 2);
  s = reduce(s, { type: 'code', id: a.id, input: a.code.slice() }, env);
  assert.equal(s.active.length, 0);
  assert.equal(computeScore(s).parts.memory, 4);
  const sum = summarize(s);
  assert.deepEqual(sum.relay, { total: 1, clean: 0 });
});

test('크레인 순서: 차례대로 가야 하고, 틀리면 시간이 깎이며, 시간을 넘기면 다시 보여 준다', () => {
  let { s, env } = untilAlert('route', 0);
  // 전달 경보를 모두 해결해 크레인 단계로
  let guard = 0;
  while (s.phase === 'run' && guard++ < 4000) {
    if (!s.active.length) s = reduce(s, { type: 'tick', dt: 250 }, env);
    else {
      const a = s.active[0];
      s = reduce(s, { type: 'checkin', station: a.source }, env);
      s = reduce(s, { type: 'code', id: a.id, input: a.code.slice() }, env);
    }
  }
  assert.equal(s.phase, 'route');
  const r = s.route;
  assert.equal(r.step, 0);
  const wrong = (r.order[0] + 1) % 5;
  const before = r.deadline;
  s = reduce(s, { type: 'checkin', station: wrong === r.order[0] ? (wrong + 1) % 5 : wrong }, env);
  assert.equal(s.route.deadline, before - WRONG_COST_MS);
  assert.equal(s.stats.routeWrong, 1);
  s = reduce(s, { type: 'checkin', station: r.order[0] }, env);
  assert.equal(s.route.step, 1);
  // 순서를 다시 보면 시간이 깎인다 (보여 주는 동안에는 다시 볼 수 없다)
  for (let i = 0; i < 400 && s.clock < s.route.shownUntil; i++) s = reduce(s, { type: 'tick', dt: 250 }, env);
  const d0 = s.route.deadline;
  s = reduce(s, { type: 'peek' }, env);
  assert.equal(s.route.deadline, d0 - WRONG_COST_MS);
  assert.ok(s.route.shownUntil > s.clock);
  s = reduce(s, { type: 'peek' }, env);
  assert.equal(s.route.deadline, d0 - WRONG_COST_MS, '보는 중에는 또 깎이지 않는다');
  // 시간을 넘기면 선체가 깎이고 처음부터
  const hull = s.hull;
  for (let i = 0; i < 4000 && s.hull === hull && s.phase === 'route'; i++) s = reduce(s, { type: 'tick', dt: 250 }, env);
  assert.equal(s.hull, hull - 2);
  assert.equal(s.route.step, 0);
  assert.ok(s.route.shownUntil > s.clock);
  for (const st of s.route.order) s = reduce(s, { type: 'checkin', station: st }, env);
  assert.equal(s.phase, 'clear');
  assert.equal(depth(s), 1000);
});

test('두 곳 동시 고장: 급한 것부터 고쳤는지 기록한다', () => {
  const stations = makeStations(setupOf(5));
  const env = { stations };
  let found = 0;
  for (let seed = 1; seed < 60 && found < 6; seed++) {
    let s = play(seed, 2, 5);
    assert.equal(s.phase, 'done');
    if (s.stats.doubles.length) {
      found++;
      assert.ok(s.stats.doubles.every((d) => d.urgentFirst), '가상의 아이는 늘 급한 것부터 한다');
      const sum = summarize(s);
      assert.equal(sum.doubles.total, sum.doubles.urgentFirst);
    }
  }
  assert.ok(found >= 6);
  // 느긋한 것부터 고치면 urgentFirst 가 false 로 남는다
  let s = newGame({ seed: 11, difficulty: 2, stationCount: 5 });
  s = reduce(s, { type: 'begin' }, env);
  for (const st of stations) s = reduce(reduce(s, { type: 'tick', dt: 1000 }, env), { type: 'checkin', station: st.idx }, env);
  let guard = 0;
  let done = false;
  while (!done && guard++ < 6000 && s.phase !== 'done') {
    if (s.phase === 'clear') s = reduce(s, { type: 'next' }, env);
    else if (s.phase === 'intro') s = reduce(s, { type: 'begin' }, env);
    else if (s.phase === 'failed') s = reduce(s, { type: 'retry' }, env);
    else if (s.phase === 'route') s = reduce(s, { type: 'rescue' }, env);
    else if (s.active.length === 2 && s.active.every((a) => a.kind === 'fix')) {
      const late = s.active.slice().sort((x, y) => y.deadline - x.deadline)[0];
      s = reduce(s, { type: 'checkin', station: late.station }, env);
      s = reduce(s, { type: 'taskDone', id: late.id }, env);
      assert.equal(s.stats.doubles.at(-1).urgentFirst, false);
      done = true;
    } else if (s.active.length) {
      const a = s.active[0];
      if (a.kind === 'fix') s = reduce(reduce(s, { type: 'checkin', station: a.station }, env), { type: 'taskDone', id: a.id }, env);
      else if (a.kind === 'fetch') {
        s = reduce(s, { type: 'checkin', station: a.source }, env);
        s = reduce(reduce(s, { type: 'checkin', station: a.station }, env), { type: 'taskDone', id: a.id }, env);
      } else s = reduce(reduce(s, { type: 'checkin', station: a.source }, env), { type: 'code', id: a.id, input: a.code.slice() }, env);
    } else s = reduce(s, { type: 'tick', dt: 250 }, env);
  }
  assert.ok(done, '두 곳 동시 고장을 만났다');
});

test('부모 넘기기와 긴장도', () => {
  let { s, env } = untilAlert('fix');
  assert.equal(urgency(s), 0);
  const a = s.active[0];
  for (let i = 0; i < 8; i++) s = reduce(s, { type: 'tick', dt: 1000 }, env);
  assert.ok(urgency(s) > 0 && urgency(s) < 1);
  assert.ok(Math.abs(urgency(s) - 8000 / a.limitMs) < 0.05);
  const ended = reduce(s, { type: 'finish' }, env);
  assert.equal(ended.phase, 'done');
  assert.equal(ended.forced, true);
  assert.equal(ended.active.length, 0);
  s = reduce(s, { type: 'rescue' }, env);
  assert.equal(s.phase, 'clear');
  assert.equal(s.stats.rescues, 1);
  assert.equal(computeScore(s).parts.rescue, 15);
  assert.equal(s.active.length, 0);
});

test('점수, 보너스, 문장', () => {
  const s = newGame({ seed: 1, difficulty: 1, stationCount: 5 });
  assert.equal(computeScore(s).grade, 'S');
  s.stats.damage = 2;
  s.stats.wrongQueries = 20;
  assert.equal(computeScore(s).score, 100 - 12 - 8);
  assert.equal(computeScore(s).grade, 'A');
  s.retries = 2;
  assert.equal(computeScore(s).grade, 'B');
  assert.ok(bonusUnlocked('A', 'A') && !bonusUnlocked('B', 'A') && !bonusUnlocked('A', 'S') && bonusUnlocked('C', 'always'));
  assert.equal(clock(65000), '01:05');
  const stations = makeStations(setupOf(5));
  assert.equal(stationLabel(stations[0]), stations[0].role.name + '(' + stations[0].room.name + ')');
  assert.equal(briefing('지우').length, 4);
  assert.equal(howTo().length, 3);
  assert.equal(stageTitle(0), '출항 점검');
  assert.equal(stageTitle(2), '2단계 심해');
  for (const g of ['S', 'A', 'B', 'C']) assert.ok(gradeLine(g).length > 5);
  assert.ok(headline('').includes('함장'));
  assert.equal(josa('거실', '으로/로'), '거실로');
  assert.equal(josa('안방', '으로/로'), '안방으로');
  assert.equal(josa('퓨즈', '을/를'), '퓨즈를');
  for (let seed = 1; seed < 40; seed++) {
    for (const st of STAGES.slice(1)) {
      for (const w of buildStage(st.id, { seed, difficulty: 2, stations, hopMs: 20000, ease: 0 }).waves) {
        for (const a of w.alerts) {
          for (const flags of [{}, { hasPart: true, sawCode: true }]) {
            const line = alertGuide(Object.assign({}, a, flags), stations);
            assert.ok(line.length > 5 && !/undefined|null|NaN/.test(line), line);
          }
        }
      }
    }
  }
  const setup = defaultSetup();
  assert.equal(missionKey(setup), missionKey(JSON.parse(JSON.stringify(setup))));
  assert.notEqual(missionKey(setup), missionKey(Object.assign({}, setup, { seed: setup.seed + 1 })));
});
