// 대문: 게임 소개, 준비/임무 시작 버튼, 지난 임무 기록.
//
// 상태
//   none       설정이 없다 (처음 온 부모)
//   preparing  준비하던 중 (ready 가 아니다)
//   ready      준비가 끝났고 아직 시작 전
//   playing    이 임무를 하던 중 (저장된 진행의 key 가 지금 설정과 같고, 끝나지 않았거나 아직 기록 전)
//   ended      이 임무를 끝내고 기록까지 남겼다
// index.html#again 으로 오면 "쪽지 그대로 새 임무"를 바로 묻는다 (결말 화면의 버튼이 쓸 수 있게).

import { loadSetup, loadRun, loadHistory, missionKey } from './shared/store.js';
import { DIFFICULTY } from './shared/content.js';
import { stageTitle } from './shared/text.js';
import { h, DEBUG } from './shared/dom.js';
import { canReuse, startSameNotes } from './setup/reuse.js';
import { drawSub } from './play/logbook.js';

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

export function homeState() {
  const setup = loadSetup();
  if (!setup) return { kind: 'none' };
  const run = loadRun();
  const mine = run && run.key === missionKey(setup) ? run : null;
  if (mine && mine.state.phase === 'done' && mine.state.recorded) return { kind: 'ended', setup, run: mine };
  if (!setup.ready) return { kind: 'preparing', setup };
  if (mine) return { kind: 'playing', setup, run: mine };
  return { kind: 'ready', setup };
}

function statusCard(st) {
  const s = st.setup;
  if (!s) return null;
  const D = DIFFICULTY[s.difficulty] || DIFFICULTY[1];
  const who = String(s.captain || '').trim();
  const line = D.name + ' · 방 ' + s.rooms.length + '곳' + (who ? ' · ' + who + ' 함장' : '');
  let msg;
  if (st.kind === 'preparing') msg = ['📝', '임무 No.' + s.missionNo + ' 준비 중', '준비하던 내용이 그대로 있어요. 이어서 준비할 수 있어요.'];
  else if (st.kind === 'ready') msg = ['✅', '임무 No.' + s.missionNo + ' 준비 완료', line];
  else if (st.kind === 'playing') {
    const g = st.run.state;
    const where = g.phase === 'done' ? '임무를 막 끝냈어요' : stageTitle(g.stage) + '까지 왔어요 · 선체 ' + g.hull + '/' + g.hullMax + '칸';
    msg = ['🌊', '임무 No.' + s.missionNo + ' 진행 중', where];
  } else if (st.kind === 'ended') msg = ['🏁', '임무 No.' + s.missionNo + ' 완료', canReuse(s) ? '쪽지가 붙어 있으면 준비 없이 바로 새 임무를 할 수 있어요.' : '새 임무를 준비해 주세요.'];
  if (!msg) return null;
  return h(
    'section',
    { class: 'card status-card', id: 'status', 'data-state': st.kind },
    h('span', { class: 'big-ico', 'aria-hidden': 'true', text: msg[0] }),
    h('div', {}, h('b', { text: msg[1] }), h('div', { class: 'small muted', text: msg[2] }))
  );
}

function actions(st) {
  const setupBtn = (kind) => h('a', { class: 'btn block ' + kind, href: 'setup.html', id: 'go-setup' }, '잠수함 준비하기 (부모)');
  const reuse = canReuse(st.setup) && st.kind !== 'none' && st.kind !== 'ready';
  const reuseBtn = (kind) =>
    reuse ? h('button', { class: 'btn block ' + kind, type: 'button', id: 'go-again', onClick: () => startSameNotes(loadSetup()) }, '쪽지 그대로 새 임무') : null;
  if (st.kind === 'ready') return [h('a', { class: 'btn block big primary', href: 'play.html', id: 'go-play' }, '임무 시작'), setupBtn('ghost')];
  if (st.kind === 'playing') return [h('a', { class: 'btn block big primary', href: 'play.html', id: 'go-play' }, '임무 이어 하기'), reuseBtn('ghost'), setupBtn('ghost')];
  if (st.kind === 'ended') {
    return [reuseBtn('big primary'), h('a', { class: 'btn block ghost', href: 'play.html', id: 'go-result' }, '결과와 관찰 리포트 다시 보기'), setupBtn(reuse ? 'ghost' : 'primary')];
  }
  if (st.kind === 'preparing') return [setupBtn('big primary'), loadHistory().length ? reuseBtn('ghost') : null];
  return [setupBtn('big primary')];
}

