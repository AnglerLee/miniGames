// 리버스 오디오 게임 - 풀 버전
const GAME_ID = 'game19';

// Audio Context
let audioCtx;
let analyser;
let micStream;
let mediaRecorder;
let audioChunks = [];
let originalBuffer = null;
let currentSource = null;
let isVisualizing = false;

// 게임 상태
let currentDifficulty = 'easy'; // 기본 난이도
let secretAnswer = '';
let currentQuestionIndex = 0;
let correctCount = 0;
let attemptCount = 0;
let streakCount = 0;
let hintsUsed = 0;

// DOM 요소
const visualizerContainer = document.getElementById('visualizerContainer');
const visualizerCanvas = document.getElementById('audioVisualizer');
const visualsCtx = visualizerCanvas.getContext('2d');
const playStatus = document.getElementById('playStatus');

// 게임 정보 바
const questionInfo = document.getElementById('questionInfo');

// 게임 요소
const missionText = document.getElementById('missionText');
const playBtn = document.getElementById('playBtn');
const stopPlayBtn = document.getElementById('stopPlayBtn');
const speedRange = document.getElementById('speedRange');
const speedValue = document.getElementById('speedValue');
const answerInput = document.getElementById('answerInput');
const submitAnswerBtn = document.getElementById('submitAnswerBtn');
const hintBtn = document.getElementById('hintBtn');
const skipBtn = document.getElementById('skipBtn');
const restartBtn = document.getElementById('restartBtn');

// 난이도 설정
const difficulties = {
    easy: {
        name: '쉬움',
        wordLength: [2, 4],
        speedRange: [-1.5, 1.5],
        questions: 3,
        maxHints: 3
    },
    medium: {
        name: '보통',
        wordLength: [5, 8],
        speedRange: [-2.0, 2.0],
        questions: 5,
        maxHints: 2
    },
    hard: {
        name: '어려움',
        wordLength: [9, 15],
        speedRange: [-2.0, 2.0],
        questions: 7,
        maxHints: 1
    }
};

// localStorage에서 난이도 설정 로드
function loadDifficultySettings() {
    const saved = localStorage.getItem('reverseAudio_settings');
    if (saved) {
        const settings = JSON.parse(saved);
        Object.keys(settings).forEach(level => {
            const diffKey = ['easy', 'medium', 'hard'][level];
            if (difficulties[diffKey]) {
                difficulties[diffKey].questions = settings[level].questions;
                difficulties[diffKey].maxHints = settings[level].maxHints;
            }
        });
    }
}

// localStorage에서 오디오 로드
async function loadAudioFromLocalStorage(questionId) {
    const audioData = localStorage.getItem(`reverseAudio_${questionId}`);
    if (!audioData) {
        throw new Error('저장된 오디오가 없습니다.');
    }

    // Base64 디코딩
    const binaryString = atob(audioData.split(',')[1]);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    // AudioBuffer로 변환
    const arrayBuffer = bytes.buffer;
    return await audioCtx.decodeAudioData(arrayBuffer);
}

// 초기화 - 자동 게임 시작
window.addEventListener('load', async () => {
    await initGame();
    await startGame(); // 자동 시작
});

async function initGame() {
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
    } catch (e) {
        console.error("Audio Context Init Failed", e);
        alert("오디오 기능을 사용할 수 없습니다.");
    }

    loadDifficultySettings(); // 난이도 설정 로드
    setupEventListeners();
    loadStats();
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 게임 플레이
    playBtn.addEventListener('click', playAudio);
    stopPlayBtn.addEventListener('click', stopAudio);
    speedRange.addEventListener('input', updateSpeedLabel);
    submitAnswerBtn.addEventListener('click', checkAnswer);
    hintBtn.addEventListener('click', showHint);
    skipBtn.addEventListener('click', skipQuestion);
    restartBtn.addEventListener('click', restartGame);

    // Enter 키로 제출
    answerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkAnswer();
    });
}

