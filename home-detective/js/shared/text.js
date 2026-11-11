// 사건 내용을 한국어 문장으로 바꾼다. 이름은 부모가 정하므로 조사를 받침에 맞춰 붙인다.

import { FOOT_PATTERNS, PRINT_TYPES, PERSONAS } from './content.js';

/** 마지막 글자에 받침이 있는가. 'ㄹ' 받침은 따로 알려 준다 ('으로/로' 때문). */
function batchim(word) {
  const s = String(word || '').trim();
  if (!s) return { has: false, rieul: false };
  const ch = s.charCodeAt(s.length - 1);
  if (ch >= 0xac00 && ch <= 0xd7a3) {
    const jong = (ch - 0xac00) % 28;
    return { has: jong !== 0, rieul: jong === 8 };
  }
  // 한글이 아니면 숫자와 영어 발음을 대강 따른다
  const last = s[s.length - 1].toLowerCase();
  if ('0136780'.includes(last)) return { has: true, rieul: '178'.includes(last) };
  if ('lmnr'.includes(last)) return { has: true, rieul: last === 'l' || last === 'r' };
  return { has: false, rieul: false };
}

/**
 * 조사를 붙인다. pair 는 '이/가', '은/는', '을/를', '과/와', '으로/로', '이랑/랑', '이/' 처럼
 * "받침 있을 때/없을 때" 순서로 쓴다.
 */
export function josa(word, pair) {
  const [withB, withoutB] = pair.split('/');
  const b = batchim(word);
  if (pair === '으로/로') return word + (b.has && !b.rieul ? '으로' : '로');
  return word + (b.has ? withB : withoutB);
}

const name = (cs, s) => cs.suspects[s].name;
const room = (cs, r) => cs.rooms[r].name;
const slot = (cs, t) => cs.slots[t];

/** 수첩에 적는 진술 한 줄 (말투 없이 짧게). 예: "거실 · 로봇과 함께" */
export function statementNote(cs, s, t) {
  const st = cs.statements[s][t];
  const comp = st.comp;
  let tail = '';
  if (comp && comp.kind === 'alone') tail = ' · 혼자';
  else if (comp && comp.kind === 'with') tail = ' · ' + josa(name(cs, comp.who), '과/와') + ' 함께';
  else if (comp && comp.kind === 'without') tail = ' · ' + josa(name(cs, comp.who), '은/는') + ' 없었음';
  return room(cs, st.room) + tail;
}

/** 진술을 한 문장으로 (증거 제시 화면과 설명에 쓴다). 예: "곰돌이: 오후 3시에 거실에 혼자 있었다." */
export function statementLine(cs, s, t) {
  const st = cs.statements[s][t];
  const comp = st.comp;
  const where = slot(cs, t) + '에 ' + room(cs, st.room) + '에';
  let body;
  if (comp && comp.kind === 'alone') body = where + ' 혼자 있었다.';
  else if (comp && comp.kind === 'with') body = where + ' ' + josa(name(cs, comp.who), '과/와') + ' 함께 있었다.';
  else if (comp && comp.kind === 'without') body = where + ' 있었다. ' + josa(name(cs, comp.who), '은/는') + ' 거기 없었다.';
  else body = where + ' 있었다.';
  return name(cs, s) + ': ' + body;
}

/**
 * 탐문 때 인형이 하는 말. 말투에 따라 앞뒤 말이 붙는다.
 * pickIndex 는 같은 인형이 시각마다 다른 말버릇을 쓰게 하는 번호다.
 */
export function statementSpeech(cs, s, t) {
  const st = cs.statements[s][t];
  const comp = st.comp;
  const persona = PERSONAS[cs.suspects[s].persona % PERSONAS.length];
  const core = [slot(cs, t) + '에는 ' + room(cs, st.room) + '에 있었어.'];
  if (comp && comp.kind === 'alone') core.push('나 혼자였어.');
  else if (comp && comp.kind === 'with') core.push(josa(name(cs, comp.who), '이랑/랑') + ' 같이 있었어.');
  else if (comp && comp.kind === 'without') core.push(josa(name(cs, comp.who), '은/는') + ' 거기 없었어.');
  else core.push('누가 또 있었는지는 기억이 안 나.');
  const pre = persona.pre[(s + t) % persona.pre.length];
  const post = persona.post[(s * 2 + t) % persona.post.length];
  return pre + ' ' + core.join(' ') + ' ' + post;
}

/** 탐문 첫마디와 끝말 */
export function personaHello(cs, s) {
  const persona = PERSONAS[cs.suspects[s].persona % PERSONAS.length];
  return persona.hello[s % persona.hello.length];
}
export function personaBye(cs, s) {
  return PERSONAS[cs.suspects[s].persona % PERSONAS.length].bye;
}
export function personaName(cs, s) {
  return PERSONAS[cs.suspects[s].persona % PERSONAS.length].name;
}

/** 증거의 이름 (수첩 제목) */
export function evidenceTitle(cs, ev) {
  switch (ev.fact.kind) {
    case 'time':
      return '멈춘 시계';
    case 'cfoot':
      return '현장의 발자국';
    case 'cprint':
      return '간식 통의 지문';
    case 'trail':
      return '초코 손자국';
    case 'foot':
      return '바닥의 발자국';
    case 'count':
      return 'CCTV 기록';
    case 'seen':
      return '찢어진 출입 기록';
    default:
      return '증거';
  }
}

