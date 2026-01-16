// 에너지 충전 게임 (DeviceMotion API) - 풀 버전

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

// 버튼 요소
const difficultySelector = document.getElementById('difficultySelector');
const modeSelector = document.getElementById('modeSelector');
const sensitivitySlider = document.getElementById('sensitivitySlider');
const sensitivityValue = document.getElementById('sensitivityValue');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');

// 멀티플레이어 요소
const playerInfo = document.getElementById('playerInfo');
const player1Card = document.getElementById('player1Card');
const player2Card = document.getElementById('player2Card');
const player1Record = document.getElementById('player1Record');
const player2Record = document.getElementById('player2Record');

// 파티클 컨테이너
const particleContainer = document.getElementById('particleContainer');

// 난이도 설정
const difficulties = {
    easy: {
        targetEnergy: 100,
        timeLimit: 0, // 무제한
        threshold: 25,
        increment: 4,
        name: '쉬움'
    },
    medium: {
        targetEnergy: 100,
        timeLimit: 60,
        threshold: 30,
        increment: 3,
        name: '보통'
    },
    hard: {
        targetEnergy: 100,
        timeLimit: 30,
        threshold: 35,
        increment: 2,
        name: '어려움'
    }
};

// 게임 상태
let currentDifficulty = 'medium';
let currentMode = 'single'; // 'single' or 'multi'
let sensitivity = 3; // 1-5
let energy = 0;
let shakeCount = 0;
let isCharging = false;
let gameStartTime = 0;
let elapsedTime = 0;
let timeLeft = 0;
let timerInterval = null;
let lastShakeTime = 0;
let lastMilestoneSound = 0;

// 멀티플레이어 상태
let currentPlayer = 1;
let player1Time = 0;
let player2Time = 0;
let multiplayerPhase = 'waiting'; // 'waiting', 'player1', 'player2', 'results'

// 게임 초기화
function initGame() {
    showInstructions(
        '⚡ 에너지 충전',
        [
            '자물쇠의 배터리가 방전됐어요!',
            '폰을 마구 흔들어서 에너지를 충전하세요',
            '난이도와 게임 모드를 선택할 수 있어요',
            '100%가 되면 클리어!'
        ],
        setupGame
    );
}

// 게임 설정
function setupGame() {
    setupDifficultyButtons();
    setupModeButtons();
    setupSensitivitySlider();
    setupActionButtons();
    loadBestRecord();
    updateStats();
}

// 난이도 버튼 설정
function setupDifficultyButtons() {
    const buttons = difficultySelector.querySelectorAll('.difficulty-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (isCharging) return;

            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentDifficulty = btn.dataset.level;
            loadBestRecord();
        });
    });
}

// 모드 버튼 설정
function setupModeButtons() {
    const buttons = modeSelector.querySelectorAll('.mode-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (isCharging) return;

            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = btn.dataset.mode;

            // 멀티플레이어 UI 표시/숨김
            if (currentMode === 'multi') {
                playerInfo.style.display = 'grid';
                player1Record.textContent = '-';
                player2Record.textContent = '-';
                player1Card.classList.remove('active');
                player2Card.classList.remove('active');
            } else {
                playerInfo.style.display = 'none';
            }
        });
    });
}

// 민감도 슬라이더 설정
function setupSensitivitySlider() {
    const labels = ['매우 낮음', '낮음', '보통', '높음', '매우 높음'];

    sensitivitySlider.addEventListener('input', (e) => {
        sensitivity = parseInt(e.target.value);
        sensitivityValue.textContent = `${labels[sensitivity - 1]} (${sensitivity})`;
    });

    // 초기값 설정
    sensitivityValue.textContent = `${labels[sensitivity - 1]} (${sensitivity})`;
}

// 액션 버튼 설정
function setupActionButtons() {
    startBtn.addEventListener('click', () => {
        if (currentMode === 'single') {
            checkSensorSupport();
        } else {
            startMultiplayerGame();
        }
    });

    resetBtn.addEventListener('click', () => {
        stopGame();
        resetGame();
    });
}

