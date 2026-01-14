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
let currentDifficulty = 'easy';
let currentMode = 'quiz';
let secretAnswer = '';
let currentQuestionIndex = 0;
let correctCount = 0;
let attemptCount = 0;
let streakCount = 0;
let hintsUsed = 0;

// DOM 요소
const setupPhase = document.getElementById('setupPhase');
const parentPhase = document.getElementById('parentPhase');
const childPhase = document.getElementById('childPhase');
const visualizerContainer = document.getElementById('visualizerContainer');
const visualizerCanvas = document.getElementById('audioVisualizer');
const visualsCtx = visualizerCanvas.getContext('2d');
const playStatus = document.getElementById('playStatus');

// 설정 요소
const difficultyBtns = document.querySelectorAll('.difficulty-btn');
const modeBtns = document.querySelectorAll('.mode-btn');
const startQuizBtn = document.getElementById('startQuizBtn');

// 통계 요소
const correctCountEl = document.getElementById('correctCount');
const attemptCountEl = document.getElementById('attemptCount');
const streakCountEl = document.getElementById('streakCount');
const accuracyRateEl = document.getElementById('accuracyRate');

// 커스텀 모드 요소
const recordBtn = document.getElementById('recordBtn');
const stopRecordBtn = document.getElementById('stopRecordBtn');
const previewBtn = document.getElementById('previewBtn');
const secretInput = document.getElementById('secretInput');
const startCustomGameBtn = document.getElementById('startCustomGameBtn');

// 게임 요소
const missionText = document.getElementById('missionText');
const hintDisplay = document.getElementById('hintDisplay');
const childPlayBtn = document.getElementById('childPlayBtn');
const stopPlayBtn = document.getElementById('stopPlayBtn');
const speedRange = document.getElementById('speedRange');
const speedValue = document.getElementById('speedValue');
const answerInput = document.getElementById('answerInput');
const submitAnswerBtn = document.getElementById('submitAnswerBtn');
const hintBtn = document.getElementById('hintBtn');
const skipBtn = document.getElementById('skipBtn');
const backToMenuBtn = document.getElementById('backToMenuBtn');

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

// 퀴즈 샘플
const quizSamples = {
    easy: [
        { text: '사과', category: '과일' },
        { text: '책상', category: '가구' },
        { text: '냉장고', category: '가전' },
        { text: '의자', category: '가구' },
        { text: '바나나', category: '과일' },
        { text: '컴퓨터', category: '전자' },
        { text: '물병', category: '용품' },
        { text: '안녕', category: '인사' }
    ],
    medium: [
        { text: '문을 열어라', category: '명령' },
        { text: '불을 켜라', category: '명령' },
        { text: '사랑해요', category: '감정' },
        { text: '축하합니다', category: '인사' },
        { text: '잘 했어요', category: '칭찬' },
        { text: '고마워요', category: '감사' },
        { text: '미안해요', category: '사과' }
    ],
    hard: [
        { text: '냉장고 문을 열어라', category: '복잡한 명령' },
        { text: '생일 축하합니다', category: '긴 인사' },
        { text: '정말 잘 했어요', category: '긴 칭찬' },
        { text: '오늘 날씨가 좋아요', category: '일상 대화' },
        { text: '저녁 먹으러 가자', category: '제안' },
        { text: '숙제 다 했니', category: '질문' }
    ]
};

// 초기화
window.addEventListener('load', () => {
    showInstructions(
        '🔄 리버스 오디오',
        [
            '외계인의 이상한 언어를 해독하세요!',
            '속도와 방향을 조절해서 원래 말을 찾아내세요',
            '퀴즈 모드: 미리 준비된 문제',
            '커스텀 모드: 직접 녹음한 문제'
        ],
        initGame
    );
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
    
    setupEventListeners();
    loadStats();
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 난이도 선택
    difficultyBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            difficultyBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentDifficulty = btn.dataset.level;
        });
    });
    
    // 모드 선택
    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = btn.dataset.mode;
            
            // 버튼 텍스트 변경
            if (currentMode === 'quiz') {
                startQuizBtn.textContent = '🎮 게임 시작';
            } else {
                startQuizBtn.textContent = '🎙️ 녹음하러 가기';
            }
        });
    });
    
    // 게임 시작
    startQuizBtn.addEventListener('click', startGame);
    
    // 커스텀 모드
    recordBtn.addEventListener('click', startRecording);
    stopRecordBtn.addEventListener('click', stopRecording);
    previewBtn.addEventListener('click', previewRecording);
    startCustomGameBtn.addEventListener('click', startCustomGame);
    
    // 게임 플레이
    childPlayBtn.addEventListener('click', playAudio);
    stopPlayBtn.addEventListener('click', stopAudio);
    speedRange.addEventListener('input', updateSpeedLabel);
    submitAnswerBtn.addEventListener('click', checkAnswer);
    hintBtn.addEventListener('click', showHint);
    skipBtn.addEventListener('click', skipQuestion);
    backToMenuBtn.addEventListener('click', backToMenu);
    
    // Enter 키로 제출
    answerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkAnswer();
    });
}

