// 퍼즐 계약 테스트.
// 풀 수 없는 문제가 하나라도 나오면 그날 놀이를 망치므로, 많은 씨앗에 대해
// "매뉴얼과 아이가 볼 수 있는 것만 쓰는 풀이기가 반드시 정답에 도달하는가"를 확인한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makeRng } from '../js/shared/prng.js';
import { canon } from '../js/shared/canon.js';
import { tokenNumber } from '../js/shared/synccode.js';
import * as commscheck from '../js/shared/puzzles/commscheck.js';
import * as glyphgate from '../js/shared/puzzles/glyphgate.js';
import * as ductmaze from '../js/shared/puzzles/ductmaze.js';
import * as powergrid from '../js/shared/puzzles/powergrid.js';
import * as vaultdial from '../js/shared/puzzles/vaultdial.js';
import * as tokengate from '../js/shared/puzzles/tokengate.js';

const SEEDS = Number(process.env.SEEDS || 700);
const roundTrip = (v) => JSON.parse(JSON.stringify(v));

/** 씨앗 x 난이도 x 채널 x 시도 조합을 돌며 fn 을 부른다. */
function sweep(puzzle, fn, seeds = SEEDS) {
  const rng = makeRng(20261111);
  for (let i = 0; i < seeds; i++) {
    const seed = rng.next();
    for (let difficulty = 0; difficulty < 3; difficulty++) {
      const channel = i % 3;
      const ctx = { seed, stage: 0, channel, difficulty };
      for (let attempt = 0; attempt < 3; attempt++) fn(ctx, attempt);
    }
  }
}

function contract(puzzle, extra) {
  test(`${puzzle.id}: 항상 풀 수 있고 검수 문제가 없다`, () => {
    sweep(puzzle, (ctx, attempt) => {
      const label = `seed=${ctx.seed} 난이도=${ctx.difficulty} 채널=${ctx.channel} 시도=${attempt}`;
      const m = puzzle.manual(ctx);
      // 매뉴얼은 순수 JSON 이어야 하고, 다시 만들어도 같아야 한다
      assert.equal(canon(roundTrip(m)), canon(m), label);
      assert.equal(canon(puzzle.manual(ctx)), canon(m), label);
      const dev = puzzle.device(ctx, attempt);
      assert.equal(canon(puzzle.device(ctx, attempt)), canon(dev), label);
      assert.deepEqual(puzzle.audit(m, dev), [], label);
      const sim = puzzle.createSim(roundTrip(dev));
      const outcome = extra ? extra(roundTrip(m), sim, ctx) : puzzle.solve(roundTrip(m), sim);
      assert.equal(outcome, 'solved', label);
    });
  });
}

contract(commscheck);
contract(glyphgate);
contract(ductmaze);
contract(powergrid);
contract(vaultdial);
contract(tokengate, (m, sim, ctx) => tokengate.solve(m, sim, tokenNumber({ seed: ctx.seed })));

test('채널이 바뀌면 매뉴얼이 바뀌고, 시도가 바뀌면 장치만 바뀐다', () => {
  for (const puzzle of [glyphgate, ductmaze, powergrid, vaultdial]) {
    let manualChanged = 0;
    let deviceChanged = 0;
    const n = 60;
    for (let seed = 1; seed <= n; seed++) {
      const ctx = { seed, stage: 0, channel: 0, difficulty: 1 };
      if (canon(puzzle.manual(ctx)) !== canon(puzzle.manual({ ...ctx, channel: 1 }))) manualChanged++;
      if (canon(puzzle.device(ctx, 0)) !== canon(puzzle.device(ctx, 1))) deviceChanged++;
    }
    assert.equal(manualChanged, n, `${puzzle.id} 매뉴얼`);
    assert.ok(deviceChanged >= n * 0.9, `${puzzle.id} 장치 ${deviceChanged}/${n}`);
  }
});

