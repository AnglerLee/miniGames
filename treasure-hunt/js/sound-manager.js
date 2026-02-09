// Sound Manager - Web Audio API 기반 사운드 시스템

class SoundManager {
    constructor() {
        this.audioContext = null;
        this.sounds = {};
        this.enabled = true;
        this.volume = 0.5;
        
        // localStorage에서 설정 로드
        const savedSettings = localStorage.getItem('treasureHunt_soundSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            this.enabled = settings.enabled !== false;
            this.volume = settings.volume || 0.5;
        }
    }

    // AudioContext 초기화
    initAudioContext() {
        if (this.audioContext) return;
        
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
            this.enabled = false;
        }
    }

    // 효과음 재생 (Web Audio API로 생성)
    playSoundEffect(type) {
        if (!this.enabled) return;
        
        this.initAudioContext();
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        gainNode.gain.value = this.volume * 0.3;
        
        const now = this.audioContext.currentTime;
        
        switch (type) {
            case 'click':
                oscillator.frequency.setValueAtTime(800, now);
                oscillator.type = 'sine';
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                oscillator.start(now);
                oscillator.stop(now + 0.1);
                break;
                
            case 'success':
                // 상승하는 멜로디
                oscillator.frequency.setValueAtTime(523, now); // C5
                oscillator.frequency.setValueAtTime(659, now + 0.1); // E5
                oscillator.frequency.setValueAtTime(784, now + 0.2); // G5
                oscillator.type = 'sine';
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
                oscillator.start(now);
                oscillator.stop(now + 0.5);
                break;
                
            case 'unlock':
                // 잠금 해제 소리
                oscillator.frequency.setValueAtTime(400, now);
                oscillator.frequency.exponentialRampToValueAtTime(800, now + 0.2);
                oscillator.type = 'triangle';
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                oscillator.start(now);
                oscillator.stop(now + 0.3);
                break;
                
            case 'locked':
                // 잠긴 소리
                oscillator.frequency.setValueAtTime(300, now);
                oscillator.frequency.exponentialRampToValueAtTime(200, now + 0.15);
                oscillator.type = 'square';
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                oscillator.start(now);
                oscillator.stop(now + 0.2);
                break;
                
            case 'countdown':
                // 카운트다운 beep
                oscillator.frequency.setValueAtTime(1000, now);
                oscillator.type = 'square';
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                oscillator.start(now);
                oscillator.stop(now + 0.1);
                break;
                
            case 'fanfare':
                // 팡파르 (여러 음 조합)
                this.playFanfare();
                return;
                
            default:
                oscillator.frequency.setValueAtTime(440, now);
                oscillator.type = 'sine';
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                oscillator.start(now);
                oscillator.stop(now + 0.2);
        }
    }

    // 팡파르 효과음
    playFanfare() {
        if (!this.enabled || !this.audioContext) return;
        
        const notes = [
            { freq: 523, time: 0 },    // C5
            { freq: 659, time: 0.15 },  // E5
            { freq: 784, time: 0.3 },   // G5
            { freq: 1047, time: 0.45 }, // C6
        ];
        
        notes.forEach(note => {
            setTimeout(() => {
                const osc = this.audioContext.createOscillator();
                const gain = this.audioContext.createGain();
                
                osc.connect(gain);
                gain.connect(this.audioContext.destination);
                
                osc.frequency.value = note.freq;
                osc.type = 'sine';
                gain.gain.value = this.volume * 0.3;
                
                const now = this.audioContext.currentTime;
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                
                osc.start(now);
                osc.stop(now + 0.3);
            }, note.time * 1000);
        });
    }

    // 사운드 토글
    toggle() {
        this.enabled = !this.enabled;
        this.saveSettings();
        return this.enabled;
    }

    // 볼륨 설정
    setVolume(level) {
        this.volume = Math.max(0, Math.min(1, level));
        this.saveSettings();
    }

    // 설정 저장
    saveSettings() {
        localStorage.setItem('treasureHunt_soundSettings', JSON.stringify({
            enabled: this.enabled,
            volume: this.volume
        }));
    }

    // 모든 사운드 정지
    stopAll() {
        if (this.audioContext) {
            this.audioContext.close().then(() => {
                this.audioContext = null;
            });
        }
    }
}

// 전역 인스턴스
window.soundManager = new SoundManager();

// 버튼 클릭 사운드 자동 추가
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', (e) => {
        if (e.target.matches('button, .btn, a[href]')) {
            window.soundManager.playSoundEffect('click');
        }
    });
});
