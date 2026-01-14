// 짝 맞추기 게임 (개선 버전)

const GAME_ID = 'game03';

const cardsGrid = document.getElementById('cardsGrid');
const movesEl = document.getElementById('moves');
const timerEl = document.getElementById('timer');
const comboEl = document.getElementById('combo');
const comboDisplayEl = document.getElementById('comboDisplay');
const bestRecordEl = document.getElementById('bestRecord');
const hintBtn = document.getElementById('hintBtn');
const resetBtn = document.getElementById('resetBtn');
const difficultySelector = document.getElementById('difficultySelector');

// 카드 아이콘
const allIcons = ['🍎', '🍌', '🍇', '🍊', '🍓', '🍉', '🍒', '🍑', '🥝', '🥑', '🍋', '🍍'];

// 난이도 설정
const difficulties = {
    easy: { pairs: 3, gridClass: 'easy' },
    medium: { pairs: 8, gridClass: 'medium' },
    hard: { pairs: 12, gridClass: 'hard' }
};

let currentDifficulty = 'medium';
let cards = [];
let flippedCards = [];
let matchedPairs = 0;
let moves = 0;
let combo = 0;
let hintsLeft = 3;
let canFlip = true;
let timerInterval = null;
let seconds = 0;
let gameStarted = false;

// 게임 초기화
function initGame() {
    showInstructions(
        '🃏 짝 맞추기',
        [
            '같은 그림의 카드 2장을 찾으세요',
            '연속으로 맞추면 콤보 보너스!',
            '최대한 빠르고 적은 시도로 완성해보세요',
            '난이도를 선택할 수 있어요'
        ],
        setupGame
    );
}

// 게임 설정
function setupGame() {
    setupDifficultyButtons();
    loadBestRecord();
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
    
    const { pairs, gridClass } = difficulties[currentDifficulty];
    const selectedIcons = allIcons.slice(0, pairs);
    
    // 카드 배열 생성 (각 아이콘 2개씩)
    const cardPairs = [...selectedIcons, ...selectedIcons];
    cards = shuffleArray(cardPairs).map((icon, index) => ({
        id: index,
        icon: icon,
        flipped: false,
        matched: false
    }));
    
    // 그리드 클래스 변경
    cardsGrid.className = `cards-grid ${gridClass}`;
    
    matchedPairs = 0;
    moves = 0;
    combo = 0;
    seconds = 0;
    flippedCards = [];
    canFlip = true;
    hintsLeft = 3;
    
    updateStats();
    loadBestRecord();
    renderCards();
    
    hintBtn.disabled = false;
    hintBtn.textContent = `💡 힌트 (${hintsLeft})`;
}

