// 짝 맞추기 관리자 설정
// 난이도 기본값은 game.js 의 PRESETS 와 같아야 한다.
(function () {
    const api = AdminKit.page({
        title: '짝 맞추기 설정',
        storageKey: 'card_match_settings',
        recordId: 'game03',
        note: '카드를 잠깐 보여 준 뒤 뒤집고 짝을 찾는 게임입니다. 스테이지는 3×4 → 4×4(틀리면 자리 바꾸기) → 4×5(폭탄 쌍) 순서입니다. 시간은 1스테이지 기준으로 적고, 뒤 스테이지는 카드 수에 맞춰 저절로 늘어납니다.',
        presets: [
            { previewTime: 4, stageTime: 50, missPenalty: 1, bombTime: 9, lives: 3 },
            { previewTime: 3, stageTime: 40, missPenalty: 2, bombTime: 7, lives: 3 },
            { previewTime: 2, stageTime: 32, missPenalty: 3, bombTime: 5, lives: 2 }
        ],
        fields: [
            { key: 'previewTime', label: '👀 미리 보기 (초)', min: 0.5, max: 15, step: 0.5, help: '시작할 때 카드를 보여 주는 시간. 2스테이지 1.25배, 3스테이지 1.5배' },
            { key: 'stageTime', label: '⏱️ 제한 시간 (초)', min: 10, max: 300, step: 1, help: '1스테이지 제한 시간. 2스테이지 1.3배, 3스테이지 1.7배' },
            { key: 'missPenalty', label: '❌ 틀리면 깎이는 시간 (초)', min: 0, max: 15, step: 0.5, help: '짝을 틀릴 때마다 줄어듭니다. 0이면 깎지 않습니다' },
            { key: 'bombTime', label: '💣 폭탄 도화선 (초)', min: 2, max: 30, step: 0.5, help: '폭탄을 뒤집은 뒤 짝 폭탄을 찾아야 하는 시간' },
            { key: 'lives', label: '❤️ 하트 수', min: 1, max: 5, step: 1, help: '폭탄이 터질 때마다 하나씩 줄어듭니다 (3스테이지에서만 씁니다)' }
        ]
    });

    // 옛 형식({ pairCount, timeLimit })만 저장돼 있으면 게임과 같은 식으로 제한 시간을 옮겨 보여 준다
    const old = api.stored();
    const limit = Number(old.timeLimit);
    if (old.stageTime === undefined && limit > 0) {
        const pairs = Math.min(30, Math.max(6, Number(old.pairCount) || 8));
        api.set('stageTime', Math.round(Math.min(120, Math.max(25, (limit / pairs) * 6))));
    }
})();
