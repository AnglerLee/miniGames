// 관리자 설정 스크립트 (07 Math Race)
const GAME_ID = 'game07';
const form = document.getElementById('settingsForm');
const resetBtn = document.getElementById('resetBtn');

// 설정 로드
function loadSettings() {


    // 2. 게임별 설정 로드
    const gameSettings = JSON.parse(localStorage.getItem('math_race_settings')) || {};

    document.getElementById('timeLimit').value = gameSettings.timeLimit || 120;
    document.getElementById('difficultySelect').value = gameSettings.difficulty || 'level2';
    document.getElementById('themeSelect').value = gameSettings.theme || 'default';
}

// 설정 저장
function saveSettings(e) {
    e.preventDefault();



    // 2. 게임별 설정 저장
    const gameSettings = {
        timeLimit: parseInt(document.getElementById('timeLimit').value),
        difficulty: document.getElementById('difficultySelect').value,
        theme: document.getElementById('themeSelect').value
    };

    localStorage.setItem('math_race_settings', JSON.stringify(gameSettings));

    alert('설정이 저장되었습니다!');
}

// 설정 초기화
function resetSettings() {
    if (confirm('모든 설정을 초기화하시겠습니까?')) {


        // 게임별 설정 초기화
        localStorage.removeItem('math_race_settings');

        loadSettings();
        alert('초기화되었습니다.');
    }
}

form.addEventListener('submit', saveSettings);
resetBtn.addEventListener('click', resetSettings);

loadSettings();
