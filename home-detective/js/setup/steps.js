// 준비 마법사 0, 1, 4단계: 안내, 기본 설정, 보물. (2~3단계 방과 용의자는 cast.js)
// 글자 입력은 화면을 다시 그리지 않고 값만 저장한다 (다시 그리면 폰 자판이 닫힌다).

import { h, toast, showModal } from '../shared/dom.js';
import { newSeed, clearRun } from '../shared/store.js';
import { josa } from '../shared/text.js';
import { DIFFICULTY, TREASURE_KINDS, BONUS_RULES } from '../shared/content.js';
import { state, save, guardChange, structureChanged, activeRun, usedBefore, resetPlaced, NAME_MAX, MIN_MINUTES, MAX_MINUTES } from './state.js';
import { choiceGroup, field, clip } from './ui.js';

const diffOf = (d) => DIFFICULTY[d] || DIFFICULTY[1];
const notesOf = (D) => D.suspects + D.evidence;

// ---------- 0. 안내 ----------

export function renderIntro(ctx) {
  const s = state.setup;
  const D = diffOf(s.difficulty);
  const item = (ico, title, sub) => h('li', {}, h('span', { class: 'ico', text: ico }), h('div', {}, h('b', { text: title }), h('div', { class: 'small muted', text: sub })));
  const box = (title, value) => h('div', {}, title, h('b', { text: value }));
  return [
    usedBefore() ? reuseCard(ctx) : null,
    h(
      'section',
      { class: 'card' },
      h('h2', { text: '준비는 10분이면 돼요' }),
      h('p', { class: 'soft', text: '방과 인형을 고르면 앱이 사건을 만들어요. 어느 쪽지를 어디에 둘지도 하나씩 알려 드려요.' }),
      h('h3', { text: '준비물' }),
      h(
        'ul',
        { class: 'supplies' },
        item('📝', '포스트잇 ' + notesOf(D) + '장과 펜', '쪽지마다 기호 하나(예: ★3)를 크게 적어요.'),
        item('🧸', '인형 ' + D.suspects + '개', '용의자 역할이에요. 로봇, 자동차, 그림도 좋아요.'),
        item('🎁', '보물상자와 간식', '상자나 봉투면 충분해요. 범인을 잡으면 찾을 수 있어요.')
      ),
      h('p', {
        class: 'small muted',
        style: { marginTop: '8px' },
        text: '난이도별 쪽지·인형 수: ' + DIFFICULTY.map((d) => d.name + ' ' + notesOf(d) + '장·' + d.suspects + '개').join(', '),
      }),
      h('h3', { text: '걸리는 시간' }),
      h('div', { class: 'time-bar' }, box('부모 준비', '10분'), box('아이 수사', '20~30분'), box('부모', '관찰만')),
      h('h3', { text: '이렇게 진행돼요' }),
      h(
        'ol',
        { class: 'steps-list' },
        h('li', { text: '방, 인형, 보물을 고르면 앱이 사건을 만들어요.' }),
        h('li', { text: '안내대로 포스트잇에 기호를 적어 인형에 붙이거나 방에 숨겨요.' }),
        h('li', { text: '폰을 아이에게 건네고, 끝날 때까지 지켜봐 주세요.' })
      )
    ),
  ];
}

function reuseCard(ctx) {
  const s = state.setup;
  const D = diffOf(s.difficulty);
  return h(
    'section',
    { class: 'card reuse' },
    h('h2', { text: '지난번 설정이 있어요' }),
    h('p', { class: 'soft', text: '사건 No.' + s.caseNo + ' · 방 ' + s.rooms.length + '곳 · 인형 ' + s.suspects.length + '개 · ' + D.name }),
    h(
      'div',
      { class: 'stack', style: { marginTop: '12px' } },
      h('button', { class: 'btn gold block', type: 'button', id: 'reuse-btn', onClick: () => reuseLast(ctx) }, '지난번 방과 인형 그대로 새 사건 만들기'),
      h('p', { class: 'small muted', text: '방, 인형, 사진, 보물 방식은 그대로 두고 범인과 쪽지만 새로 정해요.' }),
      s.ready
        ? h('button', { class: 'btn ghost block', type: 'button', id: 'review-btn', onClick: () => ctx.go(5) }, '지금 사건 쪽지와 정답 다시 보기')
        : null
    )
  );
}

