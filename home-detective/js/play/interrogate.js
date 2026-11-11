// 탐문: 용의자에게 세 시각을 하나씩 묻는다. 들은 말은 수첩에 저절로 적힌다.
// 범인도 똑같은 모습으로 답한다 (연출로 티가 나면 안 된다).

import { h, avatar, toast } from '../shared/dom.js';
import { statementSpeech, statementNote, personaHello, personaBye, personaName } from '../shared/text.js';
import { G, commit, log, markUnseen, suspectTag, heard, heardAll, discover } from './game.js';
import { openOverlay, findOverlay } from './overlay.js';
import { celebrate, typer, replay } from './fx.js';
import { audio } from './audio.js';

/**
 * 진술 하나를 들은 것으로 적는다 (저장은 여기서 한다).
 * 돌려주는 값: 'old'(이미 들음) | 'new' | 'done'(이번에 셋 다 채움)
 */
export function hear(s, t) {
  const run = G.run;
  const tag = suspectTag(s);
  discover(tag);
  const list = run.asked[s] || (run.asked[s] = []);
  if (list.includes(t)) return 'old';
  list.push(t);
  log('asked', { s, t });
  markUnseen();
  let result = 'new';
  if (heardAll(s) && !run.found[tag.id].done) {
    run.found[tag.id].done = true;
    result = 'done';
  }
  commit('asked');
  return result;
}

export function openInterrogate(s, isNew) {
  const cs = G.cs;
  const who = cs.suspects[s];
  const tag = suspectTag(s);
  const ov = openOverlay('interrogate', { title: '탐문', cls: 'iv' });
  ov.suspect = s;

  const say = h('p', { class: 'iv-say' });
  const bubble = h('div', { class: 'iv-bubble', onClick: () => talk.finish() }, say);
  const bye = h('p', { class: 'iv-bye' });
  const talk = typer(say);
  const byeTalk = typer(bye);

  const qs = cs.slots.map((label, t) => {
    const note = h('small', { class: 'iv-note' });
    const btn = h(
      'button',
      { class: 'iv-q', type: 'button', 'data-slot': t, onClick: () => ask(t) },
      h('span', { class: 'iv-check', 'aria-hidden': 'true' }),
      h('span', { class: 'iv-q-text' }, h('b', { text: label + '에 어디 있었어?' }), note)
    );
    btn._note = note;
    return btn;
  });

  ov.body.append(
    h(
      'div',
      { class: 'iv-who' },
      avatar(who, 'big'),
      h('div', { class: 'iv-name' }, h('h3', { text: who.name }), h('span', { class: 'chip', text: personaName(cs, s) }))
    ),
    bubble,
    bye,
    h('div', { class: 'iv-qs' }, qs),
    h('p', { class: 'iv-tip', text: '들은 말은 수첩에 저절로 적혀. 말풍선을 누르면 한 번에 다 나와.' })
  );
  // 말풍선 밖을 눌러도 한 번에 나오게
  ov.body.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('button')) talk.finish();
  });

  function refresh() {
    qs.forEach((btn, t) => {
      const ok = heard(s, t);
      btn.classList.toggle('heard', ok);
      btn.querySelector('.iv-check').textContent = ok ? '✔' : '?';
      btn._note.textContent = ok ? statementNote(cs, s, t) : '';
    });
  }

  function ask(t) {
    byeTalk.stop();
    bye.textContent = '';
    say.classList.remove('soft');
    audio.sfx('ask');
    const r = hear(s, t);
    refresh();
    qs.forEach((b, i) => b.classList.toggle('now', i === t));
    replay(bubble, 'pop');
    talk.play(statementSpeech(cs, s, t), () => {
      if (r !== 'done') return;
      byeTalk.play(personaBye(cs, s), () => {
        toast('수첩에 적었어', 'good');
      });
    });
  }

  refresh();
  if (isNew) {
    celebrate(ov.sheet, { title: '용의자 쪽지 발견!', tag });
    replay(bubble, 'pop');
    // 축하가 지나간 뒤 첫마디
    say.textContent = '';
    const t0 = setTimeout(() => talk.play(personaHello(cs, s)), 700);
    ov.onClose = () => {
      clearTimeout(t0);
      talk.stop();
      byeTalk.stop();
    };
  } else {
    say.textContent = heardAll(s) ? '또 물어볼 게 있어?' : '무엇을 물어볼래?';
    say.classList.add('soft');
    ov.onClose = () => {
      talk.stop();
      byeTalk.stop();
    };
  }
  return ov;
}

/** 열려 있는 탐문 판을 지금 상태로 다시 그린다 (부모 도움 등으로 바뀌었을 때) */
export function refreshInterrogate() {
  const ov = findOverlay('interrogate');
  if (!ov) return;
  const s = ov.suspect;
  ov.close();
  openInterrogate(s, false);
}
