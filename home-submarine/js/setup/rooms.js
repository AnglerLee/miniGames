// 준비 마법사 2단계: 방 고르기와 구역 배정.
// 방을 넣고 빼거나 구역을 바꾸면 쪽지 안내가 달라지므로, 붙임 표시를 비우기 전에 한 번 확인한다.
// 방 이름이나 그림만 고치는 것은 쪽지(방 id 로 정해진다)와 상관없어서 그대로 둔다.

import { h, fill, toast } from '../shared/dom.js';
import { josa } from '../shared/text.js';
import { ROOM_PRESETS, ROOM_ICONS, ROOMS_MIN, ROOMS_MAX } from '../shared/content.js';
import { state, nextRoomId, stations, normalizeRoles, confirmNotesReset, notesChanged, ROOM_NAME_MAX } from './state.js';
import { shake, choice, iconPicker, clip } from './ui.js';

const ROLE_NOTE = {
  storage: '부품을 가지러 자주 오는 곳',
};

export function renderRooms(ctx) {
  const s = state.setup;
  const n = s.rooms.length;
  const sameName = (r, name) => String(r.name || '').trim() === name;
  // 구역 배정표에서 처음 누른 줄 (다음에 누른 줄과 구역을 바꾼다)
  let picked = null;

  const presets = h('div', { class: 'choices auto', id: 'room-presets' });
  const paintPresets = () =>
    fill(
      presets,
      ROOM_PRESETS.map((p) => choice(p.icon + ' ' + p.name, s.rooms.some((r) => sameName(r, p.name)), () => togglePreset(p), { 'data-preset': p.name }))
    );

  /** 쪽지가 달라지는 변경을 한곳에서: 확인 → 바꾸기 → 배정 정리 → 붙임 표시 비우기 */
  async function structural(change) {
    if (!(await confirmNotesReset())) return false;
    change();
    normalizeRoles();
    notesChanged();
    ctx.rerender();
    return true;
  }

  async function addRoom(name, icon) {
    if (s.rooms.length >= ROOMS_MAX) {
      toast('방은 ' + ROOMS_MAX + '곳까지 고를 수 있어요. 다른 방을 먼저 빼 주세요.', 'bad');
      shake('#room-list');
      return false;
    }
    return structural(() => s.rooms.push({ id: nextRoomId(), name, icon }));
  }
  function removeRoom(id) {
    return structural(() => {
      const i = s.rooms.findIndex((r) => r.id === id);
      if (i >= 0) s.rooms.splice(i, 1);
    });
  }
  function togglePreset(p) {
    const hit = s.rooms.find((r) => sameName(r, p.name));
    if (hit) removeRoom(hit.id);
    else addRoom(p.name, p.icon);
  }

  const table = h('div', { class: 'role-table', id: 'role-table', role: 'list' });
  function paintTable() {
    const list = stations();
    fill(
      table,
      list.map((st) =>
        h(
          'button',
          {
            class: 'role-row' + (picked === st.room.id ? ' picked' : ''),
            type: 'button',
            role: 'listitem',
            'data-room': st.room.id,
            'data-role': st.role.id,
            style: { '--c': st.role.color },
            onClick: () => pickRow(st.room.id),
          },
          h('span', { class: 'room-side' }, h('span', { class: 'room-ico', 'aria-hidden': 'true', text: st.room.icon }), h('b', { text: String(st.room.name).trim() || '이름 없음' })),
          h('span', { class: 'arrow', 'aria-hidden': 'true', text: '→' }),
          h(
            'span',
            { class: 'role-side' },
            h('span', { class: 'station-dot', 'aria-hidden': 'true', text: st.role.icon }),
            h('span', { class: 'role-name' }, h('b', { text: st.role.name }), ROLE_NOTE[st.role.id] ? h('small', { text: ROLE_NOTE[st.role.id] }) : null)
          )
        )
      )
    );
    tableHelp.textContent = picked ? '구역을 바꿀 다른 방을 누르세요. (같은 줄을 다시 누르면 취소)' : '한 줄을 누르고 다른 줄을 누르면 두 방의 구역이 바뀌어요.';
    tableHelp.classList.toggle('on', !!picked);
  }
  const tableHelp = h('p', { class: 'small table-help', id: 'role-help', 'aria-live': 'polite' });

  async function pickRow(roomId) {
    if (picked === null) {
      picked = roomId;
      return paintTable();
    }
    if (picked === roomId) {
      picked = null;
      return paintTable();
    }
    const a = picked;
    picked = null;
    const list = stations();
    const ra = list.find((st) => st.room.id === a).role.id;
    const rb = list.find((st) => st.room.id === roomId).role.id;
    const ok = await structural(() => {
      normalizeRoles();
      s.roleOf[a] = rb;
      s.roleOf[roomId] = ra;
    });
    if (!ok) paintTable();
    else {
      const nameOf = (id) => String((s.rooms.find((r) => r.id === id) || {}).name || '').trim() || '이름 없는 방';
      toast(josa(nameOf(a), '과/와') + ' ' + nameOf(roomId) + '의 구역을 바꿨어요.', 'good');
    }
  }

  const list = h(
    'div',
    { class: 'room-list', id: 'room-list' },
    s.rooms.map((r) => {
      const pick = iconPicker(ROOM_ICONS, r.icon, (ic) => {
        r.icon = ic;
        paintPresets();
        paintTable();
        ctx.changed();
      }, (r.name || '방') + ' 그림 바꾸기');
      const input = h('input', {
        class: 'input grow',
        maxlength: ROOM_NAME_MAX,
        value: r.name,
        'data-name-of': r.id,
        'aria-label': '방 이름',
        onInput: () => {
          r.name = clip(input.value, ROOM_NAME_MAX);
          paintPresets();
          paintTable();
          ctx.changed();
        },
        onChange: () => {
          r.name = clip(input.value.trim(), ROOM_NAME_MAX);
          input.value = r.name;
          paintTable();
          ctx.changed();
        },
      });
      return h(
        'div',
        {},
        h('div', { class: 'room-row' }, pick.button, input, h('button', { class: 'x-btn', type: 'button', 'aria-label': (r.name || '이 방') + ' 빼기', 'data-remove-room': r.id, onClick: () => removeRoom(r.id) }, '×')),
        pick.grid
      );
    })
  );

  let addIcon = ROOM_ICONS.find((ic) => !s.rooms.some((r) => r.icon === ic)) || ROOM_ICONS[0];
  const addPick = iconPicker(ROOM_ICONS, addIcon, (ic) => (addIcon = ic), '새 방 그림 고르기');
  const addName = h('input', { class: 'input grow', id: 'room-add-name', maxlength: ROOM_NAME_MAX, placeholder: '예: 다락방', autocomplete: 'off', 'aria-label': '새 방 이름' });
  const addBtn = h('button', {
    class: 'btn small',
    type: 'button',
    id: 'room-add',
    onClick: async () => {
      const name = clip(addName.value.trim(), ROOM_NAME_MAX);
      if (!name) {
        toast('방 이름을 적어 주세요.', 'bad');
        shake(addName);
        return;
      }
      if (s.rooms.some((r) => sameName(r, name))) {
        toast('이미 고른 방이에요.', 'bad');
        shake(addName);
        return;
      }
      await addRoom(name, addIcon);
    },
  }, '추가');
  addName.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addBtn.click();
  });

  paintPresets();
  paintTable();
  const bad = n < ROOMS_MIN || n > ROOMS_MAX;
  return [
    h(
      'section',
      { class: 'card' },
      h('div', { class: 'row', style: { marginBottom: '6px' } }, h('h2', { text: '방을 골라 주세요', style: { margin: 0 } }), h('span', { class: 'chip count' + (bad ? ' bad' : ''), id: 'room-count', style: { marginLeft: 'auto' }, text: n + '곳 · ' + ROOMS_MIN + '~' + ROOMS_MAX + '곳' })),
      h('p', { class: 'soft small', style: { marginBottom: '10px' }, text: '아이가 걸어서 오갈 방이에요. 누르면 넣고, 다시 누르면 빼요.' }),
      presets,
      h('h3', { text: '고른 방 (이름은 고칠 수 있어요)' }),
      list,
      h('h3', { text: '직접 추가' }),
      h('div', { class: 'room-row' }, addPick.button, addName, addBtn),
      addPick.grid
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', { text: '방마다 잠수함 구역' }),
      tableHelp,
      table,
      h('p', { class: 'small muted', style: { marginTop: '10px' }, text: '방들이 서로 떨어져 있을수록 재미있어요. 부품 창고는 가운데쯤 있는 방이 좋습니다.' })
    ),
  ];
}
