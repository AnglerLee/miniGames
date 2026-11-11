// 5단계: 쪽지 붙이기. 부모가 가장 오래 머무는 화면이라 할 일을 방별로 묶고, 한 장씩 체크하게 한다.

import { h, toast, showModal, avatar } from '../shared/dom.js';
import { newSeed, photos } from '../shared/store.js';
import { codeText } from '../shared/case.js';
import { DIFFICULTY, CODE_SHAPE_NAMES, TREASURE_KINDS } from '../shared/content.js';
import { evidenceTitle, evidenceIcon, statementLine, itemText } from '../shared/text.js';
import { state, save, currentCase, syncPlaced, placedCount, placingStarted, resetPlaced, structureChanged, HINT_MAX } from './state.js';
import { photoButton, photoThumb } from './photo.js';
import { clip } from './ui.js';

// 화면을 다시 그려도(사진을 넣은 뒤 등) 정답 칸이 열린 채로 있게
let answerOpen = false;

const TREASURE_TODO = {
  lock: '간식을 넣고 숫자 자물쇠로 잠가 두세요',
  place: '간식을 넣어 적어 둔 곳에 숨기세요',
  key: '간식을 넣고 잠근 뒤, 열쇠를 적어 둔 곳에 두세요',
  text: '간식을 넣어 준비해 두세요',
};

function setPlaced(id, patch) {
  const s = state.setup;
  // 보물상자는 쪽지가 아니므로 힌트·사진 칸 없이 { done } 만 둔다
  if (id === 'treasure') s.placed.treasure = { done: !!patch.done };
  else s.placed[id] = Object.assign({ done: false, hint: '', photo: null }, s.placed[id], patch);
}