// 게임 시작
async function startGame() {
    currentQuestionIndex = 0;
    hintsUsed = 0;

    await loadNextQuestion();
}

// 게임 재시작
async function restartGame() {
    stopAudio();
    correctCount = 0;
    attemptCount = 0;
    streakCount = 0;
    updateStats();
    await startGame();
}

// 다음 문제 로드
async function loadNextQuestion() {
    const config = difficulties[currentDifficulty];

    if (currentQuestionIndex >= config.questions) {
        // 게임 완료
        completeGame();
        return;
    }

    // localStorage에서 문제 목록 로드
    const difficultyIndex = { easy: 0, medium: 1, hard: 2 }[currentDifficulty];
    const questionList = JSON.parse(
        localStorage.getItem(`reverseAudio_questions_${difficultyIndex}`) || '[]'
    );

    if (questionList.length === 0) {
        alert('등록된 문제가 없습니다. 관리자 페이지에서 문제를 등록해주세요.');
        return;
    }

    // 랜덤 문제 선택
    const question = questionList[Math.floor(Math.random() * questionList.length)];
    secretAnswer = question.answer;

    // localStorage에서 오디오 로드
    try {
        originalBuffer = await loadAudioFromLocalStorage(question.id);
    } catch (error) {
        console.error('Audio load error:', error);
        alert('오디오를 불러올 수 없습니다: ' + error.message);
        return;
    }

    // UI 업데이트
    missionText.textContent = `외계인 언어를 해독하세요!`;
    questionInfo.textContent = `문제 ${currentQuestionIndex + 1}/${config.questions}`;

    answerInput.value = '';
    hintsUsed = 0;

    // 속도 초기화
    speedRange.value = -1.0;
    updateSpeedLabel();
}





// 속도 라벨 업데이트
function updateSpeedLabel() {
    const val = parseFloat(speedRange.value);
    let label = '';

    if (val < -0.1) {
        label = `⏪ 거꾸로 ${Math.abs(val).toFixed(2)}x`;
    } else if (val > 0.1) {
        label = `⏩ 앞으로 ${val.toFixed(2)}x`;
    } else {
        label = '⏸️ 정지';
    }

    speedValue.textContent = label;
}

// 오디오 재생
function playAudio() {
    if (!originalBuffer) return;

    const rate = parseFloat(speedRange.value);
    if (Math.abs(rate) < 0.1) {
        alert('속도를 조절해주세요!');
        return;
    }

    playBuffer(originalBuffer, rate);

    playBtn.style.display = 'none';
    stopPlayBtn.style.display = 'block';
}

// 오디오 정지
function stopAudio() {
    if (currentSource) {
        currentSource.stop();
        currentSource = null;
    }
    isVisualizing = false;
    playStatus.textContent = '⏸️ 정지';

    playBtn.style.display = 'block';
    stopPlayBtn.style.display = 'none';
}

// 버퍼 재생
function playBuffer(buffer, rate) {
    stopAudio();

    const source = audioCtx.createBufferSource();
    let playBuffer = buffer;
    let playRate = Math.abs(rate);
    const isReverse = rate < 0;

    if (isReverse) {
        playBuffer = reverseBuffer(buffer);
    }

    source.buffer = playBuffer;
    source.playbackRate.value = playRate;

    source.connect(analyser);
    analyser.connect(audioCtx.destination);

    source.start();
    currentSource = source;

    isVisualizing = true;
    playStatus.textContent = '▶️ 재생 중';
    drawVisualizer(); // 비주얼라이저 시작

    source.onended = () => {
        isVisualizing = false;
        playStatus.textContent = '⏸️ 정지';
        playBtn.style.display = 'block';
        stopPlayBtn.style.display = 'none';
    };
}

// 버퍼 역재생
function reverseBuffer(buffer) {
    const numChannels = buffer.numberOfChannels;
    const newBuffer = audioCtx.createBuffer(
        numChannels,
        buffer.length,
        buffer.sampleRate
    );

    for (let c = 0; c < numChannels; c++) {
        const oldData = buffer.getChannelData(c);
        const newData = newBuffer.getChannelData(c);
        for (let i = 0; i < buffer.length; i++) {
            newData[i] = oldData[buffer.length - 1 - i];
        }
    }
    return newBuffer;
}

