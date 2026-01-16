// 에너지 충전 게임 (DeviceMotion API) - 리팩토링 버전

const GAME_ID = 'game13';

// DOM 요소
const energyContainer = document.getElementById('energyContainer');
const batteryIcon = document.getElementById('batteryIcon');
const energyBar = document.getElementById('energyBar');
const shakeIndicator = document.getElementById('shakeIndicator');
const instructionEl = document.getElementById('instruction');
const statusMessageEl = document.getElementById('statusMessage');

// 통계 요소
const energyPercent = document.getElementById('energyPercent');
const timeDisplay = document.getElementById('timeDisplay');
const shakeCountEl = document.getElementById('shakeCount');
const bestRecordEl = document.getElementById('bestRecord');

// 버튼 및 오버레이
const resetBtn = document.getElementById('resetBtn');
const retryBtn = document.getElementById('retryBtn');
const startOverlay = document.getElementById('startOverlay');

// 파티클 컨테이너
const particleContainer = document.getElementById('particleContainer');

// 기본 설정 (Admin에서 불러오지 못했을 때 대비)
let settings = {
    threshold: 30, // 높을수록 어려움
    increment: 3,  // 낮을수록 어려움
    timeLimit: 30,
    theme: 'default'
};

// 게임 상태
let energy = 0;
let shakeCount = 0;
let isCharging = false;
let gameStartTime = 0;
let elapsedTime = 0;
let timeLeft = 0;
let timerInterval = null;
let lastShakeTime = 0;
let lastMilestoneSound = 0;
let retryCount = 0; // 재시도 횟수 (난이도 완화용)

// 초기화
function initGame() {
    loadSettings();
    applyTheme();
    loadBestRecord();

    // 이벤트 리스너 설정
    resetBtn.addEventListener('click', () => {
        retryCount = 0;
        resetGame();
        startGame();
    });

    retryBtn.addEventListener('click', () => {
        retryCount++;
        restartWithEase();
    });

    startOverlay.addEventListener('click', () => {
        requestPermissionAndStart();
    });

    // 자동 시작 시도 (페이지 로드 직후)
    // 약간의 지연을 주어 UI가 렌더링된 후 시작
    setTimeout(() => {
        checkSensorAndStart();
    }, 500);
}

// 설정 불러오기
function loadSettings() {
    const saved = localStorage.getItem('energy_charge_settings');
    if (saved) {
        settings = { ...settings, ...JSON.parse(saved) };
    }
}

// 테마 적용
function applyTheme() {
    document.body.className = `theme-${settings.theme}`;

    // 테마별 CSS 변수 설정 (필요 시)
    const root = document.documentElement;
    if (settings.theme === 'candy') {
        root.style.setProperty('--primary-color', '#ff6b6b');
        root.style.setProperty('--secondary-color', '#ff9ff3');
        root.style.setProperty('--bg-color', '#feca57'); // 예시
    } else if (settings.theme === 'sky') {
        root.style.setProperty('--primary-color', '#48dbfb');
        root.style.setProperty('--secondary-color', '#54a0ff');
        root.style.setProperty('--bg-color', '#c7ecee'); // 예시
    } else {
        // 기본값 복구 (common.css 의존)
        root.style.removeProperty('--primary-color');
        root.style.removeProperty('--secondary-color');
        root.style.removeProperty('--bg-color');
    }
}

// 센서 확인 및 게임 시작 로직
function checkSensorAndStart() {
    if (typeof DeviceMotionEvent === 'undefined') {
        // 센서 미지원 (데스크탑 등) -> 탭 모드로 전환
        statusMessageEl.textContent = '모션 센서가 감지되지 않아 탭 모드로 실행됩니다.';
        startTapMode();
        return;
    }

    // iOS 13+ 권한 확인
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
        // 권한 상태를 알 수 없으므로, 일단 오버레이 표시하여 클릭 유도
        startOverlay.style.display = 'flex';
    } else {
        // 안드로이드 또는 구형 iOS (권한 필요 없음)
        startGame();
    }
}

// 권한 요청 후 시작
async function requestPermissionAndStart() {
    try {
        const permission = await DeviceMotionEvent.requestPermission();
        if (permission === 'granted') {
            startOverlay.style.display = 'none';
            startGame();
        } else {
            alert('센서 권한이 거부되었습니다. 게임을 플레이할 수 없습니다.');
        }
    } catch (e) {
        console.error(e);
        // 에러 발생 시 (e.g. not https) 탭 모드 폴백 가능하면 좋음
        startOverlay.style.display = 'none';
        startGame();
    }
}

