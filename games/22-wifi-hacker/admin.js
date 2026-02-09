// 관리자 설정 스크립트 (22 Wifi Hacker)
const GAME_ID = 'game22';
const form = document.getElementById('settingsForm');
const resetBtn = document.getElementById('resetBtn');

// 설정 로드
function loadSettings() {
    // 1. 글로벌 설정 로드
    const globalConfigs = JSON.parse(localStorage.getItem('treasureHunt_gameConfigs')) || {};
    const myConfig = globalConfigs[GAME_ID] || {};

    document.getElementById('secretCode').value = myConfig.secretCode || '';
    document.getElementById('hintMessage').value = myConfig.hintMessage || '';
    document.getElementById('successMessage').value = myConfig.successMessage || '';

    // 2. 게임 고유 설정 로드
    const gameConfig = JSON.parse(localStorage.getItem('game22_config')) || {};
    document.getElementById('missionGoal').value = gameConfig.missionGoal || '🎯 목표: Wi-Fi 비밀번호를 찾아라!';
    document.getElementById('targetName').value = gameConfig.targetName || 'SECRET_BASE_WIFI';
    document.getElementById('password').value = gameConfig.password || '1234';
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

    // 2. 게임 고유 설정 저장
    const gameConfig = {
        missionGoal: document.getElementById('missionGoal').value.trim(),
        targetName: document.getElementById('targetName').value.trim(),
        password: document.getElementById('password').value.trim()
    };
    localStorage.setItem('game22_config', JSON.stringify(gameConfig));

    alert('설정이 저장되었습니다!');
}

// 설정 초기화
function resetSettings() {
    if (confirm('모든 설정을 초기화하시겠습니까?')) {
        // 1. 글로벌 설정 초기화
        const globalConfigs = JSON.parse(localStorage.getItem('treasureHunt_gameConfigs')) || {};
        if (globalConfigs[GAME_ID]) {
            delete globalConfigs[GAME_ID];
            localStorage.setItem('treasureHunt_gameConfigs', JSON.stringify(globalConfigs));
        }

        // 2. 게임 고유 설정 초기화
        localStorage.removeItem('game22_config');

        loadSettings();
        alert('초기화되었습니다.');
    }
}

form.addEventListener('submit', saveSettings);
resetBtn.addEventListener('click', resetSettings);

loadSettings();
