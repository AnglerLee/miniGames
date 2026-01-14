// 빠른 계산 게임 (개선 버전)

const GAME_ID = 'game07';
const TOTAL_QUESTIONS = 10;
const PASS_SCORE = 8; // 10문제 중 8개 이상 맞춰야 통과

// 난이도 설정
const difficulties = {
    easy: { min: 1, max: 10, time: 40, operators: ['+', '-'] },
    medium: { min: 1, max: 20, time: 30, operators: ['+', '-', '×'] },
    hard: { min: 1, max: 50, time: 25, operators: ['+', '-', '×', '÷'] }
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
const difficultySelector = document.getElementById('difficultySelector');

let currentDifficulty = 'medium';
let currentQuestion = 0;
let correctCount = 0;
let streak = 0;
let maxStreak = 0;
let currentAnswer = 0;
let timeLeft = 30;
let timerInterval = null;
let canAnswer = true;
let gameStarted = false;

// 게임 초기화
function initGame() {
    showInstructions(
        '➕ 빠른 계산',
        [
            '제한 시간 안에 10개의 계산 문제를 푸세요',
            '4개의 선택지 중 정답을 고르세요',
            '8개 이상 맞추면 클리어!',
            '연속으로 맞추면 보너스 점수!'
        ],
        setupGame
    );
}

// 게임 설정
function setupGame() {
    setupDifficultyButtons();
    loadBestScore();
    startGame();
}

// 난이도 버튼 설정
function setupDifficultyButtons() {
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
            startGame();
        });
    });
}

// 게임 시작
function startGame() {
    gameStarted = false;
    stopTimer();
    
    currentQuestion = 0;
    correctCount = 0;
    streak = 0;
    maxStreak = 0;
    timeLeft = difficulties[currentDifficulty].time;
    canAnswer = true;
    
    updateStats();
    loadBestScore();
    showNextQuestion();
}

// 타이머 시작
function startTimer() {
    if (timerInterval) return;
    
    timerInterval = setInterval(() => {
        timeLeft--;
        timerEl.textContent = timeLeft;
        
        if (timeLeft <= 10) {
            timerEl.classList.add('warning');
        }
        
        if (timeLeft <= 0) {
            stopTimer();
            timeUp();
        }
    }, 1000);
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
    
    setTimeout(() => {
        endGame();
    }, 1000);
}

// 다음 문제
function showNextQuestion() {
    if (currentQuestion >= TOTAL_QUESTIONS) {
        stopTimer();
        endGame();
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
    
    // 랜덤 문제 생성
    const { min, max, operators } = difficulties[currentDifficulty];
    const num1 = randomInt(min, max);
    const num2 = randomInt(min, max);
    const operator = operators[Math.floor(Math.random() * operators.length)];
    
    let questionText = '';
    
    switch(operator) {
        case '+':
            currentAnswer = num1 + num2;
            questionText = `${num1} + ${num2} = ?`;
            break;
        case '-':
            // 음수 방지
            if (num1 >= num2) {
                currentAnswer = num1 - num2;
                questionText = `${num1} - ${num2} = ?`;
            } else {
                currentAnswer = num2 - num1;
                questionText = `${num2} - ${num1} = ?`;
            }
            break;
        case '×':
            currentAnswer = num1 * num2;
            questionText = `${num1} × ${num2} = ?`;
            break;
        case '÷':
            // 나누어 떨어지도록
            const divisor = randomInt(2, 10);
            const quotient = randomInt(1, 10);
            currentAnswer = quotient;
            questionText = `${divisor * quotient} ÷ ${divisor} = ?`;
            break;
    }
    
    questionEl.textContent = questionText;
    
    // 선택지 생성
    generateOptions();
    updateStats();
}

// 선택지 생성
function generateOptions() {
    const options = [currentAnswer];
    
    // 오답 3개 생성
    while (options.length < 4) {
        const offset = randomInt(-10, 10);
        const wrongAnswer = currentAnswer + offset;
        
        if (wrongAnswer !== currentAnswer && !options.includes(wrongAnswer) && wrongAnswer >= 0) {
            options.push(wrongAnswer);
        }
    }
    
    // 섞기
    const shuffledOptions = shuffleArray(options);
    
    // 버튼 생성
    answerOptionsEl.innerHTML = '';
    shuffledOptions.forEach(option => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = option;
        btn.addEventListener('click', () => checkAnswer(option, btn));
        answerOptionsEl.appendChild(btn);
    });
}

// 답안 확인
function checkAnswer(userAnswer, btn) {
    if (!canAnswer) return;
    
    canAnswer = false;
    currentQuestion++;
    
    // 모든 버튼 비활성화
    const allBtns = answerOptionsEl.querySelectorAll('.option-btn');
    allBtns.forEach(b => b.style.pointerEvents = 'none');
    
    if (userAnswer === currentAnswer) {
        // 정답
        correctCount++;
        streak++;
        maxStreak = Math.max(maxStreak, streak);
        
        btn.classList.add('correct');
        feedbackEl.textContent = streak > 2 ? `정답! 🔥 ${streak}연속!` : '정답! 🎉';
        feedbackEl.className = 'feedback correct';
        
        playSound('success');
        
        if (navigator.vibrate) {
            navigator.vibrate(100);
        }
    } else {
        // 오답
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
        
        if (navigator.vibrate) {
            navigator.vibrate(200);
        }
    }
    
    updateStats();
    
    setTimeout(() => {
        showNextQuestion();
    }, 1200);
}

// 통계 업데이트
function updateStats() {
    questionNumEl.textContent = `${currentQuestion + 1}/${TOTAL_QUESTIONS}`;
    correctCountEl.textContent = correctCount;
    streakEl.textContent = streak;
    
    // 진행률 바
    const progress = ((currentQuestion) / TOTAL_QUESTIONS) * 100;
    progressBarEl.style.width = `${progress}%`;
}

// 최고 기록 불러오기
function loadBestScore() {
    const recordKey = `math_race_best_${currentDifficulty}`;
    const bestCorrect = localStorage.getItem(recordKey);
    const bestStreak = localStorage.getItem(`${recordKey}_streak`);
    
    if (bestCorrect) {
        bestScoreEl.innerHTML = `최고 기록: <strong>${bestCorrect}/${TOTAL_QUESTIONS}</strong> 정답${bestStreak ? `, ${bestStreak}연속` : ''}`;
    } else {
        bestScoreEl.textContent = '최고 기록이 없습니다';
    }
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

// 게임 종료
function endGame() {
    gameStarted = false;
    stopTimer();
    canAnswer = false;
    
    const isNewRecord = saveBestScore();
    
    const score = correctCount;
    const percentage = (score / TOTAL_QUESTIONS * 100).toFixed(0);
    
    let message = '';
    if (score >= PASS_SCORE) {
        // 통과
        message = `축하합니다! ${score}/${TOTAL_QUESTIONS} 정답 (${percentage}%)`;
        if (maxStreak > 2) {
            message += `\n최고 연속: ${maxStreak}`;
        }
        if (isNewRecord) {
            message += '\n🎉 신기록 달성!';
        }
        
        playSound('success');
        
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100, 50, 200]);
        }
        
        setTimeout(() => {
            alert(message);
            showSuccessScreen(GAME_ID);
        }, 500);
    } else {
        // 실패
        message = `${score}/${TOTAL_QUESTIONS} 맞췄어요.\n${PASS_SCORE}개 이상 맞춰야 통과해요!`;
        
        setTimeout(() => {
            showFailScreen(message);
        }, 500);
    }
}

// 게임 시작
initGame();
