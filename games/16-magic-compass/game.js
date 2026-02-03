// 매직 컴퍼스 게임 (DeviceOrientation API) - 풀 버전

const GAME_ID = 'game16';

// DOM 요소
const difficultySelector = document.getElementById('difficultySelector');
const gameScreen = document.getElementById('gameScreen');

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
const holdFill = document.getElementById('holdFill');
const resetBtn = document.getElementById('resetBtn');

// 난이도 설정 (Admin에서 커스터마이징 가능)
const difficulties = {
    easy: {
        tolerance: 20,      // ±20도 허용 (흔들림 고려하여 증가)
        holdTime: 1,        // 1초 유지
        missionCount: 1,    // 1개 방향
        name: '쉬움'
    },
    medium: {
        tolerance: 15,      // ±15도 허용
        holdTime: 2,        // 2초 유지
        missionCount: 3,    // 3개 방향
        name: '보통'
    },
    hard: {
        tolerance: 10,      // ±10도 허용
        holdTime: 3,        // 3초 유지
        missionCount: 5,    // 5개 방향
        name: '어려움'
    }
};

// 나침반 흔들림 설정 (Admin에서 커스터마이징 가능)
let compassNoise = {
    amplitude: 5,      // 흔들림 크기 (±degrees)
    frequency: 0.5,    // 흔들림 속도 (Hz)
    complexity: 3      // 여러 주파수 조합 수
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
let isSensorActive = false;
let currentHeading = 0;
let rawHeading = 0;  // 실제 센서 값
let missions = [];
let currentMissionIndex = 0;
let holdStartTime = 0;
let holdDuration = 0;
let lastVibrationTime = 0;
let gameStartTime = 0;
let noiseStartTime = Date.now();  // 흔들림 타이밍용

// Admin 설정 로드
function loadAdminSettings() {
    const settings = JSON.parse(localStorage.getItem('game16_settings'));
    if (settings) {
        // 단일 난이도 설정 로드 (새로운 구조)
        if (settings.tolerance !== undefined) {
            // 현재 선택된 난이도에 설정 적용
            difficulties[currentDifficulty].tolerance = settings.tolerance;
            difficulties[currentDifficulty].holdTime = settings.holdTime;
            difficulties[currentDifficulty].missionCount = settings.missionCount;

            // 모든 난이도에도 동일하게 적용 (비율 유지)
            const baseLevel = currentDifficulty === 'easy' ? 1 : currentDifficulty === 'medium' ? 1.33 : 1.67;
            difficulties.easy.tolerance = Math.round(settings.tolerance * (currentDifficulty === 'easy' ? 1 : 1.33));
            difficulties.easy.holdTime = settings.holdTime * (currentDifficulty === 'easy' ? 1 : 0.75);
            difficulties.easy.missionCount = Math.max(1, Math.round(settings.missionCount * (currentDifficulty === 'easy' ? 1 : 0.33)));

            difficulties.medium.tolerance = Math.round(settings.tolerance * (currentDifficulty === 'medium' ? 1 : 1));
            difficulties.medium.holdTime = settings.holdTime * (currentDifficulty === 'medium' ? 1 : 1);
            difficulties.medium.missionCount = Math.round(settings.missionCount * (currentDifficulty === 'medium' ? 1 : 1));

            difficulties.hard.tolerance = Math.round(settings.tolerance * (currentDifficulty === 'hard' ? 1 : 0.67));
            difficulties.hard.holdTime = settings.holdTime * (currentDifficulty === 'hard' ? 1 : 1.5);
            difficulties.hard.missionCount = Math.round(settings.missionCount * (currentDifficulty === 'hard' ? 1 : 1.67));
        }

        // 나침반 흔들림 설정 로드
        if (settings.compassNoise) {
            Object.assign(compassNoise, settings.compassNoise);
        }
    }
}

// 나침반 흔들림 계산 (Sin/Cos 조합)
function calculateCompassNoise(timestamp) {
    let noise = 0;
    for (let i = 1; i <= compassNoise.complexity; i++) {
        const freq = compassNoise.frequency * i;
        const amp = compassNoise.amplitude / i;
        noise += Math.sin(timestamp * freq * Math.PI * 2 / 1000) * amp;
    }
    return noise;
}

// 게임 초기화
function initGame() {
    loadAdminSettings();  // Admin 설정 로드

    showInstructions(
        '🧭 매직 컴퍼스',
        [
            '스마트폰을 돌려서 목표 방향을 찾으세요',
            '나침반이 자기장의 영향을 받아 흔들립니다',
            '정확한 방향을 향하면 성공!',
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
    requestSensorPermissionAndStart();
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
    resetBtn.addEventListener('click', resetGame);
}

// 센서 권한 요청 및 게임 시작
async function requestSensorPermissionAndStart() {
    // iOS 13+ 권한 요청
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        try {
            const permission = await DeviceOrientationEvent.requestPermission();
            if (permission !== 'granted') {
                showCustomModal(
                    '🔒 권한 필요',
                    '나침반 센서를 사용하려면 권한이 필요합니다. 설정에서 권한을 허용해주세요.',
                    () => { }
                );
                return;
            }
        } catch (error) {
            console.error('Permission error:', error);
            showCustomModal(
                '❌ 오류',
                '센서 권한 요청 실패: ' + error.message,
                () => { }
            );
            return;
        }
    }

    // 권한 획득 후 바로 게임 시작
    playSound('success');

    if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
    }

    setTimeout(() => {
        startGame();
    }, 300);
}

// 게임 시작
function startGame() {
    gameScreen.classList.add('active');
    difficultySelector.style.display = 'none';

    // 미션 생성
    generateMissions();

    // 센서 시작
    isSensorActive = true;
    gameStartTime = Date.now();
    noiseStartTime = Date.now();  // 흔들림 시작 시간
    window.addEventListener('deviceorientation', orientationHandler);

    // 첫 미션 표시
    updateMissionDisplay();
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

    // 실제 센서 값 저장
    rawHeading = Math.round(alpha);

    // 나침반 흔들림 추가
    const noiseOffset = calculateCompassNoise(Date.now() - noiseStartTime);
    currentHeading = Math.round((rawHeading + noiseOffset + 360) % 360);

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

}

// 각도 오차 계산 (최단 거리)
function calculateAngleError(current, target) {
    let diff = current - target;

    // -180 ~ 180 범위로 정규화
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    return diff;
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

    setTimeout(() => {
        showSuccessScreen(GAME_ID);
    }, 1500);
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

        // 바로 게임 재시작
        requestSensorPermissionAndStart();
    }
}

// 게임 시작
initGame();
