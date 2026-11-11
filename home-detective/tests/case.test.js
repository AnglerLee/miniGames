// 사건 생성기 검증: 수천 개 씨앗에서 범인이 한 명으로 정해지고, 고발에 쓸 근거가 있는지 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCase, checkSetup, findTag, codeText, castFor } from '../js/shared/case.js';
import { feasibleCulprits, violations, judge, refuters, innocenceReasons, statementTrue, factTrue } from '../js/shared/logic.js';
import { ROOM_PRESETS, SUSPECT_PRESETS, DIFFICULTY } from '../js/shared/content.js';
import { statementLine, statementSpeech, factText, evidenceTitle, evidenceIntro, itemText, briefing, rules, confession, headline, josa } from '../js/shared/text.js';

const setupOf = (seed, difficulty, R, extra = {}) =>
  Object.assign(
    {
      seed,
      difficulty,
      rooms: ROOM_PRESETS.slice(0, R).map((r, i) => ({ id: 'r' + (i + 1), ...r })),
      suspects: SUSPECT_PRESETS.map((s, i) => ({ id: 's' + (i + 1), ...s })),
      crimeRoom: null,
    },
    extra
  );

const SEEDS = 700;

test('모든 난이도와 방 수에서 사건이 만들어지고 범인이 한 명으로 정해진다', () => {
  for (const d of [0, 1, 2]) {
    for (const R of [4, 5, 6]) {
      for (let i = 1; i <= SEEDS; i++) {
        const cs = buildCase(setupOf(i * 7919 + d * 13 + R, d, R));
        assert.deepEqual(feasibleCulprits(cs), [cs.culprit], `씨앗 ${i} 난이도 ${d} 방 ${R}`);
        assert.equal(cs.suspects.length, DIFFICULTY[d].suspects);
        assert.equal(cs.evidence.length, DIFFICULTY[d].evidence);
        assert.equal(cs.evidence.filter((e) => e.herring).length, DIFFICULTY[d].herring);
      }
    }
  }
});

test('실제 세계에서 범인의 거짓말만 거짓이고 나머지 진술과 증거는 모두 참이다', () => {
  for (const d of [0, 1, 2]) {
    for (let i = 1; i <= SEEDS; i++) {
      const cs = buildCase(setupOf(i * 104729 + d, d, 5));
      const world = { loc: cs.loc, culprit: cs.culprit, crimeSlot: cs.crimeSlot, traits: cs.suspects };
      cs.statements.forEach((row, s) =>
        row.forEach((st, t) => {
          const isLie = s === cs.culprit && t === cs.crimeSlot;
          assert.equal(statementTrue(cs.loc, s, t, st), !isLie, `진술 ${s},${t}`);
        })
      );
      cs.evidence.forEach((ev) => assert.ok(factTrue(world, ev.fact), '증거 ' + ev.id + ' ' + ev.fact.kind));
      // 범인은 사건 시각에 사건 방에 혼자
      assert.equal(cs.loc[cs.culprit][cs.crimeSlot], cs.crimeRoom);
      assert.equal(cs.loc.filter((row) => row[cs.crimeSlot] === cs.crimeRoom).length, 1);
    }
  }
});

