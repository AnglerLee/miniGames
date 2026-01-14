// 색깔 스피드 게임

const GAME_ID = 'game12';
const TOTAL_QUESTIONS = 15;
const PASS_SCORE = 12; // 15문제 중 12개 이상 맞춰야 통과

const questionNumEl = document.getElementById('questionNum');
const correctCountEl = document.getElementById('correctCount');
const colorWordEl = document.getElementById('colorWord');
const yesBtn = document.getElementById('yesBtn');
const noBtn = document.getElementById('noBtn');
const feedbackEl = document.getElementById('feedback');

// 색깔 정의
const colors = [
    { name: '빨강', code: '#FF0000' },
    { name: '파랑', code: '#0000FF' },
    { name: '초록', code: '#00FF00' },
    { name: '노랑', code: '#FFD700' },
    { name: '보라', code: '#800080' },
    { name: '주황', code: '#FF8C00' }
];

let currentQuestion = 0;
let correctCount = 0;
let isMatch = false;
let answered = false;

// 게임 초기화
function initGame() {
    showInstructions(
        '🌈 색깔 스피드',
        [
            '화면에 나타나는 색깔 이름을 보세요',
            '글자 색깔과 단어가 일치하면 O, 다르면 X',
            `${TOTAL_QUESTIONS}문제 중 ${PASS_SCORE}개 이상 맞추면 클리어!`
        ],
        startGame
    );
}

// 게임 시작
function startGame() {
    currentQuestion = 0;
    correctCount = 0;
    answered = false;
    
    updateStats();
    showQuestion();
    setupButtons();
}

// 버튼 설정
function setupButtons() {
    yesBtn.addEventListener('click', () => handleAnswer(true));
    noBtn.addEventListener('click', () => handleAnswer(false));
    
    // 키보드 지원
    document.addEventListener('keydown', (e) => {
        if (answered) return;
        
        if (e.key === 'o' || e.key === 'O' || e.key === 'ArrowLeft') {
            handleAnswer(true);
        } else if (e.key === 'x' || e.key === 'X' || e.key === 'ArrowRight') {
            handleAnswer(false);
        }
    });
}

// 문제 표시
function showQuestion() {
    answered = false;
    feedbackEl.textContent = '';
    feedbackEl.className = 'feedback';
    
    // 랜덤으로 매칭 여부 결정 (50% 확률)
    isMatch = Math.random() > 0.5;
    
    // 색깔 이름 선택
    const nameColor = colors[randomInt(0, colors.length - 1)];
    
    let displayColor;
    if (isMatch) {
        // 매칭: 같은 색깔
        displayColor = nameColor;
    } else {
        // 불일치: 다른 색깔
        do {
            displayColor = colors[randomInt(0, colors.length - 1)];
        } while (displayColor.name === nameColor.name);
    }
    
    colorWordEl.textContent = nameColor.name;
    colorWordEl.style.color = displayColor.code;
    
    // 버튼 활성화
    yesBtn.disabled = false;
    noBtn.disabled = false;
}

// 답변 처리
function handleAnswer(userAnswer) {
    if (answered) return;
    
    answered = true;
    currentQuestion++;
    
    // 정답 확인
    const correct = (userAnswer === isMatch);
    
    if (correct) {
        correctCount++;
        feedbackEl.textContent = '정답! 🎉';
        feedbackEl.className = 'feedback correct';
        playSound('success');
        
        if (navigator.vibrate) {
            navigator.vibrate(100);
        }
    } else {
        feedbackEl.textContent = '틀렸어요!';
        feedbackEl.className = 'feedback wrong';
        playSound('fail');
    }
    
    updateStats();
    
    // 버튼 비활성화
    yesBtn.disabled = true;
    noBtn.disabled = true;
    
    // 다음 문제
    setTimeout(() => {
        if (currentQuestion >= TOTAL_QUESTIONS) {
            endGame();
        } else {
            showQuestion();
        }
    }, 1000);
}

// 통계 업데이트
function updateStats() {
    questionNumEl.textContent = `${currentQuestion + 1} / ${TOTAL_QUESTIONS}`;
    correctCountEl.textContent = correctCount;
}

// 게임 종료
function endGame() {
    if (correctCount >= PASS_SCORE) {
        // 통과
        setTimeout(() => {
            showSuccessScreen(GAME_ID);
        }, 500);
    } else {
        // 실패
        setTimeout(() => {
            showFailScreen(`${correctCount}/${TOTAL_QUESTIONS} 맞췄어요. ${PASS_SCORE}개 이상 맞춰야 통과해요!`);
        }, 500);
    }
}

// 게임 시작
initGame();
