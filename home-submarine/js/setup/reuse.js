// "쪽지 그대로 새 임무": 붙여 둔 쪽지(tagSeed)는 그대로 두고 임무(seed)만 새로 뽑는다.
// 대문과 준비 마법사 첫 화면이 함께 쓴다.

import { showModal, h } from '../shared/dom.js';
import { saveSetup, newSeed, clearRun, loadRun, missionKey } from '../shared/store.js';
import { TREASURE_KINDS, ROOMS_MIN, ROOMS_MAX } from '../shared/content.js';

/** 모든 방에 쪽지를 붙였다고 표시되어 있는가 */
export function allNotesPlaced(setup) {
  const p = (setup && setup.placed) || {};
  return !!setup && setup.rooms.length >= ROOMS_MIN && setup.rooms.every((r) => p[r.id] === true);
}

/** 준비 없이 바로 새 임무를 할 수 있는가 (쪽지가 다 붙어 있고 보물 정보가 있다) */
export function canReuse(setup) {
  return (
    allNotesPlaced(setup) &&
    setup.rooms.length <= ROOMS_MAX &&
    !!String((setup.treasure && setup.treasure.text) || '').trim() &&
    /^\d{4}$/.test(String(setup.pin || ''))
  );
}

/**
 * 보물 정보가 그대로인지 한 번 묻고 새 임무를 시작한다.
 *   keep  → seed 새로, missionNo + 1, 예측 비움, ready, 진행 저장 지움, play.html
 *   edit  → 보물상자 체크를 풀고 준비 화면 보물 단계로 (editHref 가 없으면 onEdit())
 */
export async function startSameNotes(setup, { href = 'play.html', editHref = 'setup.html#treasure', onEdit = null } = {}) {
  const kind = TREASURE_KINDS.find((k) => k.id === setup.treasure.kind) || TREASURE_KINDS[1];
  const run = loadRun();
  const running = run && run.key === missionKey(setup) && run.state.phase !== 'done';
  const body = h(
    'div',
    { class: 'reuse-modal' },
    h('p', { text: '새 간식을 넣은 보물상자를 지난번과 같은 곳에 숨기셨나요?' }),
    h('div', { class: 'reuse-treasure' }, h('span', { class: 'small muted', text: kind.lead }), h('b', { text: setup.treasure.text })),
    running ? h('p', { class: 'small warn-text', text: '아이가 하던 임무 기록은 지워져요.' }) : null
  );
  const v = await showModal({
    title: '보물 정보가 그대로인가요?',
    body,
    actions: [
      { label: '준비 화면에서 고치기', value: 'edit', kind: 'ghost' },
      { label: '보물 정보 그대로', value: 'keep', kind: 'primary' },
    ],
  });
  if (v === 'edit') {
    // 보물을 옮기려는 것이므로 "숨겼어요" 체크를 다시 받는다
    setup.placed = Object.assign({}, setup.placed, { treasure: false });
    setup.ready = false;
    saveSetup(setup);
    if (editHref) location.href = editHref;
    else if (onEdit) onEdit();
    return 'edit';
  }
  if (v !== 'keep') return null;
  setup.seed = newSeed();
  setup.missionNo = (setup.missionNo | 0) + 1;
  setup.predict = null;
  setup.ready = true;
  saveSetup(setup);
  clearRun();
  if (href) location.href = href;
  return 'keep';
}