test('고발: 범인과 거짓말과 반박 근거가 맞아야 해결된다', () => {
  for (const d of [0, 1, 2]) {
    for (let i = 1; i <= 300; i++) {
      const cs = buildCase(setupOf(i * 31 + d * 1000003, d, 5));
      const ref = refuters(cs);
      assert.ok(ref.length >= 1, '반박 근거가 하나는 있어야 한다');
      for (const item of ref) {
        assert.equal(judge(cs, { suspect: cs.culprit, slot: cs.crimeSlot, item }), 'solved');
      }
      // 범인이 아닌 용의자
      const other = (cs.culprit + 1) % cs.suspects.length;
      assert.equal(judge(cs, { suspect: other, slot: cs.crimeSlot, item: ref[0] }), 'wrong');
      // 거짓말을 잘못 짚음
      assert.equal(judge(cs, { suspect: cs.culprit, slot: (cs.crimeSlot + 1) % 3, item: ref[0] }), 'deny');
      // 시계는 거짓말을 깨지 못한다
      assert.equal(judge(cs, { suspect: cs.culprit, slot: cs.crimeSlot, item: { type: 'evidence', index: 0 } }), 'deny');
      assert.equal(judge(cs, { suspect: cs.culprit, slot: cs.crimeSlot, item: null }), 'deny');
      // 반박 근거는 사건 시각의 것만
      for (const item of ref) {
        if (item.type === 'statement') assert.equal(item.slot, cs.crimeSlot);
        else assert.equal(cs.evidence[item.index].fact.slot, cs.crimeSlot);
      }
    }
  }
});

test('결백한 용의자는 범인으로 놓으면 어긋나는 데가 있고, 설명 거리는 모두 사실이다', () => {
  for (const d of [0, 1, 2]) {
    for (let i = 1; i <= 300; i++) {
      const cs = buildCase(setupOf(i * 977 + d * 5, d, 4 + (i % 3)));
      for (let x = 0; x < cs.suspects.length; x++) {
        if (x === cs.culprit) {
          assert.equal(violations(cs, x).length, 0);
          continue;
        }
        assert.ok(violations(cs, x).length > 0);
        for (const r of innocenceReasons(cs, x)) {
          if (r.type === 'statement') {
            assert.notEqual(r.who, cs.culprit, '범인의 말은 근거로 쓰지 않는다');
            assert.equal(r.slot, cs.crimeSlot);
          } else {
            assert.ok(cs.evidence[r.index]);
          }
        }
      }
    }
  }
});

test('쪽지: 기호가 겹치지 않고, 증거는 그 방에, 방마다 고르게 놓인다', () => {
  for (const d of [0, 1, 2]) {
    for (const R of [4, 5, 6]) {
      for (let i = 1; i <= 200; i++) {
        const cs = buildCase(setupOf(i * 613 + R, d, R));
        assert.equal(cs.tags.length, cs.suspects.length + cs.evidence.length);
        const codes = new Set(cs.tags.map((t) => codeText(t.code)));
        assert.equal(codes.size, cs.tags.length);
        const ids = new Set(cs.tags.map((t) => t.id));
        assert.equal(ids.size, cs.tags.length);
        const load = new Array(R).fill(0);
        for (const tag of cs.tags) {
          load[tag.room]++;
          assert.equal(findTag(cs, tag.code.shape, tag.code.digit), tag);
          if (tag.kind === 'evidence') assert.equal(cs.evidence[tag.ref].room, tag.room);
        }
        assert.ok(Math.max(...load) <= 4, '한 방에 쪽지가 너무 많다: ' + load);
        // 증거는 한 방에 두 개까지
        const evLoad = new Array(R).fill(0);
        cs.evidence.forEach((e) => evLoad[e.room]++);
        assert.ok(Math.max(...evLoad) <= 2);
        // 시계와 현장 증거는 사건 방에
        assert.equal(cs.evidence[0].fact.kind, 'time');
        assert.equal(cs.evidence[0].room, cs.crimeRoom);
        assert.equal(cs.evidence[1].room, cs.crimeRoom);
      }
    }
  }
});

test('무늬만으로는 범인이 정해지지 않는다', () => {
  for (const d of [0, 1, 2]) {
    for (let i = 1; i <= 300; i++) {
      const cs = buildCase(setupOf(i * 4441 + d, d, 5));
      const c = cs.suspects[cs.culprit];
      assert.ok(cs.suspects.filter((p) => p.foot === c.foot).length >= 2);
      assert.ok(cs.suspects.filter((p) => p.print === c.print).length >= 2);
      // 범인을 이름으로 가리키는 증거는 없다
      for (const ev of cs.evidence) {
        if (ev.fact.kind === 'seen' && ev.fact.slot === cs.crimeSlot) assert.notEqual(ev.fact.who, cs.culprit);
      }
    }
  }
});

