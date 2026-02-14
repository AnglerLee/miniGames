// 짝 맞추기 게임 (개선 버전)

const GAME_ID = 'game03';

const cardsGrid = document.getElementById('cardsGrid');
const timerEl = document.getElementById('timer');
const bestRecordEl = document.getElementById('bestRecord');
const hintBtn = document.getElementById('hintBtn');
const fullResetBtn = document.getElementById('fullResetBtn');
const retryBtn = document.getElementById('retryBtn');

// 카드 아이콘
const allIcons = ['🍎', '🍌', '🍇', '🍊', '🍓', '🍉', '🍒', '🍑', '🥝', '🥑', '🍋', '🍍', '🥥', '🍅', '🫐', '🍈', '🍏', '🍐', '🥭', '🌶️', '🌽', '🥕', '🥔', '🥖', '🥨', '🧀', '🥚', '🥞', '🥓', '🍔'];

let cards = [];
let flippedCards = [];
let matchedPairs = 0;
let pairCount = 8;
let initialTimeLimit = 60;
let currentTimeLimit = 60;
let seconds = 0;
let gameStarted = false;
let retryCount = 0;

let hintsLeft = 3;
let canFlip = true;
let timerInterval = null;

// 게임 초기화
function initGame() {
    loadSettings();

    showInstructions(
        '🃏 짝 맞추기',
        [
            '제한 시간 내에 모든 카드의 짝을 맞추세요!',
            '실패 시 재도전하면 시간이 1초 늘어납니다.',
            '설정에서 난이도를 조절할 수 있습니다.',
            '짝을 맞추면 카드는 사라집니다.'
        ],
        startGame
    );
}

// 설정 불러오기
function loadSettings() {
    const settings = JSON.parse(localStorage.getItem('card_match_settings')) || { pairCount: 8, timeLimit: 60 };
    pairCount = parseInt(settings.pairCount);
    initialTimeLimit = parseInt(settings.timeLimit);
    currentTimeLimit = initialTimeLimit;
    retryCount = 0;
}

// 게임 시작
function startGame(isRetry = false) {
    gameStarted = true;
    stopTimer();

    if (!isRetry) {
        // 완전 초기화 (처음부터)
        loadSettings();
        currentTimeLimit = initialTimeLimit;
        retryCount = 0;
    }

    seconds = currentTimeLimit;
    updateTimerDisplay();
    startTimer();

    // 카드 생성
    const selectedIcons = allIcons.slice(0, pairCount);
    // 아이콘이 부족하면 반복해서 채우기
    while (selectedIcons.length < pairCount) {
        selectedIcons.push(allIcons[selectedIcons.length % allIcons.length]);
    }

    const cardPairs = [...selectedIcons, ...selectedIcons];
    cards = shuffleArray(cardPairs).map((icon, index) => ({
        id: index,
        icon: icon,
        flipped: false,
        matched: false
    }));

    matchedPairs = 0;
    flippedCards = [];
    canFlip = true;
    hintsLeft = 3;

    // 그리드 설정
    setupGrid();
    renderCards();
    loadBestRecord();

    hintBtn.disabled = false;
    hintBtn.textContent = `💡 힌트 (${hintsLeft})`;
    retryBtn.style.display = 'none';
}

// 그리드 계산 및 설정 (반응형 대응)
function setupGrid() {
    // CSS Grid Template Columns를 동적으로 조정
    // 모바일 등 좁은 화면에서는 minmax를 줄임
    // 화면 높이/너비에 따라 카드 크기를 계산하여 스크롤 없이 들어가도록 하는 것이 이상적이나,
    // 간단하게 반응형 Grid로 처리.

    // 카드 개수가 많을수록 minmax를 줄여서 한 줄에 많이 들어가게 함
    const minSize = pairCount > 15 ? '40px' : (pairCount > 10 ? '50px' : '65px');
    cardsGrid.style.gridTemplateColumns = `repeat(auto-fit, minmax(${minSize}, 1fr))`;
}

