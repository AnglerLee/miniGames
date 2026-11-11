// 준비 마법사 2~3단계: 방과 용의자 고르기.
// 방/용의자 수가 바뀌면 사건이 달라지므로, 넣고 빼기 전에는 guardChange 로 한 번 확인한다.

import { h, fill, toast, showModal, avatar } from '../shared/dom.js';
import { photos } from '../shared/store.js';
import { DIFFICULTY, ROOM_PRESETS, ROOM_ICONS, ROOMS_MIN, ROOMS_MAX, SUSPECT_ICONS } from '../shared/content.js';
import { state, nextId, guardChange, structureChanged, SUSPECTS_MAX, NAME_MAX } from './state.js';
import { shake, choice, iconPicker, clip } from './ui.js';
import { photoButton } from './photo.js';

const diffOf = (d) => DIFFICULTY[d] || DIFFICULTY[1];

// ---------- 2. 방 ----------

export function renderRooms(ctx) {
  const s = state.setup;
  if (s.crimeRoom && !s.rooms.some((r) => r.id === s.crimeRoom)) s.crimeRoom = null;
  const n = s.rooms.length;
  const sameName = (r, name) => String(r.name || '').trim() === name;

  const presets = h('div', { class: 'choices auto', id: 'room-presets' });
  const paintPresets = () =>
    fill(
      presets,
      ROOM_PRESETS.map((p) => choice(p.icon + ' ' + p.name, s.rooms.some((r) => sameName(r, p.name)), () => togglePreset(p), { 'data-preset': p.name }))
    );

  const crime = h('div', { class: 'choices', id: 'crime-choices' });
  const paintCrime = () =>
    fill(crime, [
      choice('알아서 정하기', !s.crimeRoom, () => setCrime(null), { 'data-crime': '' }),
      s.rooms.map((r) => choice(r.icon + ' ' + (String(r.name).trim() || '이름 없음'), s.crimeRoom === r.id, () => setCrime(r.id), { 'data-crime': r.id })),
    ]);

  async function addRoom(name, icon) {
    if (s.rooms.length >= ROOMS_MAX) {
      toast('방은 ' + ROOMS_MAX + '곳까지 고를 수 있어요. 다른 방을 먼저 빼 주세요.', 'bad');
      shake('#room-list');
      return false;
    }
    if (!(await guardChange())) return false;
    s.rooms.push({ id: nextId(s.rooms, 'r'), name, icon });
    structureChanged();
    ctx.rerender();
    return true;
  }
  async function removeRoom(id) {
    if (!(await guardChange())) return;
    const i = s.rooms.findIndex((r) => r.id === id);
    if (i < 0) return;
    s.rooms.splice(i, 1);
    if (s.crimeRoom === id) {
      s.crimeRoom = null;
      toast('사건 현장은 "알아서 정하기"로 바꿨어요.');
    }
    structureChanged();
    ctx.rerender();
  }
  function togglePreset(p) {
    const hit = s.rooms.find((r) => sameName(r, p.name));
    if (hit) removeRoom(hit.id);
    else addRoom(p.name, p.icon);
  }
  async function setCrime(id) {
    if ((s.crimeRoom || null) === id) return;
    paintCrime(); // 확인 전에는 눌린 표시를 되돌려 둔다
    if (!(await guardChange())) return;
    s.crimeRoom = id;
    structureChanged();
    paintCrime();
    ctx.changed();
  }

  const list = h(
    'div',
    { class: 'room-list', id: 'room-list' },
    s.rooms.map((r) => {
      const pick = iconPicker(ROOM_ICONS, r.icon, (ic) => {
        r.icon = ic;
        paintCrime();
        ctx.changed();
      }, r.name + ' 그림 바꾸기');
      const input = h('input', {
        class: 'input grow',
        maxlength: NAME_MAX,
        value: r.name,
        'data-name-of': r.id,
        'aria-label': '방 이름',
        onInput: () => {
          r.name = clip(input.value, NAME_MAX);
          paintPresets();
          paintCrime();
          ctx.changed();
        },
        onChange: () => {
          r.name = clip(input.value.trim(), NAME_MAX);
          input.value = r.name;
          ctx.changed();
        },
      });
      return h(
        'div',
        {},
        h('div', { class: 'room-row' }, pick.button, input, h('button', { class: 'x-btn', type: 'button', 'aria-label': '이 방 빼기', 'data-remove-room': r.id, onClick: () => removeRoom(r.id) }, '×')),
        pick.grid
      );
    })
  );

  let addIcon = ROOM_ICONS.find((ic) => !s.rooms.some((r) => r.icon === ic)) || ROOM_ICONS[0];
  const addPick = iconPicker(ROOM_ICONS, addIcon, (ic) => (addIcon = ic), '새 방 그림 고르기');
  const addName = h('input', { class: 'input grow', id: 'room-add-name', maxlength: NAME_MAX, placeholder: '예: 다락방', 'aria-label': '새 방 이름' });
  const addBtn = h('button', {
    class: 'btn small',
    type: 'button',
    id: 'room-add',
    onClick: async () => {
      const name = clip(addName.value.trim(), NAME_MAX);
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
  paintCrime();
  const bad = n < ROOMS_MIN || n > ROOMS_MAX;
  return [
    h(
      'section',
      { class: 'card' },
      h('div', { class: 'row' }, h('h2', { text: '아이가 돌아다닐 방' }), h('span', { class: 'chip count-chip' + (bad ? ' bad' : ''), id: 'room-count' }, n + ' / ' + ROOMS_MAX + '곳')),
      h('p', { class: 'soft small', style: { marginBottom: '10px' }, text: ROOMS_MIN + '~' + ROOMS_MAX + '곳을 눌러 골라 주세요. 쪽지는 고른 방에만 숨겨요.' }),
      presets
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', { text: '고른 방' }),
      h('p', { class: 'soft small', style: { marginBottom: '10px' }, text: '집에서 부르는 이름으로 고쳐도 돼요. 그림을 누르면 바꿀 수 있어요.' }),
      n ? list : h('p', { class: 'small muted', id: 'room-list', text: '아직 고른 방이 없어요.' }),
      h('h3', { text: '직접 추가' }),
      h('div', { class: 'room-row' }, addPick.button, addName, addBtn),
      addPick.grid
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', { text: '간식이 있던 방 (사건 현장)' }),
      h('p', { class: 'soft small', style: { marginBottom: '10px' }, text: '간식이 사라진 방이에요. 증거 쪽지 두 장이 이 방의 "간식이 있던 자리" 근처에 숨겨져요.' }),
      crime,
      h('p', { class: 'small muted', style: { marginTop: '8px' }, text: '그 방의 한 곳(식탁 위 등)을 간식이 있던 자리로 정해 두세요. 빈 간식 통이나 접시를 두면 더 실감 나요.' })
    ),
  ];
}

// ---------- 3. 용의자 ----------

export function renderSuspects(ctx) {
  const s = state.setup;
  const D = diffOf(s.difficulty);
  const n = s.suspects.length;

  async function addSuspect() {
    if (s.suspects.length >= SUSPECTS_MAX) {
      toast('용의자는 ' + SUSPECTS_MAX + '명까지예요.', 'bad');
      return;
    }
    if (!(await guardChange())) return;
    const icon = SUSPECT_ICONS.find((ic) => !s.suspects.some((p) => p.icon === ic)) || SUSPECT_ICONS[0];
    const id = nextId(s.suspects, 's');
    s.suspects.push({ id, name: '', icon, photo: null });
    structureChanged();
    ctx.rerender();
    const input = document.querySelector('[data-name-of="' + id + '"]');
    if (input) {
      input.scrollIntoView({ block: 'center' });
      input.focus({ preventScroll: true });
    }
  }
  async function removeSuspect(p) {
    if (p.photo) {
      const ok = await showModal({
        title: (String(p.name).trim() || '이 인형') + ' 빼기',
        text: '찍어 둔 사진도 함께 지워져요.',
        actions: [
          { label: '그만두기', value: false, kind: 'ghost' },
          { label: '빼기', value: true, kind: 'primary' },
        ],
      });
      if (!ok) return;
    }
    if (!(await guardChange())) return;
    const i = s.suspects.indexOf(p);
    if (i < 0) return;
    s.suspects.splice(i, 1);
    if (p.photo) photos.del(p.photo);
    structureChanged();
    ctx.rerender();
  }

  const cards = s.suspects.map((p) => {
    const face = avatar(p);
    const pick = iconPicker(SUSPECT_ICONS, p.icon, (ic) => {
      p.icon = ic;
      face.firstChild.textContent = ic;
      ctx.changed();
    }, '그림 바꾸기', { text: '그림 바꾸기', cls: 'btn small ghost' });
    const input = h('input', {
      class: 'input grow',
      maxlength: NAME_MAX,
      value: p.name,
      placeholder: '인형 이름',
      'data-name-of': p.id,
      'aria-label': '인형 이름',
      onInput: () => {
        p.name = clip(input.value, NAME_MAX);
        face.setAttribute('aria-label', p.name);
        ctx.changed();
      },
      onChange: () => {
        p.name = clip(input.value.trim(), NAME_MAX);
        input.value = p.name;
        ctx.changed();
      },
    });
    const key = 'suspect:' + p.id;
    return h(
      'div',
      { class: 'card sus-card', 'data-suspect': p.id },
      h('div', { class: 'sus-row' }, face, input, h('button', { class: 'x-btn', type: 'button', 'aria-label': '이 인형 빼기', 'data-remove-suspect': p.id, onClick: () => removeSuspect(p) }, '×')),
      h(
        'div',
        { class: 'tools' },
        pick.button,
        photoButton({
          key,
          maxSide: 640,
          label: p.photo ? '📷 다시 찍기' : '📷 사진',
          testId: key,
          onSaved: () => {
            p.photo = key;
            ctx.rerender();
          },
        }),
        p.photo
          ? h('button', {
              class: 'btn small ghost',
              type: 'button',
              'data-photo-del': key,
              onClick: () => {
                photos.del(key);
                p.photo = null;
                ctx.rerender();
              },
            }, '사진 지우기')
          : null
      ),
      pick.grid
    );
  });

  const short = n < D.suspects;
  return [
    h(
      'section',
      { class: 'card' },
      h('h2', { text: '집에 있는 인형으로 정해 주세요' }),
      h('p', { class: 'soft', text: '아이가 아끼는 인형일수록 재미있어요. 인형이 모자라면 로봇, 자동차, 그림도 좋아요.' }),
      h(
        'div',
        { class: 'row wrap', style: { marginTop: '10px' } },
        h('span', { class: 'chip', text: D.name + ' · ' + D.suspects + '명 필요' }),
        h('span', { class: 'chip' + (short ? ' count-chip bad' : ''), id: 'sus-count', text: n + '명 등록' })
      ),
      n > D.suspects
        ? h('p', { class: 'small muted', style: { marginTop: '8px' }, text: n + '명 중 ' + D.suspects + '명이 사건마다 골라져 나와요. 나머지는 이번에 쉬어요.' })
        : null,
      h('p', { class: 'small muted', style: { marginTop: '6px' }, text: '사진을 찍어 두면 아이 화면에 인형 얼굴로 나와요. 사진은 이 폰에만 저장돼요.' })
    ),
    h('div', { class: 'stack', id: 'sus-list' }, cards),
    h(
      'button',
      { class: 'btn ghost block', type: 'button', id: 'add-suspect', 'aria-disabled': String(n >= SUSPECTS_MAX), onClick: addSuspect },
      n >= SUSPECTS_MAX ? '용의자는 ' + SUSPECTS_MAX + '명까지예요' : '+ 인형 추가 (' + n + '/' + SUSPECTS_MAX + ')'
    ),
  ];
}
