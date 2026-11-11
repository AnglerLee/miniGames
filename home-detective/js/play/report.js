// 관찰 리포트: 끼어들지 않고 지켜본 부모에게 아이가 어떻게 풀었는지 보여 준다.
// 기록(run)에 실제로 남은 것만 말한다. 추측이 섞이면 칭찬 문장이 거짓이 되기 때문이다.
//
// 규격
//   showReport(root, { setup, cs, run, now, onBack }) → { destroy() }
//   analyze(setup, cs, run, now) → 화면에 쓰는 숫자와 문장 (검증용으로도 쓴다)
//   outcome(run, now) → computeScore 결과 + { forced, grade } (부모가 끝냈으면 등급은 C)

import { h } from '../shared/dom.js';
import { computeScore, summarize, clock } from '../shared/score.js';
import { evidenceTitle, evidenceIcon, josa } from '../shared/text.js';
import { DIFFICULTY } from '../shared/content.js';

/** 결말 화면, 신문, 리포트가 같은 등급을 쓰게 한곳에서 정한다 */
export function outcome(run, now) {
  const sc = computeScore(run, now);
  const forced = run.forced === true;
  return Object.assign({}, sc, { forced, rawGrade: sc.grade, grade: forced ? 'C' : sc.grade });
}

const TIME_LABELS = ['여유 있게', '아슬아슬하게', '시간 초과'];
const HINT_LABELS = ['안 쓴다', '한두 번', '세 번 이상'];
const FIRST_LABELS = { suspect: '용의자', evidence: '증거' };
const RESULT_TEXT = {
  solved: '범인을 맞혀 해결했어요',
  deny: '범인은 맞았지만 근거가 거짓말과 맞지 않았어요',
  wrong: '결백한 용의자였어요',
};

function minText(ms) {
  const sec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (!m) return s + '초';
  return m + '분' + (s ? ' ' + s + '초' : '');
}

function tagInfo(cs, tag) {
  if (!tag) return { name: '쪽지', icon: '📝', room: '' };
  const room = cs.rooms[tag.room] ? cs.rooms[tag.room].name : '';
  if (tag.kind === 'suspect') {
    const s = cs.suspects[tag.ref];
    return { name: s.name, icon: s.icon || '🧸', room, kind: 'suspect' };
  }
  const ev = cs.evidence[tag.ref];
  return { name: evidenceTitle(cs, ev), icon: evidenceIcon(ev), room, kind: 'evidence' };
}

/** 힌트 대상이 쪽지 id 나 방 번호면 방 이름을 찾아 준다. 모르는 모양이면 빈 글자. */
function hintPlace(cs, tagById, target) {
  if (typeof target === 'string' && tagById.has(target)) {
    const tag = tagById.get(target);
    return cs.rooms[tag.room] ? cs.rooms[tag.room].name : '';
  }
  if (typeof target === 'number' && cs.rooms[target]) return cs.rooms[target].name;
  if (typeof target === 'string') {
    const room = cs.rooms.find((r) => r.id === target);
    if (room) return room.name;
  }
  return '';
}

/** 예측 문항에 맞춘 실제 값 */
function actualTime(sc, limitMs) {
  if (sc.late) return 2;
  return limitMs > 0 && sc.usedMs / limitMs > 0.75 ? 1 : 0;
}
function actualHints(n) {
  return n === 0 ? 0 : n <= 2 ? 1 : 2;
}

