// 매직 컴퍼스 게임 (DeviceOrientation API) - 풀 버전

const GAME_ID = 'game16';

// DOM 요소
const difficultySelector = document.getElementById('difficultySelector');
const calibrationScreen = document.getElementById('calibrationScreen');
const gameScreen = document.getElementById('gameScreen');
const startCalibrationBtn = document.getElementById('startCalibrationBtn');
const calibrationProgress = document.getElementById('calibrationProgress');

// 게임 화면 요소
const compassFace = document.getElementById('compassFace');
const needle = document.getElementById('needle');
const accuracyRing = document.getElementById('accuracyRing');
const degreeMarks = document.getElementById('degreeMarks');

// 통계 요소
const currentDegree = document.getElementById('currentDegree');
const targetDirection = document.getElementById('targetDirection');
const errorDegree = document.getElementById('errorDegree');
const missionProgress = document.getElementById('missionProgress');

// 미션 요소
const missionIcon = document.getElementById('missionIcon');
const missionText = document.getElementById('missionText');
const missionHint = document.getElementById('missionHint');

// 피드백 요소
const directionIndicator = document.getElementById('directionIndicator');
const holdFill = document.getElementById('holdFill');
const statusMessage = document.getElementById('statusMessage');
const resetBtn = document.getElementById('resetBtn');
const successParticles = document.getElementById('successParticles');

// 난이도 설정
const difficulties = {
    easy: {
        tolerance: 15,      // ±15도 허용
        holdTime: 1,        // 1초 유지
        missionCount: 1,    // 1개 방향
        name: '쉬움'
    },
    medium: {
        tolerance: 10,      // ±10도 허용
        holdTime: 2,        // 2초 유지
        missionCount: 3,    // 3개 방향
        name: '보통'
    },
    hard: {
        tolerance: 5,       // ±5도 허용
        holdTime: 3,        // 3초 유지
        missionCount: 5,    // 5개 방향
        name: '어려움'
    }
};

// 8방향 정의
const directions = [
    { name: 'N', label: '북쪽', degree: 0, icon: '⬆️' },
    { name: 'NE', label: '북동쪽', degree: 45, icon: '↗️' },
    { name: 'E', label: '동쪽', degree: 90, icon: '➡️' },
    { name: 'SE', label: '남동쪽', degree: 135, icon: '↘️' },
    { name: 'S', label: '남쪽', degree: 180, icon: '⬇️' },
    { name: 'SW', label: '남서쪽', degree: 225, icon: '↙️' },
    { name: 'W', label: '서쪽', degree: 270, icon: '⬅️' },
    { name: 'NW', label: '북서쪽', degree: 315, icon: '↖️' }
];

// 게임 상태
let currentDifficulty = 'easy';
let isCalibrated = false;
let isSensorActive = false;
let currentHeading = 0;
let missions = [];
let currentMissionIndex = 0;
let holdStartTime = 0;
let holdDuration = 0;
let lastVibrationTime = 0;
let calibrationStartTime = 0;
let calibrationMovements = 0;
let gameStartTime = 0;

// 게임 초기화
function initGame() {
    showInstructions(
        '🧭 매직 컴퍼스',
        [
            '스마트폰을 돌려서 목표 방향을 찾으세요',
            '정확한 방향을 향하면 성공!',
            '난이도가 높을수록 정확도가 필요해요',
            '목표 방향을 일정 시간 유지해야 합니다'
        ],
        setupGame
    );
}

// 게임 설정
function setupGame() {
    setupDifficultyButtons();
    setupDegreeMarks();
    setupActionButtons();
    showCalibrationScreen();
}

// 난이도 버튼 설정
function setupDifficultyButtons() {
    const buttons = difficultySelector.querySelectorAll('.difficulty-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (isSensorActive) return;
            
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentDifficulty = btn.dataset.level;
        });
    });
}

// 각도 눈금 생성
function setupDegreeMarks() {
    for (let i = 0; i < 72; i++) {
        const mark = document.createElement('div');
        mark.className = i % 9 === 0 ? 'degree-mark major' : 'degree-mark';
        mark.style.transform = `rotate(${i * 5}deg)`;
        degreeMarks.appendChild(mark);
    }
}

// 액션 버튼 설정
function setupActionButtons() {
    startCalibrationBtn.addEventListener('click', startCalibration);
    resetBtn.addEventListener('click', resetGame);
}

// 캘리브레이션 화면 표시
function showCalibrationScreen() {
    calibrationScreen.classList.add('active');
    gameScreen.classList.remove('active');
    difficultySelector.style.display = 'grid';
}

// 캘리브레이션 시작
async function startCalibration() {
    // iOS 13+ 권한 요청
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
            const permission = await DeviceOrientationEvent.requestPermission();
            if (permission !== 'granted') {
                alert('센서 권한이 필요합니다. 설정에서 권한을 허용해주세요.');
                return;
            }
        } catch (error) {
            console.error('Permission error:', error);
            alert('센서 권한 요청 실패: ' + error.message);
            return;
        }
    }
    
    // 캘리브레이션 시작
    calibrationStartTime = Date.now();
    calibrationMovements = 0;
    startCalibrationBtn.disabled = true;
    startCalibrationBtn.textContent = '🔄 보정 중...';
    
    // 센서 이벤트 등록
    window.addEventListener('deviceorientation', calibrationHandler);
}

