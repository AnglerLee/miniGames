const GAME_ID = 'game23';
const dialContainer = document.getElementById('dialContainer');
const dialMarks = document.getElementById('dialMarks');
const dialKnob = document.getElementById('dialKnob');
const currentValueDisplay = document.getElementById('currentValue');
const feedbackText = document.getElementById('feedbackText');
const gameArea = document.querySelector('.game-area');
const unlockBtn = document.getElementById('unlockBtn');

// 0 ~ 100 사이의 랜덤 정답 생성
const secret = Math.floor(Math.random() * 101);
let found = false;
let lastVibrateTime = 0;
let isDragging = false;
let currentDeg = 0;
let previousVal = 0;
let currentVal = 0; // 전역 값 저장

console.log(`[DEBUG] Secret Code: ${secret}`);

// 다이얼 눈금 생성
function createDialMarks() {
    for (let i = 0; i <= 100; i += 5) { // 100분율 눈금
        const deg = (i / 100) * 360;
        const mark = document.createElement('div');
        mark.className = `dial-mark ${i % 10 === 0 ? 'major' : ''}`;
        mark.style.transform = `translateX(-50%) rotate(${deg}deg)`;
        dialMarks.appendChild(mark);
    }
}

// 각도 계산 함수 (중심점 기준)
function getAngle(x, y, cx, cy) {
    const dy = y - cy;
    const dx = x - cx;
    let rad = Math.atan2(dy, dx); // -PI ~ PI
    let deg = rad * (180 / Math.PI);

    // 12시 방향을 0도로 설정하기 위한 보정
    deg = (deg + 90 + 360) % 360;
    return deg;
}

// 값 업데이트 및 피드백 처리
function updateValue(deg) {
    let val = Math.round((deg / 360) * 100);
    if (val === 100) val = 0;

    currentVal = val;
    currentValueDisplay.textContent = val;
    dialKnob.style.transform = `rotate(${deg}deg)`;

    if (val !== previousVal) {
        checkFeedback(val);
        previousVal = val;
    }
}

// 피드백 로직 (Auto Win 제거됨)
function checkFeedback(val) {
    if (found) return;

    const diff = Math.abs(val - secret);

    if (diff === 0) {
        // 정답 위치지만 자동 승리하지 않음. 피드백만 강력하게.
        triggerFeedback([100, 50, 100, 50, 200], 'success');
        // playSound('success'); // 소리는 버튼 누를 때로 이동하거나 여기서는 힌트음만
    } else if (diff <= 5) {
        triggerFeedback([50], 'near');
        playSound('click');
    } else {
        if (val % 5 === 0) {
            triggerFeedback([10]);
            playSound('click');
        }
    }
}

// 진동/시각 피드백
function triggerFeedback(pattern, type = 'normal') {
    const now = Date.now();
    if (now - lastVibrateTime < 100) return;
    lastVibrateTime = now;

    if (navigator.vibrate) navigator.vibrate(pattern);

    gameArea.classList.remove('vibrating', 'near-success');
    void gameArea.offsetWidth; // Reflow

    if (type === 'success') {
        gameArea.classList.add('near-success');
        // 정답이라고 텍스트나 색으로 알려주지 않음 (근접과 동일하게 처리)
        feedbackText.textContent = "가까워지고 있어...";
        feedbackText.style.color = "#ffeb3b";
        feedbackText.style.fontWeight = "bold";
    } else if (type === 'near') {
        gameArea.classList.add('near-success');
        gameArea.classList.add('vibrating');
        feedbackText.textContent = "가까워지고 있어...";
        feedbackText.style.color = "#ffeb3b";
    } else {
        gameArea.classList.add('vibrating');
        feedbackText.textContent = "딸깍...";
        feedbackText.style.color = "rgba(255,255,255,0.8)";
    }

    setTimeout(() => {
        if (!found) gameArea.classList.remove('vibrating');
    }, 200);
}

// 버튼 클릭 핸들러 (수동 승리 조건 체크)
unlockBtn.addEventListener('click', () => {
    if (found) return; // 이미 성공했으면 무시

    const diff = Math.abs(currentVal - secret);

    if (diff === 0) {
        // 성공
        found = true;
        playSound('success');
        // showSuccessScreen(GAME_ID);
        window.parent.postMessage({ type: 'GAME_CLEAR', gameId: GAME_ID }, '*');
    } else {
        // 실패
        triggerError();
        // 안타까운 소리 추가 가능
        playSound('fail');
    }
});

// 실패 연출
function triggerError() {
    gameArea.classList.add('error-flash');
    if (navigator.vibrate) navigator.vibrate(500); // 웅장한 실패 진동
    feedbackText.textContent = "❌ 틀렸습니다! 다시 시도하세요.";
    feedbackText.style.color = "#ff5252";

    setTimeout(() => {
        gameArea.classList.remove('error-flash');
        feedbackText.textContent = "다이얼을 돌려 정답을 찾으세요.";
        feedbackText.style.color = "rgba(255,255,255,0.8)";
    }, 1000);
}


// 입력 이벤트 핸들러
function handleStart(e) {
    if (found) return;
    // unlockBtn 등 다른 요소 클릭 시 드래그 방지
    if (e.target === unlockBtn) return;

    isDragging = true;
    handleMove(e);
}

function handleMove(e) {
    if (!isDragging || found) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const rect = dialContainer.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const deg = getAngle(clientX, clientY, cx, cy);
    currentDeg = deg;
    updateValue(currentDeg);
}

function handleEnd() {
    isDragging = false;
}

// 이벤트 리스너 등록
dialContainer.addEventListener('mousedown', handleStart);
window.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', handleEnd);

dialContainer.addEventListener('touchstart', handleStart);
window.addEventListener('touchmove', handleMove);
window.addEventListener('touchend', handleEnd);

// 초기화
createDialMarks();
showInstructions('🔓 디지털 금고 털이', [
    '다이얼을 돌려 진동이 가장 강한 곳을 찾으세요.',
    '확신이 들면 [OPEN] 버튼을 눌러 잠금을 해제하세요!',
    '느낌을 믿으세요. PC에서는 화면이 흔들립니다.'
]);
