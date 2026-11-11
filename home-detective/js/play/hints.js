// 무전(힌트): "쪽지를 못 찾겠어" 와 "추리가 막혔어" 두 갈래, 각각 1~3단계.
// 받을 때마다 시간이 깎이고, 같은 대상의 같은 단계는 다시 봐도 공짜다.

import { h, showModal } from '../shared/dom.js';
import { photos } from '../shared/store.js';
import { RULES } from '../shared/score.js';
import { josa, evidenceTitle, itemText } from '../shared/text.js';
import { G, at, log, commit, penalize, foundOf, evDone, owned, mmss, lastProgressAt } from './game.js';
import { openOverlay, toggleOff } from './overlay.js';
import { audio } from './audio.js';

/** 무전 판을 열어 본 진전 시점 (이때까지는 무전 버튼이 깜빡이지 않는다) */
export const nudge = { seenFor: -1 };

export function hasHint(kind, level, target) {
  return G.run.hints.some((x) => x.type === kind && x.level === level && x.target === target);
}

/** 힌트를 받은 것으로 적는다. 이미 받은 것이면 false (비용 없음). */
export function grantHint(kind, level, target) {
  if (hasHint(kind, level, target)) return false;
  G.run.hints.push({ at: at(), type: kind, level, target });
  penalize(RULES.hintMs[level - 1]);
  log('hint', { kind, level, target });
  audio.sfx('hint');
  commit('hint');
  return true;
}

// ---------- 쪽지 찾기 ----------

/** 방 r 에서 힌트를 줄 쪽지: 못 찾은 것 중 용의자 먼저 */
export function searchTarget(r) {
  const left = G.cs.tags.filter((t) => t.room === r && !foundOf(t));
  return left.find((t) => t.kind === 'suspect') || left[0] || null;
}

function placedOf(tag) {
  const p = (G.setup.placed && G.setup.placed[tag.id]) || {};
  return { text: String(p.hint || '').trim(), photo: G.photoOk[tag.id] ? p.photo : null };
}

/** 이 쪽지의 마지막 단계 */
function searchMax(tag) {
  return placedOf(tag).photo ? 3 : placedOf(tag).text ? 2 : 1;
}

/** 단계별 내용: { text, photo?, crop?, free? } */
export function searchContent(tag, level) {
  const room = G.cs.rooms[tag.room].name;
  const kind = tag.kind === 'suspect' ? '용의자' : '증거';
  const p = placedOf(tag);
  if (level === 1) return { text: room + '에 아직 ' + kind + ' 쪽지가 있어. 눈높이보다 낮은 곳, 물건 뒤를 봐.' };
  if (level === 2) {
    if (p.text) return { text: '숨긴 사람의 귀띔: "' + p.text + '"' };
    if (p.photo) return { text: '숨긴 곳 사진의 한가운데야. 어디인지 알겠어?', photo: p.photo, crop: true };
    return { text: '이 쪽지는 숨긴 사람만 알아. 구석구석 찾아봐.', free: true };
  }
  if (level === 3 && p.photo) return { text: '숨긴 곳 사진이야.', photo: p.photo };
  return null;
}

// ---------- 추리 ----------

export function deduceContent(level) {
  const cs = G.cs;
  const crimeRoom = cs.rooms[cs.crimeRoom].name;
  const crimeSlot = cs.slots[cs.crimeSlot];
  if (level === 1) {
    if (!evDone(0)) return { text: '사건 현장(' + crimeRoom + ')부터 조사해서 간식이 사라진 시각을 알아내자.' };
    return { text: '정리표에서 ' + crimeSlot + ' 칸을 위아래로 비교해 봐. 서로 맞지 않는 말이 있어.' };
  }
  if (level === 2) {
    const ev = cs.evidence[1];
    if (!evDone(1)) return { text: '사건 현장에 범인의 흔적이 하나 더 있어.' };
    const f = ev.fact;
    const same = cs.suspects.filter((p) => (f.kind === 'cfoot' ? p.foot === f.pattern : p.print === f.type)).map((p) => p.name);
    return { text: josa(evidenceTitle(cs, ev), '을/를') + ' 보면 범인은 ' + same.join(', ') + ' 중에 있어.' };
  }
  // 아이가 이미 가진 근거가 있으면 그것을 짚는다 (없으면 첫 번째 근거를 어디서 얻는지)
  const ref = cs.refuters.find(owned) || cs.refuters[0];
  const culprit = cs.suspects[cs.culprit].name;
  if (owned(ref)) return { text: culprit + '의 ' + crimeSlot + ' 말과 이것을 나란히 놓고 봐: ' + itemText(cs, ref) };
  const where =
    ref.type === 'statement'
      ? cs.suspects[ref.who].name + '에게 ' + josa(cs.slots[ref.slot], '을/를') + ' 물어봐.'
      : cs.rooms[cs.evidence[ref.index].room].name + '에 있는 증거를 조사해.';
  return { text: culprit + '의 ' + crimeSlot + ' 말을 깨는 단서가 아직 없어. ' + where };
}

/** 검증 손잡이: 확인 없이 힌트를 받는다 */
export function takeHint(kind, level, room) {
  if (kind === 'search') {
    const tag = searchTarget(room);
    if (!tag) return null;
    const c = searchContent(tag, level);
    if (c && !c.free) grantHint('search', level, tag.id);
    return c ? Object.assign({ target: tag.id }, c) : null;
  }
  if (level < 1 || level > 3) return null;
  grantHint('deduce', level, 'deduce');
  return Object.assign({ target: 'deduce' }, deduceContent(level));
}

// ---------- 화면 ----------

