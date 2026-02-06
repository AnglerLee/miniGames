// 바코드 스캐너 게임 - 관리자 설정 기반

const GAME_ID = 'game17';
const STORAGE_KEY = 'barcodeScannerSettings';

// DOM 요소
const cameraView = document.getElementById('cameraView');
const scannerContainer = document.getElementById('scanner-container');
const scanStatus = document.getElementById('scanStatus');

// 통계 요소
const scanAttempts = document.getElementById('scanAttempts');
const successScans = document.getElementById('successScans');
const missionProgress = document.getElementById('missionProgress');
const remaining = document.getElementById('remaining');
const timerDisplay = document.getElementById('timerDisplay');

// 미션 요소
const missionText = document.getElementById('missionText');

// 버튼
const startCameraBtn = document.getElementById('startCameraBtn');
const stopCameraBtn = document.getElementById('stopCameraBtn');
const resetBtn = document.getElementById('resetBtn');
const manualInput = document.getElementById('manualInput');
const manualSubmitBtn = document.getElementById('manualSubmitBtn');
const statusMessage = document.getElementById('statusMessage');
const successCheckmark = document.getElementById('successCheckmark');

// 게임 설정
let settings = {
    targetCount: 1,
    timeLimit: 0,
    targetBarcodes: []
};

// 게임 상태
let isCameraActive = false;
let scannedCodes = [];
let attemptCount = 0;
let successCount = 0;
let gameStartTime = 0;
let timerInterval = null;
let remainingTime = 0;
let lastScanTime = 0;
let scanCooldown = 1000;

// 게임 초기화
function initGame() {
    loadSettings();

    // 목표 바코드가 없으면 디폴트 모드 (아무 바코드나 허용)
    const isDefaultMode = settings.targetBarcodes.length === 0;

    showInstructions(
        '📱 바코드 스캐너',
        isDefaultMode ? [
            '목표: 바코드 1개를 찾으세요',
            '카메라로 바코드를 스캔하거나',
            '직접 번호를 입력할 수 있어요',
            '💡 어떤 바코드든 OK!'
        ] : [
            `목표: ${settings.targetBarcodes.length}개의 바코드를 찾으세요`,
            '카메라로 바코드를 스캔하거나',
            '직접 번호를 입력할 수 있어요',
            settings.timeLimit > 0 ? `⏱️ 제한시간: ${settings.timeLimit}초` : '⏱️ 시간 제한 없음'
        ],
        setupGame
    );
}

// 설정 로드
function loadSettings() {
    const loaded = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    settings = {
        targetCount: loaded.targetCount || 1,
        timeLimit: loaded.timeLimit || 0,
        targetBarcodes: loaded.targetBarcodes || []
    };

    updateMissionDisplay();
}

// 게임 설정
function setupGame() {
    setupActionButtons();
    updateMissionDisplay();

    // 시간 제한이 있으면 타이머 시작
    if (settings.timeLimit > 0) {
        remainingTime = settings.timeLimit;
        timerDisplay.classList.add('active');
        startTimer();
    }
}

// 액션 버튼 설정
function setupActionButtons() {
    startCameraBtn.addEventListener('click', startCamera);
    stopCameraBtn.addEventListener('click', stopCamera);
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
    const found = scannedCodes.length;
    const isDefaultMode = settings.targetBarcodes.length === 0;
    const total = isDefaultMode ? 1 : settings.targetBarcodes.length;

    missionProgress.textContent = `${found}/${total}`;
    remaining.textContent = total - found;

    if (found === 0) {
        missionText.textContent = isDefaultMode
            ? `📱 바코드를 찾으세요 (아무거나 OK!)`
            : `📱 ${total}개의 바코드를 찾으세요`;
    } else if (found < total) {
        missionText.textContent = `✅ ${found}개 찾음! 나머지 ${total - found}개를 더 찾으세요`;
    } else {
        missionText.textContent = `🎉 모두 찾았습니다!`;
    }
}

// 타이머 시작
function startTimer() {
    if (!gameStartTime) {
        gameStartTime = Date.now();
    }

    timerInterval = setInterval(() => {
        if (settings.timeLimit > 0) {
            // 카운트다운
            remainingTime--;

            if (remainingTime <= 0) {
                clearInterval(timerInterval);
                timeUp();
                return;
            }

            const mins = Math.floor(remainingTime / 60);
            const secs = remainingTime % 60;
            timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

            // 10초 이하일 때 빨간색
            if (remainingTime <= 10) {
                timerDisplay.style.color = 'var(--danger-color)';
            }
        } else {
            // 카운트업
            const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
            const mins = Math.floor(elapsed / 60);
            const secs = elapsed % 60;
            timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

// 시간 초과
function timeUp() {
    stopCamera();

    playSound('fail');

    if (navigator.vibrate) {
        navigator.vibrate(300);
    }

    // 동적 재시도 로직 (+10초)
    showFailScreen(
        `시간이 초과되었습니다! (${scannedCodes.length}/${settings.targetBarcodes.length} 찾음)`,
        GAME_ID,
        () => {
            // +10초 추가하여 재시작
            remainingTime = settings.timeLimit + 10;
            settings.timeLimit += 10;
            resetGameState();
            setupGame();

            statusMessage.textContent = '⏱️ +10초 추가! 다시 도전하세요';
            statusMessage.className = 'status-message success';
        }
    );
}

// 카메라 시작
async function startCamera() {
    try {
        // 카메라 권한 확인
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });

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
                    "ean_reader",
                    "ean_8_reader",
                    "code_128_reader",
                    "code_39_reader",
                    "upc_reader",
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
                statusMessage.textContent = '카메라 시작 실패';
                statusMessage.className = 'status-message error';

                showCustomModal(
                    '❌ 카메라 오류',
                    '카메라를 사용할 수 없습니다. 바코드 번호를 직접 입력해주세요.',
                    [{ text: '확인', primary: true }]
                );
                return;
            }

            Quagga.start();
            isCameraActive = true;

            cameraView.classList.add('active');
            startCameraBtn.style.display = 'none';
            stopCameraBtn.style.display = 'block';

            statusMessage.textContent = '카메라 시작됨';
            statusMessage.className = 'status-message success';

            // 타이머가 아직 시작 안 했으면 시작
            if (!timerInterval && settings.timeLimit > 0) {
                startTimer();
            }
        });

        Quagga.onDetected(onBarcodeDetected);

    } catch (error) {
        console.error('Camera error:', error);
        statusMessage.textContent = '카메라 권한 필요';
        statusMessage.className = 'status-message error';

        showCustomModal(
            '❌ 권한 필요',
            '카메라 접근 권한을 허용해주세요.',
            [{ text: '확인', primary: true }]
        );
    }
}

