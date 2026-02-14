// 관리자 설정 스크립트 (16 Magic Compass)
const GAME_ID = 'game16';
const form = document.getElementById('settingsForm');
const resetBtn = document.getElementById('resetBtn');
const difficultySlider = document.getElementById('difficultySlider');
const currentDifficultyLabel = document.getElementById('currentDifficulty');

// 난이도 프리셋
const difficultyPresets = {
    0: { // 쉬움
        name: '🟢 쉬움',
        tolerance: 20,
        holdTime: 1,
        missionCount: 1,
        compassNoise: {
            amplitude: 3,     // 흔들림 작게
            frequency: 0.3,
            complexity: 2
        }
    },
    1: { // 보통
        name: '🟡 보통',
        tolerance: 15,
        holdTime: 2,
        missionCount: 3,
        compassNoise: {
            amplitude: 5,     // 흔들림 중간
            frequency: 0.5,
            complexity: 3
        }
    },
    2: { // 어려움
        name: '🔴 어려움',
        tolerance: 10,
        holdTime: 3,
        missionCount: 5,
        compassNoise: {
            amplitude: 8,     // 흔들림 크게
            frequency: 0.8,
            complexity: 4
        }
    }
};

// 기본 설정
const defaultSettings = {
    difficultyLevel: 0,
    tolerance: 20,
    holdTime: 1,
    missionCount: 1,
    compassNoise: {
        amplitude: 5,
        frequency: 0.5,
        complexity: 3
    }
};

// 난이도 슬라이더 변경 이벤트
difficultySlider.addEventListener('input', (e) => {
    const level = parseInt(e.target.value);
    applyPreset(level);
});

// 프리셋 적용
function applyPreset(level) {
    const preset = difficultyPresets[level];

    // 라벨 업데이트
    currentDifficultyLabel.textContent = preset.name;

    // 입력 필드 업데이트
    document.getElementById('tolerance').value = preset.tolerance;
    document.getElementById('holdTime').value = preset.holdTime;
    document.getElementById('missionCount').value = preset.missionCount;

    // 나침반 흔들림 설정 업데이트
    document.getElementById('noiseAmplitude').value = preset.compassNoise.amplitude;
    document.getElementById('noiseFrequency').value = preset.compassNoise.frequency;
    document.getElementById('noiseComplexity').value = preset.compassNoise.complexity;
}

// 설정 로드
function loadSettings() {
    // 1. 게임별 설정 로드
    const gameSettings = JSON.parse(localStorage.getItem('game16_settings')) || defaultSettings;

    // 난이도 레벨 로드
    const difficultyLevel = gameSettings.difficultyLevel !== undefined ? gameSettings.difficultyLevel : 0;
    difficultySlider.value = difficultyLevel;

    // 세부 설정 로드
    document.getElementById('tolerance').value = gameSettings.tolerance || 20;
    document.getElementById('holdTime').value = gameSettings.holdTime || 1;
    document.getElementById('missionCount').value = gameSettings.missionCount || 1;

    // 현재 난이도 라벨 업데이트
    currentDifficultyLabel.textContent = difficultyPresets[difficultyLevel].name;

    // 나침반 흔들림 설정
    if (gameSettings.compassNoise) {
        document.getElementById('noiseAmplitude').value = gameSettings.compassNoise.amplitude || 5;
        document.getElementById('noiseFrequency').value = gameSettings.compassNoise.frequency || 0.5;
        document.getElementById('noiseComplexity').value = gameSettings.compassNoise.complexity || 3;
    }


}

// 설정 저장
function saveSettings(e) {
    e.preventDefault();

    const difficultyLevel = parseInt(difficultySlider.value);

    // 1. 게임별 설정 저장
    const gameSettings = {
        difficultyLevel: difficultyLevel,
        tolerance: parseInt(document.getElementById('tolerance').value),
        holdTime: parseFloat(document.getElementById('holdTime').value),
        missionCount: parseInt(document.getElementById('missionCount').value),
        compassNoise: {
            amplitude: parseInt(document.getElementById('noiseAmplitude').value),
            frequency: parseFloat(document.getElementById('noiseFrequency').value),
            complexity: parseInt(document.getElementById('noiseComplexity').value)
        },
        lastUpdated: new Date().toISOString()
    };

    localStorage.setItem('game16_settings', JSON.stringify(gameSettings));



    alert('설정이 저장되었습니다!');
}

// 설정 초기화
function resetSettings() {
    if (confirm('모든 설정을 초기화하시겠습니까?')) {
        // 게임별 설정 삭제
        localStorage.removeItem('game16_settings');



        loadSettings();
        alert('초기화되었습니다.');
    }
}

form.addEventListener('submit', saveSettings);
resetBtn.addEventListener('click', resetSettings);

loadSettings();
