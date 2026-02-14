// 관리자 설정 스크립트 (11 Sequence Tap)
const GAME_ID = 'game11';
const form = document.getElementById('settingsForm');
const resetBtn = document.getElementById('resetBtn');

// 설정 로드
function loadSettings() {
    // 1. 게임 설정 로드 (새로운 키 사용)
    const settings = JSON.parse(localStorage.getItem('sequence_tap_settings')) || {};

    const timeLimit = settings.timeLimit || 20;
    const totalNumbers = settings.totalNumbers || 20;
    const spawnRadius = settings.spawnRadius || 80;

    document.getElementById('timeLimit').value = timeLimit;
    document.getElementById('timeLimitValue').textContent = timeLimit;

    document.getElementById('totalNumbers').value = totalNumbers;
    document.getElementById('totalNumbersValue').textContent = totalNumbers;

    document.getElementById('spawnRadius').value = spawnRadius;
    document.getElementById('spawnRadiusValue').textContent = spawnRadius;
}

// 설정 저장
function saveSettings(e) {
    e.preventDefault();

    const settings = {
        timeLimit: parseInt(document.getElementById('timeLimit').value) || 20,
        totalNumbers: parseInt(document.getElementById('totalNumbers').value) || 20,
        spawnRadius: parseInt(document.getElementById('spawnRadius').value) || 80,
        lastUpdated: new Date().toISOString()
    };

    localStorage.setItem('sequence_tap_settings', JSON.stringify(settings));

    alert('설정이 저장되었습니다!');
}

// 설정 초기화
function resetSettings() {
    if (confirm('모든 설정을 초기화하시겠습니까?')) {
        localStorage.removeItem('sequence_tap_settings');

        loadSettings();
        alert('초기화되었습니다.');
    }
}

form.addEventListener('submit', saveSettings);
resetBtn.addEventListener('click', resetSettings);

loadSettings();
