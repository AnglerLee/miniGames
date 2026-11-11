// 색깔 스피드 관리자 설정
// 난이도 기본값은 game.js 의 PRESETS 와 같아야 한다.
AdminKit.page({
    title: '색깔 스피드 설정',
    storageKey: 'color_rush_settings',
    recordId: 'game12',
    note: '세 스테이지(O/X → 색 고르기 → 변덕 규칙)를 차례로 통과하는 게임입니다. 난이도가 올라가면 나오는 색의 수도 4 → 5 → 6가지로 늘어납니다.',
    presets: [
        { questionTime: 3.6, quota: 6, lives: 4 },
        { questionTime: 2.8, quota: 8, lives: 3 },
        { questionTime: 2.2, quota: 10, lives: 3 }
    ],
    fields: [
        { key: 'questionTime', label: '⏱️ 문제당 시간 (초)', min: 1, max: 10, step: 0.1, help: '한 문제를 풀 수 있는 시간. 콤보가 쌓이면 조금씩 줄어듭니다' },
        { key: 'quota', label: '❓ 스테이지당 문제 수', min: 3, max: 20, step: 1, help: '스테이지를 넘기려면 맞혀야 하는 수' },
        { key: 'lives', label: '❤️ 하트 수', min: 1, max: 5, step: 1, help: '틀리거나 시간이 지나면 하나씩 줄어듭니다' }
    ]
});
