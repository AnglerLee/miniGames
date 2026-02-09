// UI Effects - 파티클, Confetti, 시각 효과

class UIEffects {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.confetti = [];
        this.animationFrame = null;
    }

    // 캔버스 초기화
    initCanvas() {
        if (this.canvas) return this.canvas;
        
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'effects-canvas';
        this.canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 9999;
        `;
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        
        window.addEventListener('resize', () => this.resizeCanvas());
        return this.canvas;
    }

    resizeCanvas() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    // Confetti 효과
    createConfetti(duration = 3000) {
        this.initCanvas();
        this.confetti = [];
        
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#fd79a8', '#fdcb6e'];
        const confettiCount = window.innerWidth < 768 ? 50 : 100;
        
        for (let i = 0; i < confettiCount; i++) {
            this.confetti.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height - this.canvas.height,
                w: Math.random() * 10 + 5,
                h: Math.random() * 5 + 5,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * 360,
                speedY: Math.random() * 3 + 2,
                speedX: Math.random() * 2 - 1,
                rotationSpeed: Math.random() * 10 - 5
            });
        }
        
        const startTime = Date.now();
        const animate = () => {
            if (Date.now() - startTime > duration) {
                this.clearCanvas();
                return;
            }
            
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.confetti.forEach(c => {
                this.ctx.save();
                this.ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
                this.ctx.rotate((c.rotation * Math.PI) / 180);
                this.ctx.fillStyle = c.color;
                this.ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
                this.ctx.restore();
                
                c.y += c.speedY;
                c.x += c.speedX;
                c.rotation += c.rotationSpeed;
                
                if (c.y > this.canvas.height) {
                    c.y = -20;
                    c.x = Math.random() * this.canvas.width;
                }
            });
            
            this.animationFrame = requestAnimationFrame(animate);
        };
        
        animate();
    }

    // 테마별 배경 파티클
    createBackgroundParticles(theme) {
        this.initCanvas();
        this.particles = [];
        
        const config = this.getThemeParticleConfig(theme);
        const particleCount = window.innerWidth < 768 ? 30 : 50;
        
        for (let i = 0; i < particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * config.maxSize + config.minSize,
                speedX: (Math.random() - 0.5) * config.speed,
                speedY: Math.random() * config.speed + 0.5,
                opacity: Math.random() * 0.5 + 0.3,
                color: config.color
            });
        }
        
        const animate = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.particles.forEach(p => {
                this.ctx.save();
                this.ctx.globalAlpha = p.opacity;
                this.ctx.fillStyle = p.color;
                
                if (theme === 'pirate') {
                    // 별 모양
                    this.drawStar(p.x, p.y, 5, p.size, p.size / 2);
                } else if (theme === 'magic') {
                    // 반짝이
                    this.drawSparkle(p.x, p.y, p.size);
                } else {
                    // 기본 원
                    this.ctx.beginPath();
                    this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    this.ctx.fill();
                }
                
                this.ctx.restore();
                
                p.x += p.speedX;
                p.y += p.speedY;
                
                if (p.y > this.canvas.height) {
                    p.y = -10;
                    p.x = Math.random() * this.canvas.width;
                }
                if (p.x < 0) p.x = this.canvas.width;
                if (p.x > this.canvas.width) p.x = 0;
            });
            
            this.animationFrame = requestAnimationFrame(animate);
        };
        
        animate();
    }

    getThemeParticleConfig(theme) {
        const configs = {
            pirate: { minSize: 2, maxSize: 4, speed: 0.5, color: '#fbbf24' },
            space: { minSize: 1, maxSize: 3, speed: 0.3, color: '#ffffff' },
            magic: { minSize: 2, maxSize: 5, speed: 0.4, color: '#ec4899' },
            jungle: { minSize: 3, maxSize: 6, speed: 0.6, color: '#10b981' },
            spy: { minSize: 1, maxSize: 2, speed: 0.8, color: '#00ff00' }
        };
        return configs[theme] || configs.pirate;
    }

    drawStar(cx, cy, spikes, outerRadius, innerRadius) {
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        const step = Math.PI / spikes;
        
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy - outerRadius);
        
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            this.ctx.lineTo(x, y);
            rot += step;
            
            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            this.ctx.lineTo(x, y);
            rot += step;
        }
        
        this.ctx.lineTo(cx, cy - outerRadius);
        this.ctx.closePath();
        this.ctx.fill();
    }

    drawSparkle(x, y, size) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, y - size);
        this.ctx.lineTo(x, y + size);
        this.ctx.moveTo(x - size, y);
        this.ctx.lineTo(x + size, y);
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.arc(x, y, size / 3, 0, Math.PI * 2);
        this.ctx.fill();
    }

    // 언락 애니메이션
    showUnlockAnimation(element) {
        element.style.transform = 'scale(0.8)';
        element.style.opacity = '0';
        
        setTimeout(() => {
            element.style.transition = 'all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
            element.style.transform = 'scale(1)';
            element.style.opacity = '1';
        }, 100);
        
        // 반짝이는 효과
        const sparkles = document.createElement('div');
        sparkles.className = 'unlock-sparkles';
        sparkles.innerHTML = '✨'.repeat(6);
        element.style.position = 'relative';
        element.appendChild(sparkles);
        
        setTimeout(() => sparkles.remove(), 1000);
    }

    // 캔버스 정리
    clearCanvas() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        this.particles = [];
        this.confetti = [];
    }

    // 정리
    destroy() {
        this.clearCanvas();
        if (this.canvas) {
            this.canvas.remove();
            this.canvas = null;
            this.ctx = null;
        }
    }
}

// 전역 인스턴스
window.uiEffects = new UIEffects();