// 게임 시작
function startGame() {
    stopGame();

    isCharging = true;
    energy = 0;
    shakeCount = 0;
    gameStartTime = Date.now();
    elapsedTime = 0;
    lastMilestoneSound = 0;

    // 난이도 설정 (재시도 시 완화)
    // 시간 제한: 기본값 + (재시도 횟수 * 2초)
    timeLeft = settings.timeLimit > 0 ? settings.timeLimit + (retryCount * 2) : 0;

    // UI 초기화
    resetBtn.style.display = 'none';
    retryBtn.style.display = 'none';
    instructionEl.textContent = '폰을 신나게 흔드세요!';
    instructionEl.style.color = 'var(--primary-color)';
    statusMessageEl.textContent = retryCount > 0 ? `난이도 조정됨 (+${retryCount * 2}초)` : '';

    batteryIcon.classList.add('charging');
    shakeIndicator.classList.add('shaking');

    updateStats();

    // 센서 연결
    window.addEventListener('devicemotion', handleMotion);

    // 타이머 시작
    if (settings.timeLimit > 0) {
        startTimer();
    } else {
        // 무제한 모드도 시간은 측정
        timerInterval = setInterval(() => {
            elapsedTime = Math.floor((Date.now() - gameStartTime) / 1000);
            updateTimeDisplay();
        }, 100);
    }

    playSound('click');
}

// 이어하기 (난이도 완화)
function restartWithEase() {
    resetGame();
    startGame();
}

// 타이머 로직
function startTimer() {
    updateTimeDisplay();

    timerInterval = setInterval(() => {
        elapsedTime = Math.floor((Date.now() - gameStartTime) / 1000);
        let currentCeiling = settings.timeLimit + (retryCount * 2);
        timeLeft = currentCeiling - elapsedTime;

        updateTimeDisplay();

        if (timeLeft <= 0) {
            timeUp();
        }
    }, 100);
}

