// 검증용 손잡이 (?debug=1 일 때만). 끝까지 하는 검사가 이 이름들을 쓴다.
// 모두 화면과 같은 길(도착 확인 → 판 → 엔진)을 지나가게 해서, 손잡이로 통과한 것은 손으로도 통과한다.

import { G, send, timed, urgentFirst } from './game.js';
import { topOverlay, closeAll } from './overlay.js';
import { arriveAt } from './arrive.js';
import { openQueryInfo, answerOpen } from './query.js';
import { taskStats, solveOpen, openTaskInfo } from './taskpanel.js';
import { enterCorrect } from './relay.js';
import { pauseGame, resumeGame } from './menu.js';
import { noteText } from './fx.js';

const TICK = 250;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const copy = (v) => JSON.parse(JSON.stringify(v));

export function exposeDebug({ startStage, onNext, onRetry }) {
  const api = {
    get setup() {
      return G.setup;
    },
    get stations() {
      return G.stations;
    },
    taskStats,

    /** 엔진 상태의 복사본 + 지금 맨 위 판과 열린 질문 */
    state() {
      const top = topOverlay();
      const base = G.state ? copy(G.state) : { phase: 'none' };
      return Object.assign(base, { overlay: top ? top.name : null, query: openQueryInfo(), ui: { task: openTaskInfo(), note: noteText() } });
    },

    /** 표지·브리핑·단계 안내를 넘기고 begin */
    begin() {
      if (G.state && G.state.phase === 'intro') startStage();
      return api.state();
    },

    /** 게임 시간을 ms 만큼 흘린다 (250ms 씩) */
    advance(ms) {
      for (let left = ms; left > 0 && timed(); left -= TICK) send({ type: 'tick', dt: Math.min(TICK, left) });
      return api.state();
    },

    /** 도착 확인을 통과한 것으로 하고 뒤따르는 판까지 연다 (멈춰 있으면 화면처럼 무시한다) */
    checkin(station) {
      if (!timed() || G.state.paused) return null;
      closeAll('stage');
      arriveAt(station);
      return api.state();
    },

    answer: answerOpen,
    solveTask: solveOpen,

    enterCode(id) {
      enterCorrect(id);
      return api.state();
    },

    next() {
      onNext();
      return api.state();
    },

    retry() {
      onRetry();
      return api.state();
    },

    pause() {
      pauseGame();
      return api.state();
    },

    resume() {
      resumeGame();
      return api.state();
    },

    /**
     * 가상의 아이가 끝까지 한다 (tests/engine.test.js 의 play() 와 같은 순서).
     * 급한 경보부터, 한 번 이동에 hopMs + checkinMs, 수리에 taskMs.
     */
    async autoplay(opts = {}) {
      const w = Object.assign({ hopMs: 12000, taskMs: 9000, checkinMs: 2000, reactMs: 2000 }, opts);
      const live = () => timed();
      const still = (id) => G.state.active.some((x) => x.id === id);
      const go = (station) => {
        api.advance(w.hopMs + w.checkinMs);
        if (live() && !G.state.paused) api.checkin(station);
      };
      G.manual = true;
      try {
        let guard = 0;
        while (G.state.phase !== 'done' && guard++ < 6000) {
          if (guard % 15 === 0) await sleep(0);
          const s = G.state;
          if (s.paused && live()) resumeGame();
          else if (s.phase === 'intro') api.begin();
          else if (s.phase === 'clear') api.next();
          else if (s.phase === 'failed') api.retry();
          else if (s.phase === 'dock') go(G.stations.find((st) => !s.visited.includes(st.idx)).idx);
          else if (s.phase === 'route') {
            if (s.clock < s.route.shownUntil) api.advance(s.route.shownUntil - s.clock);
            else go(s.route.order[s.route.step]);
          } else if (!s.active.length) api.advance(TICK);
          else {
            api.advance(w.reactMs);
            const a = urgentFirst(G.state)[0];
            if (!a) continue;
            if (a.kind === 'fix') {
              go(a.station);
              if (!still(a.id)) continue;
              api.advance(w.taskMs);
              await api.solveTask();
            } else if (a.kind === 'fetch') {
              go(a.source);
              if (!still(a.id)) continue;
              go(a.station);
              if (!still(a.id)) continue;
              api.advance(w.taskMs);
              await api.solveTask();
            } else {
              go(a.source);
              if (!still(a.id)) continue;
              go(a.station);
              if (!still(a.id)) continue;
              api.advance(3000);
              api.enterCode(a.id);
            }
          }
        }
      } finally {
        G.manual = false;
      }
      await sleep(50);
      return api.state();
    },
  };
  window.__hs = api;
}
