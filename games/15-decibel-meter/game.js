// 데시벨 측정기 게임 (Web Audio API) - 풀 버전

const GAME_ID = 'game15';

// DOM 요소
const volumeBar = document.getElementById('volumeBar');
const volumeLevel = document.getElementById('volumeLevel');
const targetLine = document.getElementById('targetLine');
const dangerLine = document.getElementById('dangerLine');
const sustainGauge = document.getElementById('sustainGauge');
const sustainFill = document.getElementById('sustainFill');
const alarmOverlay = document.getElementById('alarmOverlay');

// 통계 요소
const timeDisplay = document.getElementById('timeDisplay');
const bestRecordEl = document.getElementById('bestRecord');

// 미션 요소
const missionText = document.getElementById('missionText');

// 버튼
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusMessage = document.getElementById('statusMessage');

// 오디오 변수
let gameAudioContext, analyser, microphone, dataArray;
let isListening = false;
let animationId = null;



// 난이도 설정
const difficulties = {
    easy: {
        target: 50,
        maxLimit: 100,
        timeLimit: 0,
        name: '쉬움',
        sustainTime: 2
    },
    medium: {
        target: 70,
        maxLimit: 95,
        timeLimit: 30,
        name: '보통',
        sustainTime: 3
    },
    hard: {
        target: 85,
        maxLimit: 90,
        timeLimit: 20,
        name: '어려움',
        sustainTime: 4
    }
};

// 미션 목록
const missions = [
    { icon: '🗣️', text: '"사랑해요!" 라고 외치세요!', hint: '크게 소리를 내보세요' },
    { icon: '🔊', text: '"열려라 참깨!" 외치기', hint: '마법의 주문을 외워보세요' },
    { icon: '🎵', text: '좋아하는 노래 부르기', hint: '신나게 노래해보세요' },
    { icon: '👏', text: '박수 치기', hint: '힘차게 박수를 쳐보세요' },
    { icon: '😄', text: '큰 소리로 웃기', hint: '하하하! 크게 웃어보세요' }
];

// 게임 상태
let currentDifficulty = 'easy';
// 지속 모드로 고정 (instant 모드 제거)
let currentMission = 0;
let currentVolume = 0;
let peakVolume = 0;
let startTime = 0;
let elapsedTime = 0;
let timerInterval = null;
let sustainStartTime = 0;
let sustainDuration = 0;
let alarmTimeout = null;

// 게임 초기화
function initGame() {
    showInstructions(
        '🔊 데시벨 측정기',
        [
            '마이크에 대고 큰 소리를 내세요',
            '목표 음량을 일정 시간 유지하면 성공!',
            '소리가 너무 크면 실패하니 주의하세요',
            'Admin 페이지에서 난이도를 조정할 수 있어요'
        ],
        setupGame
    );
}

// 게임 설정
function setupGame() {
    loadGameConfig(); // Admin 설정 로드
    setupActionButtons();
    updateMission();
    updateTargetLine();
    loadBestRecord();
}



// Admin 설정 로드
function loadGameConfig() {
    const savedConfig = localStorage.getItem('game15_config');
    if (savedConfig) {
        try {
            const config = JSON.parse(savedConfig);
            // Admin에서 설정한 난이도 값으로 difficulties 객체 업데이트
            if (config.difficulties) {
                Object.assign(difficulties, config.difficulties);
            }
            // Admin에서 선택한 난이도를 현재 난이도로 설정
            if (config.currentDifficulty) {
                currentDifficulty = config.currentDifficulty;
            } else {
                currentDifficulty = 'easy'; // 기본값
            }
        } catch (error) {
            console.error('설정 로드 실패:', error);
            currentDifficulty = 'easy';
        }
    } else {
        // 저장된 설정이 없으면 기본값
        currentDifficulty = 'easy';
    }

    // 지속 모드로 고정 - 게이지 항상 표시
    sustainGauge.style.display = 'block';
    sustainFill.style.width = '0%';
    sustainFill.textContent = '0.0초';

    console.log(`난이도 로드됨: ${currentDifficulty}`, difficulties[currentDifficulty]);
}

