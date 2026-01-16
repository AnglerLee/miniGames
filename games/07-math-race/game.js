// 빠른 계산 게임 (개선 버전)

const GAME_ID = 'game07';
const TOTAL_QUESTIONS = 10;
const PASS_SCORE = 8; // 10문제 중 8개 이상 맞춰야 통과

// 난이도별 설정 기본값
const difficultyDefaults = {
    level1: { min: 1, max: 9, time: 40, label: '덧셈' },
    level2: { min: 1, max: 20, time: 35, label: '덧셈/뺄셈' },
    level3: { min: 2, max: 9, time: 30, label: '구구단' },
    level4: { min: 1, max: 50, time: 30, label: '곱셈' },
    level5: { min: 1, max: 20, time: 25, label: '나눗셈 포함' }
};

const questionNumEl = document.getElementById('questionNum');
const correctCountEl = document.getElementById('correctCount');
const streakEl = document.getElementById('streak');
const timerEl = document.getElementById('timer');
const questionEl = document.getElementById('question');
const answerOptionsEl = document.getElementById('answerOptions');
const feedbackEl = document.getElementById('feedback');
const progressBarEl = document.getElementById('progressBar');
const bestScoreEl = document.getElementById('bestScore');
const resetBtn = document.getElementById('resetBtn');

let currentDifficulty = 'level3'; // Admin에서 로드됨
let currentQuestion = 0;
let correctCount = 0;
let streak = 0;
let maxStreak = 0;
let currentAnswer = 0;
let timeLeft = 30;
let initialTime = 30;
let timerInterval = null;
let canAnswer = true;
let gameStarted = false;
let retryCount = 0;

// 게임 초기화
function initGame() {
    loadSettings();
    // updateDifficultyButtons(); // 제거됨

    showInstructions(
        '➕ 빠른 계산',
        [
            '제한 시간 안에 10개의 계산 문제를 푸세요.',
            '4개의 선택지 중 정답을 고르세요.',
            '8개 이상 맞추면 클리어!',
            '실패 시 재도전하면 시간이 5초 늘어납니다.'
        ],
        startGame
    );
}

// 설정 불러오기
function loadSettings() {
    const settings = JSON.parse(localStorage.getItem('math_race_settings')) || {};

    // 난이도 및 시간 설정 로드
    currentDifficulty = settings.difficulty || 'level3';
    initialTime = parseInt(settings.timeLimit) || 60;

    // 테마 적용
    document.body.className = '';
    if (settings.theme && settings.theme !== 'default') {
        document.body.classList.add(`theme-${settings.theme}`);
    }
}

// 난이도 버튼 UI 업데이트
function updateDifficultyButtons() {
    const buttons = difficultySelector.querySelectorAll('.difficulty-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (gameStarted) {
                if (!confirm('게임을 다시 시작하시겠습니까?')) {
                    return;
                }
            }

            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentDifficulty = btn.dataset.level;

            // 난이도 변경 시 재도전 카운트 초기화
            retryCount = 0;
            startGame();
        });
    });
}


// 게임 시작
function startGame(isRetry = false) {
    gameStarted = false;
    stopTimer();

    if (!isRetry) {
        retryCount = 0;
        loadSettings(); // 설정 다시 로드 (혹시 변경되었을 경우)
    }

    currentQuestion = 0;
    correctCount = 0;
    streak = 0;
    maxStreak = 0;

    // 시간 설정 (기본 시간 + 재도전 보너스)
    timeLeft = initialTime + (isRetry ? retryCount * 5 : 0);

    canAnswer = true;

    updateStats();
    updateTimerDisplay(); // 초기 타이머 표시 (MM:SS)
    // loadBestScore(); // 화면에서 제거됨
    showNextQuestion();
}

// 리셋 버튼
resetBtn.addEventListener('click', () => {
    if (confirm('게임을 처음부터 다시 시작하시겠습니까?')) {
        startGame();
    }
});

// 타이머 시작
function startTimer() {
    if (timerInterval) return;

    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay(); // 포맷 적용하여 표시

        if (timeLeft <= 10) {
            timerEl.style.color = 'var(--danger-color)';
        } else {
            timerEl.style.color = '';
        }

        if (timeLeft <= 0) {
            stopTimer();
            timeUp();
        }
    }, 1000);
}

