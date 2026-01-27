// === BOSS SYSTEM ===
// Random Boss Types: Destroyer, Summoner, Overlord
// Wave scaling: Boss mạnh hơn theo wave

class Boss extends Enemy {
    constructor() {
        super('boss');

        // === TÍNH TOÁN ĐỘ KHÓ THEO WAVE ===
        const bossNumber = Math.floor(wave / 5);
        const difficultyMultiplier = 1 + bossNumber * 0.5;

        // Random boss type: 0=Destroyer, 1=Summoner, 2=Overlord
        this.bossType = Math.floor(Math.random() * 3);

        // === STATS CƠ BẢN ===
        const baseHp = 300 + Math.random() * 200;
        this.hp = Math.floor(baseHp * difficultyMultiplier);
        this.maxHp = this.hp;
        this.spd = (0.8 + Math.random() * 0.4) * (1 + bossNumber * 0.15);

        // Cooldown attack - nhanh hơn ở wave cao
        const baseCooldown = 2000 + Math.random() * 1000;
        this.attackCooldown = Math.max(800, baseCooldown - bossNumber * 300);
        this.lastAttack = 0;
        this.phase = 1;

        // === KÍCH THƯỚC VÀ VISUAL ===
        this.w = 70 + bossNumber * 12 + Math.random() * 20;
        this.h = this.w;
        this.rotation = 0;
        this.glowIntensity = 0;

        // === ATTACK POOL - Mỗi boss có attacks khác nhau ===
        this.attackPool = this.generateRandomAttackPool();

        // === LASER STATE ===
        this.laserCharging = false;
        this.laserFiring = false;
        this.laserAngle = 0;
        this.laserSweep = false;
        this.laserTimer = 0;
        this.laserChargeTime = Math.max(600, 1200 - bossNumber * 100);
        this.laserFireTime = 2000 + bossNumber * 300;

        // === SUMMONER STATE ===
        this.lastSummon = 0;
        this.summonCount = 2 + Math.floor(bossNumber * 0.5);

        // === DEATH ANIMATION ===
        this.dying = false;
        this.deathTimer = 0;

        // === PHASE TRANSITION ===
        this.transitioning = false;
        this.transitionTimer = 0;

        // === TELEPORT - 30%+ chance có khả năng này ===
        this.canTeleport = Math.random() < 0.3 + bossNumber * 0.1;
        this.teleporting = false;
        this.teleportTimer = 0;
        this.teleportTarget = null;

        // === MINES ===
        this.mines = [];
        this.mineCount = 3 + Math.floor(bossNumber * 0.7);

        // === RAGE MODE - Kích hoạt khi HP thấp ===
        this.enraged = false;
        this.rageThreshold = 0.35 + Math.random() * 0.1;

        // === CHARGE ATTACK STATE - Dùng animation loop thay vì setTimeout ===
        this.isCharging = false;
        this.chargeDirection = { x: 0, y: 0 };
        this.chargeProgress = 0;

        // === ENTRY ANIMATION ===
        this.entering = true;
        this.entryY = -100;
        this.y = -100;

        // === TÊN VÀ MÀU SẮC ===
        this.names = ['DESTROYER', 'SUMMONER', 'OVERLORD', 'CHAOS LORD', 'NIGHTMARE'];
        this.colors = ['#ff3333', '#9933ff', '#ffcc00', '#00ffff', '#ff6600'];

        const suffixes = ['', ' MK-' + (bossNumber + 1), ' PRIME', ' OMEGA', ' REDUX'];
        this.displayName = this.names[this.bossType] + (bossNumber > 0 ? suffixes[Math.min(bossNumber, 4)] : '');
        this.color = this.colors[this.bossType];
    }

