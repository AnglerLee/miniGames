// 미로 탈출 관리자 설정
// 난이도 기본값은 game.js 의 PRESETS 와 같아야 한다.
AdminKit.page({
    title: '미로 탈출 설정',
    storageKey: 'mazeGameSettings',
    recordId: 'game02',
    note: '열쇠 3개를 모아 출구로 탈출하는 게임입니다. 세 스테이지(탐색 → 어둠 → 유령 추격)를 차례로 지나고, 미로는 판마다 새로 만들어집니다.',
    presets: [
        { stageTime: 45, mazeSize: 1, ghostSpeed: 40, sight: 3 },
        { stageTime: 40, mazeSize: 2, ghostSpeed: 50, sight: 2.6 },
        { stageTime: 36, mazeSize: 3, ghostSpeed: 60, sight: 2.3 }
    ],
    fields: [
        { key: 'stageTime', label: '1스테이지 시간 (초)', min: 15, max: 300, step: 1, help: '2스테이지는 1.5배, 3스테이지는 2배가 됩니다' },
        { key: 'mazeSize', label: '미로 크기 (1~3)', min: 1, max: 3, step: 1, help: '1은 7×9칸, 2는 9×11칸, 3은 11×13칸에서 시작해 스테이지마다 커집니다 (최대 13×15칸)' },
        { key: 'ghostSpeed', label: '유령 속도 (%)', min: 10, max: 95, step: 5, help: '캐릭터 속도를 100으로 볼 때의 빠르기. 3스테이지에 나오고, 가까이 오면 절반까지 느려집니다' },
        { key: 'sight', label: '손전등 반경 (칸)', min: 1.5, max: 6, step: 0.1, help: '어둠 속에서 보이는 거리. 3스테이지는 0.8칸 더 넓습니다' }
    ],
    extras: [
        { section: '캐릭터' },
        {
            key: 'gameTheme', label: '캐릭터 테마', type: 'select', default: 'cat', wide: true,
            options: [
                ['cat', '😺 고양이와 털실 (분홍 미로)'],
                ['rabbit', '🐰 토끼와 당근 (초록 미로)'],
                ['unicorn', '🦄 유니콘과 무지개 (보라 미로)'],
                ['panda', '🐼 판다와 대나무 (파랑 미로)'],
                ['dog', '🐶 강아지와 뼈다귀 (주황 미로)']
            ],
            help: '열쇠를 다 모으면 출구에 캐릭터의 보물이 나타납니다'
        }
    ],
    onRender(form, api) {
        // 옛 설정은 난이도를 activeDifficulty: 'easy' | 'normal' | 'hard' 로 저장했다. 슬라이더를 그 난이도에 맞춘다
        const old = api.stored();
        const level = ['easy', 'normal', 'hard'].indexOf(old.activeDifficulty);
        const slider = form.querySelector('#difficultySlider');
        if (old.difficulty === undefined && level > 0 && slider) {
            slider.value = level;
            slider.dispatchEvent(new Event('input'));
        }
    }
});
