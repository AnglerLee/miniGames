// localStorage 를 안전하게 감싼다. 사생활 보호 모드처럼 저장이 막힌 환경에서도 멈추지 않는다.

// AnglerBox 에서는 여러 앱이 한 주소(출처)를 함께 쓰므로 키 앞에 앱 이름(minigames:)을 붙인다
const PREFIX = 'minigames:operationVault_';

export function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* 저장이 막힌 환경에서는 지울 것도 없다 */
  }
}
