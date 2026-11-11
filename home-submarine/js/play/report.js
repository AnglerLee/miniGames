// 관찰 리포트: 끼어들지 않고 지켜본 부모에게 아이가 어떻게 해냈는지 보여 준다.
// 엔진이 남긴 기록(state.stats, state.log)에 실제로 있는 것만 말한다. 추측이 섞이면 칭찬 문장이 거짓이 되기 때문이다.
//
// 규격
//   showReport(root, { setup, stations, state, onBack }) → { destroy(), data }
//   analyze(setup, stations, state) → 화면에 쓰는 숫자와 문장 (검증용으로도 쓴다)
//   outcome(state) → computeScore 결과 + { forced, grade } (부모가 끝냈으면 등급은 C)

import { h } from '../shared/dom.js';
import { computeScore, summarize, clock } from '../shared/score.js';
import { stageTitle } from '../shared/text.js';
import { DIFFICULTY, STAGES } from '../shared/content.js';

/** 결말 화면, 항해 일지, 리포트가 같은 등급을 쓰게 한곳에서 정한다 */
export function outcome(state) {
  const sc = computeScore(state);
  const forced = state.forced === true;
  return Object.assign({}, sc, { forced, rawGrade: sc.grade, grade: forced ? 'C' : sc.grade });
}

export const DAMAGE_LABELS = ['한 칸도 안 깎인다', '한두 칸', '세 칸 이상'];
export const RETRY_LABELS = ['없이 끝낸다', '한 번은 가라앉는다'];
const stageName = (id) => (STAGES.find((s) => s.id === id) || { name: id }).name;
const stageIdx = (id) => STAGES.findIndex((s) => s.id === id);

function secText(ms) {
  const sec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (!m) return s + '초';
  return m + '분' + (s ? ' ' + s + '초' : '');
}

/** summarize 와 같은 가운데 값 (짝수 개면 위쪽) */
function med(list) {
  if (!list.length) return null;
  const a = list.slice().sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)];
}