export function analyze(setup, cs, run, now) {
  const sum = summarize(run, now);
  const sc = outcome(run, now);
  const events = (run.events || []).slice().sort((a, b) => a.at - b.at);
  const tagById = new Map(cs.tags.map((t) => [t.id, t]));
  const found = run.found || {};
  const foundIds = Object.keys(found).filter((id) => tagById.has(id));
  const rescued = new Set(events.filter((e) => e.type === 'rescue').map((e) => e.tag));
  const hints = run.hints || [];
  const accs = (run.accusations || []).slice().sort((a, b) => a.at - b.at);
  const solvedAcc = accs.filter((a) => a.result === 'solved').pop() || null;
  const firstAcc = accs[0] || null;
  const asks = events.filter((e) => e.type === 'asked');
  const askKeys = new Set(asks.map((e) => e.s + ':' + e.t));
  const sceneEvents = events.filter((e) => e.type === 'scene');
  const locks = events.filter((e) => e.type === 'lock').length;
  const marks = Object.values(run.marks || {});
  const endAt = sum.usedMs;

  // 가장 오래 걸린 구간: summarize 와 같은 방법으로 끝 쪽지까지 찾는다
  let gap = null;
  if (sum.longestGapMs > 0) {
    let prev = 0;
    let prevId = null;
    for (const f of sum.finds) {
      if (f.at - prev === sum.longestGapMs && prevId === sum.longestGapAfter) {
        const inside = (e) => e.at > prev && e.at <= f.at;
        gap = {
          ms: sum.longestGapMs,
          startAt: prev,
          endAt: f.at,
          from: prevId ? tagInfo(cs, tagById.get(prevId)) : null,
          to: tagInfo(cs, tagById.get(f.id)),
          hints: hints.filter(inside).length,
          rescued: rescued.has(f.id),
          asks: asks.filter(inside).length,
          scenes: sceneEvents.filter(inside).length,
          accuses: accs.filter(inside).length,
          wrongCodes: events.filter((e) => e.type === 'wrongCode' && inside(e)).length,
        };
        break;
      }
      prev = f.at;
      prevId = f.id;
    }
  }

  const missingAt = (at) => cs.tags.filter((t) => !(found[t.id] && found[t.id].at <= at)).length;
  const allFound = foundIds.length === cs.tags.length;
  const allFoundAt = allFound ? Math.max(...foundIds.map((id) => found[id].at)) : null;
  const firstTag = sum.finds.length ? tagById.get(sum.finds[0].id) : null;

  // 수사 흐름 (질문 하나하나는 너무 많아 빼고, 틀린 기호는 연달아 넣은 것을 한 줄로 묶는다)
  const timeline = [];
  for (const e of events) {
    const row = (icon, text, tone = '') => timeline.push({ at: e.at, icon, text, tone, type: e.type });
    if (e.type === 'start') row('▶️', '수사 시작');
    else if (e.type === 'find') {
      const info = tagInfo(cs, tagById.get(e.tag));
      row(info.icon, (info.kind === 'suspect' ? '용의자 ' : '증거 ') + info.name + ' 쪽지 발견' + (info.room ? ' (' + info.room + ')' : ''), 'find');
    } else if (e.type === 'scene') {
      const info = tagInfo(cs, tagById.get(e.tag));
      row('🔎', info.name + ' 조사 완료' + (e.misses ? ' · 틀린 선택 ' + e.misses + '번' : ''));
    } else if (e.type === 'hint') {
      const place = e.kind === 'search' ? hintPlace(cs, tagById, e.target) : '';
      row('📻', '힌트: ' + (e.kind === 'search' ? '쪽지 찾기' : '추리') + ' ' + e.level + '단계' + (place ? ' (' + place + ')' : ''), 'hint');
    } else if (e.type === 'accuse') {
      const s = cs.suspects[e.suspect];
      row('⚖️', '고발: ' + (s ? s.name : '?') + ' → ' + (RESULT_TEXT[e.result] || e.result), e.result === 'solved' ? 'good' : 'bad');
    } else if (e.type === 'wrongCode') {
      const last = timeline[timeline.length - 1];
      if (last && last.type === 'wrongCode') {
        last.count++;
        last.text = '없는 기호 입력 ' + last.count + '번';
      } else timeline.push({ at: e.at, icon: '✖️', text: '없는 기호 입력 1번', tone: '', type: 'wrongCode', count: 1 });
    } else if (e.type === 'lock') row('🔒', '기호를 연달아 틀려 입력판이 잠깐 잠김', 'bad');
    else if (e.type === 'suspend') row('⏸️', '배지를 다 써서 고발이 잠시 멈춤', 'bad');
    else if (e.type === 'pause') row('⏸️', '잠깐 멈춤' + (e.ms ? ' (' + minText(e.ms) + ')' : ''));
    else if (e.type === 'late') row('⏰', '제한 시간 초과', 'bad');
    else if (e.type === 'rescue') {
      const info = tagInfo(cs, tagById.get(e.tag));
      row('🤝', '부모 도움: ' + info.name + ' 쪽지를 찾은 것으로 처리', 'help');
    } else if (e.type === 'solved') row('🎉', '사건 해결', 'good');
  }
  if (sc.forced) timeline.push({ at: endAt, icon: '🏁', text: '부모가 수사를 끝냄', tone: 'help', type: 'forced' });
  else if (!events.some((e) => e.type === 'solved')) timeline.push({ at: endAt, icon: '🎉', text: '사건 해결', tone: 'good', type: 'solved' });

  // 예측과 실제
  let predict = null;
  const p = setup.predict;
  if (p && typeof p === 'object') {
    const t = actualTime(sc, run.limitMs);
    const hn = actualHints(hints.length);
    predict = [
      { q: '걸리는 시간', guess: TIME_LABELS[p.time] || '-', actual: TIME_LABELS[t], ok: p.time === t },
      { q: '힌트', guess: HINT_LABELS[p.hints] || '-', actual: hints.length + '번 (' + HINT_LABELS[hn] + ')', ok: p.hints === hn },
      {
        q: '먼저 찾는 것',
        guess: FIRST_LABELS[p.first] || '-',
        actual: sum.firstKind ? FIRST_LABELS[sum.firstKind] : '찾은 쪽지 없음',
        ok: sum.firstKind ? p.first === sum.firstKind : null,
      },
    ];
  }

  const data = {
    forced: sc.forced,
    late: sc.late,
    grade: sc.grade,
    score: sc.score,
    usedMs: sum.usedMs,
    gameMs: sc.usedMs,
    limitMs: run.limitMs,
    penaltyMs: run.penaltyMs || 0,
    tagsTotal: cs.tags.length,
    found: foundIds.length,
    rescued: foundIds.filter((id) => rescued.has(id)).length,
    hints: hints.length,
    hintSearch: hints.filter((x) => x.type === 'search').length,
    hintDeduce: hints.filter((x) => x.type === 'deduce').length,
    wrong: sum.wrong,
    deny: sum.deny,
    accusations: accs.length,
    pauses: run.pauses || 0,
    pausedMs: run.pausedMs || 0,
    wrongCodes: run.wrongCodes || 0,
    locks,
    asks: asks.length,
    uniqueAsks: askKeys.size,
    marksTrust: marks.filter((v) => v === 1).length,
    marksDoubt: marks.filter((v) => v === 2).length,
    first: firstTag ? tagInfo(cs, firstTag) : null,
    firstKind: sum.firstKind,
    firstAccuse: firstAcc ? { at: firstAcc.at, missing: missingAt(firstAcc.at) } : null,
    allFoundAt,
    thinkMs: allFoundAt !== null && solvedAcc ? Math.max(0, solvedAcc.at - allFoundAt) : null,
    retried: !!solvedAcc && accs.some((a) => a.at <= solvedAcc.at && a !== solvedAcc && a.result !== 'solved'),
    gap,
    timeline,
    predict,
  };
  data.praise = praiseLines(data);
  data.advice = adviceLine(data, cs, actualTime(sc, run.limitMs));
  return data;
}

