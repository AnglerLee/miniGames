// 작전 진행 상태: 시간, 경보, 발각, 체크포인트, 등급.
// 화면과 무관한 순수 함수라서 Node 에서 그대로 테스트할 수 있다.
//
//   reduce(state, event, rules) -> { state, effects }
//
// 단계(phase) 흐름
//   BRIEFING -> COMMS -> INTRO -> ACTIVE -> CLEAR -> INTRO ... -> OPENED
//                                  ACTIVE -> CAUGHT -> INTRO (새 채널)

import { TIME_PRESETS_MIN } from './mission.js';
import { CHANNEL_COUNT } from './synccode.js';

export const RUN_VERSION = 1;

/** 작전 설정에서 규칙 수치를 만든다. 수치는 모두 시작값이며 해 보면서 조정한다. */
export function rulesFor(mission) {
  return {
    totalMs: TIME_PRESETS_MIN[mission.timePreset] * 60000,
    alarmMax: 5, // 이 단계에 닿으면 발각
    mistakeMs: 30000, // 실수 한 번에 깎이는 시간
    captureMinMs: 150000, // 발각 뒤 보장되는 최소 시간
    captureAlarm: 2, // 발각 뒤 시작 경보 단계
    clearRelief: 1, // 단계를 통과하면 내려가는 경보 단계
    // 실제로 거치는 단계 번호 (0 은 교신 점검)
    order: mission.token ? [1, 2, 3, 4, 5] : [1, 2, 3, 5],
  };
}

export function initialRun(mission, rules) {
  return {
    v: RUN_VERSION,
    code: mission.code,
    phase: 'BRIEFING',
    stage: 0,
    channel: 0,
    attempt: 0,
    alarm: 0,
    remainingMs: rules.totalMs,
    mistakes: 0,
    captures: 0,
    support: 0,
    rank: null,
    stageLog: [],
  };
}

/** 등급. 보너스 보상은 A 이상에서만 공개된다. */
export function rankOf(state, rules) {
  if (state.captures === 0 && state.support === 0) {
    if (state.mistakes <= 1 && state.remainingMs >= rules.totalMs * 0.3) return 'S';
    return 'A';
  }
  if (state.captures <= 1) return 'B';
  return 'C';
}

export const bonusUnlocked = (rank) => rank === 'S' || rank === 'A';

function caught(state, reason) {
  return {
    state: { ...state, phase: 'CAUGHT', remainingMs: Math.max(0, state.remainingMs) },
    effects: [{ type: 'CAUGHT', reason }, { type: 'PERSIST' }],
  };
}

/** 현재 단계를 끝내고 다음으로 넘긴다. skipped 는 우회 코드로 건너뛴 경우. */
function finishStage(state, rules, skipped) {
  const stageLog = [...state.stageLog, { stage: state.stage, skipped, channel: state.channel }];
  const alarm = Math.max(0, state.alarm - rules.clearRelief);
  const at = rules.order.indexOf(state.stage);
  const next = rules.order[at + 1];
  if (next === undefined) {
    const done = { ...state, stageLog, alarm, phase: 'OPENED' };
    done.rank = rankOf(done, rules);
    return {
      state: done,
      effects: [{ type: 'FINISHED', rank: done.rank }, { type: 'PERSIST' }],
    };
  }
  return {
    state: { ...state, stageLog, alarm, phase: 'CLEAR', attempt: 0 },
    effects: [
      { type: 'STAGE_CLEAR', stage: state.stage, next, skipped },
      { type: 'ALARM', level: alarm },
      { type: 'PERSIST' },
    ],
  };
}

