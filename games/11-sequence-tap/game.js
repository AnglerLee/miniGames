// 순서대로 터치하기 게임 (개선 버전)

const GAME_ID = 'game11';
let TOTAL_NUMBERS = 20; // 기본값
let TIME_LIMIT = 20; // 기본값
let SPAWN_RADIUS_PERCENT = 80; // 기본 생성 반경 (%)
let retryCount = 0;
const RETRY_BONUS = 5; // 재도전 시 추가 시간

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
    // 설정 로드
    // 설정 로드
    const settings = JSON.parse(localStorage.getItem('sequence_tap_settings')) || {};

    TOTAL_NUMBERS = settings.totalNumbers || 20;
    TIME_LIMIT = settings.timeLimit || 20;
    SPAWN_RADIUS_PERCENT = settings.spawnRadius || 80;
    retryCount = 0;

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
    // 재도전 횟수에 따라 시간 추가
    timeLeft = TIME_LIMIT + (retryCount * RETRY_BONUS);

    // 타이머 디스플레이 즉시 초기화 (버그 수정)
    timerEl.textContent = timeLeft;

    buttons = [];
    startTime = Date.now();

    createButtons();
    startTimer();
}

// 버튼 생성
function createButtons() {
    tapArea.innerHTML = '<div class="message" id="message">1부터 순서대로 눌러주세요!</div>';

    // 1부터 N까지의 숫자 배치
    const containerWidth = tapArea.clientWidth || 350; // 기본값 안전장치
    const containerHeight = tapArea.clientHeight || 350;

    // 안전한 배치 패딩 (버그 수정: padding 변수 정의)
    const padding = 30; // 가장자리 여유공간

    // 버튼 크기 동적 계산 (개수가 많으면 작게)
    let btnSize = 55;
    if (TOTAL_NUMBERS > 25) {
        btnSize = 45;
    } else if (TOTAL_NUMBERS > 20) {
        btnSize = 50;
    }

    const btnRadius = btnSize / 2;
    // 1/3 이상 겹치지 않게 하려면?
    // 두 원의 중심 거리가 d일 때, d가 2r이면 0% 겹침. d가 0이면 100% 겹침.
    // 1/3 겹침 허용 -> 대략 중심 거리가 지름의 0.8배 이상이면 됨 (약 44px)
    // 55 * 0.8 = 44px. 겹칩 허용 거리
    const minDistance = btnSize * 0.8;

    // 생성 범위 설정 (중점 기준, 개수에 따라 확장)
    // 최대 가용 반경: 컨테이너 크기의 %로 설정 (관리자 설정 연동)
    // padding을 빼는 대신, 단순히 % 비율로 전체 크기 제어
    const radiusScale = SPAWN_RADIUS_PERCENT / 100;

    // 최대 반경 (이 원 밖으로는 나가지 않음)
    const maxRadiusX = (containerWidth / 2) * radiusScale;
    const maxRadiusY = (containerHeight / 2) * radiusScale;

    // 개수에 따른 초기 반경 설정 (밀집도 조절)
    // 20개일 때 거의 꽉 차게(maxRadius), 적으면 중앙에 모이게
    const densityFactor = Math.min(1.0, 0.4 + (Math.sqrt(TOTAL_NUMBERS) / Math.sqrt(30)));
    const currentSpawnRadiusX = Math.max(80, maxRadiusX * densityFactor);
    const currentSpawnRadiusY = Math.max(80, maxRadiusY * densityFactor);

    for (let i = 1; i <= TOTAL_NUMBERS; i++) {
        const button = document.createElement('div');
        button.className = 'tap-button';
        button.textContent = i;
        button.dataset.number = i;

        // 동적 크기 적용
        button.style.width = `${btnSize}px`;
        button.style.height = `${btnSize}px`;
        // 폰트 크기도 살짝 조절
        if (btnSize < 50) {
            button.style.fontSize = '20px';
        }

        let validPosition = false;
        let x, y; // 픽셀 좌표 (중심점 기준 0,0 아님, 컨테이너 left-top 기준)
        let attempts = 0;
        const maxAttempts = 150;

        while (!validPosition && attempts < maxAttempts) {
            // 랜덤 좌표 생성 - 타원형 분포 내 랜덤
            // r^2 분포를 사용하여 중앙보다 외곽까지 골고루 퍼지게 하거나(균등), r 분포로 중앙 집중
            // '게임성'을 위해 약간 중앙에 몰리되 너무 겹치지 않게 -> 균등 분포(Math.sqrt) 사용

            // 시도 횟수가 많아지면 범위를 조금씩 넓혀서 자리 찾기 확률 높임
            const expansion = 1 + (attempts / 100);
            const rangeX = Math.min(maxRadiusX, currentSpawnRadiusX * expansion);
            const rangeY = Math.min(maxRadiusY, currentSpawnRadiusY * expansion);

            const angle = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()); // 균등 분포

            const randomX = Math.cos(angle) * (rangeX * r);
            const randomY = Math.sin(angle) * (rangeY * r);

            x = (containerWidth / 2) + randomX;
            y = (containerHeight / 2) + randomY;

            // 경계 체크 Check Boundary (패딩 고려)
            if (x < btnRadius || x > containerWidth - btnRadius ||
                y < btnRadius || y > containerHeight - btnRadius) {
                attempts++;
                continue;
            }

            // 충돌(거리) 체크 Check Overlap
            validPosition = true;
            for (let existing of buttons) {
                const dist = Math.sqrt(Math.pow(existing.x - x, 2) + Math.pow(existing.y - y, 2));
                if (dist < minDistance) {
                    validPosition = false;
                    break;
                }
            }
            attempts++;
        }

        // 위치를 정 못 찾았을 경우, 전체 영역 내 랜덤 (최후의 수단)
        if (!validPosition) {
            x = randomInt(padding, containerWidth - padding);
            y = randomInt(padding, containerHeight - padding);
        }

        button.style.left = `${x}px`;
        button.style.top = `${y}px`;
        button.style.transform = 'translate(-50%, -50%)'; // 중심점 기준 배치

        // 픽셀 좌표 저장
        buttons.push({ x, y, element: button });

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



// 게임 오버
// 게임 오버 - 커스텀 모달 및 재도전 로직
function gameOver() {
    playSound('fail');

    // 기존 모달 사용하되 내용은 커스텀
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content fade-in">
            <div class="icon" style="font-size: 80px;">😢</div>
            <h2>시간 초과!</h2>
            <p>${currentNumber - 1}개까지 성공했습니다.<br>시간이 조금 더 필요하신가요?</p>
            
            <button class="btn btn-primary btn-large btn-block" id="retryBtn">
                재도전 (+${RETRY_BONUS}초)
            </button>
            <button class="btn btn-secondary btn-block" onclick="location.reload()">
                다시 시작 (초기화)
            </button>
            <button class="btn btn-block" style="margin-top:10px" onclick="location.href='../../index.html'">
                홈으로
            </button>
        </div>
    `;

    document.body.appendChild(modal);

    // 재도전 버튼 이벤트
    document.getElementById('retryBtn').onclick = () => {
        modal.remove();
        retryGame();
    };

    if (navigator.vibrate) {
        navigator.vibrate(200);
    }
}

// 재도전 함수
function retryGame() {
    retryCount++;
    startGame();

    // 토스트 메시지로 보너스 시간 알림
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = 'rgba(0,0,0,0.8)';
    toast.style.color = 'white';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '20px';
    toast.style.zIndex = '2000';
    toast.style.animation = 'fadeIn 0.5s, fadeOut 0.5s 2.5s forwards';
    toast.textContent = `재도전! 시간 +${retryCount * RETRY_BONUS}초 추가됨`;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
}

// 게임 완료
function gameComplete() {
    // 진행 중인 타이머 정지
    if (timerInterval) clearInterval(timerInterval);

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);

    playSound('success');

    if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 200]);
    }

    // 최고 기록 저장
    const bestRecordKey = `bestRecord_${GAME_ID}`;
    const previousBest = parseFloat(localStorage.getItem(bestRecordKey)) || 9999;
    let isNewRecord = false;

    if (parseFloat(elapsedTime) < previousBest) {
        localStorage.setItem(bestRecordKey, elapsedTime);
        isNewRecord = true;
    }

    const currentBest = isNewRecord ? elapsedTime : previousBest;

    // 성공 화면 표시 지연
    setTimeout(() => {
        // 공통 성공 화면 호출
        // showSuccessScreen(GAME_ID);
        window.parent.postMessage({
            type: 'GAME_CLEAR',
            gameId: GAME_ID,
            score: elapsedTime,
            isNewRecord: isNewRecord
        }, '*');

        /*
        // 성공 화면에 결과 정보 추가 (커스텀 인젝션) - 부모 창에서 처리하도록 변경
        const successContent = document.querySelector('.success-screen');
        if (successContent) {
            const resultInfo = document.createElement('div');
            resultInfo.innerHTML = `
                <div style="background: #e8f5e9; padding: 15px; border-radius: 10px; margin: 15px 0;">
                    <p style="margin:5px 0; font-size: 1.2em;">⏱️ 기록: <strong>${elapsedTime}초</strong></p>
                    <p style="margin:5px 0; color: #4CAF50;">🏆 최고 기록: <strong>${currentBest === 9999 ? elapsedTime : currentBest}초</strong></p>
                    ${isNewRecord ? '<p style="color:#ff9800; font-weight:bold;">🎉 신기록 달성! 🎉</p>' : ''}
                </div>
            `;
            // 메시지 아래에 삽입
            const msgEl = successContent.querySelector('.success-message');
            if (msgEl) {
                msgEl.after(resultInfo);
            } else {
                successContent.prepend(resultInfo);
            }
        }
        */
    }, 500);
}

// 게임 시작
initGame();