/**
 * 부모가 아이에게 해 줄 말. 결과가 아니라 과정과 노력을 짚는다.
 * 기록에 근거가 있는 것만 고르고, 연구 예시 문장이 먼저 나오게 한다.
 */
function praiseLines(d) {
  const out = [];
  const solved = !d.forced;
  if (d.gap && d.gap.ms >= 120000 && d.gap.hints === 0 && !d.gap.rescued) {
    out.push(Math.floor(d.gap.ms / 60000) + '분 동안 다음 쪽지가 안 보였는데도 힌트 없이 찾아냈구나.');
  }
  if (solved && d.retried) out.push('틀린 뒤에 다시 증거를 보고 고쳐 생각했네.');
  if (d.firstAccuse && d.firstAccuse.missing === 0) out.push('서두르지 않고 증거를 끝까지 모았구나.');
  if (d.hints > 0) out.push('막혔을 때 도움을 청할 줄 아는 것도 실력이야.');
  const extra = [];
  if (solved && d.hints === 0 && d.rescued === 0) extra.push('힌트 없이 처음부터 끝까지 스스로 풀어냈구나.');
  if (solved && d.late) extra.push('시간이 넘어가도 포기하지 않고 끝까지 해냈네.');
  if (d.marksTrust + d.marksDoubt >= 3) extra.push('수첩에 표시를 해 가면서 단서를 하나하나 따져 봤구나.');
  if (d.asks > d.uniqueAsks) extra.push('들은 말을 다시 들어 보면서 꼼꼼히 확인했구나.');
  const selfFound = d.found - d.rescued;
  if (selfFound > 0) extra.push('쪽지 ' + selfFound + '장을 혼자 힘으로 찾아냈구나.');
  for (const line of extra) {
    if (out.length >= 2) break;
    out.push(line);
  }
  return out.slice(0, 3);
}