export function analyze(setup, stations, state) {
  const st = state.stats;
  const sum = summarize(state);
  const sc = outcome(state);
  const log = state.log || [];
  const label = (i) => (stations[i] ? stations[i].role.name + '(' + stations[i].room.name + ')' : '어느 구역');
  const count = (type, stage) => log.filter((e) => e.type === type && (!stage || e.stage === stage)).length;

  // ---------- 단계별 ----------
  const stages = [];
  for (const def of STAGES) {
    const starts = log.filter((e) => e.type === 'stage' && e.stage === def.id);
    if (!starts.length) continue;
    const cleared = st.stages.find((x) => x.id === def.id);
    const clearAt = log.filter((e) => e.type === 'clear' && e.stage === def.id).pop();
    const finish = log.find((e) => e.type === 'finish' && e.stage === def.id);
    const endAt = clearAt ? clearAt.at : finish ? finish.at : state.clock;
    stages.push({
      id: def.id,
      name: def.name,
      ms: Math.max(0, endAt - starts[0].at),
      lastMs: cleared ? cleared.ms : null,
      resolved: st.resolved.filter((r) => r.stage === def.id).length,
      missed: st.missed.filter((m) => m.stage === def.id).length,
      retries: count('retry', def.id),
      rescued: count('rescue', def.id) > 0,
      status: cleared ? (count('rescue', def.id) ? 'rescued' : 'cleared') : finish ? 'ended' : 'open',
    });
  }

  // ---------- 기억 ----------
  const relayMissed = st.missed.filter((m) => m.kind === 'relay').length;
  const memory = {
    relay: sum.relay,
    relayWrong: st.relayWrong,
    relayMissed,
    routeShown: count('route') > 0,
    routeWrong: count('routeWrong'),
    peeks: count('peek'),
    routeMiss: count('routeMiss'),
    routeDone: log.some((e) => e.type === 'clear' && e.stage === 'salvage') && !log.some((e) => e.type === 'rescue' && e.stage === 'salvage'),
  };
  memory.show = memory.relay.total + relayMissed + memory.relayWrong > 0 || memory.routeShown;

  // ---------- 여유: 단계별 제한 시간 사용 비율 ----------
  const useBy = [];
  for (const def of STAGES) {
    const rs = st.resolved.filter((r) => r.stage === def.id);
    if (!rs.length) continue;
    useBy.push({ id: def.id, name: def.name, use: rs.reduce((a, r) => a + Math.min(1, r.tookMs / r.limitMs), 0) / rs.length, n: rs.length });
  }

  // ---------- 걸음 ----------
  const hopStages = [];
  for (const hp of st.hops) if (!hopStages.includes(hp.stage)) hopStages.push(hp.stage);
  const hops = hopStages.map((id) => {
    const ms = st.hops.filter((hp) => hp.stage === id).map((hp) => hp.ms);
    return { id, name: stageName(id), ms: med(ms), n: ms.length };
  });
  // 출항 점검의 간격은 걷기만, 그 뒤 단계의 간격에는 수리와 기다림이 들어 있다. 같은 종류끼리 견준다.
  const runHops = hops.filter((x) => x.id !== 'dock');
  let trend = null;
  if (runHops.length >= 2) {
    const a = runHops[0];
    const b = runHops[runHops.length - 1];
    const r = b.ms / Math.max(1, a.ms);
    trend = { from: a, to: b, ratio: r, word: r <= 0.85 ? 'faster' : r >= 1.15 ? 'slower' : 'same' };
  }

  // ---------- 흐름 ----------
  const info = new Map(); // 경보 id → { station, kind }
  for (const e of log) if ((e.type === 'resolve' || e.type === 'miss') && e.id) info.set(e.id, { station: e.station, kind: e.kind });
  const timeline = [];
  for (const e of log) {
    const row = (icon, text, tone = '') => timeline.push({ at: e.at, icon, text, tone, type: e.type, stage: e.stage });
    if (e.type === 'stage') row('▶️', stageTitle(stageIdx(e.stage)) + (e.ease ? ' 다시 시작' : ' 시작'), 'head');
    else if (e.type === 'wave') {
      const where = (e.ids || []).map((id) => (info.has(id) ? label(info.get(id).station) : null));
      const known = where.filter(Boolean);
      const text = (e.ids || []).length >= 2 ? '경보 두 곳: ' + (known.length ? known.join(', ') : '구역 ' + e.ids.length + '곳') : '경보: ' + (known[0] || '한 곳');
      row('🚨', text);
    } else if (e.type === 'resolve') {
      const what = e.kind === 'relay' ? '좌표 전달' : e.kind === 'fetch' ? '부품 들고 수리' : '수리';
      row('✅', label(e.station) + ' ' + what + ' · ' + secText(e.tookMs || 0), 'good');
    } else if (e.type === 'miss') row('💥', label(e.station) + ' 놓침 · 선체 −' + e.severity + '칸', 'bad');
    else if (e.type === 'route') row('🏗️', '크레인 순서 돌기 시작');
    else if (e.type === 'routeMiss') row('💥', '크레인 시간 초과 · 선체 −2칸', 'bad');
    else if (e.type === 'failed') row('🌊', '선체가 0이 되어 가라앉음', 'bad');
    else if (e.type === 'retry') row('🔁', '다시 도전', 'help');
    else if (e.type === 'rescue') row('🤝', '부모 도움: 이 단계를 넘김', 'help');
    else if (e.type === 'clear') row('✔️', stageName(e.stage) + ' 완료', 'good');
    else if (e.type === 'pause') row('⏸️', '잠깐 멈춤');
    else if (e.type === 'finish') row('🏁', '부모가 임무를 끝내고 보물을 공개함', 'help');
    else if (e.type === 'done') row('🎉', '물 위로 올라옴 · 임무 성공', 'good');
  }

  // 놓친 바로 다음 결과가 해결이었던 적이 있는가 ("하나를 놓쳤을 때 바로 다음 것으로")
  const outcomes = log.filter((e) => e.type === 'resolve' || e.type === 'miss' || e.type === 'failed');
  const bouncedBack = outcomes.some((e, i) => e.type === 'miss' && outcomes[i + 1] && outcomes[i + 1].type === 'resolve');

  // ---------- 예측과 실제 ----------
  let predict = null;
  const p = setup.predict;
  if (p && typeof p === 'object') {
    const dmg = st.damage === 0 ? 0 : st.damage <= 2 ? 1 : 2;
    const ret = state.retries > 0 ? 1 : 0;
    const hard = sum.hardestStage;
    predict = [
      { k: 'damage', q: '선체 손상', guess: DAMAGE_LABELS[p.damage] || '-', actual: st.damage + '칸 (' + DAMAGE_LABELS[dmg] + ')', ok: p.damage === dmg },
      { k: 'retry', q: '다시 도전', guess: RETRY_LABELS[p.retry] || '-', actual: state.retries ? state.retries + '번 가라앉음' : '없이 끝냄', ok: p.retry === ret },
      { k: 'hardest', q: '가장 힘든 단계', guess: p.hardest ? stageName(p.hardest) : '-', actual: hard ? stageName(hard) : '힘든 단계 없이 끝냈어요', ok: hard ? p.hardest === hard : null },
    ];
  }

  const data = {
    forced: sc.forced,
    grade: sc.grade,
    score: sc.score,
    totalMs: sum.totalMs,
    resolved: sum.resolved,
    missed: sum.missed,
    damage: sum.damage,
    hull: state.hull,
    hullMax: state.hullMax,
    retries: sum.retries,
    pauses: sum.pauses,
    rescues: sum.rescues,
    wrongQueries: sum.wrongQueries,
    checkins: st.checkins,
    doubles: sum.doubles,
    avgUse: sum.avgUse,
    useBy,
    hopMs: state.hopMs,
    hopFirstMs: sum.hopFirstMs,
    hopLastMs: sum.hopLastMs,
    hops,
    trend,
    hardestStage: sum.hardestStage,
    stages,
    memory,
    timeline,
    bouncedBack,
    predict,
    difficulty: state.difficulty,
    stationCount: stations.length,
  };
  data.praise = praiseLines(data);
  data.advice = adviceLine(data);
  return data;
}

