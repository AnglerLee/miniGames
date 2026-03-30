const GAME_ID = 'game20';
let currentQuestionIndex = 0;
let score = 0;
let currentQuestions = [];
let gameActive = false;
let questionTimer = null;
let currentTimeLimit = 30;
let passesRemaining = 3;
let gameSettings = {};

// DOM Elements
const quizElement = document.getElementById('quiz');
const inputElement = document.getElementById('answerInput');
const resultElement = document.getElementById('result');
const timerElement = document.getElementById('timer');
const passesElement = document.getElementById('passes');
const checkBtn = document.getElementById('checkBtn');
const passBtn = document.getElementById('passBtn');

// 게임 설정 로드
function loadGameSettings() {
    const saved = JSON.parse(localStorage.getItem('game20_settings')) || {};
    gameSettings = {
        timePerQuestion: saved.timePerQuestion || 30,
        totalQuestions: saved.totalQuestions || 20
    };

    currentTimeLimit = gameSettings.timePerQuestion;
    return gameSettings;
}

// Initialize Game
function initGame() {
    // 설정 로드
    loadGameSettings();

    // Shuffle and select questions
    const allQuestions = shuffleArray([...EMOJI_QUIZ_DATA]);
    currentQuestions = allQuestions.slice(0, gameSettings.totalQuestions);

    currentQuestionIndex = 0;
    score = 0;
    passesRemaining = 3;
    gameActive = true;

    updateScore();
    updatePassDisplay();
    showQuestion();

    // Add event listeners
    checkBtn.addEventListener('click', checkAnswer);
    passBtn.addEventListener('click', handlePass);

    inputElement.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            checkAnswer();
        }
    });

    // Focus input on load
    inputElement.focus();
}

function showQuestion() {
    const question = currentQuestions[currentQuestionIndex];
    quizElement.textContent = question.emoji;
    quizElement.classList.remove('pop', 'shake');
    void quizElement.offsetWidth; // Trigger reflow
    quizElement.classList.add('bounceIn');

    inputElement.value = '';
    inputElement.disabled = false;
    resultElement.textContent = '';
    resultElement.className = '';
    inputElement.focus();

    // 타이머 시작
    startQuestionTimer();
    updateScore();
}

function startQuestionTimer() {
    // 기존 타이머 정리
    if (questionTimer) {
        questionTimer.stop();
    }

    questionTimer = createTimer(currentTimeLimit,
        (timeLeft) => {
            const valueSpan = timerElement.querySelector('.value');
            if (valueSpan) {
                valueSpan.textContent = formatTime(timeLeft);
            }

            // 10초 이하 경고
            if (timeLeft <= 10) {
                timerElement.classList.add('warning');
            } else {
                timerElement.classList.remove('warning');
            }
        },
        () => handleTimeOut()
    );
}

function handleTimeOut() {
    gameActive = false;
    if (questionTimer) {
        questionTimer.stop();
    }

    inputElement.disabled = true;

    showFailScreen(
        `⏰ 시간이 초과되었습니다! (제한: ${currentTimeLimit}초)`,
        GAME_ID,
        () => {
            // 재시도 시 시간 +1초
            currentTimeLimit += 1;
            retryCurrentQuestion();
        }
    );
}

function retryCurrentQuestion() {
    gameActive = true;
    inputElement.disabled = false;
    inputElement.value = '';
    inputElement.focus();
    resultElement.textContent = '';

    // 타이머 재시작 (시간 증가됨)
    startQuestionTimer();
}

function checkAnswer() {
    if (!gameActive) return;

    const userAnswer = inputElement.value.trim();
    if (!userAnswer) return;

    const question = currentQuestions[currentQuestionIndex];
    const isCorrect = question.answer.some(ans => userAnswer.includes(ans));

    if (isCorrect) {
        handleCorrect();
    } else {
        handleIncorrect();
    }
}

function handleCorrect() {
    playSound('success');
    quizElement.classList.add('pop');
    resultElement.textContent = '✅ 정답입니다! 아주 훌륭해요!';
    resultElement.style.color = 'var(--success-color)';

    score += 10;

    // 타이머 정지
    if (questionTimer) {
        questionTimer.stop();
    }

    // Disable input temporarily
    inputElement.disabled = true;

    setTimeout(() => {
        nextQuestion();
    }, 1500);
}

function handleIncorrect() {
    playSound('fail');
    quizElement.classList.add('shake');
    setTimeout(() => quizElement.classList.remove('shake'), 400);

    resultElement.textContent = '❌ 다시 생각해보세요. 힌트: ' + currentQuestions[currentQuestionIndex].hint;
    resultElement.style.color = 'var(--error-color)';

    inputElement.value = '';
    inputElement.focus();
}

function handlePass() {
    if (!gameActive || passesRemaining <= 0) return;

    playSound('click');
    passesRemaining--;
    updatePassDisplay();

    // 타이머 정지
    if (questionTimer) {
        questionTimer.stop();
    }

    nextQuestion();
}

function nextQuestion() {
    currentQuestionIndex++;
    inputElement.disabled = false;

    // 시간 제한 리셋 (기본값으로)
    currentTimeLimit = gameSettings.timePerQuestion;

    if (currentQuestionIndex < currentQuestions.length) {
        showQuestion();
    } else {
        finishGame();
    }
}

function finishGame() {
    gameActive = false;
    if (questionTimer) {
        questionTimer.stop();
    }
    // showSuccessScreen(GAME_ID);
    window.parent.postMessage({ type: 'GAME_CLEAR', gameId: GAME_ID }, '*');
}

function updateScore() {
    const scoreElement = document.getElementById('score');
    if (scoreElement) {
        const valueSpan = scoreElement.querySelector('.value');
        if (valueSpan) {
            const current = currentQuestionIndex + 1;
            const total = currentQuestions.length;
            valueSpan.textContent = `${current}/${total}`;
        }
    }
}

function updatePassDisplay() {
    if (passesElement) {
        const valueSpan = passesElement.querySelector('.value');
        if (valueSpan) {
            valueSpan.textContent = `${passesRemaining}`;
        }
    }

    // 패스 버튼 비활성화/활성화
    if (passBtn) {
        passBtn.disabled = (passesRemaining <= 0);
    }
}

// 초기 설정 로드 (instructions 텍스트에 반영하기 위해 미리 호출)
loadGameSettings();

// Start the game when instructions are dismissed
showInstructions('🤔 이모지 넌센스 Quiz',
    [
        '이모지를 보고 연상되는 단어를 맞춰보세요!',
        '정답은 여러 가지일 수 있습니다.',
        `총 ${gameSettings.totalQuestions || 20}문제가 준비되어 있어요.`,
        '틀리면 힌트가 나옵니다.',
        '패스는 3번까지 가능합니다!'
    ],
    initGame
);