// 바코드 감지 핸들러
function onBarcodeDetected(result) {
    const now = Date.now();

    if (now - lastScanTime < scanCooldown) {
        return;
    }

    const code = result.codeResult.code;

    // 신뢰도 체크
    if (result.codeResult.decodedCodes.length < 5) {
        return;
    }

    lastScanTime = now;

    scanStatus.textContent = '감지됨!';
    scanStatus.className = 'scan-status success';

    setTimeout(() => {
        scanStatus.textContent = '바코드를 가까이 대주세요';
        scanStatus.className = 'scan-status';
    }, 1000);

    processBarcode(code);
}

// 바코드 처리
function processBarcode(code) {
    attemptCount++;
    scanAttempts.textContent = attemptCount;

    // 이미 스캔한 바코드인지 체크
    if (scannedCodes.includes(code)) {
        statusMessage.textContent = '이미 스캔한 바코드입니다';
        statusMessage.className = 'status-message error';
        playSound('fail');
        return;
    }

    // 목표 바코드 검증 (디폴트 모드일 때는 모든 바코드 허용)
    const isDefaultMode = settings.targetBarcodes.length === 0;

    if (!isDefaultMode && !settings.targetBarcodes.includes(code)) {
        statusMessage.textContent = '올바르지 않은 바코드입니다';
        statusMessage.className = 'status-message error';
        playSound('fail');

        if (navigator.vibrate) {
            navigator.vibrate(200);
        }
        return;
    }

    // 성공!
    scannedCodes.push(code);
    successCount++;
    successScans.textContent = successCount;

    missionSuccess(code);
}

// 미션 성공
function missionSuccess(code) {
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

    updateMissionDisplay();

    // 모든 바코드를 찾았는지 확인 (디폴트 모드는 1개만)
    const isDefaultMode = settings.targetBarcodes.length === 0;
    const targetCount = isDefaultMode ? 1 : settings.targetBarcodes.length;

    if (scannedCodes.length >= targetCount) {
        setTimeout(() => {
            completeGame();
        }, 1500);
    }
}

// 게임 완료
function completeGame() {
    stopCamera();

    if (timerInterval) {
        clearInterval(timerInterval);
    }

    const totalTime = Math.floor((Date.now() - gameStartTime) / 1000);

    playSound('success');

    if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 300]);
    }

    setTimeout(() => {
        showSuccessScreen(GAME_ID);
    }, 500);
}

// 수동 입력 제출
function submitManualInput() {
    const code = manualInput.value.trim();

    if (!code) {
        showCustomModal(
            '⚠️ 입력 필요',
            '바코드 번호를 입력해주세요.',
            [{ text: '확인', primary: true }]
        );
        return;
    }

    if (code.length < 8) {
        showCustomModal(
            '⚠️ 잘못된 입력',
            '바코드 번호는 최소 8자리 이상이어야 합니다.',
            [{ text: '확인', primary: true }]
        );
        return;
    }

    processBarcode(code);
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

    statusMessage.textContent = '카메라가 정지되었습니다';
    statusMessage.className = 'status-message';
}

// 게임 상태 리셋
function resetGameState() {
    scannedCodes = [];
    attemptCount = 0;
    successCount = 0;

    scanAttempts.textContent = '0';
    successScans.textContent = '0';

    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    gameStartTime = 0;
    timerDisplay.style.color = 'var(--warning-color)';
}

// 게임 리셋
function resetGame() {
    showCustomModal(
        '🔄 재시작',
        '게임을 다시 시작하시겠습니까?',
        [
            {
                text: '재시작',
                primary: true,
                onclick: () => {
                    stopCamera();
                    resetGameState();
                    loadSettings();
                    setupGame();

                    statusMessage.textContent = '게임이 초기화되었습니다';
                    statusMessage.className = 'status-message';
                }
            },
            {
                text: '취소'
            }
        ]
    );
}

// 커스텀 모달
function showCustomModal(title, message, buttons = [{ text: '확인', primary: true }]) {
    const modal = document.createElement('div');
    modal.className = 'modal active';

    const buttonHTML = buttons.map((btn, idx) => {
        const btnClass = btn.primary ? 'btn btn-primary' : 'btn btn-secondary';
        return `<button class="${btnClass}" data-idx="${idx}">${btn.text}</button>`;
    }).join('');

    modal.innerHTML = `
        <div class="modal-content fade-in">
            <h2>${title}</h2>
            <p>${message}</p>
            <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                ${buttonHTML}
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // 버튼 이벤트 리스너
    buttons.forEach((btn, idx) => {
        const btnEl = modal.querySelector(`[data-idx="${idx}"]`);
        btnEl.addEventListener('click', () => {
            modal.remove();
            if (btn.onclick) btn.onclick();
        });
    });
}

// 게임 시작
initGame();