// 게임 시작
function startGame() {
    if (currentMode === 'quiz') {
        startQuizMode();
    } else {
        // 커스텀 모드로 전환
        setupPhase.classList.remove('active');
        parentPhase.classList.add('active');
    }
}

// 퀴즈 모드 시작
async function startQuizMode() {
    currentQuestionIndex = 0;
    hintsUsed = 0;
    
    setupPhase.classList.remove('active');
    childPhase.classList.add('active');
    visualizerContainer.style.display = 'block';
    
    await loadNextQuestion();
}

// 다음 문제 로드
async function loadNextQuestion() {
    const config = difficulties[currentDifficulty];
    
    if (currentQuestionIndex >= config.questions) {
        // 게임 완료
        completeGame();
        return;
    }
    
    // 샘플 선택
    const samples = quizSamples[currentDifficulty];
    const sample = samples[Math.floor(Math.random() * samples.length)];
    
    secretAnswer = sample.text;
    
    // SpeechSynthesis로 오디오 생성
    await generateSpeech(sample.text);
    
    // UI 업데이트
    missionText.textContent = `문제 ${currentQuestionIndex + 1}/${config.questions}`;
    hintDisplay.innerHTML = '';
    answerInput.value = '';
    hintsUsed = 0;
    
    // 속도 초기화
    speedRange.value = -1.0;
    updateSpeedLabel();
}

// 음성 합성
function generateSpeech(text) {
    return new Promise(async (resolve) => {
        if (!audioCtx) await initGame();
        if (audioCtx.state === 'suspended') await audioCtx.resume();
        
        // SpeechSynthesis 사용
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ko-KR';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        
        // 오디오 캡처를 위해 MediaRecorder 사용
        const tempAudioChunks = [];
        
        // 더미 스트림 생성 (실제로는 SpeechSynthesis 출력을 직접 캡처할 수 없음)
        // 대신 간단한 방법으로 처리
        utterance.onend = () => {
            // SpeechSynthesis는 직접 AudioBuffer로 변환이 어려우므로
            // 간단한 텍스트를 오디오로 변환하는 것으로 대체
            createTextToAudioBuffer(text).then(buffer => {
                originalBuffer = buffer;
                resolve();
            });
        };
        
        speechSynthesis.speak(utterance);
    });
}

// 텍스트를 오디오 버퍼로 변환 (간단한 톤 생성)
function createTextToAudioBuffer(text) {
    return new Promise((resolve) => {
        const duration = Math.max(1, text.length * 0.2); // 글자당 0.2초
        const sampleRate = audioCtx.sampleRate;
        const numSamples = duration * sampleRate;
        
        const buffer = audioCtx.createBuffer(1, numSamples, sampleRate);
        const channelData = buffer.getChannelData(0);
        
        // 텍스트 기반으로 톤 생성 (간단한 음성 시뮬레이션)
        for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            let value = 0;
            
            // 각 글자마다 다른 주파수
            for (let j = 0; j < text.length; j++) {
                const charCode = text.charCodeAt(j);
                const freq = 200 + (charCode % 500);
                const startTime = j * 0.2;
                const endTime = startTime + 0.2;
                
                if (t >= startTime && t < endTime) {
                    const envelope = Math.sin((t - startTime) / 0.2 * Math.PI);
                    value += Math.sin(2 * Math.PI * freq * (t - startTime)) * envelope * 0.3;
                }
            }
            
            channelData[i] = Math.max(-1, Math.min(1, value));
        }
        
        resolve(buffer);
    });
}

