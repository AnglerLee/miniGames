// 문 앞에 선 보안 단말기가 있는 방. 정문 게이트와 보안 토큰 단계가 함께 쓴다.
// 단말기 = 화면(다시 그릴 수 있는 텍스처) + 3D 키패드. 뒤에는 잠긴 문이 있다.

import * as T from '../lib/three.js';
import { room, box, plane, lit, glow, label, liveTexture, hitPlate, hazardTexture, ceilingLight, lamp } from '../engine/kit.js';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', ''];

export function createTerminalRoom(env, { sector, wall }) {
  const root = new T.Group();
  root.add(room({ w: 6, h: 3.8, d: 10, wall }));
  ceilingLight(root, 0, 3.8, 1.5, { intensity: 16 });
  ceilingLight(root, 0, 3.8, -2.5, { intensity: 12 });
  root.add(new T.AmbientLight(0x8fa4d8, 0.9));

  // ---- 문: 좌우로 열리는 두 짝 ----
  const doorZ = -4.9;
  const hazard = hazardTexture();
  hazard.repeat.set(6, 0.5);
  const frameTop = box(3.9, 0.3, 0.3, lit(0xffffff, { map: hazard }));
  frameTop.position.set(0, 3.05, doorZ + 0.1);
  const doorMat = lit(0x55617c);
  const leftDoor = box(1.75, 2.9, 0.16, doorMat);
  const rightDoor = box(1.75, 2.9, 0.16, doorMat);
  leftDoor.position.set(-0.88, 1.45, doorZ + 0.05);
  rightDoor.position.set(0.88, 1.45, doorZ + 0.05);
  const stripe = box(0.06, 2.9, 0.18, lit(0x1b2233));
  stripe.position.set(0, 1.45, doorZ + 0.05);
  const sign = label(sector, { w: 2.2, h: 0.45, color: '#ffd76a', px: 80 });
  sign.position.set(0, 3.45, doorZ + 0.02);
  const lockLamp = lamp(0.09, 0xff3040);
  lockLamp.position.set(0, 2.72, doorZ + 0.2);
  lockLamp.userData.set(true);
  // 문 뒤: 열렸을 때 보이는 밝은 통로
  const beyond = plane(3.5, 2.9, glow(0xbfe9ff));
  beyond.position.set(0, 1.45, doorZ - 0.05);
  root.add(frameTop, leftDoor, rightDoor, stripe, sign, lockLamp, beyond);

  // ---- 단말기 ----
  const kiosk = new T.Group();
  kiosk.position.set(0, 0, -1.6);
  // 받침 기둥은 키패드를 가리지 않도록 판 뒤쪽에 세운다
  const post = box(0.22, 0.9, 0.22, lit(0x2a3145));
  post.position.set(0, 0.45, -0.17);
  const head = box(0.74, 1.14, 0.1, lit(0x1b2130));
  head.position.y = 1.42;
  kiosk.add(post, head);

  const screen = liveTexture(512, 320);
  const screenMesh = plane(0.64, 0.4, glow(0xffffff, { map: screen.texture }));
  screenMesh.position.set(0, 1.72, 0.052);
  kiosk.add(screenMesh);

  const keys = [];
  const keyW = 0.17;
  const keyH = 0.118;
  KEYS.forEach((name, i) => {
    if (!name) return;
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cap = box(keyW, keyH, 0.04, lit(name === 'C' ? 0x7a2f3a : 0x3b4763));
    const x = (col - 1) * 0.205;
    const y = 1.42 - row * 0.142;
    cap.position.set(x, y, 0.06);
    const text = label(name === 'C' ? '지움' : name, { w: keyW * 0.9, h: keyH * 0.9, px: 72 });
    text.position.set(0, 0, 0.021);
    cap.add(text);
    const plate = hitPlate(0.2, 0.14, 0.06);
    plate.position.set(x, y, 0.07);
    kiosk.add(cap, plate);
    keys.push({ name, cap, plate, press: 0 });
  });
  root.add(kiosk);

  const stations = {
    // 방 입구에서 문과 단말기를 함께 본다
    far: { pos: [0, 1.7, 4.2], yaw: 0, pitch: -0.03, fov: 68, look: { yaw: 0.5, pitch: 0.25 }, spring: false },
    // 단말기 화면과 키패드가 화면에 꽉 차게
    focus: { frame: { center: [0, 1.4, -1.54], yaw: 0, width: 0.8, height: 1.22 }, fov: 62 },
  };

  let doorOpen = 0; // 0 닫힘 ~ 1 열림
  let doorTarget = 0;

  return {
    root,
    stations,
    screen,
    keys,

    /** 키가 눌리는 모습 */
    pressKey(name) {
      const key = keys.find((k) => k.name === name);
      if (key) key.press = 1;
    },

    openDoor() {
      doorTarget = 1;
      lockLamp.material.color.set(0x3ddc84);
    },

    update(dt) {
      for (const key of keys) {
        if (key.press > 0) {
          key.press = Math.max(0, key.press - dt * 6);
          key.cap.position.z = 0.06 - 0.022 * key.press;
        }
      }
      if (doorOpen !== doorTarget) {
        doorOpen = Math.min(doorTarget, doorOpen + dt * 0.8);
        const slide = doorOpen * doorOpen * (3 - 2 * doorOpen) * 1.7;
        leftDoor.position.x = -0.88 - slide;
        rightDoor.position.x = 0.88 + slide;
        stripe.visible = false;
      }
    },
  };
}

/** 단말기 화면 공통 바탕 */
export function drawScreenFrame(g, w, h, title, tint = '#36e0ff') {
  g.fillStyle = '#04101c';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = tint;
  g.lineWidth = 6;
  g.strokeRect(3, 3, w - 6, h - 6);
  g.fillStyle = tint;
  g.font = '800 30px "Pretendard","Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(title, w / 2, 34);
}

/** 입력한 숫자 칸 네 개 */
export function drawEntryBoxes(g, w, y, entered, length, tint = '#36e0ff') {
  const size = 58;
  const gap = 16;
  const x0 = w / 2 - (length * size + (length - 1) * gap) / 2;
  g.font = '800 44px ui-monospace, Menlo, Consolas, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let i = 0; i < length; i++) {
    const x = x0 + i * (size + gap);
    g.strokeStyle = tint;
    g.lineWidth = 3;
    g.strokeRect(x, y, size, size);
    if (entered[i] !== undefined) {
      g.fillStyle = '#ffffff';
      g.fillText(String(entered[i]), x + size / 2, y + size / 2 + 3);
    }
  }
}