function adviceLine(d, cs, timeCode) {
  const easyTime = timeCode === 0;
  if (!d.forced && (d.grade === 'S' || d.grade === 'A') && easyTime) {
    if (cs.difficulty < 2) return '난이도를 한 단계 올려 보세요. (다음: ' + DIFFICULTY[cs.difficulty + 1].name + ')';
    return '이미 가장 어려운 난이도예요. 제한 시간을 조금 줄여 도전해 보세요.';
  }
  if (d.grade === 'C' || d.hints >= 4) return '같은 난이도로 한 번 더 해 보세요. 쪽지 숨기는 곳을 조금 쉽게 하면 좋아요.';
  return '지금 난이도가 잘 맞습니다.';
}

// ---------- 화면 ----------

function section(title, ...children) {
  return h('section', { class: 'rep-sec card' }, h('h2', { text: title }), ...children);
}

function stat(label, value, sub) {
  return h('div', { class: 'rep-stat' }, h('div', { class: 'rep-stat-label', text: label }), h('div', { class: 'rep-stat-value', text: value }), sub ? h('div', { class: 'rep-stat-sub', text: sub }) : null);
}

/** 수사 흐름을 한 줄 막대로: 쪽지 발견, 힌트, 고발 위치와 가장 긴 구간 */
function strip(d) {
  const span = Math.max(d.usedMs, ...d.timeline.map((r) => r.at), 1);
  // 양 끝 표시가 막대 밖으로 삐져나가지 않게 좌우 8px 안쪽에 놓는다
  const frac = (at) => Math.max(0, Math.min(1, at / span));
  const pct = (at) => 'calc(8px + (100% - 16px) * ' + frac(at).toFixed(4) + ')';
  const marks = [];
  const seen = new Set();
  if (d.gap) {
    marks.push(h('span', { class: 'rep-strip-gap', style: { left: pct(d.gap.startAt), width: 'calc((100% - 16px) * ' + (frac(d.gap.endAt) - frac(d.gap.startAt)).toFixed(4) + ')' } }));
  }
  for (const r of d.timeline) {
    let cls = null;
    if (r.type === 'find') cls = 'find';
    else if (r.type === 'hint') cls = 'hint';
    else if (r.type === 'accuse') cls = r.tone === 'good' ? 'good' : 'bad';
    else if (r.type === 'rescue' || r.type === 'forced') cls = 'help';
    if (cls) {
      seen.add(cls);
      marks.push(h('span', { class: 'rep-mark ' + cls, style: { left: pct(r.at) } }));
    }
  }
  // 막대에 실제로 나온 표시만 설명한다
  const key = (cls, text) => (seen.has(cls) ? h('span', { class: 'rep-key' }, h('span', { class: 'rep-mark static ' + cls }), text) : null);
  return h(
    'div',
    { class: 'rep-strip-wrap', 'aria-hidden': 'true' },
    h('div', { class: 'rep-strip' }, marks),
    h('div', { class: 'rep-strip-ends' }, h('span', { text: '00:00' }), h('span', { text: clock(span) })),
    h(
      'div',
      { class: 'rep-keys' },
      key('find', '쪽지 발견'),
      key('hint', '힌트'),
      key('bad', '틀린 고발'),
      key('good', '해결'),
      key('help', '부모 도움'),
      d.gap ? h('span', { class: 'rep-key' }, h('span', { class: 'rep-gap-key' }), '가장 긴 구간') : null
    )
  );
}