function updateTimeDisplay() {
    if (settings.timeLimit > 0) {
        const t = Math.max(0, timeLeft);
        const mins = Math.floor(t / 60);
        const secs = t % 60;
        timeDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        if (t <= 5) timeDisplay.style.color = 'var(--danger-color)';
        else timeDisplay.style.color = 'var(--text-dark)';
    } else {
        const mins = Math.floor(elapsedTime / 60);
        const secs = elapsedTime % 60;
        timeDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

// 모션 핸들러
function handleMotion(event) {
    if (!isCharging) return;

    const acceleration = event.accelerationIncludingGravity;
    if (!acceleration) return;

    const x = Math.abs(acceleration.x || 0);
    const y = Math.abs(acceleration.y || 0);
    const z = Math.abs(acceleration.z || 0);
    const totalAcc = x + y + z;

    // 설정된 임계값 사용
    // threshold: 10(쉬움) ~ 50(어려움)
    // increment: 1(어려움) ~ 10(쉬움)

    const now = Date.now();

    if (totalAcc > settings.threshold && now - lastShakeTime > 100) {
        lastShakeTime = now;
        shakeCount++;

        // 에너지 증가량 계산
        // 세게 흔들수록 보너스
        const intensity = Math.min(2, (totalAcc - settings.threshold) / 10);
        let inc = settings.increment * (1 + intensity);

        energy = Math.min(100, energy + inc);

        updateStats();
        provideHapticFeedback();

        // 화면 효과 (강도에 따라)
        if (Math.random() > 0.7) triggerScreenShake();

        // 마일스톤 사운드
        const milestones = [30, 50, 70, 90];
        for (let m of milestones) {
            if (energy >= m && lastMilestoneSound < m) {
                lastMilestoneSound = m;
                playMilestoneSound(m);
                break;
            }
        }

        if (energy >= 100) {
            completeCharging();
        }
    }
}

// 게임 종료 (성공)
function completeCharging() {
    const finalTime = elapsedTime;
    stopGame();

    instructionEl.textContent = '충전 완료!';
    instructionEl.style.color = 'var(--success-color)';
    batteryIcon.classList.remove('charging');
    shakeIndicator.classList.remove('shaking');

    createCelebrationParticles();
    playSound('success');

    // 기록 저장
    const isNewRecord = saveBestRecord(finalTime, shakeCount);

    setTimeout(() => {
        showSuccessScreen(GAME_ID); // common.js 함수 호출 (모달)

        // 성공 시 재시도 버튼 대신 리셋 버튼 표시
        resetBtn.style.display = 'block';
        retryBtn.style.display = 'none';

        // 문구 변경
        if (isNewRecord) {
            alert(`🎉 신기록 달성!\n${finalTime}초, ${shakeCount}회 흔들기`);
        }
    }, 1000);
}

// 게임 종료 (실패/시간초과)
function timeUp() {
    stopGame();

    instructionEl.textContent = '방전...';
    instructionEl.style.color = 'var(--danger-color)';

    playSound('fail');
    if (navigator.vibrate) navigator.vibrate(500);

    // 재시도 버튼 표시
    resetBtn.style.display = 'block';
    retryBtn.style.display = 'block';

    alert(`시간 초과!\n에너지가 ${Math.floor(energy)}% 까지만 찼습니다.\n\n[이어하기]를 누르면 시간을 조금 더 드려요!`);
}

// 게임 정지 및 정리
function stopGame() {
    isCharging = false;
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    window.removeEventListener('devicemotion', handleMotion);
    window.removeEventListener('click', handleTap); // 탭 모드 제거용

    batteryIcon.classList.remove('charging');
    shakeIndicator.classList.remove('shaking');
}

// 게임 리셋 (UI만)
function resetGame() {
    stopGame();
    energy = 0;
    shakeCount = 0;
    updateStats();
    timeDisplay.textContent = settings.timeLimit > 0 ? `${settings.timeLimit}:00` : '00:00';
}

// 탭 모드 (센서 없을 때 대타)
function startTapMode() {
    instructionEl.textContent = '화면을 빠르게 탭하세요!';
    // 탭 리스너 추가
    window.addEventListener('click', handleTap);
    startGame(); // 게임 로직 시작 (시간 등)
    // 탭 모드용 오버라이드
    window.removeEventListener('devicemotion', handleMotion);
}

function handleTap() {
    if (!isCharging) return;
    shakeCount++;
    energy = Math.min(100, energy + 2); // 탭은 일정량 증가
    updateStats();

    if (energy >= 100) completeCharging();
}

// ==========================================
// 유틸리티 함수들 (기존 유지/수정)
// ==========================================

function updateStats() {
    const p = Math.floor(energy);
    energyPercent.textContent = `${p}%`;
    energyBar.style.width = `${p}%`;
    energyBar.textContent = `${p}%`;
    shakeCountEl.textContent = shakeCount;

    // 색상 변경
    if (p < 30) {
        batteryIcon.textContent = '🪫';
        energyBar.style.background = 'linear-gradient(90deg, #e74c3c, #c0392b)';
    } else if (p < 70) {
        batteryIcon.textContent = '🔋';
        energyBar.style.background = 'linear-gradient(90deg, #f39c12, #e67e22)';
    } else {
        batteryIcon.textContent = '🔋';
        energyBar.style.background = 'linear-gradient(90deg, #2ecc71, #27ae60)';
    }
}

function provideHapticFeedback() {
    if (navigator.vibrate) navigator.vibrate(30);
}

function loadBestRecord() {
    const key = `energy_charge_best`;
    const record = localStorage.getItem(key);
    if (record) {
        bestRecordEl.textContent = `${record}초`;
    } else {
        bestRecordEl.textContent = '-';
    }
}

function saveBestRecord(time, shakes) {
    const key = `energy_charge_best`;
    const current = localStorage.getItem(key);
    let isNew = false;

    if (!current || time < parseFloat(current)) {
        localStorage.setItem(key, time);
        bestRecordEl.textContent = `${time}초`;
        isNew = true;
    }
    return isNew;
}

// 사운드 및 효과 함수들은 기존 로직 재활용 또는 common.js 활용
// (playMilestoneSound, playShakeSound, triggerScreenShake, createCelebrationParticles 등)
// 여기서는 간략화를 위해 주요 로직 포함.

function triggerScreenShake() {
    energyContainer.classList.add('screen-shake');
    setTimeout(() => energyContainer.classList.remove('screen-shake'), 300);
}

function createCelebrationParticles() {
    const colors = ['#f39c12', '#e74c3c', '#2ecc71', '#3498db', '#9b59b6'];
    for (let i = 0; i < 30; i++) {
        setTimeout(() => {
            createParticle(colors[Math.floor(Math.random() * colors.length)]);
        }, i * 50);
    }
}

function createParticle(color) {
    const particle = document.createElement('div');
    particle.style.position = 'fixed';
    particle.style.width = '10px';
    particle.style.height = '10px';
    particle.style.background = color;
    particle.style.borderRadius = '50%';
    particle.style.left = Math.random() * window.innerWidth + 'px';
    particle.style.top = '-20px';
    particle.style.pointerEvents = 'none';
    particle.style.zIndex = '9999';
    particleContainer.appendChild(particle);

    // 간단한 애니메이션
    let y = -20;
    let x = parseFloat(particle.style.left);
    let opacity = 1;

    const speed = 2 + Math.random() * 3;
    const wobble = Math.random() * 2;

    const anim = () => {
        y += speed;
        particle.style.top = y + 'px';
        particle.style.left = x + Math.sin(y / 20) * 10 + 'px';
        opacity -= 0.01;
        particle.style.opacity = opacity;

        if (opacity > 0) requestAnimationFrame(anim);
        else particle.remove();
    };
    requestAnimationFrame(anim);
}

// AudioContext 등 사운드 관련은 common.js의 playSound 사용 가정
// 마일스톤 사운드는 직접 구현 (game.js 기존 코드 참조)
let toneContext = null;
function playMilestoneSound(milestone) {
    if (!toneContext) toneContext = new (window.AudioContext || window.webkitAudioContext)();
    if (toneContext.state === 'suspended') toneContext.resume();

    try {
        const osc = toneContext.createOscillator();
        const gain = toneContext.createGain();
        osc.connect(gain);
        gain.connect(toneContext.destination);

        osc.frequency.value = 400 + (milestone * 5);
        gain.gain.value = 0.1;
        gain.gain.exponentialRampToValueAtTime(0.01, toneContext.currentTime + 0.3);

        osc.start();
        osc.stop(toneContext.currentTime + 0.3);
    } catch (e) { }
}

// 게임 시작 진입점
initGame();
