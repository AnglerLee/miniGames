// 시간, 벌점, 등급. 화면 없이 계산만 하므로 테스트하기 쉽다.
// 수치는 모두 시작값이며 실제로 해 본 뒤 고친다.

export const RULES = {
  /** 고발 기회 (탐정 배지) */
  badges: 3,
  /** 결백한 용의자를 고발했을 때 */
  wrongMs: 120000,
  wrongScore: 12,
  /** 범인은 맞지만 증거가 틀렸을 때 */
  denyMs: 45000,
  denyScore: 5,
  /** 힌트 단계별 (1, 2, 3단계) */
  hintMs: [20000, 40000, 60000],
  hintScore: [4, 7, 10],
  /** 없는 기호를 연달아 이만큼 넣으면 잠깐 잠긴다 */
  wrongCodeStreak: 3,
  wrongCodeLockMs: 15000,
  /** 증거 조사에서 틀린 선택 하나당 (최대 sceneMissCap) */
  sceneMissScore: 1,
  sceneMissCap: 5,
  /** 배지를 다 쓰면 이만큼 쉬었다가 배지 하나를 돌려받는다 */
  suspendMs: 60000,
  /** 제한 시간의 이 비율을 넘겨 쓰면 점수가 깎이기 시작한다 */
  slowFrom: 0.7,
  slowScore: 15,
  /** 시간을 넘겼을 때 */
  lateScore: 10,
};

export const GRADES = ['S', 'A', 'B', 'C'];

/** 이번 수사를 시작하는 상태 */
export function newRun(caseKey, limitMs, now) {
  return {
    v: 1,
    caseKey,
    phase: 'brief', // brief → play → solved → end
    startedAt: now,
    limitMs,
    penaltyMs: 0,
    pausedMs: 0,
    pauseAt: null,
    found: {}, // 쪽지 id → { at, done, misses }
    asked: {}, // 용의자 번호 → [물어본 시각 번호]
    marks: {}, // 수첩 항목 열쇠 → 0 없음 / 1 믿음 / 2 의심
    hints: [], // { at, type:'search'|'deduce', level, target }
    wrongCodes: 0,
    codeStreak: 0,
    lockUntil: 0,
    accusations: [], // { at, suspect, slot, item, result }
    badges: RULES.badges,
    suspendUntil: 0,
    pauses: 0,
    late: false,
    events: [], // 관찰 리포트용 { at, type, ... }
    solvedAt: null,
  };
}

/** 시작한 뒤 실제로 흐른 수사 시간 (멈춘 시간은 뺀다) */
export function elapsedMs(run, now) {
  const end = run.solvedAt !== null ? run.solvedAt : run.pauseAt !== null ? run.pauseAt : now;
  return Math.max(0, end - run.startedAt - run.pausedMs);
}

/** 남은 시간. 벌로 깎인 시간을 뺀다. 음수면 시간을 넘긴 것. */
export function remainingMs(run, now) {
  return run.limitMs - elapsedMs(run, now) - run.penaltyMs;
}

/** 점수와 등급 */
export function computeScore(run, now) {
  const used = elapsedMs(run, now) + run.penaltyMs;
  const ratio = run.limitMs > 0 ? used / run.limitMs : 1;
  const wrong = run.accusations.filter((a) => a.result === 'wrong').length;
  const deny = run.accusations.filter((a) => a.result === 'deny').length;
  const hint = run.hints.reduce((sum, hnt) => sum + (RULES.hintScore[hnt.level - 1] || 0), 0);
  const misses = Object.values(run.found).reduce((sum, f) => sum + (f.misses || 0), 0);
  const late = ratio > 1 || run.late;
  const parts = {
    wrong: wrong * RULES.wrongScore,
    deny: deny * RULES.denyScore,
    hint,
    miss: Math.min(RULES.sceneMissCap, misses) * RULES.sceneMissScore,
    slow: ratio > RULES.slowFrom ? Math.round(Math.min(1, (ratio - RULES.slowFrom) / (1 - RULES.slowFrom)) * RULES.slowScore) : 0,
    late: late ? RULES.lateScore : 0,
  };
  const score = Math.max(0, 100 - Object.values(parts).reduce((a, b) => a + b, 0));
  let grade = score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 55 ? 'B' : 'C';
  // 시간을 넘기면 B 가 최고다
  if (late && (grade === 'S' || grade === 'A')) grade = 'B';
  return { score, grade, parts, late, usedMs: used };
}

/** 보너스 보상을 주는가. rule: 'A' | 'S' | 'always' */
export function bonusUnlocked(grade, rule) {
  if (rule === 'always') return true;
  if (rule === 'S') return grade === 'S';
  return grade === 'S' || grade === 'A';
}

/** mm:ss. 음수면 앞에 + 를 붙여 넘긴 시간을 보여 준다. */
export function clock(ms) {
  const over = ms < 0;
  const sec = Math.floor(Math.abs(ms) / 1000);
  const text = String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
  return over ? '+' + text : text;
}

/**
 * 관찰 리포트에 쓸 요약을 만든다.
 * 돌려주는 값: { usedMs, finds:[{id, at}], longestGapMs, longestGapAfter, hints, wrongCodes, wrong, deny, pauses, firstKind }
 */
export function summarize(run, now) {
  const finds = Object.entries(run.found)
    .map(([id, f]) => ({ id, at: f.at }))
    .sort((a, b) => a.at - b.at);
  let longestGapMs = 0;
  let longestGapAfter = null;
  let prev = 0;
  let prevId = null;
  for (const f of finds) {
    if (f.at - prev > longestGapMs) {
      longestGapMs = f.at - prev;
      longestGapAfter = prevId;
    }
    prev = f.at;
    prevId = f.id;
  }
  return {
    usedMs: elapsedMs(run, now),
    finds,
    longestGapMs,
    longestGapAfter,
    hints: run.hints.length,
    wrongCodes: run.wrongCodes,
    wrong: run.accusations.filter((a) => a.result === 'wrong').length,
    deny: run.accusations.filter((a) => a.result === 'deny').length,
    pauses: run.pauses,
    firstKind: finds.length ? (finds[0].id.startsWith('s:') ? 'suspect' : 'evidence') : null,
  };
}
