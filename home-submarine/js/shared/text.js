// 화면에 쓰는 문장들.

import { STAGES, PARTS, TASKS } from './content.js';

const hasBatchim = (word) => {
  const ch = String(word || '').trim().slice(-1).charCodeAt(0);
  return ch >= 0xac00 && ch <= 0xd7a3 && (ch - 0xac00) % 28 !== 0;
};
const isRieul = (word) => {
  const ch = String(word || '').trim().slice(-1).charCodeAt(0);
  return ch >= 0xac00 && ch <= 0xd7a3 && (ch - 0xac00) % 28 === 8;
};

/** 조사를 붙인다. pair 는 '이/가' 처럼 "받침 있을 때/없을 때" 순서. */
export function josa(word, pair) {
  const [a, b] = pair.split('/');
  if (pair === '으로/로') return word + (hasBatchim(word) && !isRieul(word) ? '으로' : '로');
  return word + (hasBatchim(word) ? a : b);
}

/** 구역 이름과 방 이름을 함께. 예: "기관실(부엌)" */
export function stationLabel(station) {
  return station.role.name + '(' + station.room.name + ')';
}

/** 임무 브리핑 문단들 */
export function briefing(captain) {
  const who = captain ? captain + ' 함장' : '함장';
  return [
    who + ', 큰일이야! 간식이 든 보물 상자가 바다 밑 1000미터에 가라앉았어.',
    '우리 집이 잠수함 간식호야. 방마다 잠수함의 구역이 되었어.',
    '낡은 잠수함이라 내려가는 동안 여기저기 고장이 날 거야. 승무원은 너 하나뿐이야.',
    '경보가 뜨면 그 구역으로 가서 고쳐. 상자를 건져서 물 위로 올라오면 임무 성공!',
  ];
}

/** 하는 법 (브리핑에 나온다) */
export function howTo() {
  return [
    '경보가 뜨면 그 방으로 가. 뛰지 말고 빠르게 걸어.',
    '도착하면 그 구역 버튼을 누르고, 벽에 붙은 쪽지를 보고 물어보는 숫자를 눌러.',
    '수리 놀이를 끝내면 고장이 사라져. 시간 안에 못 고치면 선체가 깎여.',
  ];
}

/** 경보 한 줄 설명. 예: "창고에서 퓨즈를 챙겨 조종실로" */
export function alertGuide(alert, stations) {
  const to = stations[alert.station];
  if (alert.kind === 'fetch') {
    const part = PARTS[alert.part];
    const from = stations[alert.source];
    return alert.hasPart
      ? josa(part.name, '을/를') + ' 챙겼어. ' + josa(to.room.name, '으로/로') + ' 가서 고쳐'
      : from.room.name + '에서 ' + josa(part.name, '을/를') + ' 챙겨서 ' + josa(to.room.name, '으로/로');
  }
  if (alert.kind === 'relay') {
    const from = stations[alert.source];
    return alert.sawCode
      ? '외운 좌표를 ' + to.room.name + '에서 입력해'
      : from.room.name + '에서 좌표를 보고 외워서 ' + josa(to.room.name, '으로/로');
  }
  return josa(to.room.name, '으로/로') + ' 가서 ' + TASKS[alert.task].name;
}

/** 단계 이름. 예: "2단계 심해" */
export function stageTitle(index) {
  return index === 0 ? STAGES[0].name : index + '단계 ' + STAGES[index].name;
}

/** 등급별 한 줄 평 (결과보다 노력을 짚는다) */
export function gradeLine(grade) {
  return {
    S: '흔들림 없는 함장. 한 번도 당황하지 않았어.',
    A: '믿음직한 함장. 급한 순간에도 침착했어.',
    B: '끈기 있는 함장. 고장이 몰려와도 끝까지 버텼어.',
    C: '포기하지 않은 함장. 몇 번이고 다시 일어났어.',
  }[grade];
}

/** 항해 일지 머리말 */
export function headline(captain) {
  return (captain ? captain + ' 함장' : '꼬마 함장') + ', 심해 1000미터에서 간식 상자 인양!';
}
