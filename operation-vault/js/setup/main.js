// 작전 설정 화면 (부모용).
// 난이도, 보물 공개 방식, 보너스, 보안 토큰을 정하고 작전 코드를 만든다.
// 보물 정보와 힌트는 이 폰의 저장소에만 남고 작전 코드에는 들어가지 않는다.

import { h, showModal } from '../shared/dom.js';
import { load, save } from '../shared/store.js';
import { DIFFICULTIES, TIME_PRESETS_MIN, encodeMission, randomSeed } from '../shared/mission.js';
import { REWARD_TYPES } from '../shared/reward.js';


const app = document.getElementById('app');
const form = {
  difficulty: 1,
  timePreset: DIFFICULTIES[1].timePreset,
  rewardType: 'combo',
  rewardText: '',
  bonus: '',
  token: false,
  tokenHint: '',
  ...load('settings', {}),
};
// 보물 내용과 힌트는 매번 새로 적는다 (지난 작전의 답이 남아 있으면 안 된다)
form.rewardText = '';
form.tokenHint = '';

const error = h('p', { class: 'error center' });

function render() {
  const type = REWARD_TYPES.find((t) => t.id === form.rewardType);
  const fields = h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', gap: '18px' } },

    h(
      'div',
      { class: 'card field' },
      h('div', { class: 'label', text: '난이도' }),
      h('input', {
        type: 'range',
        min: '0',
        max: '2',
        step: '1',
        value: String(form.difficulty),
        'aria-label': '난이도',
        onInput: (e) => {
          form.difficulty = Number(e.target.value);
          form.timePreset = DIFFICULTIES[form.difficulty].timePreset;
          render();
        },
      }),
      h(
        'div',
        { class: 'difficulty-labels' },
        DIFFICULTIES.map((d, i) =>
          h('span', { class: i === form.difficulty ? 'on' : '', text: `${d.icon} ${d.name}` })
        )
      ),
      h('div', { class: 'label', style: { marginTop: '8px' }, text: '제한 시간' }),
      h(
        'div',
        { class: 'chips' },
        TIME_PRESETS_MIN.map((min, i) =>
          h('button', {
            type: 'button',
            class: 'chip' + (i === form.timePreset ? ' on' : ''),
            text: `${min}분`,
            onClick: () => {
              form.timePreset = i;
              render();
            },
          })
        )
      ),
      h('small', { text: '경비대가 도착하기까지의 시간입니다. 실수하면 30초씩 깎입니다.' })
    ),

    h(
      'div',
      { class: 'card field' },
      h('div', { class: 'label', text: '보물 공개 방식' }),
      h(
        'div',
        { class: 'chips' },
        REWARD_TYPES.map((t) =>
          h('button', {
            type: 'button',
            class: 'chip' + (t.id === form.rewardType ? ' on' : ''),
            text: `${t.icon} ${t.name}`,
            onClick: () => {
              form.rewardType = t.id;
              render();
            },
          })
        )
      ),
      h('label', { for: 'reward', text: type.label }),
      h('input', {
        id: 'reward',
        type: 'text',
        maxlength: '80',
        autocomplete: 'off',
        placeholder: type.placeholder,
        value: form.rewardText,
        onInput: (e) => (form.rewardText = e.target.value),
      }),
      h('small', { text: '금고를 열면 나오는 개봉 코드를 입력해야 이 폰에서 공개됩니다.' })
    ),

    h(
      'div',
      { class: 'card field' },
      h('label', { for: 'bonus', text: '보너스 보상 (선택)' }),
      h('input', {
        id: 'bonus',
        type: 'text',
        maxlength: '80',
        autocomplete: 'off',
        placeholder: '예: 젤리 한 봉지 더',
        value: form.bonus,
        onInput: (e) => (form.bonus = e.target.value),
      }),
      h('small', { text: '한 번도 발각되지 않고 A등급 이상으로 끝내야 공개됩니다.' })
    ),

    h(
      'div',
      { class: 'card field' },
      h(
        'div',
        { class: 'toggle-row' },
        h('div', {}, h('div', { class: 'label', text: '보안 토큰 (현실 미션)' }), h('small', { text: '집 안에 숨긴 쪽지를 아이가 실제로 찾아와야 합니다.' })),
        h('button', {
          type: 'button',
          class: 'switch' + (form.token ? ' on' : ''),
          role: 'switch',
          'aria-checked': String(form.token),
          'aria-label': '보안 토큰 사용',
          onClick: () => {
            form.token = !form.token;
            render();
          },
        })
      ),
      form.token
        ? [
            h('label', { for: 'hint', text: '쪽지를 숨길 곳의 힌트' }),
            h('input', {
              id: 'hint',
              type: 'text',
              maxlength: '80',
              autocomplete: 'off',
              placeholder: '예: 신발이 사는 집, 두 번째 칸',
              value: form.tokenHint,
              onInput: (e) => (form.tokenHint = e.target.value),
            }),
            h('small', { text: '작전을 만들면 쪽지에 적을 번호를 알려 드립니다. 힌트는 부모가 무전처럼 읽어 줍니다.' }),
          ]
        : null
    ),

    error,
    h('button', { type: 'button', class: 'btn primary block', text: '작전 만들기', onClick: create }),
    h('a', { class: 'btn ghost block', href: 'index.html', text: '처음으로' })
  );

  const old = document.getElementById('fields');
  fields.id = 'fields';
  if (old) old.replaceWith(fields);
  else app.append(fields);
}

async function create() {
  form.rewardText = form.rewardText.trim();
  form.bonus = form.bonus.trim();
  form.tokenHint = form.tokenHint.trim();
  if (!form.rewardText) {
    error.textContent = '보물 공개 내용을 적어 주세요.';
    document.getElementById('reward').focus();
    return;
  }
  if (form.token && !form.tokenHint) {
    error.textContent = '쪽지를 숨길 곳의 힌트를 적어 주세요.';
    document.getElementById('hint').focus();
    return;
  }
  if (load('mission')) {
    const ok = await showModal({
      title: '새 작전을 만들까요?',
      text: '이전 작전의 설정과 보물 정보는 지워집니다.',
      actions: [
        { label: '취소', value: false },
        { label: '새로 만들기', value: true, kind: 'primary' },
      ],
    });
    if (!ok) return;
  }

  const code = encodeMission({
    seed: randomSeed(),
    difficulty: form.difficulty,
    token: form.token,
    timePreset: form.timePreset,
  });
  const saved = save('mission', {
    code,
    reward: { type: form.rewardType, text: form.rewardText },
    bonus: form.bonus,
    tokenHint: form.token ? form.tokenHint : '',
    createdAt: Date.now(),
    revealed: null,
  });
  // 다음에도 같은 난이도로 시작하도록 기억한다 (보물 내용은 기억하지 않는다)
  save('settings', {
    difficulty: form.difficulty,
    timePreset: form.timePreset,
    rewardType: form.rewardType,
    token: form.token,
  });
  save('console', null);
  if (!saved) {
    error.textContent = '이 브라우저에서는 저장할 수 없습니다. 사생활 보호 모드를 끄고 다시 시도하세요.';
    return;
  }
  location.href = 'operator.html';
}

render();