/**
 * 부모가 아이에게 해 줄 말. 결과가 아니라 과정과 노력을 짚는다.
 * 기록에 근거가 있는 것만 고르고, 안내서의 예시 문장이 먼저 나오게 한다.
 */
function praiseLines(d) {
  const out = [];
  if (d.doubles.total > 0 && d.doubles.urgentFirst / d.doubles.total >= 0.6) out.push('두 군데가 한꺼번에 고장 났을 때 급한 것부터 골랐구나.');
  if (!d.forced && d.retries > 0) out.push('가라앉고도 다시 해서 끝까지 갔네.');
  if (d.memory.relay.total > 0 && d.memory.relay.clean === d.memory.relay.total) out.push('기호를 외우는 너만의 방법이 있었어?');
  if (d.bouncedBack) out.push('하나를 놓쳤을 때 바로 다음 것으로 넘어갔구나.');
  const extra = [];
  if (!d.forced && d.missed === 0 && d.resolved >= 3) extra.push('고장을 하나도 놓치지 않고 모두 고쳤구나.');
  if (d.memory.routeDone && d.memory.routeWrong === 0 && d.memory.peeks === 0) extra.push('크레인 순서를 한 번에 기억해 냈구나.');
  if (d.wrongQueries === 0 && d.checkins >= d.stationCount) extra.push('쪽지 숫자를 한 번도 틀리지 않고 꼼꼼히 확인했구나.');
  if (d.resolved > 0) extra.push('고장 ' + d.resolved + '개를 혼자 힘으로 고쳤구나.');
  for (const line of extra) {
    if (out.length >= 2) break;
    out.push(line);
  }
  return out.slice(0, 3);
}

