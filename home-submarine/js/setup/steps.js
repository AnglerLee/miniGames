// 준비 마법사 0, 1, 3단계: 안내, 함장과 난이도, 보물과 보상.
// 글자 입력은 화면을 다시 그리지 않고 값만 저장한다 (다시 그리면 폰 자판이 닫힌다).

import { h } from '../shared/dom.js';
import { DIFFICULTY, TREASURE_KINDS, BONUS_RULES } from '../shared/content.js';
import { loadHistory } from '../shared/store.js';
import { state, NAME_MAX, TEXT_MAX } from './state.js';
import { choiceGroup, field, clip } from './ui.js';
import { canReuse, startSameNotes } from './reuse.js';

const diffOf = (d) => DIFFICULTY[d] || DIFFICULTY[1];
const sum = (list) => list.reduce((a, b) => a + b, 0);
/** 난이도별 경보 수: 묶음 수 + 두 곳 동시 고장의 두 번째 경보 */
export const alertCount = (D) => sum(D.waves) + sum(D.doubles);

// ---------- 0. 안내 ----------

export function renderIntro(ctx) {
  const s = state.setup;
  const n = s.rooms.length;
  const item = (ico, title, sub) => h('li', {}, h('span', { class: 'ico', 'aria-hidden': 'true', text: ico }), h('div', {}, h('b', { text: title }), h('div', { class: 'small muted', text: sub })));
  const box = (title, value) => h('div', {}, title, h('b', { text: value }));
  const played = loadHistory().some((x) => x.missionNo === s.missionNo);
  // 안전 안내는 게임 설명 바로 다음에 (작은 화면에서도 일찍 보이게)
  const safety = h(
    'section',
    { class: 'card safety', id: 'safety-card' },
    h('h2', {}, h('span', { 'aria-hidden': 'true', text: '⚠️ ' }), '안전 안내'),
    h('p', { text: '아이가 폰을 들고 방 사이를 오갑니다. 바닥의 물건을 치우고, 미끄러운 양말은 벗기고, 문턱과 계단을 확인해 주세요.' }),
    h('p', { class: 'strong', text: '게임은 아이의 평소 걸음에 맞춰 시간을 주므로 뛸 필요가 없습니다.' })
  );
  return [
    played && canReuse(s) ? reuseCard(ctx) : null,
    h(
      'section',
      { class: 'card' },
      h('h2', { text: '준비는 5분이면 돼요' }),
      h(
        'ol',
        { class: 'steps-list' },
        h('li', { text: '방을 4~6곳 고르면 방마다 잠수함 구역(조종실, 기관실…)이 정해져요.' }),
        h('li', { text: '안내대로 포스트잇에 모양과 숫자를 적어 방마다 붙이고, 간식 보물상자를 숨겨요.' }),
        h('li', { text: '폰을 아이에게 건네면, 아이가 방을 오가며 고장을 고쳐요. 부모는 지켜보기만 하면 돼요.' })
      )
    ),
    safety,
    h(
      'section',
      { class: 'card' },
      h('h3', { text: '준비물', style: { marginTop: 0 } }),
      h(
        'ul',
        { class: 'supplies' },
        item('📝', '포스트잇 ' + n + '장과 펜', '방마다 한 장. 모양 하나와 숫자 네 개를 크게 적어요.'),
        item('🎁', '보물상자와 간식', '상자나 봉투면 충분해요. 임무를 끝내면 어디 있는지 알려 줘요.')
      ),
      h('h3', { text: '걸리는 시간' }),
      h('div', { class: 'time-bar' }, box('부모 준비', '5분'), box('아이 혼자', '15분쯤'), box('부모', '관찰만'))
    ),
  ];
}

