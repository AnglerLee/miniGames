// 점수와 등급, 관찰 리포트용 요약. 수치는 시작값이며 실제로 해 본 뒤 고친다.

export const RULES = {
  /** 선체 손상 1칸당 */
  damageScore: 6,
  /** 단계를 다시 할 때마다 */
  retryScore: 12,
  /** 도착 확인을 틀릴 때마다 (최대 wrongQueryCap) */
  wrongQueryScore: 1,
  wrongQueryCap: 8,
  /** 암호나 크레인 순서를 틀릴 때마다 */
  memoryScore: 2,
  /** 부모가 단계를 넘겨 줄 때마다 */
  rescueScore: 15,
  /** 도착 확인을 틀리면 이만큼 입력이 잠긴다 */
  wrongQueryLockMs: 2500,
};

export const GRADES = ['S', 'A', 'B', 'C'];

/** 점수와 등급 */
export function computeScore(state) {
  const st = state.stats;
  const parts = {
    damage: st.damage * RULES.damageScore,
    retry: state.retries * RULES.retryScore,
    query: Math.min(RULES.wrongQueryCap, st.wrongQueries) * RULES.wrongQueryScore,
    memory: (st.relayWrong + st.routeWrong) * RULES.memoryScore,
    rescue: st.rescues * RULES.rescueScore,
  };
  const score = Math.max(0, 100 - Object.values(parts).reduce((a, b) => a + b, 0));
  const grade = score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 55 ? 'B' : 'C';
  return { score, grade, parts };
}

/** 보너스 보상을 주는가. rule: 'A' | 'S' | 'always' */
export function bonusUnlocked(grade, rule) {
  if (rule === 'always') return true;
  if (rule === 'S') return grade === 'S';
  return grade === 'S' || grade === 'A';
}

/** mm:ss */
export function clock(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
}

/**
 * 관찰 리포트에 쓸 요약.
 *   totalMs        전체 걸린 시간 (멈춘 시간 제외)
 *   resolved/missed 해결한 경보 수 / 놓친 경보 수
 *   avgUse         경보마다 제한 시간의 몇 % 를 썼는지 평균 (0~1). 낮을수록 여유 있게 해냈다.
 *   doubles        두 곳이 함께 고장 났을 때 { total, urgentFirst } 급한 것부터 고친 횟수
 *   relay          암호 전달 { total, clean } 한 번에 맞힌 횟수
 *   hopFirstMs/hopLastMs  잠항과 마지막 단계의 구역 사이 간격 가운데 값 (지쳤는지 볼 수 있다).
 *                  출항 점검은 걷기만 해서 수리 시간이 든 뒤 단계와 견줄 수 없으므로 뺀다.
 *   hardestStage   가장 많이 다시 했거나 가장 많이 놓친 단계 id (없으면 null)
 */
export function summarize(state) {
  const st = state.stats;
  const med = (list) => {
    if (!list.length) return null;
    const a = list.slice().sort((x, y) => x - y);
    return a[Math.floor(a.length / 2)];
  };
  const uses = st.resolved.map((r) => Math.min(1, r.tookMs / r.limitMs));
  const relays = st.resolved.filter((r) => r.kind === 'relay');
  const cleanRelays = relays.filter((r) => !state.log.some((e) => e.type === 'codeWrong' && e.id === r.id));
  const stageIds = [...new Set(st.hops.map((hp) => hp.stage))].filter((id) => id !== 'dock');
  const byStage = {};
  for (const m of st.missed) byStage[m.stage] = (byStage[m.stage] || 0) + m.severity;
  for (const e of state.log) if (e.type === 'retry') byStage[e.stage] = (byStage[e.stage] || 0) + 10;
  const hardest = Object.entries(byStage).sort((a, b) => b[1] - a[1])[0];
  return {
    totalMs: state.clock,
    resolved: st.resolved.length,
    missed: st.missed.length,
    avgUse: uses.length ? uses.reduce((a, b) => a + b, 0) / uses.length : null,
    doubles: { total: st.doubles.length, urgentFirst: st.doubles.filter((d) => d.urgentFirst).length },
    relay: { total: relays.length, clean: cleanRelays.length },
    hopFirstMs: stageIds.length ? med(st.hops.filter((hp) => hp.stage === stageIds[0]).map((hp) => hp.ms)) : null,
    hopLastMs: stageIds.length ? med(st.hops.filter((hp) => hp.stage === stageIds[stageIds.length - 1]).map((hp) => hp.ms)) : null,
    hardestStage: hardest ? hardest[0] : null,
    retries: state.retries,
    damage: st.damage,
    wrongQueries: st.wrongQueries,
    pauses: st.pauses,
    rescues: st.rescues,
  };
}
