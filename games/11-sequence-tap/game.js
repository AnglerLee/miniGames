// 순서대로 터치하기 게임 (개선 버전)

const GAME_ID = 'game11';
const TOTAL_NUMBERS = 20; // 1부터 20까지
const TIME_LIMIT = 20; // 20초

const nextNumberEl = document.getElementById('nextNumber');
const timerEl = document.getElementById('timer');
const tapArea = document.getElementById('tapArea');
const messageEl = document.getElementById('message');

let currentNumber = 1;
let timeLeft = TIME_LIMIT;
let timerInterval = null;
let buttons = [];
let startTime = 0;

// 게임 초기화
function initGame() {
    showInstructions(
        '🔢 순서대로 터치하기',
        [
            '화면에 무작위로 배치된 숫자들이 있어요',
            '1부터 순서대로 빠르게 터치하세요',
            `${TIME_LIMIT}초 안에 모두 눌러야 클리어!`,
            '집중력과 순발력이 필요해요!'
        ],
        startGame
    );
}

// 게임 시작
function startGame() {
    currentNumber = 1;
    timeLeft = TIME_LIMIT;
    buttons = [];
    startTime = Date.now();
    
    updateNextNumber();
    createButtons();
    startTimer();
}

// 버튼 생성
function createButtons() {
    tapArea.innerHTML = '<div class="message" id="message">1부터 순서대로 눌러주세요!</div>';
    
    // 1부터 20까지의 숫자 배치
    for (let i = 1; i <= TOTAL_NUMBERS; i++) {
        const button = document.createElement('div');
        button.className = 'tap-button';
        button.textContent = i;
        button.dataset.number = i;
        
        // 겹치지 않게 랜덤 위치 설정
        let validPosition = false;
        let left, top;
        let attempts = 0;
        
        while (!validPosition && attempts < 50) {
            left = randomInt(5, 85);
            top = randomInt(10, 80);
            
            // 다른 버튼과 너무 가까운지 확인
            validPosition = true;
            for (let existing of buttons) {
                const distance = Math.sqrt(
                    Math.pow(existing.left - left, 2) + 
                    Math.pow(existing.top - top, 2)
                );
                if (distance < 12) {
                    validPosition = false;
                    break;
                }
            }
            attempts++;
        }
        
        button.style.left = `${left}%`;
        button.style.top = `${top}%`;
        button.style.transform = 'translate(-50%, -50%)';
        
        buttons.push({ left, top, element: button });
        
        // 클릭 이벤트
        button.addEventListener('click', () => handleTap(i, button));
        
        tapArea.appendChild(button);
    }
    
    // 메시지를 최상단으로
    const msg = document.getElementById('message');
    if (msg) {
        msg.style.position = 'relative';
        msg.style.zIndex = '10';
    }
}

// 타이머 시작
function startTimer() {
    timerInterval = setInterval(() => {
        timeLeft--;
        timerEl.textContent = timeLeft;
        
        if (timeLeft <= 5) {
            timerEl.classList.add('time-warning');
        }
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            gameOver();
        }
    }, 1000);
}

// 탭 처리
function handleTap(number, button) {
    if (number === currentNumber) {
        // 정답
        button.classList.add('tapped');
        currentNumber++;
        updateNextNumber();
        
        playSound('click');
        
        if (navigator.vibrate) {
            navigator.vibrate(30);
        }
        
        // 모두 눌렀는지 확인
        if (currentNumber > TOTAL_NUMBERS) {
            clearInterval(timerInterval);
            gameComplete();
        }
    } else {
        // 오답
        button.classList.add('wrong');
        playSound('fail');
        
        if (navigator.vibrate) {
            navigator.vibrate(200);
        }
        
        setTimeout(() => {
            button.classList.remove('wrong');
        }, 500);
    }
}

// 다음 번호 업데이트
function updateNextNumber() {
    nextNumberEl.textContent = currentNumber;
}

// 게임 오버
function gameOver() {
    showFailScreen(`${currentNumber - 1}개까지 눌렀어요! 시간 내에 모두 눌러야 통과해요.`);
}

// 게임 완료
function gameComplete() {
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const remainingTime = timeLeft;
    
    playSound('success');
    
    if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 200]);
    }
    
    setTimeout(() => {
        alert(`축하합니다!\n소요 시간: ${elapsedTime}초\n남은 시간: ${remainingTime}초`);
        showSuccessScreen(GAME_ID);
    }, 500);
}

// 게임 시작
initGame();
