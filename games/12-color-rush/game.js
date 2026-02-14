// 색깔 스피드 게임

const GAME_ID = 'game12';
let config = {};

// DOM Elements
// const questionNumEl = document.getElementById('questionNum'); // Removed
const correctCountEl = document.getElementById('correctCount');
const colorWordEl = document.getElementById('colorWord');
const yesBtn = document.getElementById('yesBtn');
const noBtn = document.getElementById('noBtn');
const feedbackEl = document.getElementById('feedback');
const timerEl = document.getElementById('timer');
const gameCardEl = document.getElementById('gameCard');



// 색깔 정의
const colors = [
    { name: '빨강', code: '#FF0000', class: 'red' },
    { name: '파랑', code: '#0000FF', class: 'blue' },
    { name: '초록', code: '#008000', class: 'green' }, // 가독성을 위해 조금 어둡게
    { name: '노랑', code: '#FFD700', class: 'yellow' },
    { name: '보라', code: '#800080', class: 'purple' },
    { name: '주황', code: '#FF8C00', class: 'orange' },
    { name: '검정', code: '#000000', class: 'black' },
    { name: '분홍', code: '#FF1493', class: 'pink' }
];

let currentQuestion = 0;
let correctCount = 0;
let isMatch = false;
let isProcessing = false;
let timer = null;
let timeLimit = 20;

let passScore = 12;

// 게임 초기화
function initGame() {
    // 설정 로드
    config = JSON.parse(localStorage.getItem('color_rush_settings')) || {};
    timeLimit = config.timeLimit || 20;
    passScore = config.passScore || 12;

    // 최고 기록 표시 (옵션)
    const bestRecord = storage.get(`${GAME_ID}_best`, null);
    let introText = [
        '화면에 나타나는 색깔 이름을 보세요',
        '글자 색깔과 단어가 일치하면 O, 다르면 X',
        `제한시간 ${timeLimit}초 안에 ${passScore}개 이상 맞추세요!`
    ];

    if (bestRecord) {
        introText.push(`🏆 최고 기록: ${formatTime(bestRecord)}`);
    }

    showInstructions(
        '🌈 색깔 스피드',
        introText,
        startGame
    );
}

// 게임 시작
function startGame() {
    currentQuestion = 0;
    correctCount = 0;
    isProcessing = false;

    timerEl.textContent = formatTime(timeLimit);
    timerEl.classList.remove('warning');

    updateStats();
    showQuestion();
    setupButtons(); // 이벤트 리스너 설정 (한 번만 실행되도록 체크 필요하지만 여기서는 간단히)

    // 타이머 시작
    if (timer) timer.stop();
    timer = createTimer(timeLimit,
        (timeLeft) => {
            timerEl.textContent = formatTime(timeLeft);
            if (timeLeft <= 10) {
                timerEl.classList.add('warning');
            }
        },
        () => {
            endGame(false, 'timeover');
        }
    );
}

// 버튼 설정 - 중복 등록 방지
let listenersAdded = false;
function setupButtons() {
    if (listenersAdded) {
        // 게임 재시작 시 버튼 활성화만
        yesBtn.disabled = false;
        noBtn.disabled = false;
        return;
    }

    // 터치/클릭 통합 이벤트
    addUnifiedEventListener(yesBtn, (e) => {
        // e.preventDefault(); // addUnifiedEventListener 내부에서 처리됨
        handleAnswer(true);
    });

    addUnifiedEventListener(noBtn, (e) => {
        // e.preventDefault();
        handleAnswer(false);
    });

    // 키보드 지원
    document.addEventListener('keydown', (e) => {
        if (yesBtn.disabled || isProcessing) return;

        if (e.key === 'o' || e.key === 'O' || e.key === 'ArrowLeft') {
            handleAnswer(true);
            yesBtn.classList.add('pressed');
            setTimeout(() => yesBtn.classList.remove('pressed'), 100);
        } else if (e.key === 'x' || e.key === 'X' || e.key === 'ArrowRight') {
            handleAnswer(false);
            noBtn.classList.add('pressed');
            setTimeout(() => noBtn.classList.remove('pressed'), 100);
        }
    });

    listenersAdded = true;
    yesBtn.disabled = false;
    noBtn.disabled = false;
}

// 문제 표시
function showQuestion() {
    isProcessing = false;
    feedbackEl.textContent = '';
    feedbackEl.className = 'feedback';
    colorWordEl.classList.remove('pop');

    // 랜덤으로 매칭 여부 결정 (50% 확률)
    isMatch = Math.random() > 0.5;

    // 색깔 이름 선택
    const nameColorIdx = randomInt(0, colors.length - 1);
    const nameColor = colors[nameColorIdx];

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

    // 애니메이션 효과
    void colorWordEl.offsetWidth; // Trigger reflow
    colorWordEl.classList.add('pop');

    // 버튼 활성화
    yesBtn.disabled = false;
    noBtn.disabled = false;
}

