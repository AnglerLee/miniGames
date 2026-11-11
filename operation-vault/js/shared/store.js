// localStorage 를 안전하게 감싼다. 사생활 보호 모드처럼 저장이 막힌 환경에서도 멈추지 않는다.

const PREFIX = 'operationVault_';

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