function reuseCard(ctx) {
  const s = state.setup;
  return h(
    'section',
    { class: 'card reuse' },
    h('h2', { text: '쪽지가 그대로 붙어 있나요?' }),
    h('p', { class: 'soft', text: '임무 No.' + s.missionNo + '의 쪽지를 떼지 않았다면, 준비 없이 바로 새 임무를 할 수 있어요.' }),
    h(
      'div',
      { class: 'stack', style: { marginTop: '12px' } },
      h('button', { class: 'btn primary block', type: 'button', id: 'reuse-btn', onClick: () => startSameNotes(s, { editHref: null, onEdit: () => ctx.go(3) }) }, '쪽지 그대로 새 임무'),
      h('p', { class: 'small muted', text: '방, 구역, 쪽지는 그대로 두고 고장이 나는 순서만 새로 정해요.' })
    )
  );
}

// ---------- 1. 함장과 난이도 ----------

const QUERY_TEXT = ['쪽지의 "몇째 숫자"를 물어요', '"몇째 숫자"에 더해 "가장 큰·작은 숫자"도 물어요', '"두 숫자를 차례로"까지 물어요'];
const DIFF_NOTE = [
  '처음 하는 아이, 10살 무렵에게 권해요. 시간이 넉넉해요.',
  '한 번 해 본 아이에게 맞아요. 두 곳이 함께 고장 나는 일이 늘어요.',
  '빠듯한 시간 안에 판단해야 해요. 기억할 기호도 길어져요.',
];

export function renderBasic(ctx) {
  const s = state.setup;
  const nameHelp = h('p', { class: 'small muted' });
  const paintName = () => {
    const n = String(s.captain || '').trim();
    nameHelp.textContent = n ? '게임 속에서 "' + n + ' 함장"이라고 불러요.' : '비워 두면 그냥 "함장"이라고 불러요.';
  };
  const name = h('input', {
    class: 'input',
    id: 'captain',
    maxlength: NAME_MAX,
    placeholder: '예: 지우',
    autocomplete: 'off',
    value: s.captain || '',
    onInput: () => {
      s.captain = clip(name.value, NAME_MAX);
      paintName();
      ctx.changed();
    },
    onChange: () => {
      s.captain = clip(name.value.trim(), NAME_MAX);
      name.value = s.captain;
      paintName();
      ctx.changed();
    },
  });
  paintName();

  const range = h('input', { type: 'range', min: 0, max: 2, step: 1, id: 'difficulty', 'aria-label': '난이도', value: s.difficulty });
  const ticks = DIFFICULTY.map((d, i) => h('button', { type: 'button', 'data-diff': i, onClick: () => setDiff(i) }, d.name));
  const facts = h('dl', { class: 'diff-facts', id: 'diff-facts' });
  const note = h('p', { class: 'small muted', id: 'diff-note' });

  function paint() {
    const D = diffOf(s.difficulty);
    range.value = s.difficulty;
    ticks.forEach((b, i) => b.setAttribute('aria-pressed', String(i === s.difficulty)));
    const row = (k, v, key) => [h('dt', { text: k }), h('dd', { 'data-fact': key, text: v })];
    facts.replaceChildren(
      ...row('선체', D.hull + '칸', 'hull'),
      ...row('고장 경보', alertCount(D) + '개쯤', 'alerts'),
      ...row('도착 확인', QUERY_TEXT[s.difficulty], 'query'),
      ...row('외울 기호', D.relayLen + '개 · 크레인 순서 ' + D.routeLen + '곳', 'memory')
    );
    note.textContent = DIFF_NOTE[s.difficulty] || '';
  }
  function setDiff(v) {
    v = Math.max(0, Math.min(2, v | 0));
    if (v === s.difficulty) return paint();
    s.difficulty = v;
    paint();
    ctx.changed();
  }
  range.addEventListener('input', () => setDiff(+range.value));
  paint();

  return [
    h('section', { class: 'card' }, field('함장(아이) 이름', name, { optional: true, help: nameHelp })),
    h(
      'section',
      { class: 'card' },
      h('div', { class: 'label', text: '난이도' }),
      range,
      h('div', { class: 'diff-ticks' }, ticks),
      facts,
      note,
      h('p', { class: 'small muted', text: '어느 난이도든 제한 시간은 아이가 출항 점검에서 걷는 빠르기에 맞춰 정해져요. 가라앉으면 그 단계를 더 넉넉한 시간으로 다시 해요.' })
    ),
  ];
}