function adviceLine(d) {
  // 두 번 이상 가라앉았다면 등급이 높아도 올리지 않는다 (아이가 힘들어한 판이다)
  if (d.grade === 'C' || d.retries >= 2) return '같은 난이도로 한 번 더 해 보세요. 방 사이 길을 더 치워 주세요.';
  if ((d.grade === 'S' || d.grade === 'A') && d.avgUse !== null && d.avgUse < 0.6) {
    if (d.difficulty < 2) return '난이도를 한 단계 올려 보세요. (다음: ' + DIFFICULTY[d.difficulty + 1].name + ')';
    return '이미 가장 어려운 난이도예요. 지금처럼 한 번 더 즐겨 보세요.';
  }
  return '지금 난이도가 잘 맞습니다.';
}

// ---------- 화면 ----------

function section(title, props, ...children) {
  return h('section', Object.assign({ class: 'rep-sec card' }, props), h('h2', { text: title }), ...children);
}

function stat(label, value, sub, key) {
  return h('div', { class: 'rep-stat', 'data-stat': key }, h('div', { class: 'rep-stat-label', text: label }), h('div', { class: 'rep-stat-value', text: value }), sub ? h('div', { class: 'rep-stat-sub', text: sub }) : null);
}

function useBar(name, use, key) {
  const pct = Math.round(use * 100);
  const tone = use < 0.6 ? 'easy' : use < 0.85 ? 'mid' : 'tight';
  return h(
    'div',
    { class: 'rep-bar ' + tone, 'data-use': key },
    h('span', { class: 'rep-bar-name', text: name }),
    h('span', { class: 'rep-bar-track' }, h('i', { style: { width: pct + '%' } })),
    h('b', { class: 'rep-bar-val', text: pct + '%' })
  );
}

