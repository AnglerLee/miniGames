// QR 코드를 흰 바탕의 캔버스에 그린다.
// 어두운 화면 위에서도 카메라가 읽을 수 있도록 둘레에 흰 여백을 4칸 둔다.

import qrcode from '../../vendor/qrcode/qrcode.js';

export function qrCanvas(text, px = 220) {
  const qr = qrcode(0, 'M'); // 0: 크기 자동, M: 오류 정정 중간
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const quiet = 4;
  const cell = Math.max(2, Math.floor(px / (count + quiet * 2)));
  const size = cell * (count + quiet * 2);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  canvas.style.width = canvas.style.height = size + 'px';
  const g = canvas.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, size, size);
  g.fillStyle = '#000000';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) g.fillRect((col + quiet) * cell, (row + quiet) * cell, cell, cell);
    }
  }
  return canvas;
}
