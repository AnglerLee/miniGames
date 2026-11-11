// 화면 요소를 만드는 작은 도우미들. 부모 화면과 아이 화면이 함께 쓴다.

/**
 * 요소를 만든다. props 의 on* 은 이벤트, class/text/html 은 각각 클래스, 글자, HTML,
 * 나머지는 속성으로 들어간다. children 은 요소나 문자열.
 */
export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

/**
 * 자체 모달을 띄운다 (브라우저 기본 alert/confirm 대신 쓴다).
 * actions: [{ label, value, kind }]. 누른 버튼의 value 로 끝나는 Promise 를 돌려준다.
 */
export function showModal({ title, text, body, actions }) {
  return new Promise((resolve) => {
    const close = (value) => {
      backdrop.remove();
      resolve(value);
    };
    const backdrop = h(
      'div',
      { class: 'modal-backdrop' },
      h(
        'div',
        { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
        title ? h('h2', { text: title }) : null,
        text ? h('p', { text }) : null,
        body || null,
        h(
          'div',
          { class: 'actions' },
          (actions || [{ label: '확인', value: true, kind: 'primary' }]).map((a) =>
            h('button', { class: 'btn ' + (a.kind || ''), text: a.label, onClick: () => close(a.value) })
          )
        )
      )
    );
    document.body.append(backdrop);
  });
}

/**
 * 숫자 입력기: 자리 표시창 + 화면 키패드. 휴대폰 자판을 띄우지 않는다.
 * 자릿수를 다 채우면 onComplete(문자열) 을 부른다.
 */
export function createDigitEntry({ length, onComplete }) {
  let value = '';
  let locked = false;
  const display = h('div', { class: 'digits' });
  const cells = Array.from({ length }, () => h('span', { text: '' }));
  display.append(...cells);

  const paint = () => cells.forEach((c, i) => (c.textContent = value[i] || ''));
  const press = (key) => {
    if (locked) return;
    if (key === 'del') value = value.slice(0, -1);
    else if (key === 'clear') value = '';
    else if (value.length < length) value += key;
    paint();
    if (value.length === length) onComplete(value);
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'];
  const labels = { clear: '모두 지움', del: '← 지움' };
  const pad = h(
    'div',
    { class: 'keypad' },
    keys.map((k) =>
      h('button', {
        type: 'button',
        class: labels[k] ? 'wide' : '',
        text: labels[k] || k,
        'data-key': k,
        onClick: () => press(k),
      })
    )
  );

  return {
    el: h('div', {}, display, h('div', { style: { height: '14px' } }), pad),
    press,
    clear() {
      value = '';
      paint();
    },
    /** 틀렸을 때: 흔들고 지운다 */
    reject() {
      display.classList.remove('shake');
      void display.offsetWidth; // 애니메이션을 다시 시작시킨다
      display.classList.add('shake');
      value = '';
      paint();
    },
    setLocked(v) {
      locked = v;
    },
  };
}

/** 글자를 클립보드에 복사한다. 보안 연결이 아니어도 되도록 예전 방식으로 물러선다. */
export async function copyText(text) {
  try {
    if (navigator.clipboard && globalThis.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 아래 방식으로 다시 시도 */
  }
  const area = h('textarea', { style: { position: 'fixed', opacity: '0' } });
  area.value = text;
  document.body.append(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}