async function reuseLast(ctx) {
  if (activeRun()) {
    const ok = await showModal({
      title: '수사가 진행 중이에요',
      text: '새 사건을 만들면 아이가 하던 수사 기록이 지워져요.',
      actions: [
        { label: '그만두기', value: false, kind: 'ghost' },
        { label: '새 사건 만들기', value: true, kind: 'primary' },
      ],
    });
    if (!ok) return;
  }
  const s = state.setup;
  s.seed = newSeed();
  s.caseNo = (s.caseNo | 0) + 1;
  s.predict = null;
  s.ready = false;
  s.placedSig = null;
  // 보물 방식은 그대로 두되, 숨긴 곳은 매번 달라지므로 다시 적게 한다 (지난번 글은 한 번 눌러 되살릴 수 있다)
  const prev = String(s.treasure.text || '').trim();
  if (prev) state.wiz.prevTreasure = prev;
  s.treasure.text = '';
  state.wiz.predict = {};
  await resetPlaced({ keepTreasure: false });
  clearRun();
  save();
  toast(josa('사건 No.' + s.caseNo, '을/를') + ' 새로 만들어요.', 'good');
  ctx.go(1);
}

// ---------- 1. 기본 설정 ----------

const DIFF_NOTE = [
  '처음 하는 아이에게 권해요. 진술에 누구와 함께 있었는지가 자주 나와요.',
  '추리 게임을 몇 번 해 본 아이에게 맞아요.',
  '진술이 짧아지고, 사건과 상관없는 함정 증거가 하나 섞여요.',
];