// 타이머 표시 업데이트 (MM:SS 포맷)
function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const seconds = (timeLeft % 60).toString().padStart(2, '0');
    timerEl.textContent = `${minutes}:${seconds}`;
}

// 타이머 정지
function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// 시간 종료
function timeUp() {
    canAnswer = false;
    playSound('fail');

    showConfirmModal(
        '시간 초과! 😓',
        '시간이 부족해요! 5초 더 긴 시간으로 재도전 하시겠습니까?',
        '재도전 (+5초)',
        '홈으로',
        () => retryGame(),
        () => location.href = '../../index.html'
    );
}

// 재도전
function retryGame() {
    retryCount++;
    startGame(true);
}

// 문제 생성
function generateProblem() {
    let num1, num2, operator;
    const defaults = difficultyDefaults[currentDifficulty];

    switch (currentDifficulty) {
        case 'level1': // 덧셈
            num1 = randomInt(1, 50);
            num2 = randomInt(1, 50);
            operator = '+';
            break;

        case 'level2': // 덧셈 + 뺄셈
            operator = Math.random() < 0.5 ? '+' : '-';
            num1 = randomInt(1, 50);
            num2 = randomInt(1, 50);
            break;

        case 'level3': // 덧셈 + 뺄셈 + 구구단
            const rand3 = Math.random();
            if (rand3 < 0.4) operator = '+';
            else if (rand3 < 0.7) operator = '-';
            else operator = '×';

            if (operator === '×') {
                num1 = randomInt(2, 9);
                num2 = randomInt(1, 9);
            } else {
                num1 = randomInt(1, 30);
                num2 = randomInt(1, 30);
            }
            break;

        case 'level4': // 덧셈 + 뺄셈 + 곱셈 (일반)
            const rand4 = Math.random();
            if (rand4 < 0.33) operator = '+';
            else if (rand4 < 0.66) operator = '-';
            else operator = '×';

            if (operator === '×') {
                num1 = randomInt(2, 12);
                num2 = randomInt(2, 9);
            } else {
                num1 = randomInt(10, 50);
                num2 = randomInt(1, 50);
            }
            break;

        case 'level5': // 4칙연산
            const rand5 = Math.random();
            if (rand5 < 0.25) operator = '+';
            else if (rand5 < 0.5) operator = '-';
            else if (rand5 < 0.75) operator = '×';
            else operator = '÷';

            if (operator === '÷') {
                const divisor = randomInt(2, 9);
                const quotient = randomInt(2, 9);
                num1 = divisor * quotient;
                num2 = divisor;
            } else if (operator === '×') {
                num1 = randomInt(2, 15);
                num2 = randomInt(2, 9);
            } else {
                num1 = randomInt(10, 99);
                num2 = randomInt(10, 99);
            }
            break;
    }

    // 계산 및 검증
    if (operator === '+') {
        currentAnswer = num1 + num2;
    } else if (operator === '-') {
        if (num1 < num2) [num1, num2] = [num2, num1]; // 음수 방지
        currentAnswer = num1 - num2;
    } else if (operator === '×') {
        currentAnswer = num1 * num2;
    } else if (operator === '÷') {
        currentAnswer = num1 / num2;
    }

    return `${num1} ${operator} ${num2}`;
}

// 다음 문제
function showNextQuestion() {
    if (currentQuestion >= TOTAL_QUESTIONS) {
        stopTimer();
        gameComplete();
        return;
    }

    // 첫 문제 시작 시 타이머 시작
    if (currentQuestion === 0) {
        gameStarted = true;
        startTimer();
    }

    canAnswer = true;
    feedbackEl.textContent = '';
    feedbackEl.className = 'feedback';

    // 문제 생성
    questionEl.textContent = generateProblem();

    // 선택지 생성
    generateOptions();
    updateStats();
}

// 선택지 생성
function generateOptions() {
    const options = [currentAnswer];

    while (options.length < 4) {
        let offset = randomInt(-10, 10);
        if (offset === 0) offset = 1;

        let wrongAnswer = currentAnswer + offset;

        // 오답도 자연수가 되도록 (나눗셈 경우는 정수 유지)
        if (wrongAnswer < 0) wrongAnswer = Math.abs(wrongAnswer);

        if (wrongAnswer !== currentAnswer && !options.includes(wrongAnswer)) {
            options.push(wrongAnswer);
        }
    }

    const shuffledOptions = shuffleArray(options);

    answerOptionsEl.innerHTML = '';
    shuffledOptions.forEach(option => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = option;
        // 클릭 이벤트 리스너 제거 방식 변경 (익명 함수 대신 직접 호출하되, 클로저 문제 없도록)
        btn.onclick = () => checkAnswer(option, btn);
        answerOptionsEl.appendChild(btn);
    });
}

