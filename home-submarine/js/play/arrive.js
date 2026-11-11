// 구역에 도착한 뒤 할 일.
// 엔진의 actionsAt 이 알려 주는 일을 정해진 순서(수리 → 암호 입력 → 암호 보기 → 알림)로 하나씩 연다.
// 아이가 판을 닫으면(다른 급한 곳으로 가려고) 남은 일은 버린다. 다시 오면 다시 도착 확인을 한다.

import { toast, buzz } from '../shared/dom.js';
import { actionsAt } from '../shared/engine.js';
import { PARTS } from '../shared/content.js';
import { josa } from '../shared/text.js';
import { G, send } from './game.js';
import { note, clearNote } from './fx.js';
import { closeAll, closeWhere } from './overlay.js';
import { openTask } from './taskpanel.js';
import { openShowCode, openEnterCode } from './relay.js';
import { audio } from './audio.js';

const ORDER = ['task', 'enterCode', 'showCode', 'picked', 'needPart', 'needCode', 'full'];
/** 수리 완료 연출을 보여 준 뒤 다음 판을 연다 */
const AFTER_DONE_MS = 900;

let queue = null; // { station, items:[{ type, id }] }

/** 남은 일을 버린다. keepNote 면 떠 있는 알림(수리 완료 등)은 끝까지 보여 준다 */
export function cancelArrival(keepNote = false) {
  queue = null;
  if (!keepNote) clearNote();
}

/** 이 경보를 다루는 판이 열려 있으면 닫는다 (시간 초과로 경보가 사라졌을 때) */
export function closeForAlert(id, how) {
  return closeWhere((o) => o.alertId === id, how);
}

/** 도착 확인을 통과했다. 엔진에 알리고, 그 구역에서 할 일을 차례로 연다. */
export function arriveAt(station) {
  cancelArrival();
  closeAll('stage');
  const before = G.state.phase;
  send({ type: 'checkin', station });
  audio.sfx('checkin');
  buzz(30);
  const s = G.state;
  const st = G.stations[station];
  if (before === 'dock') {
    // 마지막 구역이면 단계 완료 화면으로 바로 넘어간다
    if (s.phase === 'dock') {
      audio.sfx('good');
      note({ icon: st.role.icon, text: '전원 켜짐', sub: st.role.name + ' · ' + st.room.name, kind: 'power', color: st.role.color, ms: 1300 });
    }
    return;
  }
  // 크레인 순서는 맞았는지 틀렸는지를 엔진 기록으로 보고 연출한다 (effects.js)
  if (before !== 'run' || s.phase !== 'run') return;
  const acts = actionsAt(s, station);
  if (acts.length === 1 && acts[0].type === 'idle') {
    toast('이상 없음. 여기는 고장이 없어', '', 1800);
    return;
  }
  acts.sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
  queue = { station, items: acts.map((a) => ({ type: a.type, id: a.alert ? a.alert.id : null })) };
  step();
}

function step() {
  const q = queue;
  if (!q) return;
  const item = q.items.shift();
  if (!item) {
    queue = null;
    return;
  }
  // 앞의 일을 하는 동안 상황이 바뀌었을 수 있으니 지금도 할 수 있는 일인지 다시 본다
  const act = G.state.phase === 'run' && actionsAt(G.state, q.station).find((a) => a.type === item.type && (a.alert ? a.alert.id : null) === item.id);
  if (!act) return step();
  const a = act.alert;
  const next = () => {
    if (queue === q) step();
  };
  const ended = (how) => {
    if (queue !== q) return;
    if (how === 'done') setTimeout(next, AFTER_DONE_MS);
    else queue = null;
  };
  const from = a.source >= 0 ? G.stations[a.source] : null;
  const st = G.stations[q.station];
  switch (item.type) {
    case 'task':
      return openTask(a, { onEnd: ended });
    case 'enterCode':
      return openEnterCode(a, { onEnd: ended });
    case 'showCode':
      return openShowCode(a, { onEnd: (how) => (how === 'done' ? next() : ended(how)) });
    case 'picked': {
      const p = PARTS[a.part];
      audio.sfx('pick');
      buzz(40);
      return note({ icon: p.icon, text: josa(p.name, '을/를') + ' 챙겼어', sub: josa(G.stations[a.station].room.name, '으로/로') + ' 가서 고쳐', kind: 'pick', color: st.role.color, ms: 1200 }, next);
    }
    case 'full':
      audio.sfx('bad');
      return note({ icon: '✋', text: '손이 꽉 찼어', sub: '든 부품부터 써', kind: 'bad', ms: 2000 }, next);
    case 'needPart': {
      const p = PARTS[a.part];
      audio.sfx('bad');
      return note({ icon: p.icon, text: '부품이 없어', sub: from.room.name + '에서 ' + josa(p.name, '을/를') + ' 챙겨 와', kind: 'bad', ms: 2600 }, next);
    }
    case 'needCode':
      audio.sfx('bad');
      return note({ icon: '👀', text: '아직 좌표를 못 봤어', sub: from.room.name + '에 먼저 가', kind: 'bad', ms: 2600 }, next);
    default:
      return step();
  }
}
