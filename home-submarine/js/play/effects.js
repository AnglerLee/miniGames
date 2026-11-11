// 엔진 기록(log)에 새로 생긴 일을 보고 소리, 진동, 번쩍임, 알림을 고른다.
// 규칙을 다시 판단하지 않는다. 엔진이 적은 일(wave, miss, resolve …)에만 반응한다.

import { buzz } from '../shared/dom.js';
import { urgency, depth, remaining } from '../shared/engine.js';
import { STAGES } from '../shared/content.js';
import { G, urgentFirst, secs, routeLeft } from './game.js';
import { flash, note, shake } from './fx.js';
import { closeForAlert } from './arrive.js';
import { audio } from './audio.js';

const DIVE_STAGES = ['dive', 'deep', 'salvage'];

export function handleChange({ prev, next, fresh }) {
  for (const e of fresh) {
    switch (e.type) {
      case 'wave': {
        const two = e.ids.length > 1;
        flash('alarm');
        audio.sfx(two ? 'alarm2' : 'alarm');
        buzz(two ? [220, 90, 220, 90, 220] : [260, 110, 260]);
        break;
      }
      case 'miss': {
        const st = G.stations[e.station];
        // 고치던 판이 있으면 닫는다
        const late = closeForAlert(e.id, 'late');
        if (next.phase === 'run' || next.phase === 'route') {
          note({ icon: st.role.icon, text: late ? '늦었어. 선체가 깎였어' : '놓쳤어. 선체 -' + e.severity, sub: st.role.name + ' · ' + st.room.name, kind: 'bad', color: st.role.color, ms: 1800 });
        }
        break;
      }
      case 'routeMiss':
        if (next.phase === 'route') note({ icon: '🏗️', text: '시간 초과. 선체 -2', sub: '순서를 처음부터 다시 보여 줄게', kind: 'bad', ms: 2200 });
        break;
      case 'resolve': {
        const st = G.stations[e.station];
        audio.sfx('fixed');
        buzz([40, 50, 80]);
        flash('good');
        note({ icon: e.kind === 'relay' ? '📡' : '✓', text: e.kind === 'relay' ? '전달 완료' : '수리 완료', sub: st.role.name + ' · ' + st.room.name, kind: 'good', color: st.role.color, ms: 1100, sparks: true });
        break;
      }
      case 'routeStep':
        audio.sfx('good');
        buzz(40);
        break;
      case 'routeWrong':
        audio.sfx('bad');
        buzz([90, 60, 90]);
        shake(document.querySelector('.center > .route'));
        note({ icon: '🏗️', text: '순서가 달라', sub: '시간 -5초', kind: 'bad', ms: 1500 });
        break;
      case 'stage':
        if (DIVE_STAGES.includes(STAGES[next.stage].id)) audio.sfx('dive');
        break;
      case 'clear':
        audio.sfx('stage');
        break;
      case 'failed':
        audio.sfx('fail');
        buzz([400, 120, 400]);
        break;
      case 'pause':
        audio.music.stop();
        break;
      default:
        break;
    }
  }
  if (next.hull < prev.hull) {
    flash('damage');
    audio.sfx('damage');
    buzz([120, 50, 220]);
  }
}

let lastTickSec = null;
let lastU = null;
let lastD = null;

/** 매 tick: 음악 긴장도와 수심, 남은 시간이 빠듯할 때 초마다 'tick' 소리, 화면 가장자리 붉은 맥박 */
export function frameEffects(s) {
  const u = Math.round(urgency(s) * 50) / 50;
  if (u !== lastU) {
    lastU = u;
    audio.music.setUrgency(u);
  }
  const d = depth(s);
  if (d !== lastD) {
    lastD = d;
    audio.music.setDepth(d);
  }
  let left = null;
  let ratio = 1;
  if (s.phase === 'run') {
    const a = urgentFirst(s)[0];
    if (a) {
      left = remaining(s, a);
      ratio = left / a.limitMs;
    }
  } else if (s.phase === 'route' && s.route && s.clock >= s.route.shownUntil) {
    left = routeLeft(s);
    ratio = left / s.route.limitMs;
  }
  const danger = left !== null && ratio < 0.25 && !s.paused;
  if (danger) {
    const sec = secs(left);
    if (sec !== lastTickSec) {
      lastTickSec = sec;
      audio.sfx('tick');
    }
  } else lastTickSec = null;
  document.body.classList.toggle('is-danger', danger);
}