// 캘리브레이션 핸들러
function calibrationHandler(event) {
    const alpha = event.alpha || 0;
    const beta = event.beta || 0;
    const gamma = event.gamma || 0;
    
    // 움직임 감지
    const movement = Math.abs(beta) + Math.abs(gamma);
    if (movement > 30) {
        calibrationMovements++;
    }
    
    // 진행률 계산 (최소 5초, 최소 20회 움직임)
    const timeProgress = Math.min(100, ((Date.now() - calibrationStartTime) / 5000) * 100);
    const movementProgress = Math.min(100, (calibrationMovements / 20) * 100);
    const totalProgress = Math.min(100, (timeProgress + movementProgress) / 2);
    
    calibrationProgress.style.width = `${totalProgress}%`;
    
    // 캘리브레이션 완료
    if (totalProgress >= 100) {
        window.removeEventListener('deviceorientation', calibrationHandler);
        finishCalibration();
    }
}

// 캘리브레이션 완료
function finishCalibration() {
    isCalibrated = true;
    playSound('success');
    
    if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
    }
    
    setTimeout(() => {
        startGame();
    }, 500);
}

// 게임 시작
function startGame() {
    calibrationScreen.classList.remove('active');
    gameScreen.classList.add('active');
    difficultySelector.style.display = 'none';
    
    // 미션 생성
    generateMissions();
    
    // 센서 시작
    isSensorActive = true;
    gameStartTime = Date.now();
    window.addEventListener('deviceorientation', orientationHandler);
    
    // 첫 미션 표시
    updateMissionDisplay();
    
    statusMessage.textContent = '폰을 돌려서 방향을 찾으세요!';
}

// 미션 생성
function generateMissions() {
    const config = difficulties[currentDifficulty];
    missions = [];
    
    // 난이도에 따라 미션 수 결정
    const availableDirections = [...directions];
    
    for (let i = 0; i < config.missionCount; i++) {
        const randomIndex = Math.floor(Math.random() * availableDirections.length);
        missions.push(availableDirections[randomIndex]);
        availableDirections.splice(randomIndex, 1);
    }
    
    currentMissionIndex = 0;
}

// 미션 표시 업데이트
function updateMissionDisplay() {
    const mission = missions[currentMissionIndex];
    const config = difficulties[currentDifficulty];
    
    missionIcon.textContent = mission.icon;
    missionText.textContent = `${mission.label}(${mission.name})을 찾아라!`;
    missionHint.textContent = `${mission.degree}° 방향`;
    
    targetDirection.textContent = mission.name;
    missionProgress.textContent = `${currentMissionIndex + 1}/${missions.length}`;
}

// 방향 센서 핸들러
function orientationHandler(event) {
    if (!isSensorActive) return;
    
    // alpha: 0-360도 (북쪽이 0도)
    let alpha = event.alpha || 0;
    
    // 안드로이드/iOS 호환성 처리
    if (event.webkitCompassHeading) {
        // iOS의 경우
        alpha = event.webkitCompassHeading;
    } else {
        // 안드로이드의 경우 (북쪽을 0도로 변환)
        alpha = 360 - alpha;
    }
    
    currentHeading = Math.round(alpha);
    
    // UI 업데이트
    updateCompassUI();
    
    // 게임 로직 체크
    checkMissionProgress();
}

// 나침반 UI 업데이트
function updateCompassUI() {
    // 나침반 판 회전 (반대 방향)
    compassFace.style.transform = `rotate(${-currentHeading}deg)`;
    
    // 현재 각도 표시
    currentDegree.textContent = `${currentHeading}°`;
    
    // 목표와의 오차 계산
    const mission = missions[currentMissionIndex];
    const error = calculateAngleError(currentHeading, mission.degree);
    errorDegree.textContent = `${Math.abs(error)}°`;
    
    // 정확도 링 색상
    const config = difficulties[currentDifficulty];
    accuracyRing.className = 'accuracy-ring';
    
    if (Math.abs(error) <= config.tolerance) {
        accuracyRing.classList.add('perfect');
    } else if (Math.abs(error) <= config.tolerance * 2) {
        accuracyRing.classList.add('near');
    } else {
        accuracyRing.classList.add('far');
    }
    
    // 방향 안내
    updateDirectionGuide(error);
}

// 각도 오차 계산 (최단 거리)
function calculateAngleError(current, target) {
    let diff = current - target;
    
    // -180 ~ 180 범위로 정규화
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    
    return diff;
}

// 방향 안내 업데이트
function updateDirectionGuide(error) {
    const config = difficulties[currentDifficulty];
    
    if (Math.abs(error) <= config.tolerance) {
        directionIndicator.textContent = '✅ 완벽해요! 유지하세요!';
        directionIndicator.className = 'direction-indicator success';
    } else if (Math.abs(error) <= config.tolerance * 2) {
        if (error > 0) {
            directionIndicator.textContent = '↪️ 조금 더 좌로 돌리세요';
        } else {
            directionIndicator.textContent = '↩️ 조금 더 우로 돌리세요';
        }
        directionIndicator.className = 'direction-indicator';
    } else {
        if (error > 0) {
            directionIndicator.textContent = '⬅️ 좌로 돌리세요';
        } else {
            directionIndicator.textContent = '➡️ 우로 돌리세요';
        }
        directionIndicator.className = 'direction-indicator';
    }
}

