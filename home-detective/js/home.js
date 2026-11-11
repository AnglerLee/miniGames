// 대문: 게임 소개, 준비/수사 시작 버튼, 지난 사건 기록.

import { loadSetup, loadRun, loadHistory, caseKey } from './shared/store.js';
import { DIFFICULTY } from './shared/content.js';
import { h } from './shared/dom.js';

function dateText(at) {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return '';
  const thisYear = d.getFullYear() === new Date().getFullYear();
  return (thisYear ? '' : d.getFullYear() + '년 ') + (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
}

function durationText(ms) {
  const sec = Math.max(0, Math.round((ms || 0) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? m + '분 ' + String(s).padStart(2, '0') + '초' : s + '초';
}

/** 지금 설정과 진행 상태를 보고 대문의 상태를 정한다 */
function homeState() {
  const setup = loadSetup();
  if (!setup) return { kind: 'none' };
  if (!setup.ready) return { kind: 'preparing', setup };
  const run = loadRun();
  if (run && run.caseKey === caseKey(setup)) {
    if (run.phase === 'end') return { kind: 'ended', setup };
    return { kind: 'playing', setup };
  }
  return { kind: 'ready', setup };
}

function statusCard(st) {
  const s = st.setup;
  if (!s) return null;
  const D = DIFFICULTY[s.difficulty] || DIFFICULTY[1];
  const line = D.name + ' · 제한 ' + s.minutes + '분' + (String(s.detective || '').trim() ? ' · ' + s.detective.trim() + ' 탐정' : '');
  const msg = {
    preparing: ['📝', '사건 No.' + s.caseNo + ' 준비 중', '준비하던 내용이 그대로 있어요. 이어서 준비할 수 있어요.'],
    ready: ['✅', '사건 No.' + s.caseNo + ' 준비 완료', line],
    playing: ['🔎', '사건 No.' + s.caseNo + ' 수사 중', line],
    ended: ['🏁', '사건 No.' + s.caseNo + ' 해결', '새 사건을 준비하면 방과 인형을 그대로 다시 쓸 수 있어요.'],
  }[st.kind];
  if (!msg) return null;
  return h(
    'section',
    { class: 'card status-card', id: 'status', 'data-state': st.kind },
    h('span', { class: 'big-ico', text: msg[0] }),
    h('div', {}, h('b', { text: msg[1] }), h('div', { class: 'small muted', text: msg[2] }))
  );
}

function actions(st) {
  const setupBtn = (kind) => h('a', { class: 'btn block ' + kind, href: 'setup.html', id: 'go-setup' }, '새 사건 준비하기 (부모)');
  if (st.kind === 'ready') {
    return [h('a', { class: 'btn gold block', href: 'play.html', id: 'go-play' }, '🔎 수사 시작'), setupBtn('ghost')];
  }
  if (st.kind === 'playing') {
    return [h('a', { class: 'btn gold block', href: 'play.html', id: 'go-play' }, '🔎 수사 이어 하기'), setupBtn('ghost')];
  }
  if (st.kind === 'ended') {
    return [setupBtn('primary'), h('a', { class: 'btn ghost block', href: 'play.html', id: 'go-result' }, '결과와 관찰 리포트 다시 보기')];
  }
  return [setupBtn('primary')];
}

function historyList() {
  const list = loadHistory();
  if (!list.length) return h('p', { class: 'empty', id: 'history-empty', text: '아직 해결한 사건이 없어요.' });
  return h(
    'ul',
    { class: 'history', id: 'history' },
    list.map((x) => {
      const D = DIFFICULTY[x.difficulty];
      const culprit = x.culprit || {};
      const grade = String(x.grade || '-');
      const extra = [D ? D.name : null, '걸린 시간 ' + durationText(x.usedMs), x.hints ? '힌트 ' + x.hints + '번' : null].filter(Boolean).join(' · ');
      return h(
        'li',
        { class: 'card' },
        h('span', { class: 'grade g-' + grade, 'aria-label': grade + ' 등급', text: grade }),
        h(
          'div',
          { class: 'grow' },
          h('div', { class: 'meta', text: dateText(x.at) + ' · 사건 No.' + (x.caseNo || '?') + (String(x.detective || '').trim() ? ' · ' + x.detective + ' 탐정' : '') }),
          // 부모가 끝낸 사건은 아이가 범인을 밝히지 못한 것이므로 기록에서도 가린다
          x.forced
            ? h('div', { class: 'who', text: '수사를 중간에 끝냄' })
            : h('div', { class: 'who' }, '범인 ', (culprit.icon || '') + ' ' + (culprit.name || '')),
          h('div', { class: 'meta', text: extra })
        )
      );
    })
  );
}

function flowList() {
  const step = (ico, title, sub) => h('li', {}, h('span', { class: 'ico', text: ico }), h('div', {}, h('b', { text: title }), h('span', { class: 'soft', text: sub })));
  return h(
    'ol',
    { class: 'flow' },
    step('📝', '부모 준비 10분', '방과 인형을 고르고 쪽지를 붙여요.'),
    step('🕵️', '아이 혼자 수사 20~30분', '폰을 탐정 수첩 삼아 범인을 찾아요.'),
    step('👀', '부모는 관찰', '끝나면 관찰 리포트를 봐요.')
  );
}

function render() {
  const st = homeState();
  const actionsBox = h('div', { class: 'home-actions' }, statusCard(st), actions(st));
  document.body.append(
    h(
      'div',
      { class: 'page' },
      h(
        'header',
        { class: 'home-hero' },
        h('div', { class: 'logo', 'aria-hidden': 'true', text: '🔍' }),
        h('h1', { text: '우리 집 탐정' }),
        h('p', { class: 'lead', text: '집 전체가 사건 현장, 인형들이 용의자가 되는 추리 게임' })
      ),
      // 처음 온 부모에게는 설명을 먼저, 준비가 끝났거나 수사 중이면 버튼을 먼저 (작은 폰에서도 스크롤 없이 보이게)
      st.kind === 'none' ? [flowList(), actionsBox] : [actionsBox, flowList()],
      h('h2', { class: 'section-title', text: '지난 사건 기록' }),
      historyList(),
      h('div', { class: 'home-foot' }, h('a', { class: 'link-back', href: '../index.html' }, '← 미니게임 목록'), ' · ', h('a', { class: 'link-back', href: '../guide/detective.html' }, '📖 설명서'))
    )
  );
}

// 다른 폰에서 받은 주소는 index.html 머리에서 이미 play.html 로 넘겼다.
// 대문을 연 채로 주소창에 붙여 넣으면 다시 읽지 않고 해시만 바뀌므로 그때도 넘긴다.
if (location.hash.indexOf('#c=') !== 0) render();
window.addEventListener('hashchange', () => {
  if (location.hash.indexOf('#c=') === 0) location.replace('play.html' + location.hash);
});
