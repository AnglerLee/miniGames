// 화면 꺼짐 방지. 되는 기기에서만 하고, 탭이 다시 보이면 다시 요청한다 (가려지면 브라우저가 풀어 버린다).

let wake = null;
let wanted = false;

export async function requestWake() {
  wanted = true;
  try {
    if (!('wakeLock' in navigator) || wake || document.visibilityState !== 'visible') return;
    wake = await navigator.wakeLock.request('screen');
    wake.addEventListener('release', () => {
      wake = null;
    });
  } catch (e) {
    wake = null; // 안 되는 기기이거나 권한이 없다
  }
}

export function releaseWake() {
  wanted = false;
  if (wake) wake.release().catch(() => {});
  wake = null;
}

export function onVisible() {
  if (wanted) requestWake();
}