export function reduce(state, event, rules) {
  const same = { state, effects: [] };
  switch (event.type) {
    case 'START':
      if (state.phase !== 'BRIEFING') return same;
      return { state: { ...state, phase: 'COMMS', stage: 0 }, effects: [{ type: 'PERSIST' }] };

    case 'COMMS_OK':
      if (state.phase !== 'COMMS') return same;
      return {
        state: { ...state, phase: 'INTRO', stage: rules.order[0], attempt: 0 },
        effects: [{ type: 'CHECKPOINT' }, { type: 'PERSIST' }],
      };

    case 'INTRO_DONE':
      if (state.phase !== 'INTRO') return same;
      return { state: { ...state, phase: 'ACTIVE' }, effects: [] };

    case 'TICK': {
      if (state.phase !== 'ACTIVE') return same;
      const remainingMs = state.remainingMs - event.dt;
      if (remainingMs <= 0) return caught({ ...state, remainingMs: 0 }, 'time');
      return { state: { ...state, remainingMs }, effects: [] };
    }

    case 'MISTAKE': {
      if (state.phase !== 'ACTIVE') return same;
      const next = {
        ...state,
        alarm: state.alarm + 1,
        mistakes: state.mistakes + 1,
        attempt: state.attempt + 1,
        remainingMs: state.remainingMs - rules.mistakeMs,
      };
      const hit = [
        { type: 'ALARM', level: next.alarm },
        { type: 'TIME_HIT', ms: rules.mistakeMs, reason: event.reason || '' },
      ];
      if (next.alarm >= rules.alarmMax) {
        const out = caught(next, 'alarm');
        return { state: out.state, effects: [...hit, ...out.effects] };
      }
      if (next.remainingMs <= 0) {
        const out = caught({ ...next, remainingMs: 0 }, 'time');
        return { state: out.state, effects: [...hit, ...out.effects] };
      }
      return { state: next, effects: [...hit, { type: 'REROLL', soft: false }, { type: 'PERSIST' }] };
    }

    // 경보 없이 장치만 다시 섞는다 (예: 게이트의 세션 시간 만료)
    case 'SOFT_REROLL':
      if (state.phase !== 'ACTIVE' && state.phase !== 'COMMS') return same;
      return { state: { ...state, attempt: state.attempt + 1 }, effects: [{ type: 'REROLL', soft: true }] };

    case 'STAGE_SOLVED':
      if (state.phase !== 'ACTIVE') return same;
      return finishStage(state, rules, false);

    case 'SUPPORT': {
      // 본부 우회 코드: 현재 단계를 건너뛴다
      if (state.phase !== 'ACTIVE') return same;
      return finishStage({ ...state, support: state.support + 1 }, rules, true);
    }

    case 'NEXT': {
      if (state.phase !== 'CLEAR') return same;
      const at = rules.order.indexOf(state.stage);
      return {
        state: { ...state, phase: 'INTRO', stage: rules.order[at + 1], attempt: 0 },
        effects: [{ type: 'CHECKPOINT' }, { type: 'PERSIST' }],
      };
    }

    case 'CAUGHT_ACK': {
      // 같은 단계를 새 채널로 다시 시작한다. 매뉴얼 내용이 바뀐다.
      if (state.phase !== 'CAUGHT') return same;
      return {
        state: {
          ...state,
          phase: 'INTRO',
          channel: (state.channel + 1) % CHANNEL_COUNT,
          attempt: 0,
          alarm: rules.captureAlarm,
          captures: state.captures + 1,
          remainingMs: Math.max(state.remainingMs, rules.captureMinMs),
        },
        effects: [
          { type: 'REKEY' },
          { type: 'ALARM', level: rules.captureAlarm },
          { type: 'CHECKPOINT' },
          { type: 'PERSIST' },
        ],
      };
    }

    case 'RESUMED': {
      // 새로고침 뒤 복귀: 진행 중이던 단계의 처음으로 돌아가고 장치는 다시 섞는다
      if (state.phase === 'ACTIVE' || state.phase === 'INTRO') {
        return {
          state: { ...state, phase: 'INTRO', attempt: state.attempt + 1 },
          effects: [{ type: 'PERSIST' }],
        };
      }
      return same;
    }

    default:
      return same;
  }
}