    // Tạo pool attacks ngẫu nhiên cho từng boss
    generateRandomAttackPool() {
        const allAttacks = ['burst', 'spiral', 'wave', 'shotgun', 'charge', 'summon', 'omniBurst', 'mines', 'laser'];
        const pool = [];

        // Core attacks theo boss type
        if (this.bossType === 0) {
            pool.push('burst', 'shotgun');
            if (Math.random() < 0.5) pool.push('charge');
        } else if (this.bossType === 1) {
            pool.push('summon', 'wave');
            if (Math.random() < 0.5) pool.push('spiral');
        } else {
            pool.push('laser', 'omniBurst');
            if (Math.random() < 0.5) pool.push('mines');
        }

        // Thêm 1-3 attacks random
        const extraCount = 1 + Math.floor(Math.random() * 3);
        const available = allAttacks.filter(a => !pool.includes(a));
        for (let i = 0; i < extraCount && available.length > 0; i++) {
            const idx = Math.floor(Math.random() * available.length);
            pool.push(available.splice(idx, 1)[0]);
        }

        return pool;
    }

    update() {
        const now = Date.now();

        // === ENTRY ANIMATION ===
        if (this.entering) {
            this.entryY += 2;
            this.y = this.entryY;
            if (this.y >= 50) {
                this.entering = false;
                this.y = 50;
                screenShake = 20;
                for (let i = 0; i < 50; i++) {
                    const ang = Math.random() * Math.PI * 2;
                    particles.push(new Particle(
                        this.x + this.w / 2 + Math.cos(ang) * 50,
                        this.y + this.h / 2 + Math.sin(ang) * 50,
                        this.colors[this.bossType], 3, 6, 40
                    ));
                }
            }
            return;
        }

        // === DEATH ANIMATION ===
        if (this.dying) {
            this.deathTimer += 16;
            if (this.deathTimer % 100 < 20) {
                screenShake = 10;
                const rx = this.x + Math.random() * this.w;
                const ry = this.y + Math.random() * this.h;
                for (let i = 0; i < 10; i++) {
                    particles.push(new Particle(rx, ry,
                        ['#ff0', '#f80', '#f00'][Math.floor(Math.random() * 3)],
                        3, 5, 30));
                }
            }
            if (this.deathTimer >= 2000) {
                this.finalExplosion();
                this.hp = -999;
            }
            return;
        }

        // === PHASE CHECK ===
        const hpPct = this.hp / this.maxHp;
        const newPhase = hpPct <= this.rageThreshold ? 3 : (hpPct <= 0.6 ? 2 : 1);

        if (newPhase !== this.phase && !this.transitioning) {
            this.transitioning = true;
            this.transitionTimer = 60;
            this.phase = newPhase;
            screenShake = 15;

            for (let i = 0; i < 30; i++) {
                const ang = (i / 30) * Math.PI * 2;
                particles.push(new Particle(
                    this.x + this.w / 2 + Math.cos(ang) * 60,
                    this.y + this.h / 2 + Math.sin(ang) * 60,
                    this.color, 2, 4, 30
                ));
            }

            // RAGE MODE - Phase 3
            if (this.phase === 3 && !this.enraged) {
                this.enraged = true;
                this.attackCooldown *= 0.5;
                this.spd *= 1.8;
                screenShake = 25;
            }
        }

        if (this.transitioning) {
            this.transitionTimer--;
            if (this.transitionTimer <= 0) this.transitioning = false;
            this.glowIntensity = 1;
            return;
        }

        // === XỬ LÝ CHARGE ATTACK (thay vì setTimeout) ===
        if (this.isCharging) {
            this.chargeProgress++;
            if (this.chargeProgress <= 30) {
                this.x += this.chargeDirection.x * 10;
                this.y += this.chargeDirection.y * 10;
                this.x = Math.max(0, Math.min(W - this.w, this.x));
                this.y = Math.max(0, Math.min(H - this.h, this.y));
            } else {
                this.isCharging = false;
                this.chargeProgress = 0;
            }
        }

        // === MOVEMENT ===
        if (!this.isCharging) {
            this.moveByType();
        }

        // === VISUAL UPDATES ===
        this.rotation += this.enraged ? 0.05 : 0.02;
        this.anim += 0.1;
        this.pulse += 0.15 * this.pdir;
        if (this.pulse > 6) this.pdir = -1;
        else if (this.pulse < 0) this.pdir = 1;
        if (this.flash > 0) this.flash -= 0.05;
        this.glowIntensity = Math.max(0, this.glowIntensity - 0.02);

        // === UPDATE SPECIAL STATES ===
        this.updateLaser();
        this.updateMines();
        this.updateTeleport();

        // === ATTACK LOGIC ===
        if (now - this.lastAttack >= this.attackCooldown && !this.laserCharging && !this.laserFiring && !this.isCharging) {
            this.useSkill();
        }
    }