// 미션 진행 체크
function checkMissionProgress() {
    const mission = missions[currentMissionIndex];
    const config = difficulties[currentDifficulty];
    const error = calculateAngleError(currentHeading, mission.degree);
    
    // 목표 범위 내에 있는지 체크
    if (Math.abs(error) <= config.tolerance) {
        // 유지 시작
        if (holdStartTime === 0) {
            holdStartTime = Date.now();
        }
        
        holdDuration = (Date.now() - holdStartTime) / 1000;
        const progress = (holdDuration / config.holdTime) * 100;
        
        holdFill.style.width = `${Math.min(100, progress)}%`;
        holdFill.textContent = `${holdDuration.toFixed(1)}초 / ${config.holdTime}초`;
        
        // 진동 피드백 (0.2초마다)
        const now = Date.now();
        if (now - lastVibrationTime > 200) {
            if (navigator.vibrate) {
                navigator.vibrate(20);
            }
            lastVibrationTime = now;
        }
        
        // 미션 완료
        if (holdDuration >= config.holdTime) {
            completeMission();
        }
    } else {
        // 범위 벗어남 - 리셋
        holdStartTime = 0;
        holdDuration = 0;
        holdFill.style.width = '0%';
        holdFill.textContent = '0.0초';
    }
}

// 미션 완료
function completeMission() {
    holdStartTime = 0;
    holdDuration = 0;
    holdFill.style.width = '0%';
    
    playSound('success');
    
    if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 200]);
    }
    
    // 파티클 효과
    createSuccessParticles();
    
    currentMissionIndex++;
    
    // 모든 미션 완료
    if (currentMissionIndex >= missions.length) {
        setTimeout(() => {
            completeGame();
        }, 1000);
    } else {
        // 다음 미션
        setTimeout(() => {
            updateMissionDisplay();
            statusMessage.textContent = '다음 방향을 찾으세요!';
        }, 1000);
    }
}

// 게임 완료
function completeGame() {
    isSensorActive = false;
    window.removeEventListener('deviceorientation', orientationHandler);
    
    const totalTime = Math.floor((Date.now() - gameStartTime) / 1000);
    
    // 기록 저장
    saveRecord(totalTime);
    
    playSound('success');
    
    if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 300]);
    }
    
    statusMessage.textContent = `✅ 완료! (${totalTime}초)`;
    
    setTimeout(() => {
        showSuccessScreen(GAME_ID);
    }, 1500);
}

// 성공 파티클 생성
function createSuccessParticles() {
    const colors = ['#e74c3c', '#f39c12', '#2ecc71', '#3498db', '#9b59b6'];
    
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'absolute';
        particle.style.width = '10px';
        particle.style.height = '10px';
        particle.style.borderRadius = '50%';
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        particle.style.left = '50%';
        particle.style.top = '50%';
        particle.style.pointerEvents = 'none';
        
        const angle = (Math.PI * 2 * i) / 20;
        const velocity = 3 + Math.random() * 2;
        const dx = Math.cos(angle) * velocity;
        const dy = Math.sin(angle) * velocity;
        
        successParticles.appendChild(particle);
        
        let x = 0, y = 0, opacity = 1;
        const animate = () => {
            x += dx;
            y += dy;
            opacity -= 0.02;
            
            particle.style.transform = `translate(${x}px, ${y}px)`;
            particle.style.opacity = opacity;
            
            if (opacity > 0) {
                requestAnimationFrame(animate);
            } else {
                particle.remove();
            }
        };
        
        animate();
    }
}

// 기록 저장
function saveRecord(time) {
    const recordKey = `magic_compass_best_${currentDifficulty}`;
    const bestTime = localStorage.getItem(recordKey);
    
    if (!bestTime || time < parseInt(bestTime)) {
        localStorage.setItem(recordKey, time);
    }
}

// 기록 불러오기
function loadRecord() {
    const recordKey = `magic_compass_best_${currentDifficulty}`;
    const bestTime = localStorage.getItem(recordKey);
    return bestTime ? parseInt(bestTime) : null;
}

// 게임 리셋
function resetGame() {
    if (confirm('게임을 다시 시작하시겠습니까?')) {
        isSensorActive = false;
        window.removeEventListener('deviceorientation', orientationHandler);
        
        holdStartTime = 0;
        holdDuration = 0;
        currentMissionIndex = 0;
        
        holdFill.style.width = '0%';
        accuracyRing.className = 'accuracy-ring';
        
        showCalibrationScreen();
        isCalibrated = false;
        calibrationProgress.style.width = '0%';
        startCalibrationBtn.disabled = false;
        startCalibrationBtn.textContent = '🔄 보정 시작';
    }
}

// 게임 시작
initGame();