export function renderTags(ctx) {
  const s = state.setup;
  const { cs, error } = currentCase();
  if (!cs) return errorCard(ctx, error);
  if (syncPlaced(cs)) toast('방이나 인형이 바뀌어서 쪽지를 새로 정했어요.', '', 3200);
  const D = DIFFICULTY[cs.difficulty];
  const total = cs.tags.length;

  const progressText = h('b', { id: 'tag-progress' });
  const bar = h('i');
  const paintProgress = () => {
    const done = placedCount(cs);
    progressText.textContent = '쪽지 ' + done + ' / ' + total;
    bar.style.width = Math.round((done / total) * 100) + '%';
  };

  async function reroll() {
    if (placingStarted()) {
      const ok = await showModal({
        title: '다른 사건으로 바꿀까요?',
        text: '기호가 모두 달라져요.\n이미 붙인 쪽지와 적어 둔 힌트는 처음부터 다시 해야 해요.',
        actions: [
          { label: '그만두기', value: false, kind: 'ghost' },
          { label: '바꾸기', value: true, kind: 'primary' },
        ],
      });
      if (!ok) return;
    }
    s.seed = newSeed();
    s.placedSig = null;
    await resetPlaced();
    structureChanged();
    save();
    ctx.rerender();
    toast('범인과 쪽지를 새로 정했어요.', 'good');
  }

  function checkButton(id, label, onToggle) {
    const btn = h('button', {
      class: 'check',
      type: 'button',
      'data-check': id,
      'aria-pressed': String(!!(s.placed[id] && s.placed[id].done)),
      onClick: () => {
        const done = !(s.placed[id] && s.placed[id].done);
        setPlaced(id, { done });
        btn.setAttribute('aria-pressed', String(done));
        onToggle(done);
        paintProgress();
        ctx.changed();
        if (done && placedCount(cs) === total && s.placed.treasure && s.placed.treasure.done) toast('준비가 모두 끝났어요.', 'good');
      },
    }, h('span', { class: 'box' }), label);
    return btn;
  }

  function tagCard(t) {
    const p = s.placed[t.id] || {};
    const room = cs.rooms[t.room];
    let todo;
    if (t.kind === 'suspect') {
      const who = cs.suspects[t.ref];
      todo = h('div', { class: 'todo' }, avatar(who, 'small'), h('div', {}, h('b', { text: who.name }), '에게 붙이고 ', h('b', { text: room.name }), '에 두세요'));
    } else {
      const ev = cs.evidence[t.ref];
      const near = t.room === cs.crimeRoom;
      todo = h(
        'div',
        { class: 'todo' },
        h('span', { class: 'ev-ico', text: evidenceIcon(ev) }),
        h('div', {}, h('b', { text: room.name }), near ? '의 간식이 있던 자리 근처에 숨기세요' : ' 어딘가에 숨기세요', h('span', { class: 'ev-name', text: '증거: ' + evidenceTitle(cs, ev) }))
      );
    }
    const hint = h('input', {
      class: 'input',
      maxlength: HINT_MAX,
      autocomplete: 'off',
      placeholder: t.kind === 'suspect' ? '둔 곳 (예: 책장 위)' : '숨긴 곳 (예: 쿠션 밑)',
      'aria-label': '숨긴 곳 힌트',
      'data-hint': t.id,
      value: p.hint || '',
      onInput: () => {
        setPlaced(t.id, { hint: clip(hint.value, HINT_MAX) });
        ctx.changed();
      },
    });
    const key = 'tag:' + t.id;
    // 힌트 글과 사진 버튼을 한 줄에 둔다 (쪽지가 많아 카드가 길어지지 않게)
    const hintRow = h(
      'div',
      { class: 'hint-row' },
      hint,
      photoButton({
        key,
        maxSide: 1024,
        label: '📷 사진',
        testId: key,
        onSaved: () => {
          setPlaced(t.id, { photo: key });
          ctx.rerender();
        },
      })
    );
    hint.classList.add('grow');
    const photoRow = p.photo
      ? h(
          'div',
          { class: 'row' },
          photoThumb(p.photo),
          h('span', { class: 'small muted grow', text: '힌트 사진이 있어요. 아이가 많이 막히면 보여 줘요.' }),
          h('button', {
            class: 'btn small ghost',
            type: 'button',
            'data-photo-del': key,
            onClick: () => {
              photos.del(key);
              setPlaced(t.id, { photo: null });
              ctx.rerender();
            },
          }, '지우기')
        )
      : null;
    const card = h(
      'article',
      { class: 'card tag-card' + (p.done ? ' done' : ''), 'data-tag': t.id },
      h(
        'div',
        { class: 'tag-top' },
        h('span', { class: 'note-code', text: codeText(t.code) }),
        h('div', { class: 'say' }, h('b', { text: '포스트잇에 이대로 적으세요' }), CODE_SHAPE_NAMES[t.code.shape] + ' 모양과 숫자 ' + t.code.digit)
      ),
      todo,
      hintRow,
      photoRow
    );
    card.append(checkButton(t.id, '붙였어요', (done) => card.classList.toggle('done', done)));
    return card;
  }

  const groups = cs.rooms.map((room, r) => {
    const tags = cs.tags.filter((t) => t.room === r);
    if (!tags.length) return null;
    return h(
      'section',
      { class: 'room-group', 'data-room': room.id },
      h('h3', {}, room.icon + ' ' + room.name, r === cs.crimeRoom ? h('span', { class: 'chip crime', text: '간식이 있던 방' }) : null, h('span', { class: 'chip', text: tags.length + '장' })),
      tags.map(tagCard)
    );
  });

  const tk = TREASURE_KINDS.find((k) => k.id === s.treasure.kind) || TREASURE_KINDS[0];
  const treasureCard = h(
    'article',
    { class: 'card tag-card' + (s.placed.treasure && s.placed.treasure.done ? ' done' : ''), id: 'treasure-card' },
    h(
      'div',
      { class: 'todo' },
      h('span', { class: 'ev-ico', text: '🎁' }),
      h('div', {}, h('b', { text: '보물상자' }), '에 ' + (TREASURE_TODO[tk.id] || TREASURE_TODO.place), h('span', { class: 'ev-name', text: tk.lead + ': ' + (s.treasure.text || '') }))
    )
  );
  const tCheck = checkButton('treasure', '보물상자를 숨겼어요', (done) => treasureCard.classList.toggle('done', done));
  tCheck.id = 'treasure-check';
  treasureCard.append(tCheck);

  paintProgress();
  return [
    h(
      'section',
      { class: 'card case-head' },
      h('div', { class: 'row' }, h('h2', { text: '사건 No.' + s.caseNo, style: { margin: 0 } }), h('span', { class: 'chip', style: { marginLeft: 'auto' }, text: D.name + ' · 쪽지 ' + total + '장' })),
      h('div', { class: 'small muted', text: '이번 사건에 나오는 용의자' }),
      h('div', { class: 'faces', id: 'cast' }, cs.suspects.map((p) => h('div', { class: 'face', 'data-cast': p.id }, avatar(p, 'small'), p.name))),
      h('button', { class: 'btn small ghost', type: 'button', id: 'reroll', onClick: reroll }, '다른 사건으로 바꾸기')
    ),
    h(
      'section',
      { class: 'card' },
      h('div', { class: 'row', style: { marginBottom: '8px' } }, progressText, h('span', { class: 'small muted', style: { marginLeft: 'auto' }, text: '다 붙이면 다음으로' })),
      h('div', { class: 'progress' }, bar),
      h('p', { class: 'small', style: { marginTop: '10px' }, text: '포스트잇에 기호를 크게 적어 안내한 곳에 두세요. 아이가 쪽지를 찾아 기호를 폰에 넣으면 내용이 열려요.' }),
      h('p', { class: 'small muted', text: '숨긴 곳 힌트를 적어 두면 아이가 막혔을 때 게임이 대신 알려 줘서, 부모가 나서지 않아도 됩니다.' }),
      h(
        'div',
        { class: 'row wrap', style: { marginTop: '10px' } },
        h('a', { class: 'btn small ghost', href: 'print.html', target: '_blank', rel: 'noopener', id: 'print-link' }, '🖨 쪽지 인쇄하기'),
        h('span', { class: 'small muted', text: '프린터가 있을 때만. 오려서 붙이면 돼요.' })
      )
    ),
    groups,
    h('section', { class: 'room-group' }, h('h3', {}, '🎁 보물상자'), treasureCard),
    answerCard(cs),
  ];
}

