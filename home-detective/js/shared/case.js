// 사건 만들기. 부모 설정(씨앗, 난이도, 방, 인형)만으로 같은 사건이 다시 만들어진다.
// 만든 사건은 logic.js 의 풀이기로 "범인이 한 명으로 정해지는지" 확인한 것만 내보낸다.

import { stream } from './prng.js';
import { DIFFICULTY, SLOT_LABELS, SLOT_HOURS, CODE_SHAPES, PERSONAS, FOOT_PATTERNS, PRINT_TYPES, ROOMS_MAX } from './content.js';
import { occupants, feasibleCulprits, refuters, factRefutes } from './logic.js';

const T = SLOT_LABELS.length;
const MAX_ATTEMPTS = 400;
/** 한 방에 둘 수 있는 증거 수 */
const EVIDENCE_PER_ROOM = 2;

/** 무늬 묶음 크기. 범인은 항상 2명 이상인 묶음에 든다 (무늬만으로 범인이 정해지지 않게). */
const TRAIT_GROUPS = { 4: [2, 2], 5: [2, 2, 1], 6: [2, 2, 2] };

function assignTrait(rng, S, culprit, kinds) {
  const groups = TRAIT_GROUPS[S] || [2, 2];
  const values = rng.shuffle([...Array(kinds).keys()]).slice(0, groups.length);
  const others = rng.shuffle([...Array(S).keys()].filter((s) => s !== culprit));
  const out = new Array(S).fill(0);
  // 범인은 첫 묶음(2명 이상)에 넣는다
  out[culprit] = values[0];
  let k = 0;
  groups.forEach((size, g) => {
    const need = g === 0 ? size - 1 : size;
    for (let i = 0; i < need; i++) out[others[k++]] = values[g];
  });
  return out;
}

function makeWorld(rng, S, R, crimeRoomFixed, detail) {
  const culprit = rng.int(S);
  const crimeSlot = rng.int(T);
  const crimeRoom = crimeRoomFixed >= 0 ? crimeRoomFixed : rng.int(R);
  const loc = [];
  for (let s = 0; s < S; s++) {
    const row = [];
    for (let t = 0; t < T; t++) {
      if (t === crimeSlot) {
        if (s === culprit) row.push(crimeRoom);
        else {
          let r = rng.int(R - 1);
          if (r >= crimeRoom) r++;
          row.push(r);
        }
      } else row.push(rng.int(R));
    }
    loc.push(row);
  }

  // 사실대로 말하는 진술
  const statements = loc.map((row, s) =>
    row.map((r, t) => {
      const mates = occupants(loc, t, r).filter((x) => x !== s);
      let comp = null;
      const roll = (rng.next() % 1000) / 1000;
      if (mates.length === 0) {
        if (roll < detail) comp = { kind: 'alone' };
      } else if (roll < detail) {
        comp = { kind: 'with', who: rng.pick(mates) };
      } else if (roll > 0.85) {
        const away = [...Array(S).keys()].filter((x) => x !== s && loc[x][t] !== r);
        if (away.length) comp = { kind: 'without', who: rng.pick(away) };
      }
      return { room: r, comp };
    })
  );

  // 범인의 거짓말: 사건 시각에 다른 방에 있었다고 한다
  let lieRoom = rng.int(R - 1);
  if (lieRoom >= crimeRoom) lieRoom++;
  const there = occupants(loc, crimeSlot, lieRoom);
  const elsewhere = [...Array(S).keys()].filter((x) => x !== culprit && loc[x][crimeSlot] !== lieRoom);
  const modes = ['plain', 'alone'];
  if (there.length) modes.push('withThere', 'withThere');
  if (elsewhere.length) modes.push('withAway');
  const mode = rng.pick(modes);
  let lieComp = null;
  if (mode === 'alone') lieComp = { kind: 'alone' };
  else if (mode === 'withThere') lieComp = { kind: 'with', who: rng.pick(there) };
  else if (mode === 'withAway') lieComp = { kind: 'with', who: rng.pick(elsewhere) };
  statements[culprit][crimeSlot] = { room: lieRoom, comp: lieComp };

  return { culprit, crimeSlot, crimeRoom, loc, statements };
}

