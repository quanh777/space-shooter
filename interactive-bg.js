// Interactive Background Particles - Mouse Only
class InteractiveBackground {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.mouse = { x: null, y: null, radius: 150 };
        this.particleCount = 80;

        this.setupCanvas();
        this.createParticles();
        this.setupEventListeners();
        this.animate();
    }

    setupCanvas() {
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.zIndex = '-1';
        this.canvas.style.pointerEvents = 'none';

        document.body.appendChild(this.canvas);
        this.resize();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createParticles() {
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                baseX: 0,
                baseY: 0,
                size: Math.random() * 2 + 1,
                density: Math.random() * 30 + 10,
                color: this.getParticleColor()
            });
        }

        this.particles.forEach(p => {
            p.baseX = p.x;
            p.baseY = p.y;
        });
    }

    getParticleColor() {
        const colors = [
            'rgba(88, 101, 242, 0.6)',
            'rgba(237, 66, 100, 0.6)',
            'rgba(255, 255, 255, 0.4)'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.resize());

        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.x;
            this.mouse.y = e.y;
        });

        window.addEventListener('mouseleave', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });
    }

    drawParticles() {
        this.particles.forEach(particle => {
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fillStyle = particle.color;
            this.ctx.fill();

            if (this.mouse.x !== null) {
                this.ctx.shadowBlur = 8;
                this.ctx.shadowColor = particle.color;
                this.ctx.fill();
                this.ctx.shadowBlur = 0;
            }
        });
    }

    connectParticles() {
        if (this.mouse.x === null) return;

        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const dx = this.particles[i].x - this.particles[j].x;
                const dy = this.particles[i].y - this.particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 100) {
                    const opacity = (1 - distance / 100) * 0.25;
                    this.ctx.strokeStyle = `rgba(88, 101, 242, ${opacity})`;
                    this.ctx.lineWidth = 0.5;
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
                    this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
                    this.ctx.stroke();
                }
            }
        }
    }

    connectToMouse() {
        if (this.mouse.x === null || this.mouse.y === null) return;

        this.particles.forEach(particle => {
            const dx = this.mouse.x - particle.x;
            const dy = this.mouse.y - particle.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < this.mouse.radius) {
                const opacity = (1 - distance / this.mouse.radius) * 0.5;
                this.ctx.strokeStyle = `rgba(237, 66, 100, ${opacity})`;
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.moveTo(particle.x, particle.y);
                this.ctx.lineTo(this.mouse.x, this.mouse.y);
                this.ctx.stroke();
            }
        });

        // Draw glow at mouse
        this.ctx.beginPath();
        this.ctx.arc(this.mouse.x, this.mouse.y, 3, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(237, 66, 100, 0.6)';
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = 'rgba(237, 66, 100, 0.8)';
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
    }

    updateParticles() {
        if (this.mouse.x === null || this.mouse.y === null) {
            // No mouse - return to base position smoothly
            this.particles.forEach(particle => {
                const dx = particle.baseX - particle.x;
                const dy = particle.baseY - particle.y;
                particle.x += dx * 0.05;
                particle.y += dy * 0.05;
            });
            return;
        }

        // Mouse present - attract particles
        this.particles.forEach(particle => {
            const dx = this.mouse.x - particle.x;
            const dy = this.mouse.y - particle.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const forceDirectionX = dx / distance;
            const forceDirectionY = dy / distance;
            const maxDistance = this.mouse.radius;
            const force = (maxDistance - distance) / maxDistance;

            if (distance < this.mouse.radius) {
                const directionX = forceDirectionX * force * particle.density * 0.3;
                const directionY = forceDirectionY * force * particle.density * 0.3;
                particle.x += directionX;
                particle.y += directionY;
            }

            // Gentle return to base
            const baseDx = particle.baseX - particle.x;
            const baseDy = particle.baseY - particle.y;
            particle.x += baseDx * 0.02;
            particle.y += baseDy * 0.02;
        });
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.updateParticles();
        this.drawParticles();
        this.connectParticles();
        this.connectToMouse();

        requestAnimationFrame(() => this.animate());
    }
}

// Initialize when page loads
window.addEventListener('load', () => {
    new InteractiveBackground();
});
