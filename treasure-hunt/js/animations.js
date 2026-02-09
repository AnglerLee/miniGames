// Animations - 텍스트 타이핑, 카운트다운, 전환 효과

class Animations {
    constructor() {
        this.typingSpeed = 50; // ms per character
        this.currentTyping = null;
    }

    // 텍스트 타이핑 효과
    animateText(element, text, speed = this.typingSpeed) {
        return new Promise((resolve) => {
            if (this.currentTyping) {
                clearTimeout(this.currentTyping);
            }
            
            element.textContent = '';
            element.style.opacity = '1';
            let index = 0;
            
            const type = () => {
                if (index < text.length) {
                    element.textContent += text.charAt(index);
                    index++;
                    
                    // 타이핑 사운드 (10글자마다)
                    if (index % 10 === 0 && window.soundManager) {
                        window.soundManager.playSoundEffect('click');
                    }
                    
                    this.currentTyping = setTimeout(type, speed);
                } else {
                    resolve();
                }
            };
            
            type();
        });
    }

    // 카운트다운 애니메이션
    startCountdown(callback) {
        const overlay = document.createElement('div');
        overlay.className = 'countdown-overlay';
        overlay.innerHTML = `
            <div class="countdown-number">3</div>
        `;
        document.body.appendChild(overlay);
        
        const numberEl = overlay.querySelector('.countdown-number');
        let count = 3;
        
        const countdownInterval = setInterval(() => {
            if (count > 0) {
                numberEl.textContent = count;
                numberEl.style.animation = 'none';
                setTimeout(() => {
                    numberEl.style.animation = 'countdownPop 1s ease-out';
                }, 10);
                
                if (window.soundManager) {
                    window.soundManager.playSoundEffect('countdown');
                }
                
                if (navigator.vibrate) {
                    navigator.vibrate(100);
                }
                
                count--;
            } else {
                clearInterval(countdownInterval);
                numberEl.textContent = 'GO!';
                numberEl.style.animation = 'countdownGo 0.5s ease-out';
                
                if (window.soundManager) {
                    window.soundManager.playSoundEffect('success');
                }
                
                if (navigator.vibrate) {
                    navigator.vibrate([100, 50, 100]);
                }
                
                setTimeout(() => {
                    overlay.remove();
                    if (callback) callback();
                }, 500);
            }
        }, 1000);
    }

    // 요소들을 순차적으로 fade-in
    fadeInSequence(elements, delay = 100) {
        elements.forEach((el, index) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                el.style.transition = 'all 0.5s ease';
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, index * delay);
        });
    }

    // 펄스 효과
    pulseEffect(element) {
        element.style.animation = 'pulse 0.5s ease-in-out';
        
        setTimeout(() => {
            element.style.animation = '';
        }, 500);
    }

    // 흔들기 효과
    shakeEffect(element) {
        element.style.animation = 'shake 0.5s ease-in-out';
        
        if (navigator.vibrate) {
            navigator.vibrate([50, 100, 50]);
        }
        
        setTimeout(() => {
            element.style.animation = '';
        }, 500);
    }

    // 회전 등장 효과
    spinIn(element) {
        element.style.opacity = '0';
        element.style.transform = 'rotate(-180deg) scale(0)';
        
        setTimeout(() => {
            element.style.transition = 'all 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
            element.style.opacity = '1';
            element.style.transform = 'rotate(0deg) scale(1)';
        }, 100);
    }

    // 바운스 인 효과
    bounceIn(element) {
        element.style.animation = 'bounceIn 0.8s ease-out';
    }

    // 플립 효과
    flipCard(element) {
        element.style.animation = 'flipCard 0.6s ease-in-out';
    }

    // 숫자 카운트업 애니메이션
    countUp(element, start, end, duration = 1000) {
        const range = end - start;
        const increment = range / (duration / 16);
        let current = start;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= end) {
                current = end;
                clearInterval(timer);
            }
            element.textContent = Math.floor(current);
        }, 16);
    }

    // 진행 바 애니메이션
    animateProgressBar(element, targetPercent, duration = 1000) {
        element.style.width = '0%';
        
        setTimeout(() => {
            element.style.transition = `width ${duration}ms ease-out`;
            element.style.width = targetPercent + '%';
        }, 100);
    }

    // 글로우 효과
    glowEffect(element, color = '#fbbf24') {
        const originalBoxShadow = element.style.boxShadow;
        
        element.style.transition = 'box-shadow 0.3s ease';
        element.style.boxShadow = `0 0 20px ${color}, 0 0 40px ${color}`;
        
        setTimeout(() => {
            element.style.boxShadow = originalBoxShadow;
        }, 300);
    }

    // 스크롤 애니메이션 설정
    setupScrollAnimations() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                }
            });
        }, {
            threshold: 0.1
        });
        
        document.querySelectorAll('.animate-on-scroll').forEach(el => {
            observer.observe(el);
        });
    }

    // 반짝임 효과
    sparkle(element) {
        element.style.animation = 'sparkle 1s ease-in-out';
        
        setTimeout(() => {
            element.style.animation = '';
        }, 1000);
    }

    // 물결 효과 (터치 피드백)
    rippleEffect(element, event) {
        const ripple = document.createElement('span');
        ripple.className = 'ripple-effect';
        
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;
        
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        
        element.style.position = 'relative';
        element.style.overflow = 'hidden';
        element.appendChild(ripple);
        
        setTimeout(() => ripple.remove(), 600);
    }

    // 타이핑 취소
    cancelTyping() {
        if (this.currentTyping) {
            clearTimeout(this.currentTyping);
            this.currentTyping = null;
        }
    }
}

// 전역 인스턴스
window.animations = new Animations();

// 터치/클릭 시 ripple 효과 자동 추가
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', (e) => {
        if (e.target.matches('.btn, button')) {
            window.animations.rippleEffect(e.target, e);
        }
    });
});