// 타이머 시작 (카운트다운)
function startTimer() {
    if (timerInterval) return;

    timerInterval = setInterval(() => {
        seconds--;
        updateTimerDisplay();

        if (seconds <= 0) {
            handleTimeOver();
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

// 타이머 표시 업데이트
function updateTimerDisplay() {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    if (seconds <= 10) {
        timerEl.parentElement.style.color = 'var(--danger-color)';
    } else {
        timerEl.parentElement.style.color = 'var(--secondary-color)';
    }
}

// 시간 초과 처리
function handleTimeOver() {
    stopTimer();
    gameStarted = false;
    playSound('fail');

    retryBtn.style.display = 'inline-block';

    showConfirmModal(
        '시간 초과! 😓',
        '시간이 다 되었습니다. 1초 더 긴 시간으로 재도전 하시겠습니까?',
        '재도전 (+1초)',
        '홈으로',
        () => retryGame(),
        () => location.href = '../../index.html'
    );
}

// 재도전 (시간 1초 추가)
function retryGame() {
    retryCount++;
    currentTimeLimit = initialTimeLimit + retryCount; // 1초씩 증가
    startGame(true); // Retry 모드로 시작
}

// 카드 렌더링
function renderCards() {
    cardsGrid.innerHTML = '';

    cards.forEach(card => {
        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        cardEl.dataset.id = card.id;

        // 카드 뒤집힘 상태
        if (card.flipped) {
            cardEl.classList.add('flipped');
        }

        // 매칭된 상태
        if (card.matched) {
            cardEl.classList.add('matched');
            cardEl.classList.add('flipped');
        }

        // 카드 내용물 (앞면/뒷면)
        cardEl.innerHTML = `
            <div class="card-face card-back">🎴</div>
            <div class="card-face card-front">${card.icon}</div>
        `;

        cardEl.addEventListener('click', () => handleCardClick(card.id));
        cardsGrid.appendChild(cardEl);
    });
}

// 카드 클릭 처리
function handleCardClick(cardId) {
    if (!canFlip || !gameStarted) return;

    const card = cards.find(c => c.id === cardId);

    if (card.flipped || card.matched) return;

    card.flipped = true;
    flippedCards.push(card);

    // DOM 업데이트 (전체 렌더링 대신 해당 요소만 클래스 추가)
    // 성능 최적화 및 깜빡임 방지
    const cardEl = cardsGrid.querySelector(`.card[data-id="${cardId}"]`);
    if (cardEl) cardEl.classList.add('flipped');

    playSound('click');

    if (flippedCards.length === 2) {
        canFlip = false;
        setTimeout(checkMatch, 600);
    }
}

// 매칭 확인
function checkMatch() {
    const [card1, card2] = flippedCards;

    if (card1.icon === card2.icon) {
        // 매칭 성공
        card1.matched = true;
        card2.matched = true;
        matchedPairs++;

        playSound('success');
        if (navigator.vibrate) navigator.vibrate(50);

        // DOM 업데이트 (matched 클래스 추가)
        const el1 = cardsGrid.querySelector(`.card[data-id="${card1.id}"]`);
        const el2 = cardsGrid.querySelector(`.card[data-id="${card2.id}"]`);
        if (el1) el1.classList.add('matched');
        if (el2) el2.classList.add('matched');

        if (matchedPairs === pairCount) {
            setTimeout(gameComplete, 500);
        }
    } else {
        // 매칭 실패
        card1.flipped = false;
        card2.flipped = false;
        playSound('fail');

        // DOM 업데이트 (flipped 클래스 제거)
        const el1 = cardsGrid.querySelector(`.card[data-id="${card1.id}"]`);
        const el2 = cardsGrid.querySelector(`.card[data-id="${card2.id}"]`);
        if (el1) el1.classList.remove('flipped');
        if (el2) el2.classList.remove('flipped');
    }

    flippedCards = [];
    canFlip = true;
}

// 힌트 기능
function showHint() {
    if (hintsLeft <= 0 || !gameStarted) return;

    hintsLeft--;
    hintBtn.textContent = `💡 힌트 (${hintsLeft})`;
    if (hintsLeft === 0) hintBtn.disabled = true;

    const unmatchedCards = cards.filter(c => !c.matched);
    if (unmatchedCards.length < 2) return;

    const hintPairIcon = unmatchedCards[0].icon;
    const pair = unmatchedCards.filter(c => c.icon === hintPairIcon);

    if (pair.length === 2) {
        // 임시 뒤집기
        pair.forEach(c => {
            const el = cardsGrid.querySelector(`.card[data-id="${c.id}"]`);
            if (el) el.classList.add('flipped');
        });

        canFlip = false;

        setTimeout(() => {
            pair.forEach(c => {
                const el = cardsGrid.querySelector(`.card[data-id="${c.id}"]`);
                if (el && !c.matched && !c.flipped) el.classList.remove('flipped');
            });
            canFlip = true;
        }, 1000);
    }
}

// 최고 기록 표시 (기획 변경으로 인해 설정 정보 표시 제거)
function loadBestRecord() {
    bestRecordEl.style.display = 'none';
}

// 게임 완료
function gameComplete() {
    stopTimer();
    gameStarted = false;

    playSound('success');
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

    // showSuccessScreen(GAME_ID);
    window.parent.postMessage({ type: 'GAME_CLEAR', gameId: GAME_ID }, '*');
}

// 커스텀 확인 모달
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

fullResetBtn.addEventListener('click', () => {
    if (gameStarted) {
        showConfirmModal(
            '재시작 확인',
            '게임을 처음부터 다시 시작하시겠습니까?',
            '예',
            '아니오',
            () => startGame(false),
            null
        );
    } else {
        startGame(false);
    }
});

retryBtn.addEventListener('click', () => {
    if (gameStarted) {
        showConfirmModal(
            '재도전 확인',
            '현재 게임을 중단하고 재도전 하시겠습니까? (초기화)',
            '재도전',
            '취소',
            () => startGame(false),
            null
        );
    } else {
        startGame(false);
    }
});

hintBtn.addEventListener('click', showHint);

initGame();
