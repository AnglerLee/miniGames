// 금고 털이 관리자 설정
// 난이도 기본값은 game.js 의 PRESETS 와 같아야 한다.
AdminKit.page({
    title: '금고 털이 설정',
    storageKey: 'safe_cracker_settings',
    recordId: 'game23',
    note: '다이얼을 천천히 돌려 반응이 가장 센 숫자를 찾는 게임입니다. 금고 세 개를 차례로 열며, 둘째 금고부터 방향 규칙과 미끼가, 셋째 금고에는 경비 순찰이 더해집니다. 소리를 켜면 훨씬 재미있습니다.',
    presets: [
        { senseRange: 10, stageTime: 45, noiseSens: 70, lives: 4 },
        { senseRange: 8, stageTime: 35, noiseSens: 100, lives: 3 },
        { senseRange: 6, stageTime: 28, noiseSens: 130, lives: 3 }
    ],
    fields: [
        { key: 'senseRange', label: '📡 감지 범위 (칸)', min: 3, max: 12, step: 1, help: '정답에서 이만큼 떨어진 곳부터 반응이 납니다. 넓을수록 찾기 쉽고, 둘째·셋째 금고는 한 칸씩 좁아집니다' },
        { key: 'stageTime', label: '⏱️ 첫 금고 시간 (초)', min: 15, max: 120, step: 1, help: '둘째 금고는 1.5배, 셋째 금고는 2배의 시간을 줍니다' },
        { key: 'noiseSens', label: '🔊 소음 민감도 (%)', min: 30, max: 250, step: 10, help: '클수록 빨리 돌릴 때 소음이 빨리 찹니다. 100이 기준입니다' },
        { key: 'lives', label: '❤️ 하트 수', min: 1, max: 5, step: 1, help: '틀린 숫자를 확정하거나 소음 경보가 울리면 하나씩 줄어듭니다' }
    ]
});
