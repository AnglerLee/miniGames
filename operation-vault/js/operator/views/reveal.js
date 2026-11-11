// 개봉 탭: 아이가 외친 개봉 코드를 입력하면 보물 정보가 공개된다.
// 개봉 코드에는 등급이 들어 있어서, 보너스 보상을 줄지도 여기서 판단한다.

import { h, createDigitEntry, showModal } from '../../shared/dom.js';
import { load, save } from '../../shared/store.js';
import { decodeOpen } from '../../shared/synccode.js';
import { bonusUnlocked } from '../../shared/run.js';
import { rewardType } from '../../shared/reward.js';

const RANK_LINES = {
  S: '완벽한 침투! 전설의 요원입니다.',
  A: '깔끔한 작전 성공입니다.',
  B: '아슬아슬했지만 임무 완수!',
  C: '우여곡절 끝에 해냈습니다.',
};

export function renderReveal(view, app) {
  const secret = load('mission') || app.secret;
  if (secret.revealed) {
    showReward(view, secret, secret.revealed.rank);
    return;
  }

  const message = h('p', { class: 'center dim', text: '금고가 열리면 아이 화면에 개봉 코드 네 자리가 나옵니다.' });
  const open = (rank) => {
    save('mission', { ...secret, revealed: { rank, at: Date.now() } });
    view.replaceChildren();
    showReward(view, secret, rank);
  };
  const entry = createDigitEntry({
    length: 4,
    onComplete(code) {
      const rank = decodeOpen(app.mission, code);
      if (!rank) {
        entry.reject();
        message.className = 'center error';
        message.textContent = '개봉 코드가 맞지 않습니다. 숫자를 다시 확인하세요.';
        return;
      }
      open(rank);
    },
  });

  view.append(
    h('div', { class: 'card' }, h('div', { class: 'section-title center', text: '개봉 코드 입력' }), entry.el),
    message,
    h('button', {
      type: 'button',
      class: 'btn ghost block small',
      text: '코드 없이 공개하기',
      onClick: async () => {
        const ok = await showModal({
          title: '코드 없이 공개할까요?',
          text: '아이 폰에 문제가 생겼을 때만 쓰세요. 등급 없이 보물 정보만 공개됩니다.',
          actions: [
            { label: '취소', value: false },
            { label: '공개', value: true, kind: 'danger' },
          ],
        });
        if (ok) open('-');
      },
    })
  );
}

function showReward(view, secret, rank) {
  const type = rewardType(secret.reward.type);
  const ranked = rank !== '-';
  view.append(
    h(
      'div',
      { class: 'reveal', id: 'reveal' },
      ranked ? h('div', { class: 'small dim', text: '작전 등급' }) : null,
      ranked ? h('div', { class: 'rank', id: 'rank', text: rank }) : null,
      ranked ? h('p', { style: { marginTop: '6px' }, text: RANK_LINES[rank] }) : null,
      h('div', { class: 'what', text: `${type.icon} ${type.label}` }),
      h('div', { class: 'value', id: 'reward-text', text: secret.reward.text })
    )
  );
  if (secret.bonus) {
    const unlocked = ranked && bonusUnlocked(rank);
    view.append(
      h(
        'div',
        { class: 'card center', id: 'bonus' },
        h('div', { class: 'section-title', text: '보너스 보상' }),
        unlocked
          ? h('div', { style: { fontSize: '22px', fontWeight: '800', color: 'var(--gold)' }, text: '🎉 ' + secret.bonus })
          : h('p', { class: 'dim', text: '이번에는 놓쳤습니다. 한 번도 발각되지 않고 A등급 이상이면 받을 수 있습니다.' })
      )
    );
  }
  view.append(h('a', { class: 'btn primary block', href: 'setup.html', text: '역할을 바꿔 새 작전 만들기' }));
}