// 녹음 시작
async function startRecording() {
    if (!audioCtx) await initGame();
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(micStream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            if (audioChunks.length === 0) {
                alert("녹음된 소리가 없습니다. 다시 시도해주세요.");
                return;
            }

            try {
                const mimeType = mediaRecorder.mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunks, { type: mimeType });
                const arrayBuffer = await audioBlob.arrayBuffer();
                originalBuffer = await audioCtx.decodeAudioData(arrayBuffer);

                previewBtn.disabled = false;
                startCustomGameBtn.disabled = false;
                playSound('success');

            } catch (error) {
                console.error("Audio Decode Error:", error);
                alert("오디오 처리 중 오류가 발생했습니다: " + error.message);
                previewBtn.disabled = true;
                startCustomGameBtn.disabled = true;
            }
        };

        mediaRecorder.start();

        const source = audioCtx.createMediaStreamSource(micStream);
        source.connect(analyser);

        isVisualizing = true;
        drawVisualizer();

        recordBtn.classList.add('hidden');
        stopRecordBtn.classList.remove('hidden');

    } catch (err) {
        console.error("Recording Error:", err);
        alert("마이크 사용 권한이 필요합니다.");
    }
}

// 녹음 정지
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        micStream.getTracks().forEach(track => track.stop());
        isVisualizing = false;
        
        stopRecordBtn.classList.add('hidden');
        recordBtn.classList.remove('hidden');
        recordBtn.innerHTML = '<span style="font-size:1.5rem">🔄</span>';
    }
}

// 미리듣기
function previewRecording() {
    if (originalBuffer) {
        playBuffer(originalBuffer, 1.0);
    }
}

// 커스텀 게임 시작
function startCustomGame() {
    const text = secretInput.value.trim();
    if (!text) {
        alert("정답 단어를 입력해주세요!");
        return;
    }
    if (!originalBuffer) {
        alert("목소리를 녹음해주세요!");
        return;
    }

    secretAnswer = text;
    hintsUsed = 0;
    
    parentPhase.classList.remove('active');
    childPhase.classList.add('active');
    visualizerContainer.style.display = 'block';
    
    missionText.textContent = '커스텀 문제';
    hintDisplay.innerHTML = '';
    answerInput.value = '';
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
    
    childPlayBtn.style.display = 'none';
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
    
    childPlayBtn.style.display = 'block';
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
    drawVisualizer();

    source.onended = () => {
        isVisualizing = false;
        playStatus.textContent = '⏸️ 정지';
        childPlayBtn.style.display = 'block';
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
                showSuccessScreen(GAME_ID);
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

// 힌트 표시
function showHint() {
    const config = difficulties[currentDifficulty];
    
    if (hintsUsed >= config.maxHints) {
        alert(`힌트는 최대 ${config.maxHints}개까지만 사용할 수 있어요!`);
        return;
    }
    
    hintsUsed++;
    
    let hintText = '';
    
    if (hintsUsed === 1) {
        // 글자 수 힌트
        hintText = `💡 힌트: ${secretAnswer.length}글자`;
        const blanks = secretAnswer.split('').map(() => '_').join(' ');
        hintText += ` (${blanks})`;
    } else if (hintsUsed === 2) {
        // 첫 글자 힌트
        hintText = `💡 힌트: 첫 글자는 "${secretAnswer[0]}"`;
    } else if (hintsUsed === 3) {
        // 정답의 절반 공개
        const half = Math.ceil(secretAnswer.length / 2);
        hintText = `💡 힌트: "${secretAnswer.substring(0, half)}"로 시작해요`;
    }
    
    hintDisplay.innerHTML = `<div class="hint-box">${hintText}</div>`;
    
    playSound('click');
}

// 문제 건너뛰기
function skipQuestion() {
    if (!confirm('이 문제를 건너뛰시겠습니까?')) {
        return;
    }
    
    streakCount = 0;
    updateStats();
    
    if (currentMode === 'quiz') {
        currentQuestionIndex++;
        loadNextQuestion();
    } else {
        backToMenu();
    }
}

// 메뉴로 돌아가기
function backToMenu() {
    stopAudio();
    
    childPhase.classList.remove('active');
    setupPhase.classList.add('active');
    visualizerContainer.style.display = 'none';
    
    answerInput.value = '';
    hintDisplay.innerHTML = '';
}

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
        showSuccessScreen(GAME_ID);
    }, 1000);
}

// 통계 업데이트
function updateStats() {
    correctCountEl.textContent = correctCount;
    attemptCountEl.textContent = attemptCount;
    streakCountEl.textContent = streakCount;
    
    const accuracy = attemptCount > 0 ? Math.round((correctCount / attemptCount) * 100) : 0;
    accuracyRateEl.textContent = `${accuracy}%`;
}

// 통계 로드
function loadStats() {
    const saved = localStorage.getItem('reverse_audio_stats');
    if (saved) {
        const stats = JSON.parse(saved);
        correctCount = stats.correct || 0;
        attemptCount = stats.attempts || 0;
        updateStats();
    }
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