// 센서 지원 확인
function checkSensorSupport() {
    if (typeof DeviceMotionEvent === 'undefined') {
        statusMessageEl.textContent = '이 기기는 모션 센서를 지원하지 않습니다';
        statusMessageEl.style.color = 'var(--danger-color)';

        // 대체 모드 제공
        setTimeout(() => {
            if (confirm('센서를 지원하지 않습니다. 화면 탭 모드로 시작하시겠습니까?')) {
                startTapMode();
            }
        }, 1000);
        return;
    }

    // iOS 13+ 권한 요청 필요
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
        requestPermission();
    } else {
        // Android나 이전 iOS
        startGame();
    }
}

// 권한 요청 (iOS 13+)
async function requestPermission() {
    try {
        const permission = await DeviceMotionEvent.requestPermission();
        if (permission === 'granted') {
            startGame();
        } else {
            statusMessageEl.textContent = '센서 권한이 필요합니다';
            statusMessageEl.style.color = 'var(--danger-color)';
        }
    } catch (error) {
        console.error('Permission error:', error);
        startGame(); // fallback
    }
}

// 게임 시작
function startGame() {
    isCharging = true;
    energy = 0;
    shakeCount = 0;
    gameStartTime = Date.now();
    elapsedTime = 0;
    lastMilestoneSound = 0;

    const config = difficulties[currentDifficulty];
    timeLeft = config.timeLimit;

    // UI 업데이트
    startBtn.style.display = 'none';
    resetBtn.style.display = 'block';
    difficultySelector.style.display = 'none';
    modeSelector.style.display = 'none';
    document.getElementById('sensitivityControl').style.display = 'none';

    instructionEl.textContent = '폰을 흔들어주세요!';
    instructionEl.style.color = 'var(--primary-color)';
    statusMessageEl.textContent = '';

    batteryIcon.classList.add('charging');
    shakeIndicator.classList.add('shaking');

    updateStats();

    // 타이머 시작
    if (config.timeLimit > 0) {
        startTimer();
    } else {
        timerInterval = setInterval(() => {
            elapsedTime = Math.floor((Date.now() - gameStartTime) / 1000);
            updateTimeDisplay();
        }, 100);
    }

    // 센서 시작
    window.addEventListener('devicemotion', handleMotion);

    // 시작 사운드
    playSound('click');
}

// 멀티플레이어 게임 시작
function startMultiplayerGame() {
    multiplayerPhase = 'player1';
    currentPlayer = 1;
    player1Time = 0;
    player2Time = 0;

    player1Card.classList.add('active');
    player2Card.classList.remove('active');

    instructionEl.textContent = '플레이어 1 차례!';
    statusMessageEl.textContent = '준비되면 시작하세요';

    checkSensorSupport();
}

// 타이머 시작 (제한 시간 모드)
function startTimer() {
    timerInterval = setInterval(() => {
        elapsedTime = Math.floor((Date.now() - gameStartTime) / 1000);
        timeLeft = difficulties[currentDifficulty].timeLimit - elapsedTime;

        updateTimeDisplay();

        if (timeLeft <= 0) {
            timeUp();
        }
    }, 100);
}

