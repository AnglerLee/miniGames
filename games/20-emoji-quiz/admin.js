// 이모지 퀴즈쇼 관리자 설정
// 난이도 기본값은 game.js 의 PRESETS 와 같아야 한다.
(function () {
    'use strict';

    const GAME_ID = 'game20';

    // 예전 게임이 쓰던 자리(treasureHunt_gameConfigs.game20.gameSettings)에 값이 있으면 기본값으로 삼는다.
    // game.js 의 legacySettings 와 같은 계산이다. 그 자리의 다른 값은 건드리지 않는다.
    function legacySettings() {
        const out = {};
        try {
            const all = JSON.parse(localStorage.getItem(AdminKit.ns('treasureHunt_gameConfigs'))) || {};
            const old = (all[GAME_ID] && all[GAME_ID].gameSettings) || {};
            const time = Number(old.timePerQuestion);
            const total = Number(old.totalQuestions);
            if (time > 0) out.questionTime = Math.min(60, Math.max(8, time));
            if (total > 0) out.quota = Math.min(8, Math.max(3, Math.round(total / 3)));
        } catch (e) {
            /* 예전 값이 깨져 있으면 무시한다 */
        }
        return out;
    }

    function applyLegacy(api) {
        const old = legacySettings();
        Object.keys(old).forEach((key) => api.set(key, old[key]));
    }

    AdminKit.page({
        title: '이모지 퀴즈쇼 설정',
        storageKey: 'emoji_quiz_settings',
        recordId: GAME_ID,
        note: '이모지를 보고 답을 맞히는 세 라운드 퀴즈입니다(고르기 → 글자 조립 → 스피드 조립). 키보드 없이 글자 타일을 눌러 답을 만듭니다.',
        presets: [
            { questionTime: 25, quota: 4, lives: 4 },
            { questionTime: 20, quota: 5, lives: 3 },
            { questionTime: 15, quota: 6, lives: 3 }
        ],
        fields: [
            { key: 'questionTime', label: '⏱️ 문제당 시간 (초)', min: 8, max: 60, step: 1, help: '글자 조립 한 문제의 시간. 1라운드 고르기는 이 시간의 40%' },
            { key: 'quota', label: '❓ 라운드당 문제 수', min: 3, max: 8, step: 1, help: '세 라운드 모두 이만큼씩 나옵니다' },
            { key: 'lives', label: '❤️ 하트 수', min: 1, max: 5, step: 1, help: '틀리거나 시간이 지나면 하나씩 줄어듭니다' }
        ],
        extras: [
            { section: '도움' },
            { key: 'autoHint', label: '2라운드에서 시간이 절반 지나면 힌트 한 줄 보여 주기', type: 'checkbox', default: true, wide: true, help: '마지막 라운드에는 힌트가 나오지 않습니다' }
        ],
        onRender(form, api) {
            // 새 설정을 한 번도 저장하지 않았다면 예전 값을 보여 준다
            if (!Object.keys(api.stored()).length) applyLegacy(api);
        },
        onReset: applyLegacy
    });
})();