export function showReport(root, { setup, cs, run, now, onBack }) {
  const d = analyze(setup, cs, run, now);
  const who = setup.detective || '아이';

  const head = h(
    'header',
    { class: 'rep-head' },
    h('div', {}, h('div', { class: 'rep-kicker', text: '부모님용 · 사건 No.' + (setup.caseNo || 1) }), h('h1', { text: '관찰 리포트' })),
    h('button', { class: 'btn ghost small', type: 'button', text: '돌아가기', onClick: () => onBack && onBack() })
  );

  const over = d.late ? ' · 시간 초과' : '';
  const glance = section(
    '한눈에',
    d.forced ? h('p', { class: 'rep-flag', text: '부모가 수사를 끝냄 — 범인을 맞히기 전에 "수사 끝내기"로 마쳤어요. 등급은 C로 기록했어요.' }) : null,
    h(
      'div',
      { class: 'rep-stats' },
      stat('걸린 시간', clock(d.usedMs) + ' / ' + clock(d.limitMs), (d.penaltyMs ? '벌칙 +' + clock(d.penaltyMs) + ' 포함하면 ' + clock(d.gameMs) : '벌칙 시간 없음') + over),
      stat('등급', d.grade, d.forced ? '부모가 끝냄' : '점수 ' + d.score + '점'),
      stat('찾은 쪽지', d.found + ' / ' + d.tagsTotal, d.rescued ? '부모 도움 ' + d.rescued + '장 포함' : '모두 스스로 찾음'),
      stat('힌트', d.hints + '번', d.hints ? '쪽지 ' + d.hintSearch + ' · 추리 ' + d.hintDeduce : null),
      stat('잘못된 고발', d.wrong + '번', d.deny ? '근거가 틀린 고발 ' + d.deny + '번 따로' : null),
      stat('멈춘 횟수', d.pauses + '번', d.pausedMs ? '모두 ' + minText(d.pausedMs) : null)
    )
  );

  const flow = section(
    '수사 흐름',
    strip(d),
    h(
      'ol',
      { class: 'rep-flow' },
      d.timeline.map((r) => h('li', { class: r.tone ? 'tone-' + r.tone : null }, h('span', { class: 'rep-at', text: clock(r.at) }), h('span', { class: 'rep-ico', text: r.icon }), h('span', { class: 'rep-txt', text: r.text })))
    ),
    h('p', { class: 'rep-note', text: '시각은 수사를 시작한 뒤 흐른 시간이에요 (멈춘 시간은 빼고, 벌칙 시간은 넣지 않았어요).' })
  );

  let gapSec = null;
  if (d.gap) {
    const g = d.gap;
    const from = g.from ? josa(g.from.name, '을/를') + ' 찾은 뒤' : '수사를 시작한 뒤';
    const doing = [];
    if (g.asks) doing.push('질문 ' + g.asks + '번');
    if (g.scenes) doing.push('증거 조사 ' + g.scenes + '번');
    if (g.accuses) doing.push('고발 ' + g.accuses + '번');
    if (g.wrongCodes) doing.push('없는 기호 입력 ' + g.wrongCodes + '번');
    let how;
    if (g.rescued) how = '부모 도움("찾은 것으로 처리")으로 넘어갔어요.';
    else if (g.hints) how = '이 구간에서 힌트를 ' + g.hints + '번 써서 넘어갔어요.';
    else how = '이 구간에서 힌트 없이 버텼어요.';
    gapSec = section(
      '가장 오래 걸린 구간',
      h('p', { class: 'rep-big', text: minText(g.ms) }),
      h('p', { text: clock(g.startAt) + ' ~ ' + clock(g.endAt) + ' · ' + from + ' 다음 쪽지(' + g.to.name + ')를 찾기까지' }),
      doing.length ? h('p', { class: 'soft', text: '그사이 ' + doing.join(', ') + '을 했어요.' }) : null,
      h('p', { class: 'rep-strong', text: how })
    );
  }

  const ways = [];
  ways.push(d.first ? '처음 찾은 쪽지는 ' + (d.firstKind === 'suspect' ? '용의자 ' : '증거 ') + josa(d.first.name, '이었어요/였어요') + '.' : '찾은 쪽지가 없어요.');
  if (d.firstAccuse) {
    ways.push(
      d.firstAccuse.missing === 0
        ? '쪽지를 모두 찾은 뒤에 첫 고발을 했어요 (' + clock(d.firstAccuse.at) + ').'
        : '쪽지 ' + d.firstAccuse.missing + '장을 못 찾은 채로 일찍 첫 고발을 했어요 (' + clock(d.firstAccuse.at) + ').'
    );
    ways.push('고발은 모두 ' + d.accusations + '번이었어요.' + (d.wrong || d.deny ? ' (결백한 용의자 ' + d.wrong + '번, 근거가 틀림 ' + d.deny + '번)' : ''));
  } else ways.push('고발은 하지 않았어요.');
  if (d.thinkMs !== null) ways.push('마지막 쪽지를 찾고 해결하기까지 ' + minText(d.thinkMs) + ' 동안 추리했어요.');
  if (d.asks) {
    const again = d.asks - d.uniqueAsks;
    ways.push('질문을 ' + d.asks + '번 했어요.' + (again ? ' 그중 ' + again + '번은 같은 질문을 다시 들었어요.' : ' 같은 질문을 다시 들은 적은 없어요.'));
  }
  const markParts = [];
  if (d.marksTrust) markParts.push('✔ 믿음 ' + d.marksTrust + '개');
  if (d.marksDoubt) markParts.push('✖ 의심 ' + d.marksDoubt + '개');
  ways.push(markParts.length ? '끝날 때 수첩에 ' + markParts.join(', ') + ' 표시가 남아 있었어요.' : '끝날 때 남아 있는 수첩 표시(✔ 믿음 / ✖ 의심)는 없었어요.');
  ways.push(d.wrongCodes ? '없는 기호를 ' + d.wrongCodes + '번 넣었어요' + (d.locks ? ' (입력판 잠김 ' + d.locks + '번).' : '.') : '기호는 한 번도 틀리지 않았어요.');
  const waySec = section('풀이 방식', h('ul', { class: 'rep-list' }, ways.map((t) => h('li', { text: t }))));

  let predSec = null;
  if (d.predict) {
    predSec = section(
      '예측과 실제',
      h(
        'div',
        { class: 'rep-pred' },
        h('div', { class: 'rep-pred-row head' }, h('span', { text: '' }), h('span', { text: '예측' }), h('span', { text: '실제' })),
        d.predict.map((r) =>
          h(
            'div',
            { class: 'rep-pred-row' },
            h('span', { class: 'q', text: r.q }),
            h('span', { text: r.guess }),
            h('span', {}, r.actual, ' ', h('b', { class: r.ok === null ? 'na' : r.ok ? 'ok' : 'no', text: r.ok === null ? '—' : r.ok ? '✔ 맞음' : '✖ 다름' }))
          )
        )
      ),
      h('p', { class: 'rep-note', text: '맞힌 문항 ' + d.predict.filter((r) => r.ok).length + ' / 3' })
    );
  }

  const praiseSec = section(
    '이렇게 말해 주세요',
    h('p', { class: 'soft', text: who + '에게 결과보다 과정을 짚어 말해 주세요.' }),
    h('ul', { class: 'rep-praise' }, d.praise.map((t) => h('li', { text: '“' + t + '”' })))
  );

  const nextSec = section('다음 사건 제안', h('p', { class: 'rep-strong', text: d.advice }));

  const body = h(
    'div',
    { class: 'rep-body' },
    glance,
    flow,
    gapSec,
    waySec,
    predSec,
    praiseSec,
    nextSec,
    h('button', { class: 'btn block', type: 'button', text: '돌아가기', onClick: () => onBack && onBack() }),
    h('p', { class: 'rep-foot', text: '어른이 대신 풀어 주면 아이의 끈기가 줄고, 결과보다 노력과 과정을 짚는 칭찬이 끈기를 키운다는 발달심리 연구를 바탕으로 문장을 골랐어요.' })
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