// 액션 버튼 설정
function setupActionButtons() {
    startBtn.addEventListener('click', startMicrophone);
    stopBtn.addEventListener('click', stopMicrophone);
}

// 미션 업데이트
function updateMission() {
    const mission = missions[currentMission];
    const missionText = document.getElementById('missionText');
    if (missionText) {
        missionText.textContent = `${mission.icon} ${mission.text}`;
    }
}

// 목표선 업데이트
function updateTargetLine() {
    const config = difficulties[currentDifficulty];
    const targetPosition = 100 - config.target;
    targetLine.style.top = `${targetPosition}%`;

    // 위험선 설정
    if (config.maxLimit < 100) {
        dangerLine.style.display = 'block';
        const dangerPosition = 100 - config.maxLimit;
        dangerLine.style.top = `${dangerPosition}%`;
    } else {
        dangerLine.style.display = 'none';
    }
}

// 마이크 시작
async function startMicrophone() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: false
            }
        });

        gameAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = gameAudioContext.createAnalyser();
        microphone = gameAudioContext.createMediaStreamSource(stream);

        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;
        microphone.connect(analyser);

        dataArray = new Uint8Array(analyser.frequencyBinCount);

        isListening = true;
        startTime = Date.now();
        peakVolume = 0;
        sustainStartTime = 0;
        sustainDuration = 0;

        startBtn.style.display = 'none';
        stopBtn.style.display = 'block';

        statusMessage.textContent = '소리를 내보세요!';
        statusMessage.className = 'status-message';

        // 타이머 시작
        const config = difficulties[currentDifficulty];
        if (config.timeLimit > 0) {
            startTimer();
        }

        // 측정 시작
        measureVolume();

    } catch (error) {
        console.error('Microphone error:', error);
        statusMessage.textContent = '마이크 권한이 필요합니다';
        statusMessage.className = 'status-message danger';
    }
}

// 타이머 시작
function startTimer() {
    timerInterval = setInterval(() => {
        elapsedTime = Math.floor((Date.now() - startTime) / 1000);
        const config = difficulties[currentDifficulty];
        const timeLeft = config.timeLimit - elapsedTime;

        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        timeDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        if (timeLeft <= 0) {
            timeUp();
        }
    }, 100);
}

// 시간 초과
function timeUp() {
    stopMicrophone();
    statusMessage.textContent = '시간 초과!';
    statusMessage.className = 'status-message danger';

    playSound('fail');

    setTimeout(() => {
        // 재시도 콜백과 함께 실패 화면 표시
        showFailScreen(
            '시간 내에 목표를 달성하지 못했습니다!',
            GAME_ID,
            retryWithEasierDifficulty
        );
    }, 1000);
}

// 재시도 시 난이도 완화
function retryWithEasierDifficulty() {
    const config = difficulties[currentDifficulty];
    if (config.timeLimit > 0) {
        config.timeLimit += 1;
        console.log(`난이도 완화: 시간 제한 +1초 (${config.timeLimit}초)`);
    }
    // 지속 시간도 0.5초 감소 (최소 1초)
    if (config.sustainTime > 1) {
        config.sustainTime = Math.max(1, config.sustainTime - 0.5);
        console.log(`난이도 완화: 지속 시간 -0.5초 (${config.sustainTime}초)`);
    }
    // 지속 게이지 리셋
    sustainFill.style.width = '0%';
    sustainFill.textContent = '0.0초';
    // 게임 재시작
    startMicrophone();
}

// 볼륨 측정
function measureVolume() {
    if (!isListening) return;

    analyser.getByteFrequencyData(dataArray);

    // RMS 계산 (Root Mean Square)
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / dataArray.length);

    // 0-100% 범위로 변환
    currentVolume = Math.min(100, (rms / 128) * 100);
    peakVolume = Math.max(peakVolume, currentVolume);

    // UI 업데이트
    updateUI();

    // 게임 로직 체크
    checkGameLogic();

    animationId = requestAnimationFrame(measureVolume);
}

// UI 업데이트
function updateUI() {
    const percentage = Math.floor(currentVolume);

    volumeBar.style.height = `${currentVolume}%`;
    volumeLevel.textContent = `${percentage}%`;
}