/** 사건 시각에 다른 방에서 일어난 일과 범인의 앞뒤 행적: 범인을 가리는 데 쓰이는 증거 후보 */
function relevantFacts(world, traits, R) {
  const { culprit, crimeSlot, crimeRoom, loc } = world;
  const pool = [];
  for (let t = 0; t < T; t++) {
    if (t === crimeSlot) continue;
    if (loc[culprit][t] !== crimeRoom) pool.push({ kind: 'trail', slot: t, room: loc[culprit][t] });
  }
  for (let r = 0; r < R; r++) {
    if (r === crimeRoom) continue;
    const occ = occupants(loc, crimeSlot, r);
    pool.push({ kind: 'count', slot: crimeSlot, room: r, n: occ.length });
    if (occ.length && occ.every((s) => traits[s].foot === traits[occ[0]].foot)) {
      pool.push({ kind: 'foot', slot: crimeSlot, room: r, pattern: traits[occ[0]].foot });
    }
    for (const s of occ) pool.push({ kind: 'seen', slot: crimeSlot, room: r, who: s });
  }
  return pool;
}

/** 사건 시각이 아닌 때의 사실: 모두 참이지만 범인을 가리는 데는 쓸모없다 (시각을 확인하게 만드는 함정) */
function herringFacts(world, traits, R) {
  const { culprit, crimeSlot, crimeRoom, loc } = world;
  const pool = [];
  for (let t = 0; t < T; t++) {
    if (t === crimeSlot) continue;
    for (let r = 0; r < R; r++) {
      if (r === crimeRoom) continue;
      const occ = occupants(loc, t, r);
      for (const s of occ) {
        // 범인과 무늬가 같은 결백한 용의자가 찍힌 기록이 가장 그럴듯한 함정이다
        const weight = s !== culprit && traits[s].foot === traits[culprit].foot ? 3 : 1;
        for (let i = 0; i < weight; i++) pool.push({ kind: 'seen', slot: t, room: r, who: s });
      }
      pool.push({ kind: 'count', slot: t, room: r, n: occ.length });
    }
  }
  return pool;
}

function* subsets(n, k, start = 0, acc = []) {
  if (acc.length === k) {
    yield acc.slice();
    return;
  }
  for (let i = start; i < n; i++) {
    acc.push(i);
    yield* subsets(n, k, i + 1, acc);
    acc.pop();
  }
}

/** 증거 종류마다 맡는 장면 */
const SCENE_OF = { time: 'clock', cfoot: 'dust', foot: 'dust', cprint: 'fingerprint', trail: 'uv', count: 'cctv', seen: 'shred' };

function roomLoad(facts, crimeRoom) {
  const load = {};
  for (const f of facts) {
    const r = f.kind === 'time' || f.kind === 'cfoot' || f.kind === 'cprint' ? crimeRoom : f.room;
    load[r] = (load[r] || 0) + 1;
  }
  return load;
}

function pickEvidence(rng, world, traits, R, D, difficulty) {
  const { culprit, crimeSlot, crimeRoom } = world;
  const mandatory = [
    { kind: 'time', slot: crimeSlot },
    rng.bool() ? { kind: 'cfoot', pattern: traits[culprit].foot } : { kind: 'cprint', type: traits[culprit].print },
  ];
  const k = D.evidence - mandatory.length - D.herring;
  const pool = relevantFacts(world, traits, R);
  const probe = { suspects: traits, statements: world.statements, slots: SLOT_LABELS, crimeSlot, crimeRoom, culprit };
  const unique = (facts) => {
    const f = feasibleCulprits(probe, facts);
    return f.length === 1 && f[0] === culprit;
  };

  let best = [];
  let bestScore = -1;
  for (const idx of subsets(pool.length, k)) {
    const extra = idx.map((i) => pool[i]);
    const facts = mandatory.concat(extra);
    const load = roomLoad(facts, crimeRoom);
    if (Object.values(load).some((n) => n > EVIDENCE_PER_ROOM)) continue;
    if (!unique(facts)) continue;

    // 거짓말을 깨는 근거가 수첩에 하나는 있어야 고발할 수 있다
    probe.evidence = facts.map((fact) => ({ fact }));
    const ref = refuters(probe);
    if (ref.length === 0) continue;

    const kinds = new Set(extra.map((f) => SCENE_OF[f.kind]));
    let score = kinds.size * 2;
    const needed = extra.every((_, i) => !unique(mandatory.concat(extra.filter((__, j) => j !== i))));
    const direct = extra.some((f) => factRefutes(probe, culprit, f));
    if (difficulty === 0) score += direct ? 4 : 0;
    else score += needed ? 4 : 0;
    // 어려움: 증거 하나로 거짓말이 바로 깨지는 사건보다, 서로 어긋나는 두 진술 중
    // 누가 거짓말쟁이인지 다른 증거로 가려야 하는 사건을 고른다
    if (difficulty === 2) score += (unique(mandatory) ? 0 : 1) + (direct ? 0 : 2);
    if (score > bestScore) {
      bestScore = score;
      best = [extra];
    } else if (score === bestScore) best.push(extra);
  }
  if (!best.length) return null;

  const facts = mandatory.concat(rng.pick(best));
  const herrings = [];
  if (D.herring) {
    const load = roomLoad(facts, crimeRoom);
    const hp = rng.shuffle(herringFacts(world, traits, R));
    for (const f of hp) {
      if (herrings.length >= D.herring) break;
      if ((load[f.room] || 0) >= EVIDENCE_PER_ROOM) continue;
      // 이미 고른 증거와 같은 내용은 피한다
      if (facts.some((g) => g.kind === f.kind && g.slot === f.slot && g.room === f.room)) continue;
      herrings.push(f);
      load[f.room] = (load[f.room] || 0) + 1;
    }
    if (herrings.length < D.herring) return null;
  }
  return { facts, herrings };
}