// ---------- 3. 보물과 보상 ----------

const KIND_NOTE = {
  lock: '보물상자를 숫자 자물쇠로 잠가 두면, 물 위로 올라왔을 때 번호를 알려 줘요.',
  place: '보물상자를 숨긴 곳을 알려 줘요.',
  key: '보물상자를 잠그고, 열쇠를 둔 곳을 알려 줘요.',
  text: '상자 안 쪽지처럼, 적어 둔 문구를 보여 줘요.',
};

export function renderTreasure(ctx) {
  const s = state.setup;
  const kindOf = () => TREASURE_KINDS.find((k) => k.id === s.treasure.kind) || TREASURE_KINDS[1];

  const textLabel = h('label', { class: 'label', for: 'treasure-text' });
  const text = h('input', {
    class: 'input',
    id: 'treasure-text',
    maxlength: TEXT_MAX,
    autocomplete: 'off',
    value: s.treasure.text || '',
    onInput: () => {
      s.treasure.text = clip(text.value, TEXT_MAX);
      ctx.changed();
    },
    onChange: () => {
      s.treasure.text = clip(text.value.trim(), TEXT_MAX);
      text.value = s.treasure.text;
      ctx.changed();
    },
  });
  const paintKind = () => {
    const k = kindOf();
    textLabel.textContent = k.lead;
    text.placeholder = k.placeholder;
  };
  paintKind();

  const kinds = choiceGroup(
    TREASURE_KINDS.map((k) => ({
      value: k.id,
      label: [h('span', { class: 'tick', 'aria-hidden': 'true' }), h('span', { class: 'kind-text' }, h('b', { text: k.label }), h('span', { class: 'small muted', text: KIND_NOTE[k.id] || '' }))],
      props: { class: 'choice big', 'data-kind': k.id },
    })),
    kindOf().id,
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
    maxlength: TEXT_MAX,
    autocomplete: 'off',
    placeholder: '예: 주말에 보드게임 한 판 더',
    value: s.bonus.text || '',
    onInput: () => {
      s.bonus.text = clip(bonus.value, TEXT_MAX);
      ctx.changed();
    },
    onChange: () => {
      s.bonus.text = clip(bonus.value.trim(), TEXT_MAX);
      bonus.value = s.bonus.text;
      ctx.changed();
    },
  });
  const rules = choiceGroup(
    BONUS_RULES.map((r) => ({ value: r.id, label: r.label, props: { 'data-rule': r.id } })),
    s.bonus.rule || 'A',
    (v) => {
      s.bonus.rule = v;
      ctx.changed();
    }
  );
  rules.id = 'bonus-rules';

  const pin = h('input', {
    class: 'input pin',
    id: 'pin',
    inputmode: 'numeric',
    pattern: '[0-9]*',
    autocomplete: 'off',
    value: s.pin,
    'aria-label': '부모 확인 번호 4자리',
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
      h('p', { class: 'soft small', style: { marginBottom: '10px' }, text: '잠수함이 물 위로 올라오면, 건져 올린 상자가 열리면서 보물 정보가 나와요.' }),
      kinds,
      h('div', { class: 'field', style: { marginTop: '14px' } }, textLabel, text, h('p', { class: 'small muted', text: '아이 화면에는 임무를 끝낸 뒤에만 나와요.' }))
    ),
    h(
      'section',
      { class: 'card' },
      field('보너스 보상', bonus, { optional: true, help: '비워 두면 보너스는 없어요. 기준에 못 미치면 아이에게 내용은 보이지 않아요.' }),
      h('div', { class: 'field' }, h('div', { class: 'label', text: '보너스를 주는 기준' }), rules)
    ),
    h('section', { class: 'card' }, field('부모 확인 번호 (4자리)', pin, { help: '게임 중 부모 메뉴를 열 때 씁니다. 아이가 모르는 번호로 바꿔도 좋아요.' })),
  ];
}
