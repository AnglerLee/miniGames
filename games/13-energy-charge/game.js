// 에너지 충전 게임 (DeviceMotion API) - 리팩토링 버전 (Mechanics Refined)

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
    threshold: 30,    // 기본 임계값 (설정 가능)
    increment: 0.5,   // 충전 속도 (기본 0.5%)
    timeLimit: 30,
    decayRate: 0.5,   // 기본 감소율
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
        const parsed = JSON.parse(saved);
        settings = { ...settings, ...parsed };

        // 안전장치
        if (settings.increment > 1.0) settings.increment = 0.5;
        if (settings.increment < 0.1) settings.increment = 0.1;
        if (!settings.threshold) settings.threshold = 30; // Fallback
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

    if (typeof DeviceMotionEvent.requestPermission === 'function') {
        startOverlay.style.display = 'flex';
    } else {
        startGame();
    }
}

async function requestPermissionAndStart() {
    try {
        const permission = await DeviceMotionEvent.requestPermission();
        if (permission === 'granted') {
            startOverlay.style.display = 'none';
            startGame();
        } else {
            alert('센서 권한 필요. 탭 모드 실행.');
            startOverlay.style.display = 'none';
            startTapMode();
        }
    } catch (e) {
        startOverlay.style.display = 'none';
        startTapMode();
    }
}

function startGame() {
    stopGame();

    isCharging = true;
    energy = 0;
    shakeCount = 0;
    gameStartTime = Date.now();
    elapsedTime = 0;
    lastMilestoneSound = 0;

    timeLeft = settings.timeLimit > 0 ? settings.timeLimit + (retryCount * 2) : 0;

    resetBtn.style.display = 'none';
    retryBtn.style.display = 'none';
    instructionEl.textContent = `강도 ${settings.threshold} 이상으로 흔드세요!`;
    instructionEl.style.color = 'var(--primary-color)';
    statusMessageEl.textContent = retryCount > 0 ? `난이도 조정됨 (+${retryCount * 2}초)` : '';

    batteryIcon.classList.add('charging');
    shakeIndicator.classList.add('shaking');

    updateStats();

    window.addEventListener('devicemotion', handleMotion);

    if (settings.timeLimit > 0) {
        startTimer();
    } else {
        timerInterval = setInterval(() => {
            elapsedTime = Math.floor((Date.now() - gameStartTime) / 1000);
            updateTimeDisplay();
            processDecay();
        }, 100);
    }

    playSound('click');
}

function restartWithEase() {
    resetGame();
    startGame();
}

function startTimer() {
    updateTimeDisplay();

    timerInterval = setInterval(() => {
        elapsedTime = Math.floor((Date.now() - gameStartTime) / 1000);
        let currentCeiling = settings.timeLimit + (retryCount * 2);
        timeLeft = currentCeiling - elapsedTime;

        updateTimeDisplay();
        processDecay();

        if (timeLeft <= 0) {
            timeUp();
        }
    }, 100);
}

// 에너지 감소 로직
function processDecay() {
    if (!isCharging || energy <= 0) return;

    let decayPerTick = settings.decayRate / 10;
    const weightFactor = 1 + (energy / 100);

    let finalDecay = decayPerTick * weightFactor;

    if (retryCount > 0) {
        finalDecay *= 0.9;
    }

    energy = Math.max(0, energy - finalDecay);
    updateStats();
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

    const now = Date.now();

    // Configurable Threshold 사용
    if (totalAcc > settings.threshold && now - lastShakeTime > 80) {
        lastShakeTime = now;
        shakeCount++;

        let inc = settings.increment;

        // 강도 보너스 (Threshold + 10 이상이면 약간 보너스)
        if (totalAcc > settings.threshold + 10) inc *= 1.2;

        energy = Math.min(100, energy + inc);

        updateStats();

        if (shakeCount % 5 === 0) provideHapticFeedback();

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
        // showSuccessScreen(GAME_ID);
        window.parent.postMessage({ type: 'GAME_CLEAR', gameId: GAME_ID }, '*');

        resetBtn.style.display = 'block';
        retryBtn.style.display = 'none';

        if (isNewRecord) {
            alert(`🎉 신기록 달성!`);
        }
    }, 1000);
}

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

function resetGame() {
    stopGame();
    energy = 0;
    shakeCount = 0;
    updateStats();
    timeDisplay.textContent = settings.timeLimit > 0 ? `${settings.timeLimit}:00` : '00:00';
}

function startTapMode() {
    instructionEl.textContent = '화면을 빠르게 탭하세요!';
    window.addEventListener('click', handleTap);
    startGame();
    window.removeEventListener('devicemotion', handleMotion);
}

function handleTap() {
    if (!isCharging) return;
    shakeCount++;
    energy = Math.min(100, energy + (settings.increment * 2));
    updateStats();
    if (energy >= 100) completeCharging();
}

// ---------------------------------------------------------
// 유틸리티
// ---------------------------------------------------------

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

function provideHapticFeedback() {
    if (navigator.vibrate) navigator.vibrate(10);
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