/** 증거 그림 문자 */
export function evidenceIcon(ev) {
  return { time: '🕰️', cfoot: '👣', cprint: '🖐️', trail: '🍫', foot: '👣', count: '📹', seen: '🧾' }[ev.fact.kind] || '🔎';
}

/** 증거를 조사하기 전에 보여 주는 한 줄 */
export function evidenceIntro(cs, ev) {
  const f = ev.fact;
  const crime = room(cs, cs.crimeRoom);
  switch (f.kind) {
    case 'time':
      return '간식 통 옆에 시계가 떨어져 멈춰 있다. 간식이 사라진 바로 그 순간에 멈춘 것 같다.';
    case 'cfoot':
      return crime + '의 간식 통 앞 바닥에 먼지가 쌓여 있다. 문질러서 범인의 발자국을 찾아보자.';
    case 'cprint':
      return '간식 통 뚜껑에 지문이 남아 있다. 어떤 모양인지 대조해 보자.';
    case 'trail':
      return '어두운 곳에 무언가 묻어 있다. 특수 조명을 비춰 보자.';
    case 'foot':
      return '바닥에 먼지가 쌓여 있다. 문질러서 발자국을 찾아보자.';
    case 'count':
      return '방범 카메라 화면이 지직거린다. 주파수를 맞춰 보자.';
    case 'seen':
      return '누군가 출입 기록을 찢어 놓았다. 조각을 맞춰 보자.';
    default:
      return '';
  }
}

/** 조사를 마친 증거가 말해 주는 사실 (수첩에 적힌다) */
export function factText(cs, ev) {
  const f = ev.fact;
  const crime = room(cs, cs.crimeRoom);
  switch (f.kind) {
    case 'time':
      return '간식이 사라진 시각은 ' + slot(cs, f.slot) + '다.';
    case 'cfoot':
      return '범인의 발자국은 ' + FOOT_PATTERNS[f.pattern] + '다. (' + crime + ' 간식 통 앞)';
    case 'cprint':
      return '범인의 지문은 ' + PRINT_TYPES[f.type] + '이다. (' + crime + ' 간식 통)';
    case 'trail':
      return '범인은 ' + slot(cs, f.slot) + '에 ' + room(cs, f.room) + '에 있었다. (초코 묻은 손자국)';
    case 'foot':
      return slot(cs, f.slot) + '에 ' + room(cs, f.room) + '에 있던 이는 모두 ' + FOOT_PATTERNS[f.pattern] + ' 발자국이다.';
    case 'count':
      return f.n === 0
        ? slot(cs, f.slot) + '에 ' + room(cs, f.room) + '에는 아무도 없었다.'
        : slot(cs, f.slot) + '에 ' + room(cs, f.room) + '에는 ' + f.n + '명이 있었다.';
    case 'seen':
      return josa(name(cs, f.who), '은/는') + ' ' + slot(cs, f.slot) + '에 ' + room(cs, f.room) + '에 있었다.';
    default:
      return '';
  }
}

/** 수첩 항목(진술 또는 증거)을 한 문장으로 */
export function itemText(cs, item) {
  if (item.type === 'statement') return statementLine(cs, item.who, item.slot);
  const ev = cs.evidence[item.index];
  return evidenceTitle(cs, ev) + ': ' + factText(cs, ev);
}

/** 사건 브리핑 문단들 */
export function briefing(cs, detective) {
  const who = detective ? detective + ' 탐정' : '탐정';
  return [
    who + ', 큰일이야! ' + room(cs, cs.crimeRoom) + '에 있던 간식 상자가 감쪽같이 사라졌어.',
    '집 안에 있던 ' + cs.suspects.length + '명이 용의자야. 모두 집 안 어딘가에 숨어 있어.',
    '집을 돌아다니며 쪽지를 찾아. 쪽지가 붙은 용의자는 탐문하고, 쪽지가 붙은 곳은 증거를 조사해.',
    '범인이 간식을 다 먹어 버리기 전에 범인을 찾아내야 해!',
  ];
}

/** 수사 규칙 (브리핑과 수첩에 그대로 나온다) */
export function rules(cs) {
  return [
    '범인은 한 명이다.',
    '범인은 간식이 사라진 시각에 ' + room(cs, cs.crimeRoom) + '에 혼자 있었다.',
    '범인은 그 시각에 대해서만 거짓말을 한다.',
    '범인이 아니면 사실만 말한다. 증거는 거짓말을 하지 않는다.',
  ];
}

/** 범인의 자백 */
export function confession(cs) {
  const c = cs.culprit;
  const lie = cs.statements[c][cs.crimeSlot];
  return [
    '으으… 들켰다!',
    '맞아. ' + slot(cs, cs.crimeSlot) + '에 ' + room(cs, lie.room) + '에 있었다는 건 거짓말이야.',
    '사실은 ' + room(cs, cs.crimeRoom) + '에서 간식 상자를 몰래 들고 나왔어. 너무 맛있어 보여서 그만…',
    '미안해. 간식은 한 입도 안 먹고 숨겨 뒀어. 어디 있는지 알려 줄게.',
  ];
}

/** 신문 머리기사 */
export function headline(cs, detective) {
  const who = detective ? detective + ' 탐정' : '꼬마 탐정';
  return who + ', 간식 도둑 ' + name(cs, cs.culprit) + ' 검거!';
}
