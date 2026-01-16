// 관리자 설정 스크립트 (12 Color Rush)
const GAME_ID = 'game12';
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

    // 게임별 추가 설정 로드
    document.getElementById('timeLimit').value = myConfig.timeLimit || 20;
    document.getElementById('totalQuestions').value = myConfig.totalQuestions || 15;
    document.getElementById('passScore').value = myConfig.passScore || 12;
}

// 설정 저장
function saveSettings(e) {
    e.preventDefault();

    // 1. 글로벌 설정 저장
    const globalConfigs = JSON.parse(localStorage.getItem('treasureHunt_gameConfigs')) || {};

    const timeLimit = parseInt(document.getElementById('timeLimit').value) || 20;
    const totalQuestions = parseInt(document.getElementById('totalQuestions').value) || 15;
    const passScore = parseInt(document.getElementById('passScore').value) || 12;

    // Validation
    if (passScore > totalQuestions) {
        alert('통과 기준 점수는 총 문제 수보다 클 수 없습니다.');
        return;
    }

    // 기존 설정을 유지하면서 업데이트
    globalConfigs[GAME_ID] = {
        ...globalConfigs[GAME_ID],
        secretCode: document.getElementById('secretCode').value.trim(),
        hintMessage: document.getElementById('hintMessage').value.trim(),
        successMessage: document.getElementById('successMessage').value.trim(),
        timeLimit: timeLimit,
        totalQuestions: totalQuestions,
        passScore: passScore,
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
