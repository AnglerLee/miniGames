// 관리자 설정 스크립트 (08 Word Search)
const GAME_ID = 'game08';
const form = document.getElementById('settingsForm');
const resetBtn = document.getElementById('resetBtn');

// 설정 로드
function loadSettings() {
    // 1. 글로벌 설정 로드
    const globalConfigs = JSON.parse(localStorage.getItem('treasureHunt_gameConfigs')) || {};
    const myConfig = globalConfigs[GAME_ID] || {};

    // 게임 전용 설정
    document.getElementById('difficulty').value = myConfig.difficulty || 'normal';
    document.getElementById('gridSize').value = myConfig.gridSize || 8;
    document.getElementById('gridSizeDisplay').textContent = `${document.getElementById('gridSize').value}x${document.getElementById('gridSize').value}`;
    document.getElementById('timeLimit').value = myConfig.timeLimit || 180;
    document.getElementById('theme').value = myConfig.theme || 'random';

    // 공통 설정
    document.getElementById('secretCode').value = myConfig.secretCode || '';
    document.getElementById('hintMessage').value = myConfig.hintMessage || '';
    document.getElementById('successMessage').value = myConfig.successMessage || '';
}

// 난이도 프리셋 변경 핸들러
document.getElementById('difficulty').addEventListener('change', function (e) {
    const minTime = 60; // 최소 시간 
    switch (e.target.value) {
        case 'easy':
            document.getElementById('gridSize').value = 6;
            document.getElementById('timeLimit').value = 180;
            break;
        case 'normal':
            document.getElementById('gridSize').value = 8;
            document.getElementById('timeLimit').value = 180;
            break;
        case 'hard':
            document.getElementById('gridSize').value = 10;
            document.getElementById('timeLimit').value = 120;
            break;
        case 'custom':
            // 커스텀은 현재 값 유지
            break;
    }
    document.getElementById('gridSizeDisplay').textContent = `${document.getElementById('gridSize').value}x${document.getElementById('gridSize').value}`;
});

// 커스텀 값 변경 시 난이도 'custom'으로 변경
['gridSize', 'timeLimit'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
        document.getElementById('difficulty').value = 'custom';
    });
});

// 설정 저장
function saveSettings(e) {
    e.preventDefault();

    // 1. 글로벌 설정 저장
    const globalConfigs = JSON.parse(localStorage.getItem('treasureHunt_gameConfigs')) || {};

    // 기존 설정을 유지하면서 업데이트
    globalConfigs[GAME_ID] = {
        ...globalConfigs[GAME_ID],
        // 게임 전용 설정
        difficulty: document.getElementById('difficulty').value,
        gridSize: parseInt(document.getElementById('gridSize').value),
        timeLimit: parseInt(document.getElementById('timeLimit').value),
        theme: document.getElementById('theme').value,

        // 공통 설정
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
        // 글로벌 설정에서 해당 게임 데이터만 초기화하려면 신중해야 함.
        // 여기서는 입력 필드만 비우거나, 저장된 데이터를 삭제할 수 있음.

        const globalConfigs = JSON.parse(localStorage.getItem('treasureHunt_gameConfigs')) || {};
        if (globalConfigs[GAME_ID]) {
            delete globalConfigs[GAME_ID];
            localStorage.setItem('treasureHunt_gameConfigs', JSON.stringify(globalConfigs));
        }

        loadSettings();
        alert('초기화되었습니다.');
    }
}

form.addEventListener('submit', saveSettings);
resetBtn.addEventListener('click', resetSettings);

loadSettings();
