// 관리자 설정 스크립트 (18 Color Hunter)
const GAME_ID = 'game18';
const form = document.getElementById('settingsForm');
const resetBtn = document.getElementById('resetBtn');

// 난이도별 프리셋
const difficultyPresets = {
    0: { name: '🟢 쉬움', passCount: 5, colorThreshold: 150 },
    1: { name: '🟡 보통', passCount: 3, colorThreshold: 130 },
    2: { name: '🔴 어려움', passCount: 1, colorThreshold: 100 }
};

// 설정 로드
function loadSettings() {
    // 1. 게임별 설정 로드
    const gameSettings = JSON.parse(localStorage.getItem('game18_settings')) || {};
    const difficulty = gameSettings.difficulty !== undefined ? gameSettings.difficulty : 0;

    document.getElementById('difficultySlider').value = difficulty;
    document.getElementById('passCount').value = gameSettings.passCount !== undefined ? gameSettings.passCount : difficultyPresets[difficulty].passCount;
    document.getElementById('colorThreshold').value = gameSettings.colorThreshold !== undefined ? gameSettings.colorThreshold : difficultyPresets[difficulty].colorThreshold;

    // 2. 글로벌 설정 로드
    const globalConfigs = JSON.parse(localStorage.getItem('treasureHunt_gameConfigs')) || {};
    const myConfig = globalConfigs[GAME_ID] || {};

    document.getElementById('secretCode').value = myConfig.secretCode || '';
    document.getElementById('hintMessage').value = myConfig.hintMessage || '';
    document.getElementById('successMessage').value = myConfig.successMessage || '';
}

// 난이도 슬라이더 변경 시 프리셋 로드
function onDifficultyChange() {
    const difficulty = parseInt(document.getElementById('difficultySlider').value);
    const preset = difficultyPresets[difficulty];

    document.getElementById('passCount').value = preset.passCount;
    document.getElementById('colorThreshold').value = preset.colorThreshold;
}

// 설정 저장
function saveSettings(e) {
    e.preventDefault();

    // 1. 게임별 설정 저장
    const gameSettings = {
        difficulty: parseInt(document.getElementById('difficultySlider').value),
        passCount: parseInt(document.getElementById('passCount').value),
        colorThreshold: parseInt(document.getElementById('colorThreshold').value),
        lastUpdated: new Date().toISOString()
    };
    localStorage.setItem('game18_settings', JSON.stringify(gameSettings));

    // 2. 글로벌 설정 저장
    const globalConfigs = JSON.parse(localStorage.getItem('treasureHunt_gameConfigs')) || {};

    // 기존 설정을 유지하면서 업데이트
    globalConfigs[GAME_ID] = {
        ...globalConfigs[GAME_ID],
        secretCode: document.getElementById('secretCode').value.trim(),
        hintMessage: document.getElementById('hintMessage').value.trim(),
        successMessage: document.getElementById('successMessage').value.trim(),
        isActive: true,
        lastUpdated: new Date().toISOString()
    };

    localStorage.setItem('treasureHunt_gameConfigs', JSON.stringify(globalConfigs));

    alert('설정이 저장되었습니다!');
}

// 설정 초기화
function resetSettings() {
    if (confirm('모든 설정을 초기화하시겠습니까?')) {
        // 게임별 설정 삭제
        localStorage.removeItem('game18_settings');

        // 글로벌 설정에서 해당 게임 데이터 삭제
        const globalConfigs = JSON.parse(localStorage.getItem('treasureHunt_gameConfigs')) || {};
        if (globalConfigs[GAME_ID]) {
            delete globalConfigs[GAME_ID];
            localStorage.setItem('treasureHunt_gameConfigs', JSON.stringify(globalConfigs));
        }

        loadSettings();
        alert('초기화되었습니다.');
    }
}

// 이벤트 리스너
form.addEventListener('submit', saveSettings);
resetBtn.addEventListener('click', resetSettings);
document.getElementById('difficultySlider').addEventListener('input', onDifficultyChange);

loadSettings();
