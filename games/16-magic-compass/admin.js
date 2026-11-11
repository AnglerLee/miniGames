// 매직 컴퍼스 관리자 설정
// 난이도 기본값은 game.js 의 PRESETS 와 같아야 한다.
AdminKit.page({
    title: '매직 컴퍼스 설정',
    storageKey: 'game16_settings',
    recordId: 'game16',
    note: '삐삐 소리와 불빛만 따라 몸을 돌려 보물을 찾는 레이더 게임입니다. 스테이지 2는 가짜 돌멩이, 3은 도망가는 보물과 자기 폭풍. 방향 센서가 없으면 화면을 끌어서 돌립니다.',
    presets: [
        { tolerance: 20, holdTime: 1.2, missionCount: 2, findTime: 14, noiseAmplitude: 8, noiseFrequency: 0.5, noiseComplexity: 2 },
        { tolerance: 15, holdTime: 1.6, missionCount: 3, findTime: 12, noiseAmplitude: 12, noiseFrequency: 0.7, noiseComplexity: 3 },
        { tolerance: 11, holdTime: 2, missionCount: 4, findTime: 10, noiseAmplitude: 16, noiseFrequency: 0.9, noiseComplexity: 4 }
    ],
    fields: [
        { key: 'tolerance', label: '신호 폭 (±도)', min: 5, max: 35, step: 1, help: '이만큼 안으로 향하면 발굴이 시작됩니다. 삐삐 소리는 이 폭의 4.5배 안에서 들립니다' },
        { key: 'holdTime', label: '발굴 시간 (초)', min: 0.5, max: 4, step: 0.1, help: '보물 쪽을 향한 채 버텨야 하는 시간' },
        { key: 'missionCount', label: '스테이지당 보물 수', min: 1, max: 6, step: 1, help: '스테이지마다 찾아야 하는 보물 수' },
        { key: 'findTime', label: '보물당 시간 (초)', min: 6, max: 30, step: 1, help: '스테이지 시간 = 보물당 시간 × 보물 수. 스테이지 2는 1.25배, 3은 1.4배' },
        { section: '자기 폭풍 (스테이지 3)' },
        { key: 'noiseAmplitude', label: '폭풍 세기 (±도)', min: 0, max: 30, step: 1, help: '폭풍이 오면 레이더가 흔들리는 폭. 0이면 흔들리지 않습니다' },
        { key: 'noiseFrequency', label: '흔들림 속도 (Hz)', min: 0.1, max: 2, step: 0.1, help: '클수록 빠르게 흔들립니다' },
        { key: 'noiseComplexity', label: '불규칙함 (1~5)', min: 1, max: 5, step: 1, help: '클수록 흔들림을 예측하기 어렵습니다' }
    ],
    // 옛 설정 { difficultyLevel, compassNoise: { amplitude, frequency, complexity } } 을 화면에 옮겨 담는다
    onRender(form, api) {
        const raw = api.stored();
        if (raw.difficulty === undefined && raw.difficultyLevel !== undefined) {
            const lv = Math.min(2, Math.max(0, parseInt(raw.difficultyLevel, 10) || 0));
            const slider = document.getElementById('difficultySlider');
            if (slider && lv > 0) {
                slider.value = lv;
                slider.dispatchEvent(new Event('input')); // 그 난이도의 기본값으로 다시 채워진다
                ['tolerance', 'holdTime', 'missionCount', 'findTime'].forEach((k) => {
                    if (raw[k] !== undefined && raw[k] !== null) api.set(k, raw[k]);
                });
            }
        }
        const old = raw.compassNoise && typeof raw.compassNoise === 'object' ? raw.compassNoise : {};
        [['noiseAmplitude', 'amplitude'], ['noiseFrequency', 'frequency'], ['noiseComplexity', 'complexity']].forEach(([k, o]) => {
            if (raw[k] === undefined && old[o] !== undefined && old[o] !== null) api.set(k, old[o]);
        });
    }
});