// 타이머 표시 업데이트
function updateTimeDisplay() {
    const config = difficulties[currentDifficulty];

    if (config.timeLimit > 0) {
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        timeDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        if (timeLeft <= 10) {
            timeDisplay.style.color = 'var(--danger-color)';
        }
    } else {
        const mins = Math.floor(elapsedTime / 60);
        const secs = elapsedTime % 60;
        timeDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

// 모션 이벤트 처리
function handleMotion(event) {
    if (!isCharging) return;

    const config = difficulties[currentDifficulty];
    const acceleration = event.accelerationIncludingGravity;

    if (!acceleration) return;

    // 가속도 변화량 계산 (민감도 적용)
    const x = Math.abs(acceleration.x || 0);
    const y = Math.abs(acceleration.y || 0);
    const z = Math.abs(acceleration.z || 0);

    const totalAcceleration = x + y + z;

    // 민감도에 따라 임계값 조정 (1=어려움, 5=쉬움)
    const adjustedThreshold = config.threshold * (6 - sensitivity) / 3;
    const now = Date.now();

    if (totalAcceleration > adjustedThreshold && now - lastShakeTime > 100) {
        lastShakeTime = now;
        shakeCount++;

        // 에너지 증가 (민감도와 강도에 따라)
        const intensity = Math.min(2, (totalAcceleration - adjustedThreshold) / 10);
        const increment = config.increment * sensitivity / 3 * (1 + intensity);
        energy = Math.min(config.targetEnergy, energy + increment);

        updateStats();
        provideHapticFeedback();
        playShakeSound();
        triggerScreenShake();

        // 마일스톤 사운드 (30%, 50%, 70%, 90%)
        const milestones = [30, 50, 70, 90];
        for (let milestone of milestones) {
            if (energy >= milestone && lastMilestoneSound < milestone) {
                lastMilestoneSound = milestone;
                playMilestoneSound(milestone);
                break;
            }
        }

        // 완충 확인
        if (energy >= config.targetEnergy) {
            completeCharging();
        }
    }
}

// 통계 업데이트
function updateStats() {
    const percentage = Math.floor(energy);
    energyPercent.textContent = `${percentage}%`;
    energyBar.style.width = `${percentage}%`;
    energyBar.textContent = `${percentage}%`;
    shakeCountEl.textContent = shakeCount;

    // 배터리 아이콘 변경
    if (percentage < 30) {
        batteryIcon.textContent = '🪫';
        energyBar.style.background = 'linear-gradient(90deg, #e74c3c, #c0392b)';
    } else if (percentage < 70) {
        batteryIcon.textContent = '🔋';
        energyBar.style.background = 'linear-gradient(90deg, #f39c12, #e67e22)';
    } else {
        batteryIcon.textContent = '🔋';
        energyBar.style.background = 'linear-gradient(90deg, #2ecc71, #27ae60)';
    }
}

// 햅틱 피드백
function provideHapticFeedback() {
    if (navigator.vibrate) {
        navigator.vibrate(30);
    }
}

// 흔들기 사운드
function playShakeSound() {
    playSound('click');
}

// 마일스톤 사운드
function playMilestoneSound(milestone) {
    const frequency = 400 + (milestone * 4);
    playTone(frequency, 0.2);

    if (navigator.vibrate) {
        navigator.vibrate([50, 30, 50]);
    }
}

// 화면 흔들림 효과
function triggerScreenShake() {
    energyContainer.classList.add('screen-shake');
    setTimeout(() => {
        energyContainer.classList.remove('screen-shake');
    }, 300);
}

// 톤 재생 (마일스톤용)
// 톤 재생 (마일스톤용)
let toneContext = null;

function getToneContext() {
    if (!toneContext) {
        toneContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (toneContext.state === 'suspended') {
        toneContext.resume();
    }
    return toneContext;
}

function playTone(frequency, duration) {
    try {
        const ctx = getToneContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.3;
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + duration);
    } catch (e) {
        console.log('Audio error:', e);
    }
}

// 시간 초과
function timeUp() {
    stopGame();

    instructionEl.textContent = '시간 초과!';
    instructionEl.style.color = 'var(--danger-color)';

    playSound('fail');

    if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
    }

    setTimeout(() => {
        showFailScreen(`${Math.floor(energy)}% 충전했어요! 100%까지 채워야 통과합니다.`);
    }, 1000);
}

// 충전 완료
function completeCharging() {
    const finalTime = elapsedTime;

    stopGame();

    instructionEl.textContent = '충전 완료!';
    instructionEl.style.color = 'var(--success-color)';

    batteryIcon.classList.remove('charging');
    shakeIndicator.classList.remove('shaking');

    // 파티클 효과
    createCelebrationParticles();

    // 성공 사운드 및 진동
    playSound('success');

    if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 200]);
    }

    // 멀티플레이어 처리
    if (currentMode === 'multi') {
        handleMultiplayerCompletion(finalTime);
        return;
    }

    // 최고 기록 저장
    const isNewRecord = saveBestRecord(finalTime, shakeCount);

    setTimeout(() => {
        const msg = isNewRecord ?
            `🎉 신기록! ${finalTime}초, ${shakeCount}번 흔들기` :
            `완료! ${finalTime}초, ${shakeCount}번 흔들기`;
        alert(msg);
        showSuccessScreen(GAME_ID);
    }, 1500);
}

