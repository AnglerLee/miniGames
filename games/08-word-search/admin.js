// 관리자 설정 스크립트 (08 Word Search)
const GAME_ID = 'game08';
const form = document.getElementById('settingsForm');
const resetBtn = document.getElementById('resetBtn');

// 설정 로드
function loadSettings() {
    // 1. 게임 설정 로드
    const gameSettings = JSON.parse(localStorage.getItem('word_search_settings')) || {};

    document.getElementById('difficulty').value = gameSettings.difficulty || 'normal';
    document.getElementById('gridSize').value = gameSettings.gridSize || 8;
    document.getElementById('gridSizeDisplay').textContent = `${document.getElementById('gridSize').value}x${document.getElementById('gridSize').value}`;
    document.getElementById('timeLimit').value = gameSettings.timeLimit || 180;
    document.getElementById('theme').value = gameSettings.theme || 'random';
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



    alert('설정이 저장되었습니다!');
}

// 설정 초기화
function resetSettings() {
    if (confirm('모든 설정을 초기화하시겠습니까?')) {
        localStorage.removeItem('word_search_settings');
        loadSettings();
        alert('초기화되었습니다.');
    }
}

form.addEventListener('submit', saveSettings);
resetBtn.addEventListener('click', resetSettings);

loadSettings();
