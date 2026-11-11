// 아이 기기로 보내는 링크 상자: QR 코드, 링크 복사, 공유(되는 기기만), 링크 글자.
// 부모 대시보드(admin.html)와 각 보물찾기의 준비 화면이 함께 쓴다.
//
//   shareBox 를 import 한 뒤 el.append(shareBox({ url, title: '우리 집 탐정', note: '…' }))
//
// 화면마다 테마가 달라서 상자 안의 색은 스스로 정한다(밝은 종이 위 검은 글씨).
// 링크는 설정을 통째로 담아 길다. 서버 없이 다른 기기로 넘기기 위해서다.

import qrcode from '../../operation-vault/vendor/qrcode/qrcode.js';

const CSS = `
.mg-share { background: #fffdf7; color: #1d232b; border-radius: 16px; padding: 14px; text-align: center; word-break: keep-all;
  box-shadow: 0 1px 0 rgba(0,0,0,.06), 0 6px 18px rgba(0,0,0,.12); }
.mg-share * { box-sizing: border-box; }
.mg-share-qr { display: inline-block; background: #fff; padding: 6px; border-radius: 10px; line-height: 0; }
.mg-share-qr canvas { display: block; image-rendering: pixelated; }
.mg-share-note { margin: 10px 0 0; font-size: 14px; line-height: 1.45; color: #4a5560; }
.mg-share-row { display: flex; gap: 8px; margin-top: 12px; }
.mg-share-row button { flex: 1; min-height: 48px; border: 0; border-radius: 12px; font: inherit; font-size: 16px;
  font-weight: 800; cursor: pointer; background: #e9eef3; color: #1d232b; }
.mg-share-row button.main { background: #1f6feb; color: #fff; }
.mg-share-row button:active { transform: translateY(1px); }
.mg-share details { margin-top: 10px; text-align: left; }
.mg-share summary { cursor: pointer; font-size: 14px; color: #4a5560; padding: 6px 0; }
.mg-share textarea { width: 100%; min-height: 72px; resize: vertical; border: 1px solid #ccd5de; border-radius: 10px;
  padding: 8px; font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; color: #1d232b; background: #fff;
  word-break: break-all; }
.mg-share-status { min-height: 1.4em; margin: 8px 0 0; font-size: 14px; font-weight: 700; color: #1a7f37; }
.mg-share-status.bad { color: #b42318; }
`;

function ensureStyle() {
  if (document.getElementById('mg-share-style')) return;
  const style = document.createElement('style');
  style.id = 'mg-share-style';
  style.textContent = CSS;
  document.head.appendChild(style);
}

/**
 * QR 코드 캔버스. 너무 길어 담지 못하면 null.
 * 화면 픽셀 밀도에 맞춰 그려서 촘촘한 QR 도 흐려지지 않게 한다.
 */
export function qrCanvas(text, cssPx = 240) {
  let qr;
  try {
    // 짧은 주소는 오류 정정을 한 단계 높인다(화면이 조금 가려져도 읽힌다)
    qr = qrcode(0, text.length < 400 ? 'M' : 'L');
    qr.addData(text);
    qr.make();
  } catch (e) {
    return null;
  }
  const count = qr.getModuleCount();
  const quiet = 3;
  const total = count + quiet * 2;
  const cell = Math.max(2, Math.floor(cssPx / total));
  const size = cell * total;
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.round(size * dpr);
  canvas.style.width = canvas.style.height = size + 'px';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '링크 QR 코드');
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, size, size);
  g.fillStyle = '#000000';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) g.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
    }
  }
  return canvas;
}

async function copyText(text, area) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    // http 주소나 오래된 브라우저: 글상자를 골라 복사 명령을 쓴다
    try {
      area.closest('details').open = true;
      area.focus();
      area.select();
      return document.execCommand('copy');
    } catch (e2) {
      return false;
    }
  }
}

function el(tag, props, ...kids) {
  const node = document.createElement(tag);
  Object.entries(props || {}).forEach(([k, v]) => {
    if (k === 'text') node.textContent = v;
    else if (k === 'onclick') node.addEventListener('click', v);
    else node.setAttribute(k, v);
  });
  kids.flat().forEach((k) => k && node.append(k));
  return node;
}

/**
 * 링크 상자.
 *   url    보낼 주소
 *   title  공유 창 제목
 *   text   공유 메시지(선택)
 *   note   QR 아래 안내 문장(선택)
 *   qr     false 면 QR 을 그리지 않는다
 */
export function shareBox({ url, title = '', text = '', note = '', qr = true }) {
  ensureStyle();
  const status = el('p', { class: 'mg-share-status', 'aria-live': 'polite' });
  const say = (msg, bad) => {
    status.textContent = msg;
    status.classList.toggle('bad', !!bad);
  };
  const area = el('textarea', { readonly: '', rows: '3', 'aria-label': '보낼 링크' });
  area.value = url;

  const canvas = qr ? qrCanvas(url, Math.min(260, Math.max(180, (window.innerWidth || 360) - 120))) : null;
  const dense = url.length > 1100;
  const noteText =
    note ||
    (canvas
      ? '아이 기기 카메라로 QR을 찍거나, 링크를 메신저로 보내 주세요.' + (dense ? ' QR이 촘촘해서 안 읽히면 링크로 보내 주세요.' : '')
      : '링크를 복사해서 메신저로 아이 기기에 보내 주세요.');

  const canShare = typeof navigator.share === 'function';
  const copyBtn = el('button', {
    type: 'button',
    class: canShare ? '' : 'main',
    'data-act': 'copy',
    text: '링크 복사',
    onclick: async () => say((await copyText(url, area)) ? '복사했어요. 메신저에 붙여 넣어 보내 주세요.' : '복사하지 못했어요. 아래 링크를 길게 눌러 복사해 주세요.', false),
  });
  const shareBtn = canShare
    ? el('button', {
        type: 'button',
        class: 'main',
        'data-act': 'share',
        text: '보내기',
        onclick: () =>
          navigator.share({ title, text: text || title, url }).catch((e) => {
            if (e && e.name !== 'AbortError') say('보내기 창을 열지 못했어요. 링크 복사를 써 주세요.', true);
          }),
      })
    : null;

  return el(
    'div',
    { class: 'mg-share', 'data-url': url },
    canvas ? el('div', { class: 'mg-share-qr' }, canvas) : null,
    el('p', { class: 'mg-share-note', text: noteText }),
    el('div', { class: 'mg-share-row' }, copyBtn, shareBtn),
    el('details', {}, el('summary', { text: '링크 보기' }), area),
    status
  );
}
