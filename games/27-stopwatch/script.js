const GAME_ID = 'game27';
const TARGET_TIME = 5.00;
const SUCCESS_MARGIN = 0.10; // +/- 0.1s is success

class StopwatchGame {
    constructor() {
        this.timerEl = document.getElementById('timer');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.resultEl = document.getElementById('result');
        this.blindModeCheck = document.getElementById('blindModeCheck');
        this.gameArea = document.querySelector('.game-area');

        this.startTime = 0;
        this.requestId = null;
        this.isRunning = false;

        this.initEvents();
    }

    initEvents() {
        this.startBtn.addEventListener('click', () => this.start());
        this.stopBtn.addEventListener('click', () => this.stop());

        // Blind mode toggle
        this.blindModeCheck.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.gameArea.classList.add('blind-mode-active');
            } else {
                this.gameArea.classList.remove('blind-mode-active');
            }
        });
    }

    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.startTime = performance.now();
        this.startBtn.style.display = 'none';
        this.stopBtn.style.display = 'inline-block';
        this.resultEl.textContent = '';
        this.timerEl.classList.remove('success-anim', 'fail-anim');

        // In blind mode, we might want to hide the initial 0.00 right away or keep it visible until start
        // The CSS handles hiding #timer content when blind-mode-active class is present

        this.loop();
    }

    loop() {
        if (!this.isRunning) return;

        const currentTime = performance.now();
        const elapsed = (currentTime - this.startTime) / 1000;

        // Update display
        // In blind mode, the text color is transparent, so updating textContent is fine (it won't be seen)
        this.timerEl.textContent = elapsed.toFixed(2);

        this.requestId = requestAnimationFrame(() => this.loop());
    }

    stop() {
        if (!this.isRunning) return;

        this.isRunning = false;
        cancelAnimationFrame(this.requestId);

        const stopTime = performance.now();
        const elapsed = (stopTime - this.startTime) / 1000;
        // Ensure we display the final time accurately
        this.timerEl.textContent = elapsed.toFixed(2);

        this.startBtn.style.display = 'inline-block';
        this.stopBtn.style.display = 'none';
        this.startBtn.textContent = '다시 도전';

        this.checkResult(elapsed);
    }

    checkResult(elapsed) {
        const diff = Math.abs(elapsed - TARGET_TIME);

        if (diff <= SUCCESS_MARGIN) {
            this.handleSuccess(elapsed, diff);
        } else {
            this.handleFail(elapsed, diff);
        }
    }

    handleSuccess(elapsed, diff) {
        this.resultEl.innerHTML = `✅ 완벽해요! (${elapsed.toFixed(2)}s)`;
        this.resultEl.style.color = 'var(--success-color)';
        this.timerEl.classList.add('success-anim');

        // If in blind mode, temporarily reveal the timer (remove blind class?) 
        // Or maybe just keeping the text visible is enough because the CSS only hides it via color transparent?
        // Let's rely on the result text for feedback primarily, but maybe flash the timer?
        if (this.blindModeCheck.checked) {
            // Briefly reveal timer for feedback
            this.gameArea.classList.remove('blind-mode-active');
            setTimeout(() => {
                // Only add it back if the checkbox is still checked
                if (this.blindModeCheck.checked) this.gameArea.classList.add('blind-mode-active');
            }, 3000);
        }

        if (typeof playSound === 'function') playSound('success');

        setTimeout(() => {
            // if (typeof showSuccessScreen === 'function') showSuccessScreen(GAME_ID);
            window.parent.postMessage({ type: 'GAME_CLEAR', gameId: GAME_ID }, '*');
        }, 1500);
    }

    handleFail(elapsed, diff) {
        this.resultEl.innerHTML = `❌ 아쉬워요! (${elapsed.toFixed(2)}s) <span class="diff-value">${diff > 0 ? '+' : ''}${(elapsed - TARGET_TIME).toFixed(2)}</span>`;
        this.resultEl.style.color = 'var(--danger-color)';
        this.timerEl.classList.add('fail-anim');

        // Logic for revealing timer in blind mode on fail too
        if (this.blindModeCheck.checked) {
            this.gameArea.classList.remove('blind-mode-active');
            setTimeout(() => {
                if (this.blindModeCheck.checked) this.gameArea.classList.add('blind-mode-active');
            }, 3000);
        }
    }
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    const game = new StopwatchGame();

    // Instructions
    if (typeof showInstructions === 'function') {
        showInstructions('⏱️ 절대음감 스톱워치', [
            '시작 버튼을 누르면 시간이 흐릅니다.',
            `정확히 <strong style="color:red">${TARGET_TIME.toFixed(2)}초</strong>에 멈춰보세요!`,
            '블라인드 모드에 도전하면 시계를 안 보고 맞춰야 합니다!'
        ], () => { });
    }
});