function sceneFor(rng, fact, cs) {
  const type = SCENE_OF[fact.kind];
  switch (type) {
    case 'clock':
      return { type, hour: SLOT_HOURS[fact.slot], options: SLOT_LABELS.slice(), answer: fact.slot, mirrored: cs.difficulty >= 1 };
    case 'dust': {
      const all = rng.shuffle([...Array(FOOT_PATTERNS.length).keys()]);
      return { type, pattern: fact.pattern, options: all, answer: all.indexOf(fact.pattern) };
    }
    case 'fingerprint': {
      const all = rng.shuffle([...Array(PRINT_TYPES.length).keys()]);
      return { type, printType: fact.type, options: all, answer: all.indexOf(fact.type), rotate: rng.range(-40, 40) };
    }
    case 'uv':
      return { type, marks: 3 + cs.difficulty };
    case 'cctv':
      return { type, count: fact.n, max: 4 };
    case 'shred':
      return {
        type,
        lines: ['출입 기록', cs.slots[fact.slot], cs.rooms[fact.room].name, cs.suspects[fact.who].name],
        pieces: cs.difficulty >= 2 ? 9 : 6,
      };
    default:
      return { type };
  }
}

/** 쪽지 기호: 모양 + 숫자. 한 사건 안에서 겹치지 않는다. */
function makeCodes(rng, n) {
  const all = [];
  for (let s = 0; s < CODE_SHAPES.length; s++) for (let d = 1; d <= 9; d++) all.push({ shape: s, digit: d });
  return rng.shuffle(all).slice(0, n);
}

export function codeText(code) {
  return CODE_SHAPES[code.shape] + code.digit;
}

/**
 * 설정에서 이번 사건에 쓸 방과 용의자를 고른다.
 * 방은 최대 6개, 용의자는 난이도가 정한 수만큼 (더 많이 등록했으면 씨앗으로 고른다).
 */
export function castFor(setup) {
  const D = DIFFICULTY[setup.difficulty] || DIFFICULTY[1];
  const rooms = setup.rooms.slice(0, ROOMS_MAX);
  let suspects = setup.suspects.slice();
  if (suspects.length > D.suspects) {
    const keep = new Set(stream(setup.seed, 'cast').sample(suspects.map((_, i) => i), D.suspects));
    suspects = suspects.filter((_, i) => keep.has(i));
  }
  return { rooms, suspects, D };
}

/** 이 설정으로 사건을 만들 수 있는가. 안 되면 이유를 돌려준다. */
export function checkSetup(setup) {
  const D = DIFFICULTY[setup.difficulty] || DIFFICULTY[1];
  if (!setup.rooms || setup.rooms.length < 4) return '방을 4곳 이상 골라 주세요.';
  if (!setup.suspects || setup.suspects.length < D.suspects) {
    return '이 난이도는 용의자가 ' + D.suspects + '명 필요해요.';
  }
  return null;
}