// 게임 로직 체크
function checkGameLogic() {
    const config = difficulties[currentDifficulty];

    // 상한선 체크 (경보)
    if (currentVolume > config.maxLimit) {
        triggerAlarm();
    } else {
        clearAlarm();
    }

    // 지속 모드로 고정
    if (currentVolume >= config.target && currentVolume <= config.maxLimit) {
        if (sustainStartTime === 0) {
            sustainStartTime = Date.now();
        }
        sustainDuration = (Date.now() - sustainStartTime) / 1000;

        const progress = (sustainDuration / config.sustainTime) * 100;
        sustainFill.style.width = `${Math.min(100, progress)}%`;
        sustainFill.textContent = `${sustainDuration.toFixed(1)}초`;

        if (sustainDuration >= config.sustainTime) {
            gameSuccess();
        }
    } else {
        // 목표 벗어남 - 리셋
        sustainStartTime = 0;
        sustainDuration = 0;
        sustainFill.style.width = '0%';
        sustainFill.textContent = '0.0초';
    }
}

// 경보 발동
function triggerAlarm() {
    alarmOverlay.classList.add('active');

    if (!alarmTimeout) {
        playSound('fail');

        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
        }

        // 3초 후 실패
        alarmTimeout = setTimeout(() => {
            stopMicrophone();
            statusMessage.textContent = '너무 시끄러워서 실패!';
            statusMessage.className = 'status-message danger';

            setTimeout(() => {
                // 재시도 콜백과 함께 실패 화면 표시
                showFailScreen(
                    '소리가 너무 컸습니다! 적당한 크기로 외쳐주세요.',
                    GAME_ID,
                    retryWithEasierDifficulty
                );
            }, 1000);
        }, 3000);
    }
}

// 경보 해제
function clearAlarm() {
    alarmOverlay.classList.remove('active');

    if (alarmTimeout) {
        clearTimeout(alarmTimeout);
        alarmTimeout = null;
    }
}

// 게임 성공
function gameSuccess() {
    isListening = false;

    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    statusMessage.textContent = '✅ 성공!';
    statusMessage.className = 'status-message success';

    // 기록 저장
    saveBestRecord();

    // 성공 사운드
    playSound('success');

    if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 200]);
    }

    // 다음 미션으로
    currentMission = (currentMission + 1) % missions.length;

    setTimeout(() => {
        // showSuccessScreen(GAME_ID);
        window.parent.postMessage({ type: 'GAME_CLEAR', gameId: GAME_ID }, '*');
    }, 1500);
}

// 마이크 정지
function stopMicrophone() {
    isListening = false;

    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    if (alarmTimeout) {
        clearTimeout(alarmTimeout);
        alarmTimeout = null;
    }

    clearAlarm();

    if (microphone) {
        microphone.disconnect();
        microphone.mediaStream.getTracks().forEach(track => track.stop());
    }

    if (gameAudioContext) {
        gameAudioContext.close();
    }

    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';

    // UI 리셋
    volumeBar.style.height = '0%';
    volumeLevel.textContent = '0%';
    volumeLevel.className = 'volume-level';
    currentLevel.textContent = '0%';
    sustainFill.style.width = '0%';

    // Canvas 클리어
    canvasCtx.fillStyle = '#1a1a1a';
    canvasCtx.fillRect(0, 0, canvasWidth, canvasHeight);
}

// 최고 기록 불러오기
function loadBestRecord() {
    const recordKey = `decibel_meter_best_${currentDifficulty}`;
    const best = localStorage.getItem(recordKey);

    if (best) {
        bestRecordEl.textContent = `${best}%`;
    } else {
        bestRecordEl.textContent = '-';
    }
}

// 최고 기록 저장
function saveBestRecord() {
    const recordKey = `decibel_meter_best_${currentDifficulty}`;
    const best = localStorage.getItem(recordKey);

    const currentPeak = Math.floor(peakVolume);

    if (!best || currentPeak > parseInt(best)) {
        localStorage.setItem(recordKey, currentPeak);
        bestRecordEl.textContent = `${currentPeak}%`;
    }
}

// 게임 시작
initGame();