// 타이머 시작
function startTimer() {
    if (timerInterval) return;
    
    timerInterval = setInterval(() => {
        seconds++;
        updateTimerDisplay();
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
}

// 카드 렌더링
function renderCards() {
    cardsGrid.innerHTML = '';
    
    cards.forEach(card => {
        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        cardEl.dataset.id = card.id;
        
        if (card.flipped || card.matched) {
            cardEl.classList.add('flipped');
        }
        
        if (card.matched) {
            cardEl.classList.add('matched');
        }
        
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
    if (!canFlip) return;
    
    const card = cards.find(c => c.id === cardId);
    
    // 이미 뒤집혔거나 매칭된 카드는 무시
    if (card.flipped || card.matched) return;
    
    // 첫 카드 클릭 시 타이머 시작
    if (!gameStarted) {
        gameStarted = true;
        startTimer();
    }
    
    // 카드 뒤집기
    card.flipped = true;
    flippedCards.push(card);
    renderCards();
    
    playSound('click');
    
    // 두 장이 뒤집혔을 때
    if (flippedCards.length === 2) {
        moves++;
        updateStats();
        canFlip = false;
        
        setTimeout(() => {
            checkMatch();
        }, 600);
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
        combo++;
        
        playSound('success');
        
        if (navigator.vibrate) {
            navigator.vibrate(100);
        }
        
        // 콤보 표시
        if (combo > 1) {
            showCombo();
        }
        
        updateStats();
        
        // 모든 짝을 맞췄는지 확인
        const totalPairs = difficulties[currentDifficulty].pairs;
        if (matchedPairs === totalPairs) {
            setTimeout(() => {
                gameComplete();
            }, 500);
        }
    } else {
        // 매칭 실패
        card1.flipped = false;
        card2.flipped = false;
        combo = 0; // 콤보 초기화
        
        playSound('fail');
        
        updateStats();
    }
    
    flippedCards = [];
    canFlip = true;
    renderCards();
}

// 콤보 표시
function showCombo() {
    comboDisplayEl.textContent = `🔥 ${combo} 콤보!`;
    
    setTimeout(() => {
        comboDisplayEl.textContent = '';
    }, 2000);
}

// 힌트 기능
function showHint() {
    if (hintsLeft <= 0 || !gameStarted) return;
    
    hintsLeft--;
    hintBtn.textContent = `💡 힌트 (${hintsLeft})`;
    if (hintsLeft === 0) {
        hintBtn.disabled = true;
    }
    
    // 매칭되지 않은 카드 중 2개를 잠깐 보여줌
    const unmatchedCards = cards.filter(c => !c.matched);
    if (unmatchedCards.length < 2) return;
    
    // 랜덤하게 2개 선택
    const [hintCard1, hintCard2] = shuffleArray(unmatchedCards).slice(0, 2);
    
    hintCard1.flipped = true;
    hintCard2.flipped = true;
    canFlip = false;
    renderCards();
    
    setTimeout(() => {
        hintCard1.flipped = false;
        hintCard2.flipped = false;
        canFlip = true;
        renderCards();
    }, 1500);
}

// 통계 업데이트
function updateStats() {
    movesEl.textContent = moves;
    comboEl.textContent = combo;
}

// 최고 기록 불러오기
function loadBestRecord() {
    const recordKey = `card_match_best_${currentDifficulty}`;
    const bestTime = localStorage.getItem(recordKey);
    const bestMoves = localStorage.getItem(`${recordKey}_moves`);
    
    if (bestTime && bestMoves) {
        const mins = Math.floor(bestTime / 60);
        const secs = bestTime % 60;
        const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        bestRecordEl.innerHTML = `최고 기록: <strong>${timeStr}</strong> (${bestMoves}번 시도)`;
    } else {
        bestRecordEl.textContent = '최고 기록이 없습니다';
    }
}

// 최고 기록 저장
function saveBestRecord() {
    const recordKey = `card_match_best_${currentDifficulty}`;
    const bestTime = localStorage.getItem(recordKey);
    const bestMoves = localStorage.getItem(`${recordKey}_moves`);
    
    let isNewRecord = false;
    
    if (!bestTime || seconds < parseInt(bestTime)) {
        localStorage.setItem(recordKey, seconds);
        localStorage.setItem(`${recordKey}_moves`, moves);
        isNewRecord = true;
    } else if (seconds === parseInt(bestTime) && moves < parseInt(bestMoves)) {
        localStorage.setItem(`${recordKey}_moves`, moves);
        isNewRecord = true;
    }
    
    return isNewRecord;
}

// 게임 완료
function gameComplete() {
    gameStarted = false;
    stopTimer();
    
    const isNewRecord = saveBestRecord();
    
    const performance = moves <= difficulties[currentDifficulty].pairs + 2 ? '완벽해요!' : 
                       moves <= difficulties[currentDifficulty].pairs * 1.5 ? '잘했어요!' : 
                       '성공!';
    
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const timeStr = `${mins}분 ${secs}초`;
    
    if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 200]);
    }
    
    playSound('success');
    
    setTimeout(() => {
        alert(`${performance}\n소요 시간: ${timeStr}\n시도 횟수: ${moves}번${isNewRecord ? '\n🎉 신기록 달성!' : ''}`);
        showSuccessScreen(GAME_ID);
    }, 500);
}

// 리셋 버튼
resetBtn.addEventListener('click', () => {
    if (gameStarted && !confirm('게임을 다시 시작하시겠습니까?')) {
        return;
    }
    startGame();
});

// 힌트 버튼
hintBtn.addEventListener('click', showHint);

// 게임 시작
initGame();