// 답안 확인
function checkAnswer(userAnswer, btn) {
    if (!canAnswer) return;
    canAnswer = false;
    currentQuestion++;

    // 버튼 비활성화
    const allBtns = answerOptionsEl.querySelectorAll('.option-btn');
    allBtns.forEach(b => b.style.pointerEvents = 'none');

    if (userAnswer === currentAnswer) {
        correctCount++;
        streak++;
        maxStreak = Math.max(maxStreak, streak);

        btn.classList.add('correct');
        feedbackEl.textContent = streak > 2 ? `정답! 🔥 ${streak}연속!` : '정답! 🎉';
        feedbackEl.className = 'feedback correct';
        playSound('success');
        if (navigator.vibrate) navigator.vibrate(50);
    } else {
        streak = 0;
        btn.classList.add('wrong');

        // 정답 표시
        allBtns.forEach(b => {
            if (parseInt(b.textContent) === currentAnswer) {
                b.classList.add('correct');
            }
        });

        feedbackEl.textContent = `틀렸어요! 정답: ${currentAnswer}`;
        feedbackEl.className = 'feedback wrong';
        playSound('fail');
        if (navigator.vibrate) navigator.vibrate(200);
    }

    updateStats();

    setTimeout(showNextQuestion, 1000);
}

// 통계 업데이트
function updateStats() {
    // Hidden fields update if they exist
    if (questionNumEl) questionNumEl.textContent = `${currentQuestion + 1}/${TOTAL_QUESTIONS}`;
    if (correctCountEl) correctCountEl.textContent = correctCount;
    if (streakEl) streakEl.textContent = streak;

    // 진행률 바
    const progress = (currentQuestion / TOTAL_QUESTIONS) * 100;
    if (progressBarEl) progressBarEl.style.width = `${progress}%`;
}

// 최고 기록 불러오기 (사용 안 함)
function loadBestScore() {
    // Hidden logic
}

// 최고 기록 저장
function saveBestScore() {
    const recordKey = `math_race_best_${currentDifficulty}`;
    const bestCorrect = localStorage.getItem(recordKey);

    let isNewRecord = false;

    if (!bestCorrect || correctCount > parseInt(bestCorrect)) {
        localStorage.setItem(recordKey, correctCount);
        localStorage.setItem(`${recordKey}_streak`, maxStreak);
        isNewRecord = true;
    } else if (correctCount === parseInt(bestCorrect)) {
        const bestStreak = localStorage.getItem(`${recordKey}_streak`);
        if (!bestStreak || maxStreak > parseInt(bestStreak)) {
            localStorage.setItem(`${recordKey}_streak`, maxStreak);
            isNewRecord = true;
        }
    }

    return isNewRecord;
}

// 커스텀 모달
function showConfirmModal(title, message, confirmText, cancelText, onConfirm, onCancel) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content fade-in">
            <h2>${title}</h2>
            <p>${message}</p>
            <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
                <button class="btn btn-secondary" id="modalCancelBtn">${cancelText}</button>
                <button class="btn btn-primary" id="modalConfirmBtn">${confirmText}</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('modalConfirmBtn').addEventListener('click', () => {
        modal.remove();
        if (onConfirm) onConfirm();
    });
    document.getElementById('modalCancelBtn').addEventListener('click', () => {
        modal.remove();
        if (onCancel) onCancel();
    });
}

// 게임 완료
function gameComplete() {
    gameStarted = false;
    stopTimer();

    const isNewRecord = saveBestScore();
    const score = correctCount;

    if (score >= PASS_SCORE) {
        playSound('success');
        if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
        setTimeout(() => {
            showSuccessScreen(GAME_ID);
        }, 500);
    } else {
        message = `${score}점... ${PASS_SCORE}점 이상이어야 통과입니다.`;
        setTimeout(() => {
            showFailScreen(message);
        }, 500);
    }
}

initGame();