function historyList() {
  const list = loadHistory();
  if (!list.length) return h('p', { class: 'empty', id: 'history-empty', text: '아직 다녀온 임무가 없어요.' });
  return h(
    'ul',
    { class: 'history', id: 'history' },
    list.map((x) => {
      const D = DIFFICULTY[x.difficulty];
      const grade = ['S', 'A', 'B', 'C'].includes(x.grade) ? x.grade : '-';
      const who = String(x.captain || '').trim();
      const extra = [
        '걸린 시간 ' + durationText(x.totalMs),
        x.hullMax ? '남은 선체 ' + x.hull + '/' + x.hullMax + '칸' : null,
        D ? D.name : null,
        x.retries ? '다시 도전 ' + x.retries + '번' : null,
      ].filter(Boolean);
      return h(
        'li',
        { class: 'card' },
        h('span', { class: 'grade g-' + grade, 'aria-label': grade + ' 등급', text: grade }),
        h(
          'div',
          { class: 'grow' },
          h('div', { class: 'meta', text: dateText(x.at) + ' · 임무 No.' + (x.missionNo || '?') }),
          h('div', { class: 'who', text: who ? who + ' 함장' : '함장' }),
          h('div', { class: 'meta', text: extra.join(' · ') })
        )
      );
    })
  );
}

function flowList() {
  const step = (ico, title, sub) => h('li', {}, h('span', { class: 'ico', 'aria-hidden': 'true', text: ico }), h('div', {}, h('b', { text: title }), h('span', { class: 'soft', text: sub })));
  return h(
    'ol',
    { class: 'flow' },
    step('📝', '부모 준비 5분', '방을 고르고 방마다 쪽지를 붙여요.'),
    step('🧭', '아이 혼자 15분', '폰을 들고 방을 오가며 고장을 고쳐요.'),
    step('👀', '부모는 관찰', '끝나면 관찰 리포트를 봐요.')
  );
}

/** 대문 그림: 결말과 항해 일지에 나오는 것과 같은 잠수함 */
function heroArt() {
  const canvas = h('canvas', { class: 'hero-sub', width: 440, height: 220, 'aria-hidden': 'true' });
  const g = canvas.getContext('2d');
  if (g) {
    g.scale(2, 2);
    g.fillStyle = 'rgba(76, 201, 240, 0.35)';
    for (const [x, y, r] of [[30, 82, 4], [44, 62, 3], [24, 50, 2.5], [190, 40, 3], [200, 66, 2]]) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    drawSub(g, 112, 62, 0.72, { tilt: -0.06 });
  }
  return canvas;
}

function render() {
  const st = homeState();
  const actionsBox = h('div', { class: 'home-actions' }, statusCard(st), actions(st));
  document.body.replaceChildren(
    h(
      'div',
      { class: 'page' },
      h(
        'header',
        { class: 'home-hero' },
        heroArt(),
        h('h1', { text: '잠수함 간식호' }),
        h('p', { class: 'lead', text: '집이 잠수함이 된다. 방마다 터지는 고장을 고치며 바다 밑 보물을 건져 오는 실시간 미션' })
      ),
      // 처음 온 부모에게는 설명을 먼저, 준비가 끝났거나 진행 중이면 버튼을 먼저 (작은 폰에서도 스크롤 없이 보이게)
      st.kind === 'none' ? [flowList(), actionsBox] : [actionsBox, flowList()],
      h('h2', { class: 'section-title', text: '지난 임무 기록' }),
      historyList(),
      h('div', { class: 'home-foot' }, h('a', { class: 'link-back', href: '../index.html' }, '← 미니게임 목록'))
    )
  );
  return st;
}

const st = render();
if (location.hash === '#again') {
  history.replaceState(null, '', location.pathname + location.search);
  if (st.setup && canReuse(st.setup)) startSameNotes(st.setup);
}
// 다른 탭에서 준비를 마치고 돌아오면 버튼이 맞게 바뀌도록
window.addEventListener('pageshow', (e) => {
  if (e.persisted) render();
});
if (DEBUG) window.__hsHome = { state: () => homeState().kind, render };