test('같은 설정이면 같은 사건, 씨앗이 다르면 다른 사건', () => {
  const a = buildCase(setupOf(12345, 1, 5));
  const b = buildCase(setupOf(12345, 1, 5));
  assert.deepEqual(a, b);
  let differ = 0;
  for (let i = 0; i < 30; i++) {
    const c = buildCase(setupOf(50000 + i, 1, 5));
    if (c.culprit !== a.culprit || c.crimeSlot !== a.crimeSlot || c.crimeRoom !== a.crimeRoom) differ++;
  }
  assert.ok(differ >= 20);
});

test('간식이 있던 방을 부모가 정하면 그 방이 사건 현장이 된다', () => {
  for (let i = 1; i <= 100; i++) {
    const cs = buildCase(setupOf(i * 3, i % 3, 5, { crimeRoom: 'r2' }));
    assert.equal(cs.rooms[cs.crimeRoom].id, 'r2');
  }
});

test('용의자를 더 많이 등록하면 난이도가 정한 수만 뽑는다', () => {
  const setup = setupOf(99, 0, 4);
  const { suspects } = castFor(setup);
  assert.equal(suspects.length, 4);
  const cs = buildCase(setup);
  assert.deepEqual(
    cs.suspects.map((s) => s.id),
    suspects.map((s) => s.id)
  );
});

test('설정이 모자라면 이유를 알려 준다', () => {
  assert.match(checkSetup(setupOf(1, 1, 3)), /방/);
  const few = setupOf(1, 2, 5);
  few.suspects = few.suspects.slice(0, 4);
  assert.match(checkSetup(few), /용의자/);
  assert.equal(checkSetup(setupOf(1, 1, 5)), null);
  assert.throws(() => buildCase(setupOf(1, 1, 3)));
});

test('문장: 모든 진술과 증거가 빈 문장 없이 만들어진다', () => {
  for (const d of [0, 1, 2]) {
    for (let i = 1; i <= 100; i++) {
      const cs = buildCase(setupOf(i * 17 + d, d, 5));
      cs.suspects.forEach((_, s) => {
        for (let t = 0; t < 3; t++) {
          assert.ok(statementLine(cs, s, t).length > 8);
          const speech = statementSpeech(cs, s, t);
          assert.ok(speech.includes(cs.rooms[cs.statements[s][t].room].name));
          assert.ok(!/undefined|null|NaN/.test(speech));
        }
      });
      cs.evidence.forEach((ev, index) => {
        assert.ok(evidenceTitle(cs, ev).length > 1);
        assert.ok(evidenceIntro(cs, ev).length > 5);
        assert.ok(factText(cs, ev).length > 5);
        assert.ok(!/undefined|null|NaN/.test(itemText(cs, { type: 'evidence', index })));
      });
      assert.equal(briefing(cs, '지우').length, 4);
      assert.equal(rules(cs).length, 4);
      assert.ok(confession(cs).length >= 3);
      assert.ok(headline(cs, '').includes(cs.suspects[cs.culprit].name));
    }
  }
});

test('조사: 받침에 맞춰 붙는다', () => {
  assert.equal(josa('곰돌이', '이/가'), '곰돌이가');
  assert.equal(josa('로봇', '이/가'), '로봇이');
  assert.equal(josa('로봇', '과/와'), '로봇과');
  assert.equal(josa('토끼', '과/와'), '토끼와');
  assert.equal(josa('거실', '으로/로'), '거실로');
  assert.equal(josa('안방', '으로/로'), '안방으로');
  assert.equal(josa('부엌', '은/는'), '부엌은');
  assert.equal(josa('R2', '은/는'), 'R2는');
  assert.equal(josa('공룡', '이랑/랑'), '공룡이랑');
});