// 답변 처리
function handleAnswer(userAnswer) {
    if (isProcessing) return;
    isProcessing = true;

    // 버튼 비활성화 (잠시)
    // yesBtn.disabled = true;
    // noBtn.disabled = true;

    currentQuestion++;

    // 정답 확인
    const correct = (userAnswer === isMatch);

    if (correct) {
        correctCount++;
        feedbackEl.textContent = '정답!';
        feedbackEl.className = 'feedback show correct';
        playSound('success');
    } else {
        feedbackEl.textContent = '땡!';
        feedbackEl.className = 'feedback show wrong';
        playSound('fail');

        // 오답 시 시간 차감
        if (timer) {
            timer.addTime(-1);
            // 즉시 UI 반영
            timerEl.textContent = formatTime(timer.getTimeLeft());
        }

        // 시간 차감 시각적 효과
        showPenaltyEffect();
    }

    updateStats();

    // 목표 달성 체크 (시간 내)
    if (correctCount >= passScore) {
        setTimeout(() => endGame(true), 500);
    } else {
        // 계속 진행
        setTimeout(() => {
            showQuestion();
        }, 150); // 반응 속도를 위해 딜레이 줄임
    }
}

// 통계 업데이트
function updateStats() {
    correctCountEl.textContent = `${correctCount} / ${passScore}`;
}

// 게임 종료
function endGame(isFinished, reason = 'normal') {
    if (timer) timer.stop();
    yesBtn.disabled = true;
    noBtn.disabled = true;

    if (reason === 'timeover') {
        // 시간 초과 처리
        showTimeOverModal();
        return;
    }

    const isSuccess = correctCount >= passScore;

    if (isSuccess) {
        // 성공
        const clearTime = timeLimit - timer.getTimeLeft();

        // 최고 기록 갱신
        const currentBest = storage.get(`${GAME_ID}_best`, 9999);
        if (clearTime < currentBest) {
            storage.set(`${GAME_ID}_best`, clearTime);
        }

        playSound('success');
        setTimeout(() => {
            // showSuccessScreen(GAME_ID);
            window.parent.postMessage({ type: 'GAME_CLEAR', gameId: GAME_ID }, '*');
        }, 500);
    } else {
        // 이곳에는 도달하지 않아야 함 (성공 시에만 endGame(true) 호출하므로)
        // 하지만 혹시 모를 상황을 대비해 실패 처리
        playSound('fail');
        setTimeout(() => {
            showFailScreen(`${correctCount}개 맞췄어요. ${passScore}개 이상 맞춰야 통과해요!`);
        }, 500);
    }
}

// 시간 초과 모달
// 시간 초과 모달
function showTimeOverModal() {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content fade-in">
            <div class="icon">⏰</div>
            <h2>시간 초과!</h2>
            <p>아쉽게도 시간이 다 되었어요.</p>
            <p>현재 점수: ${correctCount} / ${passScore}</p>
            
            <button class="btn btn-warning btn-large" id="retryWithBonusBtn">
                다시 도전 (+2초)
            </button>
        </div>
    `;

    document.body.appendChild(modal);

    // 재도전 버튼 이벤트
    document.getElementById('retryWithBonusBtn').addEventListener('click', () => {
        modal.remove();
        restartWithBonusTime(2);
    });
}

// 보너스 시간으로 재시작
function restartWithBonusTime(seconds) {
    timeLimit += seconds;

    // 명시적 초기화
    correctCount = 0;
    currentQuestion = 0;
    isProcessing = false;
    updateStats();

    startGame();
}

function showPenaltyEffect() {
    // 1. 타이머 붉은색 + 흔들림 효과
    timerEl.classList.add('penalty');
    setTimeout(() => timerEl.classList.remove('penalty'), 500);

    // 2. -1초 플로팅 효과
    const penaltyText = document.createElement('div');
    penaltyText.textContent = '-1초';
    penaltyText.className = 'penalty-float';

    // 타이머 위치 기준으로 배치
    const rect = timerEl.getBoundingClientRect();
    penaltyText.style.left = (rect.left + rect.width / 2) + 'px';
    penaltyText.style.top = rect.top + 'px';

    document.body.appendChild(penaltyText);

    // 애니메이션 후 제거
    setTimeout(() => {
        penaltyText.remove();
    }, 800);
}

// 초기화
initGame();