export function renderBasic(ctx) {
  const s = state.setup;
  const wiz = state.wiz;

  const nameHelp = h('p', { class: 'small muted' });
  const paintName = () => {
    const n = String(s.detective || '').trim();
    nameHelp.textContent = n ? '게임 속에서 "' + n + ' 탐정"이라고 불러요.' : '비워 두면 그냥 "탐정"이라고 불러요.';
  };
  const name = h('input', {
    class: 'input',
    id: 'detective',
    maxlength: NAME_MAX,
    placeholder: '예: 지우',
    autocomplete: 'off',
    value: s.detective || '',
    onInput: () => {
      s.detective = clip(name.value, NAME_MAX);
      paintName();
      ctx.changed();
    },
    onChange: () => {
      s.detective = clip(name.value.trim(), NAME_MAX);
      name.value = s.detective;
      ctx.changed();
    },
  });
  paintName();

  const range = h('input', { type: 'range', min: 0, max: 2, step: 1, id: 'difficulty', 'aria-label': '난이도', value: s.difficulty });
  const ticks = DIFFICULTY.map((d, i) => h('button', { type: 'button', 'data-diff': i, onClick: () => setDiff(i) }, d.name));
  const desc = h('div', { class: 'diff-desc', id: 'diff-desc' });
  const note = h('p', { class: 'small muted' });

  const value = h('div', { class: 'value', id: 'minutes-value' });
  const mrange = h('input', { type: 'range', min: MIN_MINUTES, max: MAX_MINUTES, step: 1, id: 'minutes', 'aria-label': '제한 시간(분)', value: s.minutes });
  const resetBtn = h('button', { class: 'btn small ghost', type: 'button', id: 'minutes-reset' }, '난이도 기본값으로');
  const minutesNote = h('p', { class: 'small muted' });

  function paint() {
    const D = diffOf(s.difficulty);
    range.value = s.difficulty;
    ticks.forEach((b, i) => b.setAttribute('aria-pressed', String(i === s.difficulty)));
    // 항목 안에서는 줄이 바뀌지 않게 (" · " 에서만 바뀐다)
    desc.textContent = ['용의자 ' + D.suspects + '명', '증거 ' + D.evidence + '개', '쪽지 ' + notesOf(D) + '장', '제한 ' + s.minutes + '분']
      .map((x) => x.replace(' ', '\u00a0'))
      .join(' · ');
    note.textContent = DIFF_NOTE[s.difficulty] || '';
    value.textContent = s.minutes + '분';
    mrange.value = s.minutes;
    const custom = wiz.minutesTouched && s.minutes !== D.minutes;
    resetBtn.hidden = !custom;
    minutesNote.textContent = custom
      ? '직접 정한 시간이에요. 난이도를 바꿔도 그대로 둘게요.'
      : D.name + ' 난이도 기본 시간이에요. 시간을 넘겨도 수사는 계속할 수 있고, 등급만 낮아져요.';
  }

  async function setDiff(v) {
    if (v === s.difficulty) return;
    range.value = s.difficulty; // 확인을 받기 전에는 슬라이더를 원래 자리에 둔다
    if (!(await guardChange())) return;
    s.difficulty = v;
    if (!wiz.minutesTouched) s.minutes = diffOf(v).minutes;
    structureChanged();
    paint();
    ctx.changed();
  }
  function setMinutes(m) {
    m = Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, Math.round(m)));
    if (m === s.minutes) return paint();
    s.minutes = m;
    wiz.minutesTouched = true;
    paint();
    ctx.changed();
  }
  range.addEventListener('input', () => setDiff(+range.value));
  mrange.addEventListener('input', () => setMinutes(+mrange.value));
  resetBtn.addEventListener('click', () => {
    wiz.minutesTouched = false;
    s.minutes = diffOf(s.difficulty).minutes;
    paint();
    ctx.changed();
  });
  paint();

  return [
    h('section', { class: 'card' }, field('탐정 이름', name, { optional: true, help: nameHelp })),
    h(
      'section',
      { class: 'card' },
      h('div', { class: 'label', text: '난이도' }),
      range,
      h('div', { class: 'diff-ticks' }, ticks),
      desc,
      note
    ),
    h(
      'section',
      { class: 'card', id: 'minutes-card' },
      h('div', { class: 'label', text: '제한 시간' }),
      h(
        'div',
        { class: 'stepper', style: { margin: '6px 0' } },
        h('button', { class: 'btn ghost', type: 'button', 'aria-label': '1분 줄이기', id: 'minutes-minus', onClick: () => setMinutes(s.minutes - 1) }, '−'),
        value,
        h('button', { class: 'btn ghost', type: 'button', 'aria-label': '1분 늘리기', id: 'minutes-plus', onClick: () => setMinutes(s.minutes + 1) }, '+')
      ),
      mrange,
      minutesNote,
      resetBtn
    ),
  ];
}

// ---------- 4. 보물 ----------

const KIND_NOTE = {
  lock: '보물상자를 숫자 자물쇠로 잠가 두면, 범인이 번호를 알려 줘요.',
  place: '보물상자를 숨긴 곳을 범인이 알려 줘요.',
  key: '보물상자를 잠그고, 열쇠를 둔 곳을 범인이 알려 줘요.',
  text: '범인의 자백 끝에 적은 문구를 보여 줘요.',
};

