// 구역 쪽지와 도착 확인.
// 쪽지에는 모양 하나와 숫자 네 개가 적혀 있다 (예: ▲ 4 8 1 6).
// 아이가 그 방에 왔는지는 쪽지의 숫자를 물어서 확인한다. 물을 때마다 질문이 달라진다.

import { stream } from './prng.js';
import { ROLES, CODE_SHAPES, ROOMS_MAX } from './content.js';

/**
 * 구역을 만든다. 쪽지는 tagSeed 로 정해지므로, 부모가 쪽지를 그대로 붙여 두면
 * 임무(seed)만 바꿔 여러 번 할 수 있다.
 * setup: { tagSeed, rooms:[{id,name,icon}], roleOf?: { [방 id]: 구역 id } }
 * 결과: [{ idx, role:{id,name,icon,color}, room:{id,name,icon}, shape: 0~5, digits:[숫자 4개] }]
 */
export function makeStations(setup) {
  const rooms = setup.rooms.slice(0, ROOMS_MAX);
  const roles = ROLES.slice(0, rooms.length);
  const rng = stream(setup.tagSeed, 'tags');
  const shapes = rng.shuffle([...Array(CODE_SHAPES.length).keys()]);

  // 부모가 구역을 직접 배정했으면 따르고, 남은 방은 남은 구역을 차례로 받는다
  const wanted = setup.roleOf || {};
  const taken = new Set();
  const assigned = rooms.map((room) => {
    const role = roles.find((r) => r.id === wanted[room.id] && !taken.has(r.id));
    if (role) taken.add(role.id);
    return role || null;
  });
  const free = roles.filter((r) => !taken.has(r.id));
  return rooms.map((room, idx) => {
    const role = assigned[idx] || free.shift();
    // 한 쪽지 안에서는 숫자가 겹치지 않는다 ("가장 큰 숫자" 질문의 답이 하나가 되게)
    const digits = stream(setup.tagSeed, 'digits', room.id).sample([1, 2, 3, 4, 5, 6, 7, 8, 9], 4);
    return { idx, role, room: { id: room.id, name: room.name, icon: room.icon }, shape: shapes[idx], digits };
  });
}

/** 쪽지에 적을 글자. 예: "▲ 4 8 1 6" */
export function tagText(station) {
  return CODE_SHAPES[station.shape] + ' ' + station.digits.join(' ');
}

const ORDINAL = ['첫째', '둘째', '셋째', '넷째'];

/**
 * 도착 확인 질문을 만든다.
 * kinds: 'pos'(몇째 숫자) 'pair'(두 숫자를 차례로) 'max'(가장 큰) 'min'(가장 작은)
 * 결과: { kind, text, answer:[숫자…] }
 */
export function makeQuery(rng, station, kinds) {
  const kind = rng.pick(kinds && kinds.length ? kinds : ['pos']);
  const d = station.digits;
  if (kind === 'pair') {
    const [a, b] = rng.sample([0, 1, 2, 3], 2);
    return { kind, text: ORDINAL[a] + ' 숫자와 ' + ORDINAL[b] + ' 숫자를 차례로', answer: [d[a], d[b]] };
  }
  if (kind === 'max') return { kind, text: '가장 큰 숫자', answer: [Math.max(...d)] };
  if (kind === 'min') return { kind, text: '가장 작은 숫자', answer: [Math.min(...d)] };
  const i = rng.int(4);
  return { kind: 'pos', text: ORDINAL[i] + ' 숫자', answer: [d[i]] };
}

/** 아이가 누른 숫자들이 답과 같은가 */
export function checkAnswer(query, input) {
  return Array.isArray(input) && input.length === query.answer.length && input.every((v, i) => Number(v) === query.answer[i]);
}
