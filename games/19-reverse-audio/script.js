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
let hintsUsed = 0;          // 게임 전체 사용 힌트 수
let currentQuestionHintUsed = false; // 현재 문제 힌트 사용 여부
let gameQuestions = [];

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
const restartBtn = document.getElementById('restartBtn');

// 난이도 설정
const difficulties = {
    easy: {
        name: '쉬움',
        questions: 3,
        maxHints: 3,
        direction: 'reverse',
        speed: 0.25
    },
    medium: {
        name: '보통',
        questions: 5,
        maxHints: 2,
        direction: 'reverse',
        speed: 0.25
    },
    hard: {
        name: '어려움',
        questions: 7,
        maxHints: 1,
        direction: 'reverse',
        speed: 0.25
    }
};

// 서버에서 난이도 설정 로드
async function loadDifficultySettings() {
    try {
        const res = await fetch(`/api/games/${GAME_ID}/settings`);
        if (!res.ok) return;
        const settings = await res.json();
        if (!settings) return;
        // 난이도별 설정 로드
        Object.keys(settings).forEach(level => {
            const diffKey = ['easy', 'medium', 'hard'][parseInt(level)];
            if (difficulties[diffKey] && settings[level]) {
                if (settings[level].questions) difficulties[diffKey].questions = settings[level].questions;
                if (settings[level].maxHints) difficulties[diffKey].maxHints = settings[level].maxHints;
                if (settings[level].direction) difficulties[diffKey].direction = settings[level].direction;
                if (settings[level].speed) difficulties[diffKey].speed = settings[level].speed;
            }
        });

        // 문제 목록은 난이도 공통으로 공유
        const sharedList = settings.questionList || [];
        Object.keys(difficulties).forEach(key => {
            difficulties[key].questionList = sharedList;
        });
    } catch (e) {
        console.error('Settings load error:', e);
    }
}

// 서버에서 오디오 로드
async function loadAudioFromServer(audioUrl) {
    const res = await fetch(audioUrl);
    if (!res.ok) throw new Error('오디오 파일을 불러올 수 없습니다.');
    const arrayBuffer = await res.arrayBuffer();
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
        missionText.textContent = '오디오 기능을 사용할 수 없습니다.';
    }

    await loadDifficultySettings(); // 난이도 설정 로드 (서버에서)
    setupEventListeners();
    loadStats();
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 게임 플레이
    playBtn.addEventListener('click', playAudio);
    stopPlayBtn.addEventListener('click', stopAudio);
    submitAnswerBtn.addEventListener('click', checkAnswer);
    hintBtn.addEventListener('click', showHint);
    restartBtn.addEventListener('click', restartGame);

    // Enter 키로 제출
    answerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkAnswer();
    });
}

