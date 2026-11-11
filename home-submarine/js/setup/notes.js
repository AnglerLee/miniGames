// 4단계: 쪽지 붙이기. 부모가 집 안을 돌며 보는 화면이라 방마다 카드 한 장, 할 일은 체크 한 번.

import { h, toast, showModal } from '../shared/dom.js';
import { newSeed } from '../shared/store.js';
import { tagText } from '../shared/tags.js';
import { CODE_SHAPE_NAMES, CODE_SHAPES, TREASURE_KINDS } from '../shared/content.js';
import { state, stations, placedRooms } from './state.js';
import { checkButton } from './ui.js';

const TREASURE_TODO = {
  lock: '간식을 넣고 숫자 자물쇠로 잠가 두세요.',
  place: '간식을 넣어 적어 둔 곳에 숨기세요.',
  key: '간식을 넣고 잠근 뒤, 열쇠를 적어 둔 곳에 두세요.',
  text: '간식을 넣어 준비해 두세요.',
};

export function renderNotes(ctx) {
  const s = state.setup;
  const list = stations();
  const total = list.length;

  const progressText = h('b', { id: 'note-progress' });
  const bar = h('i');
  const allDone = () => placedRooms() === total && s.placed.treasure && s.placed.safety;
  const paintProgress = () => {
    const done = placedRooms();
    progressText.textContent = '쪽지 ' + done + ' / ' + total;
    bar.style.width = Math.round((done / Math.max(1, total)) * 100) + '%';
  };
  const toggled = () => {
    paintProgress();
    ctx.changed();
    if (allDone()) toast('준비가 모두 끝났어요. 다음으로 넘어가세요.', 'good');
  };

  async function reroll() {
    const ok = await showModal({
      title: '쪽지를 새로 만들까요?',
      text: placedRooms()
        ? '모양과 숫자가 모두 달라져요.\n이미 붙인 쪽지는 떼고 새로 적어 붙여야 해요.'
        : '모양과 숫자가 모두 달라져요.',
      actions: [
        { label: '그만두기', value: false, kind: 'ghost' },
        { label: '새로 만들기', value: true, kind: 'primary' },
      ],
    });
    if (!ok) return;
    s.tagSeed = newSeed();
    // 방 쪽지 표시만 지운다. 보물상자와 바닥 정리는 쪽지와 상관없다.
    const keep = {};
    if (s.placed.treasure) keep.treasure = true;
    if (s.placed.safety) keep.safety = true;
    s.placed = keep;
    ctx.rerender();
    toast('쪽지를 새로 만들었어요.', 'good');
  }

  function noteCard(st) {
    const done = s.placed[st.room.id] === true;
    const card = h(
      'article',
      { class: 'card note-card' + (done ? ' done' : ''), 'data-room': st.room.id, style: { '--c': st.role.color } },
      h(
        'div',
        { class: 'note-top' },
        h('span', { class: 'note-code', 'data-note': st.room.id, text: tagText(st) }),
        h('div', { class: 'say' }, h('b', { text: '포스트잇에 이대로 적으세요' }), h('span', { class: 'small muted', text: CODE_SHAPE_NAMES[st.shape] + '(' + CODE_SHAPES[st.shape] + ') 모양과 숫자 ' + st.digits.join(' ') }))
      ),
      h(
        'div',
        { class: 'where' },
        h('span', { class: 'station-dot', 'aria-hidden': 'true', text: st.role.icon }),
        h(
          'div',
          {},
          h('div', { class: 'where-line' }, h('b', { class: 'room', text: st.room.icon + ' ' + st.room.name }), '에 붙이세요 · ', h('span', { class: 'role', text: st.role.name })),
          h('div', { class: 'small muted', text: '아이 눈높이, 방에 들어서면 바로 보이는 곳' })
        )
      )
    );
    card.append(
      checkButton({
        label: '붙였어요',
        on: done,
        onToggle: (v) => {
          if (v) s.placed[st.room.id] = true;
          else delete s.placed[st.room.id];
          card.classList.toggle('done', v);
          toggled();
        },
      })
    );
    card.lastChild.setAttribute('data-check', st.room.id);
    return card;
  }

  const tk = TREASURE_KINDS.find((k) => k.id === s.treasure.kind) || TREASURE_KINDS[1];
  const treasureCard = h(
    'article',
    { class: 'card check-card' + (s.placed.treasure ? ' done' : ''), id: 'treasure-card' },
    h(
      'div',
      { class: 'todo' },
      h('span', { class: 'big-ico', 'aria-hidden': 'true', text: '🎁' }),
      h('div', {}, h('b', { text: '보물상자' }), h('div', { class: 'small', text: TREASURE_TODO[tk.id] || TREASURE_TODO.place }), h('div', { class: 'small muted', text: tk.lead + ': ' + (s.treasure.text || '') }))
    ),
    checkButton({
      id: 'check-treasure',
      label: '보물상자를 숨겼어요',
      on: !!s.placed.treasure,
      onToggle: (v) => {
        s.placed.treasure = v;
        treasureCard.classList.toggle('done', v);
        toggled();
      },
    })
  );
  const safetyCard = h(
    'article',
    { class: 'card check-card' + (s.placed.safety ? ' done' : ''), id: 'safety-check-card' },
    h(
      'div',
      { class: 'todo' },
      h('span', { class: 'big-ico', 'aria-hidden': 'true', text: '🧹' }),
      h('div', {}, h('b', { text: '아이가 다닐 길' }), h('div', { class: 'small', text: '방 사이 바닥에 걸려 넘어질 물건이 없는지, 문턱과 계단을 한 번 더 봐 주세요.' }))
    ),
    checkButton({
      id: 'check-safety',
      label: '바닥을 치웠어요',
      on: !!s.placed.safety,
      onToggle: (v) => {
        s.placed.safety = v;
        safetyCard.classList.toggle('done', v);
        toggled();
      },
    })
  );

  paintProgress();
  return [
    h(
      'section',
      { class: 'card' },
      h('div', { class: 'row', style: { marginBottom: '8px' } }, progressText, h('span', { class: 'small muted', style: { marginLeft: 'auto' }, text: '다 붙이면 다음으로' })),
      h('div', { class: 'progress' }, bar),
      h('p', { class: 'small', style: { marginTop: '10px' }, text: '방마다 포스트잇 한 장. 모양과 숫자를 크고 진하게 적어 주세요. 아이는 폰이 묻는 숫자를 쪽지에서 찾아 눌러야 도착이 확인돼요.' }),
      h('p', { class: 'small muted', text: '쪽지를 그대로 두면 다음에는 이 단계 없이 바로 새 임무를 할 수 있습니다.' })
    ),
    h('div', { class: 'stack', id: 'note-list' }, list.map(noteCard)),
    treasureCard,
    safetyCard,
    h(
      'div',
      { class: 'row wrap reroll-row' },
      h('button', { class: 'btn small ghost', type: 'button', id: 'reroll', onClick: reroll }, '쪽지 새로 만들기'),
      h('span', { class: 'small muted', text: '쪽지가 떨어졌거나 아이가 숫자를 외워 버렸을 때' })
    ),
  ];
}
