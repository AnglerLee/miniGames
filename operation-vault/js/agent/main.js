// 아이 화면 시작점.
import { boot } from './director.js';

try {
  boot();
} catch (err) {
  // 시작하다 실패하면 빈 화면 대신 이유를 보여 준다
  const el = document.getElementById('boot') || document.body.appendChild(document.createElement('div'));
  el.id = 'boot';
  if (!el.textContent || el.textContent === '불러오는 중...') {
    el.textContent = '시작하지 못했습니다. 새로고침해 주세요. (' + (err && err.message ? err.message : err) + ')';
  }
  throw err;
}