// 배열 셔플 (Fisher-Yates)
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// 게임 시작
async function startGame() {
    currentQuestionIndex = 0;
    hintsUsed = 0;
    currentQuestionHintUsed = false;

    const config = difficulties[currentDifficulty];
    const allQuestions = config.questionList || [];
    gameQuestions = shuffleArray([...allQuestions]).slice(0, config.questions);

    updateHintBtn();
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

    if (currentQuestionIndex >= gameQuestions.length) {
        // 게임 완료
        completeGame();
        return;
    }

    if (gameQuestions.length === 0) {
        missionText.textContent = '등록된 문제가 없습니다. 관리자 페이지에서 문제를 등록해주세요.';
        return;
    }

    // 순서대로 문제 선택 (셔플된 배열에서)
    const question = gameQuestions[currentQuestionIndex];
    secretAnswer = question.answer;

    // 로딩 중 UI (버튼 비활성화로 조기 재생 방지)
    originalBuffer = null;
    playBtn.disabled = true;
    playBtn.textContent = '⏳ 로딩 중...';
    missionText.textContent = '음성 로딩 중...';
    questionInfo.textContent = `문제 ${currentQuestionIndex + 1}/${gameQuestions.length}`;

    // 서버에서 오디오 로드
    try {
        originalBuffer = await loadAudioFromServer(question.audioUrl);
    } catch (error) {
        console.error('Audio load error:', error);
        missionText.textContent = '오디오를 불러올 수 없습니다: ' + error.message;
        playBtn.disabled = false;
        playBtn.textContent = '🔊 소리 재생';
        return;
    }

    playBtn.disabled = false;
    playBtn.textContent = '🔊 소리 재생';
    missionText.textContent = '외계인 언어를 해독하세요!';

    answerInput.value = '';
    answerInput.disabled = false;
    submitAnswerBtn.disabled = false;
    currentQuestionHintUsed = false;
    updateHintBtn();
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

    const config = difficulties[currentDifficulty];
    const rate = config.direction === 'reverse' ? -config.speed : config.speed;

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

    if (audioCtx.state === 'suspended') audioCtx.resume();
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

// 정답 공개 재생 (1배속 정방향, 끝나면 콜백)
function playAnswerReveal(onEnd) {
    if (!originalBuffer) { onEnd(); return; }

    stopAudio();

    const source = audioCtx.createBufferSource();
    source.buffer = originalBuffer; // 정방향 원본
    source.playbackRate.value = 1.0;

    source.connect(analyser);
    analyser.connect(audioCtx.destination);

    if (audioCtx.state === 'suspended') audioCtx.resume();
    source.start();
    currentSource = source;
    isVisualizing = true;
    playStatus.textContent = '✅ 정답 공개 중';
    drawVisualizer();

    source.onended = () => {
        isVisualizing = false;
        currentSource = null;
        playStatus.textContent = '⏸️ 정지';
        setTimeout(onEnd, 2000);
    };
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

        // 입력 비활성화 (오디오 재생 중 조작 방지)
        answerInput.disabled = true;
        submitAnswerBtn.disabled = true;
        hintBtn.disabled = true;

        missionText.textContent = `✅ 정답! 실제 음성을 들어보세요 → "${secretAnswer}"`;

        currentQuestionIndex++;
        playAnswerReveal(() => loadNextQuestion());
    } else {
        // 오답
        streakCount = 0;
        updateStats();

        playSound('fail');

        if (navigator.vibrate) {
            navigator.vibrate(200);
        }

        missionText.textContent = '❌ 틀렸어요! 다시 들어보세요.';
        answerInput.value = '';
        answerInput.focus();
    }
}

// 초성 추출
function getChosung(text) {
    const CHOSUNG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
    return [...text].map(ch => {
        const code = ch.charCodeAt(0) - 0xAC00;
        if (code < 0 || code > 11171) return ch;
        return CHOSUNG[Math.floor(code / (21 * 28))];
    }).join('');
}

// 힌트 버튼 상태 업데이트
function updateHintBtn() {
    const config = difficulties[currentDifficulty];
    const remaining = config.maxHints - hintsUsed;
    if (currentQuestionHintUsed || remaining <= 0) {
        hintBtn.disabled = true;
        hintBtn.textContent = remaining <= 0 ? '💡 힌트 소진' : '💡 힌트 사용됨';
    } else {
        hintBtn.disabled = false;
        hintBtn.textContent = `💡 힌트 (${remaining}회 남음)`;
    }
}

// 힌트 보기
function showHint() {
    const config = difficulties[currentDifficulty];

    if (currentQuestionHintUsed || hintsUsed >= config.maxHints) {
        return;
    }

    hintsUsed++;
    currentQuestionHintUsed = true;
    const hint = getChosung(secretAnswer);

    // 미션 텍스트에 초성 힌트 표시
    missionText.innerHTML = `💡 힌트: <span style="color: #ffd700; font-weight: bold; letter-spacing: 4px;">${hint}</span> (남은 힌트 ${config.maxHints - hintsUsed}개)`;

    updateHintBtn();
    playSound('click');
}

// 메뉴로 돌아가기


// 게임 완료
function completeGame() {
    stopAudio();

    playSound('success');

    if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 300]);
    }

    saveStats();

    window.parent.postMessage({ type: 'GAME_CLEAR', gameId: GAME_ID }, '*');
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