export function openHints() {
  if (toggleOff('hint')) return;
  nudge.seenFor = lastProgressAt();
  const ov = openOverlay('hint', { title: '📻 본부 무전', cls: 'hint' });
  audio.sfx('open');
  let view = { name: 'home' };

  function go(next) {
    view = next;
    render();
    ov.body.scrollTop = 0;
  }

  function render() {
    const parts = [];
    if (view.name === 'home') parts.push(home());
    else if (view.name === 'rooms') parts.push(rooms());
    else if (view.name === 'search') parts.push(levels('search', view.tag));
    else parts.push(levels('deduce', null));
    ov.body.replaceChildren(...parts);
  }

  function home() {
    return h(
      'div',
      { class: 'hint-home' },
      h('p', { class: 'hint-radio', text: '지직… 여기는 본부. 무엇이 막혔어?' }),
      h('button', { class: 'hint-choice', type: 'button', 'data-branch': 'search', onClick: () => go({ name: 'rooms' }) }, h('b', { text: '🔍 쪽지를 못 찾겠어' }), h('small', { text: '어느 방의 어디를 뒤질지 알려 줄게' })),
      h('button', { class: 'hint-choice', type: 'button', 'data-branch': 'deduce', onClick: () => go({ name: 'deduce' }) }, h('b', { text: '🧠 추리가 막혔어' }), h('small', { text: '무엇을 비교하면 좋을지 알려 줄게' })),
      h(
        'p',
        { class: 'hint-cost' },
        '힌트를 들으면 시간이 줄어. 1단계 ' + mmss(RULES.hintMs[0]) + ' · 2단계 ' + mmss(RULES.hintMs[1]) + ' · 3단계 ' + mmss(RULES.hintMs[2]) + '. 한 번 들은 힌트는 다시 봐도 공짜야.'
      )
    );
  }

  function rooms() {
    const cs = G.cs;
    const list = cs.rooms
      .map((room, r) => ({ room, r, n: cs.tags.filter((t) => t.room === r && !foundOf(t)).length }))
      .filter((x) => x.n > 0);
    return h(
      'div',
      { class: 'hint-rooms' },
      h('button', { class: 'btn ghost small hint-back', type: 'button', text: '← 처음으로', onClick: () => go({ name: 'home' }) }),
      h('h3', { text: '어느 방이 궁금해?' }),
      list.length
        ? list.map(({ room, r, n }) =>
            h('button', { class: 'hint-room', type: 'button', 'data-room': r, onClick: () => go({ name: 'search', tag: searchTarget(r) }) }, h('span', { text: room.icon }), h('b', { text: room.name }), h('small', { text: '못 찾은 쪽지 ' + n + '개' }))
          )
        : h('p', { class: 'soft', text: '쪽지를 모두 찾았어! 이제 추리할 차례야.' })
    );
  }

  function levels(kind, tag) {
    const target = kind === 'search' ? tag.id : 'deduce';
    const max = kind === 'search' ? searchMax(tag) : 3;
    const content = (lv) => (kind === 'search' ? searchContent(tag, lv) : deduceContent(lv));
    const cards = [];
    let next = null;
    for (let lv = 1; lv <= max; lv++) {
      if (hasHint(kind, lv, target)) {
        cards.push(hintCard(lv, content(lv)));
        continue;
      }
      next = lv;
      break;
    }
    // 부모가 아무것도 남기지 않은 쪽지는 1단계 뒤에 공짜 안내가 붙는다
    if (kind === 'search' && next === null && max === 1) cards.push(hintCard(2, searchContent(tag, 2)));
    const title = kind === 'search' ? G.cs.rooms[tag.room].icon + ' ' + G.cs.rooms[tag.room].name + '의 쪽지' : '추리 힌트';
    return h(
      'div',
      { class: 'hint-levels' },
      h('button', { class: 'btn ghost small hint-back', type: 'button', text: kind === 'search' ? '← 방 다시 고르기' : '← 처음으로', onClick: () => go({ name: kind === 'search' ? 'rooms' : 'home' }) }),
      h('h3', { text: title }),
      cards,
      next
        ? h(
            'button',
            { class: 'btn primary block hint-next', type: 'button', 'data-level': next, onClick: () => ask(kind, next, target) },
            next + '단계 힌트 듣기 (시간 -' + mmss(RULES.hintMs[next - 1]) + ')'
          )
        : h('p', { class: 'soft hint-end', text: '이게 마지막 힌트야. 힘내, 탐정!' })
    );
  }

  async function ask(kind, level, target) {
    const ok = await showModal({
      title: level + '단계 힌트',
      text: '힌트를 들으면 시간이 ' + mmss(RULES.hintMs[level - 1]) + ' 줄어. 들을래?',
      actions: [
        { label: '그만둘래', value: false },
        { label: '들을래', value: true, kind: 'primary' },
      ],
    });
    if (!ok || ov.closed) return;
    grantHint(kind, level, target);
    render();
  }

  render();
  return ov;
}

function hintCard(level, c) {
  const card = h('div', { class: 'card hint-card' + (c.free ? ' free' : ''), 'data-level': level }, h('small', { class: 'hint-lv', text: c.free ? '무전' : level + '단계' }), h('p', { text: c.text }));
  if (c.photo) {
    const pic = h('div', { class: 'hint-photo' + (c.crop ? ' crop' : '') });
    card.append(pic);
    photos.url(c.photo).then((url) => {
      if (!url) return;
      const img = new Image();
      img.onload = () => {
        pic.style.aspectRatio = img.naturalWidth + ' / ' + img.naturalHeight;
        pic.style.backgroundImage = 'url("' + url + '")';
      };
      img.src = url;
    });
  }
  return card;
}