export function renderTreasure(ctx) {
  const s = state.setup;
  const wiz = state.wiz;
  const kindOf = () => TREASURE_KINDS.find((k) => k.id === s.treasure.kind) || TREASURE_KINDS[0];

  const textLabel = h('label', { class: 'label', for: 'treasure-text' });
  const text = h('input', {
    class: 'input',
    id: 'treasure-text',
    maxlength: 40,
    autocomplete: 'off',
    value: s.treasure.text || '',
    onInput: () => {
      s.treasure.text = clip(text.value, 40);
      prevRow.hidden = !!text.value.trim() || !wiz.prevTreasure;
      ctx.changed();
    },
  });
  const prevRow = h(
    'div',
    { class: 'row wrap small muted', id: 'treasure-prev' },
    '지난번: ' + wiz.prevTreasure,
    h('button', {
      class: 'btn small ghost',
      type: 'button',
      onClick: () => {
        s.treasure.text = wiz.prevTreasure;
        text.value = wiz.prevTreasure;
        prevRow.hidden = true;
        ctx.changed();
      },
    }, '그대로 쓰기')
  );
  prevRow.hidden = !!String(s.treasure.text || '').trim() || !wiz.prevTreasure;
  const paintKind = () => {
    const k = kindOf();
    textLabel.textContent = k.lead;
    text.placeholder = k.placeholder;
  };
  paintKind();

  const kinds = choiceGroup(
    TREASURE_KINDS.map((k) => ({
      value: k.id,
      label: [h('span', { class: 'tick' }), h('span', { class: 'kind-text' }, h('b', { text: k.label }), h('span', { class: 'small muted', text: KIND_NOTE[k.id] || '' }))],
      props: { class: 'choice big', 'data-kind': k.id },
    })),
    s.treasure.kind,
    (v) => {
      s.treasure.kind = v;
      paintKind();
      ctx.changed();
    },
    'stack'
  );
  kinds.id = 'treasure-kinds';

  const bonus = h('input', {
    class: 'input',
    id: 'bonus-text',
    maxlength: 40,
    autocomplete: 'off',
    placeholder: '예: 주말에 보드게임 한 판 더',
    value: s.bonus.text || '',
    onInput: () => {
      s.bonus.text = clip(bonus.value, 40);
      ctx.changed();
    },
  });
  const rules = choiceGroup(
    BONUS_RULES.map((r) => ({ value: r.id, label: r.label, props: { 'data-rule': r.id } })),
    s.bonus.rule,
    (v) => {
      s.bonus.rule = v;
      ctx.changed();
    }
  );

  const pin = h('input', {
    class: 'input',
    id: 'pin',
    inputmode: 'numeric',
    pattern: '[0-9]*',
    autocomplete: 'off',
    value: s.pin,
    style: { maxWidth: '140px', fontSize: '22px', letterSpacing: '0.3em', textAlign: 'center' },
    // maxlength 대신 직접 자른다 ("4-8-2-7"처럼 붙여 넣어도 숫자만 남게)
    onInput: () => {
      pin.value = pin.value.replace(/\D/g, '').slice(0, 4);
      s.pin = pin.value;
      ctx.changed();
    },
  });

  return [
    h(
      'section',
      { class: 'card' },
      h('h2', { text: '보물은 어떻게 알려 줄까요?' }),
      h('p', { class: 'soft small', style: { marginBottom: '10px' }, text: '아이가 범인을 잡으면 범인이 자백하면서 보물 정보를 알려 줘요.' }),
      kinds,
      h('div', { class: 'field', style: { marginTop: '14px' } }, textLabel, text, prevRow, h('p', { class: 'small muted', text: '아이 화면에는 범인을 잡은 뒤에만 나와요.' }))
    ),
    h(
      'section',
      { class: 'card' },
      field('보너스 보상', bonus, { optional: true, help: '비워 두면 보너스는 없어요.' }),
      h('div', { class: 'field' }, h('div', { class: 'label', text: '보너스를 주는 기준' }), rules)
    ),
    h('section', { class: 'card' }, field('부모 확인 번호 (4자리)', pin, { help: '게임 중 부모 메뉴를 열 때 씁니다. 아이가 모르는 번호로 바꿔도 좋아요.' })),
  ];
}
