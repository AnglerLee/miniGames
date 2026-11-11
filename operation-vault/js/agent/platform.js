// 기기 기능을 조심스럽게 쓴다: 진동, 전체 화면, 화면 꺼짐 방지.
// 집 Wi-Fi 의 일반 주소(HTTP)나 아이폰에서는 일부가 없으므로, 없으면 조용히 넘어간다.

let wakeLock = null;

/** 진동. 없는 기기에서는 아무 일도 하지 않는다 (소리와 화면 효과가 대신한다). */
export function vibrate(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    /* 지원하지 않음 */
  }
}

/** 전체 화면을 요청한다. 반드시 버튼을 누른 순간에 불러야 한다. */
export function requestFullscreen() {
  try {
    const el = document.documentElement;
    const fn = el.requestFullscreen || el.webkitRequestFullscreen;
    if (fn && !document.fullscreenElement) {
      const result = fn.call(el, { navigationUI: 'hide' });
      if (result && result.catch) result.catch(() => {});
    }
  } catch {
    /* 지원하지 않음 */
  }
}

/** 화면이 꺼지지 않게 한다. 보안 연결에서만 동작한다. */
export async function keepAwake() {
  try {
    if (navigator.wakeLock && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
    }
  } catch {
    wakeLock = null;
  }
}

/** 스크롤, 확대, 길게 누르기 메뉴처럼 게임을 방해하는 브라우저 동작을 막는다. */
export function blockBrowserGestures() {
  const stop = (e) => e.preventDefault();
  document.addEventListener('contextmenu', stop);
  document.addEventListener('gesturestart', stop);
  document.addEventListener('dblclick', stop);
  // 두 손가락 확대와 당겨서 새로고침을 막는다 (입력창이 있는 패널 안에서는 스크롤을 허용)
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1 || !e.target.closest('#screen')) e.preventDefault();
    },
    { passive: false }
  );
}
