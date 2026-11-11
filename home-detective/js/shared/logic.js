// 사건의 논리: 진술과 증거가 참인지 따지고, 범인이 한 명으로 정해지는지 확인한다.
//
// 아이에게 알려 주는 규칙 (브리핑에 그대로 나온다)
//   1. 범인은 한 명이다.
//   2. 범인은 사건 시각에 간식이 있던 방에 혼자 있었다.
//   3. 범인은 사건 시각에 대해서만 거짓말을 한다. 다른 시각은 사실대로 말한다.
//   4. 범인이 아니면 모두 사실만 말한다. 증거는 거짓말을 하지 않는다.
//
// 용어
//   loc[s][t]        용의자 s 가 시각 t 에 있던 방 번호
//   진술 statement   { room, comp }  comp: null | {kind:'alone'} | {kind:'with', who} | {kind:'without', who}
//   증거 fact        { kind, ... }
//     time   { slot }                사건 시각
//     cfoot  { pattern }             현장에 남은 범인의 발자국 무늬
//     cprint { type }                현장에 남은 범인의 지문 모양
//     trail  { slot, room }          범인은 (사건 시각이 아닌) slot 에 room 에 있었다
//     foot   { slot, room, pattern } slot 에 room 에 있던 이는 모두 이 무늬다 (한 명 이상)
//     count  { slot, room, n }       slot 에 room 에 있던 인원
//     seen   { slot, room, who }     who 는 slot 에 room 에 있었다

/** 시각 t 에 방 r 에 있던 용의자 번호들 */
export function occupants(loc, t, r) {
  const out = [];
  for (let s = 0; s < loc.length; s++) if (loc[s][t] === r) out.push(s);
  return out;
}

/** 진술 하나가 loc 세계에서 참인가 */
export function statementTrue(loc, s, t, st) {
  if (loc[s][t] !== st.room) return false;
  const comp = st.comp;
  if (!comp) return true;
  if (comp.kind === 'alone') return occupants(loc, t, st.room).length === 1;
  if (comp.kind === 'with') return loc[comp.who][t] === st.room;
  if (comp.kind === 'without') return loc[comp.who][t] !== st.room;
  return true;
}

/** 증거 하나가 (loc, 범인 c, 사건 시각/방) 세계에서 참인가 */
export function factTrue(world, fact) {
  const { loc, culprit, crimeSlot, traits } = world;
  switch (fact.kind) {
    case 'time':
      return fact.slot === crimeSlot;
    case 'cfoot':
      return traits[culprit].foot === fact.pattern;
    case 'cprint':
      return traits[culprit].print === fact.type;
    case 'trail':
      return loc[culprit][fact.slot] === fact.room;
    case 'foot': {
      const occ = occupants(loc, fact.slot, fact.room);
      return occ.length > 0 && occ.every((s) => traits[s].foot === fact.pattern);
    }
    case 'count':
      return occupants(loc, fact.slot, fact.room).length === fact.n;
    case 'seen':
      return loc[fact.who][fact.slot] === fact.room;
    default:
      return true;
  }
}

/**
 * "c 가 범인이다"라고 가정한 세계를 만든다.
 * 모두가 말한 대로 있었고, c 만 사건 시각에 사건 방에 있었다고 본다.
 */
export function hypothesisLoc(cs, c) {
  const loc = cs.statements.map((row) => row.map((st) => st.room));
  loc[c][cs.crimeSlot] = cs.crimeRoom;
  return loc;
}

/**
 * c 를 범인으로 볼 때 어긋나는 것들을 모은다. 비어 있으면 c 는 범인일 수 있다.
 * facts 를 주면 그 증거만으로 따진다 (증거 고르기에 쓴다).
 * 돌려주는 값: [{ type, ... }]
 */
export function violations(cs, c, facts = cs.evidence.map((e) => e.fact)) {
  const out = [];
  const loc = hypothesisLoc(cs, c);
  const S = cs.suspects.length;
  const T = cs.slots.length;
  const tStar = cs.crimeSlot;

  // 규칙 3: c 의 사건 시각 진술은 거짓이어야 한다
  if (statementTrue(loc, c, tStar, cs.statements[c][tStar])) out.push({ type: 'nolie' });

  // 규칙 2: 사건 방에는 c 혼자
  for (const s of occupants(loc, tStar, cs.crimeRoom)) {
    if (s !== c) out.push({ type: 'crowd', who: s });
  }

  // 규칙 3, 4: 나머지 진술은 모두 참
  for (let s = 0; s < S; s++) {
    for (let t = 0; t < T; t++) {
      if (s === c && t === tStar) continue;
      if (!statementTrue(loc, s, t, cs.statements[s][t])) out.push({ type: 'statement', who: s, slot: t });
    }
  }

  // 증거는 모두 참
  const world = { loc, culprit: c, crimeSlot: tStar, traits: cs.suspects };
  facts.forEach((fact, i) => {
    if (!factTrue(world, fact)) out.push({ type: 'fact', index: i, kind: fact.kind });
  });
  return out;
}