function answerCard(cs) {
  const c = cs.culprit;
  const box = h(
    'details',
    { class: 'card answer', id: 'answer', open: answerOpen },
    h('summary', {}, '🔒 정답 보기 (부모만)'),
    h('p', { class: 'small muted', style: { marginTop: '4px' }, text: '아이에게 보이지 않게 조심하세요.' }),
    h(
      'dl',
      {},
      h('dt', { text: '범인' }),
      h('dd', {}, h('span', { class: 'row' }, avatar(cs.suspects[c], 'small'), h('b', { text: cs.suspects[c].name }))),
      h('dt', { text: '사건' }),
      h('dd', { text: cs.slots[cs.crimeSlot] + ' · ' + cs.rooms[cs.crimeRoom].name }),
      h('dt', { text: '거짓말' }),
      h('dd', { text: statementLine(cs, c, cs.crimeSlot) }),
      h('dt', { text: '깨는 근거' }),
      h('dd', {}, h('ul', {}, cs.refuters.map((r) => h('li', { text: itemText(cs, r) }))))
    ),
    h('p', { class: 'small muted', style: { marginTop: '10px' }, text: '아이는 범인, 거짓말한 시각, 거짓말을 깨는 근거 하나를 골라 고발해요.' })
  );
  box.addEventListener('toggle', () => (answerOpen = box.open));
  return box;
}

function errorCard(ctx, error) {
  return h(
    'section',
    { class: 'card' },
    h('h2', { text: '사건을 만들지 못했어요' }),
    h('p', { class: 'soft', text: error || '알 수 없는 문제가 생겼어요.' }),
    h(
      'div',
      { class: 'stack', style: { marginTop: '12px' } },
      h('button', {
        class: 'btn primary block',
        type: 'button',
        onClick: () => {
          state.setup.seed = newSeed();
          ctx.rerender();
        },
      }, '다른 사건으로 다시 만들기'),
      h('button', { class: 'btn ghost block', type: 'button', onClick: () => ctx.go(1) }, '설정 다시 보기')
    )
  );
}
