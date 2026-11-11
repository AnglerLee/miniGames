// 작전 코드 탭: 아이 폰으로 작전을 넘기고, 시작 전 준비물을 확인한다.

import { h, showModal, copyText } from '../../shared/dom.js';
import { tokenNumber } from '../../shared/synccode.js';
import { TIME_PRESETS_MIN, DIFFICULTIES } from '../../shared/mission.js';
import { rewardType } from '../../shared/reward.js';
import { qrCanvas } from '../qr.js';

export function renderShare(view, app) {
  const { mission, secret } = app;
  const url = new URL('agent.html', location.href);
  url.hash = 'm=' + mission.code;
  const link = url.toString();
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const type = rewardType(secret.reward.type);

  const copied = h('span', { class: 'small dim' });
  const hiddenReward = h('b', { text: '●●●●' });

  view.append(
    h(
      'div',
      { class: 'card center' },
      h('div', { class: 'section-title', text: '1. 아이 폰으로 작전 넘기기' }),
      h('div', { class: 'qr-box' }, qrCanvas(link)),
      h('p', { class: 'small dim', style: { margin: '10px 0 4px' }, text: '아이 폰 카메라로 QR을 찍거나, 아이 폰에서 이 주소를 열고 아래 코드를 입력합니다.' }),
      h('div', { class: 'mission-code', id: 'code', text: mission.code }),
      h(
        'div',
        { style: { display: 'flex', gap: '8px', marginTop: '12px' } },
        h('button', {
          type: 'button',
          class: 'btn',
          style: { flex: '1' },
          text: '링크 복사',
          onClick: async () => {
            copied.textContent = (await copyText(link)) ? '복사했습니다.' : '복사하지 못했습니다. 코드를 직접 입력하세요.';
          },
        }),
        navigator.share
          ? h('button', {
              type: 'button',
              class: 'btn',
              style: { flex: '1' },
              text: '공유',
              onClick: () => navigator.share({ title: '작전명 스낵 볼트', url: link }).catch(() => {}),
            })
          : null
      ),
      copied
    ),

    local
      ? h('div', {
          class: 'note red small',
          text: '지금 주소가 이 기기 전용(localhost)이라 아이 폰에서는 열리지 않습니다. serve.py 가 알려 준 "부모 폰에서 열 주소"로 접속하세요.',
        })
      : null,

    h(
      'div',
      { class: 'card' },
      h('div', { class: 'section-title', text: '2. 시작 전 준비' }),
      h(
        'ul',
        { class: 'howto' },
        h('li', {}, '간식을 보물상자에 넣어 둡니다. ', h('span', {}, `${type.icon} ${type.label}: `), hiddenReward, ' ',
          h('button', {
            type: 'button',
            style: { color: 'var(--accent)', fontWeight: '700' },
            text: '보기',
            onClick: (e) => {
              const shown = hiddenReward.textContent !== '●●●●';
              hiddenReward.textContent = shown ? '●●●●' : secret.reward.text;
              e.target.textContent = shown ? '보기' : '숨기기';
            },
          })),
        secret.bonus ? h('li', {}, '보너스 보상을 따로 준비합니다: ', h('b', { text: secret.bonus })) : null,
        mission.token
          ? h('li', {}, '쪽지에 번호 ', h('b', { class: 'mono', style: { color: 'var(--gold)', fontSize: '20px' }, text: tokenNumber(mission) }),
              ' 을 적어 숨깁니다. 힌트: ', h('b', { text: secret.tokenHint }))
          : null,
        h('li', {}, `난이도 ${DIFFICULTIES[mission.difficulty].name}, 제한 시간 ${TIME_PRESETS_MIN[mission.timePreset]}분.`),
        h('li', { text: '두 폰 모두 화면이 금방 꺼지지 않게 해 두면 좋습니다.' })
      )
    ),

    h(
      'div',
      { class: 'card' },
      h('div', { class: 'section-title', text: '3. 작전 개시' }),
      h('p', { class: 'dim', text: '아이가 "작전 개시"를 누르면 화면에 주파수 네 자리가 뜹니다. 아이가 불러 주는 숫자를 매뉴얼 탭에 입력하세요.' }),
      h('button', { type: 'button', class: 'btn primary block', style: { marginTop: '12px' }, text: '매뉴얼 열기', onClick: () => app.go('manual') })
    ),

    h('button', {
      type: 'button',
      class: 'btn ghost block',
      text: '새 작전 만들기',
      onClick: async () => {
        const ok = await showModal({
          title: '새 작전을 만들까요?',
          text: '설정 화면으로 이동합니다. 지금 작전은 새로 만들기 전까지 남아 있습니다.',
          actions: [
            { label: '취소', value: false },
            { label: '이동', value: true, kind: 'primary' },
          ],
        });
        if (ok) location.href = 'setup.html';
      },
    })
  );
}