// 정답 확인
function checkAnswer() {
    const guess = answerInput.value.trim();
    if (!guess) return;

    attemptCount++;
    updateStats();

    const cleanGuess = guess.replace(/\s+/g, '').toLowerCase();
    const cleanSecret = secretAnswer.replace(/\s+/g, '').toLowerCase();

    if (cleanSecret.includes(cleanGuess) || cleanGuess.includes(cleanSecret)) {
        // 정답!
        correctCount++;
        streakCount++;
        updateStats();

        playSound('success');

        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
        }

        alert(`✅ 정답입니다! "${secretAnswer}"`);

        if (currentMode === 'quiz') {
            currentQuestionIndex++;
            setTimeout(() => loadNextQuestion(), 500);
        } else {
            setTimeout(() => {
                // showSuccessScreen(GAME_ID);
                window.parent.postMessage({ type: 'GAME_CLEAR', gameId: GAME_ID }, '*');
            }, 1000);
        }
    } else {
        // 오답
        streakCount = 0;
        updateStats();

        playSound('fail');

        if (navigator.vibrate) {
            navigator.vibrate(200);
        }

        alert("❌ 틀렸어요! 다시 들어보세요");
        answerInput.value = '';
        answerInput.focus();
    }
}

// 힌트 보기
function showHint() {
    const config = difficulties[currentDifficulty];

    if (hintsUsed >= config.maxHints) {
        alert(`힌트를 모두 사용했습니다! (최대 ${config.maxHints}개)`);
        return;
    }

    hintsUsed++;
    const hintLength = Math.ceil(secretAnswer.length / 2);
    const hint = secretAnswer.substring(0, hintLength);

    // 미션 텍스트에 힌트 표시
    missionText.innerHTML = `💡 힌트: <span style="color: #ffd700; font-weight: bold;">${hint}</span>... (힌트 ${hintsUsed}/${config.maxHints})`;

    playSound('click');
}

// 문제 건너뛰기
function skipQuestion() {
    if (!confirm('이 문제를 건너뛰시겠습니까?')) {
        return;
    }

    streakCount = 0;
    updateStats();
    currentQuestionIndex++;
    loadNextQuestion();
}

// 메뉴로 돌아가기


// 게임 완료
function completeGame() {
    stopAudio();

    const accuracy = attemptCount > 0 ? Math.round((correctCount / attemptCount) * 100) : 0;

    playSound('success');

    if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 300]);
    }

    alert(`🎉 게임 완료!\n\n정답: ${correctCount}개\n정답률: ${accuracy}%\n최고 연속: ${streakCount}개`);

    saveStats();

    setTimeout(() => {
        setTimeout(() => {
            window.parent.postMessage({ type: 'GAME_CLEAR', gameId: GAME_ID }, '*');
        }, 1000);
    }, 1000);
}

// 통계 업데이트
function updateStats() {
    // 통계 UI가 제거되어 비우기
}

// 통계 로드
function loadStats() {
    // 통계 UI가 제거되어 비우기
}

// 통계 저장
function saveStats() {
    localStorage.setItem('reverse_audio_stats', JSON.stringify({
        correct: correctCount,
        attempts: attemptCount
    }));
}

// 비주얼라이저
function drawVisualizer() {
    if (!isVisualizing) return;

    requestAnimationFrame(drawVisualizer);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    visualsCtx.fillStyle = 'rgb(20, 20, 30)';
    visualsCtx.fillRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);

    const barWidth = (visualizerCanvas.width / bufferLength) * 2.5;
    let barHeight;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * visualizerCanvas.height;

        const r = barHeight + (25 * (i / bufferLength));
        const g = 250 * (i / bufferLength);
        const b = 50;

        visualsCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        visualsCtx.fillRect(x, visualizerCanvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
    }
}