/**
 * 사건을 만든다.
 * setup: { seed, difficulty, rooms:[{id,name,icon}], suspects:[{id,name,icon}], crimeRoom: 방 id | null }
 */
export function buildCase(setup) {
  const problem = checkSetup(setup);
  if (problem) throw new Error(problem);
  const { rooms, suspects, D } = castFor(setup);
  const difficulty = Math.max(0, Math.min(2, setup.difficulty | 0));
  const S = suspects.length;
  const R = rooms.length;
  const crimeRoomFixed = setup.crimeRoom ? rooms.findIndex((r) => r.id === setup.crimeRoom) : -1;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const rng = stream(setup.seed, 'case', attempt);
    const world = makeWorld(rng, S, R, crimeRoomFixed, D.detail);
    const foot = assignTrait(rng, S, world.culprit, FOOT_PATTERNS.length);
    const print = assignTrait(rng, S, world.culprit, PRINT_TYPES.length);
    const personas = rng.shuffle([...Array(PERSONAS.length).keys()]);
    const traits = suspects.map((_, s) => ({ foot: foot[s], print: print[s] }));
    const picked = pickEvidence(rng, world, traits, R, D, difficulty);
    if (!picked) continue;

    const cs = {
      seed: setup.seed,
      attempt,
      difficulty,
      slots: SLOT_LABELS.slice(),
      rooms: rooms.map((r) => ({ id: r.id, name: r.name, icon: r.icon })),
      suspects: suspects.map((p, s) => ({
        id: p.id,
        name: p.name,
        icon: p.icon,
        photo: p.photo || null,
        foot: foot[s],
        print: print[s],
        persona: personas[s % personas.length],
      })),
      culprit: world.culprit,
      crimeSlot: world.crimeSlot,
      crimeRoom: world.crimeRoom,
      loc: world.loc,
      statements: world.statements,
      evidence: [],
      tags: [],
    };

    const facts = picked.facts.map((fact) => ({ fact, herring: false })).concat(picked.herrings.map((fact) => ({ fact, herring: true })));
    // 시계와 현장 증거는 앞에 두고 나머지는 섞는다 (함정이 늘 마지막에 오지 않게)
    const rest = rng.shuffle(facts.slice(2));
    cs.evidence = facts.slice(0, 2).concat(rest).map((e, i) => ({
      id: 'e' + (i + 1),
      fact: e.fact,
      herring: e.herring,
      room: e.fact.kind === 'time' || e.fact.kind === 'cfoot' || e.fact.kind === 'cprint' ? cs.crimeRoom : e.fact.room,
      scene: sceneFor(rng, e.fact, cs),
    }));

    // 풀이기로 마지막 확인
    const feasible = feasibleCulprits(cs);
    if (feasible.length !== 1 || feasible[0] !== cs.culprit) continue;
    cs.refuters = refuters(cs);
    if (!cs.refuters.length) continue;

    // 쪽지: 증거는 그 일이 일어난 방에, 용의자는 쪽지가 적은 방부터 채운다
    const codes = makeCodes(rng, S + cs.evidence.length);
    const load = new Array(R).fill(0);
    cs.evidence.forEach((ev) => load[ev.room]++);
    const tags = cs.evidence.map((ev, i) => ({ id: 'e:' + ev.id, kind: 'evidence', ref: i, room: ev.room, code: codes[i] }));
    for (const s of rng.shuffle([...Array(S).keys()])) {
      const min = Math.min(...load);
      const room = rng.pick(load.map((n, r) => (n === min ? r : -1)).filter((r) => r >= 0));
      load[room]++;
      tags.push({ id: 's:' + cs.suspects[s].id, kind: 'suspect', ref: s, room, code: codes[cs.evidence.length + s] });
    }
    cs.tags = tags.sort((a, b) => a.room - b.room || (a.kind < b.kind ? 1 : -1));
    return cs;
  }
  throw new Error('사건을 만들지 못했어요. 씨앗을 바꿔 다시 시도해 주세요.');
}

/** 기호로 쪽지를 찾는다. 없으면 null. */
export function findTag(cs, shape, digit) {
  return cs.tags.find((t) => t.code.shape === shape && t.code.digit === digit) || null;
}