    moveByType() {
        const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
        const px = playerX + PW / 2, py = playerY + PH / 2;

        if (this.bossType === 0) {
            // DESTROYER - Đuổi theo player
            const dx = px - cx, dy = py - cy;
            const d = Math.sqrt(dx * dx + dy * dy);

            if (this.phase === 1) {
                if (d > 100) {
                    this.x += (dx / d) * this.spd;
                    this.y += (dy / d) * this.spd;
                }
            } else if (this.phase === 2) {
                const t = Date.now() / 1000;
                if (Math.sin(t * 2) > 0.7) {
                    this.x += (dx / d) * this.spd * 3;
                    this.y += (dy / d) * this.spd * 3;
                } else if (d > 80) {
                    this.x += (dx / d) * this.spd * 1.5;
                    this.y += (dy / d) * this.spd * 1.5;
                }
            } else {
                // Phase 3 - Berserker zigzag
                this.x += (dx / d) * this.spd * 1.5 + Math.sin(Date.now() / 100) * this.spd * 1.5;
                this.y += (dy / d) * this.spd * 1.5 + Math.cos(Date.now() / 80) * this.spd;
            }
        } else if (this.bossType === 1) {
            // SUMMONER - Vòng quanh player
            const dx = px - cx, dy = py - cy;
            const d = Math.sqrt(dx * dx + dy * dy);
            const idealDist = 180 + Math.sin(Date.now() / 2000) * 80;

            if (d < idealDist - 40) {
                this.x -= (dx / d) * this.spd * 1.2;
                this.y -= (dy / d) * this.spd * 1.2;
            } else if (d > idealDist + 40) {
                this.x += (dx / d) * this.spd;
                this.y += (dy / d) * this.spd;
            } else {
                const perpX = -dy / d, perpY = dx / d;
                this.x += perpX * this.spd * (this.phase >= 2 ? 1.5 : 1);
                this.y += perpY * this.spd * (this.phase >= 2 ? 1.5 : 1);
            }
        } else {
            // OVERLORD - Di chuyển hình số 8
            if (!this.teleporting) {
                const t = Date.now() / 3000;
                const targetX = W / 2 + Math.sin(t) * (W * 0.35);
                const targetY = H / 2 + Math.sin(t * 2) * (H * 0.3);

                const dx = targetX - cx, dy = targetY - cy;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d > 10) {
                    this.x += (dx / d) * this.spd * 1.2;
                    this.y += (dy / d) * this.spd * 1.2;
                }
            }
        }

