// 관리자 설정 스크립트 (03 Card Match)
const GAME_ID = 'game03';
const form = document.getElementById('settingsForm');
const resetBtn = document.getElementById('resetBtn');
const pairCountSlider = document.getElementById('pairCountSlider');
const pairCountValue = document.getElementById('pairCountValue');
const timeLimitInput = document.getElementById('timeLimit');

// 슬라이더 값 변경 시 표시 업데이트
pairCountSlider.addEventListener('input', (e) => {
    pairCountValue.textContent = e.target.value;
});

// 설정 로드
function loadSettings() {
    // 1. 글로벌 설정 로드
    const globalConfigs = JSON.parse(localStorage.getItem('treasureHunt_gameConfigs')) || {};
    const myConfig = globalConfigs[GAME_ID] || {};

    document.getElementById('secretCode').value = myConfig.secretCode || '';
    document.getElementById('hintMessage').value = myConfig.hintMessage || '';
    document.getElementById('successMessage').value = myConfig.successMessage || '';

    // 2. 게임별 설정 로드
    const gameSettings = JSON.parse(localStorage.getItem('card_match_settings')) || { pairCount: 12, timeLimit: 60 };
    pairCountSlider.value = gameSettings.pairCount;
    pairCountValue.textContent = gameSettings.pairCount;
    timeLimitInput.value = gameSettings.timeLimit;
}

// 설정 저장
function saveSettings(e) {
    e.preventDefault();

    // 1. 글로벌 설정 저장
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

    // 2. 게임별 설정 저장
    const gameSettings = {
        pairCount: parseInt(pairCountSlider.value),
        timeLimit: parseInt(timeLimitInput.value)
    };
    localStorage.setItem('card_match_settings', JSON.stringify(gameSettings));

    alert('설정이 저장되었습니다!');
}

// 설정 초기화
function resetSettings() {
    if (confirm('모든 설정을 초기화하시겠습니까?')) {
        // 글로벌 설정
        const globalConfigs = JSON.parse(localStorage.getItem('treasureHunt_gameConfigs')) || {};
        if (globalConfigs[GAME_ID]) {
            delete globalConfigs[GAME_ID];
            localStorage.setItem('treasureHunt_gameConfigs', JSON.stringify(globalConfigs));
        }

        // 게임 설정
        localStorage.removeItem('card_match_settings');

        loadSettings();
        alert('초기화되었습니다.');
    }
}

form.addEventListener('submit', saveSettings);
resetBtn.addEventListener('click', resetSettings);

loadSettings();
