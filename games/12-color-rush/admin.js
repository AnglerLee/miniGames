// 관리자 설정 스크립트 (12 Color Rush)
const GAME_ID = 'game12';
const form = document.getElementById('settingsForm');
const resetBtn = document.getElementById('resetBtn');

// 설정 로드
// 설정 로드
function loadSettings() {
    // 1. 게임 설정 로드
    const settings = JSON.parse(localStorage.getItem('color_rush_settings')) || {};

    document.getElementById('timeLimit').value = settings.timeLimit || 20;
    document.getElementById('totalQuestions').value = settings.totalQuestions || 15;
    document.getElementById('passScore').value = settings.passScore || 12;
}

// 설정 저장
// 설정 저장
function saveSettings(e) {
    e.preventDefault();

    const timeLimit = parseInt(document.getElementById('timeLimit').value) || 20;
    const totalQuestions = parseInt(document.getElementById('totalQuestions').value) || 15;
    const passScore = parseInt(document.getElementById('passScore').value) || 12;

    // Validation
    if (passScore > totalQuestions) {
        alert('통과 기준 점수는 총 문제 수보다 클 수 없습니다.');
        return;
    }

    const settings = {
        timeLimit: timeLimit,
        totalQuestions: totalQuestions,
        passScore: passScore,
        lastUpdated: new Date().toISOString()
    };

    localStorage.setItem('color_rush_settings', JSON.stringify(settings));

    alert('설정이 저장되었습니다!');
}

// 설정 초기화
// 설정 초기화
function resetSettings() {
    if (confirm('모든 설정을 초기화하시겠습니까?')) {
        localStorage.removeItem('color_rush_settings');
        loadSettings();
        alert('초기화되었습니다.');
    }
}

form.addEventListener('submit', saveSettings);
resetBtn.addEventListener('click', resetSettings);

loadSettings();