        // Giữ trong màn hình
        this.x = Math.max(10, Math.min(W - this.w - 10, this.x));
        this.y = Math.max(10, Math.min(H - this.h - 10, this.y));
    }

    updateLaser() {
        if (this.laserCharging) {
            this.laserTimer -= 16;
            const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
            const targetAngle = Math.atan2(playerY + PH / 2 - cy, playerX + PW / 2 - cx);
            this.laserAngle += (targetAngle - this.laserAngle) * 0.05;

            if (this.laserTimer <= 0) {
                this.laserCharging = false;
                this.laserFiring = true;
                this.laserTimer = this.laserFireTime;
                screenShake = 15;
            }
        }

        if (this.laserFiring) {
            this.laserTimer -= 16;

            if (this.phase === 3 && this.laserSweep) {
                this.laserAngle += 0.02;
            }

            // Damage player nếu trong laser
            const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
            const lx = cx + Math.cos(this.laserAngle) * 800;
            const ly = cy + Math.sin(this.laserAngle) * 800;
            const px = playerX + PW / 2, py = playerY + PH / 2;
            const d = distToSegment(px, py, cx, cy, lx, ly);

            if (d < 30 && !invincible) {
                playerHealth -= 1;
                if (Math.random() < 0.3) {
                    particles.push(new Particle(px, py, '#f00', 2, 3, 15));
                }
            }

            if (this.laserTimer <= 0) {
                this.laserFiring = false;
            }
        }
    }

    updateMines() {
        this.mines = this.mines.filter(m => {
            m.timer -= 16;
            m.pulse = (m.pulse || 0) + 0.1;

            if (m.timer <= 0) {
                for (let i = 0; i < 20; i++) {
                    particles.push(new Particle(m.x, m.y, '#fa0', 3, 5, 25));
                }
                screenShake = 8;

                const dx = playerX + PW / 2 - m.x, dy = playerY + PH / 2 - m.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < 80 && !invincible) {
                    playerHealth -= 25;
                }
                return false;
            }
            return true;
        });
    }

    updateTeleport() {
        if (this.teleporting) {
            this.teleportTimer -= 16;

            if (this.teleportTimer <= 500 && this.teleportTarget) {
                this.x = this.teleportTarget.x;
                this.y = this.teleportTarget.y;
                this.teleportTarget = null;
                screenShake = 12;

                for (let i = 0; i < 20; i++) {
                    const ang = (i / 20) * Math.PI * 2;
                    particles.push(new Particle(
                        this.x + this.w / 2 + Math.cos(ang) * 40,
                        this.y + this.h / 2 + Math.sin(ang) * 40,
                        '#ff0', 2, 4, 20
                    ));
                }
            }

            if (this.teleportTimer <= 0) {
                this.teleporting = false;
            }
        }
    }

    draw() {
        ctx.save();
        const cx = this.x + this.w / 2, cy = this.y + this.h / 2;

        // === GLOW EFFECT ===
        const glowSize = 20 + this.pulse + (this.enraged ? 10 : 0) + this.glowIntensity * 30;
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, this.w / 2 + glowSize);
        gradient.addColorStop(0, this.colors[this.bossType] + '80');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, this.w / 2 + glowSize, 0, Math.PI * 2);
        ctx.fill();

        // === ROTATING RING ===
        ctx.strokeStyle = this.colors[this.bossType];
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const ang = this.rotation + (i / 8) * Math.PI * 2;
            const r1 = this.w / 2 + 5;
            const r2 = this.w / 2 + 15;
            ctx.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
            ctx.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2);
        }
        ctx.stroke();

        // === MAIN BODY - Khác nhau theo type ===
        if (this.bossType === 0) {
            // DESTROYER - Hexagon có gai
            ctx.fillStyle = '#880000';
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const ang = this.rotation + (i / 6) * Math.PI * 2;
                const r = this.w / 2;
                const spike = i % 2 === 0 ? 10 : 0;
                ctx.lineTo(cx + Math.cos(ang) * (r + spike), cy + Math.sin(ang) * (r + spike));
            }
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#ff4444';
            ctx.stroke();
        } else if (this.bossType === 1) {
            // SUMMONER - Diamond với orbs
            ctx.fillStyle = '#440066';
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const ang = this.rotation + (i / 4) * Math.PI * 2;
                ctx.lineTo(cx + Math.cos(ang) * this.w / 2, cy + Math.sin(ang) * this.w / 2);
            }
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#cc66ff';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Orbiting orbs
            for (let i = 0; i < 4; i++) {
                const ang = -this.rotation * 2 + (i / 4) * Math.PI * 2;
                const orbX = cx + Math.cos(ang) * 35;
                const orbY = cy + Math.sin(ang) * 35;
                ctx.fillStyle = '#aa44ff';
                ctx.beginPath();
                ctx.arc(orbX, orbY, 8, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            // OVERLORD - Crown shape
            ctx.fillStyle = '#886600';
            ctx.beginPath();
            ctx.arc(cx, cy, this.w / 2 - 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffcc00';
            for (let i = 0; i < 5; i++) {
                const ang = -Math.PI / 2 + (i - 2) * 0.4;
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(ang) * (this.w / 2 - 10), cy + Math.sin(ang) * (this.w / 2 - 10));
                ctx.lineTo(cx + Math.cos(ang - 0.15) * (this.w / 2 + 15), cy + Math.sin(ang - 0.15) * (this.w / 2 + 15));
                ctx.lineTo(cx + Math.cos(ang + 0.15) * (this.w / 2 + 15), cy + Math.sin(ang + 0.15) * (this.w / 2 + 15));
                ctx.closePath();
                ctx.fill();
            }
        }

        // === MẮT BOSS ===
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx, cy, this.w * 0.15, 0, Math.PI * 2);
        ctx.fill();

        const eyeAng = Math.atan2(playerY - cy, playerX - cx);
        ctx.fillStyle = this.enraged ? '#f00' : '#000';
        ctx.beginPath();
        ctx.arc(cx + Math.cos(eyeAng) * 5, cy + Math.sin(eyeAng) * 5, this.w * 0.08, 0, Math.PI * 2);
        ctx.fill();

        // === RAGE INDICATOR ===
        if (this.enraged) {
            ctx.strokeStyle = `rgba(255, 0, 0, ${0.3 + Math.sin(Date.now() * 0.01) * 0.3})`;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(cx, cy, this.w / 2 + 20, 0, Math.PI * 2);
            ctx.stroke();
        }

        // === VẼ LASER ===
        if (this.laserCharging) {
            const prog = 1 - this.laserTimer / this.laserChargeTime;
            ctx.strokeStyle = `rgba(255, 0, 0, ${prog})`;
            ctx.lineWidth = 2 + prog * 5;
            ctx.setLineDash([10, 10]);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(this.laserAngle) * 500, cy + Math.sin(this.laserAngle) * 500);
            ctx.stroke();
            ctx.setLineDash([]);

            if (Math.random() < prog) {
                const ang = Math.random() * Math.PI * 2;
                particles.push(new Particle(
                    cx + Math.cos(ang) * 50, cy + Math.sin(ang) * 50,
                    '#f00', 1, 2, 15
                ));
            }
        }

        if (this.laserFiring) {
            const beamWidth = 20 + Math.sin(Date.now() * 0.05) * 5;
            const lx = cx + Math.cos(this.laserAngle) * 800;
            const ly = cy + Math.sin(this.laserAngle) * 800;

            ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
            ctx.lineWidth = beamWidth * 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(lx, ly);
            ctx.stroke();

            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = beamWidth;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(lx, ly);
            ctx.stroke();

            ctx.strokeStyle = '#fff';
            ctx.lineWidth = beamWidth * 0.3;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(lx, ly);
            ctx.stroke();
        }

        // === VẼ MINES ===
        this.mines.forEach(m => {
            const danger = m.timer < 1000;
            const pulse = Math.sin(m.pulse * (danger ? 3 : 1)) * 0.3 + 0.7;
            ctx.fillStyle = danger ? `rgba(255, 0, 0, ${pulse})` : `rgba(255, 150, 0, ${pulse})`;
            ctx.beginPath();
            ctx.arc(m.x, m.y, 12 + (danger ? Math.sin(m.pulse * 5) * 3 : 0), 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        });

        // === HIT FLASH ===
        if (this.flash > 0) {
            ctx.globalAlpha = this.flash;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(cx, cy, this.w / 2 + 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        ctx.restore();

        // === HEALTH BAR VÀ TÊN ===
        this.drawHealthBar();

        ctx.fillStyle = this.color;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.displayName, cx, this.y - 20);
        ctx.textAlign = 'left';
    }

    drawHealthBar() {
        const barWidth = Math.min(300, W - 100);
        const barX = (W - barWidth) / 2;
        const barY = 20;
        const barH = 12;

        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barWidth, barH);

        const hpPct = Math.max(0, this.hp / this.maxHp);
        const hpColor = this.enraged ? '#ff0000' :
            `rgb(${Math.floor(255 * (1 - hpPct))}, ${Math.floor(255 * hpPct)}, 0)`;
        ctx.fillStyle = hpColor;
        ctx.fillRect(barX, barY, hpPct * barWidth, barH);

        // Phase markers
        ctx.fillStyle = '#fff';
        ctx.fillRect(barX + barWidth * 0.6 - 1, barY, 2, barH);
        ctx.fillRect(barX + barWidth * 0.3 - 1, barY, 2, barH);

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX, barY, barWidth, barH);
    }

    useSkill() {
        this.lastAttack = Date.now();

        let attacks = [...this.attackPool];

        if (this.canTeleport && this.phase >= 2) {
            attacks.push('teleport');
        }

        if (this.phase === 3 && !attacks.includes('laserSweep')) {
            attacks.push('laserSweep');
        }

        const attack = attacks[Math.floor(Math.random() * attacks.length)];

        // Thực hiện attack
        if (attack === 'burst') this.burstAttack();
        else if (attack === 'spiral') this.spiralAttack();
        else if (attack === 'wave') this.waveAttack();
        else if (attack === 'shotgun') this.shotgunAttack();
        else if (attack === 'charge') this.chargeAttack();
        else if (attack === 'summon') this.summonAttack();
        else if (attack === 'omniBurst') this.omniBurstAttack();
        else if (attack === 'mines') this.minesAttack();
        else if (attack === 'laser') this.laserAttack(false);
        else if (attack === 'laserSweep') this.laserAttack(true);
        else if (attack === 'teleport') this.teleportAttack();

        // RAGE MODE: 30% thêm attack thứ 2 (không dùng setTimeout)
        if (this.enraged && Math.random() < 0.3) {
            this.attackCooldown *= 0.5; // Giảm cooldown tạm thời
        }
    }

    // === CÁC ATTACK TYPES ===
    burstAttack() {
        const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
        const count = this.enraged ? 24 : 16;
        for (let i = 0; i < count; i++) {
            const a = (2 * Math.PI * i / count) + this.rotation;
            scheduledBullets.push({ x: cx, y: cy, angle: a, delay: 0, color: this.colors[this.bossType], damage: 15 });
        }
        screenShake = 5;
    }

    spiralAttack() {
        const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
        const count = this.enraged ? 30 : 20;
        for (let i = 0; i < count; i++) {
            const a = (2 * Math.PI * i / count * 2) + Date.now() / 500;
            scheduledBullets.push({ x: cx, y: cy, angle: a, delay: i * 40, color: '#fa0', damage: 12 });
        }
    }

    waveAttack() {
        const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
        const px = playerX + PW / 2, py = playerY + PH / 2;
        const baseAngle = Math.atan2(py - cy, px - cx);
        const count = this.enraged ? 7 : 5;

        for (let i = -count; i <= count; i++) {
            const a = baseAngle + i * 0.12;
            scheduledBullets.push({ x: cx, y: cy, angle: a, delay: Math.abs(i) * 50, color: '#0ff', damage: 10 });
        }
    }

    shotgunAttack() {
        const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
        const px = playerX + PW / 2, py = playerY + PH / 2;
        const baseAngle = Math.atan2(py - cy, px - cx);

        for (let i = 0; i < 8; i++) {
            const a = baseAngle + (Math.random() - 0.5) * 0.5;
            scheduledBullets.push({ x: cx, y: cy, angle: a, delay: 0, color: '#f00', damage: 20 });
        }
        screenShake = 8;
    }

    // FIX: Dùng state thay vì setTimeout
    chargeAttack() {
        const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
        const dx = playerX + PW / 2 - cx, dy = playerY + PH / 2 - cy;
        const d = Math.sqrt(dx * dx + dy * dy);

        this.isCharging = true;
        this.chargeProgress = 0;
        this.chargeDirection = { x: dx / d, y: dy / d };
        screenShake = 10;
    }

    summonAttack() {
        const count = this.enraged ? this.summonCount + 2 : this.summonCount;
        for (let i = 0; i < count; i++) {
            const ang = (i / count) * Math.PI * 2;
            const ex = this.x + this.w / 2 + Math.cos(ang) * 60;
            const ey = this.y + this.h / 2 + Math.sin(ang) * 60;

            const minion = new Enemy('small');
            minion.x = ex;
            minion.y = ey;
            minion.hp *= 0.5;
            enemies.push(minion);

            for (let j = 0; j < 10; j++) {
                particles.push(new Particle(ex, ey, '#a0f', 2, 3, 20));
            }
        }
        screenShake = 5;
    }

    omniBurstAttack() {
        const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
        for (let ring = 0; ring < 3; ring++) {
            for (let i = 0; i < 16; i++) {
                const a = (2 * Math.PI * i / 16) + ring * 0.1;
                scheduledBullets.push({
                    x: cx, y: cy, angle: a,
                    delay: ring * 200,
                    color: ['#f00', '#ff0', '#0ff'][ring],
                    damage: 15
                });
            }
        }
        screenShake = 12;
    }

    minesAttack() {
        const count = this.enraged ? 7 : 4;
        for (let i = 0; i < count; i++) {
            const offsetX = (Math.random() - 0.5) * 200;
            const offsetY = (Math.random() - 0.5) * 200;
            this.mines.push({
                x: Math.max(20, Math.min(W - 20, playerX + PW / 2 + offsetX)),
                y: Math.max(20, Math.min(H - 20, playerY + PH / 2 + offsetY)),
                timer: 2500,
                pulse: 0
            });
        }
    }

    laserAttack(sweep) {
        this.laserCharging = true;
        this.laserAngle = Math.atan2(playerY + PH / 2 - (this.y + this.h / 2), playerX + PW / 2 - (this.x + this.w / 2));
        this.laserTimer = this.laserChargeTime;
        this.laserSweep = sweep;
    }

    teleportAttack() {
        this.teleporting = true;
        this.teleportTimer = 1000;

        for (let i = 0; i < 20; i++) {
            const ang = (i / 20) * Math.PI * 2;
            particles.push(new Particle(
                this.x + this.w / 2 + Math.cos(ang) * 30,
                this.y + this.h / 2 + Math.sin(ang) * 30,
                '#ff0', 2, 4, 25
            ));
        }

        this.teleportTarget = {
            x: Math.random() * (W - this.w),
            y: Math.random() * (H / 2)
        };
    }

    finalExplosion() {
        for (let i = 0; i < 100; i++) {
            const ang = Math.random() * Math.PI * 2;
            const dist = Math.random() * 100;
            const colors = ['#ff0', '#f80', '#f00', '#fff'];
            particles.push(new Particle(
                this.x + this.w / 2 + Math.cos(ang) * dist,
                this.y + this.h / 2 + Math.sin(ang) * dist,
                colors[Math.floor(Math.random() * colors.length)],
                3 + Math.random() * 4, 8, 50
            ));
        }
        screenShake = 30;
        playerMoney += 50 + Math.floor(wave / 5) * 25;
    }

    hit(dmg) {
        if (this.dying || this.entering) return;
        super.hit(dmg);
        this.glowIntensity = 0.5;

        if (this.hp <= 0 && !this.dying) {
            this.dying = true;
            this.deathTimer = 0;
        }
    }
}

