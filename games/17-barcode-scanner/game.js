// 바코드 스캐너 게임 (QuaggaJS) - 풀 버전

const GAME_ID = 'game17';

// DOM 요소
const difficultySelector = document.getElementById('difficultySelector');
const cameraView = document.getElementById('cameraView');
const scannerContainer = document.getElementById('scanner-container');
const detectionOverlay = document.getElementById('detectionOverlay');
const scanStatus = document.getElementById('scanStatus');
const scanHistory = document.getElementById('scanHistory');
const historyList = document.getElementById('historyList');

// 통계 요소
const scanAttempts = document.getElementById('scanAttempts');
const successScans = document.getElementById('successScans');
const missionProgress = document.getElementById('missionProgress');
const timeDisplay = document.getElementById('timeDisplay');

// 미션 요소
const missionIcon = document.getElementById('missionIcon');
const missionText = document.getElementById('missionText');
const missionHint = document.getElementById('missionHint');

// 버튼
const startCameraBtn = document.getElementById('startCameraBtn');
const stopCameraBtn = document.getElementById('stopCameraBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const resetBtn = document.getElementById('resetBtn');
const flashBtn = document.getElementById('flashBtn');
const switchCameraBtn = document.getElementById('switchCameraBtn');
const manualInput = document.getElementById('manualInput');
const manualSubmitBtn = document.getElementById('manualSubmitBtn');
const statusMessage = document.getElementById('statusMessage');
const successCheckmark = document.getElementById('successCheckmark');

// 난이도 설정
const difficulties = {
    easy: {
        missionCount: 1,
        validation: 'any', // 아무 바코드나
        name: '쉬움'
    },
    medium: {
        missionCount: 2,
        validation: 'pattern', // 880으로 시작 (한국 상품)
        pattern: '880',
        name: '보통'
    },
    hard: {
        missionCount: 3,
        validation: 'exact', // 정확한 번호
        name: '어려움'
    }
};

// 미션 정의
const missions = [
    { icon: '🍜', name: '라면', hint: '주방에서 찾아보세요!', pattern: '880' },
    { icon: '🍪', name: '과자', hint: '간식 서랍을 확인해보세요!', pattern: '880' },
    { icon: '🥤', name: '음료수', hint: '냉장고를 열어보세요!', pattern: '880' },
    { icon: '🧴', name: '샴푸', hint: '욕실로 가보세요!', pattern: '880' },
    { icon: '🪥', name: '치약', hint: '세면대 근처에 있어요!', pattern: '880' }
];

// 게임 상태
let currentDifficulty = 'easy';
let isCameraActive = false;
let scannedCodes = [];
let currentMissionIndex = 0;
let attemptCount = 0;
let successCount = 0;
let gameStartTime = 0;
let timerInterval = null;
let lastScanTime = 0;
let scanCooldown = 1000; // 1초 쿨다운

// 게임 초기화
function initGame() {
    showInstructions(
        '📱 바코드 스캐너',
        [
            '집안의 물건에서 바코드를 찾으세요',
            '카메라로 바코드를 스캔하거나',
            '직접 번호를 입력할 수 있어요',
            '여러 개의 미션을 완료하세요!'
        ],
        setupGame
    );
}

// 게임 설정
function setupGame() {
    setupDifficultyButtons();
    setupActionButtons();
    updateMissionDisplay();
}

// 난이도 버튼 설정
function setupDifficultyButtons() {
    const buttons = difficultySelector.querySelectorAll('.difficulty-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (isCameraActive) return;
            
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentDifficulty = btn.dataset.level;
            
            // 게임 리셋
            resetGameState();
            updateMissionDisplay();
        });
    });
}

// 액션 버튼 설정
function setupActionButtons() {
    startCameraBtn.addEventListener('click', startCamera);
    stopCameraBtn.addEventListener('click', stopCamera);
    clearHistoryBtn.addEventListener('click', clearHistory);
    resetBtn.addEventListener('click', resetGame);
    manualSubmitBtn.addEventListener('click', submitManualInput);
    
    manualInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            submitManualInput();
        }
    });
    
    // 숫자만 입력 가능
    manualInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });
}

// 미션 표시 업데이트
function updateMissionDisplay() {
    const config = difficulties[currentDifficulty];
    const mission = missions[currentMissionIndex % missions.length];
    
    missionIcon.textContent = mission.icon;
    missionText.textContent = `${mission.name} 바코드 찾기`;
    missionHint.textContent = mission.hint;
    
    missionProgress.textContent = `${currentMissionIndex}/${config.missionCount}`;
}

