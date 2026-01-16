// 관리자 설정 스크립트

const form = document.getElementById('settingsForm');
const resetBtn = document.getElementById('resetBtn');

// 기본 설정값
const DEFAULT_SETTINGS = {
    activeDifficulty: 'easy',
    gameTheme: 'cat',
    timeEasy: 30,
    timeNormal: 60,
    timeHard: 90
};

// 설정 로드
function loadSettings() {
    // 1. 게임 전용 설정 로드
    const settings = JSON.parse(localStorage.getItem('mazeGameSettings')) || DEFAULT_SETTINGS;
    if (!settings.activeDifficulty) settings.activeDifficulty = 'easy';
    if (!settings.gameTheme) settings.gameTheme = 'cat';

    document.getElementById('activeDifficulty').value = settings.activeDifficulty;
    document.getElementById('gameTheme').value = settings.gameTheme;
    document.getElementById('timeEasy').value = settings.timeEasy;
    document.getElementById('timeNormal').value = settings.timeNormal;
    document.getElementById('timeHard').value = settings.timeHard;

    // 2. 글로벌 설정 로드
    const globalConfigs = JSON.parse(localStorage.getItem('treasureHunt_gameConfigs')) || {};
    const myConfig = globalConfigs['game02'] || {};

    document.getElementById('secretCode').value = myConfig.secretCode || '';
    document.getElementById('hintMessage').value = myConfig.hintMessage || '';
    document.getElementById('successMessage').value = myConfig.successMessage || '';
}

// 설정 저장
function saveSettings(e) {
    e.preventDefault();

    // 1. 게임 전용 설정 저장
    const settings = {
        activeDifficulty: document.getElementById('activeDifficulty').value,
        gameTheme: document.getElementById('gameTheme').value,
        timeEasy: parseInt(document.getElementById('timeEasy').value),
        timeNormal: parseInt(document.getElementById('timeNormal').value),
        timeHard: parseInt(document.getElementById('timeHard').value)
    };
    localStorage.setItem('mazeGameSettings', JSON.stringify(settings));

    // 2. 글로벌 설정 저장
    const globalConfigs = JSON.parse(localStorage.getItem('treasureHunt_gameConfigs')) || {};
    globalConfigs['game02'] = {
        secretCode: document.getElementById('secretCode').value.trim(),
        hintMessage: document.getElementById('hintMessage').value.trim(),
        successMessage: document.getElementById('successMessage').value.trim(),
        isActive: true
    };
    localStorage.setItem('treasureHunt_gameConfigs', JSON.stringify(globalConfigs));

    alert('설정이 저장되었습니다!');
}

// 설정 초기화
function resetSettings() {
    if (confirm('모든 설정을 기본값으로 초기화하시겠습니까?')) {
        localStorage.removeItem('mazeGameSettings');
        loadSettings();
        alert('초기화되었습니다.');
    }
}

// 이벤트 리스너
form.addEventListener('submit', saveSettings);
resetBtn.addEventListener('click', resetSettings);

// 초기화 실행
loadSettings();
