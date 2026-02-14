// 관리자 설정 스크립트 (05 Sliding Puzzle)
const GAME_ID = 'game05';
const form = document.getElementById('settingsForm');
const resetBtn = document.getElementById('resetBtn');

const gridSizeSlider = document.getElementById('gridSize');
const gridSizeValue = document.getElementById('gridSizeValue');
const gridSizeValue2 = document.getElementById('gridSizeValue2');
const timeLimitInput = document.getElementById('timeLimit');
const themeSelect = document.getElementById('themeSelect');

// 슬라이더 값 업데이트
gridSizeSlider.addEventListener('input', (e) => {
    gridSizeValue.textContent = e.target.value;
    gridSizeValue2.textContent = e.target.value;
});

// 설정 로드
function loadSettings() {


    // 2. 게임별 설정 로드
    const gameSettings = JSON.parse(localStorage.getItem('sliding_puzzle_settings')) || { gridSize: 3, timeLimit: 120, theme: 'default' };
    gridSizeSlider.value = gameSettings.gridSize;
    gridSizeValue.textContent = gameSettings.gridSize;
    gridSizeValue2.textContent = gameSettings.gridSize;
    timeLimitInput.value = gameSettings.timeLimit;
    themeSelect.value = gameSettings.theme || 'default';
}

// 설정 저장
function saveSettings(e) {
    e.preventDefault();



    // 2. 게임별 설정 저장
    const gameSettings = {
        gridSize: parseInt(gridSizeSlider.value),
        timeLimit: parseInt(timeLimitInput.value),
        theme: themeSelect.value
    };
    localStorage.setItem('sliding_puzzle_settings', JSON.stringify(gameSettings));

    alert('설정이 저장되었습니다!');
}

// 설정 초기화
function resetSettings() {
    if (confirm('모든 설정을 초기화하시겠습니까?')) {


        // 게임별 설정 초기화
        localStorage.removeItem('sliding_puzzle_settings');

        loadSettings();
        alert('초기화되었습니다.');
    }
}

form.addEventListener('submit', saveSettings);
resetBtn.addEventListener('click', resetSettings);

loadSettings();