// 카메라 시작
async function startCamera() {
    try {
        // 카메라 권한 확인
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment', // 후면 카메라
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        });
        
        // 스트림 정리 (QuaggaJS가 직접 처리)
        stream.getTracks().forEach(track => track.stop());
        
        // QuaggaJS 초기화
        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: scannerContainer,
                constraints: {
                    facingMode: "environment",
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            },
            decoder: {
                readers: [
                    "ean_reader",      // EAN-13, EAN-8
                    "ean_8_reader",
                    "code_128_reader", // Code-128
                    "code_39_reader",  // Code-39
                    "upc_reader",      // UPC-A, UPC-E
                    "upc_e_reader"
                ],
                debug: {
                    drawBoundingBox: false,
                    showFrequency: false,
                    drawScanline: false,
                    showPattern: false
                }
            },
            locator: {
                patchSize: "medium",
                halfSample: true
            },
            numOfWorkers: 2,
            frequency: 10,
            locate: true
        }, (err) => {
            if (err) {
                console.error('QuaggaJS init error:', err);
                statusMessage.textContent = '카메라 시작 실패: ' + err.message;
                statusMessage.className = 'status-message error';
                
                // 수동 입력 안내
                alert('카메라를 사용할 수 없습니다. 바코드 번호를 직접 입력해주세요.');
                return;
            }
            
            // 스캔 시작
            Quagga.start();
            isCameraActive = true;
            
            // UI 업데이트
            cameraView.classList.add('active');
            startCameraBtn.style.display = 'none';
            stopCameraBtn.style.display = 'block';
            difficultySelector.style.display = 'none';
            scanHistory.style.display = 'block';
            
            statusMessage.textContent = '카메라 시작됨';
            statusMessage.className = 'status-message success';
            
            // 타이머 시작
            if (!timerInterval) {
                gameStartTime = Date.now();
                startTimer();
            }
        });
        
        // 감지 이벤트 등록
        Quagga.onDetected(onBarcodeDetected);
        
    } catch (error) {
        console.error('Camera error:', error);
        statusMessage.textContent = '카메라 권한이 필요합니다';
        statusMessage.className = 'status-message error';
        alert('카메라 접근 권한을 허용해주세요.');
    }
}

// 타이머 시작
function startTimer() {
    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        timeDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
}

// 바코드 감지 핸들러
function onBarcodeDetected(result) {
    const now = Date.now();
    
    // 쿨다운 체크
    if (now - lastScanTime < scanCooldown) {
        return;
    }
    
    const code = result.codeResult.code;
    
    // 신뢰도 체크 (80% 이상)
    if (result.codeResult.decodedCodes.length < 5) {
        return;
    }
    
    lastScanTime = now;
    
    // 스캔 시각 효과
    detectionOverlay.classList.add('detected');
    setTimeout(() => {
        detectionOverlay.classList.remove('detected');
    }, 500);
    
    scanStatus.textContent = '감지됨!';
    scanStatus.className = 'scan-status detecting';
    
    setTimeout(() => {
        scanStatus.textContent = '바코드를 가까이 대주세요';
        scanStatus.className = 'scan-status';
    }, 1000);
    
    // 바코드 처리
    processBarcode(code);
}

// 바코드 처리
function processBarcode(code) {
    attemptCount++;
    scanAttempts.textContent = attemptCount;
    
    // 중복 체크
    const isDuplicate = scannedCodes.some(item => item.code === code);
    
    // 히스토리 추가
    addToHistory(code, !isDuplicate);
    
    if (isDuplicate) {
        statusMessage.textContent = '이미 스캔한 바코드입니다';
        statusMessage.className = 'status-message error';
        playSound('fail');
        return;
    }
    
    // 검증
    const config = difficulties[currentDifficulty];
    const mission = missions[currentMissionIndex % missions.length];
    let isValid = false;
    
    if (config.validation === 'any') {
        // 아무 바코드나 OK
        isValid = code.length >= 8;
    } else if (config.validation === 'pattern') {
        // 패턴 검증 (880으로 시작)
        isValid = code.startsWith(config.pattern);
    } else if (config.validation === 'exact') {
        // 정확한 번호 (관리자 설정 또는 패턴)
        isValid = code.startsWith(mission.pattern);
    }
    
    if (isValid) {
        // 성공!
        scannedCodes.push({ code, time: new Date().toLocaleTimeString() });
        successCount++;
        successScans.textContent = successCount;
        currentMissionIndex++;
        
        missionSuccess(code);
    } else {
        // 실패
        statusMessage.textContent = '올바르지 않은 바코드입니다';
        statusMessage.className = 'status-message error';
        playSound('fail');
        
        if (navigator.vibrate) {
            navigator.vibrate(200);
        }
    }
}