test('교신 점검: 틀린 보기를 고르면 실패', () => {
  const ctx = { seed: 5, stage: 0, channel: 0, difficulty: 0 };
  const dev = commscheck.device(ctx, 0);
  const sim = commscheck.createSim(dev);
  assert.equal(sim.act({ type: 'choose', index: (dev.answer + 1) % 4 }).status, 'fault');
});

test('게이트: 틀린 번호는 실패, 지우기는 처음으로', () => {
  const ctx = { seed: 11, stage: 1, channel: 0, difficulty: 1 };
  const dev = glyphgate.device(ctx, 0);
  let sim = glyphgate.createSim(dev);
  sim.act({ type: 'digit', d: dev.code[0] });
  sim.act({ type: 'clear' });
  assert.deepEqual(sim.view().entered, []);
  const wrong = dev.code.map((d, i) => (i === 3 ? (d + 1) % 10 : d));
  let result;
  for (const d of wrong) result = sim.act({ type: 'digit', d });
  assert.equal(result.status, 'fault');
  sim = glyphgate.createSim(dev);
  for (const d of dev.code) result = sim.act({ type: 'digit', d });
  assert.equal(result.status, 'solved');
});

test('게이트: 사전의 절반은 다른 문양과 한 군데만 다르다', () => {
  const m = glyphgate.manual({ seed: 3, stage: 1, channel: 0, difficulty: 2 });
  const near = m.entries.filter((a) =>
    m.entries.some((b) => {
      const diff = (a.frame !== b.frame) + (a.mark !== b.mark) + (a.pips !== b.pips);
      return diff === 1;
    })
  );
  assert.ok(near.length >= m.entries.length / 2, `${near.length}/${m.entries.length}`);
});

test('덕트: 감지선을 밟으면 실패하고, 가장 짧은 길은 대개 막혀 있다', () => {
  let trapped = 0;
  const n = 300;
  for (let seed = 1; seed <= n; seed++) {
    const ctx = { seed, stage: 2, channel: 0, difficulty: 1 };
    const dev = ductmaze.device(ctx, 0);
    // 감지선을 모르는 사람처럼 가장 짧은 길로 가 본다
    const blind = { ...dev.maze, wires: [] };
    const sim = ductmaze.createSim(dev);
    if (ductmaze.solve(blind, sim) === 'fault') trapped++;
  }
  assert.ok(trapped >= n * 0.5, `감지선에 걸린 비율 ${trapped}/${n}`);
});

test('덕트: 벽으로 가면 부딪힐 뿐 실수는 아니다', () => {
  const ctx = { seed: 21, stage: 2, channel: 0, difficulty: 0 };
  const sim = ductmaze.createSim(ductmaze.device(ctx, 0));
  // 출발할 때는 표식이 붙은 벽을 보고 있다
  const result = sim.act({ type: 'forward' });
  assert.equal(result.status, 'open');
  assert.equal(result.events[0].type, 'bump');
});

test('덕트: 스프레이는 횟수 제한이 있다', () => {
  const ctx = { seed: 33, stage: 2, channel: 0, difficulty: 2 };
  const sim = ductmaze.createSim(ductmaze.device(ctx, 0));
  const uses = sim.view().sprays;
  for (let i = 0; i < uses; i++) assert.equal(sim.act({ type: 'spray' }).events[0].type, 'sprayed');
  assert.equal(sim.act({ type: 'spray' }).events[0].type, 'empty');
});

test('전력실: 함정 스위치를 먼저 끄면 경보 회로가 끊긴다', () => {
  let checked = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const ctx = { seed, stage: 3, channel: 0, difficulty: 1 };
    const m = powergrid.manual(ctx);
    const dev = powergrid.device(ctx, 0);
    for (let i = 0; i < powergrid.SWITCHES; i++) {
      const on = (dev.state & (1 << i)) !== 0;
      const dirty = (m.feeds[i] & (powergrid.LOCK | powergrid.CAM)) !== 0;
      if (!on || !dirty) continue;
      const sim = powergrid.createSim(dev);
      const result = sim.act({ type: 'flip', index: i });
      if (result.status === 'fault') checked++;
    }
  }
  assert.ok(checked >= 200, `함정 확인 ${checked}건`);
});

