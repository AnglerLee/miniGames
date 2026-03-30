// 관리자 설정 스크립트 (18 Color Hunter)
const GAME_ID = 'game18';
const form = document.getElementById('settingsForm');
const resetBtn = document.getElementById('resetBtn');

// 난이도별 프리셋 (colorThreshold: 허용 색조 오차, 단위 = 도)
const difficultyPresets = {
    0: { name: '🟢 쉬움', questionCount: 2, colorThreshold: 45 },
    1: { name: '🟡 보통', questionCount: 3, colorThreshold: 30 },
    2: { name: '🔴 어려움', questionCount: 5, colorThreshold: 20 }
};

// 설정 로드
function loadSettings() {
    const gameSettings = JSON.parse(localStorage.getItem('game18_settings')) || {};
    const difficulty = gameSettings.difficulty !== undefined ? gameSettings.difficulty : 0;

    document.getElementById('difficultySlider').value = difficulty;
    document.getElementById('questionCount').value = gameSettings.questionCount !== undefined ? gameSettings.questionCount : difficultyPresets[difficulty].questionCount;
    document.getElementById('colorThreshold').value = gameSettings.colorThreshold !== undefined ? gameSettings.colorThreshold : difficultyPresets[difficulty].colorThreshold;
}

// 난이도 슬라이더 변경 시 프리셋 로드
function onDifficultyChange() {
    const difficulty = parseInt(document.getElementById('difficultySlider').value);
    const preset = difficultyPresets[difficulty];

    document.getElementById('questionCount').value = preset.questionCount;
    document.getElementById('colorThreshold').value = preset.colorThreshold;
}

// 설정 저장
function saveSettings(e) {
    e.preventDefault();

    const gameSettings = {
        difficulty: parseInt(document.getElementById('difficultySlider').value),
        questionCount: parseInt(document.getElementById('questionCount').value),
        colorThreshold: parseInt(document.getElementById('colorThreshold').value),
        lastUpdated: new Date().toISOString()
    };
    localStorage.setItem('game18_settings', JSON.stringify(gameSettings));

    alert('설정이 저장되었습니다!');
}

// 설정 초기화
function resetSettings() {
    if (confirm('모든 설정을 초기화하시겠습니까?')) {
        localStorage.removeItem('game18_settings');
        loadSettings();
        alert('초기화되었습니다.');
    }
}

// 이벤트 리스너
form.addEventListener('submit', saveSettings);
resetBtn.addEventListener('click', resetSettings);
document.getElementById('difficultySlider').addEventListener('input', onDifficultyChange);

loadSettings();
