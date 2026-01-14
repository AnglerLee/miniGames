const GAME_ID = 'game20';
let currentQuestionIndex = 0;
let score = 0;
let currentQuestions = [];
let gameActive = false;

// DOM Elements
const quizElement = document.getElementById('quiz');
const inputElement = document.getElementById('answerInput');
const resultElement = document.getElementById('result');
const hintElement = document.getElementById('hint');

// Initialize Game
function initGame() {
    // Shuffle and select questions
    currentQuestions = shuffleArray([...EMOJI_QUIZ_DATA]);
    currentQuestionIndex = 0;
    score = 0;
    gameActive = true;

    updateScore();
    showQuestion();

    // Add event listener for Enter key
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
    resultElement.textContent = '';
    resultElement.className = '';
    inputElement.focus();
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
    updateScore();

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

function nextQuestion() {
    currentQuestionIndex++;
    inputElement.disabled = false;

    if (currentQuestionIndex < currentQuestions.length) {
        showQuestion();
    } else {
        finishGame();
    }
}

function finishGame() {
    gameActive = false;
    showSuccessScreen(GAME_ID);
}

function updateScore() {
    const scoreElement = document.getElementById('score');
    if (scoreElement) {
        scoreElement.textContent = `Score: ${score} | ${currentQuestionIndex + 1}/${currentQuestions.length}`;
    }
}

// Start the game when instructions are dismissed
showInstructions('🤔 이모지 넌센스 Quiz',
    [
        '이모지를 보고 연상되는 단어를 맞춰보세요!',
        '정답은 여러 가지일 수 있습니다.',
        '총 20문제가 준비되어 있어요.',
        '틀리면 힌트가 나옵니다.'
    ],
    initGame
);