export function showReport(root, { setup, stations, state, onBack }) {
  const d = analyze(setup, stations, state);
  const who = String(setup.captain || '').trim() || '아이';

  const head = h(
    'header',
    { class: 'rep-head' },
    h('div', {}, h('div', { class: 'rep-kicker', text: '부모님용 · 임무 No.' + (setup.missionNo || 1) }), h('h1', { text: '관찰 리포트' })),
    h('button', { class: 'btn ghost small', type: 'button', id: 'rep-back-top', text: '돌아가기', onClick: () => onBack && onBack() })
  );

  const glance = section(
    '한눈에',
    { id: 'rep-glance' },
    d.forced ? h('p', { class: 'rep-flag', text: '부모가 임무를 끝냄 — 끝까지 가기 전에 "임무 끝내고 보물 공개"로 마쳤어요. 등급은 C로 기록했어요.' }) : null,
    h(
      'div',
      { class: 'rep-stats' },
      stat('걸린 시간', clock(d.totalMs), '멈춘 시간은 빼고', 'time'),
      stat('등급', d.grade, d.forced ? '부모가 끝냄' : '점수 ' + d.score + '점', 'grade'),
      stat('고친 고장', d.resolved + '개', '놓친 고장 ' + d.missed + '개', 'fixed'),
      stat('선체 손상', d.damage + '칸', '끝날 때 ' + d.hull + ' / ' + d.hullMax + '칸', 'damage'),
      stat('다시 도전', d.retries + '번', d.retries ? '가라앉은 뒤 다시 함' : '한 번도 가라앉지 않음', 'retries'),
      stat('멈춘 횟수', d.pauses + '번', null, 'pauses'),
      stat('부모 도움', d.rescues + '번', d.rescues ? '단계 넘기기' : null, 'rescues')
    )
  );

  const hardName = d.hardestStage ? stageName(d.hardestStage) : null;
  const stageSec = section(
    '단계별',
    { id: 'rep-stages' },
    h(
      'div',
      { class: 'rep-table' },
      h('div', { class: 'rep-tr head' }, h('span', { class: 'name', text: '단계' }), h('span', { text: '걸린 시간' }), h('span', { text: '놓침' }), h('span', { text: '다시' })),
      d.stages.map((r) =>
        h(
          'div',
          { class: 'rep-tr' + (r.id === d.hardestStage ? ' hard' : ''), 'data-stage': r.id },
          h('span', { class: 'name' }, r.name, r.status === 'rescued' ? h('small', { text: '부모가 넘김' }) : r.status === 'ended' ? h('small', { text: '여기서 끝냄' }) : null),
          h('span', { text: clock(r.ms) }),
          h('span', { text: r.id === 'dock' ? '–' : r.missed + '개' }),
          h('span', { text: r.retries + '번' })
        )
      )
    ),
    h('p', { class: 'rep-strong', id: 'rep-hardest', text: hardName ? '가장 힘들었던 단계: ' + hardName : '힘든 단계 없이 끝냈어요.' }),
    h('p', { class: 'rep-note', text: '걸린 시간은 다시 도전한 시간까지 합친 값이에요. 가장 힘든 단계는 놓친 고장과 다시 도전이 가장 많았던 곳이에요.' })
  );

  const urgentSec = d.doubles.total
    ? section(
        '급할 때의 판단',
        { id: 'rep-urgent' },
        h('p', { class: 'rep-big', text: d.doubles.urgentFirst + ' / ' + d.doubles.total + '번' }),
        h('p', { text: '두 곳이 함께 고장 났을 때 남은 시간이 짧은 쪽부터 고친 횟수예요.' }),
        h('p', { class: 'rep-note', text: '한쪽을 고칠 때 다른 쪽도 아직 남아 있던 경우만 셌어요.' })
      )
    : null;

  let memSec = null;
  if (d.memory.show) {
    const m = d.memory;
    const items = [];
    if (m.relay.total || m.relayMissed || m.relayWrong) {
      items.push('좌표 전달: ' + m.relay.total + '번 해냈고, 그중 ' + m.relay.clean + '번은 한 번에 맞혔어요.' + (m.relayWrong ? ' 틀리게 입력한 것은 ' + m.relayWrong + '번이에요.' : ''));
      if (m.relayMissed) items.push('시간 안에 전달하지 못한 좌표가 ' + m.relayMissed + '개 있어요.');
    }
    if (m.routeShown) {
      items.push('크레인 순서: 틀린 구역 ' + m.routeWrong + '번 · 순서 다시 보기 ' + m.peeks + '번' + (m.routeMiss ? ' · 시간 초과 ' + m.routeMiss + '번' : '') + '.');
    }
    memSec = section(
      '기억',
      { id: 'rep-memory' },
      m.relay.total ? h('p', { class: 'rep-big', text: m.relay.clean + ' / ' + m.relay.total + '번 한 번에' }) : null,
      h('ul', { class: 'rep-list' }, items.map((t) => h('li', { text: t })))
    );
  }

  const useSec = section(
    '여유',
    { id: 'rep-use' },
    d.avgUse === null
      ? h('p', { class: 'soft', text: '해결한 경보가 없어 잴 수 없어요.' })
      : [
          h('p', { text: '경보마다 제한 시간의 평균 ' + Math.round(d.avgUse * 100) + '%를 쓰고 고쳤어요.' }),
          h('div', { class: 'rep-bars' }, useBar('전체', d.avgUse, 'all'), d.useBy.map((u) => useBar(u.name, u.use, u.id))),
          h('p', { class: 'rep-note', text: '막대가 짧을수록 여유 있게 해낸 거예요. 60% 아래면 넉넉했다는 뜻이에요.' }),
        ]
  );

  const maxHop = Math.max(1, ...d.hops.map((x) => x.ms || 0));
  const trendText = d.trend
    ? d.trend.from.name + ' ' + secText(d.trend.from.ms) + ' → ' + d.trend.to.name + ' ' + secText(d.trend.to.ms) + ': ' +
      { faster: '뒤로 갈수록 빨라졌어요.', slower: '뒤로 갈수록 느려졌어요.', same: '처음과 끝이 비슷했어요.' }[d.trend.word]
    : null;
  const walkSec = section(
    '걸음',
    { id: 'rep-walk' },
    h('p', {}, '출항 점검에서 잰 걸음: ', h('b', { text: '구역 사이 약 ' + secText(d.hopMs) }), ' — 이후 제한 시간을 이 걸음에 맞춰 정했어요.'),
    d.hops.length
      ? h(
          'div',
          { class: 'rep-bars hop' },
          d.hops.map((x) =>
            h(
              'div',
              { class: 'rep-bar', 'data-hop': x.id },
              h('span', { class: 'rep-bar-name', text: x.name }),
              h('span', { class: 'rep-bar-track' }, h('i', { style: { width: Math.round(((x.ms || 0) / maxHop) * 100) + '%' } })),
              h('b', { class: 'rep-bar-val', text: secText(x.ms || 0) })
            )
          )
        )
      : null,
    trendText ? h('p', { class: 'rep-strong', id: 'rep-trend', text: trendText }) : null,
    h('p', { class: 'rep-note', text: '단계마다 구역을 옮겨 다닌 간격의 가운데 값이에요. 출항 점검 뒤로는 수리하고 다음 경보를 기다린 시간도 들어 있어서, 출항 점검보다 길게 나와요.' })
  );

  const querySec = section(
    '도착 확인 실수',
    { id: 'rep-query' },
    h('p', { class: 'rep-big', text: d.wrongQueries + '번' }),
    h('p', { text: '도착 확인 ' + d.checkins + '번 중 쪽지 숫자를 틀리게 누른 횟수예요.' + (d.wrongQueries ? ' 틀릴 때마다 잠깐 입력이 잠기고 다른 질문이 나왔어요.' : '') })
  );

  const flow = section(
    '흐름',
    { id: 'rep-flow' },
    h(
      'ol',
      { class: 'rep-flow' },
      d.timeline.map((r) => h('li', { class: r.tone ? 'tone-' + r.tone : null, 'data-type': r.type }, h('span', { class: 'rep-at', text: clock(r.at) }), h('span', { class: 'rep-ico', 'aria-hidden': 'true', text: r.icon }), h('span', { class: 'rep-txt', text: r.text })))
    ),
    h('p', { class: 'rep-note', text: '시각은 임무를 시작한 뒤 흐른 게임 시간이에요 (멈춘 시간과 단계 안내를 읽는 시간은 빼고).' })
  );

  let predSec = null;
  if (d.predict) {
    predSec = section(
      '예측과 실제',
      { id: 'rep-predict' },
      h(
        'div',
        { class: 'rep-pred' },
        h('div', { class: 'rep-pred-row head' }, h('span', { text: '' }), h('span', { text: '예측' }), h('span', { text: '실제' })),
        d.predict.map((r) =>
          h(
            'div',
            { class: 'rep-pred-row', 'data-q': r.k },
            h('span', { class: 'q', text: r.q }),
            h('span', { text: r.guess }),
            h('span', {}, r.actual, r.ok === null ? null : h('b', { class: r.ok ? 'ok' : 'no', text: r.ok ? ' ✔ 맞음' : ' ✖ 다름' }))
          )
        )
      ),
      h('p', { class: 'rep-note', text: '맞힌 문항 ' + d.predict.filter((r) => r.ok).length + ' / ' + d.predict.filter((r) => r.ok !== null).length + (d.forced ? ' · 중간에 끝낸 임무라 끝까지 했을 때와 다를 수 있어요.' : '') })
    );
  }

  const praiseSec = section(
    '이렇게 말해 주세요',
    { id: 'rep-praise' },
    h('p', { class: 'soft', text: who + '에게 결과보다 과정을 짚어 말해 주세요. 기록에서 고른 말이에요.' }),
    h('ul', { class: 'rep-praise' }, d.praise.map((t) => h('li', { text: '“' + t + '”' }))),
    h('p', { class: 'rep-foot', text: '결과보다 과정을 짚는 칭찬이 아이의 끈기를 키웁니다.' })
  );

  const nextSec = section('다음 임무 제안', { id: 'rep-next' }, h('p', { class: 'rep-strong', text: d.advice }));

  const body = h(
    'div',
    { class: 'rep-body' },
    glance,
    stageSec,
    urgentSec,
    memSec,
    useSec,
    walkSec,
    querySec,
    flow,
    predSec,
    praiseSec,
    nextSec,
    h('button', { class: 'btn block rep-back', type: 'button', id: 'rep-back', text: '돌아가기', onClick: () => onBack && onBack() })
  );

  const box = h('div', { class: 'rep' }, head, body);
  root.append(box);
  return {
    destroy() {
      box.remove();
    },
    data: d,
  };
}
