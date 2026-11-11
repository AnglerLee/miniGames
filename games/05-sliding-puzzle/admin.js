// 숫자 퍼즐 관리자 설정
// 난이도 기본값은 game.js 의 PRESETS 와 같아야 한다.
(function () {
    const api = AdminKit.page({
        title: '숫자 퍼즐 설정',
        storageKey: 'sliding_puzzle_settings',
        recordId: 'game05',
        note: '퍼즐 세 개(3×3 숫자 → 3×3 그림 → 4×4 숫자)를 이어 푸는 게임입니다. 퍼즐마다 최소 이동 수(목표)를 보여 주고, 목표에 가깝게 풀수록 별이 많습니다. 판 크기는 스테이지가 정하므로 예전의 퍼즐 크기·테마 설정은 쓰지 않습니다.',
        presets: [
            { stageTime: 30, depth: 1, budget: 2.5 },
            { stageTime: 26, depth: 2, budget: 2.2 },
            { stageTime: 24, depth: 3, budget: 1.8 }
        ],
        fields: [
            { key: 'stageTime', label: '⏱️ 제한 시간 (초)', min: 10, max: 300, step: 1, help: '1스테이지 제한 시간. 2스테이지 2배, 3스테이지 1.8배' },
            { key: 'depth', label: '🔀 섞기 깊이 (1~3)', min: 1, max: 3, step: 1, help: '클수록 목표 수가 커집니다. 1: 6~8 / 12~14 / 12~16번, 2: 8~10 / 14~16 / 16~20번, 3: 10~12 / 16~18 / 20~24번' },
            { key: 'budget', label: '👣 이동 한도 (목표의 몇 배)', min: 1.2, max: 5, step: 0.1, help: '목표 수에 이 값을 곱한 만큼만 움직일 수 있습니다. 다 쓰면 실패' }
        ],
        extras: [
            { section: '🖼️ 그림 퍼즐' },
            { key: 'showNumbers', label: '그림 조각에 작은 숫자 표시', type: 'checkbox', default: false, help: '2스테이지 그림 조각의 순서를 숫자로도 알려 줍니다. 그림만으로 어려워할 때 켭니다' }
        ]
    });

    // 옛 형식({ gridSize, timeLimit, theme })만 저장돼 있으면 게임과 같은 식으로 제한 시간을 옮겨 보여 준다
    const old = api.stored();
    const limit = Number(old.timeLimit);
    if (old.stageTime === undefined && limit > 0) {
        api.set('stageTime', Math.min(300, Math.max(10, Math.round(limit / 4))));
    }
})();
