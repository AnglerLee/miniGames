// 결말 시험대: 그럴듯한 수사 기록(run)을 지어내서 결말 화면이나 관찰 리포트를 띄운다.
// 검증 스크립트는 ?debug=1 일 때 열리는 window.__end 를 쓴다.
import { defaultSetup, caseKey, loadRun, saveRun, clearRun, photos, KEYS } from '../shared/store.js';
import { buildCase } from '../shared/case.js';
import { newRun, RULES } from '../shared/score.js';
import { judge } from '../shared/logic.js';
import { DIFFICULTY } from '../shared/content.js';
import { stream } from '../shared/prng.js';
import { DEBUG, toast } from '../shared/dom.js';
import { showEnding } from './ending.js';
import { audio } from './audio.js';
import { showReport, analyze, outcome } from './report.js';

const q = new URLSearchParams(location.search);
const d = Math.max(0, Math.min(2, Number(q.has('d') ? q.get('d') : 1) | 0));
const seed = Number(q.get('seed') || 7);
const kind = ['clean', 'messy', 'late', 'forced'].includes(q.get('case')) ? q.get('case') : 'clean';
const view = q.get('view') === 'report' ? 'report' : 'ending';

const TREASURE_TEXT = { lock: '3 - 1 - 7', place: '세탁기 안', key: '신발장 둘째 칸', text: '엄마에게 "수사 끝"이라고 말하기' };
const LONG_NAMES = ['초록색공룡티라노', '분홍토끼말랑이야', '은색로봇삐삐뽀뽀', '노란병아리삐약이', '파란펭귄뒤뚱뒤뚱', '까만고양이야옹이'];

function makeSetup() {
  const s = defaultSetup();
  s.seed = seed;
  s.difficulty = d;
  s.minutes = DIFFICULTY[d].minutes;
  s.detective = q.has('name') ? q.get('name') : '지우';
  const tk = TREASURE_TEXT[q.get('treasure')] ? q.get('treasure') : 'place';
  s.treasure = { kind: tk, text: q.has('ttext') ? q.get('ttext') : TREASURE_TEXT[tk] };
  const b = q.get('bonus') || 'A';
  s.bonus = b === 'none' ? { text: '', rule: 'A' } : { text: q.get('btext') || '아이스크림 하나 더', rule: ['A', 'S', 'always'].includes(b) ? b : 'A' };
  s.predict = q.get('predict') === '0' ? null : { time: 1, hints: 1, first: 'suspect' };
  s.ready = true;
  s.caseNo = Number(q.get('no') || 3);
  if (q.get('long') === '1') s.suspects.forEach((p, i) => (p.name = LONG_NAMES[i % LONG_NAMES.length]));
  return s;
}