// === SCHEDULED BULLETS - Xử lý bullets từ boss attacks ===
let scheduledBullets = [];

// === HEALTH PICKUP SYSTEM ===
let healthPickup = null;

function spawnHealthPickup() {
    healthPickup = {
        x: Math.random() * (W - 20),
        y: Math.random() * (H - 20)
    };
}

function drawHealthPickup() {
    if (!healthPickup) return;
    const x = healthPickup.x, y = healthPickup.y;

    // Hiệu ứng pulse
    const pulse = Math.sin(Date.now() * 0.003) * 0.2 + 1.0;

    // Glow xanh lá
    ctx.globalAlpha = 0.3 * pulse;
    ctx.fillStyle = '#0f0';
    ctx.beginPath();
    ctx.arc(x + 10, y + 10, 30 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Hình trái tim màu xanh
    ctx.fillStyle = '#0f0';
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 5);
    ctx.bezierCurveTo(x + 10, y + 3, x + 7.5, y, x + 5, y + 3);
    ctx.bezierCurveTo(x + 2.5, y, x, y + 3, x, y + 5);
    ctx.bezierCurveTo(x, y + 7.5, x, y + 10, x + 10, y + 17.5);
    ctx.bezierCurveTo(x + 20, y + 10, x + 20, y + 7.5, x + 20, y + 5);
    ctx.bezierCurveTo(x + 20, y + 3, x + 17.5, y, x + 15, y + 3);
    ctx.bezierCurveTo(x + 12.5, y, x + 10, y + 3, x + 10, y + 5);
    ctx.fill();
}

// === UTILITY: Tính khoảng cách từ điểm đến đoạn thẳng ===
function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 == 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const projx = x1 + t * dx, projy = y1 + t * dy;
    return Math.sqrt((px - projx) ** 2 + (py - projy) ** 2);
}
