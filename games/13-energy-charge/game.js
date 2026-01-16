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

// 기본 설정
let settings = {
    threshold: 20,    // 기본값 완화 (30 -> 20)
    increment: 3,
    timeLimit: 30,
    decayRate: 0.5,   // 초당 감소율 (기본값)
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
let decayInterval = null; // 에너지 감소용 타이머
let lastShakeTime = 0;
let lastMilestoneSound = 0;
let retryCount = 0;

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

    // 자동 시작 시도
    setTimeout(() => {
        checkSensorAndStart();
    }, 500);
}

// 설정 불러오기
function loadSettings() {
    const saved = localStorage.getItem('energy_charge_settings');
    if (saved) {
        settings = { ...settings, ...JSON.parse(saved) };
        // decayRate가 없으면 기본값 추가
        if (settings.decayRate === undefined) settings.decayRate = 0.5;
    }
}

// 테마 적용
function applyTheme() {
    document.body.className = `theme-${settings.theme}`;
    const root = document.documentElement;
    if (settings.theme === 'candy') {
        root.style.setProperty('--primary-color', '#ff6b6b');
        root.style.setProperty('--secondary-color', '#ff9ff3');
        root.style.setProperty('--bg-color', '#feca57');
    } else if (settings.theme === 'sky') {
        root.style.setProperty('--primary-color', '#48dbfb');
        root.style.setProperty('--secondary-color', '#54a0ff');
        root.style.setProperty('--bg-color', '#c7ecee');
    } else {
        root.style.removeProperty('--primary-color');
        root.style.removeProperty('--secondary-color');
        root.style.removeProperty('--bg-color');
    }
}

// 센서 확인 및 게임 시작 로직
function checkSensorAndStart() {
    if (typeof DeviceMotionEvent === 'undefined') {
        statusMessageEl.textContent = '모션 센서가 감지되지 않아 탭 모드로 실행됩니다.';
        startTapMode();
        return;
    }

    // iOS 13+ 권한 확인
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
        startOverlay.style.display = 'flex';
    } else {
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
            alert('센서 권한이 거부되었습니다. 탭 모드로 실행합니다.');
            startOverlay.style.display = 'none';
            startTapMode();
        }
    } catch (e) {
        console.error(e);
        startOverlay.style.display = 'none';
        startTapMode();
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
    timeLeft = settings.timeLimit > 0 ? settings.timeLimit + (retryCount * 2) : 0;

    // 재시도 시 에너지 감소 속도 완화 (선택사항, 일단은 유지)

    // UI 초기화
    resetBtn.style.display = 'none';
    retryBtn.style.display = 'none';
    instructionEl.textContent = '방전되지 않게 계속 흔드세요!';
    instructionEl.style.color = 'var(--primary-color)';
    statusMessageEl.textContent = retryCount > 0 ? `난이도 조정됨 (+${retryCount * 2}초)` : '';

    batteryIcon.classList.add('charging');
    shakeIndicator.classList.add('shaking');

    updateStats();

    // 센서 연결
    window.addEventListener('devicemotion', handleMotion);

    // 타이머 (메인 루프)
    if (settings.timeLimit > 0) {
        startTimer();
    } else {
        // 무제한 모드
        timerInterval = setInterval(() => {
            elapsedTime = Math.floor((Date.now() - gameStartTime) / 1000);
            updateTimeDisplay();
            processDecay(); // 감소 로직
        }, 100);
    }

    playSound('click');
}

// 이어하기
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
        processDecay(); // 감소 로직

        if (timeLeft <= 0) {
            timeUp();
        }
    }, 100); // 0.1초마다 실행
}

// 에너지 감소 로직 (0.1초마다 호출됨)
function processDecay() {
    if (!isCharging || energy <= 0) return;

    // 초당 decayRate 만큼 감소 -> 0.1초당 decayRate / 10
    // 예: decayRate가 5(%)라면 0.1초당 0.5% 감소
    const decayPerTick = settings.decayRate / 10;

    // 재시도 시 감소율 완화 (보너스)
    const adjustedDecay = Math.max(0.1, decayPerTick - (retryCount * 0.05));

    energy = Math.max(0, energy - adjustedDecay);
    updateStats();
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

    const acceleration = event.accelerationIncludingGravity; // 중력 포함 가속도 사용
    if (!acceleration) return;

    const x = Math.abs(acceleration.x || 0);
    const y = Math.abs(acceleration.y || 0);
    const z = Math.abs(acceleration.z || 0);
    const totalAcc = x + y + z;

    // threshold Check
    const now = Date.now();

    // 움직임 감지 (너무 자주 업데이트하지 않도록 100ms 제한)
    if (totalAcc > settings.threshold && now - lastShakeTime > 100) {
        lastShakeTime = now;
        shakeCount++;

        // 에너지 증가
        // 임계값 초과분을 강도로 사용
        const intensity = Math.min(3, (totalAcc - settings.threshold) / 5);
        let inc = settings.increment * (1 + intensity * 0.5);

        energy = Math.min(100, energy + inc);

        updateStats();
        provideHapticFeedback();

        if (Math.random() > 0.8) triggerScreenShake();

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

    const isNewRecord = saveBestRecord(finalTime, shakeCount);

    setTimeout(() => {
        showSuccessScreen(GAME_ID);
        resetBtn.style.display = 'block';
        retryBtn.style.display = 'none';

        if (isNewRecord) {
            alert(`🎉 신기록 달성!`);
        }
    }, 1000);
}

// 게임 종료 (실패)
function timeUp() {
    stopGame();

    instructionEl.textContent = '방전됨...';
    instructionEl.style.color = 'var(--danger-color)';

    playSound('fail');
    if (navigator.vibrate) navigator.vibrate(500);

    resetBtn.style.display = 'block';
    retryBtn.style.display = 'block';

    alert(`시간 초과!\n에너지가 유실되었습니다.`);
}

// 게임 정지
function stopGame() {
    isCharging = false;
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    window.removeEventListener('devicemotion', handleMotion);
    window.removeEventListener('click', handleTap);

    batteryIcon.classList.remove('charging');
    shakeIndicator.classList.remove('shaking');
}

// 게임 리셋
function resetGame() {
    stopGame();
    energy = 0;
    shakeCount = 0;
    updateStats();
    timeDisplay.textContent = settings.timeLimit > 0 ? `${settings.timeLimit}:00` : '00:00';
}

// 탭 모드
function startTapMode() {
    instructionEl.textContent = '화면을 빠르게 탭하세요!';
    window.addEventListener('click', handleTap);
    startGame();
    window.removeEventListener('devicemotion', handleMotion);
}

function handleTap() {
    if (!isCharging) return;
    shakeCount++;
    energy = Math.min(100, energy + 3); // 탭 효율
    updateStats();
    if (energy >= 100) completeCharging();
}

// 유틸리티
function updateStats() {
    const p = Math.floor(energy);
    energyPercent.textContent = `${p}%`;
    energyBar.style.width = `${p}%`;
    energyBar.textContent = `${p}%`;
    shakeCountEl.textContent = shakeCount;

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

    let y = -20;
    let x = parseFloat(particle.style.left);
    let opacity = 1;

    const speed = 2 + Math.random() * 3;

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

initGame();