/** 범인일 수 있는 용의자 번호들 */
export function feasibleCulprits(cs, facts) {
  const out = [];
  for (let c = 0; c < cs.suspects.length; c++) {
    if (violations(cs, c, facts).length === 0) out.push(c);
  }
  return out;
}

/**
 * 다른 용의자의 진술(w, t)이 범인의 거짓말(lie = 범인 c 의 사건 시각 진술)과 맞부딪치는가.
 * 둘만 놓고 봐도 동시에 참일 수 없을 때만 true.
 */
export function statementRefutes(cs, c, w, t) {
  if (w === c || t !== cs.crimeSlot) return false;
  const lie = cs.statements[c][t];
  const st = cs.statements[w][t];
  const same = st.room === lie.room;
  const lc = lie.comp;
  const wc = st.comp;
  if (lc && lc.kind === 'with' && lc.who === w && !same) return true;
  if (lc && lc.kind === 'without' && lc.who === w && same) return true;
  if (lc && lc.kind === 'alone' && same) return true;
  if (wc && wc.kind === 'alone' && same) return true;
  if (wc && wc.kind === 'without' && wc.who === c && same) return true;
  if (wc && wc.kind === 'with' && wc.who === c && !same) return true;
  return false;
}

/** 증거 하나가 범인의 거짓말과 맞부딪치는가 (둘만 놓고 봐도 동시에 참일 수 없을 때) */
export function factRefutes(cs, c, fact) {
  const t = cs.crimeSlot;
  const lie = cs.statements[c][t];
  const lc = lie.comp;
  if (fact.slot !== t) return false;
  switch (fact.kind) {
    case 'count':
      if (fact.room !== lie.room) return false;
      if (fact.n === 0) return true;
      if (lc && lc.kind === 'alone' && fact.n !== 1) return true;
      if (lc && lc.kind === 'with' && fact.n < 2) return true;
      return false;
    case 'seen':
      if (fact.who === c) return fact.room !== lie.room;
      if (lc && lc.kind === 'with' && lc.who === fact.who) return fact.room !== lie.room;
      if (lc && lc.kind === 'without' && lc.who === fact.who) return fact.room === lie.room;
      if (lc && lc.kind === 'alone') return fact.room === lie.room;
      return false;
    case 'foot':
      return fact.room === lie.room && cs.suspects[c].foot !== fact.pattern;
    default:
      return false;
  }
}

/**
 * 고발 판정.
 * pick: { suspect, slot, item }  item: { type:'statement', who, slot } | { type:'evidence', index }
 * 결과: 'solved' | 'deny' (범인은 맞지만 거짓말이나 증거가 틀림) | 'wrong' (범인이 아님)
 */
export function judge(cs, pick) {
  if (pick.suspect !== cs.culprit) return 'wrong';
  if (pick.slot !== cs.crimeSlot) return 'deny';
  const item = pick.item;
  if (!item) return 'deny';
  if (item.type === 'statement') {
    return statementRefutes(cs, cs.culprit, item.who, item.slot) ? 'solved' : 'deny';
  }
  if (item.type === 'evidence') {
    const ev = cs.evidence[item.index];
    return ev && factRefutes(cs, cs.culprit, ev.fact) ? 'solved' : 'deny';
  }
  return 'deny';
}

/** 범인의 거짓말을 깨는 진술과 증거를 모두 찾는다 */
export function refuters(cs) {
  const c = cs.culprit;
  const t = cs.crimeSlot;
  const out = [];
  for (let w = 0; w < cs.suspects.length; w++) {
    if (statementRefutes(cs, c, w, t)) out.push({ type: 'statement', who: w, slot: t });
  }
  cs.evidence.forEach((ev, index) => {
    if (factRefutes(cs, c, ev.fact)) out.push({ type: 'evidence', index });
  });
  return out;
}

/**
 * 결백한 용의자 x 가 왜 범인이 아닌지 설명할 거리를 찾는다 (잘못 고발했을 때와 힌트에 쓴다).
 * 실제로 참인 근거만 돌려준다: [{ type:'evidence', index } | { type:'statement', who, slot }]
 */
export function innocenceReasons(cs, x) {
  const out = [];
  const t = cs.crimeSlot;
  const trueLoc = cs.loc;
  cs.evidence.forEach((ev, index) => {
    const f = ev.fact;
    if (f.kind === 'cfoot' && cs.suspects[x].foot !== f.pattern) out.push({ type: 'evidence', index });
    else if (f.kind === 'cprint' && cs.suspects[x].print !== f.type) out.push({ type: 'evidence', index });
    else if (f.kind === 'trail' && trueLoc[x][f.slot] !== f.room) out.push({ type: 'evidence', index });
    else if (f.kind === 'seen' && f.slot === t && f.who === x) out.push({ type: 'evidence', index });
  });
  for (let w = 0; w < cs.suspects.length; w++) {
    if (w === x || w === cs.culprit) continue;
    const comp = cs.statements[w][t].comp;
    if (comp && comp.kind === 'with' && comp.who === x) out.push({ type: 'statement', who: w, slot: t });
  }
  return out;
}