test('전력실: 난이도가 오르면 조작 횟수가 늘고 과부하 제한이 생긴다', () => {
  const avg = [0, 1, 2].map((difficulty) => {
    let total = 0;
    const n = 150;
    for (let seed = 1; seed <= n; seed++) {
      const ctx = { seed, stage: 3, channel: 0, difficulty };
      const m = powergrid.manual(ctx);
      total += powergrid.shortestPlan(m, powergrid.device(ctx, 0).state).length;
      assert.equal(m.limited, difficulty > 0);
    }
    return total / n;
  });
  assert.ok(avg[0] < avg[1] && avg[1] < avg[2], `평균 조작 횟수 ${avg}`);
});

test('금고: 빨리 돌리면 걸림을 느낄 수 없다', () => {
  const ctx = { seed: 9, stage: 5, channel: 0, difficulty: 1 };
  const dev = vaultdial.device(ctx, 0);
  const sim = vaultdial.createSim(dev);
  let felt = 0;
  for (let i = 0; i < vaultdial.DIAL; i++) {
    const { events } = sim.act({ type: 'rotate', delta: 1, slow: false });
    if (events.some((e) => e.type === 'gate')) felt++;
  }
  assert.equal(felt, 0);
});

test('금고: 틀린 번호나 반대 방향은 실패', () => {
  const ctx = { seed: 14, stage: 5, channel: 0, difficulty: 1 };
  const m = vaultdial.manual(ctx);
  const dev = vaultdial.device(ctx, 0);

  const toEnterPhase = () => {
    const sim = vaultdial.createSim(dev);
    for (let i = 0; i < vaultdial.DIAL && sim.view().phase === 'detect'; i++) {
      const { events } = sim.act({ type: 'rotate', delta: 1, slow: true });
      if (events.some((e) => e.type === 'gate')) sim.act({ type: 'hold' });
    }
    assert.equal(sim.view().phase, 'enter');
    return sim;
  };

  // 틀린 번호에서 확정
  let sim = toEnterPhase();
  while (sim.view().value === dev.target[0]) sim.act({ type: 'rotate', delta: 1 });
  sim.act({ type: 'rotate', delta: 1 });
  if (sim.view().value === dev.target[0]) sim.act({ type: 'rotate', delta: 1 });
  let result = sim.act({ type: 'hold' });
  assert.equal(result.status, 'fault');
  assert.equal(result.events[0].type, 'wrong-number');

  // 번호는 맞지만 왼쪽으로 돌려서 도착
  sim = toEnterPhase();
  do {
    sim.act({ type: 'rotate', delta: -1 });
  } while (sim.view().value !== dev.target[0]);
  result = sim.act({ type: 'hold' });
  assert.equal(result.status, 'fault');
  assert.equal(result.events[0].type, 'wrong-direction');

  // 표시가 안 된 번호에서 버티면 아무 일도 없다
  sim = vaultdial.createSim(dev);
  while (dev.gates.includes(sim.view().value)) sim.act({ type: 'rotate', delta: 1 });
  assert.equal(sim.act({ type: 'hold' }).events[0].type, 'nothing');
  assert.equal(m.turns.join(), 'right,left,right');
});

test('토큰: 틀린 번호는 실패', () => {
  const ctx = { seed: 77, stage: 4, channel: 0, difficulty: 0 };
  const sim = tokengate.createSim(tokengate.device(ctx, 0));
  const right = tokenNumber({ seed: 77 });
  const wrong = String((Number(right) % 9000) + 1000 === Number(right) ? 1234 : (Number(right) % 9000) + 1000);
  assert.equal(tokengate.solve({}, sim, wrong === right ? '0000' : wrong), 'fault');
});
