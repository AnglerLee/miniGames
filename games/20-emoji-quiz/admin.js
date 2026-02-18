// 관리자 설정 스크립트 (20 Emoji Quiz)
const GAME_ID = 'game20';
const form = document.getElementById('settingsForm');
const resetBtn = document.getElementById('resetBtn');

// 난이도 프리셋 정의
const difficultyPresets = {
    0: { name: '😊 쉬움', timePerQuestion: 25, totalQuestions: 15 },
    1: { name: '😐 보통', timePerQuestion: 20, totalQuestions: 20 },
    2: { name: '😰 어려움', timePerQuestion: 15, totalQuestions: 30 }
};

// 난이도 슬라이더 요소
const difficultySlider = document.getElementById('difficultySlider');
const difficultyLabel = document.getElementById('difficultyLabel');
const timePerQuestionInput = document.getElementById('timePerQuestion');
const totalQuestionsInput = document.getElementById('totalQuestions');

// 슬라이더 변경 시 프리셋 적용
difficultySlider.addEventListener('input', function () {
    const level = parseInt(this.value);
    const preset = difficultyPresets[level];

    difficultyLabel.textContent = preset.name;
    timePerQuestionInput.value = preset.timePerQuestion;
    totalQuestionsInput.value = preset.totalQuestions;
});

// 설정 로드
function loadSettings() {



    // 2. 게임별 설정 로드
    const gameSettings = JSON.parse(localStorage.getItem('game20_settings')) || {};

    // 난이도 레벨 복원 (또는 기본값 0)
    const savedDifficulty = gameSettings.difficulty || 0;
    difficultySlider.value = savedDifficulty;
    difficultyLabel.textContent = difficultyPresets[savedDifficulty].name;

    // 세부 설정 복원
    timePerQuestionInput.value = gameSettings.timePerQuestion || 30;
    totalQuestionsInput.value = gameSettings.totalQuestions || 20;
}

// 커스텀 모달 생성 함수
function showCustomModal(message, type = 'success') {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content fade-in">
            <div class="icon" style="font-size: 60px;">${type === 'success' ? '✅' : '❓'}</div>
            <p style="font-size: 18px; margin: 20px 0;">${message}</p>
            <button class="btn btn-primary" onclick="this.closest('.modal').remove()">확인</button>
        </div>
    `;
    document.body.appendChild(modal);

    // 3초 후 자동 제거 (success일 경우만)
    if (type === 'success') {
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 3000);
    }
}

function showConfirmModal(message, onConfirm) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content fade-in">
            <div class="icon" style="font-size: 60px;">⚠️</div>
            <p style="font-size: 18px; margin: 20px 0;">${message}</p>
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button class="btn btn-secondary" id="cancelBtn">취소</button>
                <button class="btn btn-primary" id="confirmBtn">확인</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('cancelBtn').addEventListener('click', () => {
        modal.remove();
    });

    document.getElementById('confirmBtn').addEventListener('click', () => {
        modal.remove();
        onConfirm();
    });
}

// 설정 저장
function saveSettings(e) {
    e.preventDefault();

    const settings = {
        difficulty: parseInt(difficultySlider.value),
        timePerQuestion: parseInt(timePerQuestionInput.value),
        totalQuestions: parseInt(totalQuestionsInput.value)
    };

    localStorage.setItem('game20_settings', JSON.stringify(settings));
    showCustomModal('설정이 저장되었습니다! 🎉', 'success');
}

// 설정 초기화
function resetSettings() {
    showConfirmModal('모든 설정을 초기화하시겠습니까?', () => {
        localStorage.removeItem('game20_settings');

        loadSettings();
        showCustomModal('설정이 초기화되었습니다.', 'success');
    });
}

form.addEventListener('submit', saveSettings);
resetBtn.addEventListener('click', resetSettings);

loadSettings();