// 미션 성공
function missionSuccess(code) {
    const config = difficulties[currentDifficulty];
    
    playSound('success');
    
    if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 200]);
    }
    
    // 체크마크 표시
    successCheckmark.classList.add('show');
    setTimeout(() => {
        successCheckmark.classList.remove('show');
    }, 1000);
    
    statusMessage.textContent = `✅ 성공! (${code})`;
    statusMessage.className = 'status-message success';
    
    // 모든 미션 완료
    if (currentMissionIndex >= config.missionCount) {
        setTimeout(() => {
            completeGame();
        }, 1500);
    } else {
        // 다음 미션
        setTimeout(() => {
            updateMissionDisplay();
            statusMessage.textContent = '다음 물건을 찾으세요!';
        }, 2000);
    }
}

// 게임 완료
function completeGame() {
    stopCamera();
    
    const totalTime = Math.floor((Date.now() - gameStartTime) / 1000);
    
    playSound('success');
    
    if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 300]);
    }
    
    statusMessage.textContent = `🎉 모든 미션 완료! (${totalTime}초)`;
    statusMessage.className = 'status-message success';
    
    setTimeout(() => {
        showSuccessScreen(GAME_ID);
    }, 2000);
}

// 히스토리 추가
function addToHistory(code, isNew) {
    const item = document.createElement('div');
    item.className = 'history-item';
    
    const codeEl = document.createElement('div');
    codeEl.className = 'history-code';
    codeEl.textContent = code;
    
    const time = document.createElement('div');
    time.className = 'history-time';
    time.textContent = new Date().toLocaleTimeString();
    
    const status = document.createElement('div');
    status.className = `history-status ${isNew ? 'success' : 'duplicate'}`;
    status.textContent = isNew ? '✓' : '중복';
    
    item.appendChild(codeEl);
    item.appendChild(time);
    item.appendChild(status);
    
    historyList.insertBefore(item, historyList.firstChild);
    
    // 최대 10개만 유지
    while (historyList.children.length > 10) {
        historyList.removeChild(historyList.lastChild);
    }
}

// 히스토리 초기화
function clearHistory() {
    if (confirm('스캔 기록을 초기화하시겠습니까?')) {
        historyList.innerHTML = '';
        statusMessage.textContent = '기록이 초기화되었습니다';
        statusMessage.className = 'status-message';
    }
}

// 수동 입력 제출
function submitManualInput() {
    const code = manualInput.value.trim();
    
    if (!code) {
        alert('바코드 번호를 입력해주세요');
        return;
    }
    
    if (code.length < 8) {
        alert('바코드 번호는 최소 8자리 이상이어야 합니다');
        return;
    }
    
    // 바코드 처리
    processBarcode(code);
    
    // 입력창 초기화
    manualInput.value = '';
}

// 카메라 정지
function stopCamera() {
    if (isCameraActive) {
        Quagga.stop();
        Quagga.offDetected(onBarcodeDetected);
        isCameraActive = false;
    }
    
    cameraView.classList.remove('active');
    startCameraBtn.style.display = 'block';
    stopCameraBtn.style.display = 'none';
    difficultySelector.style.display = 'grid';
    
    statusMessage.textContent = '카메라가 정지되었습니다';
    statusMessage.className = 'status-message';
}

// 게임 상태 리셋
function resetGameState() {
    scannedCodes = [];
    currentMissionIndex = 0;
    attemptCount = 0;
    successCount = 0;
    
    scanAttempts.textContent = '0';
    successScans.textContent = '0';
    missionProgress.textContent = '0/1';
    timeDisplay.textContent = '00:00';
    
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// 게임 리셋
function resetGame() {
    if (confirm('게임을 다시 시작하시겠습니까?')) {
        stopCamera();
        resetGameState();
        updateMissionDisplay();
        historyList.innerHTML = '';
        scanHistory.style.display = 'none';
        
        statusMessage.textContent = '게임이 초기화되었습니다';
        statusMessage.className = 'status-message';
    }
}

// 게임 시작
initGame();