// 멀티플레이어 완료 처리
function handleMultiplayerCompletion(time) {
    if (multiplayerPhase === 'player1') {
        player1Time = time;
        player1Record.textContent = `${time}초`;
        player1Card.classList.remove('active');

        // 플레이어 2 차례
        multiplayerPhase = 'player2';
        currentPlayer = 2;
        player2Card.classList.add('active');

        setTimeout(() => {
            alert(`플레이어 1: ${time}초\n이제 플레이어 2 차례입니다!`);
            resetGame();
            instructionEl.textContent = '플레이어 2 차례!';
            checkSensorSupport();
        }, 1000);

    } else if (multiplayerPhase === 'player2') {
        player2Time = time;
        player2Record.textContent = `${time}초`;
        player2Card.classList.remove('active');

        // 결과 발표
        multiplayerPhase = 'results';

        setTimeout(() => {
            const winner = player1Time < player2Time ? '플레이어 1' : '플레이어 2';
            const winTime = Math.min(player1Time, player2Time);

            alert(`게임 종료!\n\n플레이어 1: ${player1Time}초\n플레이어 2: ${player2Time}초\n\n승자: ${winner} (${winTime}초)`);
            showSuccessScreen(GAME_ID);
        }, 1500);
    }
}

// 파티클 효과 생성
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

    const duration = 2000 + Math.random() * 1000;
    const startTime = Date.now();

    const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / duration;

        if (progress < 1) {
            const y = progress * window.innerHeight;
            const x = Math.sin(progress * Math.PI * 4) * 50;
            particle.style.transform = `translate(${x}px, ${y}px)`;
            particle.style.opacity = 1 - progress;
            requestAnimationFrame(animate);
        } else {
            particle.remove();
        }
    };

    animate();
}

// 게임 정지
function stopGame() {
    isCharging = false;

    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    window.removeEventListener('devicemotion', handleMotion);

    batteryIcon.classList.remove('charging');
    shakeIndicator.classList.remove('shaking');
}

// 게임 리셋
function resetGame() {
    stopGame();

    energy = 0;
    shakeCount = 0;
    elapsedTime = 0;
    lastMilestoneSound = 0;

    startBtn.style.display = 'block';
    resetBtn.style.display = 'none';
    difficultySelector.style.display = 'grid';
    modeSelector.style.display = 'grid';
    document.getElementById('sensitivityControl').style.display = 'block';

    if (currentMode === 'single') {
        playerInfo.style.display = 'none';
    }

    instructionEl.textContent = '폰을 흔들어서 에너지를 충전하세요!';
    instructionEl.style.color = 'var(--text-dark)';
    statusMessageEl.textContent = '';

    batteryIcon.textContent = '🔋';
    timeDisplay.textContent = '--:--';
    timeDisplay.style.color = 'var(--warning-color)';

    updateStats();
}

// 최고 기록 불러오기
function loadBestRecord() {
    const recordKey = `energy_charge_best_${currentDifficulty}`;
    const bestTime = localStorage.getItem(recordKey);

    if (bestTime) {
        bestRecordEl.textContent = `${bestTime}초`;
    } else {
        bestRecordEl.textContent = '-';
    }
}

// 최고 기록 저장
function saveBestRecord(time, shakes) {
    const recordKey = `energy_charge_best_${currentDifficulty}`;
    const bestTime = localStorage.getItem(recordKey);

    let isNewRecord = false;

    if (!bestTime || time < parseInt(bestTime)) {
        localStorage.setItem(recordKey, time);
        localStorage.setItem(`${recordKey}_shakes`, shakes);
        bestRecordEl.textContent = `${time}초`;
        isNewRecord = true;
    }

    return isNewRecord;
}

// 화면 탭 모드 (센서 미지원 시)
function startTapMode() {
    instructionEl.textContent = '화면을 빠르게 탭하세요!';
    startBtn.textContent = '탭 모드 시작';
    statusMessageEl.textContent = '센서 대신 화면 탭으로 충전합니다';
    statusMessageEl.style.color = 'var(--primary-color)';

    energyContainer.addEventListener('click', handleTap);

    startBtn.onclick = () => {
        isCharging = true;
        energy = 0;
        shakeCount = 0;
        gameStartTime = Date.now();

        startBtn.style.display = 'none';
        resetBtn.style.display = 'block';

        updateStats();
    };
}

function handleTap() {
    if (!isCharging) return;

    shakeCount++;
    energy = Math.min(100, energy + 5);

    updateStats();
    provideHapticFeedback();
    playSound('click');

    if (energy >= 100) {
        energyContainer.removeEventListener('click', handleTap);
        completeCharging();
    }
}

// 게임 시작
initGame();