/** 시험용 범인 사진: 작은 PNG 를 그려서 IndexedDB 에 넣는다 */
async function putPhoto(key) {
  const c = document.createElement('canvas');
  c.width = 120;
  c.height = 120;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 120, 120);
  grd.addColorStop(0, '#7fb8d8');
  grd.addColorStop(1, '#3d7ea6');
  g.fillStyle = grd;
  g.fillRect(0, 0, 120, 120);
  g.fillStyle = '#c98b52';
  g.beginPath();
  g.arc(60, 66, 40, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(28, 32, 16, 0, Math.PI * 2);
  g.arc(92, 32, 16, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#2b2118';
  g.beginPath();
  g.arc(46, 60, 6, 0, Math.PI * 2);
  g.arc(74, 60, 6, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = '#2b2118';
  g.beginPath();
  g.arc(60, 76, 14, 0.15 * Math.PI, 0.85 * Math.PI);
  g.stroke();
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  await photos.put(key, blob);
}

/**
 * 사건 하나를 푼 것처럼 기록을 지어낸다. 행동마다 무게를 주고 전체 시간 E 에 비례해 시각을 매긴다.
 *   clean  12분, 힌트·오답 없음 (S)
 *   messy  제한의 78%(보통 난이도면 약 22분), 힌트 3, 잘못 고발 1, 발뺌 1, 틀린 기호 4, 멈춤 1
 *   late   제한 + 3분, 추리 힌트 1
 *   forced 제한의 90%, 쪽지 60% 만 찾고 부모 도움 1, 힌트 1, 잘못 고발 1, 부모가 끝냄
 */
function fabricate(setup, cs) {
  const rng = stream(seed, 'lab-ending', kind, d);
  const limit = setup.minutes * 60000;
  const t0 = Date.now() - 2 * 3600000;
  const run = newRun(caseKey(setup), limit, t0);
  run.labCase = kind;
  run.phase = 'solved';
  const E = { clean: 12 * 60000, messy: Math.round(limit * 0.78), late: limit + 3 * 60000, forced: Math.round(limit * 0.9) }[kind];
  const acts = [];
  const add = (w, fn) => acts.push({ w, fn });
  const ev = (at, type, extra) => run.events.push(Object.assign({ at, type }, extra));
  const hint = (type, level, target) => (at) => {
    run.hints.push({ at, type, level, target });
    run.penaltyMs += RULES.hintMs[level - 1];
    ev(at, 'hint', { kind: type, level, target });
  };
  const accuse = (suspect, slot, item) => (at) => {
    const result = judge(cs, { suspect, slot, item });
    run.accusations.push({ at, suspect, slot, item, result });
    ev(at, 'accuse', { suspect, slot, item, result });
    if (result === 'wrong') {
      run.penaltyMs += RULES.wrongMs;
      run.badges--;
    } else if (result === 'deny') run.penaltyMs += RULES.denyMs;
    else ev(at, 'solved');
  };

  // 시계 증거는 앞쪽에서 찾게 한다 (실제로도 사건 현장부터 보는 아이가 많다)
  let order = rng.shuffle(cs.tags.slice());
  const clockIdx = order.findIndex((t) => t.id === 'e:e1');
  order.splice(Math.min(1, order.length - 1), 0, order.splice(clockIdx, 1)[0]);
  const foundN = kind === 'forced' ? Math.ceil(order.length * 0.6) : order.length;
  const stuck = Math.min(foundN - 1, Math.floor(foundN / 2) + 1); // 오래 막히는 쪽지
  const innocent = cs.suspects.findIndex((_, i) => i !== cs.culprit);

  order.slice(0, foundN).forEach((tag, i) => {
    if (i === stuck && kind === 'messy') {
      add(1.2, hint('search', 1, tag.id));
      add(1.0, hint('search', 2, tag.id));
    }
    if (i === stuck && kind === 'forced') add(1.4, hint('search', 1, tag.id));
    if (i === 2 && kind === 'messy') {
      for (let k = 0; k < 3; k++) add(0.08, (at) => (run.wrongCodes++, ev(at, 'wrongCode')));
      add(0.02, (at) => ev(at, 'lock'));
    }
    if (i === 4 && kind === 'messy') add(0.3, (at) => (run.wrongCodes++, ev(at, 'wrongCode')));
    if (i === 3 && kind === 'messy') {
      add(0.3, (at) => {
        run.pauses++;
        run.pausedMs += 180000;
        ev(at, 'pause', { ms: 180000 });
      });
    }
    // 부모가 "찾은 것으로 처리"한 쪽지
    if (i === foundN - 1 && kind === 'forced') {
      add(1.2, (at) => {
        run.found[tag.id] = { at, done: true, misses: 0 };
        if (tag.kind === 'suspect') run.asked[tag.ref] = [0, 1, 2];
        ev(at, 'rescue', { tag: tag.id });
      });
      return;
    }
    add(i === stuck ? (kind === 'clean' ? 3.2 : 1.6) : 1, (at) => {
      run.found[tag.id] = { at, done: false, misses: 0 };
      ev(at, 'find', { tag: tag.id });
    });
    if (tag.kind === 'suspect') {
      for (let t = 0; t < 3; t++) {
        add(0.12, (at) => {
          (run.asked[tag.ref] = run.asked[tag.ref] || []).push(t);
          ev(at, 'asked', { s: tag.ref, t });
          if (t === 2) run.found[tag.id].done = true;
        });
      }
      // 같은 질문을 다시 듣기
      if (kind === 'messy' && i % 3 === 0) add(0.1, (at) => ev(at, 'asked', { s: tag.ref, t: cs.crimeSlot }));
    } else {
      const misses = kind === 'messy' && i === 1 ? 2 : kind === 'late' && i === 2 ? 1 : 0;
      add(0.45, (at) => {
        run.found[tag.id].done = true;
        run.found[tag.id].misses = misses;
        ev(at, 'scene', { tag: tag.id, misses });
      });
    }
    // 증거를 다 모으기 전에 서둘러 고발
    if ((kind === 'messy' || kind === 'forced') && i === Math.floor(foundN * 0.6)) add(0.6, accuse(innocent, cs.crimeSlot, { type: 'evidence', index: 0 }));
  });

  if (kind === 'messy') {
    add(0.8, hint('deduce', 1, null));
    add(0.8, accuse(cs.culprit, cs.crimeSlot, { type: 'evidence', index: 0 }));
  }
  if (kind === 'late') add(0.8, hint('deduce', 2, null));
  // 등급을 S 아래로 내려 보는 손잡이 (보너스 기준 시험용): 추리 힌트 1단계를 n번 더
  if (kind === 'clean') for (let k = 0; k < Number(q.get('hints') || 0); k++) add(0.3, hint('deduce', 1, null));
  if (kind !== 'forced') add(1.2, accuse(cs.culprit, cs.crimeSlot, cs.refuters[0]));
  else add(1.0, () => {});

  const W = acts.reduce((s, a) => s + a.w, 0);
  ev(0, 'start');
  let t = 0;
  for (const a of acts) {
    t += (a.w / W) * E;
    a.fn(Math.round(t));
  }
  if (kind === 'late') {
    run.late = true;
    ev(Math.max(0, limit - run.penaltyMs), 'late');
  }
  if (kind === 'forced') run.forced = true;
  if (kind === 'clean') Object.assign(run.marks, { 's:0:1': 1, 's:1:2': 2, 'e:1': 1, ['s:' + cs.culprit + ':' + cs.crimeSlot]: 2 });
  if (kind === 'late') run.marks['e:1'] = 2;
  run.events.sort((a, b) => a.at - b.at);
  run.solvedAt = t0 + E + run.pausedMs;
  return run;
}

async function main() {
  if (q.get('reset') === '1') {
    clearRun();
    try {
      localStorage.removeItem(KEYS.history);
    } catch (e) {
      /* 저장소 없음 */
    }
    // 새로고침 시험에서 다시 지우지 않게 주소에서 뺀다
    q.delete('reset');
    history.replaceState(null, '', location.pathname + '?' + q.toString());
  }
  const setup = makeSetup();
  const cs = buildCase(setup);
  if (q.has('cname')) {
    const name = q.get('cname');
    cs.suspects[cs.culprit].name = name;
    setup.suspects.find((p) => p.id === cs.suspects[cs.culprit].id).name = name;
  }
  if (q.get('photo') === '1') {
    const key = 'suspect:' + cs.suspects[cs.culprit].id;
    await putPhoto(key);
    cs.suspects[cs.culprit].photo = key;
    setup.suspects.find((p) => p.id === cs.suspects[cs.culprit].id).photo = key;
  }
  const saved = loadRun();
  const run = saved && saved.caseKey === caseKey(setup) && saved.labCase === kind ? saved : fabricate(setup, cs);
  if (run !== saved) saveRun(run);

  const root = document.getElementById('root');
  const now = Date.now();
  const calls = [];
  const sfx = [];
  if (DEBUG) {
    const play = audio.sfx.bind(audio);
    audio.sfx = (name) => (sfx.push(name), play(name));
  }
  let handle;
  if (view === 'report') {
    handle = showReport(root, { setup, cs, run, now, onBack: () => (calls.push('back'), toast('돌아가기 (시험대)')) });
  } else {
    handle = showEnding(root, {
      setup,
      cs,
      run,
      now,
      onNewCase: () => (calls.push('newCase'), toast('새 사건 준비하기 (시험대)')),
      onHome: () => (calls.push('home'), toast('처음으로 (시험대)')),
    });
  }
  if (DEBUG) {
    window.__end = {
      run,
      cs,
      setup,
      now,
      calls,
      sfx,
      handle,
      page: () => handle.page && handle.page(),
      next: () => handle.next && handle.next(),
      prev: () => handle.prev && handle.prev(),
      go: (i) => handle.go && handle.go(i),
      timers: () => (handle.timers ? handle.timers() : 0),
      destroy: () => handle.destroy(),
      result: () => outcome(run, now),
      analyze: () => analyze(setup, cs, run, now),
    };
  }
}

main().catch((err) => {
  console.error(err);
  document.getElementById('root').textContent = '시험대를 띄우지 못했어요: ' + err.message;
});
